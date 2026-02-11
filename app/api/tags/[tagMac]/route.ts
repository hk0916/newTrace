import { eq, and, desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { tags, tagSensingData } from '@/lib/db/schema';
import { getSession, requireAuth, getCompanyScope, apiError, apiSuccess } from '@/lib/api-utils';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tagMac: string }> }
) {
  const session = await getSession();
  const authError = requireAuth(session);
  if (authError) return authError;

  const { tagMac } = await params;
  const companyId = getCompanyScope(session);

  const [tag] = await db
    .select()
    .from(tags)
    .where(
      session!.user.role === 'admin'
        ? eq(tags.tagMac, tagMac)
        : and(eq(tags.tagMac, tagMac), eq(tags.companyId, companyId!))
    )
    .limit(1);

  if (!tag) return apiError('태그를 찾을 수 없습니다', 404);

  const recentSensing = await db
    .select()
    .from(tagSensingData)
    .where(eq(tagSensingData.tagMac, tagMac))
    .orderBy(desc(tagSensingData.receivedTime))
    .limit(10);

  return apiSuccess({ ...tag, recentSensing });
}
