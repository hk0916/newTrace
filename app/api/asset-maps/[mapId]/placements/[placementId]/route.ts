import { NextRequest } from 'next/server';
import { getSession, requireAuth, resolveCompanyId, isAdminOrAbove, apiError, apiSuccess } from '@/lib/api-utils';
import { db, getCompanyTables } from '@/lib/db';
import { eq, and } from 'drizzle-orm';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ mapId: string; placementId: string }> }
) {
  const { mapId, placementId } = await params;
  const session = await getSession();
  const authError = requireAuth(session);
  if (authError) return authError;
  if (!isAdminOrAbove(session)) return apiError('관리자 권한이 필요합니다', 403);

  const companyId = resolveCompanyId(session, req);
  if (!companyId) return apiError('회사를 선택해주세요', 400);

  const { assetMaps, assetMapGateways } = getCompanyTables(companyId);

  // Verify map belongs to company
  const [map] = await db
    .select()
    .from(assetMaps)
    .where(eq(assetMaps.id, mapId))
    .limit(1);

  if (!map) return apiError('맵을 찾을 수 없습니다', 404);

  const [deleted] = await db
    .delete(assetMapGateways)
    .where(and(eq(assetMapGateways.id, placementId), eq(assetMapGateways.mapId, mapId)))
    .returning();

  if (!deleted) return apiError('배치 정보를 찾을 수 없습니다', 404);

  return apiSuccess({ success: true });
}
