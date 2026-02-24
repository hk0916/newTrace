import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, companies, getCompanyTables } from '@/lib/db';
import { alertSettingsSchema } from '@/lib/validators/alert-settings';
import {
  getSession,
  requireAuth,
  resolveCompanyId,
  getCompanyScope,
  isAdminOrAbove,
  isSuper,
  apiError,
  apiSuccess,
} from '@/lib/api-utils';

export async function GET(req: NextRequest) {
  const session = await getSession();
  const authError = requireAuth(session);
  if (authError) return authError;

  const companyId = resolveCompanyId(session, req);
  if (!companyId) return apiError('회사 정보가 없습니다', 400);

  const { alertSettings } = getCompanyTables(companyId);

  const [settings] = await db
    .select()
    .from(alertSettings)
    .where(eq(alertSettings.id, 'default'))
    .limit(1);

  if (!settings) {
    return apiSuccess({
      companyId,
      lowVoltageThreshold: '2.5',
      highTempThreshold: '40',
      lowTempThreshold: '0',
      enableLowVoltageAlert: true,
      enableHighTempAlert: true,
      enableLowTempAlert: true,
      tagLastUpdateHours: 24,
      gwDisconnectHours: 24,
      enableTagHeartbeatAlert: true,
      enableGwDisconnectAlert: true,
    });
  }

  return apiSuccess(settings);
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  const authError = requireAuth(session);
  if (authError) return authError;

  const body = await req.json();
  const parsed = alertSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0].message, 400);
  }

  const { companyId, ...data } = parsed.data;

  if (!isAdminOrAbove(session)) {
    return apiError('관리자 권한이 필요합니다', 403);
  }
  if (!isSuper(session) && companyId !== getCompanyScope(session)) {
    return apiError('다른 회사의 알림 설정을 수정할 수 없습니다', 403);
  }

  const [company] = await db
    .select()
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);

  if (!company) return apiError('회사를 찾을 수 없습니다', 404);

  const { alertSettings } = getCompanyTables(companyId);

  const values = {
    id: 'default' as const,
    lowVoltageThreshold: data.lowVoltageThreshold.toString(),
    highTempThreshold: data.highTempThreshold.toString(),
    lowTempThreshold: data.lowTempThreshold.toString(),
    enableLowVoltageAlert: data.enableLowVoltageAlert,
    enableHighTempAlert: data.enableHighTempAlert,
    enableLowTempAlert: data.enableLowTempAlert,
    tagLastUpdateHours: data.tagLastUpdateHours ?? 24,
    gwDisconnectHours: data.gwDisconnectHours ?? 24,
    enableTagHeartbeatAlert: data.enableTagHeartbeatAlert ?? true,
    enableGwDisconnectAlert: data.enableGwDisconnectAlert ?? true,
  };

  await db
    .insert(alertSettings)
    .values(values)
    .onConflictDoUpdate({
      target: alertSettings.id,
      set: {
        lowVoltageThreshold: values.lowVoltageThreshold,
        highTempThreshold: values.highTempThreshold,
        lowTempThreshold: values.lowTempThreshold,
        enableLowVoltageAlert: values.enableLowVoltageAlert,
        enableHighTempAlert: values.enableHighTempAlert,
        enableLowTempAlert: values.enableLowTempAlert,
        tagLastUpdateHours: values.tagLastUpdateHours,
        gwDisconnectHours: values.gwDisconnectHours,
        enableTagHeartbeatAlert: values.enableTagHeartbeatAlert,
        enableGwDisconnectAlert: values.enableGwDisconnectAlert,
        updatedAt: new Date(),
      },
    });

  return apiSuccess({ companyId, ...data });
}
