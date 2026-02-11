import { NextRequest } from 'next/server';
import { eq, and, sql, desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  alertSettings,
  alertAcknowledgments,
  gateways,
  gatewayStatus,
  tags,
  tagSensingData,
} from '@/lib/db/schema';
import { getSession, requireAuth, resolveCompanyId, apiError, apiSuccess } from '@/lib/api-utils';

export type AlertItem = {
  type: 'tag_stale' | 'gw_disconnected';
  key: string;
  title: string;
  message: string;
  since: string; // ISO string
};

export async function GET(req: NextRequest) {
  const session = await getSession();
  const authError = requireAuth(session);
  if (authError) return authError;

  const companyId = resolveCompanyId(session, req);

  if (!companyId) return apiError('회사 정보가 없습니다', 400);

  const sessionIat = (session as { sessionIat?: number }).sessionIat;
  if (!sessionIat) return apiError('세션 정보가 없습니다', 401);

  const [settings] = await db
    .select()
    .from(alertSettings)
    .where(eq(alertSettings.companyId, companyId))
    .limit(1);

  const tagHours = settings?.tagLastUpdateHours ?? 24;
  const gwHours = settings?.gwDisconnectHours ?? 24;
  const enableTag = settings?.enableTagHeartbeatAlert ?? true;
  const enableGw = settings?.enableGwDisconnectAlert ?? true;

  const alerts: AlertItem[] = [];
  const now = new Date();

  // 1. 태그 미갱신 알림
  if (enableTag) {
    const tagList = await db
      .select({
        tagMac: tags.tagMac,
        tagName: tags.tagName,
      })
      .from(tags)
      .where(eq(tags.companyId, companyId));

    for (const tag of tagList) {
      const [latest] = await db
        .select({ receivedTime: tagSensingData.receivedTime })
        .from(tagSensingData)
        .where(eq(tagSensingData.tagMac, tag.tagMac))
        .orderBy(desc(tagSensingData.receivedTime))
        .limit(1);

      if (!latest) continue; // 아직 센싱 데이터 없으면 제외

      const lastUpdate = latest.receivedTime instanceof Date ? latest.receivedTime : new Date(latest.receivedTime);
      const diffHours = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);
      if (diffHours >= tagHours) {
        alerts.push({
          type: 'tag_stale',
          key: tag.tagMac,
          title: '태그 미갱신',
          message: `${tag.tagName} (${tag.tagMac}) - ${Math.floor(diffHours)}시간 이상 갱신 없음`,
          since: lastUpdate.toISOString(),
        });
      }
    }
  }

  // 2. 게이트웨이 연결 끊김 알림
  if (enableGw) {
    const disconnectedGws = await db
      .select({
        gwMac: gateways.gwMac,
        gwName: gateways.gwName,
        lastConnectedAt: gatewayStatus.lastConnectedAt,
      })
      .from(gateways)
      .innerJoin(gatewayStatus, eq(gateways.gwMac, gatewayStatus.gwMac))
      .where(
        and(
          eq(gateways.companyId, companyId),
          eq(gatewayStatus.isConnected, false),
          sql`${gatewayStatus.lastConnectedAt} IS NOT NULL`
        )
      );

    for (const gw of disconnectedGws) {
      const lastAt = gw.lastConnectedAt instanceof Date ? gw.lastConnectedAt : new Date(gw.lastConnectedAt!);
      const diffHours = (now.getTime() - lastAt.getTime()) / (1000 * 60 * 60);
      if (diffHours >= gwHours) {
        alerts.push({
          type: 'gw_disconnected',
          key: gw.gwMac,
          title: '게이트웨이 연결 끊김',
          message: `${gw.gwName} (${gw.gwMac}) - ${Math.floor(diffHours)}시간 이상 연결 끊김`,
          since: lastAt.toISOString(),
        });
      }
    }
  }

  // 3. 이번 세션에서 확인한 알림 제외
  const acknowledged = await db
    .select({ alertType: alertAcknowledgments.alertType, alertKey: alertAcknowledgments.alertKey })
    .from(alertAcknowledgments)
    .where(
      and(
        eq(alertAcknowledgments.userId, session!.user.id),
        eq(alertAcknowledgments.companyId, companyId),
        eq(alertAcknowledgments.sessionIat, sessionIat)
      )
    );

  const ackSet = new Set(acknowledged.map((a) => `${a.alertType}:${a.alertKey}`));
  const filteredAlerts = alerts.filter((a) => !ackSet.has(`${a.type}:${a.key}`));

  return apiSuccess({
    alerts: filteredAlerts,
    count: filteredAlerts.length,
  });
}
