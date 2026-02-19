import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { COMPANY_COOKIE_NAME } from '@/lib/company-cookie';
import { DashboardShell } from './components/dashboard-shell';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  const t = await getTranslations('common');
  const cookieStore = await cookies();
  const companyId = session.user.role === 'super'
    ? cookieStore.get(COMPANY_COOKIE_NAME)?.value ?? session.user.companyId
    : session.user.companyId;

  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">{t('loading')}</div>}>
      <DashboardShell user={session.user} companyId={companyId ?? undefined}>
        {children}
      </DashboardShell>
    </Suspense>
  );
}
