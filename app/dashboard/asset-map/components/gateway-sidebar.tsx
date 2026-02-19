'use client';

import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Radio } from 'lucide-react';

export interface GatewayItem {
  gwMac: string;
  gwName: string;
  isConnected: boolean;
  tagCount: number;
}

interface GatewaySidebarProps {
  gateways: GatewayItem[];
  placedMacs: Set<string>;
}

export function GatewaySidebar({ gateways, placedMacs }: GatewaySidebarProps) {
  const t = useTranslations('assetMap');
  const available = gateways.filter((gw) => !placedMacs.has(gw.gwMac));

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-muted-foreground">
        {t('availableGateways', { count: available.length })}
      </h3>
      {available.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">
          {t('allPlaced')}
        </p>
      ) : (
        <div className="space-y-1 max-h-[60vh] overflow-y-auto">
          {available.map((gw) => (
            <div
              key={gw.gwMac}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('gwMac', gw.gwMac);
                e.dataTransfer.effectAllowed = 'copy';
              }}
              className="flex items-center gap-2 rounded-md border p-2 cursor-grab active:cursor-grabbing hover:bg-muted/50 transition-colors select-none"
            >
              <Radio className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="text-sm truncate flex-1">{gw.gwName}</span>
              <Badge variant="secondary" className="text-xs shrink-0">
                {gw.tagCount}
              </Badge>
              <div
                className={`w-2 h-2 rounded-full shrink-0 ${
                  gw.isConnected ? 'bg-green-500' : 'bg-red-500'
                }`}
                title={gw.isConnected ? t('gwConnected') : t('gwDisconnected')}
              />
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground mt-2">
        {t('dragHint')}
      </p>
    </div>
  );
}
