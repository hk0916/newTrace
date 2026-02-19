/**
 * MariaDB → PostgreSQL 마이그레이션 스크립트
 *
 * 사용법:
 *   OLD_DB_HOST=localhost OLD_DB_USER=root OLD_DB_PASSWORD=xxx OLD_DB_NAME=tracetag_db \
 *     npx tsx scripts/migrate-from-mariadb.ts
 *
 * 실행 전 반드시 기존 MariaDB 스키마 확인:
 *   SHOW CREATE TABLE gateways;
 *   SHOW CREATE TABLE tags;
 * 그 후 아래 COLUMN MAP 주석을 기준으로 컬럼명 조정
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import mysql from 'mysql2/promise';
import { db } from '../lib/db';
import { gateways, tags } from '../lib/db/schema';

// ─── 환경변수 ────────────────────────────────────────────────
const OLD_DB_HOST     = process.env.OLD_DB_HOST     || 'localhost';
const OLD_DB_PORT     = parseInt(process.env.OLD_DB_PORT || '3306');
const OLD_DB_USER     = process.env.OLD_DB_USER     || 'root';
const OLD_DB_PASSWORD = process.env.OLD_DB_PASSWORD || '';
const OLD_DB_NAME     = process.env.OLD_DB_NAME     || 'tracetag_db';

// ─── 대상 회사 ID (새 DB에 이미 존재해야 함) ─────────────────
const TARGET_COMPANY_ID = process.env.TARGET_COMPANY_ID || 'skaichips';

// MAC 주소 정규화: "AA:BB:CC:DD:EE:FF" → "AABBCCDDEEFF" (대문자 12자리)
function normalizeMac(mac: string | null | undefined): string | null {
  if (!mac) return null;
  const cleaned = mac.replace(/[:\-\s]/g, '').toUpperCase();
  if (cleaned.length !== 12) return null;
  return cleaned;
}

// ─── 기존 DB 행 타입 (실제 컬럼명 확인 후 수정) ──────────────
interface OldGateway {
  // ↓ 아래 컬럼명을 기존 MariaDB SHOW CREATE TABLE 결과에 맞게 수정하세요
  mac?: string;          // MAC 주소
  gw_mac?: string;       // 또는 이 컬럼명
  name?: string;         // 게이트웨이 이름
  gw_name?: string;
  location?: string;     // 설치 위치
  description?: string;
  is_active?: number | boolean;
}

interface OldTag {
  // ↓ 아래 컬럼명을 기존 MariaDB SHOW CREATE TABLE 결과에 맞게 수정하세요
  mac?: string;
  tag_mac?: string;
  name?: string;
  tag_name?: string;
  gateway_mac?: string;   // 연결된 게이트웨이 MAC
  assigned_gw_mac?: string;
  report_interval?: number;
  asset_type?: string;
  description?: string;
  is_active?: number | boolean;
}

// ─── 헬퍼: 여러 후보 컬럼 중 실제 값 추출 ────────────────────
function pick<T>(row: Record<string, unknown>, ...keys: string[]): T | null {
  for (const key of keys) {
    if (key in row && row[key] != null) return row[key] as T;
  }
  return null;
}

async function migrateGateways(pool: mysql.Pool): Promise<number> {
  // ↓ 실제 테이블명이 다르면 여기서 수정
  const [rows] = await pool.query('SELECT * FROM gateways') as [Record<string, unknown>[], mysql.FieldPacket[]];
  const oldGateways = rows as OldGateway[];

  let inserted = 0;
  let skipped = 0;

  for (const row of oldGateways) {
    const rawMac = pick<string>(row as Record<string, unknown>, 'mac', 'gw_mac', 'gateway_mac', 'GW_MAC');
    const mac = normalizeMac(rawMac);
    if (!mac) {
      console.warn(`  [SKIP] 게이트웨이 MAC 파싱 실패: ${JSON.stringify(rawMac)}`);
      skipped++;
      continue;
    }

    const name = pick<string>(row as Record<string, unknown>, 'name', 'gw_name', 'gateway_name', 'GW_NAME') ?? mac;
    const location = pick<string>(row as Record<string, unknown>, 'location', 'install_location', 'place');
    const description = pick<string>(row as Record<string, unknown>, 'description', 'memo', 'remark');
    const rawActive = pick<number | boolean>(row as Record<string, unknown>, 'is_active', 'active', 'enabled');
    const isActive = rawActive == null ? true : Boolean(rawActive);

    await db.insert(gateways).values({
      gwMac: mac,
      gwName: name,
      companyId: TARGET_COMPANY_ID,
      location: location ?? null,
      description: description ?? null,
      isActive,
    }).onConflictDoNothing();

    inserted++;
    console.log(`  [GW] ${mac} "${name}" 삽입`);
  }

  console.log(`게이트웨이 마이그레이션 완료: ${inserted}개 삽입, ${skipped}개 스킵`);
  return inserted;
}

async function migrateTags(pool: mysql.Pool): Promise<number> {
  // ↓ 실제 테이블명이 다르면 여기서 수정
  const [rows] = await pool.query('SELECT * FROM tags') as [Record<string, unknown>[], mysql.FieldPacket[]];
  const oldTags = rows as OldTag[];

  let inserted = 0;
  let skipped = 0;

  for (const row of oldTags) {
    const rawMac = pick<string>(row as Record<string, unknown>, 'mac', 'tag_mac', 'TAG_MAC');
    const mac = normalizeMac(rawMac);
    if (!mac) {
      console.warn(`  [SKIP] 태그 MAC 파싱 실패: ${JSON.stringify(rawMac)}`);
      skipped++;
      continue;
    }

    const name = pick<string>(row as Record<string, unknown>, 'name', 'tag_name', 'asset_name', 'TAG_NAME') ?? mac;
    const rawGwMac = pick<string>(row as Record<string, unknown>, 'gateway_mac', 'assigned_gw_mac', 'gw_mac', 'GW_MAC');
    const assignedGwMac = normalizeMac(rawGwMac);
    const reportInterval = pick<number>(row as Record<string, unknown>, 'report_interval', 'interval', 'period') ?? 60;
    const assetType = pick<string>(row as Record<string, unknown>, 'asset_type', 'type', 'category');
    const description = pick<string>(row as Record<string, unknown>, 'description', 'memo', 'remark');
    const rawActive = pick<number | boolean>(row as Record<string, unknown>, 'is_active', 'active', 'enabled');
    const isActive = rawActive == null ? true : Boolean(rawActive);

    await db.insert(tags).values({
      tagMac: mac,
      tagName: name,
      companyId: TARGET_COMPANY_ID,
      assignedGwMac: assignedGwMac ?? null,
      reportInterval,
      assetType: assetType ?? null,
      description: description ?? null,
      isActive,
    }).onConflictDoNothing();

    inserted++;
    console.log(`  [TAG] ${mac} "${name}" 삽입`);
  }

  console.log(`태그 마이그레이션 완료: ${inserted}개 삽입, ${skipped}개 스킵`);
  return inserted;
}

async function showOldSchema(pool: mysql.Pool): Promise<void> {
  console.log('\n──────────────────────────────────────────');
  console.log('기존 DB 테이블 목록:');
  const [tables] = await pool.query('SHOW TABLES') as [Record<string, unknown>[], mysql.FieldPacket[]];
  for (const t of tables) {
    const tableName = Object.values(t)[0];
    console.log(`  - ${tableName}`);
  }

  // gateways 테이블 스키마 출력
  try {
    const [gwSchema] = await pool.query('SHOW CREATE TABLE gateways') as [Record<string, unknown>[], mysql.FieldPacket[]];
    console.log('\ngateways 테이블 DDL:');
    console.log(Object.values(gwSchema[0])[1]);
  } catch {
    console.log('gateways 테이블 없음 또는 접근 불가');
  }

  // tags 테이블 스키마 출력
  try {
    const [tagSchema] = await pool.query('SHOW CREATE TABLE tags') as [Record<string, unknown>[], mysql.FieldPacket[]];
    console.log('\ntags 테이블 DDL:');
    console.log(Object.values(tagSchema[0])[1]);
  } catch {
    console.log('tags 테이블 없음 또는 접근 불가');
  }
  console.log('──────────────────────────────────────────\n');
}

async function main(): Promise<void> {
  const pool = mysql.createPool({
    host: OLD_DB_HOST,
    port: OLD_DB_PORT,
    user: OLD_DB_USER,
    password: OLD_DB_PASSWORD,
    database: OLD_DB_NAME,
    waitForConnections: true,
    connectionLimit: 5,
  });

  console.log(`\nMariaDB 연결: ${OLD_DB_USER}@${OLD_DB_HOST}:${OLD_DB_PORT}/${OLD_DB_NAME}`);
  console.log(`대상 회사 ID: ${TARGET_COMPANY_ID}\n`);

  // --schema-only 옵션: 마이그레이션 없이 기존 스키마만 출력
  if (process.argv.includes('--schema-only')) {
    await showOldSchema(pool);
    await pool.end();
    process.exit(0);
  }

  // 기존 스키마 먼저 출력
  await showOldSchema(pool);

  console.log('=== 게이트웨이 마이그레이션 시작 ===');
  const gwCount = await migrateGateways(pool);

  console.log('\n=== 태그 마이그레이션 시작 ===');
  const tagCount = await migrateTags(pool);

  console.log(`\n✓ 마이그레이션 완료: 게이트웨이 ${gwCount}개, 태그 ${tagCount}개`);

  await pool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error('마이그레이션 실패:', err);
  process.exit(1);
});
