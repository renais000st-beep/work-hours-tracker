'use client';

import { useState, useEffect } from 'react';
import { Bell, User, Users, Shield, Check } from 'lucide-react';
import type { UserProfile } from '@/types/mini-app';

export default function ProfileView({ profile }: { profile: UserProfile }) {
  const [notifTime, setNotifTime] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/mini-app/profile', { headers: { 'x-profile-id': profile.profileId } })
      .then(r => r.json())
      .then(d => setNotifTime(d.notificationTime ?? ''));
  }, [profile.profileId]);

  const save = async () => {
    setSaving(true);
    await fetch('/api/mini-app/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-profile-id': profile.profileId },
      body: JSON.stringify({ notificationTime: notifTime }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="p-4 space-y-3">
      {/* User card */}
      <div className="bg-zinc-900 rounded-2xl p-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-emerald-600/20 rounded-full flex items-center justify-center shrink-0">
            <User size={22} className="text-emerald-400" />
          </div>
          <div>
            <div className="font-semibold text-lg">{profile.username}</div>
            {profile.isAdmin && (
              <div className="flex items-center gap-1 text-amber-400 text-xs mt-0.5">
                <Shield size={11} /> Администратор
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Groups */}
      <div className="bg-zinc-900 rounded-2xl p-4">
        <div className="flex items-center gap-2 text-zinc-400 text-xs mb-3 uppercase tracking-wider">
          <Users size={13} /> Группы
        </div>
        <div className="space-y-2.5">
          {profile.groups.map(g => (
            <div key={g.id} className="flex items-center justify-between">
              <span className="font-medium">{g.name}</span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  g.role === 'editor'
                    ? 'bg-emerald-900/40 text-emerald-400'
                    : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                {g.role === 'editor' ? 'Редактор' : 'Наблюдатель'}
              </span>
            </div>
          ))}
          {profile.groups.length === 0 && (
            <div className="text-zinc-500 text-sm">Нет групп</div>
          )}
        </div>
      </div>

      {/* Notifications */}
      <div className="bg-zinc-900 rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2 text-zinc-400 text-xs mb-1 uppercase tracking-wider">
          <Bell size={13} /> Уведомления
        </div>
        <p className="text-zinc-500 text-sm">Время ежедневного напоминания о смене</p>
        <input
          type="time"
          value={notifTime}
          onChange={e => setNotifTime(e.target.value)}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-xl font-mono text-center focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
        />
        <button
          onClick={save}
          disabled={saving || !notifTime}
          className={`w-full py-3 rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${
            saved
              ? 'bg-emerald-700 text-white'
              : 'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700'
          }`}
        >
          {saved ? (
            <><Check size={16} /> Сохранено</>
          ) : saving ? (
            'Сохранение...'
          ) : (
            'Сохранить'
          )}
        </button>
      </div>
    </div>
  );
}
