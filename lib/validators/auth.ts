import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('유효한 이메일을 입력해주세요'),
  password: z.string().min(6, '비밀번호는 6자 이상이어야 합니다'),
});

export const registerSchema = z.object({
  email: z.string().email('유효한 이메일을 입력해주세요'),
  name: z.string().min(1, '이름을 입력해주세요'),
  password: z.string().min(6, '비밀번호는 6자 이상이어야 합니다'),
  companyId: z.string().min(1, '회사를 선택해주세요'),
  role: z.enum(['admin', 'user']).default('user'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
