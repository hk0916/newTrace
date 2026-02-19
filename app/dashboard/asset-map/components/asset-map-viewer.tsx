'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Save, Pencil, Eye, Palette } from 'lucide-react';
import { GatewayPlacement, type PlacementData, type GatewayAreaColor, AVAILABLE_COLORS } from './gateway-placement';
import { GatewaySidebar, type GatewayItem } from './gateway-sidebar';
import { v4 as uuidv4 } from 'uuid';


interface AssetMapViewerProps {
  mapId: string;
  mapName: string;
  imagePath: string;
  imageWidth: number;
  imageHeight: number;
  initialPlacements: PlacementData[];
  initialGatewayAreaColor?: string;
  allGateways: GatewayItem[];
  canEdit: boolean;
  onBack: () => void;
}

export function AssetMapViewer({
  mapId,
  mapName,
  imagePath,
  imageWidth,
  imageHeight,
  initialPlacements,
  initialGatewayAreaColor,
  allGateways,
  canEdit,
  onBack,
}: AssetMapViewerProps) {
  const t = useTranslations('assetMap');
  const tCommon = useTranslations('common');
  const [placements, setPlacements] = useState<PlacementData[]>(initialPlacements);
  const [isEditing, setIsEditing] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [areaColor, setAreaColor] = useState<GatewayAreaColor>(() => {
    const fromDb = initialGatewayAreaColor;
    return AVAILABLE_COLORS.find((c) => c.id === fromDb) ?? AVAILABLE_COLORS[0];
  });
  const containerRef = useRef<HTMLDivElement>(null);

  const handleColorChange = useCallback(async (color: GatewayAreaColor) => {
    setAreaColor(color);
    const res = await fetch(`/api/asset-maps/${mapId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: mapName, gatewayAreaColor: color.id }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      alert(data?.error || t('colorSaveFailed'));
    }
  }, [mapId, mapName, t]);

  const placedMacs = new Set(placements.map((p) => p.gwMac));

  const handleUpdate = useCallback((updated: PlacementData) => {
    setPlacements((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    setIsDirty(true);
  }, []);

  const handleRemove = useCallback((id: string) => {
    setPlacements((prev) => prev.filter((p) => p.id !== id));
    setIsDirty(true);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const gwMac = e.dataTransfer.getData('gwMac');
      if (!gwMac) return;

      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
      const yPercent = ((e.clientY - rect.top) / rect.height) * 100;

      const gw = allGateways.find((g) => g.gwMac === gwMac);
      if (!gw) return;

      if (placements.some((p) => p.gwMac === gwMac)) return;

      const defaultW = 10;
      const defaultH = 8;

      const newPlacement: PlacementData = {
        id: uuidv4(),
        gwMac: gw.gwMac,
        gwName: gw.gwName,
        xPercent: Math.max(0, Math.min(100 - defaultW, xPercent - defaultW / 2)),
        yPercent: Math.max(0, Math.min(100 - defaultH, yPercent - defaultH / 2)),
        widthPercent: defaultW,
        heightPercent: defaultH,
        tagCount: gw.tagCount,
        isConnected: gw.isConnected,
      };

      setPlacements((prev) => [...prev, newPlacement]);
      setIsDirty(true);
    },
    [allGateways, placements]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  async function handleSave() {
    setSaving(true);
    const body = {
      placements: placements.map((p) => ({
        gwMac: p.gwMac,
        xPercent: p.xPercent,
        yPercent: p.yPercent,
        widthPercent: p.widthPercent,
        heightPercent: p.heightPercent,
      })),
      gatewayAreaColor: areaColor.id,
    };

    const res = await fetch(`/api/asset-maps/${mapId}/placements`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    setSaving(false);

    if (res.ok) {
      setIsDirty(false);
    } else {
      const data = await res.json().catch(() => null);
      alert(data?.error || t('saveFailed'));
    }
  }

  const aspectRatio = (imageHeight / imageWidth) * 100;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold">{mapName}</h1>
          {isDirty && (
            <span className="text-xs text-orange-500 font-medium">
              ({t('unsavedChanges')})
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {placements.length > 0 && (
            <div className="flex items-center gap-1.5">
              <Palette className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{t('areaColor')}</span>
              {AVAILABLE_COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  title={c.label}
                  className={`w-5 h-5 rounded border-2 transition-all ${
                    areaColor.id === c.id
                      ? 'border-foreground scale-110'
                      : 'border-transparent hover:scale-105'
                  }`}
                  style={{
                    backgroundColor: c.id === 'amber' ? '#f59e0b' : c.id === 'emerald' ? '#34d399' : c.id === 'rose' ? '#fb7185' : c.id === 'cyan' ? '#22d3ee' : c.id === 'violet' ? '#a78bfa' : '#a3e635',
                  }}
                  onClick={() => handleColorChange(c)}
                />
              ))}
            </div>
          )}
          {canEdit && (
            <>
              <Button
                variant={isEditing ? 'default' : 'outline'}
                size="sm"
                onClick={() => setIsEditing(!isEditing)}
              >
                {isEditing ? (
                  <>
                    <Eye className="mr-2 h-4 w-4" />
                    {t('viewMode')}
                  </>
                ) : (
                  <>
                    <Pencil className="mr-2 h-4 w-4" />
                    {t('editMode')}
                  </>
                )}
              </Button>
              {isEditing && (
                <Button size="sm" onClick={handleSave} disabled={saving || !isDirty}>
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? tCommon('saving') : tCommon('save')}
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Map + Sidebar layout */}
      <div className="flex flex-col md:flex-row gap-4">
        {/* Map container */}
        <div className="flex-1 min-w-0">
          <div
            className="relative w-full border rounded-md overflow-hidden bg-muted"
            style={{ maxWidth: 1920 }}
          >
            <div
              ref={containerRef}
              className="relative w-full"
              style={{ paddingTop: `${aspectRatio}%` }}
              onDragOver={isEditing ? handleDragOver : undefined}
              onDrop={isEditing ? handleDrop : undefined}
            >
              <img
                src={imagePath}
                alt={mapName}
                className="absolute inset-0 w-full h-full object-contain"
                draggable={false}
              />
              {placements.map((p) => (
                <GatewayPlacement
                  key={p.id}
                  placement={p}
                  containerRef={containerRef}
                  onUpdate={handleUpdate}
                  onRemove={handleRemove}
                  isEditing={isEditing}
                  colorPreset={areaColor}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar (edit mode only) */}
        {isEditing && (
          <div className="w-full md:w-64 shrink-0">
            <GatewaySidebar
              gateways={allGateways}
              placedMacs={placedMacs}
            />
          </div>
        )}
      </div>
    </div>
  );
}
