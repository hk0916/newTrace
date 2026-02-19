import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import http from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { handleMessage, handleDisconnect, connectedGateways } from './handlers';
import { buildGwInfoRequest } from './protocol';
import { startCommandApi } from './command-api';
import type { ClientInfo } from './types';

const WS_PORT = Number(process.env.WS_PORT) || 8080;

const httpServer = http.createServer();
const wss = new WebSocketServer({ server: httpServer });
httpServer.listen({ port: WS_PORT, reuseAddr: true }, () => {
  console.log(`[WS Server] 시작 - 포트 ${WS_PORT}`);
  console.log(`[WS Server] 게이트웨이 연결 대기 중...`);
});

// MAC ↔ 클라이언트 정보 매핑 (연결 해제 시 MAC 조회용)
const clientMacMap = new Map<WebSocket, string>();

// Heartbeat: pong 응답 여부 추적
const aliveMap = new WeakMap<WebSocket, boolean>();

// 명령 HTTP API 시작 (종료 시 닫기 위해 참조 보관)
const cmdServer = startCommandApi();

const REGISTRATION_TIMEOUT_MS = 30_000; // 30초 내 0x08 미수신 시 연결 종료
const HEARTBEAT_INTERVAL_MS   = 30_000; // 30초마다 ping 전송
const HEARTBEAT_TIMEOUT_MS    = 10_000; // 10초 내 pong 미응답 시 강제 종료

wss.on('connection', (ws: WebSocket, req) => {
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
    || req.socket.remoteAddress?.replace('::ffff:', '')
    || 'unknown';
  const port = req.socket.remotePort || 0;

  const clientInfo: ClientInfo = { ip, port };
  console.log(`[WS Server] 새 연결: ${ip}:${port}`);

  // Heartbeat 초기화: 새 연결은 살아있는 것으로 간주
  aliveMap.set(ws, true);
  ws.on('pong', () => {
    aliveMap.set(ws, true);
  });

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
        .join('');
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

httpServer.on('error', (error) => {
  console.error('[WS Server] 서버 에러:', error);
});

wss.on('error', (error) => {
  console.error('[WS Server] WebSocket 에러:', error);
});

// 상태 모니터링 + Heartbeat (30초마다)
setInterval(() => {
  console.log(`[WS Server] 연결된 게이트웨이: ${connectedGateways.size}개, 총 클라이언트: ${wss.clients.size}개`);

  for (const client of wss.clients) {
    if (aliveMap.get(client) === false) {
      // 이전 ping에 응답 없음 → 즉시 강제 종료
      console.log(`[WS Server] Heartbeat 미응답 - 연결 강제 종료`);
      client.terminate();
      continue;
    }
    // pong 대기 상태로 전환 후 ping 전송
    aliveMap.set(client, false);
    client.ping();

    // 10초 내 pong 없으면 강제 종료
    setTimeout(() => {
      if (aliveMap.get(client) === false) {
        console.log(`[WS Server] Heartbeat 타임아웃 - 연결 강제 종료`);
        client.terminate();
      }
    }, HEARTBEAT_TIMEOUT_MS);
  }
}, HEARTBEAT_INTERVAL_MS);

// 종료 처리 (한 번만 실행, 타임아웃 후 강제 종료)
let shuttingDown = false;
function gracefulShutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log('\n[WS Server] 종료 중...');

  const forceExit = () => {
    console.log('[WS Server] 타임아웃 - 강제 종료');
    process.exit(1);
  };
  const timeout = setTimeout(forceExit, 5000);

  // 모든 WebSocket 연결 즉시 종료 (wss.close 대기 시간 단축)
  for (const client of wss.clients) {
    client.terminate();
  }

  wss.close(() => {
    cmdServer.close(() => {
      httpServer.close(() => {
        clearTimeout(timeout);
        console.log('[WS Server] 종료 완료');
        process.exit(0);
      });
    });
  });
}
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
