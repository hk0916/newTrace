import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { companies } from '@/lib/db/schema';
import {
  getSession,
  requireAuth,
  requireAdmin,
  resolveCompanyId,
  isSuper,
  getCompanyScope,
  apiError,
  apiSuccess,
} from '@/lib/api-utils';

// IANA timezone 유효성 검사
function isValidTimezone(tz: string): boolean {
  if (tz === 'browser') return true;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  const authError = requireAuth(session);
  if (authError) return authError;

  const companyId = resolveCompanyId(session, req);
  if (!companyId) return apiError('회사 정보가 없습니다', 400);

  const [company] = await db
    .select({ timezone: companies.timezone })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);

  if (!company) return apiError('회사를 찾을 수 없습니다', 404);

  return apiSuccess({ timezone: company.timezone ?? 'browser' });
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  const authError = requireAuth(session);
  if (authError) return authError;

  const adminError = requireAdmin(session);
  if (adminError) return adminError;

  let body: { companyId?: string; timezone?: string };
  try {
    body = await req.json();
  } catch {
    return apiError('요청 본문이 올바르지 않습니다', 400);
  }

  if (!body.companyId) return apiError('companyId가 필요합니다', 400);
  if (!body.timezone) return apiError('timezone이 필요합니다', 400);
  if (!isValidTimezone(body.timezone)) return apiError('유효하지 않은 timezone입니다', 400);

  const companyId = body.companyId;
  if (!isSuper(session) && companyId !== getCompanyScope(session)) {
    return apiError('다른 회사의 설정을 변경할 수 없습니다', 403);
  }

  await db
    .update(companies)
    .set({ timezone: body.timezone, updatedAt: new Date() })
    .where(eq(companies.id, companyId));

  return apiSuccess({ timezone: body.timezone });
}
