import { z } from 'zod';

/** MAC: 12자리 hex (콜론/하이픈 있어도 자동 제거) 또는 "all" */
const gwMacField = z.union([
  z.string()
    .transform(v => v.replace(/[:\-]/g, '').toUpperCase())
    .pipe(z.string().regex(/^[0-9A-F]{12}$/, 'MAC 주소 형식이 올바르지 않습니다')),
  z.literal('all'),
]);

const requestInfoSchema = z.object({
  command: z.literal('request-info'),
  gwMac: gwMacField,
});

const setOtaUrlSchema = z.object({
  command: z.literal('set-ota-url'),
  gwMac: gwMacField,
  payload: z.object({ url: z.string().min(1, 'URL을 입력해주세요').max(255) }),
});

const setWsUrlSchema = z.object({
  command: z.literal('set-ws-url'),
  gwMac: gwMacField,
  payload: z.object({ url: z.string().min(1, 'URL을 입력해주세요').max(255) }),
});

const setReportIntervalSchema = z.object({
  command: z.literal('set-report-interval'),
  gwMac: gwMacField,
  payload: z.object({
    seconds: z.number().int().min(1, '최소 1초').max(86400, '최대 86400초 (24시간)'),
  }),
});

const setRssiFilterSchema = z.object({
  command: z.literal('set-rssi-filter'),
  gwMac: gwMacField,
  payload: z.object({
    value: z.number().int().min(-100, '최소 -100').max(-10, '최대 -10'),
  }),
});

const cmdOtaSchema = z.object({
  command: z.literal('cmd-ota'),
  gwMac: gwMacField,
  payload: z.object({ url: z.string().min(1, 'OTA URL을 입력해주세요').max(255) }),
});

export const gatewayCommandSchema = z.discriminatedUnion('command', [
  requestInfoSchema,
  setOtaUrlSchema,
  setWsUrlSchema,
  setReportIntervalSchema,
  setRssiFilterSchema,
  cmdOtaSchema,
]);

export type GatewayCommandInput = z.infer<typeof gatewayCommandSchema>;
