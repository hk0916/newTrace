'use client';

import { useSession } from 'next-auth/react';
import { getCompanyIdFromClient } from '@/lib/company-cookie';

/** super: 쿠키, admin/user: session.companyId */
export function useCompanyId(): string | null {
  const { data: session } = useSession();
  if (!session?.user) return null;
  if (session.user.role === 'super') {
    return getCompanyIdFromClient() || session.user.companyId || null;
  }
  return session.user.companyId ?? null;
}
