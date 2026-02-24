import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, getCompanyTables } from '@/lib/db';
import { gatewayCommandSchema } from '@/lib/validators/gateway-command';
import {
  getSession,
  requireAdmin,
  resolveCompanyId,
  apiError,
  apiSuccess,
} from '@/lib/api-utils';

const WS_CMD_URL = process.env.WS_CMD_URL || 'http://localhost:8081';
const WS_CMD_SECRET = process.env.WS_CMD_SECRET || 'tracetag-cmd-secret';

export async function POST(req: NextRequest) {
  const session = await getSession();
  const adminError = requireAdmin(session);
  if (adminError) return adminError;

  const companyId = resolveCompanyId(session, req);
  if (!companyId) return apiError('회사 정보가 없습니다', 400);

  const body = await req.json();
  const parsed = gatewayCommandSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0].message, 400);
  }

  const { gwMac, command } = parsed.data;
  const payload = 'payload' in parsed.data ? parsed.data.payload : undefined;

  // 게이트웨이 소유권 확인 (all이 아닌 경우)
  if (gwMac !== 'all') {
    const { gateways } = getCompanyTables(companyId);
    const [gw] = await db
      .select({ gwMac: gateways.gwMac })
      .from(gateways)
      .where(eq(gateways.gwMac, gwMac))
      .limit(1);

    if (!gw) return apiError('게이트웨이를 찾을 수 없습니다', 404);
  }

  // WS 서버 명령 API로 포워딩
  try {
    const cmdRes = await fetch(`${WS_CMD_URL}/command`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cmd-secret': WS_CMD_SECRET,
      },
      body: JSON.stringify({ gwMac, companyId, command, payload }),
    });

    const cmdData = await cmdRes.json();

    if (!cmdRes.ok) {
      const errorMsg = cmdData.error
        || cmdData.results?.[0]?.error
        || '명령 전송 실패';
      return apiError(errorMsg, cmdRes.status);
    }

    return apiSuccess(cmdData);
  } catch (err) {
    console.error('[Gateway Control] WS 서버 통신 오류:', err);
    return apiError('WS 서버에 연결할 수 없습니다', 502);
  }
}
