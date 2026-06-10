'use client';

import { Clock, Calendar, User } from 'lucide-react';
import type { Tab } from '@/types/mini-app';

interface Props {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

const TABS: { id: Tab; icon: typeof Clock; label: string }[] = [
  { id: 'shifts', icon: Clock, label: 'Смены' },
  { id: 'schedule', icon: Calendar, label: 'График' },
  { id: 'profile', icon: User, label: 'Профиль' },
];

export default function BottomNav({ activeTab, onTabChange }: Props) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-zinc-900 border-t border-zinc-800 flex safe-bottom">
      {TABS.map(({ id, icon: Icon, label }) => {
        const active = activeTab === id;
        return (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            className={`flex-1 flex flex-col items-center gap-1 py-3 transition-colors ${
              active ? 'text-emerald-400' : 'text-zinc-500 active:text-zinc-300'
            }`}
          >
            <Icon size={22} strokeWidth={active ? 2.5 : 1.5} />
            <span className="text-xs font-medium">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
