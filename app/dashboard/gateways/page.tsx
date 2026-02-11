'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
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
import { GatewayTable } from '../components/gateway-table';
import { TableFilter } from '../components/table-filter';
import { Plus } from 'lucide-react';

function GatewaysPageContent() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const [gateways, setGateways] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ gwMac: '', gwName: '', location: '', description: '' });

  const search = searchParams.get('search') || '';
  const order = searchParams.get('order') || 'desc';

  const fetchGateways = useCallback(async () => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    params.set('order', order);
    const res = await fetch(`/api/gateways?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      setGateways(Array.isArray(data) ? data : []);
    }
  }, [search, order]);

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
        companyId: session?.user?.companyId,
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
          <TableFilter searchPlaceholder="게이트웨이 검색 (이름, MAC, 위치)" />
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
        </div>
      </div>

      <GatewayTable gateways={gateways} />
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
