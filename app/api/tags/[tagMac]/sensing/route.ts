import { NextRequest } from 'next/server';
import { eq, and, desc, gte, lte } from 'drizzle-orm';
import { db } from '@/lib/db';
import { tags, tagSensingData } from '@/lib/db/schema';
import { getSession, requireAuth, getCompanyScope, isSuper, apiError, apiSuccess } from '@/lib/api-utils';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tagMac: string }> }
) {
  const session = await getSession();
  const authError = requireAuth(session);
  if (authError) return authError;

  const { tagMac } = await params;
  const companyId = getCompanyScope(session);

  const [tag] = await db
    .select()
    .from(tags)
    .where(
      isSuper(session)
        ? eq(tags.tagMac, tagMac)
        : and(eq(tags.tagMac, tagMac), eq(tags.companyId, companyId!))
    )
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
