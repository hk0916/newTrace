import { z } from 'zod';

export const createAssetMapSchema = z.object({
  name: z.string().min(1, '맵 이름을 입력해주세요').max(255),
});

export type CreateAssetMapInput = z.infer<typeof createAssetMapSchema>;

export const updateAssetMapSchema = z.object({
  name: z.string().min(1, '맵 이름을 입력해주세요').max(255).optional(),
  gatewayAreaColor: z.enum(['amber', 'emerald', 'rose', 'cyan', 'violet', 'lime']).optional(),
});

export type UpdateAssetMapInput = z.infer<typeof updateAssetMapSchema>;

export const upsertMapGatewaySchema = z.object({
  gwMac: z.string().regex(/^[0-9A-Fa-f]{12}$/, 'MAC 주소 형식이 올바르지 않습니다'),
  xPercent: z.number().min(0).max(100),
  yPercent: z.number().min(0).max(100),
  widthPercent: z.number().min(1).max(100),
  heightPercent: z.number().min(1).max(100),
  color: z.enum(['amber', 'emerald', 'rose', 'cyan', 'violet', 'lime']).optional(),
});

export type UpsertMapGatewayInput = z.infer<typeof upsertMapGatewaySchema>;

const GATEWAY_AREA_COLOR_IDS = ['amber', 'emerald', 'rose', 'cyan', 'violet', 'lime'] as const;

export const saveMapPlacementsSchema = z.object({
  placements: z.array(upsertMapGatewaySchema),
  gatewayAreaColor: z.enum(GATEWAY_AREA_COLOR_IDS).optional(),
});

export type SaveMapPlacementsInput = z.infer<typeof saveMapPlacementsSchema>;
