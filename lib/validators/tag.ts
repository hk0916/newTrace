import { z } from 'zod';

export const createTagSchema = z.object({
  tagMac: z.string().regex(
    /^[0-9A-Fa-f]{2}(:[0-9A-Fa-f]{2}){5}$/,
    'MAC 주소 형식이 올바르지 않습니다 (예: AA:BB:CC:DD:EE:FF)'
  ).transform(v => v.toUpperCase()),
  tagName: z.string().min(1, '태그 이름을 입력해주세요').max(255),
  companyId: z.string().min(1, '회사를 선택해주세요'),
  assignedGwMac: z.string().optional(),
  reportInterval: z.number().int().positive('보고 주기는 양수여야 합니다'),
  assetType: z.string().max(100).optional(),
  description: z.string().optional(),
});

export type CreateTagInput = z.infer<typeof createTagSchema>;

export const updateTagSchema = z.object({
  tagName: z.string().min(1, '태그 이름을 입력해주세요').max(255),
  assignedGwMac: z.union([z.string().max(17), z.null()]).optional(),
  reportInterval: z.number().int().positive('보고 주기는 양수여야 합니다'),
  assetType: z.string().max(100).optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

export type UpdateTagInput = z.infer<typeof updateTagSchema>;
