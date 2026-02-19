'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, useRef, useEffect } from 'react';
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

  const [inputValue, setInputValue] = useState(search);
  const isComposing = useRef(false);

  // URL 파라미터가 외부(새로고침 등)에서 바뀌면 로컬 상태 동기화
  useEffect(() => {
    if (!isComposing.current) {
      setInputValue(search);
    }
  }, [search]);

  function updateParams(updates: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([k, v]) => {
      if (v) params.set(k, v);
      else params.delete(k);
    });
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setInputValue(e.target.value);
    // IME 조합 중이 아닐 때만 URL 업데이트 (한글 자소 분리 방지)
    if (!isComposing.current) {
      updateParams({ [searchParam]: e.target.value });
    }
  }

  function handleCompositionEnd(e: React.CompositionEvent<HTMLInputElement>) {
    isComposing.current = false;
    updateParams({ [searchParam]: (e.target as HTMLInputElement).value });
  }

  return (
    <div className="flex items-center gap-2 flex-nowrap">
      <Input
        placeholder={searchPlaceholder ?? t('search')}
        value={inputValue}
        onChange={handleChange}
        onCompositionStart={() => { isComposing.current = true; }}
        onCompositionEnd={handleCompositionEnd}
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
