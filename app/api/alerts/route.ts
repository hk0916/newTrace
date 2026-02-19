import { NextRequest } from 'next/server';
import { eq, and, sql, desc, isNull, inArray } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { db } from '@/lib/db';
import {
  alertSettings,
  alertAcknowledgments,
  alertHistory,
  gateways,
  gatewayStatus,
  tags,
  tagSensingData,
} from '@/lib/db/schema';
import { getSession, requireAuth, resolveCompanyId, apiError, apiSuccess } from '@/lib/api-utils';

export type AlertItem = {
  type: 'tag_stale' | 'gw_disconnected' | 'high_temp' | 'low_temp' | 'low_voltage';
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
  const enableHighTemp = settings?.enableHighTempAlert ?? true;
  const enableLowTemp = settings?.enableLowTempAlert ?? true;
  const enableLowVoltage = settings?.enableLowVoltageAlert ?? true;
  const highTempThreshold = parseFloat(settings?.highTempThreshold ?? '40');
  const lowTempThreshold = parseFloat(settings?.lowTempThreshold ?? '0');
  const lowVoltageThreshold = parseFloat(settings?.lowVoltageThreshold ?? '2.5');

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

  // 3. 온도/전압 알림 (태그별 최신 센싱 데이터 기준)
  if (enableHighTemp || enableLowTemp || enableLowVoltage) {
    const tagList = await db
      .select({ tagMac: tags.tagMac, tagName: tags.tagName })
      .from(tags)
      .where(and(eq(tags.companyId, companyId), eq(tags.isActive, true)));

    for (const tag of tagList) {
      const [latest] = await db
        .select({
          temperature: tagSensingData.temperature,
          voltage: tagSensingData.voltage,
          receivedTime: tagSensingData.receivedTime,
        })
        .from(tagSensingData)
        .where(eq(tagSensingData.tagMac, tag.tagMac))
        .orderBy(desc(tagSensingData.receivedTime))
        .limit(1);

      if (!latest) continue;

      const temp = latest.temperature !== null ? parseFloat(latest.temperature) : null;
      const volt = latest.voltage !== null ? parseFloat(latest.voltage) : null;
      const since = (latest.receivedTime instanceof Date ? latest.receivedTime : new Date(latest.receivedTime)).toISOString();

      if (enableHighTemp && temp !== null && temp > highTempThreshold) {
        alerts.push({
          type: 'high_temp',
          key: tag.tagMac,
          title: '고온 경보',
          message: `${tag.tagName} (${tag.tagMac}) - 온도 ${temp.toFixed(1)}°C (기준: ${highTempThreshold}°C 초과)`,
          since,
        });
      }
      if (enableLowTemp && temp !== null && temp < lowTempThreshold) {
        alerts.push({
          type: 'low_temp',
          key: tag.tagMac,
          title: '저온 경보',
          message: `${tag.tagName} (${tag.tagMac}) - 온도 ${temp.toFixed(1)}°C (기준: ${lowTempThreshold}°C 미만)`,
          since,
        });
      }
      if (enableLowVoltage && volt !== null && volt < lowVoltageThreshold) {
        alerts.push({
          type: 'low_voltage',
          key: tag.tagMac,
          title: '저전압 경보',
          message: `${tag.tagName} (${tag.tagMac}) - 전압 ${volt.toFixed(2)}V (기준: ${lowVoltageThreshold}V 미만)`,
          since,
        });
      }
    }
  }

  // 4. 이번 세션에서 확인한 알림 제외
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

  // 4. 알림 히스토리 기록
  // 4-1. 현재 active alerts → 미존재 레코드 INSERT
  for (const alert of alerts) {
    const [existing] = await db
      .select({ id: alertHistory.id })
      .from(alertHistory)
      .where(
        and(
          eq(alertHistory.companyId, companyId),
          eq(alertHistory.alertType, alert.type),
          eq(alertHistory.alertKey, alert.key),
          isNull(alertHistory.resolvedAt)
        )
      )
      .limit(1);

    if (!existing) {
      await db.insert(alertHistory).values({
        id: uuid(),
        companyId,
        alertType: alert.type,
        alertKey: alert.key,
        alertName: alert.title,
        alertMessage: alert.message,
        triggeredAt: new Date(alert.since),
      });
    }
  }

  // 4-2. 해소된 알림 → resolvedAt 업데이트
  const activeKeys = alerts.map((a) => `${a.type}:${a.key}`);
  const openHistory = await db
    .select({ id: alertHistory.id, alertType: alertHistory.alertType, alertKey: alertHistory.alertKey })
    .from(alertHistory)
    .where(
      and(
        eq(alertHistory.companyId, companyId),
        isNull(alertHistory.resolvedAt)
      )
    );

  const resolvedIds = openHistory
    .filter((h) => !activeKeys.includes(`${h.alertType}:${h.alertKey}`))
    .map((h) => h.id);

  if (resolvedIds.length > 0) {
    await db
      .update(alertHistory)
      .set({ resolvedAt: new Date() })
      .where(inArray(alertHistory.id, resolvedIds));
  }

  return apiSuccess({
    alerts: filteredAlerts,
    count: filteredAlerts.length,
  });
}
