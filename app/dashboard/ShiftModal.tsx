// app/dashboard/ShiftModal.tsx
'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { format, isSunday } from 'date-fns';
import { useTranslation } from '@/lib/i18n';

const germanHolidays = [
  '2025-01-01','2025-04-18','2025-04-21','2025-05-01','2025-05-29','2025-06-09','2025-10-03','2025-12-25','2025-12-26',
  '2026-01-01','2026-04-03','2026-04-06','2026-05-01','2026-05-14','2026-05-25','2026-10-03','2026-12-25','2026-12-26',
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: string;
}

export default function ShiftModal({ isOpen, onClose, selectedDate }: Props) {
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('16:00');
  const [loading, setLoading] = useState(false);

  const { t } = useTranslation();

  if (!isOpen) return null;

  const calculateHours = () => {
    if (!startTime || !endTime) return { day_hours: 0, night_hours: 0, total_hours: 0 };

    const start = new Date(`2000-01-01 ${startTime}`);
    const end = new Date(`2000-01-01 ${endTime}`);

    let totalMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
    if (totalMinutes < 0) totalMinutes += 24 * 60;

    const total_hours = Number((totalMinutes / 60).toFixed(2));

    let day_hours = 0;
    let night_hours = 0;

    const startHour = parseInt(startTime.split(':')[0]);
    const endHour = parseInt(endTime.split(':')[0]);

    for (let h = startHour; h < startHour + 24; h++) {
      const hour = h % 24;
      const minutesInHour = Math.min(60, totalMinutes);

      if (totalMinutes <= 0) break;

      if (hour >= 6 && hour < 22) {
        day_hours += minutesInHour / 60;
      } else {
        night_hours += minutesInHour / 60;
      }
      totalMinutes -= minutesInHour;
    }

    const isHolidayDay = germanHolidays.includes(selectedDate);
    const isSun = isSunday(new Date(selectedDate));

    return {
      day_hours: Number(day_hours.toFixed(2)),
      night_hours: Number(night_hours.toFixed(2)),
      total_hours: Number(total_hours.toFixed(2)),
      sunday_hours: isSun ? Number(total_hours.toFixed(2)) : 0,
      holiday_hours: isHolidayDay ? Number(total_hours.toFixed(2)) : 0,
    };
  };

  const handleSave = async () => {
    if (!selectedDate) return;

    setLoading(true);

    const hours = calculateHours();

    const { error } = await supabase
      .from('work_shifts')
      .insert({
        user_id: (await supabase.auth.getUser()).data.user?.id,
        date: selectedDate,
        start_time: startTime,
        end_time: endTime,
        day_hours: hours.day_hours,
        night_hours: hours.night_hours,
        total_hours: hours.total_hours,
        sunday_hours: hours.sunday_hours,
        holiday_hours: hours.holiday_hours,
      });

    setLoading(false);

    if (error) {
      alert('Ошибка при сохранении: ' + error.message);
    } else {
      alert(t('shiftModal.saveShift') + '!');
      onClose();
      window.location.reload();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 rounded-3xl w-full max-w-md mx-auto overflow-hidden">
        {/* Заголовок */}
        <div className="px-6 py-5 border-b border-zinc-700 text-center bg-zinc-950">
          <h2 className="text-xl font-semibold">{t('shiftModal.title')}</h2>
          <p className="text-zinc-400 text-sm mt-1">{selectedDate}</p>
        </div>

        {/* Форма */}
        <div className="p-6 space-y-8">
          <div>
            <label className="block text-sm text-zinc-400 mb-2">{t('shiftModal.startTime')}</label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl px-5 py-5 text-white text-lg"
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-2">{t('shiftModal.endTime')}</label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl px-5 py-5 text-white text-lg"
            />
          </div>
        </div>

        {/* Кнопки */}
        <div className="flex border-t border-zinc-700">
          <button
            onClick={onClose}
            className="flex-1 py-6 text-zinc-400 hover:bg-zinc-800 font-medium text-lg transition"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex-1 py-6 bg-emerald-600 hover:bg-emerald-500 font-medium text-lg disabled:opacity-50 transition"
          >
            {loading ? t('schedule.saving') : t('shiftModal.saveShift')}
          </button>
        </div>
      </div>
    </div>
  );
}