import { eq, sql } from 'drizzle-orm';
import { db, getCompanyTables } from '@/lib/db';
import { getSession, requireAuth, getCompanyScope, apiError, apiSuccess } from '@/lib/api-utils';

export async function GET() {
  const session = await getSession();
  const authError = requireAuth(session);
  if (authError) return authError;

  const companyId = getCompanyScope(session);
  if (!companyId) return apiError('회사 정보가 없습니다', 400);

  const { gateways, gatewayStatus, tags, tagSensingData } = getCompanyTables(companyId);

  const [gwStats] = await db
    .select({
      total: sql<number>`count(*)`,
      active: sql<number>`count(*) filter (where ${gateways.isActive} = true)`,
    })
    .from(gateways);

  const [connectedStats] = await db
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

  const [alertStats] = await db
    .select({
      lowVoltage: sql<number>`count(*) filter (where ${tagSensingData.voltage}::numeric < 2.0)`,
    })
    .from(tagSensingData)
    .innerJoin(tags, eq(tagSensingData.tagMac, tags.tagMac))
    .where(sql`${tagSensingData.receivedTime} > now() - interval '1 hour'`);

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
