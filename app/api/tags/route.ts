import { NextRequest } from 'next/server';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { tags, tagSensingData, gateways } from '@/lib/db/schema';
import { createTagSchema } from '@/lib/validators/tag';
import {
  getSession,
  requireAuth,
  resolveCompanyId,
  getCompanyScope,
  isAdminOrAbove,
  isSuper,
  apiError,
  apiSuccess,
} from '@/lib/api-utils';

export async function GET(req: NextRequest) {
  const session = await getSession();
  const authError = requireAuth(session);
  if (authError) return authError;

  const companyId = resolveCompanyId(session, req);
  if (!companyId) return apiError('회사 정보가 없습니다', 400);

  const gwMacFilter = req.nextUrl.searchParams.get('gwMac');
  const search = req.nextUrl.searchParams.get('search')?.toLowerCase().trim() || '';
  const sortOrder = req.nextUrl.searchParams.get('order') === 'asc' ? 'asc' : 'desc';

  const conditions = [eq(tags.companyId, companyId)];
  if (gwMacFilter) {
    conditions.push(eq(tags.assignedGwMac, gwMacFilter));
  }

  const tagList = await db
    .select()
    .from(tags)
    .where(and(...conditions));

  let result = await Promise.all(
    tagList.map(async (tag) => {
      const [latestSensing] = await db
        .select()
        .from(tagSensingData)
        .where(eq(tagSensingData.tagMac, tag.tagMac))
        .orderBy(desc(tagSensingData.receivedTime))
        .limit(1);

      return {
        ...tag,
        latestSensing: latestSensing || null,
      };
    })
  );

  if (search) {
    const s = search.replace(/[:\-]/g, '').toLowerCase();
    result = result.filter(
      (t) =>
        t.tagMac.toLowerCase().includes(s) ||
        t.tagName.toLowerCase().includes(search) ||
        (t.assetType?.toLowerCase().includes(search) ?? false)
    );
  }

  result.sort((a, b) => {
    const aTime = a.latestSensing?.receivedTime ? new Date(a.latestSensing.receivedTime).getTime() : 0;
    const bTime = b.latestSensing?.receivedTime ? new Date(b.latestSensing.receivedTime).getTime() : 0;
    return sortOrder === 'desc' ? bTime - aTime : aTime - bTime;
  });

  return apiSuccess(result);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  const authError = requireAuth(session);
  if (authError) return authError;

  const body = await req.json();
  const parsed = createTagSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0].message, 400);
  }

  const { tagMac, tagName, companyId, assignedGwMac, reportInterval, assetType, description } = parsed.data;

  if (!isAdminOrAbove(session)) {
    return apiError('관리자 권한이 필요합니다', 403);
  }
  if (!isSuper(session) && companyId !== getCompanyScope(session)) {
    return apiError('다른 회사의 태그를 등록할 수 없습니다', 403);
  }

  const existing = await db.select().from(tags).where(eq(tags.tagMac, tagMac)).limit(1);
  if (existing.length > 0) {
    return apiError('이미 등록된 MAC 주소입니다', 409);
  }

  if (assignedGwMac) {
    const [gw] = await db.select().from(gateways).where(
      and(eq(gateways.gwMac, assignedGwMac), eq(gateways.companyId, companyId))
    ).limit(1);
    if (!gw) return apiError('해당 게이트웨이를 찾을 수 없습니다', 404);
  }

  const newTag = { tagMac, tagName, companyId, assignedGwMac, reportInterval, assetType, description };
  await db.insert(tags).values(newTag);
  return apiSuccess(newTag, 201);
}
