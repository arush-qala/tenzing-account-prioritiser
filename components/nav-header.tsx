'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { LogOut, LayoutDashboard, CheckSquare, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NotificationBell } from '@/components/notification-bell';
import { AiAccuracyIndicator } from '@/components/ai-accuracy-indicator';

interface NavHeaderProps {
  userEmail?: string;
}

export function NavHeader({ userEmail }: NavHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  }

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/actions', label: 'My Actions', icon: CheckSquare },
    { href: '/chat', label: 'Ask the Analyst', icon: MessageSquare },
  ];

  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-3">
        <div className="flex items-center gap-8">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">
              Account Prioritiser
            </h1>
            <p className="text-xs text-muted-foreground">
              AI-powered portfolio prioritisation
            </p>
          </div>
          <nav className="flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      'text-muted-foreground',
                      isActive && 'bg-muted text-foreground',
                    )}
                  >
                    <Icon className="mr-1.5 size-3.5" />
                    {item.label}
                  </Button>
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <AiAccuracyIndicator />
          <NotificationBell />
          {userEmail && (
            <span className="text-sm text-muted-foreground">{userEmail}</span>
          )}
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            <LogOut className="mr-1 size-3" />
            Sign out
          </Button>
        </div>
      </div>
    </header>
  );
}
