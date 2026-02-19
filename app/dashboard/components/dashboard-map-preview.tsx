'use client';

import { useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GatewayPlacement } from '../asset-map/components/gateway-placement';
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
    color?: string;
  }[];
}

interface DashboardMapPreviewProps {
  maps: MapPreviewData[];
  companyId: string;
  canEdit: boolean;
}

function MapCard({ map }: { map: MapPreviewData }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const tMap = useTranslations('assetMap');
  const aspectRatio = (map.imageHeight / map.imageWidth) * 100;

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
            <span className="text-xs text-amber-600 font-normal flex items-center gap-1">
              <Star className="h-3 w-3 fill-amber-500" />
              {tMap('dashboard')}
            </span>
          </CardTitle>
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
                placement={{ ...p, color: p.color ?? map.gatewayAreaColor ?? 'amber' }}
                containerRef={containerRef}
                onUpdate={noop}
                onRemove={noop}
                isEditing={false}
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardMapPreview({ maps }: DashboardMapPreviewProps) {
  const tDash = useTranslations('dashboard');

  if (maps.length === 0) return null;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">{tDash('assetMap')}</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {maps.map((map) => (
          <MapCard
            key={map.id}
            map={map}
          />
        ))}
      </div>
    </div>
  );
}
