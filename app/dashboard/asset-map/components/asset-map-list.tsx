'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, MapPin, Star } from 'lucide-react';

export interface AssetMapItem {
  id: string;
  name: string;
  imagePath: string;
  imageWidth: number;
  imageHeight: number;
  createdAt: string;
  gatewayCount: number;
}

interface AssetMapListProps {
  maps: AssetMapItem[];
  canEdit: boolean;
  dashboardMapId?: string | null;
  onSelect: (map: AssetMapItem) => void;
  onDelete: (mapId: string) => void;
  onSetDashboard?: (mapId: string) => void;
}

export function AssetMapList({ maps, canEdit, dashboardMapId, onSelect, onDelete, onSetDashboard }: AssetMapListProps) {
  const t = useTranslations('assetMap');

  if (maps.length === 0) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        <MapPin className="mx-auto h-12 w-12 mb-4 opacity-50" />
        <p className="text-lg font-medium">{t('noMaps')}</p>
        <p className="text-sm mt-1">{t('noMapsHint')}</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {maps.map((map) => (
        <Card
          key={map.id}
          className="cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all overflow-hidden"
          onClick={() => onSelect(map)}
        >
          <div className="aspect-video relative bg-muted">
            <img
              src={map.imagePath}
              alt={map.name}
              className="w-full h-full object-cover"
            />
          </div>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-medium truncate flex items-center gap-1.5">
                  {map.name}
                  {map.id === dashboardMapId && (
                    <Badge variant="outline" className="text-xs font-normal text-amber-600 border-amber-400">
                      <Star className="h-3 w-3 fill-amber-500 mr-0.5" />
                      {t('dashboard')}
                    </Badge>
                  )}
                </h3>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <Badge variant="secondary">
                    {t('gatewayCount', { count: map.gatewayCount })}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {canEdit && onSetDashboard && (
                  <Button
                    variant={map.id === dashboardMapId ? 'secondary' : 'outline'}
                    size="sm"
                    className={`h-8 text-xs ${map.id === dashboardMapId ? 'text-amber-600' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSetDashboard(map.id);
                    }}
                  >
                    <Star className={`h-3 w-3 mr-1 ${map.id === dashboardMapId ? 'fill-amber-500' : ''}`} />
                    {map.id === dashboardMapId ? t('hideDashboard') : t('showOnDashboard')}
                  </Button>
                )}
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive h-8 w-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(t('deleteConfirm', { name: map.name }))) {
                        onDelete(map.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
