import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** 서버/클라이언트 일치용 날짜 포맷 (hydration 방지) */
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return '-';
  const d = new Date(date);
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
