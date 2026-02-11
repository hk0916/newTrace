import { z } from 'zod';

export const createCompanySchema = z.object({
  name: z.string().min(1, '회사명을 입력해주세요').max(255),
});

export type CreateCompanyInput = z.infer<typeof createCompanySchema>;
