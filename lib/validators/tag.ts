import { z } from 'zod';

/** MAC: 12자리 hex (콜론/하이픈 있어도 자동 제거) */
const macField = z.string()
  .transform(v => v.replace(/[:\-]/g, '').toUpperCase())
  .pipe(z.string().regex(
    /^[0-9A-F]{12}$/,
    'MAC 주소 형식이 올바르지 않습니다 (예: AABBCCDDEEFF)'
  ));

export const createTagSchema = z.object({
  tagMac: macField,
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
  assignedGwMac: z.union([z.string().max(12), z.null()]).optional(),
  reportInterval: z.number().int().positive('보고 주기는 양수여야 합니다'),
  assetType: z.string().max(100).optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

export type UpdateTagInput = z.infer<typeof updateTagSchema>;
