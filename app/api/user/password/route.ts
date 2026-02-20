import { NextRequest } from 'next/server';
import { getSession, requireAuth, apiError, apiSuccess } from '@/lib/api-utils';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { compare, hash } from 'bcryptjs';

export async function PUT(req: NextRequest) {
  const session = await getSession();
  const authError = requireAuth(session);
  if (authError) return authError;

  const body = await req.json();
  const { currentPassword, newPassword } = body;

  if (!currentPassword || !newPassword) {
    return apiError('현재 비밀번호와 새 비밀번호를 입력해주세요', 400);
  }
  if (typeof newPassword !== 'string' || newPassword.length < 6) {
    return apiError('새 비밀번호는 6자 이상이어야 합니다', 400);
  }

  const userId = session!.user.id;
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user || !user.password) {
    return apiError('사용자를 찾을 수 없습니다', 404);
  }

  const isValid = await compare(currentPassword, user.password);
  if (!isValid) {
    return apiError('현재 비밀번호가 올바르지 않습니다', 400);
  }

  const newHash = await hash(newPassword, 12);
  await db.update(users).set({ password: newHash }).where(eq(users.id, userId));

  return apiSuccess({ success: true });
}
