'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { TagTable, type TagRow } from '../components/tag-table';
import { TableFilter } from '../components/table-filter';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus } from 'lucide-react';
import { useCompanyId } from '../hooks/use-company-id';
import { setCompanyIdCookie } from '@/lib/company-cookie';

function TagsPageContent() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const companyId = useCompanyId();
  const [tags, setTags] = useState<TagRow[]>([]);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    tagMac: '',
    tagName: '',
    reportInterval: '60',
    assetType: '',
    assignedGwMac: '',
    description: '',
  });

  const search = searchParams.get('search') || '';
  const order = searchParams.get('order') || 'desc';

  // super인데 companyId 없거나 'super'(시스템)이면 대시보드로 이동
  useEffect(() => {
    if (session?.user?.role === 'super' && (!companyId || companyId === 'super')) {
      router.replace('/dashboard');
    }
  }, [session?.user?.role, companyId, router]);

  useEffect(() => {
    if (session?.user?.role === 'super') {
      fetch('/api/companies').then((r) => r.ok ? r.json().then(setCompanies) : undefined);
    }
  }, [session?.user?.role]);

  const fetchTags = useCallback(async () => {
    if (!companyId) return;
    const params = new URLSearchParams();
    params.set('companyId', companyId);
    if (search) params.set('search', search);
    params.set('order', order);
    const res = await fetch(`/api/tags?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      setTags(Array.isArray(data) ? data as TagRow[] : []);
    }
  }, [search, order, companyId]);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const res = await fetch('/api/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tagMac: form.tagMac,
        tagName: form.tagName,
        companyId: companyId || session?.user?.companyId,
        reportInterval: parseInt(form.reportInterval),
        assetType: form.assetType || undefined,
        assignedGwMac: form.assignedGwMac || undefined,
        description: form.description || undefined,
      }),
    });

    setLoading(false);

    if (res.ok) {
      setOpen(false);
      setForm({ tagMac: '', tagName: '', reportInterval: '60', assetType: '', assignedGwMac: '', description: '' });
      fetchTags();
    }
  }

  return (
      <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">태그 관리</h1>
        <div className="flex items-center gap-2 flex-nowrap">
        {session?.user?.role === 'super' && companies.length > 0 && (
          <Select
            value={companyId || ''}
            onValueChange={(v) => {
              setCompanyIdCookie(v);
              router.replace('/dashboard/tags');
            }}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="회사 선택" />
            </SelectTrigger>
            <SelectContent>
              {companies.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
          <TableFilter searchPlaceholder="태그 검색 (이름, MAC, 자산유형)" />
          {(session?.user?.role === 'super' || session?.user?.role === 'admin') && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                태그 등록
              </Button>
            </DialogTrigger>
            <DialogContent>
            <DialogHeader>
              <DialogTitle>태그 등록</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="tagMac">MAC 주소</Label>
                <Input
                  id="tagMac"
                  placeholder="AA:BB:CC:DD:EE:FF"
                  value={form.tagMac}
                  onChange={(e) => setForm({ ...form, tagMac: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tagName">이름</Label>
                <Input
                  id="tagName"
                  placeholder="수액펌프 01"
                  value={form.tagName}
                  onChange={(e) => setForm({ ...form, tagName: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reportInterval">보고 주기 (초)</Label>
                <Input
                  id="reportInterval"
                  type="number"
                  min="1"
                  value={form.reportInterval}
                  onChange={(e) => setForm({ ...form, reportInterval: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="assetType">자산 유형</Label>
                <Input
                  id="assetType"
                  placeholder="의료장비, 자산 등"
                  value={form.assetType}
                  onChange={(e) => setForm({ ...form, assetType: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="assignedGwMac">할당 게이트웨이 MAC (선택)</Label>
                <Input
                  id="assignedGwMac"
                  placeholder="AA:BB:CC:DD:EE:FF"
                  value={form.assignedGwMac}
                  onChange={(e) => setForm({ ...form, assignedGwMac: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tagDescription">설명</Label>
                <Input
                  id="tagDescription"
                  placeholder="설명 (선택)"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? '등록 중...' : '등록'}
              </Button>
            </form>
            </DialogContent>
          </Dialog>
          )}
        </div>
      </div>

      <TagTable
        tags={tags}
        canEdit={session?.user?.role === 'super' || session?.user?.role === 'admin'}
        onEditSuccess={fetchTags}
        companyId={companyId}
      />
    </div>
  );
}

export default function TagsPage() {
  return (
    <Suspense fallback={<div className="py-8 text-center text-muted-foreground">로딩 중...</div>}>
      <TagsPageContent />
    </Suspense>
  );
}
