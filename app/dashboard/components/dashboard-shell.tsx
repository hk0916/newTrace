'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { LayoutDashboard, Radio, Tag, LogOut, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DashboardShellProps {
  user: {
    name?: string | null;
    email: string;
    companyId?: string | null;
    role: string;
  };
  children: React.ReactNode;
}

const navItems = [
  { href: '/dashboard', label: '대시보드', icon: LayoutDashboard },
  { href: '/dashboard/gateways', label: '게이트웨이', icon: Radio },
  { href: '/dashboard/tags', label: '태그', icon: Tag },
];

export function DashboardShell({ user, children }: DashboardShellProps) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
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
            {navItems.map((item) => {
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
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* User Info */}
          <div className="border-t p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Building2 className="h-4 w-4" />
              <span>{user.companyId || '미소속'}</span>
            </div>
            <div className="text-sm font-medium truncate mb-1">
              {user.name || user.email}
            </div>
            <div className="text-xs text-muted-foreground mb-3">
              {user.role === 'admin' ? '관리자' : '사용자'}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => signOut({ callbackUrl: '/login' })}
            >
              <LogOut className="mr-2 h-4 w-4" />
              로그아웃
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
  );
}
