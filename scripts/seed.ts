import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { hash } from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import { eq } from 'drizzle-orm';

async function seed() {
  const { db } = await import('../lib/db');
  const { companies, gateways, tags, users } = await import('../lib/db/schema');
  console.log('시드 데이터 생성 시작...');

  // 1. 회사 생성
  const companyId = 'skaichips';
  await db.insert(companies).values({
    id: companyId,
    name: 'SKAI Chips',
  }).onConflictDoNothing();
  console.log('회사 생성 완료: SKAI Chips');

  // 슈퍼 관리자용 시스템 회사 (companyId FK용)
  await db.insert(companies).values({
    id: 'super',
    name: '슈퍼 관리자 (시스템)',
  }).onConflictDoNothing();
  console.log('회사 생성 완료: super (시스템)');

  // 미등록 게이트웨이용 회사 (자동 등록 시에만 사용)
  await db.insert(companies).values({
    id: 'unregistered',
    name: '미등록 (최초 연결)',
  }).onConflictDoNothing();
  console.log('회사 생성 완료: 미등록 (최초 연결)');

  // 2. 슈퍼 관리자 유저 생성 (companyId = super)
  const superPassword = await hash('eric2789', 12);
  await db.insert(users).values({
    id: uuid(),
    email: 'super@tracetag.com',
    name: '슈퍼 관리자',
    password: superPassword,
    companyId: 'super',
    role: 'super',
  }).onConflictDoNothing();
  // 기존 super 유저가 있으면 companyId 업데이트
  await db.update(users).set({ companyId: 'super' }).where(eq(users.email, 'super@tracetag.com'));
  console.log('슈퍼 관리자 생성 완료: super@tracetag.com / eric2789');

  // 3. 회사 관리자 유저 생성
  const adminPassword = await hash('admin123', 12);
  await db.insert(users).values({
    id: uuid(),
    email: 'admin@skaichips.com',
    name: '관리자',
    password: adminPassword,
    companyId,
    role: 'admin',
  }).onConflictDoNothing();
  console.log('관리자 생성 완료: admin@skaichips.com / admin123');

  // 4. 일반 유저 생성
  const userPassword = await hash('user1234', 12);
  await db.insert(users).values({
    id: uuid(),
    email: 'user@skaichips.com',
    name: '일반 사용자',
    password: userPassword,
    companyId,
    role: 'user',
  }).onConflictDoNothing();
  console.log('사용자 생성 완료: user@skaichips.com / user1234');

  // 5. 샘플 게이트웨이 등록
  const sampleGateways = [
    { gwMac: 'AABBCCDDEE01', gwName: '7층 게이트웨이 01', location: '7층 간호사실' },
    { gwMac: 'AABBCCDDEE02', gwName: '7층 게이트웨이 02', location: '7층 복도' },
    { gwMac: 'AABBCCDDEE03', gwName: '8층 게이트웨이 01', location: '8층 간호사실' },
  ];

  for (const gw of sampleGateways) {
    await db.insert(gateways).values({
      ...gw,
      companyId,
    }).onConflictDoNothing();
  }
  console.log(`게이트웨이 ${sampleGateways.length}개 등록 완료`);

  // 6. 샘플 태그 등록
  const sampleTags = [
    { tagMac: '112233445501', tagName: '수액펌프 001', assetType: '의료장비', assignedGwMac: 'AABBCCDDEE01' },
    { tagMac: '112233445502', tagName: '수액펌프 002', assetType: '의료장비', assignedGwMac: 'AABBCCDDEE01' },
    { tagMac: '112233445503', tagName: '산소포화도 측정기 001', assetType: '의료장비', assignedGwMac: 'AABBCCDDEE02' },
    { tagMac: '112233445504', tagName: '휠체어 001', assetType: '비품', assignedGwMac: 'AABBCCDDEE03' },
    { tagMac: '112233445505', tagName: '심전도 모니터 001', assetType: '의료장비', assignedGwMac: 'AABBCCDDEE03' },
  ];

  for (const tag of sampleTags) {
    await db.insert(tags).values({
      ...tag,
      companyId,
      reportInterval: 60,
    }).onConflictDoNothing();
  }
  console.log(`태그 ${sampleTags.length}개 등록 완료`);

  console.log('\n시드 데이터 생성 완료!');
  console.log('---');
  console.log('로그인 정보:');
  console.log('  슈퍼: super@tracetag.com / eric2789');
  console.log('  관리자: admin@skaichips.com / admin123');
  console.log('  사용자: user@skaichips.com / user1234');

  process.exit(0);
}

seed().catch((error) => {
  console.error('시드 실패:', error);
  process.exit(1);
});
