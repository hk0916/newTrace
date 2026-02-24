/**
 * migrate-to-company-schema.ts
 *
 * 기존 public 스키마의 데이터를 각 회사별 tenant 스키마로 이전합니다.
 * 한 번만 실행하면 됩니다. 재실행 시 중복 데이터는 무시됩니다.
 *
 * 실행: npx tsx scripts/migrate-to-company-schema.ts
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { sql, eq } from 'drizzle-orm';

async function migrate() {
  const { db } = await import('../lib/db');
  const { getCompanyTables } = await import('../lib/db/schema-company');
  const { createCompanySchemaInDb } = await import('../lib/db/company-schema-manager');

  console.log('=== 멀티테넌트 스키마 마이그레이션 시작 ===\n');

  // 1. 기존 public 스키마에서 회사 목록 조회
  const companiesRaw = await db.execute<{ id: string; name: string }>(sql`
    SELECT id, name FROM public.companies
  `);
  console.log(`발견된 회사: ${companiesRaw.map(c => c.id).join(', ')}`);

  for (const company of companiesRaw) {
    const companyId = company.id;
    console.log(`\n--- [${companyId}] 마이그레이션 시작 ---`);

    // 2. tenant 스키마 생성
    await createCompanySchemaInDb(companyId);

    const tables = getCompanyTables(companyId);

    // 3. gateways 마이그레이션
    const oldGateways = await db.execute<{
      gw_mac: string; gw_name: string; location: string | null;
      description: string | null; is_active: boolean; registered_at: Date;
    }>(sql`
      SELECT gw_mac, gw_name, location, description, is_active, registered_at
      FROM public.gateways
      WHERE company_id = ${companyId}
    `);

    for (const gw of oldGateways) {
      await db.insert(tables.gateways).values({
        gwMac: gw.gw_mac,
        gwName: gw.gw_name,
        location: gw.location ?? undefined,
        description: gw.description ?? undefined,
        isActive: gw.is_active,
        registeredAt: gw.registered_at,
      }).onConflictDoNothing();
    }
    console.log(`  gateways: ${oldGateways.length}개 이전 완료`);

    // 4. gateway_status 마이그레이션
    const gwMacs = oldGateways.map(g => g.gw_mac);
    if (gwMacs.length > 0) {
      const oldGwStatus = await db.execute<{
        gw_mac: string; hw_version: string | null; fw_version: string | null;
        ota_server_url: string | null; ws_server_url: string | null;
        report_interval: number | null; rssi_filter: number | null;
        ip_address: string | null; port: number | null; is_connected: boolean;
        last_connected_at: Date | null; last_updated_at: Date;
      }>(sql`
        SELECT * FROM public.gateway_status
        WHERE gw_mac = ANY(${gwMacs})
      `);

      for (const gs of oldGwStatus) {
        await db.insert(tables.gatewayStatus).values({
          gwMac: gs.gw_mac,
          hwVersion: gs.hw_version ?? undefined,
          fwVersion: gs.fw_version ?? undefined,
          otaServerUrl: gs.ota_server_url ?? undefined,
          wsServerUrl: gs.ws_server_url ?? undefined,
          reportInterval: gs.report_interval ?? undefined,
          rssiFilter: gs.rssi_filter ?? undefined,
          ipAddress: gs.ip_address ?? undefined,
          port: gs.port ?? undefined,
          isConnected: false, // 재시작 후 재연결 필요
          lastConnectedAt: gs.last_connected_at ?? undefined,
          lastUpdatedAt: gs.last_updated_at,
        }).onConflictDoNothing();
      }
      console.log(`  gateway_status: ${oldGwStatus.length}개 이전 완료`);
    }

    // 5. tags 마이그레이션
    const oldTags = await db.execute<{
      tag_mac: string; tag_name: string; assigned_gw_mac: string | null;
      report_interval: number; asset_type: string | null; description: string | null;
      is_active: boolean; registered_at: Date; updated_at: Date;
    }>(sql`
      SELECT tag_mac, tag_name, assigned_gw_mac, report_interval, asset_type,
             description, is_active, registered_at, updated_at
      FROM public.tags
      WHERE company_id = ${companyId}
    `);

    for (const tag of oldTags) {
      await db.insert(tables.tags).values({
        tagMac: tag.tag_mac,
        tagName: tag.tag_name,
        assignedGwMac: tag.assigned_gw_mac ?? undefined,
        reportInterval: tag.report_interval,
        assetType: tag.asset_type ?? undefined,
        description: tag.description ?? undefined,
        isActive: tag.is_active,
        registeredAt: tag.registered_at,
        updatedAt: tag.updated_at,
      }).onConflictDoNothing();
    }
    console.log(`  tags: ${oldTags.length}개 이전 완료`);

    // 6. tag_sensing_data 마이그레이션 (배치 처리)
    const tagMacs = oldTags.map(t => t.tag_mac);
    if (tagMacs.length > 0) {
      let offset = 0;
      const BATCH = 1000;
      let totalSensing = 0;
      while (true) {
        const rows = await db.execute<{
          id: string; tag_mac: string; gw_mac: string; sensing_time: Date;
          received_time: Date; rssi: number; temperature: string | null;
          voltage: string | null; raw_data: string | null;
        }>(sql`
          SELECT id, tag_mac, gw_mac, sensing_time, received_time, rssi,
                 temperature::text, voltage::text, raw_data
          FROM public.tag_sensing_data
          WHERE tag_mac = ANY(${tagMacs})
          ORDER BY sensing_time
          LIMIT ${BATCH} OFFSET ${offset}
        `);
        if (rows.length === 0) break;
        for (const row of rows) {
          await db.insert(tables.tagSensingData).values({
            id: row.id,
            tagMac: row.tag_mac,
            gwMac: row.gw_mac,
            sensingTime: row.sensing_time,
            receivedTime: row.received_time,
            rssi: row.rssi,
            temperature: row.temperature ?? undefined,
            voltage: row.voltage ?? undefined,
            rawData: row.raw_data ?? undefined,
          }).onConflictDoNothing();
        }
        totalSensing += rows.length;
        offset += BATCH;
        process.stdout.write(`\r  tag_sensing_data: ${totalSensing}개 처리 중...`);
      }
      console.log(`\n  tag_sensing_data: ${totalSensing}개 이전 완료`);
    }

    // 7. alert_settings 마이그레이션
    const [oldAlertSettings] = await db.execute<{
      low_voltage_threshold: string; high_temp_threshold: string;
      low_temp_threshold: string; enable_low_voltage_alert: boolean;
      enable_high_temp_alert: boolean; enable_low_temp_alert: boolean;
      tag_last_update_hours: number; gw_disconnect_hours: number;
      enable_tag_heartbeat_alert: boolean; enable_gw_disconnect_alert: boolean;
    }>(sql`
      SELECT * FROM public.alert_settings WHERE company_id = ${companyId}
    `);

    if (oldAlertSettings) {
      await db.insert(tables.alertSettings).values({
        id: 'default',
        lowVoltageThreshold: oldAlertSettings.low_voltage_threshold,
        highTempThreshold: oldAlertSettings.high_temp_threshold,
        lowTempThreshold: oldAlertSettings.low_temp_threshold,
        enableLowVoltageAlert: oldAlertSettings.enable_low_voltage_alert,
        enableHighTempAlert: oldAlertSettings.enable_high_temp_alert,
        enableLowTempAlert: oldAlertSettings.enable_low_temp_alert,
        tagLastUpdateHours: oldAlertSettings.tag_last_update_hours,
        gwDisconnectHours: oldAlertSettings.gw_disconnect_hours,
        enableTagHeartbeatAlert: oldAlertSettings.enable_tag_heartbeat_alert,
        enableGwDisconnectAlert: oldAlertSettings.enable_gw_disconnect_alert,
      }).onConflictDoNothing();
      console.log(`  alert_settings: 이전 완료`);
    }

    // 8. alert_history 마이그레이션
    const oldAlertHistory = await db.execute<{
      id: string; alert_type: string; alert_key: string; alert_name: string;
      alert_message: string; triggered_at: Date; resolved_at: Date | null;
      acknowledged_at: Date | null; acknowledged_by: string | null;
    }>(sql`
      SELECT id, alert_type, alert_key, alert_name, alert_message,
             triggered_at, resolved_at, acknowledged_at, acknowledged_by
      FROM public.alert_history WHERE company_id = ${companyId}
    `);

    for (const ah of oldAlertHistory) {
      await db.insert(tables.alertHistory).values({
        id: ah.id,
        alertType: ah.alert_type,
        alertKey: ah.alert_key,
        alertName: ah.alert_name,
        alertMessage: ah.alert_message,
        triggeredAt: ah.triggered_at,
        resolvedAt: ah.resolved_at ?? undefined,
        acknowledgedAt: ah.acknowledged_at ?? undefined,
        acknowledgedBy: ah.acknowledged_by ?? undefined,
      }).onConflictDoNothing();
    }
    console.log(`  alert_history: ${oldAlertHistory.length}개 이전 완료`);

    // 9. alert_acknowledgments 마이그레이션
    const oldAcks = await db.execute<{
      id: string; user_id: string; alert_type: string;
      alert_key: string; session_iat: number; acknowledged_at: Date;
    }>(sql`
      SELECT id, user_id, alert_type, alert_key, session_iat, acknowledged_at
      FROM public.alert_acknowledgments WHERE company_id = ${companyId}
    `);

    for (const ack of oldAcks) {
      await db.insert(tables.alertAcknowledgments).values({
        id: ack.id,
        userId: ack.user_id,
        alertType: ack.alert_type,
        alertKey: ack.alert_key,
        sessionIat: ack.session_iat,
        acknowledgedAt: ack.acknowledged_at,
      }).onConflictDoNothing();
    }
    console.log(`  alert_acknowledgments: ${oldAcks.length}개 이전 완료`);

    // 10. asset_maps 마이그레이션
    const oldMaps = await db.execute<{
      id: string; name: string; image_path: string; image_width: number;
      image_height: number; gateway_area_color: string | null;
      show_on_dashboard: boolean; created_at: Date; updated_at: Date;
    }>(sql`
      SELECT id, name, image_path, image_width, image_height,
             gateway_area_color, show_on_dashboard, created_at, updated_at
      FROM public.asset_maps WHERE company_id = ${companyId}
    `);

    for (const am of oldMaps) {
      await db.insert(tables.assetMaps).values({
        id: am.id,
        name: am.name,
        imagePath: am.image_path,
        imageWidth: am.image_width,
        imageHeight: am.image_height,
        gatewayAreaColor: am.gateway_area_color ?? 'amber',
        showOnDashboard: am.show_on_dashboard,
        createdAt: am.created_at,
        updatedAt: am.updated_at,
      }).onConflictDoNothing();
    }
    console.log(`  asset_maps: ${oldMaps.length}개 이전 완료`);

    // 11. asset_map_gateways 마이그레이션
    const mapIds = oldMaps.map(m => m.id);
    if (mapIds.length > 0) {
      const oldPlacements = await db.execute<{
        id: string; map_id: string; gw_mac: string; x_percent: string;
        y_percent: string; width_percent: string; height_percent: string;
        color: string; created_at: Date; updated_at: Date;
      }>(sql`
        SELECT id, map_id, gw_mac, x_percent::text, y_percent::text,
               width_percent::text, height_percent::text, color, created_at, updated_at
        FROM public.asset_map_gateways
        WHERE map_id = ANY(${mapIds})
      `);

      for (const p of oldPlacements) {
        await db.insert(tables.assetMapGateways).values({
          id: p.id,
          mapId: p.map_id,
          gwMac: p.gw_mac,
          xPercent: p.x_percent,
          yPercent: p.y_percent,
          widthPercent: p.width_percent,
          heightPercent: p.height_percent,
          color: p.color,
          createdAt: p.created_at,
          updatedAt: p.updated_at,
        }).onConflictDoNothing();
      }
      console.log(`  asset_map_gateways: ${oldPlacements.length}개 이전 완료`);
    }

    console.log(`--- [${companyId}] 마이그레이션 완료 ---`);
  }

  console.log('\n=== 전체 마이그레이션 완료 ===');
  console.log('기존 public 스키마 테이블은 삭제하지 않았습니다.');
  console.log('검증 후 수동으로 DROP TABLE public.gateways 등 정리하세요.');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('마이그레이션 실패:', err);
  process.exit(1);
});
