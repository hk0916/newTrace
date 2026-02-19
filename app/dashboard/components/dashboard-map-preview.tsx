'use client';

import { useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GatewayPlacement, type PlacementData, type GatewayAreaColor, AVAILABLE_COLORS } from '../asset-map/components/gateway-placement';
import { Map, Star } from 'lucide-react';

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
  }[];
}

interface DashboardMapPreviewProps {
  maps: MapPreviewData[];
  dashboardMapId: string | null;
  companyId: string;
  canEdit: boolean;
}

function MapCard({ map, isSelected, onSelectDashboard }: { map: MapPreviewData; isSelected: boolean; onSelectDashboard?: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const tDash = useTranslations('dashboard');
  const tMap = useTranslations('assetMap');
  const aspectRatio = (map.imageHeight / map.imageWidth) * 100;
  const colorPreset: GatewayAreaColor =
    AVAILABLE_COLORS.find((c) => c.id === map.gatewayAreaColor) ?? AVAILABLE_COLORS[0];

  const noop = () => {};

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => router.push('/dashboard/asset-map')}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Map className="h-4 w-4 text-muted-foreground" />
            {map.name}
            {isSelected && (
              <span className="text-xs text-amber-600 font-normal flex items-center gap-1">
                <Star className="h-3 w-3 fill-amber-500" />
                {tMap('dashboard')}
              </span>
            )}
          </CardTitle>
          {onSelectDashboard && !isSelected && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                onSelectDashboard();
              }}
            >
              <Star className="h-3 w-3 mr-1" />
              {tDash('showOnDashboard')}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="relative w-full border rounded-md overflow-hidden bg-muted">
          <div
            ref={containerRef}
            className="relative w-full"
            style={{ paddingTop: `${aspectRatio}%` }}
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
                placement={p}
                containerRef={containerRef}
                onUpdate={noop}
                onRemove={noop}
                isEditing={false}
                colorPreset={colorPreset}
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardMapPreview({ maps, dashboardMapId, companyId, canEdit }: DashboardMapPreviewProps) {
  const tDash = useTranslations('dashboard');

  if (maps.length === 0) return null;

  const selectedMap = dashboardMapId ? maps.find((m) => m.id === dashboardMapId) : null;
  const displayMaps = selectedMap ? [selectedMap] : maps;

  async function handleSetDashboard(mapId: string) {
    const res = await fetch(`/api/asset-maps/${mapId}/set-dashboard?companyId=${companyId}`, {
      method: 'POST',
    });
    if (res.ok) {
      window.location.reload();
    } else {
      const data = await res.json().catch(() => null);
      alert(data?.error || tDash('settingFailed'));
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">{tDash('assetMap')}</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {displayMaps.map((map) => (
          <MapCard
            key={map.id}
            map={map}
            isSelected={map.id === dashboardMapId}
            onSelectDashboard={canEdit ? () => handleSetDashboard(map.id) : undefined}
          />
        ))}
      </div>
    </div>
  );
}
