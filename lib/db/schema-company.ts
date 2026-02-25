import {
  pgSchema,
  varchar,
  timestamp,
  integer,
  boolean,
  decimal,
  text,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// 회사별 격리 스키마 팩토리
// 스키마명 예: tenant_skaichips, tenant_company_b
// companyId를 기반으로 각 회사 전용 PostgreSQL 스키마를 동적 생성

export function createCompanySchema(companyId: string) {
  const schema = pgSchema(`tenant_${companyId}`);

  // 게이트웨이 마스터 (자산 등록 정보)
  const gateways = schema.table('gateways', {
    gwMac: varchar('gw_mac', { length: 12 }).primaryKey(),
    gwName: varchar('gw_name', { length: 255 }).notNull(),
    location: varchar('location', { length: 255 }),
    description: text('description'),
    isActive: boolean('is_active').default(true).notNull(),
    registeredAt: timestamp('registered_at').defaultNow().notNull(),
  });

  // 게이트웨이 상태 (실시간 WS 데이터)
  const gatewayStatus = schema.table('gateway_status', {
    gwMac: varchar('gw_mac', { length: 12 }).primaryKey(),
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

  // 태그 마스터 (자산 등록 정보)
  const tags = schema.table('tags', {
    tagMac: varchar('tag_mac', { length: 12 }).primaryKey(),
    tagName: varchar('tag_name', { length: 255 }).notNull(),
    assignedGwMac: varchar('assigned_gw_mac', { length: 12 }),
    reportInterval: integer('report_interval').notNull(),
    assetType: varchar('asset_type', { length: 100 }),
    description: text('description'),
    isActive: boolean('is_active').default(true).notNull(),
    registeredAt: timestamp('registered_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  });

  // 태그 센싱 데이터 (실시간 BLE 데이터 - 가장 큰 테이블)
  const tagSensingData = schema.table('tag_sensing_data', {
    id: varchar('id', { length: 50 }).primaryKey(),
    tagMac: varchar('tag_mac', { length: 12 }).notNull(),
    gwMac: varchar('gw_mac', { length: 12 }).notNull(),
    sensingTime: timestamp('sensing_time').notNull(),
    receivedTime: timestamp('received_time').defaultNow().notNull(),
    rssi: integer('rssi').notNull(),
    temperature: decimal('temperature', { precision: 5, scale: 2 }),
    voltage: decimal('voltage', { precision: 4, scale: 2 }),
    rawData: text('raw_data'),
  });

  // 알림 설정
  const alertSettings = schema.table('alert_settings', {
    id: varchar('id', { length: 50 }).primaryKey().default('default'),
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

  // 알림 히스토리
  const alertHistory = schema.table('alert_history', {
    id: varchar('id', { length: 50 }).primaryKey(),
    alertType: varchar('alert_type', { length: 50 }).notNull(),
    alertKey: varchar('alert_key', { length: 100 }).notNull(),
    alertName: varchar('alert_name', { length: 200 }).notNull(),
    alertMessage: text('alert_message').notNull(),
    triggeredAt: timestamp('triggered_at').notNull(),
    resolvedAt: timestamp('resolved_at'),
    acknowledgedAt: timestamp('acknowledged_at'),
    acknowledgedBy: varchar('acknowledged_by', { length: 50 }),
  });

  // 알림 확인 기록
  const alertAcknowledgments = schema.table('alert_acknowledgments', {
    id: varchar('id', { length: 50 }).primaryKey(),
    userId: varchar('user_id', { length: 50 }).notNull(),
    alertType: varchar('alert_type', { length: 50 }).notNull(),
    alertKey: varchar('alert_key', { length: 100 }).notNull(),
    sessionIat: integer('session_iat').notNull(),
    acknowledgedAt: timestamp('acknowledged_at').defaultNow().notNull(),
  });

  // 자산맵
  const assetMaps = schema.table('asset_maps', {
    id: varchar('id', { length: 50 }).primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    imagePath: varchar('image_path', { length: 512 }).notNull(),
    imageWidth: integer('image_width').notNull(),
    imageHeight: integer('image_height').notNull(),
    gatewayAreaColor: varchar('gateway_area_color', { length: 20 }).default('amber'),
    showOnDashboard: boolean('show_on_dashboard').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  });

  // 태그 RSSI 버퍼 (정확도 모드용 — 1분 주기 위치 결정)
  const tagRssiBuffer = schema.table('tag_rssi_buffer', {
    id: varchar('id', { length: 50 }).primaryKey(),
    tagMac: varchar('tag_mac', { length: 12 }).notNull(),
    gwMac: varchar('gw_mac', { length: 12 }).notNull(),
    rssi: integer('rssi').notNull(),
    sensedAt: timestamp('sensed_at').defaultNow().notNull(),
  });

  // 자산맵 게이트웨이 배치
  const assetMapGateways = schema.table('asset_map_gateways', {
    id: varchar('id', { length: 50 }).primaryKey(),
    mapId: varchar('map_id', { length: 50 }).notNull(),
    gwMac: varchar('gw_mac', { length: 12 }).notNull(),
    xPercent: decimal('x_percent', { precision: 7, scale: 4 }).notNull(),
    yPercent: decimal('y_percent', { precision: 7, scale: 4 }).notNull(),
    widthPercent: decimal('width_percent', { precision: 7, scale: 4 }).notNull().default('10'),
    heightPercent: decimal('height_percent', { precision: 7, scale: 4 }).notNull().default('8'),
    color: varchar('color', { length: 20 }).notNull().default('amber'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  });

  // Relations (스키마 내부)
  const gatewaysRelations = relations(gateways, ({ one, many }) => ({
    status: one(gatewayStatus, {
      fields: [gateways.gwMac],
      references: [gatewayStatus.gwMac],
    }),
    tags: many(tags),
    sensingData: many(tagSensingData),
    assetMapPlacements: many(assetMapGateways),
  }));

  const tagsRelations = relations(tags, ({ one, many }) => ({
    assignedGateway: one(gateways, {
      fields: [tags.assignedGwMac],
      references: [gateways.gwMac],
    }),
    sensingData: many(tagSensingData),
  }));

  const assetMapsRelations = relations(assetMaps, ({ many }) => ({
    placements: many(assetMapGateways),
  }));

  const assetMapGatewaysRelations = relations(assetMapGateways, ({ one }) => ({
    map: one(assetMaps, {
      fields: [assetMapGateways.mapId],
      references: [assetMaps.id],
    }),
    gateway: one(gateways, {
      fields: [assetMapGateways.gwMac],
      references: [gateways.gwMac],
    }),
  }));

  const gatewayStatusRelations = relations(gatewayStatus, ({ one }) => ({
    gateway: one(gateways, {
      fields: [gatewayStatus.gwMac],
      references: [gateways.gwMac],
    }),
  }));

  const tagSensingDataRelations = relations(tagSensingData, ({ one }) => ({
    tag: one(tags, {
      fields: [tagSensingData.tagMac],
      references: [tags.tagMac],
    }),
    gateway: one(gateways, {
      fields: [tagSensingData.gwMac],
      references: [gateways.gwMac],
    }),
  }));

  return {
    schema,
    gateways,
    gatewayStatus,
    tags,
    tagSensingData,
    alertSettings,
    alertHistory,
    alertAcknowledgments,
    tagRssiBuffer,
    assetMaps,
    assetMapGateways,
    // relations (drizzle 내부 등록용)
    gatewaysRelations,
    tagsRelations,
    assetMapsRelations,
    assetMapGatewaysRelations,
    gatewayStatusRelations,
    tagSensingDataRelations,
  };
}

// 타입 헬퍼 - API에서 구조분해할 때 타입 추론용
export type CompanyTables = ReturnType<typeof createCompanySchema>;

// 캐시: companyId → tables (매 요청마다 재생성 방지)
const _cache = new Map<string, CompanyTables>();

export function getCompanyTables(companyId: string): CompanyTables {
  if (!_cache.has(companyId)) {
    _cache.set(companyId, createCompanySchema(companyId));
  }
  return _cache.get(companyId)!;
}
