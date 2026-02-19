import { pgTable, varchar, timestamp, integer, boolean, decimal, text } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// 1. 회사 테이블
export const companies = pgTable('companies', {
  id: varchar('id', { length: 50 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  dashboardMapId: varchar('dashboard_map_id', { length: 50 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 2. 게이트웨이 마스터 테이블 (자산 등록 정보)
export const gateways = pgTable('gateways', {
  gwMac: varchar('gw_mac', { length: 12 }).primaryKey(),
  gwName: varchar('gw_name', { length: 255 }).notNull(),
  companyId: varchar('company_id', { length: 50 }).notNull().references(() => companies.id),
  location: varchar('location', { length: 255 }),
  description: text('description'),
  isActive: boolean('is_active').default(true).notNull(),
  registeredAt: timestamp('registered_at').defaultNow().notNull(),
});

// 3. 게이트웨이 상태 테이블 (실시간 웹소켓 데이터)
export const gatewayStatus = pgTable('gateway_status', {
  gwMac: varchar('gw_mac', { length: 12 }).primaryKey().references(() => gateways.gwMac),
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
  tagMac: varchar('tag_mac', { length: 12 }).primaryKey(),
  tagName: varchar('tag_name', { length: 255 }).notNull(),
  companyId: varchar('company_id', { length: 50 }).notNull().references(() => companies.id),
  assignedGwMac: varchar('assigned_gw_mac', { length: 12 }).references(() => gateways.gwMac),
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
  tagMac: varchar('tag_mac', { length: 12 }).notNull().references(() => tags.tagMac),
  gwMac: varchar('gw_mac', { length: 12 }).notNull().references(() => gateways.gwMac),
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
  locale: varchar('locale', { length: 10 }).default('ko').notNull(),
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

// 8. 자산맵 테이블
export const assetMaps = pgTable('asset_maps', {
  id: varchar('id', { length: 50 }).primaryKey(),
  companyId: varchar('company_id', { length: 50 }).notNull().references(() => companies.id),
  name: varchar('name', { length: 255 }).notNull(),
  imagePath: varchar('image_path', { length: 512 }).notNull(),
  imageWidth: integer('image_width').notNull(),
  imageHeight: integer('image_height').notNull(),
  gatewayAreaColor: varchar('gateway_area_color', { length: 20 }).default('amber'),
  showOnDashboard: boolean('show_on_dashboard').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 9. 자산맵 게이트웨이 배치 테이블
export const assetMapGateways = pgTable('asset_map_gateways', {
  id: varchar('id', { length: 50 }).primaryKey(),
  mapId: varchar('map_id', { length: 50 }).notNull().references(() => assetMaps.id, { onDelete: 'cascade' }),
  gwMac: varchar('gw_mac', { length: 12 }).notNull().references(() => gateways.gwMac, { onDelete: 'cascade' }),
  xPercent: decimal('x_percent', { precision: 7, scale: 4 }).notNull(),
  yPercent: decimal('y_percent', { precision: 7, scale: 4 }).notNull(),
  widthPercent: decimal('width_percent', { precision: 7, scale: 4 }).notNull().default('10'),
  heightPercent: decimal('height_percent', { precision: 7, scale: 4 }).notNull().default('8'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// users relations (companies.users 역방향)
export const usersRelations = relations(users, ({ one }) => ({
  company: one(companies, {
    fields: [users.companyId],
    references: [companies.id],
  }),
}));

// 10. 알림 히스토리 테이블 (알림 발생/해소 이력)
export const alertHistory = pgTable('alert_history', {
  id: varchar('id', { length: 50 }).primaryKey(),
  companyId: varchar('company_id', { length: 50 }).notNull().references(() => companies.id),
  alertType: varchar('alert_type', { length: 50 }).notNull(), // 'tag_stale' | 'gw_disconnected'
  alertKey: varchar('alert_key', { length: 100 }).notNull(),  // tagMac or gwMac
  alertName: varchar('alert_name', { length: 200 }).notNull(),
  alertMessage: text('alert_message').notNull(),
  triggeredAt: timestamp('triggered_at').notNull(),           // 알림 최초 발생 시각
  resolvedAt: timestamp('resolved_at'),                       // 조건 해소 시각 (null = 진행중)
  acknowledgedAt: timestamp('acknowledged_at'),               // 사용자 확인 시각 (null = 미확인)
  acknowledgedBy: varchar('acknowledged_by', { length: 50 }).references(() => users.id),
});

// 11. 알림 확인 기록 (같은 알림은 다음 로그인까지 울리지 않음)
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
  alertHistory: many(alertHistory),
  assetMaps: many(assetMaps),
}));

export const alertHistoryRelations = relations(alertHistory, ({ one }) => ({
  company: one(companies, {
    fields: [alertHistory.companyId],
    references: [companies.id],
  }),
  acknowledger: one(users, {
    fields: [alertHistory.acknowledgedBy],
    references: [users.id],
  }),
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
  assetMapPlacements: many(assetMapGateways),
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

export const assetMapsRelations = relations(assetMaps, ({ one, many }) => ({
  company: one(companies, {
    fields: [assetMaps.companyId],
    references: [companies.id],
  }),
  placements: many(assetMapGateways),
}));

export const assetMapGatewaysRelations = relations(assetMapGateways, ({ one }) => ({
  map: one(assetMaps, {
    fields: [assetMapGateways.mapId],
    references: [assetMaps.id],
  }),
  gateway: one(gateways, {
    fields: [assetMapGateways.gwMac],
    references: [gateways.gwMac],
  }),
}));

export const gatewayStatusRelations = relations(gatewayStatus, ({ one }) => ({
  gateway: one(gateways, {
    fields: [gatewayStatus.gwMac],
    references: [gateways.gwMac],
  }),
}));

export const tagSensingDataRelations = relations(tagSensingData, ({ one }) => ({
  tag: one(tags, {
    fields: [tagSensingData.tagMac],
    references: [tags.tagMac],
  }),
  gateway: one(gateways, {
    fields: [tagSensingData.gwMac],
    references: [gateways.gwMac],
  }),
}));
