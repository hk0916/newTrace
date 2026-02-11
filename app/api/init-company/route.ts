import { NextResponse } from 'next/server';
import { ne, and, asc } from 'drizzle-orm';
import { getSession, requireAuth, isSuper } from '@/lib/api-utils';
import { db } from '@/lib/db';
import { companies, gateways } from '@/lib/db/schema';
import { COMPANY_COOKIE_NAME } from '@/lib/company-cookie';

/** super가 companyId 없을 때 기본 회사 쿠키 설정 후 리다이렉트 */
export async function GET(req: Request) {
  const session = await getSession();
  const authError = requireAuth(session);
  if (authError) return authError;
  if (!isSuper(session)) {
    const url = new URL(req.url);
    return NextResponse.redirect(new URL('/dashboard', url.origin));
  }

  const [withGw] = await db
    .selectDistinct({ id: gateways.companyId })
    .from(gateways)
    .where(ne(gateways.companyId, 'unregistered'))
    .limit(1);
  const fallback = await db
    .select({ id: companies.id })
    .from(companies)
    .where(and(ne(companies.id, 'super'), ne(companies.id, 'unregistered')))
    .orderBy(asc(companies.id))
    .limit(1);
  const first = withGw ?? fallback[0];

  const url = new URL('/dashboard', new URL(req.url).origin);
  const res = NextResponse.redirect(url);
  if (first) {
    res.cookies.set(COMPANY_COOKIE_NAME, first.id, { path: '/', maxAge: 86400, httpOnly: false, sameSite: 'lax' });
  }
  return res;
}
