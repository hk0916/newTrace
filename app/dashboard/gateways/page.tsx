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
import { GatewayTable, type GatewayRow } from '../components/gateway-table';
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

function GatewaysPageContent() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const companyId = useCompanyId();
  const [gateways, setGateways] = useState<GatewayRow[]>([]);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ gwMac: '', gwName: '', location: '', description: '' });

  const search = searchParams.get('search') || '';
  const order = searchParams.get('order') || 'desc';

  // super인데 companyId 없거나 'super'(시스템)이면 대시보드로 이동 (쿠키 설정됨)
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

  const fetchGateways = useCallback(async () => {
    if (!companyId) return;
    const params = new URLSearchParams();
    params.set('companyId', companyId);
    if (search) params.set('search', search);
    params.set('order', order);
    const res = await fetch(`/api/gateways?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      setGateways(Array.isArray(data) ? data as GatewayRow[] : []);
    }
  }, [search, order, companyId]);

  useEffect(() => {
    fetchGateways();
  }, [fetchGateways]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const res = await fetch('/api/gateways', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        companyId: companyId || session?.user?.companyId,
      }),
    });

    setLoading(false);

    if (res.ok) {
      setOpen(false);
      setForm({ gwMac: '', gwName: '', location: '', description: '' });
      fetchGateways();
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">게이트웨이 관리</h1>
        <div className="flex items-center gap-2 flex-nowrap">
        {session?.user?.role === 'super' && companies.length > 0 && (
          <Select
            value={companyId || ''}
            onValueChange={(v) => {
              setCompanyIdCookie(v);
              router.replace('/dashboard/gateways');
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
        <TableFilter searchPlaceholder="게이트웨이 검색 (이름, MAC, 위치)" />
        {(session?.user?.role === 'super' || session?.user?.role === 'admin') && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              게이트웨이 등록
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>게이트웨이 등록</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="gwMac">MAC 주소</Label>
                <Input
                  id="gwMac"
                  placeholder="AA:BB:CC:DD:EE:FF"
                  value={form.gwMac}
                  onChange={(e) => setForm({ ...form, gwMac: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gwName">이름</Label>
                <Input
                  id="gwName"
                  placeholder="7층 게이트웨이 01"
                  value={form.gwName}
                  onChange={(e) => setForm({ ...form, gwName: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">위치</Label>
                <Input
                  id="location"
                  placeholder="7층 간호사실"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">설명</Label>
                <Input
                  id="description"
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

      <GatewayTable
        gateways={gateways}
        canEdit={session?.user?.role === 'super' || session?.user?.role === 'admin'}
        onEditSuccess={fetchGateways}
      />
    </div>
  );
}

export default function GatewaysPage() {
  return (
    <Suspense fallback={<div className="py-8 text-center text-muted-foreground">로딩 중...</div>}>
      <GatewaysPageContent />
    </Suspense>
  );
}
