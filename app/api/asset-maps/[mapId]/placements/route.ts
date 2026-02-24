import { NextRequest } from 'next/server';
import { getSession, requireAuth, resolveCompanyId, isAdminOrAbove, apiError, apiSuccess } from '@/lib/api-utils';
import { db, getCompanyTables } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { saveMapPlacementsSchema } from '@/lib/validators/asset-map';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ mapId: string }> }
) {
  const session = await getSession();
  const authError = requireAuth(session);
  if (authError) return authError;
  if (!isAdminOrAbove(session)) return apiError('관리자 권한이 필요합니다', 403);

  const companyId = resolveCompanyId(session, req);
  if (!companyId) return apiError('회사를 선택해주세요', 400);

  const { mapId } = await params;
  const { assetMaps, assetMapGateways } = getCompanyTables(companyId);

  // Verify map belongs to company
  const [map] = await db
    .select()
    .from(assetMaps)
    .where(eq(assetMaps.id, mapId))
    .limit(1);

  if (!map) return apiError('맵을 찾을 수 없습니다', 404);

  const body = await req.json();
  const parsed = saveMapPlacementsSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message || '잘못된 요청입니다', 400);
  }

  const { placements, gatewayAreaColor } = parsed.data;

  // Transaction: delete existing → insert new, update map
  await db.transaction(async (tx) => {
    await tx.delete(assetMapGateways).where(eq(assetMapGateways.mapId, mapId));

    if (placements.length > 0) {
      await tx.insert(assetMapGateways).values(
        placements.map((p) => ({
          id: uuidv4(),
          mapId,
          gwMac: p.gwMac,
          xPercent: String(p.xPercent),
          yPercent: String(p.yPercent),
          widthPercent: String(p.widthPercent),
          heightPercent: String(p.heightPercent),
          color: p.color ?? 'amber',
        }))
      );
    }

    const updateData: { updatedAt: Date; gatewayAreaColor?: string } = { updatedAt: new Date() };
    if (gatewayAreaColor) updateData.gatewayAreaColor = gatewayAreaColor;
    await tx.update(assetMaps).set(updateData).where(eq(assetMaps.id, mapId));
  });

  return apiSuccess({ success: true, count: placements.length });
}
