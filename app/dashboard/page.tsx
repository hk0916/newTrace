import { eq, desc, sql } from 'drizzle-orm';
import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { db, getCompanyTables } from '@/lib/db';
import { COMPANY_COOKIE_NAME } from '@/lib/company-cookie';
import { StatsCards } from './components/stats-cards';
import { GatewayTable } from './components/gateway-table';
import { TagTable } from './components/tag-table';
import { DashboardRefresh } from './components/dashboard-refresh';
import { TableFilter } from './components/table-filter';
import { DashboardMapPreview } from './components/dashboard-map-preview';
import { DashboardCompanySelect } from './components/dashboard-company-select';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const tagSearch = (params.tagSearch as string)?.toLowerCase().trim() || '';
  const tagOrder = (params.tagOrder as string) === 'asc' ? 'asc' : 'desc';
  const gwSearch = (params.gwSearch as string)?.toLowerCase().trim() || '';
  const gwOrder = (params.gwOrder as string) === 'asc' ? 'asc' : 'desc';

  const session = await auth();
  const cookieStore = await cookies();
  const companyCookie = cookieStore.get(COMPANY_COOKIE_NAME)?.value;

  let companyId: string | null | undefined =
    session!.user.role === 'super'
      ? companyCookie || session?.user?.companyId
      : session!.user.companyId;

  // super가 companyId 없거나 'super'(시스템)이면 → /api/init-company로 리다이렉트 (쿠키 설정)
  const needRedirectSuper = session!.user.role === 'super' && (!companyId || companyId === 'super');
  if (needRedirectSuper) {
    const { redirect } = await import('next/navigation');
    redirect('/api/init-company');
  }
  if (!companyId) {
    const { redirect } = await import('next/navigation');
    redirect('/login');
  }

  const cid = companyId as string;
  const {
    gateways, gatewayStatus, tags, tagSensingData,
    assetMaps, assetMapGateways,
  } = getCompanyTables(cid);
  const schemaName = `tenant_${cid}`;

  // 통계 데이터
  const [gwStats] = await db
    .select({
      total: sql<number>`count(*)`,
      active: sql<number>`count(*) filter (where ${gateways.isActive} = true)`,
    })
    .from(gateways);

  const [connStats] = await db
    .select({
      connected: sql<number>`count(*) filter (where ${gatewayStatus.isConnected} = true)`,
    })
    .from(gatewayStatus)
    .innerJoin(gateways, eq(gatewayStatus.gwMac, gateways.gwMac));

  const [tagStats] = await db
    .select({
      total: sql<number>`count(*)`,
      active: sql<number>`count(*) filter (where ${tags.isActive} = true)`,
    })
    .from(tags);

  const stats = {
    gateways: { total: gwStats.total, active: gwStats.active, connected: connStats.connected },
    tags: { total: tagStats.total, active: tagStats.active },
    alerts: { lowVoltage: 0 },
  };

  // 대시보드에 표시 선택된 자산맵만 조회
  const mapList = await db
    .select()
    .from(assetMaps)
    .where(eq(assetMaps.showOnDashboard, true));

  const mapsWithPlacements = await Promise.all(
    mapList.map(async (map) => {
      const placements = await db
        .select({
          id: assetMapGateways.id,
          gwMac: assetMapGateways.gwMac,
          gwName: gateways.gwName,
          xPercent: assetMapGateways.xPercent,
          yPercent: assetMapGateways.yPercent,
          widthPercent: assetMapGateways.widthPercent,
          heightPercent: assetMapGateways.heightPercent,
          isConnected: gatewayStatus.isConnected,
          color: assetMapGateways.color,
          tagCount: sql<number>`(SELECT COUNT(*) FROM ${sql.raw(`"${schemaName}"."tags"`)} WHERE assigned_gw_mac = ${sql.raw(`"${schemaName}"."asset_map_gateways"."gw_mac"`)} AND is_active = true)`.as('tag_count'),
        })
        .from(assetMapGateways)
        .innerJoin(gateways, eq(assetMapGateways.gwMac, gateways.gwMac))
        .leftJoin(gatewayStatus, eq(assetMapGateways.gwMac, gatewayStatus.gwMac))
        .where(eq(assetMapGateways.mapId, map.id));

      return {
        id: map.id,
        name: map.name,
        imagePath: map.imagePath,
        imageWidth: map.imageWidth,
        imageHeight: map.imageHeight,
        gatewayAreaColor: map.gatewayAreaColor ?? 'amber',
        placements: placements.map((p) => ({
          id: p.id,
          gwMac: p.gwMac,
          gwName: p.gwName,
          xPercent: Number(p.xPercent),
          yPercent: Number(p.yPercent),
          widthPercent: Number(p.widthPercent),
          heightPercent: Number(p.heightPercent),
          isConnected: p.isConnected ?? false,
          tagCount: Number(p.tagCount),
          color: p.color ?? undefined,
        })),
      };
    })
  );

  // 게이트웨이 목록
  let gatewayList = await db
    .select({
      gwMac: gateways.gwMac,
      gwName: gateways.gwName,
      location: gateways.location,
      description: gateways.description,
      isActive: gateways.isActive,
      isConnected: gatewayStatus.isConnected,
      fwVersion: gatewayStatus.fwVersion,
      lastConnectedAt: gatewayStatus.lastConnectedAt,
      tagCount: sql<number>`(SELECT COUNT(*) FROM ${sql.raw(`"${schemaName}"."tags"`)} WHERE assigned_gw_mac = ${sql.raw(`"${schemaName}"."gateways"."gw_mac"`)} AND is_active = true)`,
    })
    .from(gateways)
    .leftJoin(gatewayStatus, eq(gateways.gwMac, gatewayStatus.gwMac));

  if (gwSearch) {
    const s = gwSearch.replace(/[:\-]/g, '').toLowerCase();
    gatewayList = gatewayList.filter(
      (gw) =>
        gw.gwMac.toLowerCase().includes(s) ||
        gw.gwName.toLowerCase().includes(gwSearch) ||
        (gw.location?.toLowerCase().includes(gwSearch) ?? false)
    );
  }
  gatewayList.sort((a, b) => {
    const aTime = a.lastConnectedAt ? new Date(a.lastConnectedAt).getTime() : 0;
    const bTime = b.lastConnectedAt ? new Date(b.lastConnectedAt).getTime() : 0;
    return gwOrder === 'desc' ? bTime - aTime : aTime - bTime;
  });

  // 태그 목록 + 최신 센싱 데이터
  const tagList = await db
    .select()
    .from(tags);

  let tagsWithSensing = await Promise.all(
    tagList.map(async (tag) => {
      const [latest] = await db
        .select()
        .from(tagSensingData)
        .where(eq(tagSensingData.tagMac, tag.tagMac))
        .orderBy(desc(tagSensingData.receivedTime))
        .limit(1);

      return {
        tagMac: tag.tagMac,
        tagName: tag.tagName,
        assetType: tag.assetType,
        assignedGwMac: tag.assignedGwMac,
        reportInterval: tag.reportInterval,
        description: tag.description,
        isActive: tag.isActive,
        latestSensing: latest
          ? {
              gwMac: latest.gwMac,
              temperature: latest.temperature,
              voltage: latest.voltage,
              rssi: latest.rssi,
              receivedTime: latest.receivedTime?.toISOString() ?? null,
            }
          : null,
      };
    })
  );

  if (tagSearch) {
    const s = tagSearch.replace(/[:\-]/g, '').toLowerCase();
    tagsWithSensing = tagsWithSensing.filter(
      (t) =>
        t.tagMac.toLowerCase().includes(s) ||
        t.tagName.toLowerCase().includes(tagSearch) ||
        (t.assetType?.toLowerCase().includes(tagSearch) ?? false)
    );
  }
  tagsWithSensing.sort((a, b) => {
    const aTime = a.latestSensing?.receivedTime ? new Date(a.latestSensing.receivedTime).getTime() : 0;
    const bTime = b.latestSensing?.receivedTime ? new Date(b.latestSensing.receivedTime).getTime() : 0;
    return tagOrder === 'desc' ? bTime - aTime : aTime - bTime;
  });

  const t = await getTranslations('dashboard');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <DashboardCompanySelect />
        </div>
        <DashboardRefresh />
      </div>

      <StatsCards stats={stats} />

      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-lg font-semibold">{t('gateway')}</h2>
          <Suspense fallback={null}>
            <TableFilter prefix="gw" searchPlaceholder={t('gwSearchPlaceholder')} />
          </Suspense>
        </div>
        <GatewayTable
          gateways={gatewayList.map((gw) => ({
            ...gw,
            lastConnectedAt: gw.lastConnectedAt?.toISOString() ?? null,
          }))}
          companyId={cid}
          canEdit={session!.user.role === 'super' || session!.user.role === 'admin'}
        />
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-lg font-semibold">{t('tag')}</h2>
          <Suspense fallback={null}>
            <TableFilter prefix="tag" searchPlaceholder={t('tagSearchPlaceholder')} />
          </Suspense>
        </div>
        <TagTable
          tags={tagsWithSensing}
          canEdit={session!.user.role === 'super' || session!.user.role === 'admin'}
          companyId={cid}
        />
      </div>

      <DashboardMapPreview
        maps={mapsWithPlacements}
        companyId={cid}
        canEdit={session!.user.role === 'super' || session!.user.role === 'admin'}
      />
    </div>
  );
}
