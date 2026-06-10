'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { calculateHours } from '@/lib/hours';
import { Clock, X } from 'lucide-react';
import type { UserProfile, WorkShift } from '@/types/mini-app';

interface Props {
  profile: UserProfile;
  group: string;
  existingShift?: WorkShift | null;
  onSave: (data: any) => Promise<void>;
  onClose: () => void;
}

export default function AddShiftSheet({ existingShift, onSave, onClose }: Props) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const yesterday = format(new Date(Date.now() - 86400000), 'yyyy-MM-dd');

  const [date, setDate] = useState(existingShift?.date ?? today);
  const [startTime, setStartTime] = useState(existingShift?.start_time?.slice(0, 5) ?? '07:00');
  const [endTime, setEndTime] = useState(existingShift?.end_time?.slice(0, 5) ?? '20:00');
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 250);
  };

  const hours = calculateHours(startTime, endTime, date);

  const handleSave = async () => {
    setLoading(true);
    await onSave({
      ...(existingShift?.id ? { id: existingShift.id } : {}),
      date,
      start_time: startTime,
      end_time: endTime,
      ...hours,
    });
    setLoading(false);
    handleClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end"
      style={{
        backgroundColor: visible ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0)',
        transition: 'background-color 0.25s',
      }}
      onClick={handleClose}
    >
      <div
        className="w-full bg-zinc-900 rounded-t-2xl"
        style={{
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.25s cubic-bezier(0.16,1,0.3,1)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-zinc-700 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800">
          <h3 className="font-semibold">
            {existingShift ? 'Редактировать смену' : 'Добавить смену'}
          </h3>
          <button onClick={handleClose} className="p-1.5 rounded-lg text-zinc-500 active:bg-zinc-800">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Date */}
          <div>
            <label className="text-xs text-zinc-500 mb-2 block">Дата</label>
            <div className="flex gap-2 mb-2">
              {[{ label: 'Сегодня', value: today }, { label: 'Вчера', value: yesterday }].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setDate(opt.value)}
                  className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${
                    date === opt.value
                      ? 'bg-emerald-600 text-white'
                      : 'bg-zinc-800 text-zinc-400 active:bg-zinc-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            />
          </div>

          {/* Times */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'С', value: startTime, onChange: setStartTime },
              { label: 'До', value: endTime, onChange: setEndTime },
            ].map(({ label, value, onChange }) => (
              <div key={label}>
                <label className="text-xs text-zinc-500 mb-2 flex items-center gap-1">
                  <Clock size={11} /> {label}
                </label>
                <input
                  type="time"
                  value={value}
                  onChange={e => onChange(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-3 text-white text-xl font-mono text-center focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
              </div>
            ))}
          </div>

          {/* Hours preview */}
          <div className="bg-zinc-800/60 rounded-xl px-4 py-3 flex items-center justify-center gap-3">
            <span className="text-2xl font-bold text-emerald-400">{hours.total_hours}ч</span>
            {hours.night_hours > 0 && (
              <span className="text-zinc-500 text-sm">({hours.day_hours}д + {hours.night_hours}н)</span>
            )}
            {hours.sunday_hours > 0 && <span className="text-amber-400 text-xs font-medium">So</span>}
            {hours.holiday_hours > 0 && <span className="text-orange-400 text-xs font-medium">Feiertag</span>}
          </div>

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={loading}
            className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 rounded-2xl font-semibold disabled:opacity-50 transition-colors"
          >
            {loading ? 'Сохранение...' : existingShift ? 'Обновить' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  );
}
