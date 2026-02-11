import { NextRequest, NextResponse } from 'next/server';
import { Session } from 'next-auth';
import { auth } from '@/lib/auth';
import { COMPANY_COOKIE_NAME } from './company-cookie';

export type UserRole = 'super' | 'admin' | 'user';

export async function getSession(): Promise<Session | null> {
  const session = await auth();
  return session;
}

export function requireAuth(session: Session | null) {
  if (!session?.user) {
    return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
  }
  return null;
}

/** super: 모든 회사/자산 관리, admin: 해당 회사 관리자, user: 해당 회사 뷰어 */
export function isSuper(session: Session | null): boolean {
  return session?.user?.role === 'super';
}

export function isAdminOrAbove(session: Session | null): boolean {
  return session?.user?.role === 'super' || session?.user?.role === 'admin';
}

/** 회사 선택 가능: super만 (admin/user는 로그인 시 companyId 사용) */
export function canSelectCompany(session: Session | null): boolean {
  return isSuper(session);
}

export function requireAdmin(session: Session | null) {
  const authError = requireAuth(session);
  if (authError) return authError;
  if (!isAdminOrAbove(session)) {
    return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 });
  }
  return null;
}

export function requireSuper(session: Session | null) {
  const authError = requireAuth(session);
  if (authError) return authError;
  if (!isSuper(session)) {
    return NextResponse.json({ error: '슈퍼 관리자 권한이 필요합니다' }, { status: 403 });
  }
  return null;
}

export function getCompanyScope(session: Session | null) {
  return session?.user?.companyId ?? null;
}

/** API에서 companyId 결정: super=쿠키 우선(URL 노출 방지), admin/user=session.companyId */
export function resolveCompanyId(
  session: Session | null,
  req: NextRequest
): string | null {
  if (isSuper(session)) {
    return (
      req.nextUrl.searchParams.get('companyId') ||
      req.cookies.get(COMPANY_COOKIE_NAME)?.value ||
      getCompanyScope(session)
    );
  }
  return getCompanyScope(session);
}

export function apiError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export function apiSuccess(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}
