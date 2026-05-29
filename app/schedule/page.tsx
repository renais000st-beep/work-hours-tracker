// app/schedule/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { 
  format, addMonths, subMonths, startOfMonth, endOfMonth, 
  eachDayOfInterval, startOfWeek, isSameMonth 
} from 'date-fns';
import { de } from 'date-fns/locale';
import { ArrowLeft, Calendar as CalendarIcon, Menu } from 'lucide-react';
import ScheduleShiftModal from './ScheduleShiftModal';
import ScheduleViewModal from './ScheduleViewModal';

export default function Schedule() {
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [userGroups, setUserGroups] = useState<any[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState<'editor' | 'viewer' | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showModal, setShowModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [user, setUser] = useState<any>(null);
  const [plannedShifts, setPlannedShifts] = useState<any[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { t } = useTranslation();
  const router = useRouter();

  // Загрузка пользователя и групп
  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.push('/login');
      setUser(user);

      const { data: ugData } = await supabase
        .from('user_groups')
        .select(`
          group_id,
          role,
          groups (id, name)
        `)
        .eq('user_id', user.id);

      if (ugData && ugData.length > 0) {
        const groups = ugData.map(item => item.groups).filter(Boolean);
        setUserGroups(groups);
        setCurrentUserRole(ugData[0].role || 'viewer');
        setActiveGroup(groups[0].name);
      }
    };
    load();
  }, []);

  // Загрузка смен
  useEffect(() => {
    if (!activeGroup) return;
    const key = `workPlanShifts_${activeGroup}`;
    const saved = localStorage.getItem(key);
    setPlannedShifts(saved ? JSON.parse(saved) : []);
  }, [activeGroup]);

  const saveShifts = (shifts: any[]) => {
    if (!activeGroup) return;
    const key = `workPlanShifts_${activeGroup}`;
    localStorage.setItem(key, JSON.stringify(shifts));
    setPlannedShifts(shifts);
  };

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 }),
    end: endOfMonth(currentMonth),
  });

  const handleDateClick = (date: string) => {
    setSelectedDate(date);
    setShowModal(true);
  };

  const hasMyShift = (dateStr: string) => {
    return plannedShifts.some(shift => 
      shift.date === dateStr && shift.user_id === user?.id
    );
  };

  const addPlannedShift = (newShift: any) => {
    saveShifts([...plannedShifts, newShift]);
  };

  const shiftsForSelectedDate = plannedShifts.filter(shift => shift.date === selectedDate);

  if (userGroups.length === 0) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        Нет доступа к группам
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* ==================== MOBILE TOP BAR ==================== */}
      <div className="lg:hidden bg-zinc-900 border-b border-zinc-800 px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <button 
          onClick={() => router.push('/dashboard')}
          className="flex items-center gap-2 text-zinc-400"
        >
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold">{t('schedule.title')}</h1>
        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2"
        >
          <Menu size={28} />
        </button>
      </div>

      <div className="flex">
        {/* ==================== DESKTOP SIDEBAR ==================== */}
        <div className="w-64 bg-zinc-900 border-r border-zinc-800 p-6 hidden lg:flex flex-col fixed h-full">
          <div className="mb-10">
            <h1 className="text-2xl font-bold">{t('common.title')}</h1>
          </div>
          <nav className="flex flex-col gap-2">
            <a href="/dashboard" className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-zinc-800 text-white">
              📊 Dashboard
            </a>
            <a href="/schedule" className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-zinc-800 text-white">
              <CalendarIcon size={20} /> {t('schedule.title')}
            </a>
          </nav>
        </div>

        {/* ==================== MAIN CONTENT ==================== */}
        <div className="flex-1 lg:ml-64">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 lg:py-8">
            {/* Переключатель групп */}
            <div className="flex gap-2 bg-zinc-900 p-1 rounded-3xl w-fit mb-8 overflow-x-auto pb-2">
              {userGroups.map((group) => (
                <button
                  key={group.id}
                  onClick={() => setActiveGroup(group.name)}
                  className={`px-6 py-3 rounded-3xl font-medium transition whitespace-nowrap ${
                    activeGroup === group.name ? 'bg-white text-black shadow' : 'hover:bg-zinc-800 text-zinc-400'
                  }`}
                >
                  {group.name}
                </button>
              ))}
            </div>

            {/* Календарь */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-4 sm:p-6">
              <div className="flex items-center justify-between mb-6">
                <button 
                  onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} 
                  className="p-3 hover:bg-zinc-800 rounded-2xl text-2xl"
                >
                  ←
                </button>
                <h2 className="text-2xl sm:text-3xl font-semibold capitalize text-center">
                  {format(currentMonth, 'LLLL yyyy', { locale: de })}
                </h2>
                <button 
                  onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} 
                  className="p-3 hover:bg-zinc-800 rounded-2xl text-2xl"
                >
                  →
                </button>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center text-zinc-400 text-xs sm:text-sm mb-3">
                {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(d => (
                  <div key={d} className="font-medium">{d}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1 sm:gap-2">
                {days.map((day, index) => {
                  const dateStr = format(day, 'yyyy-MM-dd');
                  const isCurrentMonth = isSameMonth(day, currentMonth);
                  const isMyShift = hasMyShift(dateStr);

                  return (
                    <button
                      key={index}
                      onClick={() => isCurrentMonth && handleDateClick(dateStr)}
                      disabled={!isCurrentMonth}
                      className={`aspect-square p-2 sm:p-3 rounded-2xl border flex flex-col items-center justify-center transition-all
                        ${isCurrentMonth ? 'border-zinc-700 hover:border-zinc-500 hover:bg-zinc-800 cursor-pointer' : 'opacity-30'}
                        ${isMyShift ? 'bg-emerald-900/60 border-emerald-500' : ''}
                      `}
                    >
                      <span className={`text-base sm:text-lg font-medium ${isMyShift ? 'text-emerald-400' : ''}`}>
                        {format(day, 'd')}
                      </span>
                      {isMyShift && <span className="text-[10px] text-emerald-400 mt-1">Моя</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Модалы */}
      {currentUserRole === 'editor' ? (
        <ScheduleShiftModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          selectedDate={selectedDate}
          activeGroup={activeGroup || ''}
          currentUserId={user?.id}
          onShiftAdded={addPlannedShift}
        />
      ) : (
        <ScheduleViewModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          selectedDate={selectedDate}
          shifts={shiftsForSelectedDate}
        />
      )}
    </div>
  );
}