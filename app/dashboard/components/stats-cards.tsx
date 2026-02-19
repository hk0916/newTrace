'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Radio, Tag, Wifi, AlertTriangle } from 'lucide-react';

interface StatsData {
  gateways: { total: number; active: number; connected: number };
  tags: { total: number; active: number };
  alerts: { lowVoltage: number };
}

export function StatsCards({ stats }: { stats: StatsData }) {
  const t = useTranslations('stats');

  const cards = [
    {
      title: t('totalGateways'),
      value: stats.gateways.total,
      sub: t('activeCount', { count: stats.gateways.active }),
      icon: Radio,
    },
    {
      title: t('connectedGateways'),
      value: stats.gateways.connected,
      sub: t('outOfTotal', { count: stats.gateways.total }),
      icon: Wifi,
    },
    {
      title: t('totalTags'),
      value: stats.tags.total,
      sub: t('activeCount', { count: stats.tags.active }),
      icon: Tag,
    },
    {
      title: t('alerts'),
      value: stats.alerts.lowVoltage,
      sub: t('lowVoltageTags'),
      icon: AlertTriangle,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
            <card.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
            <p className="text-xs text-muted-foreground">{card.sub}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
