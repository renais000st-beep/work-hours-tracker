'use client';

import { useState, useEffect } from 'react';
import BottomNav from '@/components/mini-app/BottomNav';
import ShiftsList from '@/components/mini-app/ShiftsList';
import ScheduleList from '@/components/mini-app/ScheduleList';
import ProfileView from '@/components/mini-app/ProfileView';
import type { UserProfile, Tab } from '@/types/mini-app';

export default function MiniAppPage() {
  const [tab, setTab] = useState<Tab>('shifts');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const tg = window.Telegram?.WebApp;
      if (!tg) {
        setError('Открой через Telegram');
        setLoading(false);
        return;
      }

      tg.ready();
      tg.expand();

      try {
        const res = await fetch('/api/mini-app/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initData: tg.initData }),
        });

        if (!res.ok) {
          const err = await res.json();
          setError(
            err.error === 'User not linked'
              ? 'Сначала привяжи Telegram в приложении'
              : 'Ошибка авторизации'
          );
          setLoading(false);
          return;
        }

        setProfile(await res.json());
      } catch {
        setError('Нет соединения');
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-950">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-3 px-8 text-center bg-zinc-950">
        <div className="text-5xl">⚠️</div>
        <p className="text-zinc-400 text-sm">{error ?? 'Ошибка загрузки'}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-zinc-950 overflow-hidden">
      <div className="flex-1 overflow-y-auto pb-16">
        {tab === 'shifts' && <ShiftsList profile={profile} />}
        {tab === 'schedule' && <ScheduleList profile={profile} />}
        {tab === 'profile' && <ProfileView profile={profile} />}
      </div>
      <BottomNav activeTab={tab} onTabChange={setTab} />
    </div>
  );
}
