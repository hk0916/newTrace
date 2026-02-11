import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { gateways, gatewayStatus, tags } from '@/lib/db/schema';
import { getSession, requireAuth, getCompanyScope, apiError, apiSuccess } from '@/lib/api-utils';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ gwMac: string }> }
) {
  const session = await getSession();
  const authError = requireAuth(session);
  if (authError) return authError;

  const { gwMac } = await params;
  const companyId = getCompanyScope(session);

  const [gateway] = await db
    .select({
      gwMac: gateways.gwMac,
      gwName: gateways.gwName,
      companyId: gateways.companyId,
      location: gateways.location,
      description: gateways.description,
      isActive: gateways.isActive,
      registeredAt: gateways.registeredAt,
      hwVersion: gatewayStatus.hwVersion,
      fwVersion: gatewayStatus.fwVersion,
      otaServerUrl: gatewayStatus.otaServerUrl,
      wsServerUrl: gatewayStatus.wsServerUrl,
      reportInterval: gatewayStatus.reportInterval,
      rssiFilter: gatewayStatus.rssiFilter,
      ipAddress: gatewayStatus.ipAddress,
      port: gatewayStatus.port,
      isConnected: gatewayStatus.isConnected,
      lastConnectedAt: gatewayStatus.lastConnectedAt,
      lastUpdatedAt: gatewayStatus.lastUpdatedAt,
    })
    .from(gateways)
    .leftJoin(gatewayStatus, eq(gateways.gwMac, gatewayStatus.gwMac))
    .where(
      session!.user.role === 'admin'
        ? eq(gateways.gwMac, gwMac)
        : and(eq(gateways.gwMac, gwMac), eq(gateways.companyId, companyId!))
    )
    .limit(1);

  if (!gateway) return apiError('게이트웨이를 찾을 수 없습니다', 404);

  const assignedTags = await db
    .select()
    .from(tags)
    .where(eq(tags.assignedGwMac, gwMac));

  return apiSuccess({ ...gateway, tags: assignedTags });
}
