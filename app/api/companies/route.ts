import { NextRequest } from 'next/server';
import { v4 as uuid } from 'uuid';
import { db } from '@/lib/db';
import { companies } from '@/lib/db/schema';
import { createCompanySchema } from '@/lib/validators/company';
import { getSession, requireAdmin, apiError, apiSuccess } from '@/lib/api-utils';

export async function GET() {
  const session = await getSession();
  if (!session?.user) return apiError('인증이 필요합니다', 401);

  if (session.user.role === 'admin') {
    const result = await db.select().from(companies);
    return apiSuccess(result);
  }

  if (session.user.companyId) {
    const { eq } = await import('drizzle-orm');
    const result = await db
      .select()
      .from(companies)
      .where(eq(companies.id, session.user.companyId));
    return apiSuccess(result);
  }

  return apiSuccess([]);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  const adminError = requireAdmin(session);
  if (adminError) return adminError;

  const body = await req.json();
  const parsed = createCompanySchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0].message, 400);
  }

  const newCompany = {
    id: uuid(),
    name: parsed.data.name,
  };

  await db.insert(companies).values(newCompany);
  return apiSuccess(newCompany, 201);
}
