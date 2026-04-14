'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { LayoutDashboard, Radio, Tag, AlertTriangle, LogOut, Building2, CirclePlus, MapPin, Settings2, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { TimezoneProvider } from '../contexts/timezone-context';

interface DashboardShellProps {
  user: {
    name?: string | null;
    email: string;
    companyId?: string | null;
    role: string;
  };
  companyId?: string | null;
  children: React.ReactNode;
}

const navKeys = [
  { href: '/dashboard', key: 'dashboard', icon: LayoutDashboard },
  { href: '/dashboard/register', key: 'register', icon: CirclePlus },
  { href: '/dashboard/gateways', key: 'gateways', icon: Radio },
  { href: '/dashboard/gateway-control', key: 'gatewayControl', icon: Settings2 },
  { href: '/dashboard/tags', key: 'tags', icon: Tag },
  { href: '/dashboard/asset-map', key: 'assetMap', icon: MapPin },
  { href: '/dashboard/alerts', key: 'alerts', icon: AlertTriangle },
  { href: '/dashboard/settings', key: 'settings', icon: Settings },
] as const;

export function DashboardShell({ user, companyId, children }: DashboardShellProps) {
  const pathname = usePathname();
  const tNav = useTranslations('nav');
  const tRoles = useTranslations('roles');
  const tCommon = useTranslations('common');
  const effectiveCompanyId = companyId ?? user.companyId;

  return (
    <TimezoneProvider>
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="hidden w-64 border-r bg-muted/30 md:block">
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-14 items-center px-6 font-bold text-lg">
            <Radio className="mr-2 h-5 w-5" />
            TraceTag
          </div>
          <Separator />

          {/* Navigation */}
          <nav className="flex-1 space-y-1 p-4">
            {navKeys.map((item) => {
              const isActive = pathname === item.href ||
                (item.href !== '/dashboard' && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {tNav(item.key)}
                </Link>
              );
            })}
          </nav>

          {/* User Info */}
          <div className="border-t p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Building2 className="h-4 w-4" />
              <span>{effectiveCompanyId && effectiveCompanyId !== 'super' ? effectiveCompanyId : tCommon('selectCompany')}</span>
            </div>
            <div className="text-sm font-medium truncate mb-1">
              {user.name || user.email}
            </div>
            <div className="text-xs text-muted-foreground mb-3">
              {user.role === 'super'
                ? tRoles('super')
                : user.role === 'admin'
                  ? tRoles('admin')
                  : tRoles('user')}
            </div>
            <LocaleSwitcher />
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-2"
              onClick={() => signOut({ callbackUrl: '/login' })}
            >
              <LogOut className="mr-2 h-4 w-4" />
              {tCommon('logout')}
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
    </TimezoneProvider>
  );
}
