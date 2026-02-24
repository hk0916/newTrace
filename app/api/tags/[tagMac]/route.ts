import { NextRequest } from 'next/server';
import { eq, desc } from 'drizzle-orm';
import { db, getCompanyTables } from '@/lib/db';
import { getSession, requireAuth, resolveCompanyId, isAdminOrAbove, apiError, apiSuccess } from '@/lib/api-utils';
import { updateTagSchema } from '@/lib/validators/tag';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tagMac: string }> }
) {
  const session = await getSession();
  const authError = requireAuth(session);
  if (authError) return authError;

  const { tagMac } = await params;
  const companyId = resolveCompanyId(session, req);
  if (!companyId) return apiError('회사 정보가 없습니다', 400);

  const { tags, tagSensingData } = getCompanyTables(companyId);

  const [tag] = await db
    .select()
    .from(tags)
    .where(eq(tags.tagMac, tagMac))
    .limit(1);

  if (!tag) return apiError('태그를 찾을 수 없습니다', 404);

  const recentSensing = await db
    .select()
    .from(tagSensingData)
    .where(eq(tagSensingData.tagMac, tagMac))
    .orderBy(desc(tagSensingData.receivedTime))
    .limit(10);

  return apiSuccess({ ...tag, recentSensing });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ tagMac: string }> }
) {
  const session = await getSession();
  const authError = requireAuth(session);
  if (authError) return authError;
  if (!isAdminOrAbove(session)) return apiError('관리자 권한이 필요합니다', 403);

  const { tagMac } = await params;
  const companyId = resolveCompanyId(session, req);
  if (!companyId) return apiError('회사 정보가 없습니다', 400);

  const { tags, gateways } = getCompanyTables(companyId);

  const [existing] = await db
    .select()
    .from(tags)
    .where(eq(tags.tagMac, tagMac))
    .limit(1);

  if (!existing) return apiError('태그를 찾을 수 없습니다', 404);

  const body = await req.json();
  const parsed = updateTagSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0].message, 400);
  }

  const assignedGw =
    parsed.data.assignedGwMac != null && String(parsed.data.assignedGwMac).trim()
      ? String(parsed.data.assignedGwMac).trim()
      : null;
  if (assignedGw) {
    const [gw] = await db
      .select()
      .from(gateways)
      .where(eq(gateways.gwMac, assignedGw))
      .limit(1);
    if (!gw) return apiError('해당 게이트웨이를 찾을 수 없습니다', 404);
  }

  await db
    .update(tags)
    .set({
      tagName: parsed.data.tagName,
      assignedGwMac: parsed.data.assignedGwMac !== undefined ? assignedGw : existing.assignedGwMac,
      reportInterval: parsed.data.reportInterval,
      assetType: parsed.data.assetType ?? existing.assetType,
      description: parsed.data.description ?? existing.description,
      isActive: parsed.data.isActive ?? existing.isActive,
      updatedAt: new Date(),
    })
    .where(eq(tags.tagMac, tagMac));

  return apiSuccess({ tagMac, ...parsed.data });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ tagMac: string }> }
) {
  const session = await getSession();
  const authError = requireAuth(session);
  if (authError) return authError;
  if (!isAdminOrAbove(session)) return apiError('관리자 권한이 필요합니다', 403);

  const { tagMac } = await params;
  const companyId = resolveCompanyId(session, req);
  if (!companyId) return apiError('회사 정보가 없습니다', 400);

  const { tags, tagSensingData } = getCompanyTables(companyId);

  const [existing] = await db
    .select()
    .from(tags)
    .where(eq(tags.tagMac, tagMac))
    .limit(1);

  if (!existing) return apiError('태그를 찾을 수 없습니다', 404);

  // 1. 센싱 데이터 삭제
  await db.delete(tagSensingData).where(eq(tagSensingData.tagMac, tagMac));
  // 2. 태그 삭제
  await db.delete(tags).where(eq(tags.tagMac, tagMac));

  return apiSuccess({ deleted: tagMac });
}
