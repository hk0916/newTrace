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
import { cn, formatMacDisplay, formatDateTime } from '@/lib/utils';

interface TagRow {
  tagMac: string;
  tagName: string;
  assetType: string | null;
  assignedGwMac: string | null;
  isActive: boolean;
  latestSensing: {
    gwMac?: string | null;
    temperature: string | null;
    voltage: string | null;
    rssi: number | null;
    receivedTime: string | null;
  } | null;
}

function tempColor(temp: number): string {
  if (temp > 40) return 'text-red-600 font-bold';
  if (temp > 30) return 'text-orange-500';
  if (temp < 0) return 'text-blue-600 font-bold';
  if (temp < 15) return 'text-blue-400';
  return '';
}

function voltBadge(volt: number) {
  if (volt < 2.0) return <Badge variant="destructive">위험</Badge>;
  if (volt < 2.5) return <Badge variant="secondary">주의</Badge>;
  return null;
}

export function TagTable({ tags }: { tags: TagRow[] }) {
  if (tags.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        등록된 태그가 없습니다.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>MAC 주소</TableHead>
          <TableHead>이름</TableHead>
          <TableHead>자산 유형</TableHead>
          <TableHead>게이트웨이</TableHead>
          <TableHead>온도</TableHead>
          <TableHead>전압</TableHead>
          <TableHead>RSSI</TableHead>
          <TableHead>마지막 수신</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tags.map((tag) => {
          const temp = tag.latestSensing?.temperature ? parseFloat(tag.latestSensing.temperature) : null;
          const volt = tag.latestSensing?.voltage ? parseFloat(tag.latestSensing.voltage) : null;

          return (
            <TableRow key={tag.tagMac}>
              <TableCell className="font-mono text-sm">{formatMacDisplay(tag.tagMac)}</TableCell>
              <TableCell>{tag.tagName}</TableCell>
              <TableCell>{tag.assetType || '-'}</TableCell>
              <TableCell className="font-mono text-sm">
                {formatMacDisplay(tag.latestSensing?.gwMac ?? tag.assignedGwMac)}
              </TableCell>
              <TableCell>
                {temp !== null ? (
                  <span className={cn(tempColor(temp))}>{temp.toFixed(1)}°C</span>
                ) : '-'}
              </TableCell>
              <TableCell>
                <span className="flex items-center gap-1">
                  {volt !== null ? `${volt.toFixed(2)}V` : '-'}
                  {volt !== null && voltBadge(volt)}
                </span>
              </TableCell>
              <TableCell>{tag.latestSensing?.rssi ?? '-'}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatDateTime(tag.latestSensing?.receivedTime)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
