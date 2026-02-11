import { pgTable, varchar, timestamp, integer, boolean, decimal, text } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// 1. 회사 테이블
export const companies = pgTable('companies', {
  id: varchar('id', { length: 50 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 2. 게이트웨이 마스터 테이블 (자산 등록 정보)
export const gateways = pgTable('gateways', {
  gwMac: varchar('gw_mac', { length: 17 }).primaryKey(),
  gwName: varchar('gw_name', { length: 255 }).notNull(),
  companyId: varchar('company_id', { length: 50 }).notNull().references(() => companies.id),
  location: varchar('location', { length: 255 }),
  description: text('description'),
  isActive: boolean('is_active').default(true).notNull(),
  registeredAt: timestamp('registered_at').defaultNow().notNull(),
});

// 3. 게이트웨이 상태 테이블 (실시간 웹소켓 데이터)
export const gatewayStatus = pgTable('gateway_status', {
  gwMac: varchar('gw_mac', { length: 17 }).primaryKey().references(() => gateways.gwMac),
  hwVersion: varchar('hw_version', { length: 50 }),
  fwVersion: varchar('fw_version', { length: 50 }),
  otaServerUrl: varchar('ota_server_url', { length: 512 }),
  wsServerUrl: varchar('ws_server_url', { length: 512 }),
  reportInterval: integer('report_interval'),
  rssiFilter: integer('rssi_filter'),
  ipAddress: varchar('ip_address', { length: 45 }),
  port: integer('port'),
  isConnected: boolean('is_connected').default(false).notNull(),
  lastConnectedAt: timestamp('last_connected_at'),
  lastUpdatedAt: timestamp('last_updated_at').defaultNow().notNull(),
});

// 4. 태그 마스터 테이블 (자산 등록 정보)
export const tags = pgTable('tags', {
  tagMac: varchar('tag_mac', { length: 17 }).primaryKey(),
  tagName: varchar('tag_name', { length: 255 }).notNull(),
  companyId: varchar('company_id', { length: 50 }).notNull().references(() => companies.id),
  assignedGwMac: varchar('assigned_gw_mac', { length: 17 }).references(() => gateways.gwMac),
  reportInterval: integer('report_interval').notNull(),
  assetType: varchar('asset_type', { length: 100 }),
  description: text('description'),
  isActive: boolean('is_active').default(true).notNull(),
  registeredAt: timestamp('registered_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 5. 태그 센싱 데이터 테이블 (실시간 BLE 데이터)
export const tagSensingData = pgTable('tag_sensing_data', {
  id: varchar('id', { length: 50 }).primaryKey(),
  tagMac: varchar('tag_mac', { length: 17 }).notNull().references(() => tags.tagMac),
  gwMac: varchar('gw_mac', { length: 17 }).notNull().references(() => gateways.gwMac),
  sensingTime: timestamp('sensing_time').notNull(),
  receivedTime: timestamp('received_time').defaultNow().notNull(),
  rssi: integer('rssi').notNull(),
  temperature: decimal('temperature', { precision: 5, scale: 2 }),
  voltage: decimal('voltage', { precision: 4, scale: 2 }),
  rawData: text('raw_data'),
});

// 6. 사용자 테이블
export const users = pgTable('users', {
  id: varchar('id', { length: 50 }).primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }),
  password: varchar('password', { length: 255 }),
  companyId: varchar('company_id', { length: 50 }).references(() => companies.id),
  role: varchar('role', { length: 50 }).default('user').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 7. 회사별 알림 설정 테이블
export const alertSettings = pgTable('alert_settings', {
  companyId: varchar('company_id', { length: 50 }).primaryKey().references(() => companies.id),
  lowVoltageThreshold: decimal('low_voltage_threshold', { precision: 4, scale: 2 }).default('2.5').notNull(),
  highTempThreshold: decimal('high_temp_threshold', { precision: 5, scale: 2 }).default('40').notNull(),
  lowTempThreshold: decimal('low_temp_threshold', { precision: 5, scale: 2 }).default('0').notNull(),
  enableLowVoltageAlert: boolean('enable_low_voltage_alert').default(true).notNull(),
  enableHighTempAlert: boolean('enable_high_temp_alert').default(true).notNull(),
  enableLowTempAlert: boolean('enable_low_temp_alert').default(true).notNull(),
  tagLastUpdateHours: integer('tag_last_update_hours').default(24).notNull(),
  gwDisconnectHours: integer('gw_disconnect_hours').default(24).notNull(),
  enableTagHeartbeatAlert: boolean('enable_tag_heartbeat_alert').default(true).notNull(),
  enableGwDisconnectAlert: boolean('enable_gw_disconnect_alert').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 8. 알림 확인 기록 (같은 알림은 다음 로그인까지 울리지 않음)
export const alertAcknowledgments = pgTable('alert_acknowledgments', {
  id: varchar('id', { length: 50 }).primaryKey(),
  userId: varchar('user_id', { length: 50 }).notNull().references(() => users.id),
  companyId: varchar('company_id', { length: 50 }).notNull().references(() => companies.id),
  alertType: varchar('alert_type', { length: 50 }).notNull(), // 'tag_stale' | 'gw_disconnected'
  alertKey: varchar('alert_key', { length: 100 }).notNull(), // tagMac 또는 gwMac
  sessionIat: integer('session_iat').notNull(), // JWT iat (로그인 시점) - 이 세션에서만 유효
  acknowledgedAt: timestamp('acknowledged_at').defaultNow().notNull(),
});

// Relations
export const companiesRelations = relations(companies, ({ one, many }) => ({
  gateways: many(gateways),
  tags: many(tags),
  users: many(users),
  alertSettings: one(alertSettings),
  alertAcknowledgments: many(alertAcknowledgments),
}));

export const alertSettingsRelations = relations(alertSettings, ({ one }) => ({
  company: one(companies, {
    fields: [alertSettings.companyId],
    references: [companies.id],
  }),
}));

export const alertAcknowledgmentsRelations = relations(alertAcknowledgments, ({ one }) => ({
  user: one(users, {
    fields: [alertAcknowledgments.userId],
    references: [users.id],
  }),
  company: one(companies, {
    fields: [alertAcknowledgments.companyId],
    references: [companies.id],
  }),
}));

export const gatewaysRelations = relations(gateways, ({ one, many }) => ({
  company: one(companies, {
    fields: [gateways.companyId],
    references: [companies.id],
  }),
  status: one(gatewayStatus, {
    fields: [gateways.gwMac],
    references: [gatewayStatus.gwMac],
  }),
  tags: many(tags),
  sensingData: many(tagSensingData),
}));

export const tagsRelations = relations(tags, ({ one, many }) => ({
  company: one(companies, {
    fields: [tags.companyId],
    references: [companies.id],
  }),
  assignedGateway: one(gateways, {
    fields: [tags.assignedGwMac],
    references: [gateways.gwMac],
  }),
  sensingData: many(tagSensingData),
}));
