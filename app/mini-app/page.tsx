'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Script from 'next/script';
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
  const initialized = useRef(false);

  const initApp = useCallback(async () => {
    if (initialized.current) return;
    initialized.current = true;

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
  }, []);

  // Fallback: если SDK уже закеширован и onLoad не стрельнет
  useEffect(() => {
    if (window.Telegram?.WebApp) {
      initApp();
    }
  }, [initApp]);

  // Debug info для диагностики
  const [debugInfo, setDebugInfo] = useState<string | null>(null);
  useEffect(() => {
    const collect = () => {
      const tg = window.Telegram?.WebApp;
      setDebugInfo(JSON.stringify({
        hasTg: !!tg,
        version: tg?.version,
        platform: tg?.platform,
        initDataLen: tg?.initData?.length ?? 0,
        hash: window.location.hash.slice(0, 80),
        unsafe: tg?.initDataUnsafe,
      }, null, 2));
    };
    collect();
    setTimeout(collect, 2000);
  }, []);

  return (
    <>
      <Script
        src="https://telegram.org/js/telegram-web-app.js"
        strategy="afterInteractive"
        onLoad={initApp}
      />

      {loading && (
        <div className="flex items-center justify-center h-screen bg-zinc-950">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-500 border-t-transparent" />
        </div>
      )}

      {!loading && (error || !profile) && (
        <div className="flex flex-col items-center justify-center h-screen gap-3 px-8 text-center bg-zinc-950">
          <div className="text-5xl">⚠️</div>
          <p className="text-zinc-400 text-sm">{error ?? 'Ошибка загрузки'}</p>
          {debugInfo && (
            <pre className="text-left text-zinc-600 text-xs mt-2 overflow-auto max-h-48 w-full bg-zinc-900 p-2 rounded-xl">
              {debugInfo}
            </pre>
          )}
        </div>
      )}

      {loading && debugInfo && (
        <div className="fixed bottom-4 left-4 right-4 bg-zinc-900 rounded-xl p-2 z-50">
          <pre className="text-zinc-500 text-xs overflow-auto max-h-32">{debugInfo}</pre>
        </div>
      )}

      {!loading && profile && (
        <div className="flex flex-col h-screen bg-zinc-950 overflow-hidden">
          <div className="flex-1 overflow-y-auto pb-16">
            {tab === 'shifts' && <ShiftsList profile={profile} />}
            {tab === 'schedule' && <ScheduleList profile={profile} />}
            {tab === 'profile' && <ProfileView profile={profile} />}
          </div>
          <BottomNav activeTab={tab} onTabChange={setTab} />
        </div>
      )}
    </>
  );
}
