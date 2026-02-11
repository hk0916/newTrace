'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Radio, Tag, Wifi, AlertTriangle } from 'lucide-react';

interface StatsData {
  gateways: { total: number; active: number; connected: number };
  tags: { total: number; active: number };
  alerts: { lowVoltage: number };
}

export function StatsCards({ stats }: { stats: StatsData }) {
  const cards = [
    {
      title: '총 게이트웨이',
      value: stats.gateways.total,
      sub: `활성 ${stats.gateways.active}`,
      icon: Radio,
    },
    {
      title: '연결된 게이트웨이',
      value: stats.gateways.connected,
      sub: `총 ${stats.gateways.total}개 중`,
      icon: Wifi,
    },
    {
      title: '총 태그',
      value: stats.tags.total,
      sub: `활성 ${stats.tags.active}`,
      icon: Tag,
    },
    {
      title: '알림',
      value: stats.alerts.lowVoltage,
      sub: '저전압 태그',
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
