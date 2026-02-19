import http from 'node:http';
import { connectedGateways } from './handlers';
import {
  buildSetOtaUrl,
  buildSetWsUrl,
  buildSetReportInterval,
  buildSetRssiFilter,
  buildCmdOta,
  buildGetGatewayInfo,
} from './protocol';

const CMD_PORT = Number(process.env.WS_CMD_PORT) || 8081;
const CMD_SECRET = process.env.WS_CMD_SECRET || 'tracetag-cmd-secret';

type CommandType =
  | 'request-info'
  | 'set-ota-url'
  | 'set-ws-url'
  | 'set-report-interval'
  | 'set-rssi-filter'
  | 'cmd-ota';

interface CommandRequest {
  gwMac: string; // 특정 MAC 또는 "all"
  companyId: string;
  command: CommandType;
  payload?: Record<string, unknown>;
}

function buildCommandPacket(command: CommandType, payload?: Record<string, unknown>): Buffer | null {
  switch (command) {
    case 'request-info':
      return buildGetGatewayInfo();
    case 'set-ota-url':
      if (typeof payload?.url !== 'string') return null;
      return buildSetOtaUrl(payload.url);
    case 'set-ws-url':
      if (typeof payload?.url !== 'string') return null;
      return buildSetWsUrl(payload.url);
    case 'set-report-interval':
      if (typeof payload?.seconds !== 'number') return null;
      return buildSetReportInterval(payload.seconds);
    case 'set-rssi-filter':
      if (typeof payload?.value !== 'number') return null;
      return buildSetRssiFilter(payload.value);
    case 'cmd-ota':
      if (typeof payload?.url !== 'string') return null;
      return buildCmdOta(payload.url);
    default:
      return null;
  }
}

function sendJson(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', reject);
  });
}

/** connectedGateways에서 특정 회사 게이트웨이 MAC 목록 반환 (DB 조회 없이 전체) */
function getConnectedMacs(): string[] {
  return Array.from(connectedGateways.keys());
}

export function startCommandApi() {
  const server = http.createServer(async (req, res) => {
    // CORS (같은 호스트 내부 통신이지만 안전장치)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-cmd-secret');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // 연결 상태 조회 (인증 필요)
    if (req.method === 'GET' && req.url === '/status') {
      if (req.headers['x-cmd-secret'] !== CMD_SECRET) {
        sendJson(res, 401, { error: 'Unauthorized' });
        return;
      }
      sendJson(res, 200, {
        connectedGateways: getConnectedMacs(),
        count: connectedGateways.size,
      });
      return;
    }

    if (req.method !== 'POST' || req.url !== '/command') {
      sendJson(res, 404, { error: 'Not found' });
      return;
    }

    // 인증 확인
    if (req.headers['x-cmd-secret'] !== CMD_SECRET) {
      sendJson(res, 401, { error: 'Unauthorized' });
      return;
    }

    try {
      const raw = await readBody(req);
      const body = JSON.parse(raw) as CommandRequest;

      const { gwMac, command, payload } = body;

      if (!gwMac || !command) {
        sendJson(res, 400, { error: 'gwMac and command are required' });
        return;
      }

      const packet = buildCommandPacket(command, payload);
      if (!packet) {
        sendJson(res, 400, { error: `Invalid command or payload: ${command}` });
        return;
      }

      // 대상 게이트웨이 결정
      let targetMacs: string[];
      if (gwMac === 'all') {
        targetMacs = getConnectedMacs();
      } else {
        targetMacs = [gwMac];
      }

      const results: { gwMac: string; sent: boolean; error?: string }[] = [];

      for (const mac of targetMacs) {
        const ws = connectedGateways.get(mac);
        if (!ws || ws.readyState !== 1) { // WebSocket.OPEN = 1
          results.push({ gwMac: mac, sent: false, error: '게이트웨이가 연결되어 있지 않습니다' });
          continue;
        }
        try {
          ws.send(packet);
          results.push({ gwMac: mac, sent: true });
        } catch (err) {
          results.push({ gwMac: mac, sent: false, error: (err as Error).message });
        }
      }

      const allSent = results.every((r) => r.sent);
      const anySent = results.some((r) => r.sent);
      const failedResults = results.filter((r) => !r.sent);

      sendJson(res, anySent ? 200 : 502, {
        success: allSent,
        error: !anySent ? (failedResults[0]?.error || '명령 전송 실패') : undefined,
        sent: results.filter((r) => r.sent).length,
        failed: failedResults.length,
        results,
      });
    } catch (err) {
      console.error('[CMD API] 요청 처리 오류:', err);
      sendJson(res, 500, { error: 'Internal server error' });
    }
  });

  server.listen({ port: CMD_PORT, reuseAddr: true }, () => {
    console.log(`[CMD API] 명령 HTTP API 시작 - 포트 ${CMD_PORT}`);
  });

  return server;
}
