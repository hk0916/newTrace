import { NextRequest } from 'next/server';
import { getSession, requireAuth, resolveCompanyId, isAdminOrAbove, apiError, apiSuccess } from '@/lib/api-utils';
import { db } from '@/lib/db';
import { assetMaps, assetMapGateways, gateways, gatewayStatus, tags } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { unlink } from 'fs/promises';
import path from 'path';

export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ mapId: string }> }
) {
  const { mapId } = await params;
  const session = await getSession();
  const authError = requireAuth(session);
  if (authError) return authError;

  const companyId = resolveCompanyId(session, req);
  if (!companyId) return apiError('회사를 선택해주세요', 400);

  const [map] = await db
    .select()
    .from(assetMaps)
    .where(and(eq(assetMaps.id, mapId), eq(assetMaps.companyId, companyId)))
    .limit(1);

  if (!map) return apiError('맵을 찾을 수 없습니다', 404);

  // Get placements with gateway info and tag count
  const placements = await db
    .select({
      id: assetMapGateways.id,
      gwMac: assetMapGateways.gwMac,
      gwName: gateways.gwName,
      xPercent: assetMapGateways.xPercent,
      yPercent: assetMapGateways.yPercent,
      widthPercent: assetMapGateways.widthPercent,
      heightPercent: assetMapGateways.heightPercent,
      color: assetMapGateways.color,
      isConnected: gatewayStatus.isConnected,
      tagCount: sql<number>`(SELECT COUNT(*) FROM tags WHERE assigned_gw_mac = "asset_map_gateways"."gw_mac" AND is_active = true)`.as('tag_count'),
    })
    .from(assetMapGateways)
    .innerJoin(gateways, eq(assetMapGateways.gwMac, gateways.gwMac))
    .leftJoin(gatewayStatus, eq(assetMapGateways.gwMac, gatewayStatus.gwMac))
    .where(eq(assetMapGateways.mapId, mapId));

  return apiSuccess({ ...map, placements, gatewayAreaColor: map.gatewayAreaColor ?? 'amber' });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ mapId: string }> }
) {
  const { mapId } = await params;
  const session = await getSession();
  const authError = requireAuth(session);
  if (authError) return authError;
  if (!isAdminOrAbove(session)) return apiError('관리자 권한이 필요합니다', 403);

  const companyId = resolveCompanyId(session, req);
  if (!companyId) return apiError('회사를 선택해주세요', 400);

  const [existing] = await db
    .select()
    .from(assetMaps)
    .where(and(eq(assetMaps.id, mapId), eq(assetMaps.companyId, companyId)))
    .limit(1);

  if (!existing) return apiError('맵을 찾을 수 없습니다', 404);

  const body = await req.json();
  const name = body.name?.trim();
  const gatewayAreaColor = body.gatewayAreaColor;
  if (!name && gatewayAreaColor === undefined) return apiError('변경할 항목이 없습니다', 400);

  const updateData: { name?: string; gatewayAreaColor?: string; updatedAt: Date } = { updatedAt: new Date() };
  if (name) updateData.name = name;
  if (gatewayAreaColor !== undefined) updateData.gatewayAreaColor = gatewayAreaColor;

  const [updated] = await db
    .update(assetMaps)
    .set(updateData)
    .where(eq(assetMaps.id, mapId))
    .returning();

  return apiSuccess(updated);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ mapId: string }> }
) {
  const { mapId } = await params;
  const session = await getSession();
  const authError = requireAuth(session);
  if (authError) return authError;
  if (!isAdminOrAbove(session)) return apiError('관리자 권한이 필요합니다', 403);

  const companyId = resolveCompanyId(session, req);
  if (!companyId) return apiError('회사를 선택해주세요', 400);

  const [existing] = await db
    .select()
    .from(assetMaps)
    .where(and(eq(assetMaps.id, mapId), eq(assetMaps.companyId, companyId)))
    .limit(1);

  if (!existing) return apiError('맵을 찾을 수 없습니다', 404);

  // Delete from DB (cascade deletes placements)
  await db.delete(assetMaps).where(eq(assetMaps.id, mapId));

  // Delete image file
  try {
    const filePath = path.join(process.cwd(), 'public', existing.imagePath);
    await unlink(filePath);
  } catch {
    // File may already be deleted
  }

  return apiSuccess({ success: true });
}
