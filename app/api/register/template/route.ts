import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getSession, requireAuth, isSuper, apiError } from '@/lib/api-utils';

export const runtime = 'nodejs';

export async function GET() {
  const session = await getSession();
  const authError = requireAuth(session);
  if (authError) return authError;

  if (session!.user.role !== 'super' && session!.user.role !== 'admin') {
    return apiError('등록 권한이 없습니다', 403);
  }

  const wb = XLSX.utils.book_new();

  // 게이트웨이 시트
  const gwHeaders = isSuper(session)
    ? ['MAC주소', '이름', '회사ID']
    : ['MAC주소', '이름'];
  const gwExample = isSuper(session)
    ? [
        ['AA:BB:CC:DD:EE:01', '7층 게이트웨이 01', 'skaichips'],
        ['AA:BB:CC:DD:EE:02', '7층 게이트웨이 02', 'skaichips'],
      ]
    : [
        ['AA:BB:CC:DD:EE:01', '7층 게이트웨이 01'],
        ['AA:BB:CC:DD:EE:02', '7층 게이트웨이 02'],
      ];
  const gwData = [gwHeaders, ...gwExample];
  const gwSheet = XLSX.utils.aoa_to_sheet(gwData);
  XLSX.utils.book_append_sheet(wb, gwSheet, '게이트웨이');

  // 태그 시트
  const tagHeaders = isSuper(session)
    ? ['MAC주소', '이름', '회사ID', '보고주기(초)']
    : ['MAC주소', '이름', '보고주기(초)'];
  const tagExample = isSuper(session)
    ? [
        ['11:22:33:44:55:01', '수액펌프 01', 'skaichips', 60],
        ['11:22:33:44:55:02', '수액펌프 02', 'skaichips', 60],
      ]
    : [
        ['11:22:33:44:55:01', '수액펌프 01', 60],
        ['11:22:33:44:55:02', '수액펌프 02', 60],
      ];
  const tagData = [tagHeaders, ...tagExample];
  const tagSheet = XLSX.utils.aoa_to_sheet(tagData);
  XLSX.utils.book_append_sheet(wb, tagSheet, '태그');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  const dateStr = new Date().toISOString().slice(0, 10);
  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="asset_register_template_${dateStr}.xlsx"`,
    },
  });
}
