'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { format, isSunday } from 'date-fns';
import { ru } from 'date-fns/locale';

interface ShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: string;
}

export default function ShiftModal({ isOpen, onClose, selectedDate }: ShiftModalProps) {
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('16:00');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const isHoliday = false; // можно потом добавить
  const isSundayDate = isSunday(new Date(selectedDate));

  const calculateHours = (start: string, end: string) => {
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    let minutes = (eh * 60 + em) - (sh * 60 + sm);
    if (minutes < 0) minutes += 24 * 60;

    let dayHours = 0;
    let nightHours = 0;

    for (let i = 0; i < minutes; i += 30) {
      const currentHour = (sh + Math.floor((sm + i) / 60)) % 24;
      if (currentHour >= 6 && currentHour < 22) dayHours += 0.5;
      else if (currentHour < 6) nightHours += 0.5;
    }

    return { dayHours: Number(dayHours.toFixed(2)), nightHours: Number(nightHours.toFixed(2)) };
  };

  const handleSubmit = async () => {
    if (!startTime || !endTime) {
      alert('Введите время начала и окончания');
      return;
    }

    setLoading(true);

    const { dayHours, nightHours } = calculateHours(startTime, endTime);

    const { error } = await supabase.from('work_shifts').insert({
      user_id: (await supabase.auth.getUser()).data.user?.id,
      date: selectedDate,
      start_time: startTime,
      end_time: endTime,
      day_hours: dayHours,
      night_hours: nightHours,
      total_hours: dayHours + nightHours,
    });

    if (error) alert('Ошибка: ' + error.message);
    else {
      alert('Смена успешно добавлена!');
      onClose();
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-zinc-900 rounded-3xl p-8 w-full max-w-md border border-zinc-700">
        <h2 className="text-2xl font-bold mb-6 text-center">Добавление смены</h2>

        <p className="text-center text-zinc-400 mb-6">
          {format(new Date(selectedDate), 'dd MMMM yyyy', { locale: ru })}
          {isSundayDate && " 📅 Воскресенье"}
        </p>

        <div className="space-y-5">
          <div>
            <label className="text-sm text-zinc-400">Начало смены</label>
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl px-5 py-4 text-lg" />
          </div>
          <div>
            <label className="text-sm text-zinc-400">Конец смены</label>
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl px-5 py-4 text-lg" />
          </div>
        </div>

        <div className="flex gap-3 mt-8">
          <button onClick={onClose} className="flex-1 py-4 rounded-2xl border border-zinc-700 hover:bg-zinc-800">Отмена</button>
          <button onClick={handleSubmit} disabled={loading} className="flex-1 py-4 bg-white text-black rounded-2xl font-medium hover:bg-zinc-200 disabled:opacity-50">
            {loading ? 'Сохранение...' : 'Добавить смену'}
          </button>
        </div>
      </div>
    </div>
  );
}