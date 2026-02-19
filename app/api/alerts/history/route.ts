import { NextRequest } from 'next/server';
import { eq, desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { alertHistory } from '@/lib/db/schema';
import { getSession, requireAuth, resolveCompanyId, apiError, apiSuccess } from '@/lib/api-utils';

export async function GET(req: NextRequest) {
  const session = await getSession();
  const authError = requireAuth(session);
  if (authError) return authError;

  const companyId = resolveCompanyId(session, req);
  if (!companyId) return apiError('회사 정보가 없습니다', 400);

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50', 10), 200);
  const offset = parseInt(url.searchParams.get('offset') ?? '0', 10);

  const history = await db
    .select()
    .from(alertHistory)
    .where(eq(alertHistory.companyId, companyId))
    .orderBy(desc(alertHistory.triggeredAt))
    .limit(limit)
    .offset(offset);

  return apiSuccess({ history });
}
