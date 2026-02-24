import { NextRequest } from 'next/server';
import { desc } from 'drizzle-orm';
import { db, getCompanyTables } from '@/lib/db';
import { getSession, requireAuth, resolveCompanyId, apiError, apiSuccess } from '@/lib/api-utils';

export async function GET(req: NextRequest) {
  const session = await getSession();
  const authError = requireAuth(session);
  if (authError) return authError;

  const companyId = resolveCompanyId(session, req);
  if (!companyId) return apiError('회사 정보가 없습니다', 400);

  const { alertHistory } = getCompanyTables(companyId);

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50', 10), 200);
  const offset = parseInt(url.searchParams.get('offset') ?? '0', 10);

  const history = await db
    .select()
    .from(alertHistory)
    .orderBy(desc(alertHistory.triggeredAt))
    .limit(limit)
    .offset(offset);

  return apiSuccess({ history });
}
