import { NextRequest } from 'next/server';
import { eq, and, desc, gte, lte } from 'drizzle-orm';
import { db, getCompanyTables } from '@/lib/db';
import { getSession, requireAuth, resolveCompanyId, apiError, apiSuccess } from '@/lib/api-utils';

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

  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '50'), 200);
  const offset = parseInt(req.nextUrl.searchParams.get('offset') || '0');
  const from = req.nextUrl.searchParams.get('from');
  const to = req.nextUrl.searchParams.get('to');

  const conditions = [eq(tagSensingData.tagMac, tagMac)];
  if (from) conditions.push(gte(tagSensingData.sensingTime, new Date(from)));
  if (to) conditions.push(lte(tagSensingData.sensingTime, new Date(to)));

  const data = await db
    .select()
    .from(tagSensingData)
    .where(and(...conditions))
    .orderBy(desc(tagSensingData.receivedTime))
    .limit(limit)
    .offset(offset);

  return apiSuccess({ data, limit, offset });
}
