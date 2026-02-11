import { eq, and, sql, lt } from 'drizzle-orm';
import { db } from '@/lib/db';
import { gateways, gatewayStatus, tags, tagSensingData } from '@/lib/db/schema';
import { getSession, requireAuth, getCompanyScope, apiError, apiSuccess } from '@/lib/api-utils';

export async function GET() {
  const session = await getSession();
  const authError = requireAuth(session);
  if (authError) return authError;

  const companyId = getCompanyScope(session);
  if (!companyId) return apiError('회사 정보가 없습니다', 400);

  const [gwStats] = await db
    .select({
      total: sql<number>`count(*)`,
      active: sql<number>`count(*) filter (where ${gateways.isActive} = true)`,
    })
    .from(gateways)
    .where(eq(gateways.companyId, companyId));

  const [connectedStats] = await db
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

  const [alertStats] = await db
    .select({
      lowVoltage: sql<number>`count(*) filter (where ${tagSensingData.voltage}::numeric < 2.0)`,
    })
    .from(tagSensingData)
    .innerJoin(tags, eq(tagSensingData.tagMac, tags.tagMac))
    .where(
      and(
        eq(tags.companyId, companyId),
        sql`${tagSensingData.receivedTime} > now() - interval '1 hour'`
      )
    );

  return apiSuccess({
    gateways: {
      total: gwStats.total,
      active: gwStats.active,
      connected: connectedStats.connected,
    },
    tags: {
      total: tagStats.total,
      active: tagStats.active,
    },
    alerts: {
      lowVoltage: alertStats.lowVoltage,
    },
  });
}
