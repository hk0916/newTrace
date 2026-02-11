'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn, formatMacDisplay, formatDateTime } from '@/lib/utils';
import { Pencil, Trash2 } from 'lucide-react';

export interface TagRow {
  tagMac: string;
  tagName: string;
  assetType?: string | null;
  assignedGwMac?: string | null;
  reportInterval?: number;
  description?: string | null;
  isActive?: boolean;
  latestSensing?: {
    gwMac?: string | null;
    temperature?: string | null;
    voltage?: string | null;
    rssi?: number | null;
    receivedTime?: string | null;
  } | null;
}

interface TagTableProps {
  tags: TagRow[];
  canEdit?: boolean;
  onEditSuccess?: () => void;
  companyId?: string | null;
}

function tempColor(temp: number): string {
  if (temp > 40) return 'text-red-600 font-bold';
  if (temp > 30) return 'text-orange-500';
  if (temp < 0) return 'text-blue-600 font-bold';
  if (temp < 15) return 'text-blue-400';
  return '';
}

function voltBadge(volt: number) {
  if (volt < 2.0) return <Badge variant="destructive">위험</Badge>;
  if (volt < 2.5) return <Badge variant="secondary">주의</Badge>;
  return null;
}

export function TagTable({ tags, canEdit, onEditSuccess, companyId }: TagTableProps) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState<TagRow | null>(null);
  const [editing, setEditing] = useState<TagRow | null>(null);
  const [gateways, setGateways] = useState<{ gwMac: string; gwName: string }[]>([]);
  const [form, setForm] = useState({
    tagName: '',
    assignedGwMac: '',
    reportInterval: '60',
    assetType: '',
    description: '',
    isActive: true,
  });
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    if (canEdit && companyId && editOpen) {
      fetch(`/api/gateways?companyId=${companyId}`)
        .then((r) => r.ok && r.json())
        .then((data) => setGateways(Array.isArray(data) ? data : []));
    }
  }, [canEdit, companyId, editOpen]);

  function openEdit(tag: TagRow) {
    setEditing(tag);
    setForm({
      tagName: tag.tagName,
      assignedGwMac: tag.assignedGwMac || '',
      reportInterval: String(tag.reportInterval ?? 60),
      assetType: tag.assetType || '',
      description: tag.description || '',
      isActive: tag.isActive ?? true,
    });
    setEditOpen(true);
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setLoading(true);
    const res = await fetch(`/api/tags/${encodeURIComponent(editing.tagMac)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        reportInterval: parseInt(form.reportInterval, 10),
        assignedGwMac: form.assignedGwMac ? form.assignedGwMac : null,
        assetType: form.assetType || undefined,
        description: form.description || undefined,
      }),
    });
    setLoading(false);
    if (res.ok) {
      setEditOpen(false);
      setEditing(null);
      onEditSuccess ? onEditSuccess() : router.refresh();
    }
  }

  function openDelete(tag: TagRow) {
    setDeleting(tag);
    setDeleteOpen(true);
  }

  async function handleDelete() {
    if (!deleting) return;
    setDeleteLoading(true);
    const res = await fetch(`/api/tags/${encodeURIComponent(deleting.tagMac)}`, {
      method: 'DELETE',
    });
    setDeleteLoading(false);
    if (res.ok) {
      setDeleteOpen(false);
      setDeleting(null);
      onEditSuccess ? onEditSuccess() : router.refresh();
    }
  }

  if (tags.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        등록된 태그가 없습니다.
      </div>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>MAC 주소</TableHead>
            <TableHead>이름</TableHead>
            <TableHead>자산 유형</TableHead>
            <TableHead>게이트웨이</TableHead>
            <TableHead>온도</TableHead>
            <TableHead>전압</TableHead>
            <TableHead>RSSI</TableHead>
            <TableHead>마지막 수신</TableHead>
            {canEdit && <TableHead className="w-24" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {tags.map((tag) => {
            const temp = tag.latestSensing?.temperature ? parseFloat(tag.latestSensing.temperature) : null;
            const volt = tag.latestSensing?.voltage ? parseFloat(tag.latestSensing.voltage) : null;

            return (
              <TableRow key={tag.tagMac}>
                <TableCell className="font-mono text-sm">{formatMacDisplay(tag.tagMac)}</TableCell>
                <TableCell>{tag.tagName}</TableCell>
                <TableCell>{tag.assetType || '-'}</TableCell>
                <TableCell className="font-mono text-sm">
                  {formatMacDisplay(tag.latestSensing?.gwMac ?? tag.assignedGwMac)}
                </TableCell>
                <TableCell>
                  {temp !== null ? (
                    <span className={cn(tempColor(temp))}>{temp.toFixed(1)}°C</span>
                  ) : '-'}
                </TableCell>
                <TableCell>
                  <span className="flex items-center gap-1">
                    {volt !== null ? `${volt.toFixed(2)}V` : '-'}
                    {volt !== null && voltBadge(volt)}
                  </span>
                </TableCell>
                <TableCell>{tag.latestSensing?.rssi ?? '-'}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDateTime(tag.latestSensing?.receivedTime)}
                </TableCell>
                {canEdit && (
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(tag)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openDelete(tag)} className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>태그 수정</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            {editing && (
              <div className="text-sm text-muted-foreground font-mono">
                MAC: {editing.tagMac}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="edit-tagName">이름</Label>
              <Input
                id="edit-tagName"
                value={form.tagName}
                onChange={(e) => setForm((f) => ({ ...f, tagName: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-assignedGwMac">할당 게이트웨이</Label>
              <Select
                value={form.assignedGwMac || 'none'}
                onValueChange={(v) => setForm((f) => ({ ...f, assignedGwMac: v === 'none' ? '' : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="선택 (없음)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">없음</SelectItem>
                  {gateways.map((gw) => (
                    <SelectItem key={gw.gwMac} value={gw.gwMac}>
                      {gw.gwName} ({gw.gwMac})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-reportInterval">보고 주기 (초)</Label>
              <Input
                id="edit-reportInterval"
                type="number"
                min="1"
                value={form.reportInterval}
                onChange={(e) => setForm((f) => ({ ...f, reportInterval: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-assetType">자산 유형</Label>
              <Input
                id="edit-assetType"
                value={form.assetType}
                onChange={(e) => setForm((f) => ({ ...f, assetType: e.target.value }))}
                placeholder="의료장비, 자산 등"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">설명</Label>
              <Input
                id="edit-description"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="설명 (선택)"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="edit-isActive"
                checked={form.isActive}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                className="h-4 w-4 rounded"
              />
              <Label htmlFor="edit-isActive">활성</Label>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? '저장 중...' : '저장'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>태그 삭제</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {deleting?.tagName} ({deleting?.tagMac})을(를) 삭제하시겠습니까?
            <br />
            센싱 데이터도 함께 삭제됩니다.
          </p>
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleteLoading}>
              취소
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteLoading}>
              {deleteLoading ? '삭제 중...' : '삭제'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
