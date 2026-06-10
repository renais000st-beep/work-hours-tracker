'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/i18n';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, isSameMonth } from 'date-fns';
import { de } from 'date-fns/locale';
import { LogOut, Link, CheckCircle2, LayoutDashboard, Calendar as CalendarIcon, BarChart3, Trash2, Pencil, Download, Shield, FileDown, ChevronLeft, ChevronRight } from 'lucide-react';
import ShiftModal from './ShiftModal';
import MobileNav from '@/app/components/MobileNav';
import { useToast } from '@/app/components/Toast';
import * as XLSX from 'xlsx';
import { useOnboarding } from '@/lib/onboarding/OnboardingContext';

function useCountUp(value: number, duration = 600) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);

  useEffect(() => {
    const start = prevRef.current;
    if (start === value) return;
    const startTime = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(start + (value - start) * eased));
      if (t < 1) requestAnimationFrame(tick);
      else prevRef.current = value;
    };
    requestAnimationFrame(tick);
  }, [value, duration]);

  return display;
}

export default function Dashboard() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'calendar' | 'stats'>('calendar');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [calKey, setCalKey] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [shifts, setShifts] = useState<any[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [editingShift, setEditingShift] = useState<any>(null);

  const [userAccessibleGroups, setUserAccessibleGroups] = useState<string[]>([]);
  const [selectedCalendarGroup, setSelectedCalendarGroup] = useState<string>('');
  const [selectedStatsGroup, setSelectedStatsGroup] = useState<string>('all');
  const [selectedStatMonth, setSelectedStatMonth] = useState<string>('');
  const [hasTelegramLinked, setHasTelegramLinked] = useState(false);

  // swipe
  const touchStartX = useRef<number | null>(null);

  const router = useRouter();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { startOnboarding, setUserGroupCount } = useOnboarding();

  const handleDateClick = (date: string) => {
    setSelectedDate(date);
    const existing = shifts.find(s => s.date === date && s.group === selectedCalendarGroup);
    setEditingShift(existing || null);
    setShowModal(true);
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.push('/login');

      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      setProfile(prof);

      const { data: telegramUser } = await supabase
        .from('telegram_users')
        .select('id')
        .eq('profile_id', user.id)
        .single();

      setHasTelegramLinked(!!telegramUser);

      if (!prof?.username) {
        router.push('/setup-username');
        return;
      }

      const { data: ugData } = await supabase
        .from('user_groups')
        .select(`groups (name)`)
        .eq('user_id', user.id);

      const groups = (ugData as any[])?.map(item => item.groups?.name).filter(Boolean) || [];
      setUserAccessibleGroups(groups);
      setUserGroupCount(groups.length);

      const { data } = await supabase
        .from('work_shifts')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });

      setShifts(data || []);
    } catch (err) {
      console.error('Ошибка загрузки dashboard:', err);
    } finally {
      setLoading(false);
      startOnboarding();
    }
  };

  const changeMonth = (dir: 1 | -1) => {
    setCurrentMonth(prev => dir === 1 ? addMonths(prev, 1) : subMonths(prev, 1));
    setCalKey(k => k + 1);
  };

  // swipe handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 50) changeMonth(dx < 0 ? 1 : -1);
    touchStartX.current = null;
  };

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

  const handleDeleteShift = async (id: number) => {
    if (confirmDeleteId === id) {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
      setConfirmDeleteId(null);
      const currentStatsGroup = selectedStatsGroup;
      const { error } = await supabase.from('work_shifts').delete().eq('id', id);
      if (!error) {
        await loadData();
        setSelectedStatsGroup(currentStatsGroup);
        showToast(t('admin.Alert.shiftdeleted'), 'success');
      } else {
        showToast(t('errors.deleteFailed'), 'error');
      }
    } else {
      setConfirmDeleteId(id);
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
      confirmTimerRef.current = setTimeout(() => setConfirmDeleteId(null), 3000);
    }
  };

  const handleSaveShift = async (shiftData: any) => {
    const currentGroup = selectedCalendarGroup;

    if (shiftData.id) {
      const { id, group: _g, ...fields } = shiftData;
      const { error } = await supabase
        .from('work_shifts')
        .update(fields)
        .eq('id', id);
      if (error) {
        showToast(t('errors.saveFailed') + error.message, 'error');
      } else {
        await loadData();
        setSelectedCalendarGroup(currentGroup);
        showToast(t('shiftModal.updated') || t('shiftModal.saveShift'), 'success');
      }
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('work_shifts')
        .insert({ ...shiftData, user_id: user?.id, group: currentGroup });
      if (error) {
        showToast(t('errors.saveFailed') + error.message, 'error');
      } else {
        await loadData();
        setSelectedCalendarGroup(currentGroup);
        showToast(t('shiftModal.saveShift'), 'success');
      }
    }
  };

  useEffect(() => {
    if (userAccessibleGroups.length > 0 && !selectedCalendarGroup) {
      setSelectedCalendarGroup(userAccessibleGroups[0]);
    }
  }, [userAccessibleGroups, selectedCalendarGroup]);

  const hasShift = (dateStr: string) => shifts.some(s => s.date === dateStr && s.group === selectedCalendarGroup);

  const getShiftHours = (dateStr: string) => {
    const s = shifts.find(s => s.date === dateStr && s.group === selectedCalendarGroup);
    return s?.total_hours ?? null;
  };

  const groupedByMonth = shifts.reduce((acc: any, shift: any) => {
    const key = format(new Date(shift.date), 'yyyy-MM');
    if (!acc[key]) acc[key] = [];
    acc[key].push(shift);
    return acc;
  }, {});

  const monthList = Object.keys(groupedByMonth).sort();

  useEffect(() => {
    if (activeTab === 'stats' && monthList.length > 0) {
      if (!selectedStatMonth || !monthList.includes(selectedStatMonth)) {
        setSelectedStatMonth(monthList[0]);
      }
    }
  }, [activeTab, monthList]);

  const getFilteredShifts = () => {
    let result = shifts;
    if (selectedStatsGroup !== 'all') result = result.filter(s => s.group === selectedStatsGroup);
    if (selectedStatMonth) result = result.filter(s => s.date.startsWith(selectedStatMonth));
    return result;
  };

  const filteredShifts = getFilteredShifts();
  const totalHours = filteredShifts.reduce((sum: number, s: any) => sum + (s.total_hours || 0), 0);
  const displayedHours = useCountUp(totalHours);

  const downloadExcel = () => {
    if (filteredShifts.length === 0) { showToast(t('common.noData'), 'info'); return; }
    const data = filteredShifts.map((s: any) => ({
      Дата: format(new Date(s.date), 'dd.MM.yyyy'),
      От: s.start_time?.slice(0, 5),
      До: s.end_time?.slice(0, 5),
      День: s.day_hours || 0,
      Ночь: s.night_hours || 0,
      Воскресенье: s.sunday_hours || 0,
      Праздник: s.holiday_hours || 0,
      Итого: s.total_hours || 0,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Смены');
    const groupLabel = selectedStatsGroup === 'all' ? 'Alle' : selectedStatsGroup;
    XLSX.writeFile(wb, `Arbeitszeiten_${groupLabel}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const downloadPDF = () => {
    if (filteredShifts.length === 0) { showToast(t('common.noData'), 'info'); return; }
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const groupLabel = selectedStatsGroup === 'all' ? 'Alle' : selectedStatsGroup;
    let tableHTML = `
      <h1 style="text-align:center;font-family:Arial;">Arbeitszeiten — ${groupLabel}</h1>
      <p style="text-align:center;">${selectedStatMonth ? format(new Date(selectedStatMonth + '-01'), 'LLLL yyyy', { locale: de }) : 'Alle Monate'} | ${new Date().toLocaleDateString('de-DE')}</p>
      <table border="1" cellpadding="8" cellspacing="0" style="width:100%;border-collapse:collapse;font-family:Arial;margin-top:20px;">
        <thead><tr style="background:#1f2937;color:white;"><th>Datum</th><th>Von</th><th>Bis</th><th>Tag</th><th>Nacht</th><th>So</th><th>Feiertag</th><th>Gesamt</th></tr></thead>
        <tbody>`;
    filteredShifts.forEach(s => {
      tableHTML += `<tr><td>${format(new Date(s.date), 'dd.MM.yyyy')}</td><td>${s.start_time?.slice(0, 5) || '-'}</td><td>${s.end_time?.slice(0, 5) || '-'}</td><td style="text-align:right;">${s.day_hours || 0}</td><td style="text-align:right;">${s.night_hours || 0}</td><td style="text-align:right;">${s.sunday_hours || 0}</td><td style="text-align:right;">${s.holiday_hours || 0}</td><td style="text-align:right;font-weight:bold;">${s.total_hours || 0}</td></tr>`;
    });
    tableHTML += `</tbody></table><p style="text-align:center;margin-top:30px;color:#666;">Erstellt mit Arbeitszeiterfassung • ${new Date().toLocaleString('de-DE')}</p>`;
    printWindow.document.write(tableHTML);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  };

  const handleTelegramLink = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { showToast(t('errors.notAuthorized'), 'error'); return; }
      const token = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      const { error } = await supabase.from('telegram_link_tokens').insert({ profile_id: user.id, token, expires_at: expiresAt });
      if (error) { showToast(t('errors.telegramLinkFailed'), 'error'); return; }
      window.open(`https://t.me/work_hours_sozialbaer_bot?start=verify_${token}`, '_blank');
    } catch {
      showToast(t('errors.generic'), 'error');
    }
  };

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 }),
    end: endOfMonth(currentMonth),
  });

  // ---- SKELETON ----
  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white">
        <div className="lg:hidden bg-zinc-900/90 border-b border-zinc-800 px-4 py-3 flex items-center justify-between sticky top-0 z-50">
          <div className="w-8 h-8 bg-zinc-800 rounded-lg animate-pulse" />
          <div className="w-40 h-6 bg-zinc-800 rounded-lg animate-pulse" />
          <div className="w-8" />
        </div>
        <div className="flex">
          <div className="w-64 bg-zinc-900 border-r border-zinc-800 hidden lg:block fixed h-full" />
          <div className="flex-1 lg:ml-64">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 lg:py-8 pb-24 lg:pb-8">
              <div className="h-12 w-48 bg-zinc-800 rounded-2xl mb-8 animate-pulse" />
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-6">
                <div className="flex justify-between mb-6">
                  <div className="w-10 h-10 bg-zinc-800 rounded-2xl animate-pulse" />
                  <div className="w-52 h-8 bg-zinc-800 rounded-lg animate-pulse" />
                  <div className="w-10 h-10 bg-zinc-800 rounded-2xl animate-pulse" />
                </div>
                <div className="grid grid-cols-7 gap-1 mb-3">
                  {['Mo','Di','Mi','Do','Fr','Sa','So'].map(d => (
                    <div key={d} className="h-5 bg-zinc-800 rounded animate-pulse" />
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1 sm:gap-2">
                  {Array.from({ length: 35 }).map((_, i) => (
                    <div key={i} className="aspect-square bg-zinc-800 rounded-xl animate-pulse" />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* MOBILE TOP BAR */}
      <div className="lg:hidden bg-zinc-900/90 backdrop-blur-sm border-b border-zinc-800 px-4 py-3 flex items-center justify-center sticky top-0 z-40">
        <h1 className="text-xl font-bold">{t('common.title')}</h1>
      </div>

      <div className="flex">
        {/* SIDEBAR */}
        <div className="w-64 bg-zinc-900 border-r border-zinc-800 p-6 hidden lg:flex flex-col fixed h-full">
          <div className="mb-10">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
              {t('common.title')}
            </h1>
          </div>
          <nav className="flex flex-col gap-2 flex-1">
            <a href="/dashboard" className="relative flex items-center gap-3 px-4 py-3 rounded-2xl bg-zinc-800 text-white">
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-emerald-400 rounded-full" />
              <LayoutDashboard size={20} /> {t('common.dashboard')}
            </a>
            <a href="/schedule" data-tour="sidebar-schedule" className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors">
              <CalendarIcon size={20} /> {t('schedule.title')}
            </a>
          </nav>

          <div className="mt-auto pt-6 border-t border-zinc-700 space-y-2">
            {hasTelegramLinked ? (
              <div className="flex items-center gap-3 px-4 py-3 rounded-2xl text-emerald-400">
                <CheckCircle2 size={20} />
                <span className="text-sm">{t('common.telegramLinked')}</span>
              </div>
            ) : (
              <button
                onClick={handleTelegramLink}
                className="flex items-center gap-3 px-4 py-3 w-full rounded-2xl text-emerald-400 hover:bg-zinc-800 transition-colors text-left"
              >
                <Link size={20} />
                <div>
                  <div className="text-sm">{t('common.telegram')}</div>
                  <div className="text-xs text-zinc-500 mt-0.5">{t('common.telegramHint')}</div>
                </div>
              </button>
            )}
            {profile?.is_admin && (
              <button
                onClick={() => router.push('/admin')}
                className="flex items-center gap-3 px-4 py-3 w-full text-violet-400 hover:bg-zinc-800 rounded-2xl transition-colors"
              >
                <Shield size={20} /> {t('common.adminPanel')}
              </button>
            )}
            <button
              onClick={() => supabase.auth.signOut().then(() => router.push('/login'))}
              className="flex items-center gap-3 px-4 py-3 w-full text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-2xl transition-colors"
            >
              <LogOut size={20} /> {t('common.logout')}
            </button>
          </div>
        </div>

        {/* MAIN CONTENT */}
        <div className="flex-1 min-w-0 lg:ml-64">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 lg:py-8 pb-24 lg:pb-8">
            {/* Табы */}
            <div className="flex bg-zinc-900 p-1 rounded-2xl w-fit mb-8">
              <button
                data-tour="calendar-tab"
                onClick={() => setActiveTab('calendar')}
                className={`px-6 py-3 rounded-xl flex items-center gap-2 transition-colors ${activeTab === 'calendar' ? 'bg-white text-black shadow' : 'hover:bg-zinc-800 text-zinc-400'}`}
              >
                <CalendarIcon size={20} /> {t('common.calendar')}
              </button>
              <button
                data-tour="dashboard-stats-tab"
                onClick={() => setActiveTab('stats')}
                className={`px-6 py-3 rounded-xl flex items-center gap-2 transition-colors ${activeTab === 'stats' ? 'bg-white text-black shadow' : 'hover:bg-zinc-800 text-zinc-400'}`}
              >
                <BarChart3 size={20} /> {t('common.stats')}
              </button>
            </div>

            {/* ==================== КАЛЕНДАРЬ ==================== */}
            {activeTab === 'calendar' && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-6">
                {userAccessibleGroups.length > 0 && (
                  <div data-tour="dashboard-group-selector" className="flex bg-zinc-900 p-1 rounded-2xl w-fit mb-6 overflow-x-auto">
                    {userAccessibleGroups.map(group => (
                      <button
                        key={group}
                        onClick={() => setSelectedCalendarGroup(group)}
                        className={`px-6 py-3 rounded-xl whitespace-nowrap transition-colors ${selectedCalendarGroup === group ? 'bg-white text-black shadow' : 'text-zinc-400 hover:bg-zinc-800'}`}
                      >
                        {group}
                      </button>
                    ))}
                  </div>
                )}

                <div
                  className="flex items-center justify-between mb-6"
                  onTouchStart={handleTouchStart}
                  onTouchEnd={handleTouchEnd}
                >
                  <button data-tour="dashboard-month-prev" onClick={() => changeMonth(-1)} className="p-3 hover:bg-zinc-800 rounded-2xl transition-colors active:scale-90">
                    <ChevronLeft size={20} />
                  </button>
                  <h2 className="text-xl sm:text-2xl font-semibold capitalize select-none">
                    {format(currentMonth, 'LLLL yyyy', { locale: de })}
                    {selectedCalendarGroup && <span className="text-zinc-400 ml-2 text-lg">— {selectedCalendarGroup}</span>}
                  </h2>
                  <button data-tour="dashboard-month-next" onClick={() => changeMonth(1)} className="p-3 hover:bg-zinc-800 rounded-2xl transition-colors active:scale-90">
                    <ChevronRight size={20} />
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-1 text-center text-zinc-400 text-xs sm:text-sm mb-3">
                  {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(d => (
                    <div key={d} className="font-medium">{d}</div>
                  ))}
                </div>

                <div
                  key={calKey}
                  data-tour="dashboard-calendar-grid"
                  className="grid grid-cols-7 gap-1 sm:gap-2 animate-cal-in"
                  onTouchStart={handleTouchStart}
                  onTouchEnd={handleTouchEnd}
                >
                  {days.map((day, index) => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const isCurrentMonth = isSameMonth(day, currentMonth);
                    const isToday = dateStr === format(new Date(), 'yyyy-MM-dd');
                    const hours = isCurrentMonth ? getShiftHours(dateStr) : null;
                    const hasShiftToday = hours !== null;

                    return (
                      <button
                        key={index}
                        data-tour={isToday && isCurrentMonth ? 'today-cell' : undefined}
                        onClick={() => isCurrentMonth && handleDateClick(dateStr)}
                        disabled={!isCurrentMonth}
                        className={`aspect-square min-h-[44px] sm:min-h-0 p-1 sm:p-2 rounded-xl border flex flex-col items-center justify-center transition-all text-sm sm:text-base active:scale-90
                          ${isCurrentMonth ? 'border-zinc-700 hover:border-zinc-500 hover:bg-zinc-800 cursor-pointer' : 'opacity-20 border-transparent'}
                          ${isToday ? 'bg-zinc-800 ring-1 ring-white/40' : ''}
                          ${hasShiftToday ? 'bg-emerald-900/30 border-emerald-600/70' : ''}
                        `}
                      >
                        <span className={`font-medium leading-none ${isToday ? 'font-bold text-white' : ''} ${hasShiftToday ? 'text-emerald-400' : ''}`}>
                          {format(day, 'd')}
                        </span>
                        {hasShiftToday && (
                          <span className="text-[10px] font-bold text-emerald-400 leading-none mt-0.5">{hours}h</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ==================== СТАТИСТИКА ==================== */}
            {activeTab === 'stats' && (
              <div className="min-w-0">
                <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
                  {t('common.stats')}
                </h2>

                <div data-tour="stats-group-selector" className="flex bg-zinc-900 p-1 rounded-2xl w-fit mb-6 overflow-x-auto">
                  <button
                    onClick={() => setSelectedStatsGroup('all')}
                    className={`px-6 py-3 rounded-xl transition-colors ${selectedStatsGroup === 'all' ? 'bg-white text-black shadow' : 'text-zinc-400 hover:bg-zinc-800'}`}
                  >
                    Alle
                  </button>
                  {userAccessibleGroups.map(group => (
                    <button
                      key={group}
                      onClick={() => setSelectedStatsGroup(group)}
                      className={`px-6 py-3 rounded-xl transition-colors ${selectedStatsGroup === group ? 'bg-white text-black shadow' : 'text-zinc-400 hover:bg-zinc-800'}`}
                    >
                      {group}
                    </button>
                  ))}
                </div>

                {monthList.length > 0 && (
                  <div data-tour="stats-month-selector" className="flex gap-2 overflow-x-auto pb-2 mb-4 hide-scrollbar">
                    {monthList.map((monthKey) => {
                      const monthName = format(new Date(monthKey + '-01'), 'LLLL yyyy', { locale: de });
                      const monthTotal = groupedByMonth[monthKey].reduce((sum: number, s: any) => sum + (s.total_hours || 0), 0);
                      return (
                        <button
                          key={monthKey}
                          onClick={() => setSelectedStatMonth(monthKey)}
                          className={`px-4 py-2.5 sm:px-6 sm:py-3 rounded-2xl whitespace-nowrap transition-all text-xs sm:text-sm font-medium border flex-shrink-0 active:scale-[0.985] ${
                            selectedStatMonth === monthKey
                              ? 'bg-zinc-100 text-zinc-950 border-zinc-100'
                              : 'border-zinc-700 hover:bg-zinc-800 text-zinc-400 active:bg-zinc-700'
                          }`}
                        >
                          {monthName}
                          <span className="ml-2 text-xs opacity-70">({monthTotal}h)</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {selectedStatMonth && (
                  <div data-tour="stats-summary-card" className="bg-zinc-800 border border-zinc-700 rounded-2xl p-5 flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
                    <div>
                      <p className="text-zinc-400 text-sm mb-1">
                        {selectedStatsGroup === 'all' ? 'Alle' : selectedStatsGroup} •{' '}
                        {format(new Date(selectedStatMonth + '-01'), 'LLLL yyyy', { locale: de })}
                      </p>
                      <p className="text-4xl font-bold text-emerald-400 tabular-nums">
                        {displayedHours} Stunden
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={downloadExcel}
                        className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-500 active:scale-95 px-4 py-3 rounded-xl flex items-center justify-center gap-2 font-medium transition-all"
                      >
                        <Download size={18} /> {t('common.downloadExcel')}
                      </button>
                      <button
                        onClick={downloadPDF}
                        className="flex-1 sm:flex-none bg-rose-600 hover:bg-rose-500 active:scale-95 px-4 py-3 rounded-xl flex items-center justify-center gap-2 font-medium transition-all"
                      >
                        <FileDown size={18} /> {t('common.downloadPDF')}
                      </button>
                    </div>
                  </div>
                )}

                <div data-tour="stats-shifts-table" className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-x-auto">
                  <table className="w-full min-w-[800px]">
                    <thead>
                      <tr className="bg-zinc-800">
                        <th className="text-left p-4 font-medium text-zinc-300">Datum</th>
                        <th className="text-left p-4 font-medium text-zinc-300">Von</th>
                        <th className="text-left p-4 font-medium text-zinc-300">Bis</th>
                        <th className="text-right p-4 font-medium text-zinc-300">Tag</th>
                        <th className="text-right p-4 font-medium text-zinc-300">Nacht</th>
                        <th className="text-right p-4 font-medium text-zinc-300">So</th>
                        <th className="text-right p-4 font-medium text-zinc-300">Feiertag</th>
                        <th className="text-right p-4 font-medium text-zinc-300">Gesamt</th>
                        <th className="w-24 text-center font-medium text-zinc-300">Aktion</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredShifts.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="p-12 text-center text-zinc-500">
                            <CalendarIcon size={32} className="mx-auto mb-3 opacity-30" />
                            {t('dashboard.noShifts')}
                          </td>
                        </tr>
                      ) : (
                        filteredShifts
                          .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
                          .map((shift: any) => (
                            <tr key={shift.id} className="border-t border-zinc-800 hover:bg-zinc-800/50 transition-colors">
                              <td className="p-4">{format(new Date(shift.date), 'dd.MM.yyyy')}</td>
                              <td className="p-4">{shift.start_time?.slice(0, 5)}</td>
                              <td className="p-4">{shift.end_time?.slice(0, 5)}</td>
                              <td className="p-4 text-right text-emerald-400">{shift.day_hours || 0}</td>
                              <td className="p-4 text-right text-violet-400">{shift.night_hours || 0}</td>
                              <td className="p-4 text-right text-amber-400">{shift.sunday_hours || 0}</td>
                              <td className="p-4 text-right text-orange-400">{shift.holiday_hours || 0}</td>
                              <td className="p-4 text-right font-bold">{shift.total_hours || 0}</td>
                              <td className="p-4 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    onClick={() => { setSelectedDate(shift.date); setEditingShift(shift); setShowModal(true); }}
                                    className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-zinc-500 hover:text-emerald-400 transition-colors"
                                    title="Редактировать"
                                  >
                                    <Pencil size={14} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteShift(shift.id)}
                                    className={`min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg transition-all text-xs font-medium px-1 ${
                                      confirmDeleteId === shift.id
                                        ? 'bg-red-600 text-white scale-105'
                                        : 'text-zinc-500 hover:text-red-400'
                                    }`}
                                  >
                                    {confirmDeleteId === shift.id ? '?' : <Trash2 size={14} />}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <MobileNav isAdmin={profile?.is_admin} />

      <ShiftModal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingShift(null); }}
        selectedDate={selectedDate}
        group={selectedCalendarGroup}
        onSave={handleSaveShift}
        existingShift={editingShift}
      />
    </div>
  );
}
