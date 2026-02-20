import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

function requireLogin(req: { auth: { user?: unknown } | null; nextUrl: URL; url: string }) {
  const pathname = req.nextUrl.pathname;
  const loginUrl = new URL('/login', req.url);
  loginUrl.searchParams.set('callbackUrl', pathname);
  return NextResponse.redirect(loginUrl);
}

export default auth((req) => {
  const isLoggedIn = !!req.auth?.user;
  const pathname = req.nextUrl.pathname;
  const isApiRoute = pathname.startsWith('/api/');

  // 세션 없음
  if (!isLoggedIn) {
    if (isApiRoute) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }
    return requireLogin(req);
  }

  // 대시보드: non-super 사용자가 companyId 없으면 로그인으로 (세션 무효)
  if (pathname.startsWith('/dashboard')) {
    const user = req.auth?.user as { role?: string; companyId?: string; mustChangePassword?: boolean } | undefined;
    const isSuper = user?.role === 'super';

    if (!isSuper) {
      const companyId = user?.companyId;
      if (!companyId || companyId === 'super') {
        return requireLogin(req);
      }
    }

    // 임시 비밀번호 사용 중이면 비밀번호 변경 페이지로 강제 이동
    if (user?.mustChangePassword && pathname !== '/dashboard/change-password') {
      return NextResponse.redirect(new URL('/dashboard/change-password', req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/api/companies/:path*',
    '/api/gateways/:path*',
    '/api/tags/:path*',
    '/api/dashboard/:path*',
    '/api/register/:path*',
    '/api/init-company',
    '/api/alerts/:path*',
    '/api/alert-settings/:path*',
    '/api/asset-maps/:path*',
  ],
};
