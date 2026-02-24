import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, getCompanyTables } from '@/lib/db';
import { getSession, requireAuth, resolveCompanyId, getCompanyScope, isSuper, isAdminOrAbove, apiError, apiSuccess } from '@/lib/api-utils';
import { updateGatewaySchema } from '@/lib/validators/gateway';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ gwMac: string }> }
) {
  const session = await getSession();
  const authError = requireAuth(session);
  if (authError) return authError;

  const { gwMac } = await params;
  const companyId = resolveCompanyId(session, req);
  if (!companyId) return apiError('회사 정보가 없습니다', 400);

  const { gateways, gatewayStatus, tags } = getCompanyTables(companyId);

  const [gateway] = await db
    .select({
      gwMac: gateways.gwMac,
      gwName: gateways.gwName,
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
    .where(eq(gateways.gwMac, gwMac))
    .limit(1);

  if (!gateway) return apiError('게이트웨이를 찾을 수 없습니다', 404);

  const assignedTags = await db
    .select()
    .from(tags)
    .where(eq(tags.assignedGwMac, gwMac));

  return apiSuccess({ ...gateway, tags: assignedTags });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ gwMac: string }> }
) {
  const session = await getSession();
  const authError = requireAuth(session);
  if (authError) return authError;
  if (!isAdminOrAbove(session)) return apiError('관리자 권한이 필요합니다', 403);

  const { gwMac } = await params;
  const companyId = resolveCompanyId(session, req);
  if (!companyId) return apiError('회사 정보가 없습니다', 400);

  const { gateways } = getCompanyTables(companyId);

  const [existing] = await db
    .select()
    .from(gateways)
    .where(eq(gateways.gwMac, gwMac))
    .limit(1);

  if (!existing) return apiError('게이트웨이를 찾을 수 없습니다', 404);

  const body = await req.json();
  const parsed = updateGatewaySchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0].message, 400);
  }

  await db
    .update(gateways)
    .set({
      gwName: parsed.data.gwName,
      location: parsed.data.location ?? existing.location,
      description: parsed.data.description ?? existing.description,
      isActive: parsed.data.isActive ?? existing.isActive,
    })
    .where(eq(gateways.gwMac, gwMac));

  return apiSuccess({ gwMac, ...parsed.data });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ gwMac: string }> }
) {
  const session = await getSession();
  const authError = requireAuth(session);
  if (authError) return authError;
  if (!isAdminOrAbove(session)) return apiError('관리자 권한이 필요합니다', 403);

  const { gwMac } = await params;
  const companyId = resolveCompanyId(session, req);
  if (!companyId) return apiError('회사 정보가 없습니다', 400);

  const { gateways, gatewayStatus, tags } = getCompanyTables(companyId);

  const [existing] = await db
    .select()
    .from(gateways)
    .where(eq(gateways.gwMac, gwMac))
    .limit(1);

  if (!existing) return apiError('게이트웨이를 찾을 수 없습니다', 404);

  // 1. 태그 할당 해제
  await db.update(tags).set({ assignedGwMac: null }).where(eq(tags.assignedGwMac, gwMac));
  // 2. 게이트웨이 상태 삭제
  await db.delete(gatewayStatus).where(eq(gatewayStatus.gwMac, gwMac));
  // 3. 게이트웨이 삭제
  await db.delete(gateways).where(eq(gateways.gwMac, gwMac));

  return apiSuccess({ deleted: gwMac });
}
