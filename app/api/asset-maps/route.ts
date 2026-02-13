import { NextRequest } from 'next/server';
import { getSession, requireAuth, resolveCompanyId, isAdminOrAbove, apiError, apiSuccess } from '@/lib/api-utils';
import { db } from '@/lib/db';
import { assetMaps, assetMapGateways, companies } from '@/lib/db/schema';
import { eq, sql, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const session = await getSession();
  const authError = requireAuth(session);
  if (authError) return authError;

  const companyId = resolveCompanyId(session, req);
  if (!companyId) return apiError('회사를 선택해주세요', 400);

  const [companyRow] = await db
    .select({ dashboardMapId: companies.dashboardMapId })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);

  const maps = await db
    .select({
      id: assetMaps.id,
      name: assetMaps.name,
      imagePath: assetMaps.imagePath,
      imageWidth: assetMaps.imageWidth,
      imageHeight: assetMaps.imageHeight,
      createdAt: assetMaps.createdAt,
      gatewayCount: sql<number>`(SELECT COUNT(*) FROM asset_map_gateways WHERE map_id = ${assetMaps.id})`.as('gateway_count'),
    })
    .from(assetMaps)
    .where(eq(assetMaps.companyId, companyId))
    .orderBy(desc(assetMaps.createdAt));

  return apiSuccess({ maps, dashboardMapId: companyRow?.dashboardMapId ?? null });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  const authError = requireAuth(session);
  if (authError) return authError;
  if (!isAdminOrAbove(session)) return apiError('관리자 권한이 필요합니다', 403);

  const companyId = resolveCompanyId(session, req);
  if (!companyId) return apiError('회사를 선택해주세요', 400);

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const name = formData.get('name') as string | null;

  if (!file) return apiError('이미지 파일을 선택해주세요', 400);
  if (!name || name.trim().length === 0) return apiError('맵 이름을 입력해주세요', 400);

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    return apiError('JPG, PNG, WebP 형식만 지원합니다', 400);
  }

  if (file.size > 10 * 1024 * 1024) {
    return apiError('파일 크기는 10MB 이하만 가능합니다', 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const id = uuidv4();

  const extMap: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  };
  const ext = extMap[file.type] || 'png';

  // Resize to max 1920px longest side
  const image = sharp(buffer);
  const metadata = await image.metadata();
  const origWidth = metadata.width || 1920;
  const origHeight = metadata.height || 1080;

  let resized = image;
  const maxDim = 1920;
  if (origWidth > maxDim || origHeight > maxDim) {
    resized = image.resize({
      width: origWidth > origHeight ? maxDim : undefined,
      height: origHeight >= origWidth ? maxDim : undefined,
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  const outputBuffer = await resized.toBuffer();
  const finalMeta = await sharp(outputBuffer).metadata();
  const finalWidth = finalMeta.width || origWidth;
  const finalHeight = finalMeta.height || origHeight;

  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'maps');
  await mkdir(uploadDir, { recursive: true });

  const filename = `${id}.${ext}`;
  const filePath = path.join(uploadDir, filename);
  await writeFile(filePath, outputBuffer);

  const imagePath = `/uploads/maps/${filename}`;

  const [created] = await db.insert(assetMaps).values({
    id,
    companyId,
    name: name.trim(),
    imagePath,
    imageWidth: finalWidth,
    imageHeight: finalHeight,
  }).returning();

  return apiSuccess(created, 201);
}
