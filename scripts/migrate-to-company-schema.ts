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

import { sql } from 'drizzle-orm';

async function migrate() {
  const { db } = await import('../lib/db');
  const { createCompanySchemaInDb } = await import('../lib/db/company-schema-manager');

  console.log('=== 멀티테넌트 스키마 마이그레이션 시작 ===\n');

  // 기존 public 스키마에서 회사 목록 조회
  const companies = await db.execute<{ id: string; name: string }>(sql`
    SELECT id, name FROM public.companies ORDER BY id
  `);
  console.log(`발견된 회사: ${companies.map((c) => c.id).join(', ')}\n`);

  for (const company of companies) {
    const cid = company.id;
    const s = `tenant_${cid}`;
    console.log(`--- [${cid}] 마이그레이션 시작 ---`);

    // tenant 스키마 생성 (없으면)
    await createCompanySchemaInDb(cid);

    // ── gateways ──────────────────────────────────────────────
    await db.execute(sql`
      INSERT INTO ${sql.raw(`"${s}"`)}.gateways
        (gw_mac, gw_name, location, description, is_active, registered_at)
      SELECT gw_mac, gw_name, location, description, is_active, registered_at
      FROM public.gateways
      WHERE company_id = ${cid}
      ON CONFLICT (gw_mac) DO NOTHING
    `);
    const [{ cnt: gwCnt }] = await db.execute<{ cnt: string }>(sql`
      SELECT COUNT(*)::text AS cnt FROM public.gateways WHERE company_id = ${cid}
    `);
    console.log(`  gateways: ${gwCnt}개 이전 완료`);

    // ── gateway_status ────────────────────────────────────────
    await db.execute(sql`
      INSERT INTO ${sql.raw(`"${s}"`)}.gateway_status
        (gw_mac, hw_version, fw_version, ota_server_url, ws_server_url,
         report_interval, rssi_filter, ip_address, port,
         is_connected, last_connected_at, last_updated_at)
      SELECT gs.gw_mac, gs.hw_version, gs.fw_version, gs.ota_server_url, gs.ws_server_url,
             gs.report_interval, gs.rssi_filter, gs.ip_address, gs.port,
             FALSE, gs.last_connected_at, gs.last_updated_at
      FROM public.gateway_status gs
      INNER JOIN public.gateways gw ON gs.gw_mac = gw.gw_mac
      WHERE gw.company_id = ${cid}
      ON CONFLICT (gw_mac) DO NOTHING
    `);
    const [{ cnt: gsCnt }] = await db.execute<{ cnt: string }>(sql`
      SELECT COUNT(*)::text AS cnt
      FROM public.gateway_status gs
      INNER JOIN public.gateways gw ON gs.gw_mac = gw.gw_mac
      WHERE gw.company_id = ${cid}
    `);
    console.log(`  gateway_status: ${gsCnt}개 이전 완료`);

    // ── tags ──────────────────────────────────────────────────
    await db.execute(sql`
      INSERT INTO ${sql.raw(`"${s}"`)}.tags
        (tag_mac, tag_name, assigned_gw_mac, report_interval,
         asset_type, description, is_active, registered_at, updated_at)
      SELECT tag_mac, tag_name, assigned_gw_mac, report_interval,
             asset_type, description, is_active, registered_at, updated_at
      FROM public.tags
      WHERE company_id = ${cid}
      ON CONFLICT (tag_mac) DO NOTHING
    `);
    const [{ cnt: tagCnt }] = await db.execute<{ cnt: string }>(sql`
      SELECT COUNT(*)::text AS cnt FROM public.tags WHERE company_id = ${cid}
    `);
    console.log(`  tags: ${tagCnt}개 이전 완료`);

    // ── tag_sensing_data (배치 INSERT...SELECT) ───────────────
    const BATCH = 5000;
    let offset = 0;
    let totalSensing = 0;
    while (true) {
      const [{ cnt: batchCnt }] = await db.execute<{ cnt: string }>(sql`
        WITH inserted AS (
          INSERT INTO ${sql.raw(`"${s}"`)}.tag_sensing_data
            (id, tag_mac, gw_mac, sensing_time, received_time,
             rssi, temperature, voltage, raw_data)
          SELECT tsd.id, tsd.tag_mac, tsd.gw_mac, tsd.sensing_time, tsd.received_time,
                 tsd.rssi, tsd.temperature, tsd.voltage, tsd.raw_data
          FROM public.tag_sensing_data tsd
          INNER JOIN public.tags t ON tsd.tag_mac = t.tag_mac
          WHERE t.company_id = ${cid}
          ORDER BY tsd.sensing_time
          LIMIT ${BATCH} OFFSET ${offset}
          ON CONFLICT (id) DO NOTHING
          RETURNING id
        )
        SELECT COUNT(*)::text AS cnt FROM inserted
      `);
      const n = parseInt(batchCnt, 10);
      totalSensing += n;
      offset += BATCH;
      process.stdout.write(`\r  tag_sensing_data: ${totalSensing}개 처리 중...`);
      if (n < BATCH) break;
    }
    console.log(`\n  tag_sensing_data: ${totalSensing}개 이전 완료`);

    // ── alert_settings ────────────────────────────────────────
    await db.execute(sql`
      INSERT INTO ${sql.raw(`"${s}"`)}.alert_settings
        (id, low_voltage_threshold, high_temp_threshold, low_temp_threshold,
         enable_low_voltage_alert, enable_high_temp_alert, enable_low_temp_alert,
         tag_last_update_hours, gw_disconnect_hours,
         enable_tag_heartbeat_alert, enable_gw_disconnect_alert,
         created_at, updated_at)
      SELECT 'default', low_voltage_threshold, high_temp_threshold, low_temp_threshold,
             enable_low_voltage_alert, enable_high_temp_alert, enable_low_temp_alert,
             tag_last_update_hours, gw_disconnect_hours,
             enable_tag_heartbeat_alert, enable_gw_disconnect_alert,
             created_at, updated_at
      FROM public.alert_settings
      WHERE company_id = ${cid}
      ON CONFLICT (id) DO NOTHING
    `);
    console.log(`  alert_settings: 이전 완료`);

    // ── alert_history ─────────────────────────────────────────
    await db.execute(sql`
      INSERT INTO ${sql.raw(`"${s}"`)}.alert_history
        (id, alert_type, alert_key, alert_name, alert_message,
         triggered_at, resolved_at, acknowledged_at, acknowledged_by)
      SELECT id, alert_type, alert_key, alert_name, alert_message,
             triggered_at, resolved_at, acknowledged_at, acknowledged_by
      FROM public.alert_history
      WHERE company_id = ${cid}
      ON CONFLICT (id) DO NOTHING
    `);
    const [{ cnt: ahCnt }] = await db.execute<{ cnt: string }>(sql`
      SELECT COUNT(*)::text AS cnt FROM public.alert_history WHERE company_id = ${cid}
    `);
    console.log(`  alert_history: ${ahCnt}개 이전 완료`);

    // ── alert_acknowledgments ─────────────────────────────────
    await db.execute(sql`
      INSERT INTO ${sql.raw(`"${s}"`)}.alert_acknowledgments
        (id, user_id, alert_type, alert_key, session_iat, acknowledged_at)
      SELECT id, user_id, alert_type, alert_key, session_iat, acknowledged_at
      FROM public.alert_acknowledgments
      WHERE company_id = ${cid}
      ON CONFLICT (id) DO NOTHING
    `);
    const [{ cnt: aaCnt }] = await db.execute<{ cnt: string }>(sql`
      SELECT COUNT(*)::text AS cnt FROM public.alert_acknowledgments WHERE company_id = ${cid}
    `);
    console.log(`  alert_acknowledgments: ${aaCnt}개 이전 완료`);

    // ── asset_maps ────────────────────────────────────────────
    await db.execute(sql`
      INSERT INTO ${sql.raw(`"${s}"`)}.asset_maps
        (id, name, image_path, image_width, image_height,
         gateway_area_color, show_on_dashboard, created_at, updated_at)
      SELECT id, name, image_path, image_width, image_height,
             gateway_area_color, show_on_dashboard, created_at, updated_at
      FROM public.asset_maps
      WHERE company_id = ${cid}
      ON CONFLICT (id) DO NOTHING
    `);
    const [{ cnt: amCnt }] = await db.execute<{ cnt: string }>(sql`
      SELECT COUNT(*)::text AS cnt FROM public.asset_maps WHERE company_id = ${cid}
    `);
    console.log(`  asset_maps: ${amCnt}개 이전 완료`);

    // ── asset_map_gateways ────────────────────────────────────
    // color 컬럼이 없는 구버전 스키마 대응 (migration 0007 미적용 가능)
    const [colorColRow] = await db.execute<{ exists: boolean }>(sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'asset_map_gateways' AND column_name = 'color'
      ) AS exists
    `);
    const hasColorCol = colorColRow.exists;

    await db.execute(sql.raw(`
      INSERT INTO "${s}".asset_map_gateways
        (id, map_id, gw_mac, x_percent, y_percent,
         width_percent, height_percent, color, created_at, updated_at)
      SELECT amg.id, amg.map_id, amg.gw_mac, amg.x_percent, amg.y_percent,
             amg.width_percent, amg.height_percent,
             ${hasColorCol ? 'amg.color' : "'amber'"},
             amg.created_at, amg.updated_at
      FROM public.asset_map_gateways amg
      INNER JOIN public.asset_maps am ON amg.map_id = am.id
      WHERE am.company_id = '${cid}'
      ON CONFLICT (id) DO NOTHING
    `));
    const [{ cnt: amgCnt }] = await db.execute<{ cnt: string }>(sql`
      SELECT COUNT(*)::text AS cnt
      FROM public.asset_map_gateways amg
      INNER JOIN public.asset_maps am ON amg.map_id = am.id
      WHERE am.company_id = ${cid}
    `);
    console.log(`  asset_map_gateways: ${amgCnt}개 이전 완료`);

    console.log(`--- [${cid}] 마이그레이션 완료 ---\n`);
  }

  console.log('=== 전체 마이그레이션 완료 ===');
  console.log('기존 public 스키마 테이블은 유지됩니다.');
  console.log('검증 완료 후 아래 명령으로 정리하세요:');
  console.log('  DROP TABLE public.tag_sensing_data, public.asset_map_gateways,');
  console.log('             public.asset_maps, public.alert_acknowledgments,');
  console.log('             public.alert_history, public.alert_settings,');
  console.log('             public.gateway_status, public.tags, public.gateways CASCADE;');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('마이그레이션 실패:', err);
  process.exit(1);
});
