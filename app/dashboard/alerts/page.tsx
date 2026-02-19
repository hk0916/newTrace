'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations, useLocale } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import Link from 'next/link';
import { AlertTriangle, Save, Bell, CheckCircle, History } from 'lucide-react';
import { useCompanyId } from '../hooks/use-company-id';
import { setCompanyIdCookie } from '@/lib/company-cookie';

interface AlertItem {
  type: 'tag_stale' | 'gw_disconnected';
  key: string;
  title: string;
  message: string;
  since: string;
}

interface AlertSettings {
  companyId: string;
  lowVoltageThreshold: string;
  highTempThreshold: string;
  lowTempThreshold: string;
  enableLowVoltageAlert: boolean;
  enableHighTempAlert: boolean;
  enableLowTempAlert: boolean;
  tagLastUpdateHours: number;
  gwDisconnectHours: number;
  enableTagHeartbeatAlert: boolean;
  enableGwDisconnectAlert: boolean;
}

export default function AlertsPage() {
  const { data: session } = useSession();
  const companyIdFromCookie = useCompanyId();
  const t = useTranslations('alerts');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState<AlertSettings>({
    companyId: '',
    lowVoltageThreshold: '2.5',
    highTempThreshold: '40',
    lowTempThreshold: '0',
    enableLowVoltageAlert: true,
    enableHighTempAlert: true,
    enableLowTempAlert: true,
    tagLastUpdateHours: 24,
    gwDisconnectHours: 24,
    enableTagHeartbeatAlert: true,
    enableGwDisconnectAlert: true,
  });
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [ackLoading, setAckLoading] = useState(false);

  const isSuper = session?.user?.role === 'super';

  useEffect(() => {
    async function fetchCompanies() {
      const res = await fetch('/api/companies');
      if (res.ok) {
        const data = await res.json();
        setCompanies(data);
        if (!isSuper && session?.user?.companyId) {
          setForm((f) => ({ ...f, companyId: session.user.companyId! }));
        } else if (isSuper && data.length > 0) {
          setForm((f) => ({
            ...f,
            companyId: companyIdFromCookie || f.companyId || data[0].id,
          }));
        }
      }
    }
    fetchCompanies();
  }, [session?.user?.role, session?.user?.companyId, isSuper, companyIdFromCookie]);

  useEffect(() => {
    if (!form.companyId) return;
    async function fetchSettings() {
      const res = await fetch(`/api/alert-settings?companyId=${form.companyId}`);
      if (res.ok) {
        const data = await res.json();
        setForm((f) => ({
          ...f,
          lowVoltageThreshold: data.lowVoltageThreshold?.toString() ?? '2.5',
          highTempThreshold: data.highTempThreshold?.toString() ?? '40',
          lowTempThreshold: data.lowTempThreshold?.toString() ?? '0',
          enableLowVoltageAlert: data.enableLowVoltageAlert ?? true,
          enableHighTempAlert: data.enableHighTempAlert ?? true,
          enableLowTempAlert: data.enableLowTempAlert ?? true,
          tagLastUpdateHours: data.tagLastUpdateHours ?? 24,
          gwDisconnectHours: data.gwDisconnectHours ?? 24,
          enableTagHeartbeatAlert: data.enableTagHeartbeatAlert ?? true,
          enableGwDisconnectAlert: data.enableGwDisconnectAlert ?? true,
        }));
      }
    }
    fetchSettings();
  }, [form.companyId]);

  useEffect(() => {
    if (!form.companyId) return;
    async function fetchAlerts() {
      setAlertsLoading(true);
      const res = await fetch(`/api/alerts?companyId=${form.companyId}`);
      if (res.ok) {
        const data = await res.json();
        setAlerts(data.alerts ?? []);
      }
      setAlertsLoading(false);
    }
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 30_000);
    return () => clearInterval(interval);
  }, [form.companyId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setSaved(false);

    const res = await fetch('/api/alert-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        lowVoltageThreshold: parseFloat(form.lowVoltageThreshold),
        highTempThreshold: parseFloat(form.highTempThreshold),
        lowTempThreshold: parseFloat(form.lowTempThreshold),
      }),
    });

    setLoading(false);

    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  async function handleAcknowledge(keys: { type: string; key: string }[]) {
    if (!form.companyId || keys.length === 0) return;
    setAckLoading(true);
    const res = await fetch('/api/alerts/acknowledge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId: form.companyId, keys }),
    });
    setAckLoading(false);
    if (res.ok) {
      setAlerts((prev) => prev.filter((a) => !keys.some((k) => k.type === a.type && k.key === a.key)));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground mt-1">
            {t('description')}
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard/alerts/history">
            <History className="h-4 w-4 mr-2" />
            {t('history')}
          </Link>
        </Button>
      </div>

      {form.companyId && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              {t('currentAlerts')}
            </CardTitle>
            <CardDescription>
              {t('currentAlertsDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {alertsLoading ? (
              <p className="text-sm text-muted-foreground">{tCommon('loading')}</p>
            ) : alerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('noAlerts')}</p>
            ) : (
              <div className="space-y-3">
                {alerts.map((a) => (
                  <div
                    key={`${a.type}:${a.key}`}
                    className="flex items-center justify-between gap-4 rounded-lg border p-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{a.title}</p>
                      <p className="text-sm text-muted-foreground truncate">{a.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(a.since).toLocaleString(locale)} {t('since')}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={ackLoading}
                      onClick={() => handleAcknowledge([{ type: a.type, key: a.key }])}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      {t('acknowledge')}
                    </Button>
                  </div>
                ))}
                <Button
                  variant="secondary"
                  disabled={ackLoading || alerts.length === 0}
                  onClick={() =>
                    handleAcknowledge(alerts.map((a) => ({ type: a.type, key: a.key })))
                  }
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {t('acknowledgeAll')}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            {t('thresholdTitle')}
          </CardTitle>
          <CardDescription>
            {t('thresholdDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {isSuper && (
              <div className="space-y-2">
                <Label htmlFor="company">{tCommon('selectCompany')}</Label>
                <Select
                  value={form.companyId}
                  onValueChange={(v) => {
                    setCompanyIdCookie(v);
                    setForm((f) => ({ ...f, companyId: v }));
                  }}
                >
                  <SelectTrigger id="company" className="max-w-xs">
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
              </div>
            )}

            {!isSuper && form.companyId && (
              <div className="space-y-2">
                <Label>{tCommon('company')}</Label>
                <p className="text-sm font-medium">
                  {companies.find((c) => c.id === form.companyId)?.name || form.companyId}
                </p>
              </div>
            )}

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-4">
                <h4 className="font-medium">{t('lowVoltage')}</h4>
                <div className="flex items-center gap-4">
                  <input
                    type="checkbox"
                    id="enableLowVoltage"
                    checked={form.enableLowVoltageAlert}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, enableLowVoltageAlert: e.target.checked }))
                    }
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor="enableLowVoltage">{tCommon('enabled')}</Label>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lowVoltage">{t('thresholdV')}</Label>
                  <Input
                    id="lowVoltage"
                    type="number"
                    step="0.1"
                    min="1.5"
                    max="3.5"
                    value={form.lowVoltageThreshold}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, lowVoltageThreshold: e.target.value }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">{t('lowVoltageHint')}</p>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium">{t('highTemp')}</h4>
                <div className="flex items-center gap-4">
                  <input
                    type="checkbox"
                    id="enableHighTemp"
                    checked={form.enableHighTempAlert}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, enableHighTempAlert: e.target.checked }))
                    }
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor="enableHighTemp">{tCommon('enabled')}</Label>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="highTemp">{t('thresholdC')}</Label>
                  <Input
                    id="highTemp"
                    type="number"
                    step="0.1"
                    min="-20"
                    max="100"
                    value={form.highTempThreshold}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, highTempThreshold: e.target.value }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">{t('highTempHint')}</p>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium">{t('lowTemp')}</h4>
                <div className="flex items-center gap-4">
                  <input
                    type="checkbox"
                    id="enableLowTemp"
                    checked={form.enableLowTempAlert}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, enableLowTempAlert: e.target.checked }))
                    }
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor="enableLowTemp">{tCommon('enabled')}</Label>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lowTemp">{t('thresholdC')}</Label>
                  <Input
                    id="lowTemp"
                    type="number"
                    step="0.1"
                    min="-50"
                    max="50"
                    value={form.lowTempThreshold}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, lowTempThreshold: e.target.value }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">{t('lowTempHint')}</p>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium">{t('tagHeartbeat')}</h4>
                <div className="flex items-center gap-4">
                  <input
                    type="checkbox"
                    id="enableTagHeartbeat"
                    checked={form.enableTagHeartbeatAlert}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, enableTagHeartbeatAlert: e.target.checked }))
                    }
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor="enableTagHeartbeat">{tCommon('enabled')}</Label>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tagLastUpdate">{t('tagHeartbeatThreshold')}</Label>
                  <Input
                    id="tagLastUpdate"
                    type="number"
                    min="1"
                    max="720"
                    value={form.tagLastUpdateHours}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, tagLastUpdateHours: parseInt(e.target.value, 10) || 24 }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">{t('tagHeartbeatHint')}</p>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium">{t('gwDisconnect')}</h4>
                <div className="flex items-center gap-4">
                  <input
                    type="checkbox"
                    id="enableGwDisconnect"
                    checked={form.enableGwDisconnectAlert}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, enableGwDisconnectAlert: e.target.checked }))
                    }
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor="enableGwDisconnect">{tCommon('enabled')}</Label>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gwDisconnect">{t('gwDisconnectThreshold')}</Label>
                  <Input
                    id="gwDisconnect"
                    type="number"
                    min="1"
                    max="720"
                    value={form.gwDisconnectHours}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, gwDisconnectHours: parseInt(e.target.value, 10) || 24 }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">{t('gwDisconnectHint')}</p>
                </div>
              </div>
            </div>

            {(session?.user?.role === 'super' || session?.user?.role === 'admin') && (
            <Button type="submit" disabled={loading || !form.companyId}>
              <Save className="mr-2 h-4 w-4" />
              {saved ? tCommon('saved') : tCommon('save')}
            </Button>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
