'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

const REFRESH_INTERVAL = 30;

export function DashboardRefresh() {
  const router = useRouter();
  const t = useTranslations('dashboard');
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (countdown === 0) {
      router.refresh();
      setCountdown(REFRESH_INTERVAL);
    }
  }, [countdown, router]);

  async function handleRefresh() {
    setRefreshing(true);
    router.refresh();
    setCountdown(REFRESH_INTERVAL);
    setTimeout(() => setRefreshing(false), 500);
  }

  return (
    <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
      <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
      {t('refresh', { countdown })}
    </Button>
  );
}
