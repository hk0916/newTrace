'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GatewayPlacement } from '../asset-map/components/gateway-placement';
import { MapPin, Wifi, Tag, AlertTriangle, Map } from 'lucide-react';

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

function MapCard({ map, isActive }: { map: MapPreviewData; isActive: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const aspectRatio = Math.min((map.imageHeight / map.imageWidth) * 100, 65);

  const noop = () => {};

  if (!isActive) return null;

  return (
    <div
      className="relative w-full border rounded-lg overflow-hidden bg-muted/30 cursor-pointer"
      onClick={() => router.push('/dashboard/asset-map')}
    >
      <div
        ref={containerRef}
        className="relative w-full"
        style={{ paddingTop: `${aspectRatio}%`, minHeight: '300px' }}
      >
        <img
          src={map.imagePath}
          alt={map.name}
          className="absolute inset-0 w-full h-full object-contain"
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
  );
}

export function DashboardMapPreview({ maps, summary }: DashboardMapPreviewProps) {
  const tDash = useTranslations('dashboard');
  const router = useRouter();
  const [activeMapIndex, setActiveMapIndex] = useState(0);

  // 빈 상태: 맵이 없을 때도 영역 표시
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

  return (
    <Card className="overflow-hidden">
      {/* Header: 제목 + 맵 탭 */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          {tDash('assetMap')}
        </h2>
        {maps.length > 1 && (
          <div className="flex gap-1 bg-muted rounded-lg p-0.5">
            {maps.map((map, i) => (
              <button
                key={map.id}
                type="button"
                onClick={() => setActiveMapIndex(i)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  i === activeMapIndex
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {map.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 맵 영역 */}
      <CardContent className="p-2">
        {maps.map((map, i) => (
          <MapCard key={map.id} map={map} isActive={i === activeMapIndex} />
        ))}
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
