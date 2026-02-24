import { getSession, requireAuth, resolveCompanyId, isAdminOrAbove, apiError, apiSuccess } from '@/lib/api-utils';
import { db, getCompanyTables } from '@/lib/db';
import { eq } from 'drizzle-orm';

import { NextRequest } from 'next/server';

/** 대시보드에 표시할 맵 토글 (admin/super만) */
export async function POST(
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
  const { assetMaps } = getCompanyTables(companyId);

  const [map] = await db
    .select({ id: assetMaps.id, showOnDashboard: assetMaps.showOnDashboard })
    .from(assetMaps)
    .where(eq(assetMaps.id, mapId))
    .limit(1);

  if (!map) return apiError('맵을 찾을 수 없습니다', 404);

  const newValue = !map.showOnDashboard;

  await db
    .update(assetMaps)
    .set({ showOnDashboard: newValue, updatedAt: new Date() })
    .where(eq(assetMaps.id, mapId));

  return apiSuccess({ success: true, showOnDashboard: newValue });
}
