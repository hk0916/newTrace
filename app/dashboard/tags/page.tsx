'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
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
  const tTag = useTranslations('tags');
  const tCommon = useTranslations('common');
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
        <h1 className="text-2xl font-bold">{tTag('title')}</h1>
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
              <SelectValue placeholder={tCommon('selectCompany')} />
            </SelectTrigger>
            <SelectContent>
              {companies.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
          <TableFilter searchPlaceholder={tTag('searchPlaceholder')} />
          {(session?.user?.role === 'super' || session?.user?.role === 'admin') && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                {tTag('addTag')}
              </Button>
            </DialogTrigger>
            <DialogContent>
            <DialogHeader>
              <DialogTitle>{tTag('addTag')}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="tagMac">{tCommon('macAddress')}</Label>
                <Input
                  id="tagMac"
                  placeholder="AABBCCDDEEFF"
                  value={form.tagMac}
                  onChange={(e) => setForm({ ...form, tagMac: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tagName">{tCommon('name')}</Label>
                <Input
                  id="tagName"
                  placeholder={tTag('namePlaceholder')}
                  value={form.tagName}
                  onChange={(e) => setForm({ ...form, tagName: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reportInterval">{tTag('reportInterval')}</Label>
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
                <Label htmlFor="assetType">{tTag('assetType')}</Label>
                <Input
                  id="assetType"
                  placeholder={tTag('assetTypePlaceholder')}
                  value={form.assetType}
                  onChange={(e) => setForm({ ...form, assetType: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="assignedGwMac">{tTag('assignedGatewayMac')}</Label>
                <Input
                  id="assignedGwMac"
                  placeholder="AABBCCDDEEFF"
                  value={form.assignedGwMac}
                  onChange={(e) => setForm({ ...form, assignedGwMac: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tagDescription">{tCommon('description')}</Label>
                <Input
                  id="tagDescription"
                  placeholder={tCommon('descriptionOptional')}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? tCommon('registering') : tCommon('register')}
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
  const t = useTranslations('common');
  return (
    <Suspense fallback={<div className="py-8 text-center text-muted-foreground">{t('loading')}</div>}>
      <TagsPageContent />
    </Suspense>
  );
}
