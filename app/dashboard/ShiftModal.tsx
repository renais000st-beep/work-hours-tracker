'use client';

import { useState, useEffect } from 'react';
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
  group: string;
  onSave: (shiftData: any) => void;
}

export default function ShiftModal({ isOpen, onClose, selectedDate, group, onSave }: Props) {
  const [startTime, setStartTime] = useState('07:00');
  const [endTime, setEndTime] = useState('20:00');
  const [loading, setLoading] = useState(false);

  const { t } = useTranslation();

  useEffect(() => {
    if (isOpen) {
      setStartTime('07:00');
      setEndTime('20:00');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const calculateHours = () => {
    if (!startTime || !endTime) return { day_hours: 0, night_hours: 0, total_hours: 0, sunday_hours: 0, holiday_hours: 0 };

    const start = new Date(`2000-01-01 ${startTime}`);
    const end = new Date(`2000-01-01 ${endTime}`);

    let totalMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
    if (totalMinutes < 0) totalMinutes += 24 * 60;

    const total_hours = Number((totalMinutes / 60).toFixed(2));

    let day_hours = 0;
    let night_hours = 0;
    const startHour = parseInt(startTime.split(':')[0]);

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

  const handleSave = () => {
    const hours = calculateHours();

    const shiftData = {
      date: selectedDate,
      start_time: startTime,
      end_time: endTime,
      day_hours: hours.day_hours,
      night_hours: hours.night_hours,
      total_hours: hours.total_hours,
      sunday_hours: hours.sunday_hours,
      holiday_hours: hours.holiday_hours,
      group: group,
    };

    onSave(shiftData);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md shadow-2xl overflow-hidden animate-slide-up sm:animate-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-5 border-b border-zinc-800 text-center bg-zinc-950">
          <h2 className="text-lg font-semibold tracking-tight">{t('shiftModal.title')}</h2>
          <p className="text-zinc-500 text-sm mt-0.5">{selectedDate}</p>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm text-zinc-500 mb-2">{t('shiftModal.startTime')}</label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-4 text-white text-xl sm:text-lg focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-zinc-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-500 mb-2">{t('shiftModal.endTime')}</label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-4 text-white text-xl sm:text-lg focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-zinc-500 transition-colors"
            />
          </div>
        </div>

        <div className="flex border-t border-zinc-800">
          <button
            onClick={onClose}
            className="flex-1 py-5 sm:py-4 text-zinc-400 hover:bg-zinc-800 font-medium text-base active:bg-zinc-700 transition-colors"
          >
            {t('shiftModal.cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex-1 py-5 sm:py-4 bg-emerald-600 hover:bg-emerald-500 font-medium text-base active:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            {loading ? t('common.loading') : t('shiftModal.saveShift')}
          </button>
        </div>
      </div>
    </div>
  );
}