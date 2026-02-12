'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, MapPin } from 'lucide-react';

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
  onSelect: (map: AssetMapItem) => void;
  onDelete: (mapId: string) => void;
}

export function AssetMapList({ maps, canEdit, onSelect, onDelete }: AssetMapListProps) {
  if (maps.length === 0) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        <MapPin className="mx-auto h-12 w-12 mb-4 opacity-50" />
        <p className="text-lg font-medium">등록된 맵이 없습니다</p>
        <p className="text-sm mt-1">맵 등록 버튼으로 도면을 추가해주세요</p>
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
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium truncate">{map.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary">
                    게이트웨이 {map.gatewayCount}개
                  </Badge>
                </div>
              </div>
              {canEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`'${map.name}' 맵을 삭제하시겠습니까?`)) {
                      onDelete(map.id);
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
