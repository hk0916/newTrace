'use client';

import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { locales } from '@/i18n/config';

const LOCALE_COOKIE = 'NEXT_LOCALE';
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1년

export function LocaleSwitcher() {
  const router = useRouter();
  const locale = useLocale();

  async function handleChange(value: string) {
    // 쿠키 설정 (즉시 반영)
    document.cookie = `${LOCALE_COOKIE}=${value}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;

    // DB 저장 (다음 로그인 후에도 유지)
    fetch('/api/user/locale', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale: value }),
    }).catch(() => {
      // 미인증 상태 등에서 실패해도 쿠키로 동작
    });

    router.refresh();
  }

  return (
    <Select value={locale} onValueChange={handleChange}>
      <SelectTrigger size="sm" className="w-full mb-2">
        <SelectValue placeholder="언어" />
      </SelectTrigger>
      <SelectContent>
        {locales.map((loc) => (
          <SelectItem key={loc} value={loc}>
            {loc === 'ko' ? '한국어' : 'English'}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
