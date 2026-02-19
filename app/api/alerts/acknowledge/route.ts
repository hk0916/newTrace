import { NextRequest } from 'next/server';
import { eq, and, isNull } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { db } from '@/lib/db';
import { alertAcknowledgments, alertHistory, companies } from '@/lib/db/schema';
import {
  getSession,
  requireAuth,
  getCompanyScope,
  isSuper,
  apiError,
  apiSuccess,
} from '@/lib/api-utils';

const acknowledgeSchema = {
  companyId: (v: unknown) => typeof v === 'string' && v.length > 0,
  keys: (v: unknown) =>
    Array.isArray(v) &&
    v.every(
      (k) =>
        typeof k === 'object' &&
        k !== null &&
        typeof (k as { type?: string }).type === 'string' &&
        typeof (k as { key?: string }).key === 'string'
    ),
};

export async function POST(req: NextRequest) {
  const session = await getSession();
  const authError = requireAuth(session);
  if (authError) return authError;

  const sessionIat = (session as { sessionIat?: number }).sessionIat;
  if (!sessionIat) return apiError('세션 정보가 없습니다', 401);

  let body: { companyId?: string; keys?: { type: string; key: string }[] };
  try {
    body = await req.json();
  } catch {
    return apiError('요청 본문이 올바르지 않습니다', 400);
  }

  if (!acknowledgeSchema.companyId(body.companyId)) {
    return apiError('companyId가 필요합니다', 400);
  }
  if (!acknowledgeSchema.keys(body.keys) || body.keys!.length === 0) {
    return apiError('keys 배열이 필요합니다 (type, key 포함)', 400);
  }

  const companyId = body.companyId!;
  if (!isSuper(session) && companyId !== getCompanyScope(session)) {
    return apiError('다른 회사의 알림을 확인할 수 없습니다', 403);
  }

  const [company] = await db
    .select()
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);
  if (!company) return apiError('회사를 찾을 수 없습니다', 404);

  const validTypes = ['tag_stale', 'gw_disconnected'];
  for (const k of body.keys!) {
    if (!validTypes.includes(k.type)) {
      return apiError(`잘못된 alert type: ${k.type}`, 400);
    }
  }

  for (const k of body.keys!) {
    const [existing] = await db
      .select()
      .from(alertAcknowledgments)
      .where(
        and(
          eq(alertAcknowledgments.userId, session!.user.id),
          eq(alertAcknowledgments.companyId, companyId),
          eq(alertAcknowledgments.alertType, k.type),
          eq(alertAcknowledgments.alertKey, k.key),
          eq(alertAcknowledgments.sessionIat, sessionIat)
        )
      )
      .limit(1);
    if (existing) continue;

    await db.insert(alertAcknowledgments).values({
      id: uuid(),
      userId: session!.user.id,
      companyId,
      alertType: k.type,
      alertKey: k.key,
      sessionIat,
    });

    // alertHistory에서 미해소 레코드에 acknowledgedAt 업데이트
    const [openHistory] = await db
      .select({ id: alertHistory.id })
      .from(alertHistory)
      .where(
        and(
          eq(alertHistory.companyId, companyId),
          eq(alertHistory.alertType, k.type),
          eq(alertHistory.alertKey, k.key),
          isNull(alertHistory.resolvedAt)
        )
      )
      .limit(1);

    if (openHistory) {
      await db
        .update(alertHistory)
        .set({ acknowledgedAt: new Date(), acknowledgedBy: session!.user.id })
        .where(eq(alertHistory.id, openHistory.id));
    }
  }

  return apiSuccess({ acknowledged: body.keys!.length });
}
