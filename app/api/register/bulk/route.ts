import { NextRequest } from 'next/server';
import * as XLSX from 'xlsx';
import { getSession, requireAuth, getCompanyScope, isSuper, isAdminOrAbove, apiError, apiSuccess } from '@/lib/api-utils';
import { db } from '@/lib/db';
import { gateways, tags } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

const MAC_REGEX = /^[0-9A-Fa-f]{2}(:[0-9A-Fa-f]{2}){5}$/;
function formatMac(v: unknown): string | null {
  if (!v || typeof v !== 'string') return null;
  const s = v.trim().replace(/-/g, ':').toUpperCase();
  return MAC_REGEX.test(s) ? s : null;
}

function safeStr(v: unknown): string {
  if (v == null) return '';
  return String(v).trim();
}

function safeInt(v: unknown, defaultVal: number): number {
  if (v == null) return defaultVal;
  const n = parseInt(String(v), 10);
  return isNaN(n) ? defaultVal : n;
}

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const session = await getSession();
  const authError = requireAuth(session);
  if (authError) return authError;
  if (!isAdminOrAbove(session)) return apiError('등록 권한이 없습니다', 403);

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return apiError('엑셀 파일을 선택해주세요', 400);

  const buf = Buffer.from(await file.arrayBuffer());
  const wb = XLSX.read(buf, { type: 'buffer' });

  const sessionCompanyId = getCompanyScope(session);
  const isSuperUser = isSuper(session);

  const results = { gateways: { success: 0, fail: 0, errors: [] as string[] }, tags: { success: 0, fail: 0, errors: [] as string[] } };

  // 게이트웨이 시트 처리
  const gwSheet = wb.Sheets[wb.SheetNames.find((n) => n.includes('게이트웨이')) || wb.SheetNames[0]];
  if (gwSheet) {
    const gwRows = XLSX.utils.sheet_to_json<string[]>(gwSheet, { header: 1 }) as unknown[][];
    const head = (gwRows[0] || []) as string[];
    const macIdx = head.findIndex((h) => /mac|주소/i.test(String(h)));
    const nameIdx = head.findIndex((h) => /이름|name/i.test(String(h)));
    const companyIdx = isSuperUser ? head.findIndex((h) => /회사|company/i.test(String(h))) : -1;

    for (let i = 1; i < gwRows.length; i++) {
      const row = gwRows[i] as unknown[];
      const mac = formatMac(row[macIdx] ?? row[0]);
      const name = safeStr(row[nameIdx] ?? row[1]);
      const companyId = isSuperUser ? safeStr(row[companyIdx] ?? row[2]) : sessionCompanyId;

      if (!mac || !name) continue;
      if (!companyId) {
        results.gateways.fail++;
        results.gateways.errors.push(`행 ${i + 1}: 회사ID가 필요합니다`);
        continue;
      }

      try {
        const [existing] = await db.select().from(gateways).where(eq(gateways.gwMac, mac)).limit(1);
        if (existing) {
          results.gateways.fail++;
          results.gateways.errors.push(`행 ${i + 1}: ${mac} 이미 등록됨`);
          continue;
        }
        await db.insert(gateways).values({ gwMac: mac, gwName: name, companyId });
        results.gateways.success++;
      } catch (e) {
        results.gateways.fail++;
        results.gateways.errors.push(`행 ${i + 1}: ${(e as Error).message}`);
      }
    }
  }

  // 태그 시트 처리 (이름에 '태그' 포함된 시트만)
  const tagSheetName = wb.SheetNames.find((n) => n.includes('태그'));
  const tagSheet = tagSheetName ? wb.Sheets[tagSheetName] : null;
  if (tagSheet) {
    const tagRows = XLSX.utils.sheet_to_json<string[]>(tagSheet, { header: 1 }) as unknown[][];
    const head = (tagRows[0] || []) as string[];
    const macIdx = head.findIndex((h) => /mac|주소/i.test(String(h)));
    const nameIdx = head.findIndex((h) => /이름|name/i.test(String(h)));
    const companyIdx = isSuperUser ? head.findIndex((h) => /회사|company/i.test(String(h))) : -1;
    const reportIdx = head.findIndex((h) => /보고|report/i.test(String(h)));

    for (let i = 1; i < tagRows.length; i++) {
      const row = tagRows[i] as unknown[];
      const mac = formatMac(row[macIdx] ?? row[0]);
      const name = safeStr(row[nameIdx] ?? row[1]);
      const companyId = isSuperUser ? safeStr(row[companyIdx] ?? row[2]) : sessionCompanyId;
      const reportInterval = safeInt(row[reportIdx] ?? row[isSuperUser ? 3 : 2], 60);

      if (!mac || !name) continue;
      if (!companyId) {
        results.tags.fail++;
        results.tags.errors.push(`행 ${i + 1}: 회사ID가 필요합니다`);
        continue;
      }

      try {
        const [existing] = await db.select().from(tags).where(eq(tags.tagMac, mac)).limit(1);
        if (existing) {
          results.tags.fail++;
          results.tags.errors.push(`행 ${i + 1}: ${mac} 이미 등록됨`);
          continue;
        }
        await db.insert(tags).values({ tagMac: mac, tagName: name, companyId, reportInterval });
        results.tags.success++;
      } catch (e) {
        results.tags.fail++;
        results.tags.errors.push(`행 ${i + 1}: ${(e as Error).message}`);
      }
    }
  }

  return apiSuccess(results);
}
