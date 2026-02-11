import { eq } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import type WebSocket from 'ws';
import { db } from '../lib/db';
import { companies, gatewayStatus, gateways, tags, tagSensingData } from '../lib/db/schema';
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

      default:
        console.log(`[WS] 미처리 패킷 타입: 0x${header.dataType.toString(16)} from ${clientInfo.ip}:${clientInfo.port}`);
    }
  } catch (error) {
    console.error('[WS] 메시지 처리 오류:', error);
  }
}

/**
 * 0x08 - 게이트웨이 정보 처리
 * 게이트웨이 상태 DB에 upsert하고 연결 추적에 등록
 */
async function handleGwInfo(
  ws: WebSocket,
  data: Buffer,
  clientInfo: ClientInfo
): Promise<void> {
  const gwInfo = parseGwInfo(data);
  console.log(`[WS] 게이트웨이 연결: ${gwInfo.gwMac} (${clientInfo.ip}:${clientInfo.port})`);
  console.log(`     HW: ${gwInfo.hwVersion}, FW: ${gwInfo.fwVersion}, Interval: ${gwInfo.reportInterval}s`);

  // 연결 추적 등록 (기존 연결이 있으면 종료 → 1 Gw = 1 Connection)
  const existingWs = connectedGateways.get(gwInfo.gwMac);
  if (existingWs && existingWs !== ws) {
    existingWs.close();
  }
  connectedGateways.set(gwInfo.gwMac, ws);

  // gateway_status는 gateways FK 필요 → 미등록 게이트웨이면 gateways에 먼저 등록 (미등록 회사로만)
  const UNREGISTERED_COMPANY_ID = 'unregistered';
  await db.insert(companies).values({
    id: UNREGISTERED_COMPANY_ID,
    name: '미등록 (최초 연결)',
  }).onConflictDoNothing();

  const [existing] = await db
    .select()
    .from(gateways)
    .where(eq(gateways.gwMac, gwInfo.gwMac))
    .limit(1);

  if (!existing) {
    await db
      .insert(gateways)
      .values({
        gwMac: gwInfo.gwMac,
        gwName: `게이트웨이 ${gwInfo.gwMac}`,
        companyId: UNREGISTERED_COMPANY_ID,
      })
      .onConflictDoNothing();
    console.log(`[WS] 신규 게이트웨이 자동 등록 (미등록): ${gwInfo.gwMac}`);
  }

  // DB upsert (gateway_status 테이블)
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

  // 응답 전송
  ws.send(buildGwInfoResponse());
}

/**
 * 0x0A - 태그 센싱 데이터 처리
 * 등록된 태그인지 확인 후 센싱 데이터 저장
 */
async function handleTagData(data: Buffer, clientInfo: ClientInfo): Promise<void> {
  const tagData = parseTagData(data);

  // 등록된 태그인지 확인
  const [tag] = await db
    .select()
    .from(tags)
    .where(eq(tags.tagMac, tagData.tagMac))
    .limit(1);

  if (!tag) {
    // 미등록 태그는 로그만 남기고 스킵
    return;
  }

  // 센싱 데이터 저장
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

  console.log(
    `[WS] 태그 데이터: ${tagData.tagMac} via ${tagData.gwMac} | ` +
    `RSSI: ${tagData.rssi}, 온도: ${tagData.temperature}°C, 전압: ${tagData.voltage}V`
  );
}

/**
 * 게이트웨이 연결 해제 처리
 * @param gwMac - 게이트웨이 MAC
 * @param closedWs - 종료된 WebSocket (같은 MAC으로 교체된 연결이면 삭제 스킵)
 */
export async function handleDisconnect(gwMac: string, closedWs?: WebSocket): Promise<void> {
  const currentWs = connectedGateways.get(gwMac);
  if (closedWs && currentWs !== closedWs) {
    return; // 이미 새 연결로 교체됨
  }
  connectedGateways.delete(gwMac);

  try {
    await db
      .update(gatewayStatus)
      .set({ isConnected: false, lastUpdatedAt: new Date() })
      .where(eq(gatewayStatus.gwMac, gwMac));

    console.log(`[WS] 게이트웨이 연결 해제: ${gwMac}`);
  } catch (error) {
    console.error(`[WS] 연결 해제 DB 업데이트 실패: ${gwMac}`, error);
  }
}
