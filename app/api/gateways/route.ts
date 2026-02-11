import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { gateways, gatewayStatus } from '@/lib/db/schema';
import { createGatewaySchema } from '@/lib/validators/gateway';
import { getSession, requireAuth, getCompanyScope, apiError, apiSuccess } from '@/lib/api-utils';

export async function GET(req: NextRequest) {
  const session = await getSession();
  const authError = requireAuth(session);
  if (authError) return authError;

  const companyId = session!.user.role === 'admin'
    ? req.nextUrl.searchParams.get('companyId') || getCompanyScope(session)
    : getCompanyScope(session);

  if (!companyId) return apiError('회사 정보가 없습니다', 400);

  const search = req.nextUrl.searchParams.get('search')?.toLowerCase().trim() || '';
  const sortOrder = req.nextUrl.searchParams.get('order') === 'asc' ? 'asc' : 'desc';

  let result = await db
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
      isConnected: gatewayStatus.isConnected,
      ipAddress: gatewayStatus.ipAddress,
      port: gatewayStatus.port,
      reportInterval: gatewayStatus.reportInterval,
      rssiFilter: gatewayStatus.rssiFilter,
      lastConnectedAt: gatewayStatus.lastConnectedAt,
    })
    .from(gateways)
    .leftJoin(gatewayStatus, eq(gateways.gwMac, gatewayStatus.gwMac))
    .where(eq(gateways.companyId, companyId));

  if (search) {
    const s = search.replace(/:/g, '');
    result = result.filter(
      (gw) =>
        gw.gwMac.replace(/:/g, '').toLowerCase().includes(s) ||
        gw.gwName.toLowerCase().includes(search) ||
        (gw.location?.toLowerCase().includes(search) ?? false)
    );
  }

  result.sort((a, b) => {
    const aTime = a.lastConnectedAt ? new Date(a.lastConnectedAt).getTime() : 0;
    const bTime = b.lastConnectedAt ? new Date(b.lastConnectedAt).getTime() : 0;
    return sortOrder === 'desc' ? bTime - aTime : aTime - bTime;
  });

  return apiSuccess(result);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  const authError = requireAuth(session);
  if (authError) return authError;

  const body = await req.json();
  const parsed = createGatewaySchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0].message, 400);
  }

  const { gwMac, gwName, companyId, location, description } = parsed.data;

  if (session!.user.role !== 'admin' && companyId !== getCompanyScope(session)) {
    return apiError('다른 회사의 게이트웨이를 등록할 수 없습니다', 403);
  }

  const existing = await db.select().from(gateways).where(eq(gateways.gwMac, gwMac)).limit(1);
  if (existing.length > 0) {
    return apiError('이미 등록된 MAC 주소입니다', 409);
  }

  const newGateway = { gwMac, gwName, companyId, location, description };
  await db.insert(gateways).values(newGateway);
  return apiSuccess(newGateway, 201);
}
