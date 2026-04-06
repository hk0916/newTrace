'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Radio, Tag, Wifi, AlertTriangle, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatsData {
  gateways: { total: number; active: number; connected: number };
  tags: { total: number; active: number };
  alerts: { lowVoltage: number; total: number };
}

export function StatsCards({ stats }: { stats: StatsData }) {
  const t = useTranslations('stats');

  const normalCount = Math.max(0, stats.tags.active - stats.alerts.total);
  const normalRate = stats.tags.active > 0
    ? Math.round((normalCount / stats.tags.active) * 100)
    : 100;

  const cards = [
    {
      title: t('totalGateways'),
      value: stats.gateways.total,
      sub: t('activeCount', { count: stats.gateways.active }),
      icon: Radio,
      highlight: false,
    },
    {
      title: t('connectedGateways'),
      value: stats.gateways.connected,
      sub: t('outOfTotal', { count: stats.gateways.total }),
      icon: Wifi,
      highlight: false,
    },
    {
      title: t('totalTags'),
      value: stats.tags.total,
      sub: t('activeCount', { count: stats.tags.active }),
      icon: Tag,
      highlight: false,
    },
    {
      title: t('normalAssets'),
      value: normalCount,
      sub: t('normalRate', { rate: normalRate }),
      icon: ShieldCheck,
      highlight: false,
      valueClass: 'text-green-500',
    },
    {
      title: t('alerts'),
      value: stats.alerts.total,
      sub: t('alertDetail', { lowVoltage: stats.alerts.lowVoltage }),
      icon: AlertTriangle,
      highlight: stats.alerts.total > 0,
    },
  ];

  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
      {cards.map((card) => (
        <Card
          key={card.title}
          className={cn(
            card.highlight && 'border-destructive/40 bg-destructive/5'
          )}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
            <card.icon className={cn(
              'h-4 w-4',
              card.highlight ? 'text-destructive' : 'text-muted-foreground'
            )} />
          </CardHeader>
          <CardContent>
            <div className={cn('text-2xl font-bold', (card as Record<string, unknown>).valueClass as string | undefined, card.highlight && 'text-destructive')}>
              {card.value}
            </div>
            <p className="text-xs text-muted-foreground">{card.sub}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
