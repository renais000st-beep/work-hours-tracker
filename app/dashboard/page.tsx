// app/dashboard/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/i18n';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, isSameMonth, isSunday } from 'date-fns';
import { ru, de } from 'date-fns/locale';
import { LogOut, LayoutDashboard, Calendar as CalendarIcon, BarChart3, ChevronLeft, ChevronRight, Trash2, Download, Shield, Menu, X } from 'lucide-react';
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

  const hasShift = (dateStr: string) => {
    return shifts.some(shift => shift.date === dateStr);
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
    const monthName = format(new Date(selectedMonth + '-01'), 'LLLL yyyy', { locale: de });

    const data = monthShifts.map((shift: any) => {
      const date = new Date(shift.date);
      const isHoliday = germanHolidays.includes(format(date, 'yyyy-MM-dd'));
      const isSun = isSunday(date);

      return {
        Datum: format(date, 'dd.MM.yyyy'),
        Beginn: shift.start_time?.slice(0, 5),
        Ende: shift.end_time?.slice(0, 5),
        Tag: shift.day_hours,
        Nacht: shift.night_hours,
        Sonntag: isSun ? shift.total_hours : 0,
        Feiertag: isHoliday ? shift.total_hours : 0,
        Gesamt: shift.total_hours,
      };
    });

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
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2">
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
                className={`px-6 py-3 rounded-2xl flex items-center gap-2 transition ${
                  activeTab === 'calendar' ? 'bg-white text-black shadow' : 'hover:bg-zinc-800 text-zinc-400'
                }`}
              >
                <CalendarIcon size={20} />
                {t('common.calendar')}
              </button>
              <button
                onClick={() => setActiveTab('stats')}
                className={`px-6 py-3 rounded-2xl flex items-center gap-2 transition ${
                  activeTab === 'stats' ? 'bg-white text-black shadow' : 'hover:bg-zinc-800 text-zinc-400'
                }`}
              >
                <BarChart3 size={20} />
                {t('common.stats')}
              </button>
            </div>

            {/* КАЛЕНДАРЬ */}
            {activeTab === 'calendar' && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-4 sm:p-6">
                {/* ... календарь остаётся тот же ... */}
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
                {/* ... статистика остаётся без изменений ... */}
              </div>
            )}
          </div>
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