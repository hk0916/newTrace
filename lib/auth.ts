import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { compare } from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import '@/lib/auth-types';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email as string;
        const password = credentials.password as string;

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        if (!user || !user.password) {
          return null;
        }

        const isPasswordValid = await compare(password, user.password);
        if (!isPasswordValid) {
          return null;
        }

        // 마이그레이션 임시 비밀번호로 로그인하면 비밀번호 변경 강제
        const TEMP_PASSWORD = 'Tracetag2024!';
        const mustChangePassword = password === TEMP_PASSWORD;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          companyId: user.companyId,
          role: user.role,
          locale: user.locale ?? 'ko',
          mustChangePassword,
        };
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.companyId = user.companyId;
        token.role = user.role;
        token.locale = user.locale ?? 'ko';
        token.iat = Math.floor(Date.now() / 1000); // 로그인 시점, 알림 확인용
        token.mustChangePassword = user.mustChangePassword ?? false;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id;
      session.user.companyId = token.companyId;
      session.user.role = token.role;
      session.user.locale = token.locale ?? 'ko';
      session.user.mustChangePassword = token.mustChangePassword ?? false;
      session.sessionIat = token.iat as number;
      return session;
    },
  },
});
