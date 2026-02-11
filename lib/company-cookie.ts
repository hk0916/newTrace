/** super 선택 회사용 쿠키 (URL 노출 방지) */
export const COMPANY_COOKIE_NAME = 'company_id';
const MAX_AGE = 60 * 60 * 24; // 1일

/** 클라이언트에서 쿠키 값 읽기 */
export function getCompanyIdFromClient(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(^| )${COMPANY_COOKIE_NAME}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : null;
}

/** 클라이언트에서 쿠키 설정 */
export function setCompanyIdCookie(value: string): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${COMPANY_COOKIE_NAME}=${encodeURIComponent(value)}; path=/; max-age=${MAX_AGE}; SameSite=Lax`;
}
