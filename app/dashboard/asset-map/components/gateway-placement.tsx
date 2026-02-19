'use client';

import { useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PlacementData {
  id: string;
  gwMac: string;
  gwName: string;
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  heightPercent: number;
  tagCount: number;
  isConnected: boolean;
  color?: string;
}

const COLOR_HEX: Record<string, string> = {
  amber: '#f59e0b',
  emerald: '#34d399',
  rose: '#fb7185',
  cyan: '#22d3ee',
  violet: '#a78bfa',
  lime: '#a3e635',
};

export const AVAILABLE_COLORS = [
  { id: 'amber', connected: 'border-amber-400 bg-amber-400/35', disconnected: 'border-amber-600/80 bg-amber-500/25', label: 'Amber' },
  { id: 'emerald', connected: 'border-emerald-400 bg-emerald-400/35', disconnected: 'border-emerald-600/80 bg-emerald-500/25', label: 'Emerald' },
  { id: 'rose', connected: 'border-rose-400 bg-rose-400/35', disconnected: 'border-rose-600/80 bg-rose-500/25', label: 'Rose' },
  { id: 'cyan', connected: 'border-cyan-400 bg-cyan-400/35', disconnected: 'border-cyan-600/80 bg-cyan-500/25', label: 'Cyan' },
  { id: 'violet', connected: 'border-violet-400 bg-violet-400/35', disconnected: 'border-violet-600/80 bg-violet-500/25', label: 'Violet' },
  { id: 'lime', connected: 'border-lime-400 bg-lime-400/35', disconnected: 'border-lime-600/80 bg-lime-500/25', label: 'Lime' },
] as const;

export type GatewayAreaColor = (typeof AVAILABLE_COLORS)[number];

interface GatewayPlacementProps {
  placement: PlacementData;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onUpdate: (updated: PlacementData) => void;
  onRemove: (id: string) => void;
  isEditing: boolean;
  /** 보기 모드에서 클릭 시 콜백 */
  onViewClick?: () => void;
}

export function GatewayPlacement({
  placement,
  containerRef,
  onUpdate,
  onRemove,
  isEditing,
  onViewClick,
}: GatewayPlacementProps) {
  const isDragging = useRef(false);

  const getContainerRect = useCallback(() => {
    return containerRef.current?.getBoundingClientRect() ?? null;
  }, [containerRef]);

  const startDrag = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!isEditing) return;
      e.preventDefault();
      e.stopPropagation();
      isDragging.current = true;

      const rect = getContainerRect();
      if (!rect) return;

      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const startX = clientX;
      const startY = clientY;
      const startXPercent = placement.xPercent;
      const startYPercent = placement.yPercent;

      function onMove(ev: MouseEvent | TouchEvent) {
        ev.preventDefault();
        const rect = getContainerRect();
        if (!rect) return;
        const cx = 'touches' in ev ? ev.touches[0].clientX : ev.clientX;
        const cy = 'touches' in ev ? ev.touches[0].clientY : ev.clientY;

        const deltaXPercent = ((cx - startX) / rect.width) * 100;
        const deltaYPercent = ((cy - startY) / rect.height) * 100;

        const newX = Math.max(0, Math.min(100 - placement.widthPercent, startXPercent + deltaXPercent));
        const newY = Math.max(0, Math.min(100 - placement.heightPercent, startYPercent + deltaYPercent));

        onUpdate({ ...placement, xPercent: newX, yPercent: newY });
      }

      function onUp() {
        isDragging.current = false;
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('touchend', onUp);
      }

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      document.addEventListener('touchmove', onMove, { passive: false });
      document.addEventListener('touchend', onUp);
    },
    [isEditing, placement, onUpdate, getContainerRect]
  );

  const startResize = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!isEditing) return;
      e.preventDefault();
      e.stopPropagation();

      const rect = getContainerRect();
      if (!rect) return;

      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const startX = clientX;
      const startY = clientY;
      const startW = placement.widthPercent;
      const startH = placement.heightPercent;

      function onMove(ev: MouseEvent | TouchEvent) {
        ev.preventDefault();
        const rect = getContainerRect();
        if (!rect) return;
        const cx = 'touches' in ev ? ev.touches[0].clientX : ev.clientX;
        const cy = 'touches' in ev ? ev.touches[0].clientY : ev.clientY;

        const deltaWPercent = ((cx - startX) / rect.width) * 100;
        const deltaHPercent = ((cy - startY) / rect.height) * 100;

        const newW = Math.max(3, Math.min(100 - placement.xPercent, startW + deltaWPercent));
        const newH = Math.max(3, Math.min(100 - placement.yPercent, startH + deltaHPercent));

        onUpdate({ ...placement, widthPercent: newW, heightPercent: newH });
      }

      function onUp() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('touchend', onUp);
      }

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      document.addEventListener('touchmove', onMove, { passive: false });
      document.addEventListener('touchend', onUp);
    },
    [isEditing, placement, onUpdate, getContainerRect]
  );

  const t = useTranslations('assetMap');
  const activeColor = AVAILABLE_COLORS.find((c) => c.id === (placement.color ?? 'amber')) ?? AVAILABLE_COLORS[0];
  const colorClass = placement.isConnected ? activeColor.connected : activeColor.disconnected;

  return (
    <div
      className={cn(
        'absolute border-2 rounded-sm group transition-shadow select-none',
        isEditing ? 'cursor-move' : (onViewClick ? 'cursor-pointer' : 'cursor-default'),
        colorClass
      )}
      style={{
        left: `${placement.xPercent}%`,
        top: `${placement.yPercent}%`,
        width: `${placement.widthPercent}%`,
        height: `${placement.heightPercent}%`,
        touchAction: isEditing ? 'none' : 'auto',
      }}
      onMouseDown={startDrag}
      onTouchStart={startDrag}
      onClick={!isEditing && onViewClick ? (e) => { e.stopPropagation(); onViewClick(); } : undefined}
    >
      {/* Gateway name label */}
      <div className="absolute -top-5 left-0 text-[10px] sm:text-xs font-medium bg-white/90 dark:bg-gray-900/90 px-1 rounded truncate max-w-full whitespace-nowrap shadow-sm">
        {placement.gwName}
      </div>

      {/* Tag count (centered) */}
      <div className="absolute inset-0 flex items-center justify-center">
        <Badge
          variant="secondary"
          className="text-xs sm:text-sm font-bold pointer-events-none"
        >
          {placement.tagCount}
        </Badge>
      </div>

      {/* Connection indicator */}
      <div
        className={cn(
          'absolute top-1 left-1 w-2 h-2 rounded-full',
          placement.isConnected ? 'bg-green-500' : 'bg-red-500'
        )}
        title={placement.isConnected ? t('gwConnected') : t('gwDisconnected')}
      />

      {/* Remove button (edit mode only) */}
      {isEditing && (
        <button
          className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm z-10"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(placement.id);
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <X className="h-3 w-3" />
        </button>
      )}

      {/* Per-placement color picker (edit mode, visible on hover) */}
      {isEditing && (
        <div
          className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {AVAILABLE_COLORS.map((c) => (
            <button
              key={c.id}
              type="button"
              title={c.label}
              className={`w-3 h-3 rounded-full transition-transform hover:scale-125 ${
                (placement.color ?? 'amber') === c.id
                  ? 'ring-2 ring-white ring-offset-[1px] ring-offset-black/30 scale-110'
                  : ''
              }`}
              style={{ backgroundColor: COLOR_HEX[c.id] }}
              onClick={(e) => {
                e.stopPropagation();
                onUpdate({ ...placement, color: c.id });
              }}
            />
          ))}
        </div>
      )}

      {/* Resize handle (edit mode only) */}
      {isEditing && (
        <div
          className="absolute bottom-0 right-0 w-3 h-3 bg-white/60 cursor-se-resize rounded-tl-sm opacity-50 hover:opacity-100 transition-opacity"
          onMouseDown={startResize}
          onTouchStart={startResize}
        />
      )}
    </div>
  );
}
