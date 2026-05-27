'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, isSameMonth, isSunday } from 'date-fns';
import { ru } from 'date-fns/locale';
import { LogOut, Calendar as CalendarIcon, BarChart3, ChevronLeft, ChevronRight, Trash2, Download, Shield } from 'lucide-react';
import * as XLSX from 'xlsx';
import ShiftModal from './ShiftModal';

const germanHolidays = [
  '2025-01-01','2025-04-18','2025-04-21','2025-05-01','2025-05-29','2025-06-09','2025-10-03','2025-12-25','2025-12-26',
  '2026-01-01','2026-04-03','2026-04-06','2026-05-01','2026-05-14','2026-05-25','2026-10-03','2026-12-25','2026-12-26',
];

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'calendar' | 'stats'>('calendar');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showModal, setShowModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [shifts, setShifts] = useState<any[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return router.push('/login');

    setUser(user);

    // Загружаем профиль для проверки роли администратора
    const { data: prof } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    setProfile(prof);

    const { data } = await supabase
      .from('work_shifts')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false });

    setShifts(data || []);
  };

  const handleDeleteShift = async (id: number) => {
    if (!confirm('Удалить эту смену навсегда?')) return;

    const { error } = await supabase
      .from('work_shifts')
      .delete()
      .eq('id', id);

    if (error) {
      alert('Ошибка при удалении: ' + error.message);
    } else {
      await loadData();
      alert('Смена успешно удалена');
    }
  };

  const handleDateClick = (date: string) => {
    setSelectedDate(date);
    setShowModal(true);
  };

  const groupedByMonth = shifts.reduce((acc: any, shift: any) => {
    const key = format(new Date(shift.date), 'yyyy-MM');
    if (!acc[key]) acc[key] = [];
    acc[key].push(shift);
    return acc;
  }, {});

  const monthList = Object.keys(groupedByMonth).sort();

  const downloadExcel = () => {
    if (!selectedMonth || !groupedByMonth[selectedMonth]) return;

    const monthShifts = groupedByMonth[selectedMonth];
    const monthName = format(new Date(selectedMonth + '-01'), 'LLLL yyyy', { locale: ru });

    const data = monthShifts.map((shift: any) => {
      const date = new Date(shift.date);
      const isHoliday = germanHolidays.includes(format(date, 'yyyy-MM-dd'));
      const isSun = isSunday(date);

      return {
        Дата: format(date, 'dd.MM.yyyy'),
        Начало: shift.start_time?.slice(0, 5),
        Конец: shift.end_time?.slice(0, 5),
        'Дневные': shift.day_hours,
        'Ночные': shift.night_hours,
        'Воскресенье': isSun ? shift.total_hours : 0,
        'Праздник': isHoliday ? shift.total_hours : 0,
        'Итого': shift.total_hours,
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, monthName);
    XLSX.writeFile(workbook, `Отчёт_${monthName}.xlsx`);
  };

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 }),
    end: endOfMonth(currentMonth),
  });

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Навигация */}
      <div className="border-b border-zinc-800 bg-zinc-950 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex items-center justify-between py-5">
            <h1 className="text-3xl font-bold">Учёт рабочих часов</h1>

            <div className="flex gap-2 bg-zinc-900 p-1 rounded-2xl">
              <button
                onClick={() => setActiveTab('calendar')}
                className={`px-6 py-3 rounded-xl flex items-center gap-2 ${activeTab === 'calendar' ? 'bg-white text-black' : 'hover:bg-zinc-800 text-zinc-400'}`}
              >
                <CalendarIcon size={20} />
                Календарь
              </button>
              <button
                onClick={() => setActiveTab('stats')}
                className={`px-6 py-3 rounded-xl flex items-center gap-2 ${activeTab === 'stats' ? 'bg-white text-black' : 'hover:bg-zinc-800 text-zinc-400'}`}
              >
                <BarChart3 size={20} />
                Статистика
              </button>
            </div>

            <div className="flex items-center gap-4">
              {/* Кнопка Админ-панель — видна ТОЛЬКО администраторам */}
              {profile?.role === 'admin' && (
                <button
                  onClick={() => router.push('/admin')}
                  className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 px-5 py-2.5 rounded-2xl font-medium transition"
                >
                  <Shield size={20} />
                  Админ-панель
                </button>
              )}

              <button
                onClick={() => supabase.auth.signOut().then(() => router.push('/login'))}
                className="text-zinc-400 hover:text-white"
              >
                <LogOut size={24} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* ==================== КАЛЕНДАРЬ ==================== */}
        {activeTab === 'calendar' && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
            <div className="flex items-center justify-between mb-8">
              <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-3 hover:bg-zinc-800 rounded-2xl">
                <ChevronLeft size={28} />
              </button>
              <h2 className="text-3xl font-semibold capitalize">
                {format(currentMonth, 'LLLL yyyy', { locale: ru })}
              </h2>
              <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-3 hover:bg-zinc-800 rounded-2xl">
                <ChevronRight size={28} />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-2 text-center text-zinc-500 mb-4">
              {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((d, i) => <div key={i} className="font-medium">{d}</div>)}
            </div>

            <div className="grid grid-cols-7 gap-2">
              {days.map((day, index) => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const isToday = dateStr === format(new Date(), 'yyyy-MM-dd');

                return (
                  <button
                    key={index}
                    onClick={() => isCurrentMonth && handleDateClick(dateStr)}
                    disabled={!isCurrentMonth}
                    className={`min-h-[110px] p-3 rounded-2xl border transition-all flex flex-col items-start ${isCurrentMonth ? 'border-zinc-800 hover:border-zinc-600 hover:bg-zinc-900 cursor-pointer' : 'opacity-30'} ${isToday ? 'bg-zinc-800 border-white' : ''}`}
                  >
                    <span className={`text-lg ${isToday ? 'font-bold text-white' : ''}`}>
                      {format(day, 'd')}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ==================== СТАТИСТИКА ==================== */}
        {activeTab === 'stats' && (
          <div>
            <h2 className="text-3xl font-bold mb-6">Статистика по месяцам</h2>

            {monthList.length === 0 ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-12 text-center text-zinc-500">
                Пока нет заполненных смен
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {monthList.map((monthKey) => {
                  const monthName = format(new Date(monthKey + '-01'), 'LLLL yyyy', { locale: ru });
                  const monthShifts = groupedByMonth[monthKey] || [];
                  const total = monthShifts.reduce((sum: number, s: any) => sum + (s.total_hours || 0), 0);

                  return (
                    <button
                      key={monthKey}
                      onClick={() => setSelectedMonth(monthKey)}
                      className="bg-zinc-900 border border-zinc-800 hover:border-zinc-600 rounded-3xl p-6 text-left transition"
                    >
                      <div className="text-xl font-semibold capitalize">{monthName}</div>
                      <div className="text-4xl font-bold text-emerald-400 mt-2">{total.toFixed(1)} ч</div>
                      <div className="text-sm text-zinc-500 mt-1">{monthShifts.length} смен</div>
                    </button>
                  );
                })}
              </div>
            )}

            {selectedMonth && groupedByMonth[selectedMonth] && (
              <div className="mt-10">
                <h3 className="text-2xl font-semibold mb-4">
                  {format(new Date(selectedMonth + '-01'), 'LLLL yyyy', { locale: ru })}
                </h3>

                <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-zinc-800">
                        <th className="text-left p-4">Дата</th>
                        <th className="text-left p-4">Начало</th>
                        <th className="text-left p-4">Конец</th>
                        <th className="text-right p-4">Дневные</th>
                        <th className="text-right p-4">Ночные</th>
                        <th className="text-right p-4">Воскресенье</th>
                        <th className="text-right p-4">Праздник</th>
                        <th className="text-right p-4">Итого</th>
                        <th className="w-12"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupedByMonth[selectedMonth]
                        .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
                        .map((shift: any) => {
                          const date = new Date(shift.date);
                          const isHoliday = germanHolidays.includes(format(date, 'yyyy-MM-dd'));
                          const isSun = isSunday(date);

                          return (
                            <tr key={shift.id} className="border-t border-zinc-800 hover:bg-zinc-800/50">
                              <td className="p-4">{format(date, 'dd.MM.yyyy')}</td>
                              <td className="p-4">{shift.start_time?.slice(0, 5)}</td>
                              <td className="p-4">{shift.end_time?.slice(0, 5)}</td>
                              <td className="p-4 text-right text-emerald-400">{shift.day_hours}</td>
                              <td className="p-4 text-right text-violet-400">{shift.night_hours}</td>
                              <td className="p-4 text-right text-amber-400">{isSun ? shift.total_hours : 0}</td>
                              <td className="p-4 text-right text-orange-400">{isHoliday ? shift.total_hours : 0}</td>
                              <td className="p-4 text-right font-medium">{shift.total_hours}</td>
                              <td className="p-4">
                                <button
                                  onClick={() => handleDeleteShift(shift.id)}
                                  className="text-red-500 hover:text-red-600 transition"
                                >
                                  <Trash2 size={20} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>

                <button
                  onClick={downloadExcel}
                  className="mt-6 flex items-center gap-3 bg-emerald-600 hover:bg-emerald-500 px-6 py-3 rounded-2xl font-medium transition"
                >
                  <Download size={20} />
                  Скачать Excel
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <ShiftModal 
        isOpen={showModal} 
        onClose={() => setShowModal(false)}
        selectedDate={selectedDate}
      />
    </div>
  );
}