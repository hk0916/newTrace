import { eq, sql, gt } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import type WebSocket from 'ws';
import { db } from '../lib/db';
import { companies } from '../lib/db/schema-public';
import { getCompanyTables } from '../lib/db/schema-company';
import { createCompanySchemaInDb } from '../lib/db/company-schema-manager';
import {
  parseHeader,
  parseGwInfo,
  parseTagData,
  buildGwInfoResponse,
  isValidPacket,
} from './protocol';
import type { ClientInfo } from './types';

// 연결된 게이트웨이 추적 (MAC → WebSocket)
export const connectedGateways = new Map<string, WebSocket>();

// GW MAC → companyId 캐시 (매 패킷마다 DB 조회 방지)
const gwCompanyCache = new Map<string, string>();

// companyId → locationMode 캐시 (5분마다 리프레시)
const locationModeCache = new Map<string, { mode: string; fetchedAt: number }>();
const LOCATION_MODE_CACHE_TTL = 5 * 60 * 1000; // 5분

async function getLocationMode(companyId: string): Promise<string> {
  const cached = locationModeCache.get(companyId);
  if (cached && Date.now() - cached.fetchedAt < LOCATION_MODE_CACHE_TTL) {
    return cached.mode;
  }
  const [row] = await db
    .select({ locationMode: companies.locationMode })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);
  const mode = row?.locationMode ?? 'realtime';
  locationModeCache.set(companyId, { mode, fetchedAt: Date.now() });
  return mode;
}

/**
 * GW MAC으로 소속 companyId 조회 (캐시 우선)
 * 미등록 GW면 'unregistered' 반환
 */
async function resolveGwCompany(gwMac: string): Promise<string> {
  if (gwCompanyCache.has(gwMac)) {
    return gwCompanyCache.get(gwMac)!;
  }

  // 모든 tenant 스키마에서 해당 GW MAC 검색
  const schemas = await db.execute<{ schema_name: string }>(sql`
    SELECT schema_name FROM information_schema.schemata
    WHERE schema_name LIKE 'tenant_%'
  `);

  for (const row of schemas) {
    const companyId = row.schema_name.replace('tenant_', '');
    const { gateways } = getCompanyTables(companyId);
    const [found] = await db.select({ gwMac: gateways.gwMac }).from(gateways)
      .where(eq(gateways.gwMac, gwMac)).limit(1);
    if (found) {
      gwCompanyCache.set(gwMac, companyId);
      return companyId;
    }
  }

  gwCompanyCache.set(gwMac, 'unregistered');
  return 'unregistered';
}

/**
 * 수신 메시지 처리 메인 핸들러
 */
export async function handleMessage(
  ws: WebSocket,
  data: Buffer,
  clientInfo: ClientInfo
): Promise<void> {
  try {
    if (data.length < 2) {
      console.warn(`[WS] 패킷 너무 짧음: ${data.length} bytes from ${clientInfo.ip}:${clientInfo.port}`);
      return;
    }

    const header = parseHeader(data);

    if (!isValidPacket(header.dataType, header.direction)) {
      console.warn(`[WS] 유효하지 않은 패킷: type=0x${header.dataType.toString(16)}, dir=0x${header.direction.toString(16)}`);
      return;
    }

    const cmdNames: Record<number, string> = {
      0x01: 'GW Info Request',
      0x02: 'Set OTA URL',
      0x04: 'Set WS URL',
      0x05: 'Set Report Interval',
      0x06: 'Set RSSI Filter',
      0x07: 'CMD OTA',
    };

    switch (header.dataType) {
      case 0x08: // GW Information Response
        if (header.direction === 0x01 || header.direction === 0x03) {
          await handleGwInfo(ws, data, clientInfo);
        }
        break;

      case 0x0A: // Tag Data
        if (header.direction === 0x01 || header.direction === 0x03) {
          await handleTagData(data, clientInfo);
        }
        break;

      case 0x01:
      case 0x02:
      case 0x04:
      case 0x05:
      case 0x06:
      case 0x07: {
        const name = cmdNames[header.dataType] || `0x${header.dataType.toString(16)}`;
        const status = data.length > 4 ? data[4] : -1;
        console.log(`[WS] 명령 ACK: ${name} (status=${status}) from ${clientInfo.ip}:${clientInfo.port}`);
        break;
      }

      default:
        console.log(`[WS] 미처리 패킷 타입: 0x${header.dataType.toString(16)} from ${clientInfo.ip}:${clientInfo.port}`);
    }
  } catch (error) {
    console.error('[WS] 메시지 처리 오류:', error);
  }
}

/**
 * 0x08 - 게이트웨이 정보 처리
 * 1) GW MAC으로 소속 company 확인
 * 2) 미등록이면 unregistered 스키마에 자동 등록
 * 3) 해당 company 스키마의 gateway_status upsert
 */
async function handleGwInfo(
  ws: WebSocket,
  data: Buffer,
  clientInfo: ClientInfo
): Promise<void> {
  const gwInfo = parseGwInfo(data);
  console.log(`[WS] 게이트웨이 연결: ${gwInfo.gwMac} (${clientInfo.ip}:${clientInfo.port})`);
  console.log(`     HW: ${gwInfo.hwVersion}, FW: ${gwInfo.fwVersion}, Interval: ${gwInfo.reportInterval}s`);

  // 연결 추적 (1 GW = 1 Connection)
  const existingWs = connectedGateways.get(gwInfo.gwMac);
  if (existingWs && existingWs !== ws) {
    existingWs.close();
  }
  connectedGateways.set(gwInfo.gwMac, ws);

  // 소속 company 찾기
  const UNREGISTERED = 'unregistered';
  let companyId = await resolveGwCompany(gwInfo.gwMac);

  // 미등록 게이트웨이: unregistered 스키마에 자동 등록
  if (companyId === UNREGISTERED) {
    // unregistered 회사 public 레코드 보장
    await db.insert(companies).values({
      id: UNREGISTERED,
      name: '미등록 (최초 연결)',
    }).onConflictDoNothing();

    // unregistered tenant 스키마 생성 (없으면)
    await createCompanySchemaInDb(UNREGISTERED);

    const { gateways } = getCompanyTables(UNREGISTERED);
    await db.insert(gateways).values({
      gwMac: gwInfo.gwMac,
      gwName: `게이트웨이 ${gwInfo.gwMac}`,
    }).onConflictDoNothing();

    companyId = UNREGISTERED;
    gwCompanyCache.set(gwInfo.gwMac, UNREGISTERED);
    console.log(`[WS] 신규 게이트웨이 자동 등록 (미등록): ${gwInfo.gwMac}`);
  }

  // 해당 company 스키마의 gateway_status upsert
  const { gatewayStatus } = getCompanyTables(companyId);
  await db
    .insert(gatewayStatus)
    .values({
      gwMac: gwInfo.gwMac,
      hwVersion: gwInfo.hwVersion,
      fwVersion: gwInfo.fwVersion,
      otaServerUrl: gwInfo.otaServerUrl,
      wsServerUrl: gwInfo.wsServerUrl,
      reportInterval: gwInfo.reportInterval,
      rssiFilter: gwInfo.rssiFilter,
      ipAddress: clientInfo.ip,
      port: clientInfo.port,
      isConnected: true,
      lastConnectedAt: new Date(),
      lastUpdatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: gatewayStatus.gwMac,
      set: {
        hwVersion: gwInfo.hwVersion,
        fwVersion: gwInfo.fwVersion,
        otaServerUrl: gwInfo.otaServerUrl,
        wsServerUrl: gwInfo.wsServerUrl,
        reportInterval: gwInfo.reportInterval,
        rssiFilter: gwInfo.rssiFilter,
        ipAddress: clientInfo.ip,
        port: clientInfo.port,
        isConnected: true,
        lastConnectedAt: new Date(),
        lastUpdatedAt: new Date(),
      },
    });

  ws.send(buildGwInfoResponse());
}

/**
 * 0x0A - 태그 센싱 데이터 처리
 * GW의 company 스키마에서 태그 확인 후 센싱 데이터 저장
 * locationMode에 따라 위치 결정 분기:
 *   realtime → 즉시 assignedGwMac 변경
 *   accuracy → tagRssiBuffer에 INSERT만 (1분 주기 배치로 위치 결정)
 */
async function handleTagData(data: Buffer, clientInfo: ClientInfo): Promise<void> {
  const tagData = parseTagData(data);

  const companyId = await resolveGwCompany(tagData.gwMac);
  if (companyId === 'unregistered') return; // 미등록 GW 태그는 저장하지 않음

  const { tags, tagSensingData, tagRssiBuffer } = getCompanyTables(companyId);

  const [tag] = await db
    .select()
    .from(tags)
    .where(eq(tags.tagMac, tagData.tagMac))
    .limit(1);

  if (!tag) return; // 미등록 태그는 스킵

  // 센싱 데이터는 두 모드 모두 저장
  await db.insert(tagSensingData).values({
    id: uuid(),
    tagMac: tagData.tagMac,
    gwMac: tagData.gwMac,
    sensingTime: new Date(),
    rssi: tagData.rssi,
    temperature: tagData.temperature.toString(),
    voltage: tagData.voltage.toString(),
    rawData: tagData.rawAdvData,
  });

  const mode = await getLocationMode(companyId);

  if (mode === 'accuracy') {
    // 정확도 모드: RSSI 버퍼에 저장만 (위치 변경은 processAccuracyLocations에서)
    await db.insert(tagRssiBuffer).values({
      id: uuid(),
      tagMac: tagData.tagMac,
      gwMac: tagData.gwMac,
      rssi: tagData.rssi,
    });
  } else {
    // 실시간 모드: 즉시 assignedGwMac 변경
    if (tag.assignedGwMac !== tagData.gwMac) {
      await db
        .update(tags)
        .set({ assignedGwMac: tagData.gwMac })
        .where(eq(tags.tagMac, tagData.tagMac));
    }
  }

  console.log(
    `[WS] 태그 데이터: ${tagData.tagMac} via ${tagData.gwMac} | ` +
    `RSSI: ${tagData.rssi}, 온도: ${tagData.temperature}°C, 전압: ${tagData.voltage}V` +
    ` [${mode}]`
  );
}

/**
 * 1분 주기 — accuracy 모드 회사의 태그 위치 결정
 * tag_rssi_buffer에서 최근 10분 데이터를 기반으로
 * 태그별 게이트웨이 평균 RSSI 계산 → 가장 높은 GW로 assignedGwMac 업데이트
 *
 * 태그 보고 주기가 10초~900초로 다양하므로, 10분 윈도우를 사용하여
 * 장주기 태그도 충분한 샘플이 모이도록 함.
 * 데이터가 아직 없는 태그는 기존 assignedGwMac을 유지(건드리지 않음).
 */
export async function processAccuracyLocations(): Promise<void> {
  try {
    // accuracy 모드인 회사 목록 조회
    const accuracyCompanies = await db
      .select({ id: companies.id })
      .from(companies)
      .where(eq(companies.locationMode, 'accuracy'));

    if (accuracyCompanies.length === 0) return;

    const cutoff10m = new Date(Date.now() - 10 * 60_000);
    const cutoff30m = new Date(Date.now() - 30 * 60_000);

    for (const { id: companyId } of accuracyCompanies) {
      const schemaName = `tenant_${companyId}`;

      // 태그별·게이트웨이별 평균 RSSI 계산 (최근 10분)
      const avgResults = await db.execute<{
        tag_mac: string;
        gw_mac: string;
        avg_rssi: number;
      }>(sql`
        SELECT tag_mac, gw_mac, AVG(rssi) AS avg_rssi
        FROM ${sql.raw(`"${schemaName}"`)}.tag_rssi_buffer
        WHERE sensed_at > ${cutoff10m}
        GROUP BY tag_mac, gw_mac
      `);

      // 태그별로 가장 높은 avg_rssi 게이트웨이 찾기
      const bestGwByTag = new Map<string, { gwMac: string; avgRssi: number }>();
      for (const row of avgResults) {
        const existing = bestGwByTag.get(row.tag_mac);
        if (!existing || row.avg_rssi > existing.avgRssi) {
          bestGwByTag.set(row.tag_mac, { gwMac: row.gw_mac, avgRssi: row.avg_rssi });
        }
      }

      // assignedGwMac 업데이트 (버퍼에 데이터 없는 태그는 건드리지 않음)
      const { tags } = getCompanyTables(companyId);
      for (const [tagMac, { gwMac }] of bestGwByTag) {
        await db
          .update(tags)
          .set({ assignedGwMac: gwMac })
          .where(eq(tags.tagMac, tagMac));
      }

      if (bestGwByTag.size > 0) {
        console.log(`[WS] 정확도 위치 결정 (${companyId}): ${bestGwByTag.size}개 태그 업데이트`);
      }

      // 30분 이상 된 buffer 레코드 삭제
      await db.execute(sql`
        DELETE FROM ${sql.raw(`"${schemaName}"`)}.tag_rssi_buffer
        WHERE sensed_at < ${cutoff30m}
      `);
    }
  } catch (error) {
    console.error('[WS] 정확도 위치 결정 처리 오류:', error);
  }
}

/**
 * 게이트웨이 연결 해제 처리
 */
export async function handleDisconnect(gwMac: string, closedWs?: WebSocket): Promise<void> {
  const currentWs = connectedGateways.get(gwMac);
  if (closedWs && currentWs !== closedWs) {
    return;
  }
  connectedGateways.delete(gwMac);

  try {
    const companyId = gwCompanyCache.get(gwMac);
    if (companyId) {
      const { gatewayStatus } = getCompanyTables(companyId);
      await db
        .update(gatewayStatus)
        .set({ isConnected: false, lastUpdatedAt: new Date() })
        .where(eq(gatewayStatus.gwMac, gwMac));
    }
    console.log(`[WS] 게이트웨이 연결 해제: ${gwMac}`);
  } catch (error) {
    console.error(`[WS] 연결 해제 DB 업데이트 실패: ${gwMac}`, error);
  }
}
