'use client';

import { useState, useEffect } from 'react';
import { format, isSunday } from 'date-fns';
import { useTranslation } from '@/lib/i18n';
import { germanHolidays } from '@/lib/constants';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: string;
  group: string;
  onSave: (shiftData: any) => Promise<void>;
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
  if (!startTime || !endTime) {
    return { day_hours: 0, night_hours: 0, total_hours: 0, sunday_hours: 0, holiday_hours: 0 };
  }

  // === Специальный случай: 00:00 → 00:00 = 24 часа ===
  if (startTime === '00:00' && endTime === '00:00') {
    const isHolidayDay = germanHolidays.includes(selectedDate);
    const isSun = isSunday(new Date(selectedDate));

    return {
      day_hours: 16,      // 6:00–22:00
      night_hours: 6,     // 0:00–6:00 (22:00–24:00 не считается)
      total_hours: 22,    // 24 - 2 часа (22:00-24:00)
      sunday_hours: isSun ? 22 : 0,
      holiday_hours: isHolidayDay ? 22 : 0,
    };
  }

  // === Обычный расчёт ===
  const start = new Date(`2000-01-01T${startTime}`);
  const end = new Date(`2000-01-01T${endTime}`);

  let totalMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
  if (totalMinutes < 0) totalMinutes += 24 * 60;

  let paidMinutes = 0;
  let nightMinutes = 0;
  let current = new Date(start);

  for (let i = 0; i < totalMinutes; i += 60) {
    const hour = current.getHours();
    const minutesLeft = Math.min(60, totalMinutes - i);

    // === ВАЖНО: с 22:00 до 24:00 часы НЕ считаются ===
    if (hour >= 22) {
      current.setMinutes(current.getMinutes() + 60);
      continue;
    }

    paidMinutes += minutesLeft;

    // Ночное время считаем только с 0:00 до 6:00 (22:00-24:00 уже исключили)
    if (hour >= 0 && hour < 6) {
      nightMinutes += minutesLeft;
    }

    current.setMinutes(current.getMinutes() + 60);
  }

  const total_hours = Number((paidMinutes / 60).toFixed(2));
  const night_hours = Number((nightMinutes / 60).toFixed(2));
  const day_hours = Number((total_hours - night_hours).toFixed(2));

  const isHolidayDay = germanHolidays.includes(selectedDate);
  const isSun = isSunday(new Date(selectedDate));

  return {
    day_hours: Math.max(0, day_hours),
    night_hours: Math.max(0, night_hours),
    total_hours,
    sunday_hours: isSun ? total_hours : 0,
    holiday_hours: isHolidayDay ? total_hours : 0,
  };
};

  const handleSave = async () => {
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

    setLoading(true);
    await onSave(shiftData);
    setLoading(false);
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