'use client';

import { useState, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus, Crop as CropIcon, RotateCcw } from 'lucide-react';

interface MapUploadDialogProps {
  onCreated: () => void;
}

function getCroppedBlob(
  image: HTMLImageElement,
  crop: PixelCrop,
  fileName: string,
): Promise<File> {
  const canvas = document.createElement('canvas');
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  canvas.width = crop.width * scaleX;
  canvas.height = crop.height * scaleY;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(new File([blob!], fileName, { type: 'image/png' }));
    }, 'image/png');
  });
}

export function MapUploadDialog({ onCreated }: MapUploadDialogProps) {
  const t = useTranslations('assetMap');
  const tCommon = useTranslations('common');
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [isCropping, setIsCropping] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setCrop(undefined);
    setCompletedCrop(undefined);
    setIsCropping(false);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(f);
  }

  const onImageLoad = useCallback(() => {
    // reset crop when new image loads
    setCrop(undefined);
    setCompletedCrop(undefined);
  }, []);

  function handleResetCrop() {
    setCrop(undefined);
    setCompletedCrop(undefined);
    setIsCropping(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !name.trim()) return;

    setLoading(true);

    let uploadFile = file;

    // 크롭이 적용된 경우 크롭된 이미지로 교체
    if (isCropping && completedCrop && imgRef.current &&
        completedCrop.width > 0 && completedCrop.height > 0) {
      try {
        uploadFile = await getCroppedBlob(imgRef.current, completedCrop, file.name);
      } catch {
        // 크롭 실패 시 원본 사용
      }
    }

    const formData = new FormData();
    formData.append('file', uploadFile);
    formData.append('name', name.trim());

    const res = await fetch('/api/asset-maps', { method: 'POST', body: formData });
    setLoading(false);

    if (res.ok) {
      setOpen(false);
      setName('');
      setFile(null);
      setPreview(null);
      setCrop(undefined);
      setCompletedCrop(undefined);
      setIsCropping(false);
      onCreated();
    } else {
      const data = await res.json().catch(() => null);
      alert(data?.error || t('uploadFailed'));
    }
  }

  function handleOpenChange(v: boolean) {
    setOpen(v);
    if (!v) {
      setName('');
      setFile(null);
      setPreview(null);
      setCrop(undefined);
      setCompletedCrop(undefined);
      setIsCropping(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          {t('uploadMap')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('uploadMapTitle')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mapName">{t('mapName')}</Label>
            <Input
              id="mapName"
              placeholder={t('mapNamePlaceholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mapFile">{t('mapImage')}</Label>
            <Input
              ref={fileInputRef}
              id="mapFile"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              required
            />
            <p className="text-xs text-muted-foreground">{t('mapImageHint')}</p>
          </div>
          {preview && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant={isCropping ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setIsCropping(!isCropping)}
                >
                  <CropIcon className="mr-1.5 h-3.5 w-3.5" />
                  {t('crop')}
                </Button>
                {isCropping && completedCrop && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleResetCrop}
                  >
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                    {t('cropReset')}
                  </Button>
                )}
              </div>
              <div className="border rounded-md overflow-hidden bg-muted">
                {isCropping ? (
                  <ReactCrop
                    crop={crop}
                    onChange={(c) => setCrop(c)}
                    onComplete={(c) => setCompletedCrop(c)}
                  >
                    <img
                      ref={imgRef}
                      src={preview}
                      alt={t('preview')}
                      className="w-full h-auto max-h-64 object-contain"
                      onLoad={onImageLoad}
                    />
                  </ReactCrop>
                ) : (
                  <img
                    src={preview}
                    alt={t('preview')}
                    className="w-full h-auto max-h-48 object-contain"
                  />
                )}
              </div>
              {isCropping && (
                <p className="text-xs text-muted-foreground">{t('cropHint')}</p>
              )}
            </div>
          )}
          <Button type="submit" className="w-full" disabled={loading || !file}>
            {loading ? t('uploading') : tCommon('register')}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
