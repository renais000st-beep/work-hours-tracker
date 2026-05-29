// app/dashboard/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/i18n';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, isSameMonth, isSunday } from 'date-fns';
import { ru, de } from 'date-fns/locale';
import { LogOut, LayoutDashboard, Calendar as CalendarIcon, BarChart3, Trash2, Download, Shield, Menu, X } from 'lucide-react';
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const router = useRouter();
  const { t } = useTranslation();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.push('/login');

      setUser(user);

      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      setProfile(prof);

      if (!prof?.username) {
        router.push('/setup-username');
        return;
      }

      const { data } = await supabase
        .from('work_shifts')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });

      setShifts(data || []);
    } catch (err) {
      console.error('Ошибка загрузки dashboard:', err);
    }
  };

  const handleDeleteShift = async (id: number) => {
    if (!confirm('Удалить эту смену навсегда?')) return;
    const { error } = await supabase.from('work_shifts').delete().eq('id', id);
    if (!error) await loadData();
  };

  const handleDateClick = (date: string) => {
    setSelectedDate(date);
    setShowModal(true);
  };

  const hasShift = (dateStr: string) => shifts.some(s => s.date === dateStr);

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
    const monthName = format(new Date(selectedMonth + '-01'), 'LLLL yyyy', { locale: de });

    const data = monthShifts.map((shift: any) => ({
      Datum: format(new Date(shift.date), 'dd.MM.yyyy'),
      Beginn: shift.start_time?.slice(0, 5),
      Ende: shift.end_time?.slice(0, 5),
      Tag: shift.day_hours,
      Nacht: shift.night_hours,
      Sonntag: isSunday(new Date(shift.date)) ? shift.total_hours : 0,
      Feiertag: germanHolidays.includes(shift.date) ? shift.total_hours : 0,
      Gesamt: shift.total_hours,
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, monthName);
    XLSX.writeFile(workbook, `Stundenbericht_${monthName}.xlsx`);
  };

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 }),
    end: endOfMonth(currentMonth),
  });

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* MOBILE TOP BAR */}
      <div className="lg:hidden bg-zinc-900 border-b border-zinc-800 px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 active:scale-95 transition"
        >
          <Menu size={28} />
        </button>
        <h1 className="text-xl font-bold">{t('common.title')}</h1>
        <div className="w-8" />
      </div>

      <div className="flex">
        {/* DESKTOP SIDEBAR */}
        <div className="w-64 bg-zinc-900 border-r border-zinc-800 p-6 hidden lg:flex flex-col fixed h-full">
          <div className="mb-10">
            <h1 className="text-2xl font-bold">{t('common.title')}</h1>
          </div>
          <nav className="flex flex-col gap-2">
            <a href="/dashboard" className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-zinc-800 text-white">
              <LayoutDashboard size={20} />
              Dashboard
            </a>
            <a href="/schedule" className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-zinc-800 text-white">
              <CalendarIcon size={20} />
              {t('schedule.title')}
            </a>
          </nav>
        </div>

        {/* MAIN CONTENT */}
        <div className="flex-1 lg:ml-64">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 lg:py-8">
            {/* Табы */}
            <div className="flex bg-zinc-900 p-1 rounded-3xl w-fit mb-8">
              <button
                onClick={() => setActiveTab('calendar')}
                className={`px-6 py-3 rounded-2xl flex items-center gap-2 transition ${activeTab === 'calendar' ? 'bg-white text-black shadow' : 'hover:bg-zinc-800 text-zinc-400'}`}
              >
                <CalendarIcon size={20} />
                {t('common.calendar')}
              </button>
              <button
                onClick={() => setActiveTab('stats')}
                className={`px-6 py-3 rounded-2xl flex items-center gap-2 transition ${activeTab === 'stats' ? 'bg-white text-black shadow' : 'hover:bg-zinc-800 text-zinc-400'}`}
              >
                <BarChart3 size={20} />
                {t('common.stats')}
              </button>
            </div>

            {/* КАЛЕНДАРЬ */}
            {activeTab === 'calendar' && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-4 sm:p-6">
                <div className="flex items-center justify-between mb-6">
                  <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-3 hover:bg-zinc-800 rounded-2xl">←</button>
                  <h2 className="text-2xl sm:text-3xl font-semibold capitalize">
                    {format(currentMonth, 'LLLL yyyy', { locale: de })}
                  </h2>
                  <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-3 hover:bg-zinc-800 rounded-2xl">→</button>
                </div>

                <div className="grid grid-cols-7 gap-1 text-center text-zinc-400 text-xs sm:text-sm mb-3">
                  {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(d => <div key={d} className="font-medium">{d}</div>)}
                </div>

                <div className="grid grid-cols-7 gap-1 sm:gap-2">
                  {days.map((day, index) => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const isCurrentMonth = isSameMonth(day, currentMonth);
                    const isToday = dateStr === format(new Date(), 'yyyy-MM-dd');
                    const hasShiftToday = hasShift(dateStr);

                    return (
                      <button
                        key={index}
                        onClick={() => isCurrentMonth && handleDateClick(dateStr)}
                        disabled={!isCurrentMonth}
                        className={`aspect-square p-2 sm:p-3 rounded-2xl border flex flex-col items-center justify-center transition-all text-sm sm:text-base
                          ${isCurrentMonth ? 'border-zinc-700 hover:border-zinc-500 hover:bg-zinc-800 cursor-pointer' : 'opacity-30'}
                          ${isToday ? 'bg-zinc-800 border-white' : ''}
                          ${hasShiftToday ? 'bg-emerald-900/30 border-emerald-600' : ''}
                        `}
                      >
                        <span className={`font-medium ${isToday ? 'font-bold text-white' : ''} ${hasShiftToday ? 'text-emerald-400' : ''}`}>
                          {format(day, 'd')}
                        </span>
                        {hasShiftToday && <div className="w-2 h-2 bg-emerald-400 rounded-full mt-1"></div>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* СТАТИСТИКА */}
            {activeTab === 'stats' && (
              <div>
                <h2 className="text-2xl font-bold mb-6">{t('stats.monthStats')}</h2>

                {monthList.length === 0 ? (
                  <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-12 text-center text-zinc-500">
                    {t('stats.noShifts')}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {monthList.map((monthKey) => {
                      const monthName = format(new Date(monthKey + '-01'), 'LLLL yyyy', { locale: de });
                      const monthShifts = groupedByMonth[monthKey] || [];
                      const total = monthShifts.reduce((sum: number, s: any) => sum + (s.total_hours || 0), 0);

                      return (
                        <button
                          key={monthKey}
                          onClick={() => setSelectedMonth(monthKey)}
                          className="bg-zinc-900 border border-zinc-800 hover:border-zinc-600 rounded-3xl p-6 text-left transition"
                        >
                          <div className="text-lg font-semibold capitalize">{monthName}</div>
                          <div className="text-4xl font-bold text-emerald-400 mt-2">{total.toFixed(1)} ч</div>
                          <div className="text-sm text-zinc-500 mt-1">
                            {monthShifts.length} смен
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {selectedMonth && groupedByMonth[selectedMonth] && (
                  <div className="mt-10">
                    <h3 className="text-2xl font-semibold mb-4">
                      {format(new Date(selectedMonth + '-01'), 'LLLL yyyy', { locale: de })}
                    </h3>

                    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-x-auto">
                      <table className="w-full min-w-[700px]">
                        <thead>
                          <tr className="bg-zinc-800">
                            <th className="text-left p-4 whitespace-nowrap">Дата</th>
                            <th className="text-left p-4 whitespace-nowrap">Начало</th>
                            <th className="text-left p-4 whitespace-nowrap">Конец</th>
                            <th className="text-right p-4 whitespace-nowrap">День</th>
                            <th className="text-right p-4 whitespace-nowrap">Ночь</th>
                            <th className="text-right p-4 whitespace-nowrap">Вс</th>
                            <th className="text-right p-4 whitespace-nowrap">Праздник</th>
                            <th className="text-right p-4 whitespace-nowrap">Итого</th>
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
                                  <td className="p-4 whitespace-nowrap">{format(date, 'dd.MM.yyyy')}</td>
                                  <td className="p-4">{shift.start_time?.slice(0, 5)}</td>
                                  <td className="p-4">{shift.end_time?.slice(0, 5)}</td>
                                  <td className="p-4 text-right text-emerald-400">{shift.day_hours}</td>
                                  <td className="p-4 text-right text-violet-400">{shift.night_hours}</td>
                                  <td className="p-4 text-right text-amber-400">{isSun ? shift.total_hours : 0}</td>
                                  <td className="p-4 text-right text-orange-400">{isHoliday ? shift.total_hours : 0}</td>
                                  <td className="p-4 text-right font-medium">{shift.total_hours}</td>
                                  <td className="p-4">
                                    <button onClick={() => handleDeleteShift(shift.id)} className="text-red-500 hover:text-red-600">
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
                      {t('common.downloadExcel')}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ==================== MOBILE MENU (исправленная версия) ==================== */}
      <div 
        className={`fixed inset-0 bg-black/60 z-[100] lg:hidden transition-opacity duration-300
          ${mobileMenuOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}`}
        onClick={() => setMobileMenuOpen(false)}
      />

      <div 
        className={`fixed top-0 left-0 h-full w-72 bg-zinc-900 border-r border-zinc-700 z-[110] transform transition-transform duration-300 ease-out shadow-2xl lg:hidden
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="p-6">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-2xl font-bold">{t('common.title')}</h2>
            <button onClick={() => setMobileMenuOpen(false)} className="p-2">
              <X size={28} />
            </button>
          </div>

          <nav className="flex flex-col gap-2">
            <a href="/dashboard" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 px-4 py-4 rounded-2xl hover:bg-zinc-800 text-white">
              <LayoutDashboard size={24} />
              Dashboard
            </a>
            <a href="/schedule" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 px-4 py-4 rounded-2xl hover:bg-zinc-800 text-white">
              <CalendarIcon size={24} />
              {t('schedule.title')}
            </a>
          </nav>
        </div>

        <div className="absolute bottom-8 left-6 right-6">
          <button
            onClick={() => {
              setMobileMenuOpen(false);
              supabase.auth.signOut().then(() => router.push('/login'));
            }}
            className="flex items-center gap-3 w-full px-4 py-4 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-2xl"
          >
            <LogOut size={24} />
            <span className="font-medium">{t('common.logout')}</span>
          </button>
        </div>
      </div>

      <ShiftModal 
        isOpen={showModal} 
        onClose={() => setShowModal(false)}
        selectedDate={selectedDate}
      />
    </div>
  );
}