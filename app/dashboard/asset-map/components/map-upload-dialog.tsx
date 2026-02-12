'use client';

import { useState, useRef } from 'react';
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
      alert(data?.error || '맵 생성에 실패했습니다');
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setName(''); setFile(null); setPreview(null); } }}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          맵 등록
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>자산 맵 등록</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mapName">맵 이름</Label>
            <Input
              id="mapName"
              placeholder="예: 7층 도면"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mapFile">도면 이미지</Label>
            <Input
              ref={fileInputRef}
              id="mapFile"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              required
            />
            <p className="text-xs text-muted-foreground">JPG, PNG, WebP (최대 10MB)</p>
          </div>
          {preview && (
            <div className="border rounded-md overflow-hidden">
              <img src={preview} alt="미리보기" className="w-full h-auto max-h-48 object-contain bg-muted" />
            </div>
          )}
          <Button type="submit" className="w-full" disabled={loading || !file}>
            {loading ? '업로드 중...' : '등록'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
