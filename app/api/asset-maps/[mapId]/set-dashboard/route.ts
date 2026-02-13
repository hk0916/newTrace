import { getSession, requireAuth, resolveCompanyId, isAdminOrAbove, apiError, apiSuccess } from '@/lib/api-utils';
import { db } from '@/lib/db';
import { assetMaps, companies } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

import { NextRequest } from 'next/server';

/** 대시보드에 표시할 맵 설정 (admin/super만) */
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

  const [map] = await db
    .select()
    .from(assetMaps)
    .where(and(eq(assetMaps.id, mapId), eq(assetMaps.companyId, companyId)))
    .limit(1);

  if (!map) return apiError('맵을 찾을 수 없습니다', 404);

  await db
    .update(companies)
    .set({ dashboardMapId: mapId, updatedAt: new Date() })
    .where(eq(companies.id, companyId));

  return apiSuccess({ success: true, dashboardMapId: mapId });
}
