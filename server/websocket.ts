import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { WebSocketServer, WebSocket } from 'ws';
import { handleMessage, handleDisconnect, connectedGateways } from './handlers';
import { buildGwInfoRequest } from './protocol';
import type { ClientInfo } from './types';

const WS_PORT = Number(process.env.WS_PORT) || 8080;

const wss = new WebSocketServer({ port: WS_PORT });

// MAC ↔ 클라이언트 정보 매핑 (연결 해제 시 MAC 조회용)
const clientMacMap = new Map<WebSocket, string>();

console.log(`[WS Server] 시작 - 포트 ${WS_PORT}`);
console.log(`[WS Server] 게이트웨이 연결 대기 중...`);

const REGISTRATION_TIMEOUT_MS = 30_000; // 30초 내 0x08 미수신 시 연결 종료

wss.on('connection', (ws: WebSocket, req) => {
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
    || req.socket.remoteAddress?.replace('::ffff:', '')
    || 'unknown';
  const port = req.socket.remotePort || 0;

  const clientInfo: ClientInfo = { ip, port };
  console.log(`[WS Server] 새 연결: ${ip}:${port}`);

  // 등록 타임아웃: 0x08 미수신 시 연결 종료 (중복/미등록 연결 정리)
  let regTimeout: ReturnType<typeof setTimeout> | null = setTimeout(() => {
    regTimeout = null;
    console.log(`[WS Server] 등록 타임아웃 - 연결 종료: ${ip}:${port}`);
    ws.close();
  }, REGISTRATION_TIMEOUT_MS);

  // 게이트웨이 정보 요청 전송
  ws.send(buildGwInfoRequest());

  ws.on('message', async (rawData: Buffer) => {
    if (regTimeout) {
      clearTimeout(regTimeout);
      regTimeout = null;
    }
    const data = Buffer.from(rawData);

    // 0x08 패킷에서 MAC을 추출하여 매핑 저장 (direction 0x01 또는 0x03)
    if (data.length >= 10 && data[0] === 0x08 && (data[1] === 0x01 || data[1] === 0x03)) {
      const gwMac = Array.from(data.subarray(4, 10))
        .map(b => b.toString(16).padStart(2, '0').toUpperCase())
        .join(':');
      clientMacMap.set(ws, gwMac);
    }

    await handleMessage(ws, data, clientInfo);
  });

  ws.on('close', async () => {
    if (regTimeout) {
      clearTimeout(regTimeout);
      regTimeout = null;
    }
    const gwMac = clientMacMap.get(ws);
    clientMacMap.delete(ws);

    if (gwMac) {
      await handleDisconnect(gwMac, ws);
    }

    console.log(`[WS Server] 연결 종료: ${ip}:${port}${gwMac ? ` (${gwMac})` : ''}`);
  });

  ws.on('error', (error) => {
    console.error(`[WS Server] 에러 (${ip}:${port}):`, error.message);
  });
});

wss.on('error', (error) => {
  console.error('[WS Server] 서버 에러:', error);
});

// 상태 모니터링 (30초마다)
setInterval(() => {
  console.log(`[WS Server] 연결된 게이트웨이: ${connectedGateways.size}개, 총 클라이언트: ${wss.clients.size}개`);
}, 30000);

// 종료 처리
process.on('SIGINT', () => {
  console.log('\n[WS Server] 종료 중...');
  wss.close(() => {
    console.log('[WS Server] 종료 완료');
    process.exit(0);
  });
});
