import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface User {
    companyId?: string | null;
    role: string;
  }
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      companyId?: string | null;
      role: string;
    };
    sessionIat?: number; // JWT iat (로그인 시점) - 알림 확인 시 세션 구분용
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    companyId?: string | null;
    role: string;
    iat?: number;
  }
}
