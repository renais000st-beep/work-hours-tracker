'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/i18n';
import { LogOut, ArrowLeft, Calendar as CalendarIcon, Shield, Trash2, BarChart2, NotebookText, ChevronLeft, ChevronRight, ArrowLeftRight, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, isSameMonth } from 'date-fns';
import { getGroupQuickConfig } from '@/lib/constants';
import { de } from 'date-fns/locale';
import ScheduleShiftModal from './ScheduleShiftModal';
import ScheduleViewModal from './ScheduleViewModal';
import MobileNav from '@/app/components/MobileNav';
import { useToast } from '@/app/components/Toast';

export default function Schedule() {
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [userGroups, setUserGroups] = useState<any[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState<'editor' | 'viewer' | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [calKey, setCalKey] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [user, setUser] = useState<any>(null);
  const [plannedShifts, setPlannedShifts] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [confirmDeleteNote, setConfirmDeleteNote] = useState<string | null>(null);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [noteText, setNoteText] = useState('');
  const [notesForCurrentGroup, setNotesForCurrentGroup] = useState<any[]>([]);

  const [showCompareModal, setShowCompareModal] = useState(false);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareRows, setCompareRows] = useState<any[]>([]);

  const touchStartX = useRef<number | null>(null);

  const { t } = useTranslation();
  const router = useRouter();
  const { showToast } = useToast();

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.push('/login');
      setUser(user);

      const { data: prof } = await supabase
        .from('profiles')
        .select('username, is_admin')
        .eq('id', user.id)
        .single();
      if (prof) setProfile(prof);

      if (prof?.is_admin) {
        // Admin sees all groups that have at least one member
        const { data: allUgData } = await supabase
          .from('user_groups')
          .select('group_id, groups(id, name)');

        if (allUgData) {
          const seen = new Set<string>();
          const groups = allUgData
            .filter(ug => ug.groups && !seen.has(ug.group_id) && !!seen.add(ug.group_id))
            .map(ug => ug.groups as { id: string; name: string })
            .sort((a, b) => a.name.localeCompare(b.name));
          setUserGroups(groups);
          setCurrentUserRole('editor');
          if (groups.length > 0) {
            setActiveGroup(groups[0].name);
            setActiveGroupId(groups[0].id);
          }
        }
      } else {
        const { data: ugData } = await supabase
          .from('user_groups')
          .select('group_id, role, groups(id, name)')
          .eq('user_id', user.id);

        if (ugData && ugData.length > 0) {
          const groups = ugData.flatMap(item => item.groups ?? []).filter(Boolean);
          setUserGroups(groups);
          setCurrentUserRole(ugData[0]?.role || 'viewer');
          if (groups.length > 0) {
            setActiveGroup(groups[0].name);
            setActiveGroupId(groups[0].id);
          } else setActiveGroup('Ingo Kuby');
        }
      }
      setLoading(false);
    };
    load();
  }, []);

  useEffect(() => {
    if (!activeGroup) return;
    const loadShifts = async () => {
      const { data, error } = await supabase
        .from('planned_shifts')
        .select('*')
        .eq('group_name', activeGroup)
        .order('date');
      if (!error && data) setPlannedShifts(data);
    };
    loadShifts();
  }, [activeGroup]);

  useEffect(() => {
    if (!activeGroupId) return;
    const loadNotes = async () => {
      const monthKey = format(currentMonth, 'yyyy-MM');
      const { data, error } = await supabase
        .from('schedule_notes')
        .select('*')
        .eq('group_id', activeGroupId)
        .eq('date', monthKey + '-01')
        .order('created_at', { ascending: true });
      setNotesForCurrentGroup(!error && data ? data : []);
    };
    loadNotes();
  }, [currentMonth, activeGroupId]);

  // keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (showModal) return;
      if (e.key === 'ArrowLeft') changeMonth(-1);
      if (e.key === 'ArrowRight') changeMonth(1);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showModal]);

  const changeMonth = (dir: 1 | -1) => {
    setCurrentMonth(prev => dir === 1 ? addMonths(prev, 1) : subMonths(prev, 1));
    setCalKey(k => k + 1);
  };

  const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 50) changeMonth(dx < 0 ? 1 : -1);
    touchStartX.current = null;
  };

  const handleShiftAdded = (newShift: any) => setPlannedShifts(prev => [...prev, newShift]);
  const handleShiftUpdated = (updatedShift: any) => setPlannedShifts(prev => prev.map(s => s.id === updatedShift.id ? updatedShift : s));
  const handleShiftDeleted = (shiftId: string) => setPlannedShifts(prev => prev.filter(s => s.id !== shiftId));

  const saveNote = async () => {
    if (!noteText.trim()) { showToast(t('schedule.Alert.writeNote'), 'info'); return; }
    if (!activeGroupId) { showToast(t('schedule.Alert.chooseGroup'), 'info'); return; }

    const monthKey = format(currentMonth, 'yyyy-MM');
    const { data, error } = await supabase
      .from('schedule_notes')
      .insert({
        group_id: activeGroupId,
        date: monthKey + '-01',
        text: noteText.trim(),
        author: profile?.username || t('schedule.user'),
      })
      .select()
      .single();

    if (!error && data) {
      setNotesForCurrentGroup(prev => [...prev, data]);
      setNoteText('');
      showToast(t('schedule.Alert.notesaved'), 'success');
    } else {
      showToast(t('schedule.Alert.saveFailed'), 'error');
    }
  };

  const deleteNote = async (noteId: string | number) => {
    const idKey = String(noteId);
    if (confirmDeleteNote === idKey) {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
      setConfirmDeleteNote(null);
      const { error } = await supabase
        .from('schedule_notes')
        .delete()
        .eq('id', noteId);
      if (!error) {
        setNotesForCurrentGroup(prev => prev.filter(n => String(n.id) !== idKey));
        showToast(t('schedule.Alert.notedeleted'), 'success');
      } else {
        showToast(t('schedule.Alert.deleteFailed'), 'error');
      }
    } else {
      setConfirmDeleteNote(idKey);
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
      confirmTimerRef.current = setTimeout(() => setConfirmDeleteNote(null), 3000);
    }
  };

  const openCompareModal = async () => {
    setShowCompareModal(true);
    setCompareLoading(true);
    try {
      const monthStart = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
      const monthEnd   = format(endOfMonth(currentMonth),   'yyyy-MM-dd');

      const { data: workedData } = await supabase
        .from('work_shifts')
        .select('*')
        .eq('group', activeGroup)
        .gte('date', monthStart)
        .lte('date', monthEnd);

      const monthPlanned = plannedShifts
        .filter(s => s.date >= monthStart && s.date <= monthEnd);

      const filteredWorked = workedData || [];

      const userIds = [...new Set([
        ...monthPlanned.map((s: any) => s.user_id),
        ...filteredWorked.map((s: any) => s.user_id),
      ])];

      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', userIds);

      const profileMap: Record<string, string> = Object.fromEntries(
        (profilesData || []).map((p: any) => [p.id, p.username])
      );

      const keySet = new Set<string>();
      monthPlanned.forEach((s: any) => keySet.add(`${s.date}__${s.user_id}`));
      filteredWorked.forEach((s: any) => keySet.add(`${s.date}__${s.user_id}`));

      const rows = [...keySet].map(key => {
        const sep = key.indexOf('__');
        const date   = key.slice(0, sep);
        const userId = key.slice(sep + 2);
        const plan    = monthPlanned.find((s: any) => s.date === date && s.user_id === userId);
        const worked  = filteredWorked.find((s: any) => s.date === date && s.user_id === userId);
        const pStart  = plan?.start_time?.slice(0, 5) ?? null;
        const pEnd    = plan?.end_time?.slice(0, 5)   ?? null;
        const wStart  = worked?.start_time?.slice(0, 5) ?? null;
        const wEnd    = worked?.end_time?.slice(0, 5)   ?? null;
        const status  = !plan ? 'extra' : !worked ? 'missing' : (pStart === wStart && pEnd === wEnd) ? 'match' : 'mismatch';
        return { date, userId, username: profileMap[userId] || '—', pStart, pEnd, wStart, wEnd, status };
      }).sort((a, b) => {
        if (a.date < b.date) return -1;
        if (a.date > b.date) return 1;
        const aTime = a.pStart || a.wStart || '';
        const bTime = b.pStart || b.wStart || '';
        if (aTime < bTime) return -1;
        if (aTime > bTime) return 1;
        return (a.username || '').localeCompare(b.username || '', 'de');
      });

      setCompareRows(rows);
    } finally {
      setCompareLoading(false);
    }
  };

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 }),
    end: endOfMonth(currentMonth),
  });

  // Only highlight days where the user was explicitly selected (has a primary shift).
  // Tail shifts (00:00–10:00) don't count. Check per shift's group config.
  const hasMyShift = (dateStr: string) => plannedShifts.some(s => {
    if (s.date !== dateStr || s.user_id !== user?.id) return false;
    const cfg = getGroupQuickConfig(s.group_name || '');
    if (cfg.nextDayTail) {
      return (s.start_time?.slice(0, 5) === '10:00' && s.end_time?.slice(0, 5) === '00:00') ||
             (s.start_time?.slice(0, 5) === '00:00' && s.end_time?.slice(0, 5) === '00:00');
    }
    return s.start_time?.slice(0, 5) === cfg.start && s.end_time?.slice(0, 5) === cfg.end;
  });
  const shiftsForSelectedDate = plannedShifts.filter(s => s.date === selectedDate);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-zinc-700 border-t-emerald-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (userGroups.length === 0) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <p className="text-zinc-400">{t('schedule.noGroupaccess')}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* MOBILE TOP BAR */}
      <div className="lg:hidden bg-zinc-900/90 backdrop-blur-sm border-b border-zinc-800 px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <button onClick={() => router.push('/dashboard')} className="text-zinc-400 p-1 active:scale-90 transition-transform">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold">{t('schedule.title')}</h1>
        {profile?.is_admin
          ? <button onClick={openCompareModal} className="p-1 text-zinc-500 hover:text-zinc-200 active:scale-90 transition-all"><ArrowLeftRight size={20} /></button>
          : <div className="w-8" />
        }
      </div>

      <div className="flex">
        {/* DESKTOP SIDEBAR */}
        <div className="w-64 bg-zinc-900 border-r border-zinc-800 p-6 hidden lg:flex flex-col fixed h-full">
          <div className="mb-10">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
              {t('common.title')}
            </h1>
          </div>
          <nav className="flex flex-col gap-2 flex-1">
            <a href="/dashboard" className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors">
              <BarChart2 size={20} /> {t('schedule.dashboard')}
            </a>
            <a href="/schedule" className="relative flex items-center gap-3 px-4 py-3 rounded-2xl bg-zinc-800 text-white">
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-emerald-400 rounded-full" />
              <CalendarIcon size={20} /> {t('schedule.title')}
            </a>
          </nav>
          <div className="mt-auto pt-6 border-t border-zinc-700 space-y-2">
            {profile?.is_admin && (
              <button onClick={() => router.push('/admin')} className="flex items-center gap-3 px-4 py-3 w-full text-violet-400 hover:bg-zinc-800 rounded-2xl transition-colors">
                <Shield size={20} /> {t('common.adminPanel')}
              </button>
            )}
            <button onClick={() => supabase.auth.signOut().then(() => router.push('/login'))} className="flex items-center gap-3 px-4 py-3 w-full text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-2xl transition-colors">
              <LogOut size={20} /> {t('common.logout')}
            </button>
          </div>
        </div>

        {/* MAIN CONTENT */}
        <div className="flex-1 lg:ml-64">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 lg:py-8 pb-24 lg:pb-8">
            {/* Group tabs */}
            <div data-tour="schedule-group-tabs" className="flex gap-2 bg-zinc-900 p-1 rounded-2xl w-fit mb-8 overflow-x-auto">
              {userGroups.map(group => (
                <button
                  key={group.id}
                  onClick={() => { setActiveGroup(group.name); setActiveGroupId(group.id); }}
                  className={`px-6 py-3 rounded-xl font-medium transition-colors whitespace-nowrap ${activeGroup === group.name ? 'bg-white text-black shadow' : 'hover:bg-zinc-800 text-zinc-400'}`}
                >
                  {group.name}
                </button>
              ))}
            </div>

            {/* Календарь */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-6">
              <div
                className="flex items-center justify-between mb-6"
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
              >
                <button data-tour="schedule-month-prev" onClick={() => changeMonth(-1)} className="p-3 hover:bg-zinc-800 rounded-2xl transition-colors active:scale-90">
                  <ChevronLeft size={20} />
                </button>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl sm:text-2xl font-semibold capitalize select-none">
                    {format(currentMonth, 'LLLL yyyy', { locale: de })}
                  </h2>
                  {profile?.is_admin && (
                    <button onClick={openCompareModal} className="hidden lg:flex text-zinc-600 hover:text-zinc-300 transition-colors p-1 rounded-lg hover:bg-zinc-800" title="Kalender vergleichen">
                      <ArrowLeftRight size={16} />
                    </button>
                  )}
                </div>
                <button data-tour="schedule-month-next" onClick={() => changeMonth(1)} className="p-3 hover:bg-zinc-800 rounded-2xl transition-colors active:scale-90">
                  <ChevronRight size={20} />
                </button>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center text-zinc-400 text-xs sm:text-sm mb-3">
                {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(d => <div key={d} className="font-medium">{d}</div>)}
              </div>

              <div
                key={calKey}
                data-tour="schedule-calendar-grid"
                className="grid grid-cols-7 gap-1 sm:gap-2 animate-cal-in"
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
              >
                {days.map((day, index) => {
                  const dateStr = format(day, 'yyyy-MM-dd');
                  const isCurrentMonth = isSameMonth(day, currentMonth);
                  const isMyShift = hasMyShift(dateStr);
                  const isToday = dateStr === format(new Date(), 'yyyy-MM-dd');

                  return (
                    <button
                      key={index}
                      data-tour={isToday && isCurrentMonth ? 'schedule-today-cell' : undefined}
                      onClick={() => isCurrentMonth && (() => { setSelectedDate(dateStr); setShowModal(true); })()}
                      disabled={!isCurrentMonth}
                      className={`aspect-square min-h-[44px] sm:min-h-0 p-1 sm:p-2 rounded-xl border flex flex-col items-center justify-center transition-all active:scale-90
                        ${isCurrentMonth ? 'border-zinc-700 hover:border-zinc-500 hover:bg-zinc-800 cursor-pointer' : 'opacity-20 border-transparent'}
                        ${isToday ? 'bg-zinc-800 ring-1 ring-white/40' : ''}
                        ${isMyShift ? 'bg-emerald-900/60 border-emerald-500' : ''}
                      `}
                    >
                      <span className={`text-sm sm:text-base font-medium leading-none ${isMyShift ? 'text-emerald-400' : ''}`}>
                        {format(day, 'd')}
                      </span>
                      {isMyShift && <span className="text-[9px] text-emerald-400 mt-0.5">{t('schedule.myShift')}</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Заметки */}
            <div data-tour="schedule-notes-area" className="mt-6 bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <NotebookText size={20} /> {t('schedule.Note.Notes')}
              </h3>

              <textarea
                className="w-full h-20 bg-zinc-800 border border-zinc-700 rounded-2xl p-3 text-sm resize-y focus:outline-none focus:border-zinc-500 transition-colors"
                placeholder={t('schedule.Note.writeMonthNote')}
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
              />

              <div className="flex gap-2 mt-3">
                <button onClick={saveNote} className="flex-1 bg-emerald-600 hover:bg-emerald-500 active:scale-95 py-2.5 rounded-xl font-medium text-sm transition-all">
                  {t('schedule.Note.save')}
                </button>
                <button onClick={() => setNoteText('')} className="px-5 bg-zinc-700 hover:bg-zinc-600 active:scale-95 rounded-xl text-sm transition-all">
                  {t('schedule.Note.clear')}
                </button>
              </div>

              <div className="mt-5 space-y-3">
                {notesForCurrentGroup.length > 0 ? (
                  notesForCurrentGroup.map((note: any, index: number) => {
                    const colors = ['border-emerald-400', 'border-teal-400', 'border-cyan-400', 'border-green-400'];
                    const colorClass = colors[index % colors.length];
                    const noteIdKey = String(note.id);
                    return (
                      <div
                        key={note.id ?? index}
                        className={`bg-zinc-800 border-l-4 ${colorClass} pl-3 py-3 rounded-r-xl flex justify-between items-start stagger-item`}
                        style={{ animationDelay: `${index * 40}ms` }}
                      >
                        <div className="flex-1 pr-3">
                          <div className="text-emerald-400 text-xs font-medium">
                            {note.author || `${t('schedule.Note.user')} ${index + 1}`}
                          </div>
                          <p className="mt-1 text-sm leading-relaxed">{note.text}</p>
                          <span className="text-zinc-500 text-xs block mt-1.5">
                            {note.created_at
                              ? new Date(note.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
                              : note.time}
                          </span>
                        </div>
                        {note.author === profile?.username && (
                          <button
                            onClick={() => deleteNote(note.id)}
                            className={`transition-all p-2 rounded-lg text-xs font-medium ${
                              confirmDeleteNote === noteIdKey
                                ? 'bg-red-600 text-white scale-105'
                                : 'text-zinc-500 hover:text-red-500 opacity-60 hover:opacity-100'
                            }`}
                          >
                            {confirmDeleteNote === noteIdKey ? '?' : <Trash2 size={16} />}
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
          </div>
        </div>
      </div>

      <MobileNav isAdmin={profile?.is_admin} />

      {/* ==================== COMPARE MODAL ==================== */}
      {showCompareModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl">

            {/* Header */}
            <div className="p-5 border-b border-zinc-800 flex justify-between items-start flex-shrink-0">
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <ArrowLeftRight size={18} className="text-zinc-400" />
                  Kalendervergleich
                </h2>
                <p className="text-sm text-zinc-400 mt-0.5">
                  {activeGroup} · {format(currentMonth, 'LLLL yyyy', { locale: de })}
                </p>
              </div>
              <button onClick={() => setShowCompareModal(false)} className="text-zinc-400 hover:text-white transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center">
                <X size={20} />
              </button>
            </div>

            {/* Legend */}
            <div className="px-5 py-2.5 border-b border-zinc-800 flex flex-wrap gap-4 text-xs flex-shrink-0">
              <span className="flex items-center gap-1.5 text-emerald-400"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> Совпадает</span>
              <span className="flex items-center gap-1.5 text-amber-400"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Расхождение</span>
              <span className="flex items-center gap-1.5 text-rose-400"><span className="w-2 h-2 rounded-full bg-rose-400 inline-block" /> Нет отработки</span>
              <span className="flex items-center gap-1.5 text-sky-400"><span className="w-2 h-2 rounded-full bg-sky-400 inline-block" /> Не в плане</span>
            </div>

            {/* Content */}
            <div className="overflow-auto flex-1">
              {compareLoading ? (
                <div className="flex items-center justify-center p-16">
                  <div className="w-8 h-8 border-2 border-zinc-700 border-t-emerald-400 rounded-full animate-spin" />
                </div>
              ) : compareRows.length === 0 ? (
                <p className="text-center text-zinc-500 p-16">Нет данных за этот месяц</p>
              ) : (
                <table className="w-full">
                  <thead className="bg-zinc-800 sticky top-0">
                    <tr>
                      <th className="text-left p-3 text-xs font-medium text-zinc-400">Datum</th>
                      <th className="text-left p-3 text-xs font-medium text-zinc-400">Mitarbeiter</th>
                      <th className="text-left p-3 text-xs font-medium text-zinc-400">Geplant</th>
                      <th className="text-left p-3 text-xs font-medium text-zinc-400">Gearbeitet</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compareRows.map((row, i) => {
                      const rowStyle =
                        row.status === 'mismatch' ? 'bg-amber-950/40 border-amber-900/40' :
                        row.status === 'missing'  ? 'bg-rose-950/40 border-rose-900/40' :
                        row.status === 'extra'    ? 'bg-sky-950/40 border-sky-900/40' :
                        '';
                      return (
                        <tr key={i} className={`border-t border-zinc-800 ${rowStyle}`}>
                          <td className="p-3 text-sm tabular-nums">
                            {format(new Date(row.date + 'T00:00:00'), 'dd.MM')}
                          </td>
                          <td className="p-3 text-sm font-medium">{row.username}</td>
                          <td className={`p-3 text-sm tabular-nums ${row.status === 'extra' ? 'text-zinc-600' : row.status === 'mismatch' ? 'text-amber-300' : ''}`}>
                            {row.pStart ? `${row.pStart} – ${row.pEnd}` : <span className="text-zinc-600">—</span>}
                          </td>
                          <td className={`p-3 text-sm tabular-nums ${row.status === 'missing' ? 'text-zinc-600' : row.status === 'mismatch' ? 'text-amber-300' : ''}`}>
                            {row.wStart ? `${row.wStart} – ${row.wEnd}` : <span className="text-zinc-600">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-zinc-800 flex justify-between items-center flex-shrink-0">
              <span className="text-xs text-zinc-500">{compareRows.filter(r => r.status !== 'match').length} расхождений из {compareRows.length}</span>
              <button onClick={() => setShowCompareModal(false)} className="px-6 py-2.5 bg-zinc-700 hover:bg-zinc-600 rounded-xl text-sm transition-colors">
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}

      {currentUserRole === 'editor' ? (
        <ScheduleShiftModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          selectedDate={selectedDate}
          activeGroup={activeGroup || ''}
          currentUserId={user?.id}
          onShiftAdded={handleShiftAdded}
          onShiftUpdated={handleShiftUpdated}
          onShiftDeleted={handleShiftDeleted}
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
