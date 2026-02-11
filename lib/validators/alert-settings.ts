import { z } from 'zod';

export const alertSettingsSchema = z.object({
  companyId: z.string().min(1, '회사를 선택해주세요'),
  lowVoltageThreshold: z.coerce.number().min(1.5).max(3.5),
  highTempThreshold: z.coerce.number().min(-20).max(100),
  lowTempThreshold: z.coerce.number().min(-50).max(50),
  enableLowVoltageAlert: z.boolean(),
  enableHighTempAlert: z.boolean(),
  enableLowTempAlert: z.boolean(),
  tagLastUpdateHours: z.coerce.number().int().min(1).max(720).default(24),
  gwDisconnectHours: z.coerce.number().int().min(1).max(720).default(24),
  enableTagHeartbeatAlert: z.boolean().default(true),
  enableGwDisconnectAlert: z.boolean().default(true),
});

export type AlertSettingsInput = z.infer<typeof alertSettingsSchema>;
