'use client';

import { useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GatewayPlacement } from '../asset-map/components/gateway-placement';
import { MapPin, Wifi, Tag, AlertTriangle } from 'lucide-react';

interface MapPreviewData {
  id: string;
  name: string;
  imagePath: string;
  imageWidth: number;
  imageHeight: number;
  gatewayAreaColor: string;
  placements: {
    id: string;
    gwMac: string;
    gwName: string;
    xPercent: number;
    yPercent: number;
    widthPercent: number;
    heightPercent: number;
    isConnected: boolean;
    tagCount: number;
    color?: string;
  }[];
}

interface MapSummary {
  gwConnected: number;
  gwTotal: number;
  trackedTags: number;
  alertCount: number;
}

interface DashboardMapPreviewProps {
  maps: MapPreviewData[];
  companyId: string;
  canEdit: boolean;
  summary?: MapSummary;
}

const MAP_HEIGHT = 320;

function MapCard({ map, isSingle }: { map: MapPreviewData; isSingle: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const noop = () => {};
  const imgAspect = map.imageWidth / map.imageHeight;

  return (
    <div
      className="flex-shrink-0 flex flex-col rounded-lg border overflow-hidden bg-muted/30 cursor-pointer hover:border-foreground/20 transition-colors"
      style={{
        width: isSingle ? '100%' : `max(360px, ${MAP_HEIGHT * imgAspect}px)`,
        height: `${MAP_HEIGHT}px`,
      }}
      onClick={() => router.push('/dashboard/asset-map')}
    >
      {/* 맵 이름 라벨 */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-b bg-muted/50 text-xs font-medium text-muted-foreground">
        <MapPin className="h-3 w-3" />
        {map.name}
      </div>
      {/* 맵 영역 */}
      <div className="flex-1 flex items-center justify-center overflow-hidden">
        <div
          ref={containerRef}
          className="relative"
          style={{
            width: `min(100%, ${(MAP_HEIGHT - 30) * imgAspect}px)`,
            maxWidth: '100%',
            maxHeight: `${MAP_HEIGHT - 30}px`,
            aspectRatio: `${map.imageWidth} / ${map.imageHeight}`,
          }}
        >
          <img
            src={map.imagePath}
            alt={map.name}
            className="absolute inset-0 w-full h-full object-fill rounded"
            draggable={false}
          />
          {map.placements.map((p) => (
            <GatewayPlacement
              key={p.id}
              placement={{ ...p, color: p.color ?? map.gatewayAreaColor ?? 'amber' }}
              containerRef={containerRef}
              onUpdate={noop}
              onRemove={noop}
              isEditing={false}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function DashboardMapPreview({ maps, summary }: DashboardMapPreviewProps) {
  const tDash = useTranslations('dashboard');
  const router = useRouter();

  if (maps.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <MapPin className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <p className="text-muted-foreground mb-3">{tDash('assetMapEmpty')}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/dashboard/asset-map')}
          >
            {tDash('assetMapEmptyAction')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const isSingle = maps.length === 1;

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          {tDash('assetMap')}
        </h2>
        {!isSingle && (
          <span className="text-xs text-muted-foreground">
            ← 스크롤 →
          </span>
        )}
      </div>

      {/* 맵 카드: 1개면 풀폭, 여러 개면 가로 스크롤 */}
      <CardContent className="p-2">
        <div
          className={
            isSingle
              ? ''
              : 'flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory'
          }
          style={isSingle ? undefined : { scrollbarWidth: 'thin' }}
        >
          {maps.map((map) => (
            <div key={map.id} className={isSingle ? '' : 'snap-start'}>
              <MapCard map={map} isSingle={isSingle} />
            </div>
          ))}
        </div>
      </CardContent>

      {/* Summary Bar */}
      {summary && (
        <div className="flex items-center gap-5 px-4 py-2.5 border-t text-sm text-muted-foreground bg-muted/30">
          <span className="inline-flex items-center gap-1.5">
            <Wifi className="h-3.5 w-3.5" />
            {tDash('assetMapSummaryGw', { connected: summary.gwConnected, total: summary.gwTotal })}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Tag className="h-3.5 w-3.5" />
            {tDash('assetMapSummaryTags', { count: summary.trackedTags })}
          </span>
          {summary.alertCount > 0 && (
            <span className="inline-flex items-center gap-1.5 text-destructive">
              <AlertTriangle className="h-3.5 w-3.5" />
              {tDash('assetMapSummaryAlerts', { count: summary.alertCount })}
            </span>
          )}
        </div>
      )}
    </Card>
  );
}
