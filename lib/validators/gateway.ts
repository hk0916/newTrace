import { z } from 'zod';

export const createGatewaySchema = z.object({
  gwMac: z.string().regex(
    /^[0-9A-Fa-f]{2}(:[0-9A-Fa-f]{2}){5}$/,
    'MAC 주소 형식이 올바르지 않습니다 (예: AA:BB:CC:DD:EE:FF)'
  ).transform(v => v.toUpperCase()),
  gwName: z.string().min(1, '게이트웨이 이름을 입력해주세요').max(255),
  companyId: z.string().min(1, '회사를 선택해주세요'),
  location: z.string().max(255).optional(),
  description: z.string().optional(),
});

export type CreateGatewayInput = z.infer<typeof createGatewaySchema>;

export const updateGatewaySchema = z.object({
  gwName: z.string().min(1, '게이트웨이 이름을 입력해주세요').max(255),
  location: z.string().max(255).optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

export type UpdateGatewayInput = z.infer<typeof updateGatewaySchema>;
