'use client';

import { useState, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Save, Pencil, Eye, X, Wifi, WifiOff } from 'lucide-react';
import { GatewayPlacement, type PlacementData } from './gateway-placement';
import { GatewaySidebar, type GatewayItem } from './gateway-sidebar';
import { useTimezone } from '../../contexts/timezone-context';
import { formatDateTime } from '@/lib/utils';
import { v4 as uuidv4 } from 'uuid';

interface TagPopupItem {
  tagMac: string;
  tagName: string;
  assetType: string | null;
  latestSensing: {
    temperature: string | null;
    voltage: string | null;
    receivedTime: string | null;
  } | null;
}

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
  companyId: string;
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
  companyId,
  onBack,
}: AssetMapViewerProps) {
  const t = useTranslations('assetMap');
  const tCommon = useTranslations('common');
  const tTags = useTranslations('tags');
  const timezone = useTimezone();
  const [placements, setPlacements] = useState<PlacementData[]>(initialPlacements);
  const [isEditing, setIsEditing] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedPlacement, setSelectedPlacement] = useState<PlacementData | null>(null);
  const [popupTags, setPopupTags] = useState<TagPopupItem[]>([]);
  const [popupLoading, setPopupLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleGatewayClick = useCallback(async (placement: PlacementData) => {
    setSelectedPlacement(placement);
    setPopupTags([]);
    setPopupLoading(true);
    const res = await fetch(`/api/tags?gwMac=${placement.gwMac}&companyId=${companyId}`);
    if (res.ok) {
      const data = await res.json();
      setPopupTags(Array.isArray(data) ? data : []);
    }
    setPopupLoading(false);
  }, [companyId]);


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
        color: p.color ?? 'amber',
      })),
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
          {canEdit && (
            <>
              <Button
                variant={isEditing ? 'default' : 'outline'}
                size="sm"
                onClick={() => { setIsEditing(!isEditing); setSelectedPlacement(null); }}
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
                  onViewClick={!isEditing ? () => handleGatewayClick(p) : undefined}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar (edit mode only) */}
        {isEditing && (
          <div className="w-full md:w-64 shrink-0 md:sticky md:top-4 md:self-start">
            <GatewaySidebar
              gateways={allGateways}
              placedMacs={placedMacs}
            />
          </div>
        )}

        {/* Gateway tag popup (view mode only) */}
        {!isEditing && selectedPlacement && (
          <div className="w-full md:w-72 shrink-0 md:sticky md:top-4 md:self-start">
            <div className="border rounded-md bg-card shadow-sm">
              {/* Header */}
              <div className="flex items-center justify-between px-3 py-2 border-b">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    {selectedPlacement.isConnected
                      ? <Wifi className="h-3.5 w-3.5 text-green-500 shrink-0" />
                      : <WifiOff className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                    <span className="font-medium text-sm truncate">{selectedPlacement.gwName}</span>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">{selectedPlacement.gwMac}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => setSelectedPlacement(null)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Tag list */}
              <div className="p-3 space-y-2 max-h-96 overflow-y-auto">
                {popupLoading ? (
                  <p className="text-xs text-muted-foreground py-2 text-center">{tCommon('loading')}</p>
                ) : popupTags.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2 text-center">{t('noConnectedTags')}</p>
                ) : (
                  popupTags.map((tag) => (
                    <div key={tag.tagMac} className="rounded border bg-muted/40 px-2.5 py-2 text-xs space-y-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-medium truncate">{tag.tagName}</span>
                        {tag.assetType && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0 shrink-0">{tag.assetType}</Badge>
                        )}
                      </div>
                      <p className="font-mono text-muted-foreground">{tag.tagMac}</p>
                      {tag.latestSensing ? (
                        <div className="grid grid-cols-2 gap-x-2 text-muted-foreground">
                          <span>{tTags('temperature')}: <span className="text-foreground font-medium">{tag.latestSensing.temperature != null ? `${Number(tag.latestSensing.temperature).toFixed(1)}°C` : '-'}</span></span>
                          <span>{tTags('voltage')}: <span className="text-foreground font-medium">{tag.latestSensing.voltage != null ? `${Number(tag.latestSensing.voltage).toFixed(2)}V` : '-'}</span></span>
                          <span className="col-span-2 text-[10px]">{formatDateTime(tag.latestSensing.receivedTime, timezone)}</span>
                        </div>
                      ) : (
                        <p className="text-muted-foreground">{t('noSensingData')}</p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
