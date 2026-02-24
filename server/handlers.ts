import { eq, sql } from 'drizzle-orm';
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
 */
async function handleTagData(data: Buffer, clientInfo: ClientInfo): Promise<void> {
  const tagData = parseTagData(data);

  const companyId = await resolveGwCompany(tagData.gwMac);
  if (companyId === 'unregistered') return; // 미등록 GW 태그는 저장하지 않음

  const { tags, tagSensingData } = getCompanyTables(companyId);

  const [tag] = await db
    .select()
    .from(tags)
    .where(eq(tags.tagMac, tagData.tagMac))
    .limit(1);

  if (!tag) return; // 미등록 태그는 스킵

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

  if (tag.assignedGwMac !== tagData.gwMac) {
    await db
      .update(tags)
      .set({ assignedGwMac: tagData.gwMac })
      .where(eq(tags.tagMac, tagData.tagMac));
  }

  console.log(
    `[WS] 태그 데이터: ${tagData.tagMac} via ${tagData.gwMac} | ` +
    `RSSI: ${tagData.rssi}, 온도: ${tagData.temperature}°C, 전압: ${tagData.voltage}V`
  );
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
