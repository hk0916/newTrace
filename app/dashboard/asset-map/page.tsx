'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCompanyId } from '../hooks/use-company-id';
import { setCompanyIdCookie } from '@/lib/company-cookie';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AssetMapList, type AssetMapItem } from './components/asset-map-list';
import { MapUploadDialog } from './components/map-upload-dialog';
import { AssetMapViewer } from './components/asset-map-viewer';
import type { PlacementData } from './components/gateway-placement';
import type { GatewayItem } from './components/gateway-sidebar';

function AssetMapPageContent() {
  const { data: session } = useSession();
  const router = useRouter();
  const companyId = useCompanyId();
  const t = useTranslations('assetMap');
  const tCommon = useTranslations('common');
  const [maps, setMaps] = useState<AssetMapItem[]>([]);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [selectedMap, setSelectedMap] = useState<AssetMapItem | null>(null);
  const [mapDetail, setMapDetail] = useState<{
    placements: PlacementData[];
    gatewayAreaColor?: string;
    allGateways: GatewayItem[];
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const canEdit = session?.user?.role === 'super' || session?.user?.role === 'admin';

  useEffect(() => {
    if (session?.user?.role === 'super' && (!companyId || companyId === 'super')) {
      router.replace('/dashboard');
    }
  }, [session?.user?.role, companyId, router]);

  useEffect(() => {
    if (session?.user?.role === 'super') {
      fetch('/api/companies').then((r) => r.ok ? r.json().then(setCompanies) : undefined);
    }
  }, [session?.user?.role]);

  const fetchMaps = useCallback(async () => {
    if (!companyId) return;
    const params = new URLSearchParams({ companyId });
    const res = await fetch(`/api/asset-maps?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      const list = data?.maps ?? (Array.isArray(data) ? data : []);
      setMaps(list);
    }
  }, [companyId]);

  useEffect(() => {
    fetchMaps();
  }, [fetchMaps]);

  const fetchMapDetail = useCallback(async (mapId: string) => {
    setLoading(true);
    const [mapRes, gwRes] = await Promise.all([
      fetch(`/api/asset-maps/${mapId}`),
      fetch(`/api/gateways?companyId=${companyId}`),
    ]);

    if (mapRes.ok && gwRes.ok) {
      const mapData = await mapRes.json();
      const gwData = await gwRes.json();

      const gwList: GatewayItem[] = (Array.isArray(gwData) ? gwData : []).map(
        (gw: Record<string, unknown>) => ({
          gwMac: gw.gwMac as string,
          gwName: gw.gwName as string,
          isConnected: gw.isConnected as boolean ?? false,
          tagCount: 0,
        })
      );

      const placementTagCounts = new Map<string, number>();
      for (const p of mapData.placements || []) {
        placementTagCounts.set(p.gwMac, Number(p.tagCount) || 0);
      }

      const tagsRes = await fetch(`/api/tags?companyId=${companyId}`);
      const tagsData = tagsRes.ok ? await tagsRes.json() : [];
      const tagCountMap = new Map<string, number>();
      for (const tag of Array.isArray(tagsData) ? tagsData : []) {
        const mac = tag.assignedGwMac;
        if (mac) {
          tagCountMap.set(mac, (tagCountMap.get(mac) || 0) + 1);
        }
      }

      const enrichedGwList = gwList.map((gw) => ({
        ...gw,
        tagCount: tagCountMap.get(gw.gwMac) || 0,
      }));

      const placements: PlacementData[] = (mapData.placements || []).map(
        (p: Record<string, unknown>) => ({
          id: p.id as string,
          gwMac: p.gwMac as string,
          gwName: p.gwName as string,
          xPercent: Number(p.xPercent),
          yPercent: Number(p.yPercent),
          widthPercent: Number(p.widthPercent),
          heightPercent: Number(p.heightPercent),
          tagCount: Number(p.tagCount) || 0,
          isConnected: p.isConnected as boolean ?? false,
          color: (p.color as string) ?? 'amber',
        })
      );

      setMapDetail({
        placements,
        gatewayAreaColor: mapData.gatewayAreaColor as string | undefined,
        allGateways: enrichedGwList,
      });
    }
    setLoading(false);
  }, [companyId]);

  function handleSelectMap(map: AssetMapItem) {
    setSelectedMap(map);
    fetchMapDetail(map.id);
  }

  async function handleDeleteMap(mapId: string) {
    const res = await fetch(`/api/asset-maps/${mapId}`, { method: 'DELETE' });
    if (res.ok) {
      fetchMaps();
    } else {
      const data = await res.json().catch(() => null);
      alert(data?.error || t('deleteFailed'));
    }
  }

  function handleBack() {
    setSelectedMap(null);
    setMapDetail(null);
    fetchMaps();
  }

  if (selectedMap && mapDetail) {
    return (
      <AssetMapViewer
        mapId={selectedMap.id}
        mapName={selectedMap.name}
        imagePath={selectedMap.imagePath}
        imageWidth={selectedMap.imageWidth}
        imageHeight={selectedMap.imageHeight}
        initialPlacements={mapDetail.placements}
        initialGatewayAreaColor={mapDetail.gatewayAreaColor}
        allGateways={mapDetail.allGateways}
        canEdit={canEdit}
        companyId={companyId || ''}
        onBack={handleBack}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <div className="flex items-center gap-2 flex-nowrap">
          {session?.user?.role === 'super' && companies.length > 0 && (
            <Select
              value={companyId || ''}
              onValueChange={(v) => {
                setCompanyIdCookie(v);
                router.replace('/dashboard/asset-map');
              }}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder={tCommon('selectCompany')} />
              </SelectTrigger>
              <SelectContent>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {canEdit && <MapUploadDialog onCreated={fetchMaps} />}
        </div>
      </div>

      {loading ? (
        <div className="py-8 text-center text-muted-foreground">{tCommon('loading')}</div>
      ) : (
        <AssetMapList
          maps={maps}
          canEdit={canEdit}
          onSelect={handleSelectMap}
          onDelete={handleDeleteMap}
          onToggleDashboard={canEdit ? async (mapId) => {
            const res = await fetch(`/api/asset-maps/${mapId}/set-dashboard?companyId=${companyId}`, {
              method: 'POST',
            });
            if (res.ok) {
              const data = await res.json().catch(() => null);
              // 낙관적 업데이트: 서버 응답의 showOnDashboard 값으로 즉시 반영
              setMaps((prev) => prev.map((m) =>
                m.id === mapId ? { ...m, showOnDashboard: data?.showOnDashboard ?? !m.showOnDashboard } : m
              ));
            } else {
              const data = await res.json().catch(() => null);
              alert(data?.error || t('deleteFailed'));
            }
          } : undefined}
        />
      )}
    </div>
  );
}

export default function AssetMapPage() {
  const t = useTranslations('common');
  return (
    <Suspense fallback={<div className="py-8 text-center text-muted-foreground">{t('loading')}</div>}>
      <AssetMapPageContent />
    </Suspense>
  );
}
