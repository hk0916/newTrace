import { NextResponse } from 'next/server';
import { Session } from 'next-auth';
import { auth } from '@/lib/auth';

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

export function requireAdmin(session: Session | null) {
  const authError = requireAuth(session);
  if (authError) return authError;
  if (session!.user.role !== 'admin') {
    return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 });
  }
  return null;
}

export function getCompanyScope(session: Session | null) {
  return session!.user.companyId;
}

export function apiError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export function apiSuccess(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}
