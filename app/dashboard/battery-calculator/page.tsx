'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Battery, Wifi, Radio, Ship, Zap, Clock, AlertTriangle, CheckCircle2, Info } from 'lucide-react';

interface DeviceConfig {
  gatewayWatt: number;
  gatewayCount: number;
  internetType: 'lte' | 'starlink_mini' | 'starlink_standard';
  internetWatt: number;
  batteryCapacityMah: number;
  batteryVoltage: number;
  conversionEfficiency: number;
  capacityUnit: 'mah' | 'wh';
  batteryCapacityWh: number;
}

const PRESETS = {
  lte: { watt: 4, label: 'LTE Egg' },
  starlink_mini: { watt: 40, label: 'Starlink Mini' },
  starlink_standard: { watt: 75, label: 'Starlink Standard' },
} as const;

const BATTERY_PRESETS = [
  { label: '20,000 mAh', mah: 20000, wh: 74 },
  { label: '30,000 mAh', mah: 30000, wh: 111 },
  { label: '50,000 mAh', mah: 50000, wh: 185 },
  { label: '100Ah (100,000 mAh)', mah: 100000, wh: 370 },
  { label: '500Wh Station', mah: 0, wh: 500 },
  { label: '1,000Wh Station', mah: 0, wh: 1000 },
  { label: '2,000Wh Station', mah: 0, wh: 2000 },
  { label: '5,000Wh Station', mah: 0, wh: 5000 },
];

export default function BatteryCalculatorPage() {
  const t = useTranslations('batteryCalc');

  const [config, setConfig] = useState<DeviceConfig>({
    gatewayWatt: 1.5,
    gatewayCount: 1,
    internetType: 'lte',
    internetWatt: PRESETS.lte.watt,
    batteryCapacityMah: 20000,
    batteryVoltage: 3.7,
    conversionEfficiency: 85,
    capacityUnit: 'mah',
    batteryCapacityWh: 74,
  });

  const result = useMemo(() => {
    const totalGatewayWatt = config.gatewayWatt * config.gatewayCount;
    const totalWatt = totalGatewayWatt + config.internetWatt;

    let batteryWh: number;
    if (config.capacityUnit === 'mah') {
      batteryWh = (config.batteryCapacityMah * config.batteryVoltage) / 1000;
    } else {
      batteryWh = config.batteryCapacityWh;
    }

    const usableWh = batteryWh * (config.conversionEfficiency / 100);
    const runtimeHours = usableWh / totalWatt;
    const runtimeDays = runtimeHours / 24;

    return {
      totalGatewayWatt,
      totalWatt,
      batteryWh,
      usableWh,
      runtimeHours,
      runtimeDays,
    };
  }, [config]);

  const updateConfig = (patch: Partial<DeviceConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }));
  };

  const handleInternetTypeChange = (type: 'lte' | 'starlink_mini' | 'starlink_standard') => {
    updateConfig({
      internetType: type,
      internetWatt: PRESETS[type].watt,
    });
  };

  const handleBatteryPreset = (index: string) => {
    const preset = BATTERY_PRESETS[parseInt(index)];
    if (!preset) return;
    if (preset.mah > 0) {
      updateConfig({
        capacityUnit: 'mah',
        batteryCapacityMah: preset.mah,
        batteryCapacityWh: preset.wh,
      });
    } else {
      updateConfig({
        capacityUnit: 'wh',
        batteryCapacityWh: preset.wh,
      });
    }
  };

  const getRuntimeColor = (days: number) => {
    if (days >= 7) return 'text-green-600';
    if (days >= 3) return 'text-blue-600';
    if (days >= 1) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getRuntimeIcon = (days: number) => {
    if (days >= 3) return <CheckCircle2 className="h-5 w-5 text-green-600" />;
    if (days >= 1) return <Info className="h-5 w-5 text-yellow-600" />;
    return <AlertTriangle className="h-5 w-5 text-red-600" />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Battery className="h-6 w-6" />
          {t('title')}
        </h1>
        <p className="text-muted-foreground mt-1">{t('description')}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column: Configuration */}
        <div className="space-y-6">
          {/* Gateway Config */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Radio className="h-5 w-5" />
                {t('gatewayConfig')}
              </CardTitle>
              <CardDescription>{t('gatewayConfigDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('gatewayCount')}</Label>
                  <Input
                    type="number"
                    min={1}
                    max={50}
                    value={config.gatewayCount}
                    onChange={(e) => updateConfig({ gatewayCount: Math.max(1, parseInt(e.target.value) || 1) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('gatewayPower')}</Label>
                  <Input
                    type="number"
                    min={0.1}
                    step={0.1}
                    value={config.gatewayWatt}
                    onChange={(e) => updateConfig({ gatewayWatt: parseFloat(e.target.value) || 0.1 })}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {t('gatewayPowerHint')}
              </p>
            </CardContent>
          </Card>

          {/* Internet Config */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Wifi className="h-5 w-5" />
                {t('internetConfig')}
              </CardTitle>
              <CardDescription>{t('internetConfigDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{t('internetType')}</Label>
                <Select
                  value={config.internetType}
                  onValueChange={(v) => handleInternetTypeChange(v as DeviceConfig['internetType'])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lte">LTE Egg (~4W)</SelectItem>
                    <SelectItem value="starlink_mini">Starlink Mini (~40W)</SelectItem>
                    <SelectItem value="starlink_standard">Starlink Standard (~75W)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('internetPower')}</Label>
                <Input
                  type="number"
                  min={0.1}
                  step={0.5}
                  value={config.internetWatt}
                  onChange={(e) => updateConfig({ internetWatt: parseFloat(e.target.value) || 0.1 })}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {t('internetPowerHint')}
              </p>
            </CardContent>
          </Card>

          {/* Battery Config */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Zap className="h-5 w-5" />
                {t('batteryConfig')}
              </CardTitle>
              <CardDescription>{t('batteryConfigDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{t('batteryPreset')}</Label>
                <Select onValueChange={handleBatteryPreset}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('selectPreset')} />
                  </SelectTrigger>
                  <SelectContent>
                    {BATTERY_PRESETS.map((preset, idx) => (
                      <SelectItem key={idx} value={String(idx)}>
                        {preset.label} ({preset.wh}Wh)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>{t('capacityUnit')}</Label>
                <Select
                  value={config.capacityUnit}
                  onValueChange={(v) => updateConfig({ capacityUnit: v as 'mah' | 'wh' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mah">mAh</SelectItem>
                    <SelectItem value="wh">Wh</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {config.capacityUnit === 'mah' ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t('capacityMah')}</Label>
                    <Input
                      type="number"
                      min={1000}
                      step={1000}
                      value={config.batteryCapacityMah}
                      onChange={(e) => updateConfig({ batteryCapacityMah: parseInt(e.target.value) || 1000 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('batteryVoltage')}</Label>
                    <Input
                      type="number"
                      min={3.0}
                      max={60}
                      step={0.1}
                      value={config.batteryVoltage}
                      onChange={(e) => updateConfig({ batteryVoltage: parseFloat(e.target.value) || 3.7 })}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>{t('capacityWh')}</Label>
                  <Input
                    type="number"
                    min={1}
                    step={10}
                    value={config.batteryCapacityWh}
                    onChange={(e) => updateConfig({ batteryCapacityWh: parseInt(e.target.value) || 1 })}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>{t('efficiency')}</Label>
                <Input
                  type="number"
                  min={50}
                  max={100}
                  value={config.conversionEfficiency}
                  onChange={(e) => updateConfig({ conversionEfficiency: Math.min(100, Math.max(50, parseInt(e.target.value) || 85)) })}
                />
                <p className="text-xs text-muted-foreground">{t('efficiencyHint')}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Results */}
        <div className="space-y-6">
          {/* Runtime Result */}
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Clock className="h-5 w-5" />
                {t('result')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-4">
                <div className="flex items-center justify-center gap-2 mb-2">
                  {getRuntimeIcon(result.runtimeDays)}
                  <span className={`text-4xl font-bold ${getRuntimeColor(result.runtimeDays)}`}>
                    {result.runtimeDays >= 1
                      ? `${result.runtimeDays.toFixed(1)} ${t('days')}`
                      : `${result.runtimeHours.toFixed(1)} ${t('hours')}`}
                  </span>
                </div>
                <p className="text-muted-foreground">
                  ({result.runtimeHours.toFixed(1)} {t('hours')} = {result.runtimeDays.toFixed(2)} {t('days')})
                </p>
              </div>

              <Separator className="my-4" />

              {/* Breakdown */}
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('gwPowerTotal')}</span>
                  <span className="font-medium">{config.gatewayWatt}W x {config.gatewayCount} = {result.totalGatewayWatt.toFixed(1)}W</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('internetPowerTotal')}</span>
                  <span className="font-medium">{config.internetWatt}W</span>
                </div>
                <Separator />
                <div className="flex justify-between font-semibold">
                  <span>{t('totalPower')}</span>
                  <span>{result.totalWatt.toFixed(1)}W</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('batteryCapacity')}</span>
                  <span className="font-medium">{result.batteryWh.toFixed(0)}Wh</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('usableCapacity')}</span>
                  <span className="font-medium">{result.usableWh.toFixed(0)}Wh ({config.conversionEfficiency}%)</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('formula')}</span>
                  <span className="font-medium text-xs">{result.usableWh.toFixed(0)}Wh / {result.totalWatt.toFixed(1)}W = {result.runtimeHours.toFixed(1)}h</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Scenario 1: LTE Egg */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Ship className="h-5 w-5" />
                {t('scenario1Title')}
              </CardTitle>
              <CardDescription>{t('scenario1Desc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="rounded-lg bg-muted/50 p-3 space-y-2">
                  <p className="font-medium">{t('equipmentList')}</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li>{t('scenario1Item1')}</li>
                    <li>{t('scenario1Item2')}</li>
                    <li>{t('scenario1Item3')}</li>
                    <li>{t('scenario1Item4')}</li>
                  </ul>
                </div>
                <div className="rounded-lg bg-muted/50 p-3 space-y-2">
                  <p className="font-medium">{t('powerEstimate')}</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li>{t('scenario1Power1')}</li>
                    <li>{t('scenario1Power2')}</li>
                    <li>{t('scenario1Power3')}</li>
                  </ul>
                </div>
                <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800 p-3 space-y-1">
                  <p className="font-medium text-blue-800 dark:text-blue-200">{t('scenario1Recommend')}</p>
                  <ul className="list-disc list-inside space-y-1 text-blue-700 dark:text-blue-300 text-xs">
                    <li>{t('scenario1Rec1')}</li>
                    <li>{t('scenario1Rec2')}</li>
                    <li>{t('scenario1Rec3')}</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Scenario 2: Starlink */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Ship className="h-5 w-5" />
                {t('scenario2Title')}
              </CardTitle>
              <CardDescription>{t('scenario2Desc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="rounded-lg bg-muted/50 p-3 space-y-2">
                  <p className="font-medium">{t('equipmentList')}</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li>{t('scenario2Item1')}</li>
                    <li>{t('scenario2Item2')}</li>
                    <li>{t('scenario2Item3')}</li>
                    <li>{t('scenario2Item4')}</li>
                  </ul>
                </div>
                <div className="rounded-lg bg-muted/50 p-3 space-y-2">
                  <p className="font-medium">{t('powerEstimate')}</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li>{t('scenario2Power1')}</li>
                    <li>{t('scenario2Power2')}</li>
                    <li>{t('scenario2Power3')}</li>
                  </ul>
                </div>
                <div className="rounded-lg border border-orange-200 bg-orange-50 dark:bg-orange-950/30 dark:border-orange-800 p-3 space-y-1">
                  <p className="font-medium text-orange-800 dark:text-orange-200">{t('scenario2Recommend')}</p>
                  <ul className="list-disc list-inside space-y-1 text-orange-700 dark:text-orange-300 text-xs">
                    <li>{t('scenario2Rec1')}</li>
                    <li>{t('scenario2Rec2')}</li>
                    <li>{t('scenario2Rec3')}</li>
                    <li>{t('scenario2Rec4')}</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Reference Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('quickRef')}</CardTitle>
              <CardDescription>{t('quickRefDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 pr-2">{t('colBattery')}</th>
                      <th className="text-right py-2 px-2">{t('colLte')}</th>
                      <th className="text-right py-2 px-2">{t('colStarlinkMini')}</th>
                      <th className="text-right py-2 pl-2">{t('colStarlinkStd')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: '20,000mAh (74Wh)', wh: 74 },
                      { label: '50,000mAh (185Wh)', wh: 185 },
                      { label: '500Wh Station', wh: 500 },
                      { label: '1,000Wh Station', wh: 1000 },
                      { label: '2,000Wh Station', wh: 2000 },
                      { label: '5,000Wh Station', wh: 5000 },
                    ].map((bat) => {
                      const eff = config.conversionEfficiency / 100;
                      const gwW = config.gatewayWatt * config.gatewayCount;
                      const lteDays = (bat.wh * eff) / (gwW + 4) / 24;
                      const miniDays = (bat.wh * eff) / (gwW + 40) / 24;
                      const stdDays = (bat.wh * eff) / (gwW + 75) / 24;
                      const fmt = (d: number) => d >= 1 ? `${d.toFixed(1)}${t('daysShort')}` : `${(d * 24).toFixed(1)}h`;
                      return (
                        <tr key={bat.label} className="border-b last:border-0">
                          <td className="py-2 pr-2 text-muted-foreground">{bat.label}</td>
                          <td className={`text-right py-2 px-2 font-medium ${getRuntimeColor(lteDays)}`}>{fmt(lteDays)}</td>
                          <td className={`text-right py-2 px-2 font-medium ${getRuntimeColor(miniDays)}`}>{fmt(miniDays)}</td>
                          <td className={`text-right py-2 pl-2 font-medium ${getRuntimeColor(stdDays)}`}>{fmt(stdDays)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                * {t('quickRefNote', { count: config.gatewayCount, watt: config.gatewayWatt, efficiency: config.conversionEfficiency })}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
