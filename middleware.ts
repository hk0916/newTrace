export { auth as middleware } from '@/lib/auth';

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/api/companies/:path*',
    '/api/gateways/:path*',
    '/api/tags/:path*',
    '/api/dashboard/:path*',
    '/api/register/:path*',
    '/api/init-company',
  ],
};
