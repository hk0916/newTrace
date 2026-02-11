'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatMacDisplay, formatDateTime } from '@/lib/utils';

interface GatewayRow {
  gwMac: string;
  gwName: string;
  location: string | null;
  isConnected: boolean | null;
  fwVersion: string | null;
  lastConnectedAt: string | null;
}

export function GatewayTable({ gateways }: { gateways: GatewayRow[] }) {
  if (gateways.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        등록된 게이트웨이가 없습니다.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>MAC 주소</TableHead>
          <TableHead>이름</TableHead>
          <TableHead>위치</TableHead>
          <TableHead>상태</TableHead>
          <TableHead>FW 버전</TableHead>
          <TableHead>마지막 연결</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {gateways.map((gw) => (
          <TableRow key={gw.gwMac}>
            <TableCell className="font-mono text-sm">{formatMacDisplay(gw.gwMac)}</TableCell>
            <TableCell>{gw.gwName}</TableCell>
            <TableCell>{gw.location || '-'}</TableCell>
            <TableCell>
              <Badge variant={gw.isConnected ? 'default' : 'secondary'}>
                {gw.isConnected ? '연결됨' : '끊김'}
              </Badge>
            </TableCell>
            <TableCell className="font-mono text-sm">{gw.fwVersion || '-'}</TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {formatDateTime(gw.lastConnectedAt)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
