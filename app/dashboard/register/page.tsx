'use client';

import { Suspense, useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
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
import { Radio, Tag, Plus, FileSpreadsheet, Download, Upload } from 'lucide-react';
import { useCompanyId } from '../hooks/use-company-id';
import { setCompanyIdCookie } from '@/lib/company-cookie';

function RegisterPageContent() {
  const { data: session } = useSession();
  const router = useRouter();
  const companyId = useCompanyId();
  const tReg = useTranslations('register');
  const tCommon = useTranslations('common');
  const tGw = useTranslations('gateways');
  const tTag = useTranslations('tags');
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [gwLoading, setGwLoading] = useState(false);
  const [tagLoading, setTagLoading] = useState(false);

  const isSuper = session?.user?.role === 'super';
  const canRegister = isSuper || session?.user?.role === 'admin';

  const [gwForm, setGwForm] = useState({ gwMac: '', gwName: '', companyId: '' });
  const [tagForm, setTagForm] = useState({ tagMac: '', tagName: '', companyId: '', reportInterval: '60' });
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ gateways: { success: number; fail: number; errors: string[] }; tags: { success: number; fail: number; errors: string[] } } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isSuper && (!companyId || companyId === 'super')) {
      router.replace('/dashboard');
    }
  }, [isSuper, companyId, router]);

  useEffect(() => {
    if (isSuper) {
      fetch('/api/companies').then((r) => r.ok ? r.json().then(setCompanies) : undefined);
    }
  }, [isSuper]);

  useEffect(() => {
    if (isSuper && companies.length > 0) {
      setGwForm((f) => ({ ...f, companyId: companyId || companies[0]?.id || '' }));
      setTagForm((f) => ({ ...f, companyId: companyId || companies[0]?.id || '' }));
    }
  }, [isSuper, companies, companyId]);

  async function handleGatewaySubmit(e: React.FormEvent) {
    e.preventDefault();
    const effectiveCompanyId = isSuper ? gwForm.companyId : session?.user?.companyId;
    if (!effectiveCompanyId) return;
    setGwLoading(true);
    const res = await fetch('/api/gateways', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gwMac: gwForm.gwMac.trim().toUpperCase(),
        gwName: gwForm.gwName.trim(),
        companyId: effectiveCompanyId,
      }),
    });
    setGwLoading(false);
    if (res.ok) {
      setGwForm((f) => ({ ...f, gwMac: '', gwName: '' }));
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error || tReg('registerFailed'));
    }
  }

  async function handleTagSubmit(e: React.FormEvent) {
    e.preventDefault();
    const effectiveCompanyId = isSuper ? tagForm.companyId : session?.user?.companyId;
    if (!effectiveCompanyId) return;
    setTagLoading(true);
    const res = await fetch('/api/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tagMac: tagForm.tagMac.trim().toUpperCase(),
        tagName: tagForm.tagName.trim(),
        companyId: effectiveCompanyId,
        reportInterval: parseInt(tagForm.reportInterval, 10) || 60,
      }),
    });
    setTagLoading(false);
    if (res.ok) {
      setTagForm((f) => ({ ...f, tagMac: '', tagName: '' }));
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error || tReg('registerFailed'));
    }
  }

  function handleDownloadTemplate() {
    const form = document.createElement('form');
    form.method = 'GET';
    form.action = '/api/register/template';
    form.target = '_blank';
    form.style.display = 'none';
    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
  }

  async function handleBulkUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBulkLoading(true);
    setBulkResult(null);
    const formData = new FormData();
    formData.set('file', file);
    const res = await fetch('/api/register/bulk', { method: 'POST', body: formData });
    setBulkLoading(false);
    e.target.value = '';
    if (res.ok) {
      const data = await res.json();
      setBulkResult(data);
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.error || tReg('bulkFailed'));
    }
  }

  if (!canRegister) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        {tReg('noPermission')}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">{tReg('title')}</h1>
        <p className="text-muted-foreground mt-1">
          {tReg('description')}
          {isSuper ? tReg('descriptionSuper') : tReg('descriptionAdmin')}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            {tReg('bulkTitle')}
          </CardTitle>
          <CardDescription>
            {tReg('bulkDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleDownloadTemplate}>
              <Download className="mr-2 h-4 w-4" />
              {tReg('downloadTemplate')}
            </Button>
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={bulkLoading}
            >
              <Upload className="mr-2 h-4 w-4" />
              {bulkLoading ? tCommon('registering') : tReg('uploadExcel')}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleBulkUpload}
            />
          </div>
          {bulkResult && (
            <div className="rounded-lg border p-4 text-sm space-y-2">
              <p className="font-medium">{tReg('bulkResult')}</p>
              <p>{tReg('bulkGatewayResult', { success: bulkResult.gateways.success, fail: bulkResult.gateways.fail })}</p>
              <p>{tReg('bulkTagResult', { success: bulkResult.tags.success, fail: bulkResult.tags.fail })}</p>
              {(bulkResult.gateways.errors.length > 0 || bulkResult.tags.errors.length > 0) && (
                <div className="mt-2 text-destructive text-xs max-h-32 overflow-y-auto">
                  {[...bulkResult.gateways.errors, ...bulkResult.tags.errors].slice(0, 10).map((e, i) => (
                    <div key={i}>{e}</div>
                  ))}
                  {(bulkResult.gateways.errors.length + bulkResult.tags.errors.length) > 10 && (
                    <div>{tReg('bulkMoreErrors', { count: bulkResult.gateways.errors.length + bulkResult.tags.errors.length - 10 })}</div>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Radio className="h-5 w-5" />
              {tReg('gwRegister')}
            </CardTitle>
            <CardDescription>
              {isSuper ? tReg('gwDescriptionSuper') : tReg('gwDescriptionAdmin')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleGatewaySubmit} className="space-y-4">
              {isSuper && (
                <div className="space-y-2">
                  <Label htmlFor="gw-company">{tCommon('company')}</Label>
                  <Select
                    value={gwForm.companyId}
                    onValueChange={(v) => setGwForm((f) => ({ ...f, companyId: v }))}
                    required
                  >
                    <SelectTrigger id="gw-company">
                      <SelectValue placeholder={tCommon('selectCompany')} />
                    </SelectTrigger>
                    <SelectContent>
                      {companies.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="gwMac">{tCommon('macAddress')}</Label>
                <Input
                  id="gwMac"
                  placeholder="AABBCCDDEEFF"
                  value={gwForm.gwMac}
                  onChange={(e) => setGwForm((f) => ({ ...f, gwMac: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gwName">{tCommon('name')}</Label>
                <Input
                  id="gwName"
                  placeholder={tGw('namePlaceholder')}
                  value={gwForm.gwName}
                  onChange={(e) => setGwForm((f) => ({ ...f, gwName: e.target.value }))}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={gwLoading}>
                <Plus className="mr-2 h-4 w-4" />
                {gwLoading ? tCommon('registering') : tReg('gwRegister')}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              {tReg('tagRegister')}
            </CardTitle>
            <CardDescription>
              {isSuper ? tReg('gwDescriptionSuper') : tReg('gwDescriptionAdmin')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleTagSubmit} className="space-y-4">
              {isSuper && (
                <div className="space-y-2">
                  <Label htmlFor="tag-company">{tCommon('company')}</Label>
                  <Select
                    value={tagForm.companyId}
                    onValueChange={(v) => setTagForm((f) => ({ ...f, companyId: v }))}
                    required
                  >
                    <SelectTrigger id="tag-company">
                      <SelectValue placeholder={tCommon('selectCompany')} />
                    </SelectTrigger>
                    <SelectContent>
                      {companies.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="tagMac">{tCommon('macAddress')}</Label>
                <Input
                  id="tagMac"
                  placeholder="112233445566"
                  value={tagForm.tagMac}
                  onChange={(e) => setTagForm((f) => ({ ...f, tagMac: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tagName">{tCommon('name')}</Label>
                <Input
                  id="tagName"
                  placeholder={tTag('namePlaceholder')}
                  value={tagForm.tagName}
                  onChange={(e) => setTagForm((f) => ({ ...f, tagName: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reportInterval">{tReg('reportInterval')}</Label>
                <Input
                  id="reportInterval"
                  type="number"
                  min="1"
                  value={tagForm.reportInterval}
                  onChange={(e) => setTagForm((f) => ({ ...f, reportInterval: e.target.value }))}
                />
              </div>
              <Button type="submit" className="w-full" disabled={tagLoading}>
                <Plus className="mr-2 h-4 w-4" />
                {tagLoading ? tCommon('registering') : tReg('tagRegister')}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  const t = useTranslations('common');
  return (
    <Suspense fallback={<div className="py-8 text-center text-muted-foreground">{t('loading')}</div>}>
      <RegisterPageContent />
    </Suspense>
  );
}
