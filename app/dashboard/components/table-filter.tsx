'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ArrowDown, ArrowUp } from 'lucide-react';

interface TableFilterProps {
  prefix?: string;
  searchPlaceholder?: string;
}

export function TableFilter({ prefix = '', searchPlaceholder }: TableFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations('common');

  const searchParam = prefix ? `${prefix}Search` : 'search';
  const orderParam = prefix ? `${prefix}Order` : 'order';

  const search = searchParams.get(searchParam) || '';
  const order = searchParams.get(orderParam) || 'desc';

  function updateParams(updates: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([k, v]) => {
      if (v) params.set(k, v);
      else params.delete(k);
    });
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="flex items-center gap-2 flex-nowrap">
      <Input
        placeholder={searchPlaceholder ?? t('search')}
        value={search}
        onChange={(e) => updateParams({ [searchParam]: e.target.value })}
        className="w-48 sm:w-64 h-9 shrink-0"
      />
      <Button
        variant="outline"
        size="sm"
        onClick={() => updateParams({ [orderParam]: order === 'desc' ? 'asc' : 'desc' })}
        className="h-9"
      >
        {order === 'desc' ? <ArrowDown className="h-4 w-4 mr-1" /> : <ArrowUp className="h-4 w-4 mr-1" />}
        {order === 'desc' ? t('newestFirst') : t('oldestFirst')}
      </Button>
    </div>
  );
}
