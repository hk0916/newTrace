import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 날짜 포맷 함수
 * @param timezone 'browser' (기본, 브라우저 로컬 시간) 또는 IANA timezone string (예: 'Asia/Seoul')
 */
export function formatDateTime(date: Date | string | null | undefined, timezone?: string): string {
  if (!date) return '-';
  const d = new Date(date);
  if (!isFinite(d.getTime())) return '-';

  if (timezone && timezone !== 'browser') {
    try {
      return new Intl.DateTimeFormat('ko-KR', {
        timeZone: timezone,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(d);
    } catch {
      // 잘못된 timezone이면 로컬로 fallback
    }
  }

  // 기본: 브라우저 로컬 timezone
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const h = d.getHours();
  const min = d.getMinutes();
  const sec = d.getSeconds();
  return `${y}. ${m}. ${day}. ${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

/** MAC 주소 표시용 (이미 콜론 없는 형태, 대문자 보장) */
export function formatMacDisplay(mac: string | null | undefined): string {
  if (!mac) return '-';
  return mac.replace(/:/g, '').toUpperCase();
}

/** 바이트 배열 → MAC 문자열 (콜론 없음, 대문자) */
export function formatMac(bytes: Uint8Array | Buffer, reversed = false): string {
  const arr = Array.from(bytes);
  const ordered = reversed ? arr.reverse() : arr;
  return ordered.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join('');
}

/** MAC 주소 정규화: 콜론/하이픈 제거 + 대문자 변환 */
export function normalizeMac(mac: string): string {
  return mac.replace(/[:\-]/g, '').toUpperCase();
}

export function toHexString(buffer: Buffer): string {
  return Array.from(buffer)
    .map(b => '0x' + b.toString(16).padStart(2, '0'))
    .join(' ');
}
