/**
 * MariaDB → PostgreSQL 마이그레이션 스크립트
 *
 * 소스 테이블:
 *   - gw_recent_web  → gateways + companies
 *   - ws_gw_recent   → gateway_status
 *   - tag_web_info   → tags
 *
 * 사용법 (서버에서):
 *   OLD_DB_HOST=127.0.0.1 OLD_DB_PORT=3306 OLD_DB_USER=dev_admin \
 *   OLD_DB_PASSWORD='Dev@sys2024!!' OLD_DB_NAME=test \
 *   DATABASE_URL=postgresql://tracetag_user:xxx@localhost:5433/tracetag_prod \
 *   npx tsx scripts/migrate-from-mariadb.ts
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import mysql from 'mysql2/promise';
import { db } from '../lib/db';
import { companies, gateways, gatewayStatus, tags } from '../lib/db/schema';

const OLD_DB_HOST     = process.env.OLD_DB_HOST     || '127.0.0.1';
const OLD_DB_PORT     = parseInt(process.env.OLD_DB_PORT || '3306');
const OLD_DB_USER     = process.env.OLD_DB_USER     || 'dev_admin';
const OLD_DB_PASSWORD = process.env.OLD_DB_PASSWORD || '';
const OLD_DB_NAME     = process.env.OLD_DB_NAME     || 'test';

// MAC 주소 정규화 및 검증 (12자리 대문자 hex)
function normalizeMac(mac: string | null | undefined): string | null {
  if (!mac) return null;
  const cleaned = mac.replace(/[:\-\s]/g, '').toUpperCase();
  if (!/^[0-9A-F]{12}$/.test(cleaned)) return null;
  if (cleaned === '000000000000') return null;
  return cleaned;
}

// company 값 정규화 (NULL → unregistered)
function normalizeCompany(company: string | null | undefined): string {
  if (!company || company.trim() === '') return 'unregistered';
  return company.trim();
}

async function migrateCompanies(pool: mysql.Pool): Promise<Set<string>> {
  console.log('\n=== 1단계: 회사 마이그레이션 ===');

  const [rows] = await pool.query(`
    SELECT DISTINCT company FROM gw_recent_web
    UNION
    SELECT DISTINCT company FROM tag_web_info
  `) as [Record<string, unknown>[], mysql.FieldPacket[]];

  const companySet = new Set<string>();

  for (const row of rows) {
    const companyId = normalizeCompany(row['company'] as string);
    companySet.add(companyId);

    await db.insert(companies).values({
      id: companyId,
      name: companyId,
    }).onConflictDoNothing();
    console.log(`  [회사] ${companyId}`);
  }

  console.log(`회사 마이그레이션 완료: ${companySet.size}개`);
  return companySet;
}

async function migrateGateways(pool: mysql.Pool): Promise<number> {
  console.log('\n=== 2단계: 게이트웨이 마이그레이션 (gw_recent_web) ===');

  const [rows] = await pool.query(`
    SELECT gw_mac, devicename, devicelocation, company, active
    FROM gw_recent_web
  `) as [Record<string, unknown>[], mysql.FieldPacket[]];

  let inserted = 0;
  let skipped = 0;

  for (const row of rows) {
    const mac = normalizeMac(row['gw_mac'] as string);
    if (!mac) {
      console.warn(`  [SKIP] 잘못된 MAC: ${row['gw_mac']}`);
      skipped++;
      continue;
    }

    const companyId = normalizeCompany(row['company'] as string);
    const name = (row['devicename'] as string) || mac;
    const location = (row['devicelocation'] as string) || null;
    const isActive = (row['active'] as number) === 1;

    // 혹시 1단계에서 누락된 company가 있으면 자동 생성
    await db.insert(companies).values({ id: companyId, name: companyId }).onConflictDoNothing();

    await db.insert(gateways).values({
      gwMac: mac,
      gwName: name,
      companyId,
      location,
      isActive,
    }).onConflictDoNothing();

    inserted++;
  }

  console.log(`게이트웨이 마이그레이션 완료: ${inserted}개 삽입, ${skipped}개 스킵`);
  return inserted;
}

async function migrateGatewayStatus(pool: mysql.Pool): Promise<number> {
  console.log('\n=== 3단계: 게이트웨이 상태 마이그레이션 (ws_gw_recent) ===');

  const [rows] = await pool.query(`
    SELECT gw_mac, hw_version, fw_version, ota_server_url, ws_server_url,
           report_interval, rssi_filter, ip, port, connect, last_updated
    FROM ws_gw_recent
  `) as [Record<string, unknown>[], mysql.FieldPacket[]];

  let inserted = 0;
  let skipped = 0;

  for (const row of rows) {
    const mac = normalizeMac(row['gw_mac'] as string);
    if (!mac) {
      skipped++;
      continue;
    }

    // gateways 테이블에 없으면 스킵 (FK 제약)
    const isConnected = (row['connect'] as string) === 'connect';
    const portVal = row['port'] ? parseInt(row['port'] as string) : null;

    try {
      await db.insert(gatewayStatus).values({
        gwMac: mac,
        hwVersion: (row['hw_version'] as string) || null,
        fwVersion: (row['fw_version'] as string) || null,
        otaServerUrl: (row['ota_server_url'] as string) || null,
        wsServerUrl: (row['ws_server_url'] as string) || null,
        reportInterval: (row['report_interval'] as number) || null,
        rssiFilter: (row['rssi_filter'] as number) || null,
        ipAddress: (row['ip'] as string) || null,
        port: portVal,
        isConnected,
        lastConnectedAt: isConnected ? new Date() : null,
      }).onConflictDoNothing();
      inserted++;
    } catch {
      // gateways에 없는 MAC → 스킵
      skipped++;
    }
  }

  console.log(`게이트웨이 상태 마이그레이션 완료: ${inserted}개 삽입, ${skipped}개 스킵`);
  return inserted;
}

async function migrateTags(pool: mysql.Pool): Promise<number> {
  console.log('\n=== 4단계: 태그 마이그레이션 (tag_web_info) ===');

  const [rows] = await pool.query(`
    SELECT tag_mac, devicename, gw_mac_parent, devicetype,
           taglocation, company, active
    FROM tag_web_info
    WHERE tag_mac IS NOT NULL
      AND LENGTH(REPLACE(tag_mac, ':', '')) = 12
  `) as [Record<string, unknown>[], mysql.FieldPacket[]];

  let inserted = 0;
  let skipped = 0;

  for (const row of rows) {
    const mac = normalizeMac(row['tag_mac'] as string);
    if (!mac) {
      skipped++;
      continue;
    }

    const assignedGwMac = normalizeMac(row['gw_mac_parent'] as string);
    const companyId = normalizeCompany(row['company'] as string);
    const name = (row['devicename'] as string) || mac;
    const assetType = (row['devicetype'] as string) || null;
    const isActive = (row['active'] as number) === 1;

    // 혹시 누락된 company가 있으면 자동 생성
    await db.insert(companies).values({ id: companyId, name: companyId }).onConflictDoNothing();

    await db.insert(tags).values({
      tagMac: mac,
      tagName: name,
      companyId,
      assignedGwMac: assignedGwMac || null,
      reportInterval: 60,
      assetType,
      isActive,
    }).onConflictDoNothing();

    inserted++;
  }

  console.log(`태그 마이그레이션 완료: ${inserted}개 삽입, ${skipped}개 스킵`);
  return inserted;
}

async function main(): Promise<void> {
  // SOCKET_PATH 환경변수가 있으면 소켓 연결 (로컬 root 접속 시)
  const socketPath = process.env.SOCKET_PATH;
  const pool = mysql.createPool({
    ...(socketPath
      ? { socketPath }
      : { host: OLD_DB_HOST, port: OLD_DB_PORT }),
    user: OLD_DB_USER,
    password: OLD_DB_PASSWORD,
    database: OLD_DB_NAME,
    waitForConnections: true,
    connectionLimit: 5,
  });

  console.log(`MariaDB: ${OLD_DB_USER}@${OLD_DB_HOST}:${OLD_DB_PORT}/${OLD_DB_NAME}`);

  await migrateCompanies(pool);
  await migrateGateways(pool);
  await migrateGatewayStatus(pool);
  await migrateTags(pool);

  console.log('\n✓ 전체 마이그레이션 완료');
  await pool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error('마이그레이션 실패:', err);
  process.exit(1);
});
