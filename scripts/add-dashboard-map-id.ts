/**
 * companies 테이블에 dashboard_map_id 컬럼 추가
 * drizzle migrate가 기존 DB와 충돌할 때 이 스크립트로 수동 실행
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import postgres from 'postgres';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL이 설정되지 않았습니다.');
    process.exit(1);
  }

  const sql = postgres(url);
  try {
    await sql.unsafe(`
      ALTER TABLE "companies"
      ADD COLUMN IF NOT EXISTS "dashboard_map_id" varchar(50);
    `);
    console.log('✓ dashboard_map_id 컬럼 추가 완료');
  } catch (e) {
    console.error('마이그레이션 실패:', e);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
