import { sql } from 'drizzle-orm';
import { db } from './index';

// 회사별 PostgreSQL 스키마를 생성하고 테이블을 초기화합니다.
// 스키마명: tenant_{companyId}

export async function createCompanySchemaInDb(companyId: string): Promise<void> {
  const schemaName = `tenant_${companyId}`;

  await db.execute(sql`CREATE SCHEMA IF NOT EXISTS ${sql.raw(`"${schemaName}"`)}`);

  // 게이트웨이 마스터
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ${sql.raw(`"${schemaName}"`)}.gateways (
      gw_mac      VARCHAR(12)  PRIMARY KEY,
      gw_name     VARCHAR(255) NOT NULL,
      location    VARCHAR(255),
      description TEXT,
      is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
      registered_at TIMESTAMP  NOT NULL DEFAULT NOW()
    )
  `);

  // 게이트웨이 상태
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ${sql.raw(`"${schemaName}"`)}.gateway_status (
      gw_mac             VARCHAR(12)  PRIMARY KEY REFERENCES ${sql.raw(`"${schemaName}"`)}.gateways(gw_mac) ON DELETE CASCADE,
      hw_version         VARCHAR(50),
      fw_version         VARCHAR(50),
      ota_server_url     VARCHAR(512),
      ws_server_url      VARCHAR(512),
      report_interval    INTEGER,
      rssi_filter        INTEGER,
      ip_address         VARCHAR(45),
      port               INTEGER,
      is_connected       BOOLEAN      NOT NULL DEFAULT FALSE,
      last_connected_at  TIMESTAMP,
      last_updated_at    TIMESTAMP    NOT NULL DEFAULT NOW()
    )
  `);

  // 태그 마스터
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ${sql.raw(`"${schemaName}"`)}.tags (
      tag_mac          VARCHAR(12)  PRIMARY KEY,
      tag_name         VARCHAR(255) NOT NULL,
      assigned_gw_mac  VARCHAR(12)  REFERENCES ${sql.raw(`"${schemaName}"`)}.gateways(gw_mac) ON DELETE SET NULL,
      report_interval  INTEGER      NOT NULL,
      asset_type       VARCHAR(100),
      description      TEXT,
      is_active        BOOLEAN      NOT NULL DEFAULT TRUE,
      registered_at    TIMESTAMP    NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMP    NOT NULL DEFAULT NOW()
    )
  `);

  // 태그 센싱 데이터 (가장 큰 테이블 — 시간 파티션 고려 가능)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ${sql.raw(`"${schemaName}"`)}.tag_sensing_data (
      id            VARCHAR(50)  PRIMARY KEY,
      tag_mac       VARCHAR(12)  NOT NULL,
      gw_mac        VARCHAR(12)  NOT NULL,
      sensing_time  TIMESTAMP    NOT NULL,
      received_time TIMESTAMP    NOT NULL DEFAULT NOW(),
      rssi          INTEGER      NOT NULL,
      temperature   DECIMAL(5,2),
      voltage       DECIMAL(4,2),
      raw_data      TEXT
    )
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_tag_sensing_tag_mac
      ON ${sql.raw(`"${schemaName}"`)}.tag_sensing_data (tag_mac, sensing_time DESC)
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_tag_sensing_gw_mac
      ON ${sql.raw(`"${schemaName}"`)}.tag_sensing_data (gw_mac, sensing_time DESC)
  `);

  // 알림 설정 (회사당 1행)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ${sql.raw(`"${schemaName}"`)}.alert_settings (
      id                        VARCHAR(50)    PRIMARY KEY DEFAULT 'default',
      low_voltage_threshold     DECIMAL(4,2)   NOT NULL DEFAULT 2.5,
      high_temp_threshold       DECIMAL(5,2)   NOT NULL DEFAULT 40,
      low_temp_threshold        DECIMAL(5,2)   NOT NULL DEFAULT 0,
      enable_low_voltage_alert  BOOLEAN        NOT NULL DEFAULT TRUE,
      enable_high_temp_alert    BOOLEAN        NOT NULL DEFAULT TRUE,
      enable_low_temp_alert     BOOLEAN        NOT NULL DEFAULT TRUE,
      tag_last_update_hours     INTEGER        NOT NULL DEFAULT 24,
      gw_disconnect_hours       INTEGER        NOT NULL DEFAULT 24,
      enable_tag_heartbeat_alert BOOLEAN       NOT NULL DEFAULT TRUE,
      enable_gw_disconnect_alert BOOLEAN       NOT NULL DEFAULT TRUE,
      created_at                TIMESTAMP      NOT NULL DEFAULT NOW(),
      updated_at                TIMESTAMP      NOT NULL DEFAULT NOW()
    )
  `);

  // 기본 알림 설정 행 삽입
  await db.execute(sql`
    INSERT INTO ${sql.raw(`"${schemaName}"`)}.alert_settings (id)
    VALUES ('default')
    ON CONFLICT (id) DO NOTHING
  `);

  // 알림 히스토리
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ${sql.raw(`"${schemaName}"`)}.alert_history (
      id               VARCHAR(50)  PRIMARY KEY,
      alert_type       VARCHAR(50)  NOT NULL,
      alert_key        VARCHAR(100) NOT NULL,
      alert_name       VARCHAR(200) NOT NULL,
      alert_message    TEXT         NOT NULL,
      triggered_at     TIMESTAMP    NOT NULL,
      resolved_at      TIMESTAMP,
      acknowledged_at  TIMESTAMP,
      acknowledged_by  VARCHAR(50)
    )
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_alert_history_type_key
      ON ${sql.raw(`"${schemaName}"`)}.alert_history (alert_type, alert_key, triggered_at DESC)
  `);

  // 알림 확인 기록
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ${sql.raw(`"${schemaName}"`)}.alert_acknowledgments (
      id               VARCHAR(50)  PRIMARY KEY,
      user_id          VARCHAR(50)  NOT NULL,
      alert_type       VARCHAR(50)  NOT NULL,
      alert_key        VARCHAR(100) NOT NULL,
      session_iat      INTEGER      NOT NULL,
      acknowledged_at  TIMESTAMP    NOT NULL DEFAULT NOW()
    )
  `);

  // 자산맵
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ${sql.raw(`"${schemaName}"`)}.asset_maps (
      id                  VARCHAR(50)  PRIMARY KEY,
      name                VARCHAR(255) NOT NULL,
      image_path          VARCHAR(512) NOT NULL,
      image_width         INTEGER      NOT NULL,
      image_height        INTEGER      NOT NULL,
      gateway_area_color  VARCHAR(20)  DEFAULT 'amber',
      show_on_dashboard   BOOLEAN      NOT NULL DEFAULT FALSE,
      created_at          TIMESTAMP    NOT NULL DEFAULT NOW(),
      updated_at          TIMESTAMP    NOT NULL DEFAULT NOW()
    )
  `);

  // 자산맵 게이트웨이 배치
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ${sql.raw(`"${schemaName}"`)}.asset_map_gateways (
      id              VARCHAR(50)     PRIMARY KEY,
      map_id          VARCHAR(50)     NOT NULL REFERENCES ${sql.raw(`"${schemaName}"`)}.asset_maps(id) ON DELETE CASCADE,
      gw_mac          VARCHAR(12)     NOT NULL,
      x_percent       DECIMAL(7,4)    NOT NULL,
      y_percent       DECIMAL(7,4)    NOT NULL,
      width_percent   DECIMAL(7,4)    NOT NULL DEFAULT 10,
      height_percent  DECIMAL(7,4)    NOT NULL DEFAULT 8,
      color           VARCHAR(20)     NOT NULL DEFAULT 'amber',
      created_at      TIMESTAMP       NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMP       NOT NULL DEFAULT NOW()
    )
  `);

  console.log(`[schema-manager] Created schema: ${schemaName}`);
}

export async function dropCompanySchemaFromDb(companyId: string): Promise<void> {
  const schemaName = `tenant_${companyId}`;
  await db.execute(sql`DROP SCHEMA IF EXISTS ${sql.raw(`"${schemaName}"`)} CASCADE`);
  console.log(`[schema-manager] Dropped schema: ${schemaName}`);
}

// 현재 DB에 존재하는 tenant_ 스키마 목록 조회
export async function listCompanySchemas(): Promise<string[]> {
  const rows = await db.execute<{ schema_name: string }>(sql`
    SELECT schema_name
    FROM information_schema.schemata
    WHERE schema_name LIKE 'tenant_%'
    ORDER BY schema_name
  `);
  return rows.map((r) => r.schema_name.replace('tenant_', ''));
}
