import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import { auth } from '@/lib/auth';
import { defaultLocale, locales, type Locale } from './config';

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get('NEXT_LOCALE')?.value;

  let locale: Locale = defaultLocale;

  if (locales.includes(cookieLocale as Locale)) {
    // 쿠키 우선 (언어 전환 시 즉시 반영)
    locale = cookieLocale as Locale;
  } else {
    // 쿠키 없으면 세션(DB에서 로드된 JWT) 확인
    try {
      const session = await auth();
      const sessionLocale = session?.user?.locale;
      if (sessionLocale && locales.includes(sessionLocale as Locale)) {
        locale = sessionLocale as Locale;
        // 세션 locale을 쿠키에도 동기화 (이후 요청에서 빠르게 읽기 위해)
      }
    } catch {
      // auth 실패 시 defaultLocale 사용
    }
  }

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
