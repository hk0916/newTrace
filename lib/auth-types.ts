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
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    companyId?: string | null;
    role: string;
  }
}
