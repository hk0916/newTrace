'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useTranslations, useLocale } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { History } from 'lucide-react';
import { useCompanyId } from '../../hooks/use-company-id';
import { setCompanyIdCookie } from '@/lib/company-cookie';

interface AlertHistoryRow {
  id: string;
  companyId: string;
  alertType: string;
  alertKey: string;
  alertName: string;
  alertMessage: string;
  triggeredAt: string;
  resolvedAt: string | null;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
}

function formatDuration(start: string, end: string | null): string {
  const from = new Date(start).getTime();
  const to = end ? new Date(end).getTime() : Date.now();
  const diffMs = to - from;
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export default function AlertHistoryPage() {
  const { data: session } = useSession();
  const companyIdFromCookie = useCompanyId();
  const t = useTranslations('alerts');
  const tCommon = useTranslations('common'); // for loading, selectCompany
  const locale = useLocale();

  const isSuper = session?.user?.role === 'super';
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [companyId, setCompanyId] = useState('');
  const [history, setHistory] = useState<AlertHistoryRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchCompanies() {
      const res = await fetch('/api/companies');
      if (res.ok) {
        const data = await res.json();
        setCompanies(data);
        if (!isSuper && session?.user?.companyId) {
          setCompanyId(session.user.companyId);
        } else if (isSuper) {
          setCompanyId(companyIdFromCookie || (data[0]?.id ?? ''));
        }
      }
    }
    fetchCompanies();
  }, [session?.user?.companyId, isSuper, companyIdFromCookie]);

  const fetchHistory = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    const res = await fetch(`/api/alerts/history?companyId=${companyId}&limit=100`);
    if (res.ok) {
      const data = await res.json();
      setHistory(data.history ?? []);
    }
    setLoading(false);
  }, [companyId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  function getStatus(row: AlertHistoryRow): 'active' | 'acknowledged' | 'resolved' {
    if (!row.resolvedAt) {
      return row.acknowledgedAt ? 'acknowledged' : 'active';
    }
    return 'resolved';
  }

  function getStatusBadge(status: ReturnType<typeof getStatus>) {
    if (status === 'active') return <Badge variant="destructive">{t('statusActive')}</Badge>;
    if (status === 'acknowledged') return <Badge variant="default">{t('statusAcknowledged')}</Badge>;
    return <Badge variant="secondary">{t('statusResolved')}</Badge>;
  }

  function getTypeBadge(alertType: string) {
    if (alertType === 'tag_stale') return <Badge variant="outline">{t('typeTagStale')}</Badge>;
    return <Badge variant="outline">{t('typeGwDisconnected')}</Badge>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/alerts">{t('backToAlerts')}</Link>
        </Button>
        <h1 className="text-2xl font-bold">{t('historyTitle')}</h1>
      </div>

      {isSuper && (
        <Select
          value={companyId}
          onValueChange={(v) => {
            setCompanyIdCookie(v);
            setCompanyId(v);
          }}
        >
          <SelectTrigger className="max-w-xs">
            <SelectValue placeholder={tCommon('selectCompany')} />
          </SelectTrigger>
          <SelectContent>
            {companies.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            {t('historyTitle')}
          </CardTitle>
          <CardDescription>{t('historyDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">{tCommon('loading')}</p>
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('historyEmpty')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 pr-4 font-medium">{t('colType')}</th>
                    <th className="text-left py-2 pr-4 font-medium">{t('colName')}</th>
                    <th className="text-left py-2 pr-4 font-medium hidden md:table-cell">{t('colMessage')}</th>
                    <th className="text-left py-2 pr-4 font-medium">{t('triggeredAt')}</th>
                    <th className="text-left py-2 pr-4 font-medium hidden lg:table-cell">{t('resolvedAt')}</th>
                    <th className="text-left py-2 pr-4 font-medium hidden lg:table-cell">{t('duration')}</th>
                    <th className="text-left py-2 font-medium">{t('colStatus')}</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((row) => {
                    const status = getStatus(row);
                    return (
                      <tr key={row.id} className="border-b last:border-0 hover:bg-muted/40">
                        <td className="py-2 pr-4">{getTypeBadge(row.alertType)}</td>
                        <td className="py-2 pr-4">
                          <p className="font-medium">{row.alertName}</p>
                          <p className="text-xs text-muted-foreground">{row.alertKey}</p>
                        </td>
                        <td className="py-2 pr-4 hidden md:table-cell max-w-xs">
                          <p className="truncate text-muted-foreground">{row.alertMessage}</p>
                        </td>
                        <td className="py-2 pr-4 whitespace-nowrap">
                          {new Date(row.triggeredAt).toLocaleString(locale)}
                        </td>
                        <td className="py-2 pr-4 whitespace-nowrap hidden lg:table-cell">
                          {row.resolvedAt
                            ? new Date(row.resolvedAt).toLocaleString(locale)
                            : <span className="text-muted-foreground">-</span>}
                        </td>
                        <td className="py-2 pr-4 hidden lg:table-cell">
                          {formatDuration(row.triggeredAt, row.resolvedAt)}
                        </td>
                        <td className="py-2">{getStatusBadge(status)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
