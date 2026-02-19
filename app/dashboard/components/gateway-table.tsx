'use client';

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
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
import { Pencil, Trash2, ChevronDown, ChevronRight, Tag } from 'lucide-react';
import { useTimezone } from '../contexts/timezone-context';

export interface GatewayRow {
  gwMac: string;
  gwName: string;
  location?: string | null;
  description?: string | null;
  isActive?: boolean | null;
  isConnected?: boolean | null;
  fwVersion?: string | null;
  lastConnectedAt?: string | null;
  tagCount?: number;
}

interface TagInfo {
  tagMac: string;
  tagName: string;
  assetType?: string | null;
  isActive?: boolean;
  latestSensing?: { temperature?: string | null; voltage?: string | null; receivedTime?: string | null } | null;
}

interface GatewayTableProps {
  gateways: GatewayRow[];
  companyId?: string | null;
  canEdit?: boolean;
  onEditSuccess?: () => void;
}

export function GatewayTable({ gateways, companyId, canEdit, onEditSuccess }: GatewayTableProps) {
  const router = useRouter();
  const tGw = useTranslations('gateways');
  const tCommon = useTranslations('common');
  const tTag = useTranslations('tags');
  const timezone = useTimezone();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState<GatewayRow | null>(null);
  const [editing, setEditing] = useState<GatewayRow | null>(null);
  const [form, setForm] = useState({ gwName: '', location: '', description: '', isActive: true });
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [expandedGw, setExpandedGw] = useState<string | null>(null);
  const [tagsByGw, setTagsByGw] = useState<Record<string, TagInfo[]>>({});
  const [loadingTags, setLoadingTags] = useState<Record<string, boolean>>({});

  const fetchTagsForGateway = useCallback(async (gwMac: string) => {
    if (!companyId) return;
    setLoadingTags((prev) => ({ ...prev, [gwMac]: true }));
    const res = await fetch(`/api/tags?companyId=${companyId}&gwMac=${encodeURIComponent(gwMac)}`);
    if (res.ok) {
      const data = await res.json();
      setTagsByGw((prev) => ({ ...prev, [gwMac]: Array.isArray(data) ? data : [] }));
    }
    setLoadingTags((prev) => ({ ...prev, [gwMac]: false }));
  }, [companyId]);

  function toggleExpand(gw: GatewayRow) {
    const count = Number(gw.tagCount) || 0;
    if (count === 0) return;
    if (expandedGw === gw.gwMac) {
      setExpandedGw(null);
    } else {
      setExpandedGw(gw.gwMac);
      fetchTagsForGateway(gw.gwMac);
    }
  }

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
        {tGw('noGateways')}
      </div>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10" />
            <TableHead>{tCommon('macAddress')}</TableHead>
            <TableHead>{tCommon('name')}</TableHead>
            <TableHead>{tCommon('location')}</TableHead>
            <TableHead>{tGw('status')}</TableHead>
            <TableHead>{tGw('fwVersion')}</TableHead>
            <TableHead>{tGw('lastConnected')}</TableHead>
            <TableHead>{tGw('connectedTags')}</TableHead>
            {canEdit && <TableHead className="w-24" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {gateways.map((gw) => {
            const count = Number(gw.tagCount) || 0;
            const isExpanded = expandedGw === gw.gwMac;
            const tagList = tagsByGw[gw.gwMac];
            const isLoading = loadingTags[gw.gwMac];

            return (
              <React.Fragment key={gw.gwMac}>
                <TableRow>
                  <TableCell className="w-10 p-1">
                    {count > 0 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => toggleExpand(gw)}
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-sm">{formatMacDisplay(gw.gwMac)}</TableCell>
                  <TableCell>{gw.gwName}</TableCell>
                  <TableCell>{gw.location || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={gw.isConnected ? 'default' : 'secondary'}>
                      {gw.isConnected ? tGw('connected') : tGw('disconnected')}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{gw.fwVersion || '-'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDateTime(gw.lastConnectedAt, timezone)}
                  </TableCell>
                  <TableCell>
                    {count > 0 ? (
                      <button
                        type="button"
                        onClick={() => toggleExpand(gw)}
                        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Tag className="h-3.5 w-3.5" />
                        {tGw('tagCount', { count })}
                      </button>
                    ) : (
                      <span className="text-sm text-muted-foreground">{tGw('noConnectedTags')}</span>
                    )}
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
                {isExpanded && (
                  <TableRow>
                    <TableCell colSpan={canEdit ? 9 : 8} className="bg-muted/30 p-4">
                      <div className="space-y-2">
                        <div className="text-sm font-medium">{tGw('connectedTags')}</div>
                        {isLoading ? (
                          <div className="text-sm text-muted-foreground py-2">{tCommon('loading')}</div>
                        ) : tagList && tagList.length > 0 ? (
                          <div className="rounded-md border overflow-hidden">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b bg-muted/50">
                                  <th className="text-left p-2 font-medium">{tCommon('macAddress')}</th>
                                  <th className="text-left p-2 font-medium">{tCommon('name')}</th>
                                  <th className="text-left p-2 font-medium">{tTag('assetType')}</th>
                                  <th className="text-left p-2 font-medium">{tGw('status')}</th>
                                  <th className="text-left p-2 font-medium">{tTag('temperature')}</th>
                                  <th className="text-left p-2 font-medium">{tTag('voltage')}</th>
                                  <th className="text-left p-2 font-medium">{tTag('lastReceived')}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {tagList.map((tag) => (
                                  <tr key={tag.tagMac} className="border-b last:border-0 hover:bg-muted/30">
                                    <td className="p-2 font-mono">{formatMacDisplay(tag.tagMac)}</td>
                                    <td className="p-2">{tag.tagName}</td>
                                    <td className="p-2 text-muted-foreground">{tag.assetType ?? '-'}</td>
                                    <td className="p-2">
                                      <Badge variant={tag.isActive ? 'default' : 'secondary'}>
                                        {tag.isActive ? tCommon('active') : tCommon('none')}
                                      </Badge>
                                    </td>
                                    <td className="p-2">{tag.latestSensing?.temperature ?? '-'}</td>
                                    <td className="p-2">{tag.latestSensing?.voltage ?? '-'}</td>
                                    <td className="p-2 text-muted-foreground">
                                      {tag.latestSensing?.receivedTime
                                        ? formatDateTime(tag.latestSensing.receivedTime, timezone)
                                        : '-'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground py-2">{tGw('noConnectedTags')}</div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            );
          })}
        </TableBody>
      </Table>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tGw('editGateway')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            {editing && (
              <div className="text-sm text-muted-foreground font-mono">
                MAC: {editing.gwMac}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="edit-gwName">{tCommon('name')}</Label>
              <Input
                id="edit-gwName"
                value={form.gwName}
                onChange={(e) => setForm((f) => ({ ...f, gwName: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-location">{tCommon('location')}</Label>
              <Input
                id="edit-location"
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                placeholder={tGw('locationPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">{tCommon('description')}</Label>
              <Input
                id="edit-description"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder={tCommon('descriptionOptional')}
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
              <Label htmlFor="edit-isActive">{tCommon('active')}</Label>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? tCommon('saving') : tCommon('save')}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tGw('deleteGateway')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {tGw('deleteConfirm', { name: deleting?.gwName ?? '', mac: deleting?.gwMac ?? '' })}
            <br />
            {tGw('deleteWarning')}
          </p>
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleteLoading}>
              {tCommon('cancel')}
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteLoading}>
              {deleteLoading ? tCommon('deleting') : tCommon('delete')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
