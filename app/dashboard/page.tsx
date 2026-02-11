import { eq, desc, sql } from 'drizzle-orm';
import { Suspense } from 'react';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { gateways, gatewayStatus, tags, tagSensingData } from '@/lib/db/schema';
import { StatsCards } from './components/stats-cards';
import { GatewayTable } from './components/gateway-table';
import { TagTable } from './components/tag-table';
import { DashboardRefresh } from './components/dashboard-refresh';
import { TableFilter } from './components/table-filter';

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
  const companyId = session!.user.companyId!;

  // 통계 데이터
  const [gwStats] = await db
    .select({
      total: sql<number>`count(*)`,
      active: sql<number>`count(*) filter (where ${gateways.isActive} = true)`,
    })
    .from(gateways)
    .where(eq(gateways.companyId, companyId));

  const [connStats] = await db
    .select({
      connected: sql<number>`count(*) filter (where ${gatewayStatus.isConnected} = true)`,
    })
    .from(gatewayStatus)
    .innerJoin(gateways, eq(gatewayStatus.gwMac, gateways.gwMac))
    .where(eq(gateways.companyId, companyId));

  const [tagStats] = await db
    .select({
      total: sql<number>`count(*)`,
      active: sql<number>`count(*) filter (where ${tags.isActive} = true)`,
    })
    .from(tags)
    .where(eq(tags.companyId, companyId));

  const stats = {
    gateways: { total: gwStats.total, active: gwStats.active, connected: connStats.connected },
    tags: { total: tagStats.total, active: tagStats.active },
    alerts: { lowVoltage: 0 },
  };

  // 게이트웨이 목록
  let gatewayList = await db
    .select({
      gwMac: gateways.gwMac,
      gwName: gateways.gwName,
      location: gateways.location,
      isConnected: gatewayStatus.isConnected,
      fwVersion: gatewayStatus.fwVersion,
      lastConnectedAt: gatewayStatus.lastConnectedAt,
    })
    .from(gateways)
    .leftJoin(gatewayStatus, eq(gateways.gwMac, gatewayStatus.gwMac))
    .where(eq(gateways.companyId, companyId));

  if (gwSearch) {
    const s = gwSearch.replace(/:/g, '');
    gatewayList = gatewayList.filter(
      (gw) =>
        gw.gwMac.replace(/:/g, '').toLowerCase().includes(s) ||
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
    .from(tags)
    .where(eq(tags.companyId, companyId));

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
    const s = tagSearch.replace(/:/g, '');
    tagsWithSensing = tagsWithSensing.filter(
      (t) =>
        t.tagMac.replace(/:/g, '').toLowerCase().includes(s) ||
        t.tagName.toLowerCase().includes(tagSearch) ||
        (t.assetType?.toLowerCase().includes(tagSearch) ?? false)
    );
  }
  tagsWithSensing.sort((a, b) => {
    const aTime = a.latestSensing?.receivedTime ? new Date(a.latestSensing.receivedTime).getTime() : 0;
    const bTime = b.latestSensing?.receivedTime ? new Date(b.latestSensing.receivedTime).getTime() : 0;
    return tagOrder === 'desc' ? bTime - aTime : aTime - bTime;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">대시보드</h1>
        <DashboardRefresh />
      </div>

      <StatsCards stats={stats} />

      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-lg font-semibold">게이트웨이</h2>
          <Suspense fallback={null}>
            <TableFilter prefix="gw" searchPlaceholder="게이트웨이 검색 (이름, MAC, 위치)" />
          </Suspense>
        </div>
        <GatewayTable
          gateways={gatewayList.map((gw) => ({
            ...gw,
            lastConnectedAt: gw.lastConnectedAt?.toISOString() ?? null,
          }))}
        />
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-lg font-semibold">태그</h2>
          <Suspense fallback={null}>
            <TableFilter prefix="tag" searchPlaceholder="태그 검색 (이름, MAC, 자산유형)" />
          </Suspense>
        </div>
        <TagTable tags={tagsWithSensing} />
      </div>
    </div>
  );
}
