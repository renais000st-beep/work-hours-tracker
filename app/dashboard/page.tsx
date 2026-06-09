'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/i18n';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, isSameMonth } from 'date-fns';
import { de } from 'date-fns/locale';
import { LogOut, Link, LayoutDashboard, Calendar as CalendarIcon, BarChart3, Trash2, Download, Shield, Menu, FileDown } from 'lucide-react';
import ShiftModal from './ShiftModal';
import * as XLSX from 'xlsx';

export default function Dashboard() {
  const [profile, setProfile] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'calendar' | 'stats'>('calendar');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showModal, setShowModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [shifts, setShifts] = useState<any[]>([]);

  const [userAccessibleGroups, setUserAccessibleGroups] = useState<string[]>([]);
  const [selectedCalendarGroup, setSelectedCalendarGroup] = useState<string>('');
  const [selectedStatsGroup, setSelectedStatsGroup] = useState<string>('all');

  const [selectedStatMonth, setSelectedStatMonth] = useState<string>('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [hasTelegramLinked, setHasTelegramLinked] = useState(false);

  const handleDateClick = (date: string) => {
    setSelectedDate(date);
    setShowModal(true);
  };

  const router = useRouter();
  const { t } = useTranslation();

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
    if (!confirm(t('common.deleteConfirm'))) return;

    const currentStatsGroup = selectedStatsGroup;

    const { error } = await supabase.from('work_shifts').delete().eq('id', id);

    if (!error) {
      await loadData();
      setSelectedStatsGroup(currentStatsGroup);
    } else {
      alert(t('errors.deleteFailed'));
    }
  };

  const handleSaveShift = async (shiftData: any) => {
    const currentGroup = selectedCalendarGroup;

    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
      .from('work_shifts')
      .insert({
        ...shiftData,
        user_id: user?.id,
        group: currentGroup
      });

    if (error) {
      alert(t('errors.saveFailed') + error.message);
    } else {
      await loadData();
      setSelectedCalendarGroup(currentGroup);
    }
  };

  useEffect(() => {
    if (userAccessibleGroups.length > 0 && !selectedCalendarGroup) {
      setSelectedCalendarGroup(userAccessibleGroups[0]);
    }
  }, [userAccessibleGroups, selectedCalendarGroup]);

  const hasShift = (dateStr: string) => {
    return shifts.some(s =>
      s.date === dateStr &&
      s.group === selectedCalendarGroup
    );
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

    if (selectedStatsGroup !== 'all') {
      result = result.filter(s => s.group === selectedStatsGroup);
    }

    if (selectedStatMonth) {
      result = result.filter(s => s.date.startsWith(selectedStatMonth));
    }

    return result;
  };

  const filteredShifts = getFilteredShifts();

  const downloadExcel = () => {
    if (filteredShifts.length === 0) {
      alert(t('common.noData'));
      return;
    }

    const data = filteredShifts.map((s: any) => ({
      Дата: format(new Date(s.date), 'dd.MM.yyyy'),
      От: s.start_time?.slice(0,5),
      До: s.end_time?.slice(0,5),
      День: s.day_hours || 0,
      Ночь: s.night_hours || 0,
      Воскресенье: s.sunday_hours || 0,
      Праздник: s.holiday_hours || 0,
      Итого: s.total_hours || 0,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Смены");

    const groupLabel = selectedStatsGroup === 'all' ? 'Alle' : selectedStatsGroup;
    XLSX.writeFile(wb, `Arbeitszeiten_${groupLabel}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const downloadPDF = () => {
    if (filteredShifts.length === 0) {
      alert(t('common.noData'));
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const groupLabel = selectedStatsGroup === 'all' ? 'Alle' : selectedStatsGroup;

    let tableHTML = `
      <h1 style="text-align:center; font-family:Arial;">Arbeitszeiten — ${groupLabel}</h1>
      <p style="text-align:center;">${selectedStatMonth ? format(new Date(selectedStatMonth + '-01'), 'LLLL yyyy', { locale: de }) : 'Alle Monate'} | ${new Date().toLocaleDateString('de-DE')}</p>
      <table border="1" cellpadding="8" cellspacing="0" style="width:100%; border-collapse:collapse; font-family:Arial; margin-top:20px;">
        <thead>
          <tr style="background:#1f2937; color:white;">
            <th>Datum</th>
            <th>Von</th>
            <th>Bis</th>
            <th>Tag</th>
            <th>Nacht</th>
            <th>So</th>
            <th>Feiertag</th>
            <th>Gesamt</th>
          </tr>
        </thead>
        <tbody>`;

    filteredShifts.forEach(s => {
      tableHTML += `
        <tr>
          <td>${format(new Date(s.date), 'dd.MM.yyyy')}</td>
          <td>${s.start_time?.slice(0,5) || '-'}</td>
          <td>${s.end_time?.slice(0,5) || '-'}</td>
          <td style="text-align:right;">${s.day_hours || 0}</td>
          <td style="text-align:right;">${s.night_hours || 0}</td>
          <td style="text-align:right;">${s.sunday_hours || 0}</td>
          <td style="text-align:right;">${s.holiday_hours || 0}</td>
          <td style="text-align:right; font-weight:bold;">${s.total_hours || 0}</td>
        </tr>`;
    });

    tableHTML += `</tbody></table>
      <p style="text-align:center; margin-top:30px; color:#666;">Erstellt mit Arbeitszeiterfassung • ${new Date().toLocaleString('de-DE')}</p>`;

    printWindow.document.write(tableHTML);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  const handleTelegramLink = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert(t('errors.notAuthorized'));
        return;
      }

      const token = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

      const { error } = await supabase
        .from('telegram_link_tokens')
        .insert({
          profile_id: user.id,
          token: token,
          expires_at: expiresAt,
        });

      if (error) {
        alert(t('errors.telegramLinkFailed'));
        return;
      }

      const telegramLink = `https://t.me/work_hours_sozialbaer_bot?start=verify_${token}`;
      window.open(telegramLink, '_blank');

    } catch (err) {
      console.error('Ошибка при создании ссылки:', err);
      alert(t('errors.generic'));
    }
  };

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 }),
    end: endOfMonth(currentMonth),
  });

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* MOBILE TOP BAR */}
      <div className="lg:hidden bg-zinc-900/90 backdrop-blur-sm border-b border-zinc-800 px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2">
          <Menu size={28} />
        </button>
        <h1 className="text-xl font-bold">{t('common.title')}</h1>
        <div className="w-8" />
      </div>

      {/* ==================== МОБИЛЬНОЕ МЕНЮ ==================== */}
{mobileMenuOpen && (
  <div
    className="lg:hidden fixed inset-0 bg-black/80 backdrop-blur-sm z-[100]"
    onClick={() => setMobileMenuOpen(false)}
  >
    <div
      className="bg-zinc-900 w-72 h-full p-6 shadow-xl"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-xl font-bold">{t('common.title')}</h2>
        <button onClick={() => setMobileMenuOpen(false)} className="text-2xl">✕</button>
      </div>

      <nav className="flex flex-col gap-2">
        <a
          href="/dashboard"
          className="flex items-center gap-3 px-4 py-4 rounded-2xl bg-zinc-800 text-white text-lg"
          onClick={() => setMobileMenuOpen(false)}
        >
          <LayoutDashboard size={24} /> {t('common.dashboard')}
        </a>

        <a
          href="/schedule"
          className="flex items-center gap-3 px-4 py-4 rounded-2xl hover:bg-zinc-800 text-white text-lg"
          onClick={() => setMobileMenuOpen(false)}
        >
          <CalendarIcon size={24} /> {t('schedule.title')}
        </a>

        {profile?.is_admin && (
          <a
            href="/admin"
            className="flex items-center gap-3 px-4 py-4 rounded-2xl hover:bg-zinc-800 text-violet-400 text-lg"
            onClick={() => setMobileMenuOpen(false)}
          >
            <Shield size={24} /> {t('common.adminPanel')}
          </a>
        )}

        <button
          onClick={() => {
            supabase.auth.signOut().then(() => router.push('/login'));
            setMobileMenuOpen(false);
          }}
          className="flex items-center gap-3 px-4 py-4 rounded-2xl hover:bg-zinc-800 text-zinc-400 text-lg mt-4"
        >
          <LogOut size={24} /> {t('common.logout')}
        </button>
      </nav>
    </div>
  </div>
)}

      <div className="flex">
        {/* SIDEBAR */}
        <div className="w-64 bg-zinc-900 border-r border-zinc-800 p-6 hidden lg:flex flex-col fixed h-full">
          <div className="mb-10">
            <h1 className="text-2xl font-bold">{t('common.title')}</h1>
          </div>
          <nav className="flex flex-col gap-2 flex-1">
            <a href="/dashboard" className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-zinc-800 text-white">
              <LayoutDashboard size={20} /> {t('common.dashboard')}
            </a>
            <a href="/schedule" className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-zinc-800 text-white">
              <CalendarIcon size={20} /> {t('schedule.title')}
            </a>
          </nav>

         <div className="mt-auto pt-6 border-t border-zinc-700 space-y-2">
  {!hasTelegramLinked && (
    <div className="px-4 py-3 w-full rounded-2xl opacity-50 cursor-not-allowed">
      <div className="flex items-center gap-3 text-emerald-400">
        <Link size={20} /> {t('common.telegram')}
      </div>
      <p className="text-xs text-zinc-500 mt-0.5 ml-8">{t('common.telegramWip')}</p>
    </div>
  )}

  {profile?.is_admin && (
    <button
      onClick={() => router.push('/admin')}
      className="flex items-center gap-3 px-4 py-3 w-full text-violet-400 hover:bg-zinc-800 rounded-2xl"
    >
      <Shield size={20} /> {t('common.adminPanel')}
    </button>
  )}

  <button
    onClick={() => supabase.auth.signOut().then(() => router.push('/login'))}
    className="flex items-center gap-3 px-4 py-3 w-full text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-2xl"
  >
    <LogOut size={20} /> {t('common.logout')}
  </button>
</div>
        </div>

        {/* MAIN CONTENT */}
        <div className="flex-1 lg:ml-64">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 lg:py-8">
            {/* Табы */}
            <div className="flex bg-zinc-900 p-1 rounded-2xl w-fit mb-8">
              <button onClick={() => setActiveTab('calendar')} className={`px-6 py-3 rounded-xl flex items-center gap-2 transition-colors ${activeTab === 'calendar' ? 'bg-white text-black shadow' : 'hover:bg-zinc-800 text-zinc-400'}`}>
                <CalendarIcon size={20} /> {t('common.calendar')}
              </button>
              <button onClick={() => setActiveTab('stats')} className={`px-6 py-3 rounded-xl flex items-center gap-2 transition-colors ${activeTab === 'stats' ? 'bg-white text-black shadow' : 'hover:bg-zinc-800 text-zinc-400'}`}>
                <BarChart3 size={20} /> {t('common.stats')}
              </button>
            </div>

            {/* ==================== КАЛЕНДАРЬ ==================== */}
            {activeTab === 'calendar' && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-6">
                {userAccessibleGroups.length > 0 && (
                  <div className="flex bg-zinc-900 p-1 rounded-2xl w-fit mb-6 overflow-x-auto">
                    {userAccessibleGroups.map(group => (
                      <button
                        key={group}
                        onClick={() => setSelectedCalendarGroup(group)}
                        className={`px-6 py-3 rounded-xl whitespace-nowrap transition-colors ${selectedCalendarGroup === group ? 'bg-white text-black shadow' : 'text-zinc-400 hover:bg-zinc-800'}`}>
                        {group}
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between mb-6">
                  <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-3 hover:bg-zinc-800 rounded-2xl">←</button>
                  <h2 className="text-2xl sm:text-3xl font-semibold capitalize">
                    {format(currentMonth, 'LLLL yyyy', { locale: de })} — {selectedCalendarGroup}
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
                        className={`aspect-square min-h-[44px] sm:min-h-0 p-2 sm:p-3 rounded-xl border flex flex-col items-center justify-center transition-colors text-sm sm:text-base
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

            {/* ==================== СТАТИСТИКА ==================== */}
            {activeTab === 'stats' && (
              <div>
                <h2 className="text-2xl font-bold mb-6">
                  {t('common.stats')}
                </h2>

                <div className="flex bg-zinc-900 p-1 rounded-2xl w-fit mb-6 overflow-x-auto">
                  <button onClick={() => setSelectedStatsGroup('all')} className={`px-6 py-3 rounded-xl transition-colors ${selectedStatsGroup === 'all' ? 'bg-white text-black shadow' : 'text-zinc-400 hover:bg-zinc-800'}`}>
                    Alle
                  </button>
                  {userAccessibleGroups.map(group => (
                    <button
                      key={group}
                      onClick={() => setSelectedStatsGroup(group)}
                      className={`px-6 py-3 rounded-xl transition-colors ${selectedStatsGroup === group ? 'bg-white text-black shadow' : 'text-zinc-400 hover:bg-zinc-800'}`}>
                      {group}
                    </button>
                  ))}
                </div>

                {/* Вкладки месяцев */}
                {monthList.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto pb-2 mb-4 hide-scrollbar">
                    {monthList.map((monthKey) => {
                      const monthName = format(new Date(monthKey + '-01'), 'LLLL yyyy', { locale: de });
                      const monthTotal = groupedByMonth[monthKey].reduce((sum: number, s: any) => sum + (s.total_hours || 0), 0);
                      return (
                        <button
                          key={monthKey}
                          onClick={() => setSelectedStatMonth(monthKey)}
                          className={`px-4 py-2.5 sm:px-6 sm:py-3 rounded-2xl whitespace-nowrap transition-all text-xs sm:text-sm font-medium border flex-shrink-0 active:scale-[0.985] ${
                            selectedStatMonth === monthKey ? 'bg-zinc-100 text-zinc-950 border-zinc-100' : 'border-zinc-700 hover:bg-zinc-800 text-zinc-400 active:bg-zinc-700'}`}>
                          {monthName}
                          <span className="ml-2 text-xs opacity-70">({monthTotal} h)</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Общая сумма + кнопки скачивания */}
                {selectedStatMonth && (
                  <div className="bg-zinc-800 border border-zinc-700 rounded-2xl p-5 flex justify-between items-center mb-6">
                    <div>
                      <p className="text-zinc-400">
                        {selectedStatsGroup === 'all' ? 'Alle' : selectedStatsGroup} •
                        {format(new Date(selectedStatMonth + '-01'), 'LLLL yyyy', { locale: de })}
                      </p>
                      <p className="text-4xl font-bold text-emerald-400">
                        {filteredShifts.reduce((sum: number, s: any) => sum + (s.total_hours || 0), 0)} Stunden
                      </p>
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={downloadExcel}
                        className="bg-emerald-600 hover:bg-emerald-500 px-6 py-3 rounded-xl flex items-center gap-2 font-medium transition-colors">
                        <Download size={18} /> {t('common.downloadExcel')}
                      </button>
                      <button
                        onClick={downloadPDF}
                        className="bg-rose-600 hover:bg-rose-500 px-6 py-3 rounded-xl flex items-center gap-2 font-medium text-white transition-colors">
                        <FileDown size={18} /> {t('common.downloadPDF')}
                      </button>
                    </div>
                  </div>
                )}

                {/* Таблица */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-x-auto">
                  <table className="w-full min-w-[800px]">
                    <thead>
                      <tr className="bg-zinc-800">
                        <th className="text-left p-4">Datum</th>
                        <th className="text-left p-4">Von</th>
                        <th className="text-left p-4">Bis</th>
                        <th className="text-right p-4">Tag</th>
                        <th className="text-right p-4">Nacht</th>
                        <th className="text-right p-4">So</th>
                        <th className="text-right p-4">Feiertag</th>
                        <th className="text-right p-4">Gesamt</th>
                        <th className="w-16 text-center">Aktion</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredShifts
                        .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
                        .map((shift: any) => (
                          <tr key={shift.id} className="border-t border-zinc-700 hover:bg-zinc-800">
                            <td className="p-4">{format(new Date(shift.date), 'dd.MM.yyyy')}</td>
                            <td className="p-4">{shift.start_time?.slice(0,5)}</td>
                            <td className="p-4">{shift.end_time?.slice(0,5)}</td>
                            <td className="p-4 text-right text-emerald-400">{shift.day_hours || 0}</td>
                            <td className="p-4 text-right text-violet-400">{shift.night_hours || 0}</td>
                            <td className="p-4 text-right text-amber-400">{shift.sunday_hours || 0}</td>
                            <td className="p-4 text-right text-orange-400">{shift.holiday_hours || 0}</td>
                            <td className="p-4 text-right font-bold">{shift.total_hours || 0}</td>
                            <td className="p-4 text-center">
                              <button onClick={() => handleDeleteShift(shift.id)} className="text-zinc-500 hover:text-red-400 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"><Trash2 size={15} /></button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <ShiftModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        selectedDate={selectedDate}
        group={selectedCalendarGroup}
        onSave={handleSaveShift}
      />
    </div>
  );
}
