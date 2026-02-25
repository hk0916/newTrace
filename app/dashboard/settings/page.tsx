'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Settings, Clock, Save, KeyRound, CheckCircle2, MapPin } from 'lucide-react';
import { useCompanyId } from '../hooks/use-company-id';
import { setCompanyIdCookie } from '@/lib/company-cookie';
import { formatDateTime } from '@/lib/utils';

// 자주 쓰는 IANA timezone 목록
const TIMEZONE_OPTIONS = [
  { value: 'browser', label: '자동 (브라우저 시간)', labelEn: 'Auto (Browser Local Time)' },
  { value: 'UTC', label: 'UTC (협정세계시)' },
  { value: 'Asia/Seoul', label: 'UTC+9 — 한국 (Seoul)' },
  { value: 'Asia/Tokyo', label: 'UTC+9 — 일본 (Tokyo)' },
  { value: 'Asia/Shanghai', label: 'UTC+8 — 중국 (Shanghai)' },
  { value: 'Asia/Singapore', label: 'UTC+8 — 싱가포르 (Singapore)' },
  { value: 'Asia/Bangkok', label: 'UTC+7 — 태국 (Bangkok)' },
  { value: 'Asia/Kolkata', label: 'UTC+5:30 — 인도 (Kolkata)' },
  { value: 'Europe/London', label: 'UTC+0/+1 — 영국 (London)' },
  { value: 'Europe/Paris', label: 'UTC+1/+2 — 중부유럽 (Paris)' },
  { value: 'Europe/Istanbul', label: 'UTC+3 — 터키 (Istanbul)' },
  { value: 'America/New_York', label: 'UTC-5/-4 — 미국 동부 (New York)' },
  { value: 'America/Chicago', label: 'UTC-6/-5 — 미국 중부 (Chicago)' },
  { value: 'America/Denver', label: 'UTC-7/-6 — 미국 산지 (Denver)' },
  { value: 'America/Los_Angeles', label: 'UTC-8/-7 — 미국 서부 (Los Angeles)' },
  { value: 'America/Sao_Paulo', label: 'UTC-3 — 브라질 (São Paulo)' },
  { value: 'Australia/Sydney', label: 'UTC+10/+11 — 호주 (Sydney)' },
];

export default function SettingsPage() {
  const { data: session } = useSession();
  const companyIdFromCookie = useCompanyId();
  const t = useTranslations('settings');
  const tCommon = useTranslations('common');

  const isSuper = session?.user?.role === 'super';
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [companyId, setCompanyId] = useState('');
  const [timezone, setTimezone] = useState('browser');
  const [locationMode, setLocationMode] = useState('realtime');
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [previewNow, setPreviewNow] = useState(new Date().toISOString());

  // 비밀번호 변경 상태
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

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

  useEffect(() => {
    if (!companyId) return;
    fetch(`/api/company-settings?companyId=${companyId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.timezone) setTimezone(data.timezone);
        if (data?.locationMode) setLocationMode(data.locationMode);
      });
  }, [companyId]);

  // 미리보기 시간 갱신
  useEffect(() => {
    const id = setInterval(() => setPreviewNow(new Date().toISOString()), 1000);
    return () => clearInterval(id);
  }, []);

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPwError('');
    if (pwForm.next !== pwForm.confirm) {
      setPwError('새 비밀번호가 일치하지 않습니다.');
      return;
    }
    if (pwForm.next.length < 6) {
      setPwError('새 비밀번호는 6자 이상이어야 합니다.');
      return;
    }
    setPwLoading(true);
    const res = await fetch('/api/user/password', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: pwForm.current, newPassword: pwForm.next }),
    });
    setPwLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setPwError(data?.error || '비밀번호 변경에 실패했습니다.');
      return;
    }
    setPwSuccess(true);
    setPwForm({ current: '', next: '', confirm: '' });
    setTimeout(() => setPwSuccess(false), 4000);
  }

  async function handleSave() {
    if (!companyId) return;
    setLoading(true);
    const res = await fetch('/api/company-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, timezone, locationMode }),
    });
    setLoading(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      // timezone context 갱신을 위해 페이지 reload (간단한 방법)
      window.location.reload();
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="h-6 w-6" />
        <h1 className="text-2xl font-bold">{t('title')}</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            {t('timezoneTitle')}
          </CardTitle>
          <CardDescription>{t('timezoneDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isSuper && (
            <div className="space-y-2">
              <Label>{tCommon('selectCompany')}</Label>
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
            </div>
          )}

          {!isSuper && companyId && (
            <div className="space-y-2">
              <Label>{tCommon('company')}</Label>
              <p className="text-sm font-medium">
                {companies.find((c) => c.id === companyId)?.name || companyId}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="timezone">{t('timezone')}</Label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger id="timezone" className="max-w-md">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONE_OPTIONS.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{t('timezoneHint')}</p>
          </div>

          <div className="rounded-lg bg-muted/50 p-4 space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{t('timezonePreview')}</p>
            <p className="text-lg font-mono">{formatDateTime(previewNow, timezone)}</p>
          </div>

          <Button onClick={handleSave} disabled={loading || !companyId}>
            <Save className="h-4 w-4 mr-2" />
            {saved ? tCommon('saved') : tCommon('save')}
          </Button>
        </CardContent>
      </Card>

      {/* 위치 결정 모드 카드 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            {t('locationModeTitle')}
          </CardTitle>
          <CardDescription>{t('locationModeDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="locationMode">{t('locationMode')}</Label>
            <Select value={locationMode} onValueChange={setLocationMode}>
              <SelectTrigger id="locationMode" className="max-w-md">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="realtime">{t('locationModeRealtime')}</SelectItem>
                <SelectItem value="accuracy">{t('locationModeAccuracy')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg bg-muted/50 p-4 space-y-1">
            <p className="text-sm font-medium text-muted-foreground">
              {locationMode === 'realtime'
                ? t('locationModeRealtimeDesc')
                : t('locationModeAccuracyDesc')}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 비밀번호 변경 카드 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            비밀번호 변경
          </CardTitle>
          <CardDescription>현재 비밀번호를 확인한 후 새 비밀번호로 변경합니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordChange} className="space-y-4 max-w-sm">
            <div className="space-y-2">
              <Label htmlFor="pw-current">현재 비밀번호</Label>
              <Input
                id="pw-current"
                type="password"
                value={pwForm.current}
                onChange={(e) => setPwForm((f) => ({ ...f, current: e.target.value }))}
                placeholder="현재 비밀번호"
                required
                autoComplete="current-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pw-new">새 비밀번호</Label>
              <Input
                id="pw-new"
                type="password"
                value={pwForm.next}
                onChange={(e) => setPwForm((f) => ({ ...f, next: e.target.value }))}
                placeholder="6자 이상"
                required
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pw-confirm">새 비밀번호 확인</Label>
              <Input
                id="pw-confirm"
                type="password"
                value={pwForm.confirm}
                onChange={(e) => setPwForm((f) => ({ ...f, confirm: e.target.value }))}
                placeholder="새 비밀번호 재입력"
                required
                autoComplete="new-password"
              />
            </div>
            {pwError && <p className="text-sm text-destructive">{pwError}</p>}
            {pwSuccess && (
              <p className="text-sm text-green-600 flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4" />
                비밀번호가 변경되었습니다.
              </p>
            )}
            <Button type="submit" disabled={pwLoading}>
              <KeyRound className="h-4 w-4 mr-2" />
              {pwLoading ? '변경 중...' : '비밀번호 변경'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
