'use client';

import { useState } from 'react';
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
import { formatMacDisplay, formatDateTime } from '@/lib/utils';
import { Pencil, Trash2 } from 'lucide-react';

export interface GatewayRow {
  gwMac: string;
  gwName: string;
  location?: string | null;
  description?: string | null;
  isActive?: boolean | null;
  isConnected?: boolean | null;
  fwVersion?: string | null;
  lastConnectedAt?: string | null;
}

interface GatewayTableProps {
  gateways: GatewayRow[];
  canEdit?: boolean;
  onEditSuccess?: () => void;
}

export function GatewayTable({ gateways, canEdit, onEditSuccess }: GatewayTableProps) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState<GatewayRow | null>(null);
  const [editing, setEditing] = useState<GatewayRow | null>(null);
  const [form, setForm] = useState({ gwName: '', location: '', description: '', isActive: true });
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  function openEdit(gw: GatewayRow) {
    setEditing(gw);
    setForm({
      gwName: gw.gwName,
      location: gw.location || '',
      description: gw.description || '',
      isActive: gw.isActive ?? true,
    });
    setEditOpen(true);
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setLoading(true);
    const res = await fetch(`/api/gateways/${encodeURIComponent(editing.gwMac)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        location: form.location || undefined,
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

  function openDelete(gw: GatewayRow) {
    setDeleting(gw);
    setDeleteOpen(true);
  }

  async function handleDelete() {
    if (!deleting) return;
    setDeleteLoading(true);
    const res = await fetch(`/api/gateways/${encodeURIComponent(deleting.gwMac)}`, {
      method: 'DELETE',
    });
    setDeleteLoading(false);
    if (res.ok) {
      setDeleteOpen(false);
      setDeleting(null);
      onEditSuccess ? onEditSuccess() : router.refresh();
    }
  }

  if (gateways.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        등록된 게이트웨이가 없습니다.
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
            <TableHead>위치</TableHead>
            <TableHead>상태</TableHead>
            <TableHead>FW 버전</TableHead>
            <TableHead>마지막 연결</TableHead>
            {canEdit && <TableHead className="w-24" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {gateways.map((gw) => (
            <TableRow key={gw.gwMac}>
              <TableCell className="font-mono text-sm">{formatMacDisplay(gw.gwMac)}</TableCell>
              <TableCell>{gw.gwName}</TableCell>
              <TableCell>{gw.location || '-'}</TableCell>
              <TableCell>
                <Badge variant={gw.isConnected ? 'default' : 'secondary'}>
                  {gw.isConnected ? '연결됨' : '끊김'}
                </Badge>
              </TableCell>
              <TableCell className="font-mono text-sm">{gw.fwVersion || '-'}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatDateTime(gw.lastConnectedAt)}
              </TableCell>
              {canEdit && (
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(gw)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openDelete(gw)} className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>게이트웨이 수정</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            {editing && (
              <div className="text-sm text-muted-foreground font-mono">
                MAC: {editing.gwMac}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="edit-gwName">이름</Label>
              <Input
                id="edit-gwName"
                value={form.gwName}
                onChange={(e) => setForm((f) => ({ ...f, gwName: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-location">위치</Label>
              <Input
                id="edit-location"
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                placeholder="7층 간호사실"
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
            <DialogTitle>게이트웨이 삭제</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {deleting?.gwName} ({deleting?.gwMac})을(를) 삭제하시겠습니까?
            <br />
            연결된 태그의 할당이 해제됩니다.
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
