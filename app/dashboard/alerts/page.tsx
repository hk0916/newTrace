'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
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
import { AlertTriangle, Save, Bell, CheckCircle } from 'lucide-react';
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
      <div>
        <h1 className="text-2xl font-bold">알림 설정</h1>
        <p className="text-muted-foreground mt-1">
          회사별로 태그 경고 기준을 설정합니다.
        </p>
      </div>

      {form.companyId && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              현재 알림
            </CardTitle>
            <CardDescription>
              확인한 알림은 다음 로그인까지 다시 표시되지 않습니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {alertsLoading ? (
              <p className="text-sm text-muted-foreground">로딩 중...</p>
            ) : alerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">발생 중인 알림이 없습니다.</p>
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
                        {new Date(a.since).toLocaleString('ko-KR')} 부터
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={ackLoading}
                      onClick={() => handleAcknowledge([{ type: a.type, key: a.key }])}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      확인
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
                  전체 확인
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
            경고 임계값
          </CardTitle>
          <CardDescription>
            저전압, 고온, 저온 임계값을 설정하고 각 알림 활성화 여부를 선택하세요.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {isSuper && (
              <div className="space-y-2">
                <Label htmlFor="company">회사 선택</Label>
                <Select
                  value={form.companyId}
                  onValueChange={(v) => {
                    setCompanyIdCookie(v);
                    setForm((f) => ({ ...f, companyId: v }));
                  }}
                >
                  <SelectTrigger id="company" className="max-w-xs">
                    <SelectValue placeholder="회사 선택" />
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
                <Label>회사</Label>
                <p className="text-sm font-medium">
                  {companies.find((c) => c.id === form.companyId)?.name || form.companyId}
                </p>
              </div>
            )}

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-4">
                <h4 className="font-medium">저전압 알림</h4>
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
                  <Label htmlFor="enableLowVoltage">활성화</Label>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lowVoltage">임계값 (V)</Label>
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
                  <p className="text-xs text-muted-foreground">이 전압 미만이면 경고</p>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium">고온 알림</h4>
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
                  <Label htmlFor="enableHighTemp">활성화</Label>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="highTemp">임계값 (°C)</Label>
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
                  <p className="text-xs text-muted-foreground">이 온도 초과 시 경고</p>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium">저온 알림</h4>
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
                  <Label htmlFor="enableLowTemp">활성화</Label>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lowTemp">임계값 (°C)</Label>
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
                  <p className="text-xs text-muted-foreground">이 온도 미만이면 경고</p>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium">태그 미갱신 알림</h4>
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
                  <Label htmlFor="enableTagHeartbeat">활성화</Label>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tagLastUpdate">갱신 없음 임계 (시간)</Label>
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
                  <p className="text-xs text-muted-foreground">이 시간 이상 갱신 없으면 경고</p>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium">게이트웨이 끊김 알림</h4>
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
                  <Label htmlFor="enableGwDisconnect">활성화</Label>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gwDisconnect">끊김 임계 (시간)</Label>
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
                  <p className="text-xs text-muted-foreground">이 시간 이상 끊겨 있으면 경고</p>
                </div>
              </div>
            </div>

            {(session?.user?.role === 'super' || session?.user?.role === 'admin') && (
            <Button type="submit" disabled={loading || !form.companyId}>
              <Save className="mr-2 h-4 w-4" />
              {saved ? '저장됨' : '저장'}
            </Button>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
