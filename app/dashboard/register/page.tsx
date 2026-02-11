'use client';

import { Suspense, useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
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

  // super인데 companyId 없거나 'super'(시스템)이면 대시보드로 이동
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

  // super: 폼에 companyId 초기화 / admin: session companyId 사용
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
      alert(data.error || '등록에 실패했습니다.');
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
      alert(data.error || '등록에 실패했습니다.');
    }
  }

  function handleDownloadTemplate() {
    // form submit + target="_blank"로 새 탭에서 다운로드 (쿠키 전송, 창 전환 최소화)
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
      alert(err.error || '대량 등록에 실패했습니다.');
    }
  }

  if (!canRegister) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        등록 권한이 없습니다. (super, admin만 등록 가능)
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">자산 등록</h1>
        <p className="text-muted-foreground mt-1">
          게이트웨이와 태그를 등록합니다.
          {isSuper ? ' 회사를 선택한 후 등록하세요.' : ' 본인 회사에 등록됩니다.'}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            엑셀 대량 등록
          </CardTitle>
          <CardDescription>
            예시 양식을 다운로드하여 작성한 후 업로드하세요. 게이트웨이·태그 시트가 각각 있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleDownloadTemplate}>
              <Download className="mr-2 h-4 w-4" />
              예시 엑셀 다운로드
            </Button>
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={bulkLoading}
            >
              <Upload className="mr-2 h-4 w-4" />
              {bulkLoading ? '등록 중...' : '엑셀 파일 업로드'}
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
              <p className="font-medium">등록 결과</p>
              <p>게이트웨이: 성공 {bulkResult.gateways.success}건, 실패 {bulkResult.gateways.fail}건</p>
              <p>태그: 성공 {bulkResult.tags.success}건, 실패 {bulkResult.tags.fail}건</p>
              {(bulkResult.gateways.errors.length > 0 || bulkResult.tags.errors.length > 0) && (
                <div className="mt-2 text-destructive text-xs max-h-32 overflow-y-auto">
                  {[...bulkResult.gateways.errors, ...bulkResult.tags.errors].slice(0, 10).map((e, i) => (
                    <div key={i}>{e}</div>
                  ))}
                  {(bulkResult.gateways.errors.length + bulkResult.tags.errors.length) > 10 && (
                    <div>... 외 {bulkResult.gateways.errors.length + bulkResult.tags.errors.length - 10}건</div>
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
              게이트웨이 등록
            </CardTitle>
            <CardDescription>
              {isSuper ? 'MAC, 이름, 회사를 입력하세요.' : 'MAC, 이름을 입력하세요.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleGatewaySubmit} className="space-y-4">
              {isSuper && (
                <div className="space-y-2">
                  <Label htmlFor="gw-company">회사</Label>
                  <Select
                    value={gwForm.companyId}
                    onValueChange={(v) => setGwForm((f) => ({ ...f, companyId: v }))}
                    required
                  >
                    <SelectTrigger id="gw-company">
                      <SelectValue placeholder="회사 선택" />
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
                <Label htmlFor="gwMac">MAC 주소</Label>
                <Input
                  id="gwMac"
                  placeholder="AA:BB:CC:DD:EE:FF"
                  value={gwForm.gwMac}
                  onChange={(e) => setGwForm((f) => ({ ...f, gwMac: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gwName">이름</Label>
                <Input
                  id="gwName"
                  placeholder="7층 게이트웨이 01"
                  value={gwForm.gwName}
                  onChange={(e) => setGwForm((f) => ({ ...f, gwName: e.target.value }))}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={gwLoading}>
                <Plus className="mr-2 h-4 w-4" />
                {gwLoading ? '등록 중...' : '게이트웨이 등록'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              태그 등록
            </CardTitle>
            <CardDescription>
              {isSuper ? 'MAC, 이름, 회사를 입력하세요.' : 'MAC, 이름을 입력하세요.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleTagSubmit} className="space-y-4">
              {isSuper && (
                <div className="space-y-2">
                  <Label htmlFor="tag-company">회사</Label>
                  <Select
                    value={tagForm.companyId}
                    onValueChange={(v) => setTagForm((f) => ({ ...f, companyId: v }))}
                    required
                  >
                    <SelectTrigger id="tag-company">
                      <SelectValue placeholder="회사 선택" />
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
                <Label htmlFor="tagMac">MAC 주소</Label>
                <Input
                  id="tagMac"
                  placeholder="11:22:33:44:55:66"
                  value={tagForm.tagMac}
                  onChange={(e) => setTagForm((f) => ({ ...f, tagMac: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tagName">이름</Label>
                <Input
                  id="tagName"
                  placeholder="수액펌프 01"
                  value={tagForm.tagName}
                  onChange={(e) => setTagForm((f) => ({ ...f, tagName: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reportInterval">보고 주기 (초)</Label>
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
                {tagLoading ? '등록 중...' : '태그 등록'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="py-8 text-center text-muted-foreground">로딩 중...</div>}>
      <RegisterPageContent />
    </Suspense>
  );
}
