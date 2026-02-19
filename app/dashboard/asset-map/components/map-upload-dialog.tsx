'use client';

import { useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
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
import { Plus } from 'lucide-react';

interface MapUploadDialogProps {
  onCreated: () => void;
}

export function MapUploadDialog({ onCreated }: MapUploadDialogProps) {
  const t = useTranslations('assetMap');
  const tCommon = useTranslations('common');
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(f);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !name.trim()) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', name.trim());

    const res = await fetch('/api/asset-maps', { method: 'POST', body: formData });
    setLoading(false);

    if (res.ok) {
      setOpen(false);
      setName('');
      setFile(null);
      setPreview(null);
      onCreated();
    } else {
      const data = await res.json().catch(() => null);
      alert(data?.error || t('uploadFailed'));
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setName(''); setFile(null); setPreview(null); } }}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          {t('uploadMap')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
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
            <div className="border rounded-md overflow-hidden">
              <img src={preview} alt={t('preview')} className="w-full h-auto max-h-48 object-contain bg-muted" />
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
