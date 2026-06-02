'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/i18n';
import { LogOut, ArrowLeft, Calendar as CalendarIcon, Menu, Shield, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { 
  format, addMonths, subMonths, startOfMonth, endOfMonth, 
  eachDayOfInterval, startOfWeek, isSameMonth 
} from 'date-fns';
import { de } from 'date-fns/locale';
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
  const [profile, setProfile] = useState<any>(null);

  // Заметки
  const [noteText, setNoteText] = useState('');
  const [notesForCurrentGroup, setNotesForCurrentGroup] = useState<any[]>([]);

  const { t } = useTranslation();
  const router = useRouter();

   // Загрузка пользователя и профиля
  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.push('/login');
      setUser(user);

      // Загружаем профиль с username
      const { data: prof } = await supabase
        .from('profiles')
        .select('username, is_admin')
        .eq('id', user.id)
        .single();

      if (prof) {
        setProfile(prof);
      }

      // Загрузка групп (оставляем как было)
      const { data: ugData } = await supabase
        .from('user_groups')
        .select(`
          group_id,
          role,
          groups (id, name)
        `)
        .eq('user_id', user.id);

      if (ugData && ugData.length > 0) {
        const groups = ugData
          .flatMap(item => item.groups ?? [])
          .filter(Boolean);

        setUserGroups(groups);
        setCurrentUserRole(ugData[0]?.role || 'viewer');

        if (groups.length > 0) {
          setActiveGroup(groups[0].name);
        } else {
          setActiveGroup('Ingo Kuby');
        }
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

    // Загрузка заметок по месяцу
  useEffect(() => {
    if (!activeGroup) return;
    const monthKey = format(currentMonth, 'yyyy-MM');
    const key = `notes-${activeGroup}-${monthKey}`;
    const saved = localStorage.getItem(key);
    setNotesForCurrentGroup(saved ? JSON.parse(saved) : []);
  }, [currentMonth, activeGroup]);

  const saveShifts = (shifts: any[]) => {
    if (!activeGroup) return;
    const key = `workPlanShifts_${activeGroup}`;
    localStorage.setItem(key, JSON.stringify(shifts));
    setPlannedShifts(shifts);
  };

     const saveNote = () => {
    if (!noteText.trim()) {
      alert(t('schedule.Alert.writeNote'));
      return;
    }
    if (!activeGroup) {
      alert(t('schedule.Alert.chooseGroup'));
      return;
    }

    const monthKey = format(currentMonth, 'yyyy-MM');
    const key = `notes-${activeGroup}-${monthKey}`;

    const newNote = {
      time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
      text: noteText.trim(),
      author: profile?.username || t('schedule.user')
    };

    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    const updated = [...existing, newNote];

    localStorage.setItem(key, JSON.stringify(updated));
    setNotesForCurrentGroup(updated);
    setNoteText('');           // очищаем поле

    alert('✅ ' + t('schedule.Alert.notesaved'));
  };
      const deleteNote = (index: number) => {
    if (!confirm(t('schedule.Alert.deleteNote'))) return;

    const monthKey = format(currentMonth, 'yyyy-MM');
    const key = `notes-${activeGroup}-${monthKey}`;

    const updated = notesForCurrentGroup.filter((_, i) => i !== index);

    localStorage.setItem(key, JSON.stringify(updated));
    setNotesForCurrentGroup(updated);
    alert(t('schedule.Alert.notedeleted'));
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
    return plannedShifts.some(shift => shift.date === dateStr && shift.user_id === user?.id);
  };

  const addPlannedShift = (newShift: any) => {
    saveShifts([...plannedShifts, newShift]);
  };

  const shiftsForSelectedDate = plannedShifts.filter(shift => shift.date === selectedDate);

  if (userGroups.length === 0) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        {t('schedule.noGroupaccess')}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* MOBILE TOP BAR */}
      <div className="lg:hidden bg-zinc-900 border-b border-zinc-800 px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <button onClick={() => router.push('/dashboard')} className="flex items-center gap-2 text-zinc-400">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold">{t('schedule.title')}</h1>
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2">
          <Menu size={28} />
        </button>
      </div>

      <div className="flex">
        {/* DESKTOP SIDEBAR */}
        <div className="w-64 bg-zinc-900 border-r border-zinc-800 p-6 hidden lg:flex flex-col fixed h-full">
          <div className="mb-10">
            <h1 className="text-2xl font-bold">{t('common.title')}</h1>
          </div>
          <nav className="flex flex-col gap-2 flex-1">
            <a href="/dashboard" className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-zinc-800">
              📊 {t('schedule.dashboard')}
            </a>
            <a href="/schedule" className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-zinc-800 text-white">
              📅 {t('schedule.title')}
            </a>
          </nav>

          {/* Кнопки внизу сайдбара */}
          <div className="mt-auto pt-6 border-t border-zinc-700 space-y-2">
            {profile?.is_admin && (
              <button onClick={() => router.push('/admin')} className="flex items-center gap-3 px-4 py-3 w-full text-violet-400 hover:bg-zinc-800 rounded-2xl">
                <Shield size={20} /> {t('common.adminPanel')}
              </button>
            )}
            <button onClick={() => supabase.auth.signOut().then(() => router.push('/login'))} className="flex items-center gap-3 px-4 py-3 w-full text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-2xl">
              <LogOut size={20} /> {t('common.logout')}
            </button>
          </div>
        </div>

        {/* MAIN CONTENT */}
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
                <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-3 hover:bg-zinc-800 rounded-2xl text-2xl">←</button>
                <h2 className="text-2xl sm:text-3xl font-semibold capitalize text-center">
                  {format(currentMonth, 'LLLL yyyy', { locale: de })}
                </h2>
                <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-3 hover:bg-zinc-800 rounded-2xl text-2xl">→</button>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center text-zinc-400 text-xs sm:text-sm mb-3">
                {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(d => <div key={d} className="font-medium">{d}</div>)}
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
                      {isMyShift && <span className="text-[10px] text-emerald-400 mt-1">{t('schedule.myShift')}</span>}
                    </button>
                  );
                })}
              </div>
            </div>

                         {/* ==================== Заметки ==================== */}
            <div className="mt-6 bg-zinc-900 border border-zinc-700 rounded-3xl p-5">
              <h3 className="text-lg font-semibold mb-4">📝 {t('schedule.Note.Notes')}</h3>

              <textarea 
                className="w-full h-20 bg-zinc-800 border border-zinc-600 rounded-2xl p-3 text-sm resize-y"
                placeholder={t('schedule.Note.writeMonthNote')}
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
              />

              <div className="flex gap-2 mt-3">
                <button onClick={saveNote} className="flex-1 bg-emerald-600 hover:bg-emerald-500 py-2.5 rounded-xl font-medium text-sm">
                  {t('schedule.Note.save')}
                </button>
                <button onClick={() => setNoteText('')} className="px-5 bg-zinc-700 hover:bg-zinc-600 rounded-xl text-sm">
                  {t('schedule.Note.clear')}
                </button>
              </div>

              {/* Список заметок с цветовой подсветкой */}
              <div className="mt-5 space-y-3">
                {notesForCurrentGroup.length > 0 ? (
                  notesForCurrentGroup.map((note: any, index: number) => {
                    const colors = [
                      'border-emerald-400',     // 1 оттенок
                      'border-teal-400',        // 2 оттенок
                      'border-cyan-400',        // 3 оттенок
                      'border-green-400'        // 4 оттенок
                    ];
                    const colorClass = colors[index % colors.length];

                    return (
                      <div key={index} className={`bg-zinc-800 border-l-4 ${colorClass} pl-3 py-3 rounded-r-xl flex justify-between items-start group`}>
                        <div className="flex-1 pr-3">
                          <div className="text-emerald-400 text-xs font-medium">
                            {note.author || t('schedule.Note.user') + ' ' + (index + 1)}
                          </div>
                          <p className="mt-1 text-sm leading-relaxed">{note.text}</p>
                          <span className="text-zinc-500 text-xs block mt-1.5">{note.time}</span>
                        </div>

                        {/* Корзинка — только для своей заметки */}
                        {note.author === profile?.username && (
                          <button 
                            onClick={() => deleteNote(index)}
                            className="text-zinc-500 hover:text-red-500 transition-colors p-2 opacity-50 hover:opacity-100">
                            <Trash2 size={22} />
                          </button>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <p className="text-zinc-500 text-center py-8">{t('schedule.Note.noMonthNote')}</p>
                )}
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
        </div>
      </div>
    </div>
  );
}