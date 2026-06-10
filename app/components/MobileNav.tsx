'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Calendar, Shield, LogOut } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useTranslation } from '@/lib/i18n';

interface MobileNavProps {
  isAdmin?: boolean;
}

export default function MobileNav({ isAdmin }: MobileNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useTranslation();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const items = [
    { href: '/dashboard', icon: LayoutDashboard, label: t('common.dashboard') },
    { href: '/schedule', icon: Calendar, label: t('schedule.title') },
    ...(isAdmin ? [{ href: '/admin', icon: Shield, label: t('common.adminPanel'), admin: true }] : []),
  ];

  return (
    <div
      className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-zinc-900/95 backdrop-blur-md border-t border-zinc-800 animate-fade-in"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-center justify-around h-14 px-2">
        {items.map(item => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl transition-all duration-150 active:scale-90 ${
                active
                  ? (item as any).admin ? 'text-violet-400' : 'text-white'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Icon size={22} />
              <span className="text-[10px] font-medium">{item.label}</span>
              {active && (
                <div className={`w-1 h-1 rounded-full ${(item as any).admin ? 'bg-violet-400' : 'bg-emerald-400'}`} />
              )}
            </Link>
          );
        })}
        <button
          onClick={handleLogout}
          className="flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl text-zinc-500 hover:text-zinc-300 transition-all duration-150 active:scale-90"
        >
          <LogOut size={22} />
          <span className="text-[10px] font-medium">{t('common.logout')}</span>
        </button>
      </div>
    </div>
  );
}
