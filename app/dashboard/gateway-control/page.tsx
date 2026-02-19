'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MoreHorizontal, RefreshCw, Settings2, Upload, AlertTriangle } from 'lucide-react';
import { useCompanyId } from '../hooks/use-company-id';
import { setCompanyIdCookie } from '@/lib/company-cookie';

interface GatewayControlRow {
  gwMac: string;
  gwName: string;
  companyId: string;
  isConnected: boolean | null;
  fwVersion: string | null;
  hwVersion: string | null;
  otaServerUrl: string | null;
  wsServerUrl: string | null;
  reportInterval: number | null;
  rssiFilter: number | null;
  lastConnectedAt: string | null;
}

type CommandType =
  | 'request-info'
  | 'set-ota-url'
  | 'set-ws-url'
  | 'set-report-interval'
  | 'set-rssi-filter'
  | 'cmd-ota';

interface CommandDialogState {
  open: boolean;
  command: CommandType | null;
  gwMac: string;
  gwName: string;
  title: string;
  description: string;
  inputLabel: string;
  inputType: 'text' | 'number';
  inputPlaceholder: string;
  defaultValue: string;
  isConfirm: boolean;
}

const initialDialogState: CommandDialogState = {
  open: false,
  command: null,
  gwMac: '',
  gwName: '',
  title: '',
  description: '',
  inputLabel: '',
  inputType: 'text',
  inputPlaceholder: '',
  defaultValue: '',
  isConfirm: false,
};

function GatewayControlContent() {
  const { data: session } = useSession();
  const router = useRouter();
  const companyId = useCompanyId();
  const t = useTranslations('gatewayControl');
  const tCommon = useTranslations('common');
  const [gateways, setGateways] = useState<GatewayControlRow[]>([]);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialog, setDialog] = useState<CommandDialogState>(initialDialogState);
  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<Record<string, { success: boolean; message: string }>>({});

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

  const fetchGateways = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    const params = new URLSearchParams({ companyId });
    const res = await fetch(`/api/gateways?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      setGateways(Array.isArray(data) ? data : []);
    }
    setLoading(false);
  }, [companyId]);

  useEffect(() => {
    fetchGateways();
  }, [fetchGateways]);

  async function sendCommand(gwMac: string, command: CommandType, payload?: Record<string, unknown>) {
    setSending(true);
    try {
      const body: Record<string, unknown> = { gwMac, command };
      if (payload) body.payload = payload;

      const res = await fetch('/api/gateway-control/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setFeedback((prev) => ({
          ...prev,
          [gwMac]: { success: true, message: t('sendSuccess', { count: data.sent }) },
        }));
      } else if (res.ok && data.sent > 0) {
        setFeedback((prev) => ({
          ...prev,
          [gwMac]: { success: true, message: t('sendPartial', { sent: data.sent, failed: data.failed }) },
        }));
      } else {
        const errorMsg = data.error || data.results?.[0]?.error || t('sendFailed');
        setFeedback((prev) => ({
          ...prev,
          [gwMac]: { success: false, message: errorMsg },
        }));
      }
    } catch {
      setFeedback((prev) => ({
        ...prev,
        [gwMac]: { success: false, message: t('serverConnectionFailed') },
      }));
    } finally {
      setSending(false);
      setTimeout(() => {
        setFeedback((prev) => {
          const next = { ...prev };
          delete next[gwMac];
          return next;
        });
      }, 3000);
    }
  }

  function openCommandDialog(gw: GatewayControlRow, command: CommandType) {
    const configs: Record<CommandType, Partial<CommandDialogState>> = {
      'request-info': {
        title: t('requestInfoTitle'),
        description: t('requestInfoDesc', { name: gw.gwName, mac: gw.gwMac }),
        isConfirm: true,
      },
      'set-ota-url': {
        title: t('setOtaUrlTitle'),
        description: t('setOtaUrlDesc', { name: gw.gwName, mac: gw.gwMac }),
        inputLabel: t('setOtaUrlLabel'),
        inputType: 'text',
        inputPlaceholder: 'http://ota.example.com/firmware',
        defaultValue: gw.otaServerUrl || '',
      },
      'set-ws-url': {
        title: t('setWsUrlTitle'),
        description: t('setWsUrlDesc', { name: gw.gwName, mac: gw.gwMac }),
        inputLabel: t('setWsUrlLabel'),
        inputType: 'text',
        inputPlaceholder: 'ws://ws.example.com:8080',
        defaultValue: gw.wsServerUrl || '',
      },
      'set-report-interval': {
        title: t('setReportIntervalTitle'),
        description: t('setReportIntervalDesc', { name: gw.gwName, mac: gw.gwMac }),
        inputLabel: t('setReportIntervalLabel'),
        inputType: 'number',
        inputPlaceholder: '10',
        defaultValue: gw.reportInterval?.toString() || '10',
      },
      'set-rssi-filter': {
        title: t('setRssiFilterTitle'),
        description: t('setRssiFilterDesc', { name: gw.gwName, mac: gw.gwMac }),
        inputLabel: t('setRssiFilterLabel'),
        inputType: 'number',
        inputPlaceholder: '-70',
        defaultValue: gw.rssiFilter?.toString() || '-70',
      },
      'cmd-ota': {
        title: t('cmdOtaTitle'),
        description: t('cmdOtaDesc', { name: gw.gwName, mac: gw.gwMac }),
        inputLabel: t('cmdOtaLabel'),
        inputType: 'text',
        inputPlaceholder: 'http://ota.example.com/firmware.bin',
        defaultValue: gw.otaServerUrl || '',
      },
    };

    const config = configs[command];
    setDialog({
      open: true,
      command,
      gwMac: gw.gwMac,
      gwName: gw.gwName,
      title: config.title || '',
      description: config.description || '',
      inputLabel: config.inputLabel || '',
      inputType: config.inputType || 'text',
      inputPlaceholder: config.inputPlaceholder || '',
      defaultValue: config.defaultValue || '',
      isConfirm: config.isConfirm || false,
    });
    setInputValue(config.defaultValue || '');
  }

  async function handleDialogSubmit() {
    if (!dialog.command) return;

    let payload: Record<string, unknown> | undefined;

    switch (dialog.command) {
      case 'request-info':
        break;
      case 'set-ota-url':
      case 'set-ws-url':
        payload = { url: inputValue };
        break;
      case 'set-report-interval':
        payload = { seconds: Number(inputValue) };
        break;
      case 'set-rssi-filter':
        payload = { value: Number(inputValue) };
        break;
      case 'cmd-ota':
        payload = { url: inputValue };
        break;
    }

    const targetMac = dialog.gwMac;
    const cmd = dialog.command;
    await sendCommand(targetMac, cmd, payload);
    setDialog(initialDialogState);

    if (cmd !== 'request-info') {
      await sendCommand(targetMac, 'request-info');
    }
    setTimeout(fetchGateways, 2000);
  }

  async function handleBatchAction(command: CommandType, payload?: Record<string, unknown>) {
    await sendCommand('all', command, payload);
    if (command !== 'request-info') {
      await sendCommand('all', 'request-info');
    }
    setTimeout(fetchGateways, 2000);
  }

  const [batchOtaDialog, setBatchOtaDialog] = useState(false);
  const [batchOtaUrl, setBatchOtaUrl] = useState('');

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
                router.replace('/dashboard/gateway-control');
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
          <Button
            variant="outline"
            onClick={() => handleBatchAction('request-info')}
            disabled={sending}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            {t('refreshAll')}
          </Button>
          <Button
            variant="destructive"
            onClick={() => setBatchOtaDialog(true)}
            disabled={sending}
          >
            <Upload className="mr-2 h-4 w-4" />
            {t('bulkOta')}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="py-8 text-center text-muted-foreground">{tCommon('loading')}</div>
      ) : gateways.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground">{t('noGateways')}</div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>MAC</TableHead>
                <TableHead>{tCommon('name')}</TableHead>
                <TableHead>{t('connection')}</TableHead>
                <TableHead>FW</TableHead>
                <TableHead>OTA URL</TableHead>
                <TableHead>WS URL</TableHead>
                <TableHead>Interval</TableHead>
                <TableHead>RSSI</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {gateways.map((gw) => (
                <TableRow key={gw.gwMac}>
                  <TableCell className="font-mono text-xs">{gw.gwMac}</TableCell>
                  <TableCell>{gw.gwName}</TableCell>
                  <TableCell>
                    <Badge variant={gw.isConnected ? 'default' : 'secondary'}>
                      {gw.isConnected ? t('connectionConnected') : t('connectionDisconnected')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">{gw.fwVersion || '-'}</TableCell>
                  <TableCell className="max-w-[200px] truncate text-xs" title={gw.otaServerUrl || ''}>
                    {gw.otaServerUrl || '-'}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-xs" title={gw.wsServerUrl || ''}>
                    {gw.wsServerUrl || '-'}
                  </TableCell>
                  <TableCell>{gw.reportInterval != null ? `${gw.reportInterval}s` : '-'}</TableCell>
                  <TableCell>{gw.rssiFilter != null ? `${gw.rssiFilter}` : '-'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {feedback[gw.gwMac] && (
                        <span className={`text-xs ${feedback[gw.gwMac].success ? 'text-green-600' : 'text-red-600'}`}>
                          {feedback[gw.gwMac].message}
                        </span>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openCommandDialog(gw, 'request-info')}>
                            <RefreshCw className="mr-2 h-4 w-4" />
                            {t('requestInfo')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openCommandDialog(gw, 'set-ota-url')}>
                            <Settings2 className="mr-2 h-4 w-4" />
                            {t('setOtaUrl')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openCommandDialog(gw, 'set-ws-url')}>
                            <Settings2 className="mr-2 h-4 w-4" />
                            {t('setWsUrl')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openCommandDialog(gw, 'set-report-interval')}>
                            <Settings2 className="mr-2 h-4 w-4" />
                            {t('setReportInterval')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openCommandDialog(gw, 'set-rssi-filter')}>
                            <Settings2 className="mr-2 h-4 w-4" />
                            {t('setRssiFilter')}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => openCommandDialog(gw, 'cmd-ota')}
                            className="text-destructive"
                          >
                            <Upload className="mr-2 h-4 w-4" />
                            {t('cmdOta')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* 명령 입력 다이얼로그 */}
      <Dialog open={dialog.open} onOpenChange={(open) => !open && setDialog(initialDialogState)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {dialog.command === 'cmd-ota' && <AlertTriangle className="h-5 w-5 text-destructive" />}
              {dialog.title}
            </DialogTitle>
            <DialogDescription>{dialog.description}</DialogDescription>
          </DialogHeader>
          {dialog.command === 'cmd-ota' && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {t('cmdOtaWarning')}
            </div>
          )}
          {!dialog.isConfirm && (
            <div className="space-y-2">
              <Label>{dialog.inputLabel}</Label>
              <Input
                type={dialog.inputType}
                placeholder={dialog.inputPlaceholder}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(initialDialogState)}>
              {tCommon('cancel')}
            </Button>
            <Button
              variant={dialog.command === 'cmd-ota' ? 'destructive' : 'default'}
              onClick={handleDialogSubmit}
              disabled={sending || (!dialog.isConfirm && !inputValue)}
            >
              {sending ? tCommon('sending') : tCommon('send')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 전체 OTA 확인 다이얼로그 */}
      <Dialog open={batchOtaDialog} onOpenChange={setBatchOtaDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              {t('batchOtaTitle')}
            </DialogTitle>
            <DialogDescription>
              {t('batchOtaDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {t('batchOtaWarning')}
          </div>
          <div className="space-y-2">
            <Label>{t('batchOtaLabel')}</Label>
            <Input
              type="text"
              placeholder="http://ota.example.com/firmware.bin"
              value={batchOtaUrl}
              onChange={(e) => setBatchOtaUrl(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchOtaDialog(false)}>
              {tCommon('cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                setBatchOtaDialog(false);
                await handleBatchAction('cmd-ota', { url: batchOtaUrl });
              }}
              disabled={sending || !batchOtaUrl}
            >
              {sending ? tCommon('sending') : t('batchOtaExecute')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function GatewayControlPage() {
  const t = useTranslations('common');
  return (
    <Suspense fallback={<div className="py-8 text-center text-muted-foreground">{t('loading')}</div>}>
      <GatewayControlContent />
    </Suspense>
  );
}
