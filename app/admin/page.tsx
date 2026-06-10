'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { ArrowLeft, Download, Trash2, Users, UserPlus, FileDown, X, Pencil, Settings, ChevronUp, ChevronDown, Search, SlidersHorizontal } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useTranslation } from '@/lib/i18n';
import MobileNav from '@/app/components/MobileNav';
import { useToast } from '@/app/components/Toast';

export default function AdminPanel() {
  const [activeGroupFilter, setActiveGroupFilter] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedUserId, setSelectedUserId] = useState<string>('all');
  const [users, setUsers] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showEditUsersModal, setShowEditUsersModal] = useState(false);

    const [showAddUserModal, setShowAddUserModal] = useState(false);
    const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    groups: [] as string[],     // массив выбранных групп
    role: 'viewer' as 'editor' | 'viewer'
  });

  const [allGroups, setAllGroups] = useState<any[]>([]);
  const [confirmDeleteShiftId, setConfirmDeleteShiftId] = useState<number | null>(null);
  const [confirmDeleteUserId, setConfirmDeleteUserId] = useState<string | null>(null);
  const confirmShiftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confirmUserTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [sortField, setSortField] = useState<'date' | 'user' | 'total'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [userSearch, setUserSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const router = useRouter();
  const { t } = useTranslation();
  const { showToast } = useToast();

  useEffect(() => {
    loadAdminData();
  }, []);

       const loadAdminData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.push('/login');

      // Проверка админа
        const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single();

      if (!profile?.is_admin) {
        router.push('/dashboard');
        return;
      }

      // Загружаем пользователей
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, username, email')
        .order('username', { ascending: true });

      // Загружаем роли и группы пользователей
      const { data: userGroupsData } = await supabase
        .from('user_groups')
        .select(`
          user_id,
          role,
          groups (name)
        `);

      // Объединяем данные
      const usersWithRoles = (profilesData || []).map(user => {
        const userGroup = userGroupsData?.filter(ug => ug.user_id === user.id) || [];
        return {
          ...user,
          user_groups: userGroup
        };
      });

      // Загружаем группы и смены
      const { data: groupsData } = await supabase
        .from('groups')
        .select('*')
        .order('name');

      const { data: shiftsData } = await supabase
        .from('work_shifts')
        .select('*')
        .order('date', { ascending: false });

      setUsers(usersWithRoles);
      setAllGroups(groupsData || []);
      setShifts(shiftsData || []);

    } catch (err) {
      console.error("Ошибка loadAdminData:", err);
    } finally {
      setLoading(false);
    }
  };

    const filteredShifts = shifts.filter(s => {
    let ok = true;

    if (selectedUserId !== 'all') ok = ok && s.user_id === selectedUserId;
    if (selectedMonth !== 'all') ok = ok && s.date.startsWith(selectedMonth);

    // Фильтр по группе (теперь динамический)
    if (activeGroupFilter !== 'all') {
      ok = ok && s.group === activeGroupFilter;
    }

    return ok;
  });
    // Динамический список месяцев (только те, где есть записи)
  const monthList = [...new Set(
    shifts.map(s => s.date.substring(0, 7))   // берём "2026-05"
  )].sort().reverse();   // от нового к старому

     // ==================== EXCEL ====================
  const downloadExcel = () => {
    const isAllUsers = selectedUserId === 'all';

    const header = [
      ["Sozialbär GmbH i.Gr."],
      ["Mozartstraße 4 – 56288 Kastellaun"],
      [""],
      ["Mitarbeiter", "", "", "Monat/Jahr"],
      [isAllUsers ? "Alle Mitarbeiter" : (users.find(u => u.id === selectedUserId)?.username || "—"), "", "", selectedMonth === 'all' ? "2026" : selectedMonth],
      [""],
    ];

    if (isAllUsers) {
      header.push(["Mitarbeiter", "Zeit", "Zeit von", "bis", "Q4", "Nacht*", "So. 25%", "Feiertag (35%)", "Urlaub Std.", "Tage", "Krankheit", "Std."]);
    } else {
      header.push(["Zeit", "Zeit von", "bis", "Q4", "Nacht*", "So. 25%", "Feiertag (35%)", "Urlaub Std.", "Tage", "Krankheit", "Std."]);
    }

    const rows = filteredShifts.map(s => {
      const userName = users.find(u => u.id === s.user_id)?.username || '—';
      const baseRow = [
        format(new Date(s.date), 'dd/MM'),
        s.start_time?.slice(0,5) || '',
        s.end_time?.slice(0,5) || '',
        s.day_hours || 0,
        s.night_hours || 0,
        s.sunday_hours || 0,
        s.holiday_hours || 0,
        "", "", "", ""
      ];

      return isAllUsers ? [userName, ...baseRow] : baseRow;
    });

    const ws = XLSX.utils.aoa_to_sheet([...header, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "StundenZettel");

    const filename = `StundenZettel_Sozialbaer_${isAllUsers ? 'Alle' : 'Einzel'}_${selectedMonth}.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  // ==================== PDF ====================
  const downloadPDF = () => {
    const isAllUsers = selectedUserId === 'all';
    const win = window.open('', '_blank');
    if (!win) return;

    let html = `
      <style>
        body { font-family: Arial; margin: 20px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #333; padding: 6px; text-align: center; }
        th { background: #1e3a8a; color: white; }
        .header { text-align: center; margin-bottom: 15px; }
      </style>
      <div class="header">
        <h2>Sozialbär GmbH i.Gr. — StundenZettel</h2>
        <p>Mitarbeiter: <b>${isAllUsers ? 'Alle Mitarbeiter' : (users.find(u => u.id === selectedUserId)?.username || '—')}</b></p>
        <p>Monat: <b>${selectedMonth === 'all' ? '2026' : selectedMonth}</b></p>
      </div>
      <table>`;

    // Заголовок
    if (isAllUsers) {
      html += `<tr><th>Mitarbeiter</th><th>Zeit</th><th>von</th><th>bis</th><th>Q4</th><th>Nacht</th><th>So.25%</th><th>Feiertag</th><th>Urlaub</th><th>Tage</th><th>Krankheit</th><th>Std.</th></tr>`;
    } else {
      html += `<tr><th>Zeit</th><th>von</th><th>bis</th><th>Q4</th><th>Nacht</th><th>So.25%</th><th>Feiertag</th><th>Urlaub</th><th>Tage</th><th>Krankheit</th><th>Std.</th></tr>`;
    }

    // Строки
    filteredShifts.forEach(s => {
      const userName = users.find(u => u.id === s.user_id)?.username || '—';
      html += `<tr>`;
      if (isAllUsers) html += `<td>${userName}</td>`;
      html += `
        <td>${format(new Date(s.date), 'dd/MM')}</td>
        <td>${s.start_time?.slice(0,5) || ''}</td>
        <td>${s.end_time?.slice(0,5) || ''}</td>
        <td>${s.day_hours || 0}</td>
        <td>${s.night_hours || 0}</td>
        <td>${s.sunday_hours || 0}</td>
        <td>${s.holiday_hours || 0}</td>
        <td></td><td></td><td></td><td></td>
      </tr>`;
    });

    html += `</table>`;
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 500);
  };
        const createNewUser = async () => {
    if (!newUser.email || !newUser.password) {
      showToast(t('admin.Alert.writeEmail'), 'info');
      return;
    }

    setCreating(true);

    try {
      // 1. Сохраняем текущую сессию админа
      const { data: currentSession } = await supabase.auth.getSession();

      // 2. Создаём нового пользователя
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newUser.email,
        password: newUser.password,
      });

      if (authError) throw authError;

      const userId = authData.user?.id;
      if (!userId) throw new Error(t('admin.Alert.noUserConfirm'));

      // 3. Создаём профиль
      await supabase.from('profiles').insert({
        id: userId,
        email: newUser.email,
        is_admin: false,
      });

      // 4. Добавляем в группы
      const groupsToAdd = newUser.groups.length > 0 ? newUser.groups : ['Ingo Kuby'];
      for (const groupName of groupsToAdd) {
        const { data: group } = await supabase
          .from('groups')
          .select('id')
          .eq('name', groupName)
          .single();

        if (group) {
          await supabase.from('user_groups').insert({
            user_id: userId,
            group_id: group.id,
            role: newUser.role,
          });
        }
      }

      // 5. Возвращаемся обратно под аккаунт админа
      await supabase.auth.signOut();                    // выходим из нового пользователя
      if (currentSession.session) {
        await supabase.auth.setSession(currentSession.session); // возвращаем сессию админа
      }

      showToast(`${newUser.email} ${t('admin.Alert.success')}`, 'success');

      setShowAddUserModal(false);
      setNewUser({ email: '', password: '', groups: [], role: 'viewer' });
      loadAdminData();

    } catch (err: any) {
      showToast(t('admin.Alert.Error') + (err.message || err), 'error');
    } finally {
      setCreating(false);
    }
  };
    const createNewGroup = async () => {
    if (!newGroupName.trim()) {
      showToast(t('admin.Alert.nameGroup'), 'info');
      return;
    }

    setCreatingGroup(true);
    try {
      const { error } = await supabase
        .from('groups')
        .insert({ name: newGroupName.trim() });

      if (error) throw error;

      showToast(`${t('admin.Alert.group')} "${newGroupName}" ${t('admin.Alert.success')}`, 'success');
      setShowNewGroupModal(false);
      setNewGroupName('');
      loadAdminData();

    } catch (err: any) {
      showToast(t('admin.Alert.Error') + err.message, 'error');
    } finally {
      setCreatingGroup(false);
    }
  };

    // Удаление пользователя
  const deleteUser = async (userId: string) => {
    if (confirmDeleteUserId === userId) {
      if (confirmUserTimer.current) clearTimeout(confirmUserTimer.current);
      setConfirmDeleteUserId(null);
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/admin/delete-user', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) {
        const { error } = await res.json();
        showToast(t('admin.Alert.errordelete') + (error ?? ''), 'error');
      } else {
        showToast(t('admin.Alert.shiftdeleted'), 'success');
        loadAdminData();
      }
    } else {
      setConfirmDeleteUserId(userId);
      if (confirmUserTimer.current) clearTimeout(confirmUserTimer.current);
      confirmUserTimer.current = setTimeout(() => setConfirmDeleteUserId(null), 3000);
    }
  };

  // Обновление роли
  const updateUserRole = async (userId: string, newRole: 'viewer' | 'editor') => {
    const { error } = await supabase
      .from('user_groups')
      .update({ role: newRole })
      .eq('user_id', userId);

    if (error) showToast(t('admin.Alert.NewRoleError') + error.message, 'error');
    else loadAdminData();
  };

    // Обновление групп пользователя (добавление / удаление)
  const updateUserGroups = async (userId: string, groupName: string, action: 'add' | 'remove') => {
    try {
      if (action === 'add') {
        // Находим id группы
        const { data: group } = await supabase
          .from('groups')
          .select('id')
          .eq('name', groupName)
          .single();

        if (!group) {
          showToast(t('admin.Alert.groupNotFound'), 'error');
          return;
        }

        await supabase
          .from('user_groups')
          .insert({
            user_id: userId,
            group_id: group.id,
            role: 'viewer' // по умолчанию viewer, можно потом улучшить
          });
      } 
      else if (action === 'remove') {
        // Удаляем связь пользователя с группой
        const { data: group } = await supabase
          .from('groups')
          .select('id')
          .eq('name', groupName)
          .single();

        if (group) {
          await supabase
            .from('user_groups')
            .delete()
            .eq('user_id', userId)
            .eq('group_id', group.id);
        }
      }

      loadAdminData(); // обновляем данные
    } catch (err: any) {
      showToast(t('admin.Alert.errordeleteGroup') + err.message, 'error');
    }
  };

  const handleDeleteShift = async (id: number) => {
    if (confirmDeleteShiftId === id) {
      if (confirmShiftTimer.current) clearTimeout(confirmShiftTimer.current);
      setConfirmDeleteShiftId(null);
      const { error } = await supabase.from('work_shifts').delete().eq('id', id);
      if (error) showToast(t('admin.Alert.errordelete'), 'error');
      else { showToast(t('admin.Alert.shiftdeleted'), 'success'); loadAdminData(); }
    } else {
      setConfirmDeleteShiftId(id);
      if (confirmShiftTimer.current) clearTimeout(confirmShiftTimer.current);
      confirmShiftTimer.current = setTimeout(() => setConfirmDeleteShiftId(null), 3000);
    }
  };

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const SortIcon = ({ field }: { field: typeof sortField }) => {
    if (sortField !== field) return <ChevronUp className="size-3 opacity-30" />;
    return sortDir === 'asc' ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />;
  };

  const sortedShifts = [...filteredShifts].sort((a, b) => {
    const mul = sortDir === 'asc' ? 1 : -1;
    if (sortField === 'date') return mul * (new Date(a.date).getTime() - new Date(b.date).getTime());
    if (sortField === 'total') return mul * ((a.total_hours || 0) - (b.total_hours || 0));
    if (sortField === 'user') {
      const ua = users.find(u => u.id === a.user_id)?.username || '';
      const ub = users.find(u => u.id === b.user_id)?.username || '';
      return mul * ua.localeCompare(ub);
    }
    return 0;
  });

  const filteredUsers = users.filter(u =>
    !userSearch || (u.username || u.email || '').toLowerCase().includes(userSearch.toLowerCase())
  );

  if (loading) return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="border-b border-zinc-800 bg-zinc-900/90 px-6 py-4 flex justify-between items-center">
        <div className="w-32 h-8 bg-zinc-800 rounded-lg animate-pulse" />
        <div className="w-40 h-8 bg-zinc-800 rounded-lg animate-pulse" />
        <div className="w-20 h-8 bg-zinc-800 rounded-lg animate-pulse" />
      </div>
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-14 bg-zinc-900 border border-zinc-800 rounded-xl animate-pulse" style={{ animationDelay: `${i * 40}ms` }} />
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <div className="border-b border-zinc-800 bg-zinc-900/90 backdrop-blur-sm sticky top-0 z-50">

        {/* Title bar */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex justify-between items-center">
          <button onClick={() => router.push('/dashboard')} className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors min-h-[44px]">
            <ArrowLeft size={20} />
            <span className="hidden sm:inline text-sm">{t('admin.backtoDashboard')}</span>
          </button>

          <h1 className="text-lg sm:text-2xl font-bold tracking-tight flex items-center gap-2">
            <Settings size={18} className="sm:hidden" />
            <Settings size={22} className="hidden sm:block" />
            {t('admin.title')}
          </h1>

          <div className="flex items-center gap-2">
            {/* Mobile: filter toggle button */}
            <button
              onClick={() => setFiltersOpen(o => !o)}
              className="lg:hidden relative flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 active:scale-95 px-3 py-2 rounded-xl transition-all text-sm font-medium min-h-[44px]"
            >
              <SlidersHorizontal size={15} />
              <ChevronDown size={14} className={`transition-transform duration-200 ${filtersOpen ? 'rotate-180' : ''}`} />
              {(activeGroupFilter !== 'all' || selectedMonth !== 'all' || selectedUserId !== 'all') && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full" />
              )}
            </button>

            {/* Desktop: logout */}
            <button onClick={() => supabase.auth.signOut().then(() => router.push('/login'))} className="hidden lg:block text-zinc-400 hover:text-white text-sm transition-colors">
              {t('admin.logout')}
            </button>
          </div>
        </div>

        {/* Desktop filters — always visible */}
        <div className="hidden lg:flex flex-wrap gap-4 max-w-7xl mx-auto px-6 pb-4">
          <select value={activeGroupFilter} onChange={(e) => setActiveGroupFilter(e.target.value)} className="bg-zinc-800 border border-zinc-700 text-white px-4 py-2 rounded-xl">
            <option value="all">{t('admin.allGroups')}</option>
            {allGroups.map((group) => <option key={group.id} value={group.name}>{group.name}</option>)}
          </select>

          <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="bg-zinc-800 border border-zinc-700 text-white px-4 py-2 rounded-xl">
            <option value="all">{t('admin.allMonths')}</option>
            {monthList.map((monthKey) => {
              const monthName = format(new Date(monthKey + '-01'), 'LLLL yyyy', { locale: de });
              return <option key={monthKey} value={monthKey}>{monthName}</option>;
            })}
          </select>

          <select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)} className="bg-zinc-800 border border-zinc-700 text-white px-4 py-2 rounded-xl flex-1 min-w-[200px]">
            <option value="all">{t('admin.allUsers')}</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.username || u.email}</option>)}
          </select>

          <button onClick={downloadExcel} className="bg-emerald-600 hover:bg-emerald-500 px-5 py-2 rounded-xl flex items-center gap-2 transition-colors">
            <Download size={20} /> {t('admin.downloadExcel')}
          </button>
          <button onClick={downloadPDF} className="bg-rose-600 hover:bg-rose-500 px-5 py-2 rounded-xl flex items-center gap-2 text-white transition-colors">
            <FileDown size={18} /> {t('admin.downloadPDF')}
          </button>
          <button onClick={() => setShowEditUsersModal(true)} className="bg-zinc-700 hover:bg-zinc-600 px-5 py-2 rounded-xl flex items-center gap-2 text-white transition-colors">
            <Pencil size={16} /> {t('admin.editUsers')}
          </button>
          <button onClick={() => setShowAddUserModal(true)} className="bg-emerald-600 hover:bg-emerald-500 px-5 py-2 rounded-xl flex items-center gap-2 transition-colors">
            <UserPlus size={20} /> {t('admin.newUser')}
          </button>
          <button onClick={() => setShowNewGroupModal(true)} className="bg-violet-600 hover:bg-violet-500 px-5 py-2 rounded-xl flex items-center gap-2 transition-colors">
            <Users size={20} /> {t('admin.newGroup')}
          </button>
        </div>

        {/* Mobile filters — collapsible drawer */}
        <div className={`lg:hidden overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out ${filtersOpen ? 'max-h-[700px] opacity-100' : 'max-h-0 opacity-0'}`}>
          <div className="px-4 pb-5 pt-3 space-y-3 border-t border-zinc-800">

            {/* Selects: группа + месяц в ряд */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-500 mb-1.5 block">{t('admin.allGroups')}</label>
                <select value={activeGroupFilter} onChange={(e) => setActiveGroupFilter(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 text-white px-3 py-2.5 rounded-xl text-sm">
                  <option value="all">{t('admin.allGroups')}</option>
                  {allGroups.map((group) => <option key={group.id} value={group.name}>{group.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1.5 block">{t('admin.allMonths')}</label>
                <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 text-white px-3 py-2.5 rounded-xl text-sm">
                  <option value="all">{t('admin.allMonths')}</option>
                  {monthList.map((monthKey) => {
                    const monthName = format(new Date(monthKey + '-01'), 'LLLL yyyy', { locale: de });
                    return <option key={monthKey} value={monthKey}>{monthName}</option>;
                  })}
                </select>
              </div>
            </div>

            {/* Пользователь — полная ширина */}
            <div>
              <label className="text-xs text-zinc-500 mb-1.5 block">{t('admin.allUsers')}</label>
              <select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 text-white px-3 py-2.5 rounded-xl text-sm">
                <option value="all">{t('admin.allUsers')}</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.username || u.email}</option>)}
              </select>
            </div>

            {/* Action buttons 2×2 */}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={downloadExcel} className="bg-emerald-600 hover:bg-emerald-500 active:scale-95 py-3 rounded-xl flex items-center justify-center gap-2 text-sm font-medium transition-all">
                <Download size={16} /> {t('admin.downloadExcel')}
              </button>
              <button onClick={downloadPDF} className="bg-rose-600 hover:bg-rose-500 active:scale-95 py-3 rounded-xl flex items-center justify-center gap-2 text-sm font-medium text-white transition-all">
                <FileDown size={16} /> {t('admin.downloadPDF')}
              </button>
              <button onClick={() => { setShowEditUsersModal(true); setFiltersOpen(false); }} className="bg-zinc-700 hover:bg-zinc-600 active:scale-95 py-3 rounded-xl flex items-center justify-center gap-2 text-sm font-medium text-white transition-all">
                <Pencil size={16} /> {t('admin.editUsers')}
              </button>
              <button onClick={() => { setShowAddUserModal(true); setFiltersOpen(false); }} className="bg-emerald-600 hover:bg-emerald-500 active:scale-95 py-3 rounded-xl flex items-center justify-center gap-2 text-sm font-medium transition-all">
                <UserPlus size={16} /> {t('admin.newUser')}
              </button>
              <button onClick={() => { setShowNewGroupModal(true); setFiltersOpen(false); }} className="col-span-2 bg-violet-600 hover:bg-violet-500 active:scale-95 py-3 rounded-xl flex items-center justify-center gap-2 text-sm font-medium transition-all">
                <Users size={16} /> {t('admin.newGroup')}
              </button>
            </div>

            {/* Logout на мобилке */}
            <button onClick={() => supabase.auth.signOut().then(() => router.push('/login'))} className="w-full py-3 text-zinc-400 hover:text-white border border-zinc-700 rounded-xl text-sm transition-colors">
              {t('admin.logout')}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 pb-24 lg:pb-6">
        <h2 className="text-xl mb-4 font-semibold">{t('admin.shifts')} • <span className="text-zinc-400 font-normal">{filteredShifts.length} {t('admin.records')}</span></h2>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-zinc-800">
                <th
                  className="p-4 text-left cursor-pointer hover:bg-zinc-700 transition-colors select-none"
                  onClick={() => handleSort('user')}
                >
                  <span className="flex items-center gap-1">{t('admin.table.User')} <SortIcon field="user" /></span>
                </th>
                <th
                  className="p-4 text-left cursor-pointer hover:bg-zinc-700 transition-colors select-none"
                  onClick={() => handleSort('date')}
                >
                  <span className="flex items-center gap-1">{t('admin.table.date')} <SortIcon field="date" /></span>
                </th>
                <th className="p-4 text-left font-medium text-zinc-300">{t('admin.table.time')}</th>
                <th
                  className="p-4 text-right cursor-pointer hover:bg-zinc-700 transition-colors select-none"
                  onClick={() => handleSort('total')}
                >
                  <span className="flex items-center justify-end gap-1">{t('admin.table.total')} <SortIcon field="total" /></span>
                </th>
                <th className="p-4 text-center font-medium text-zinc-300">{t('admin.table.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {sortedShifts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-zinc-500">{t('admin.noShifts')}</td>
                </tr>
              ) : (
                sortedShifts.map((shift: any) => (
                  <tr key={shift.id} className="border-t border-zinc-800 hover:bg-zinc-800/50 transition-colors">
                    <td className="p-4 font-medium">{users.find(u => u.id === shift.user_id)?.username || t('admin.unknown')}</td>
                    <td className="p-4">{format(new Date(shift.date), 'dd.MM.yyyy')}</td>
                    <td className="p-4">{shift.start_time?.slice(0, 5) || '-'} — {shift.end_time?.slice(0, 5) || '-'}</td>
                    <td className="p-4 text-right font-bold text-emerald-400">{shift.total_hours || 0} ч</td>
                    <td className="p-4 text-center">
                      <button
                        onClick={() => handleDeleteShift(shift.id)}
                        className={`min-w-[44px] min-h-[44px] flex items-center justify-center mx-auto rounded-lg transition-all text-xs font-medium px-2 ${
                          confirmDeleteShiftId === shift.id
                            ? 'bg-red-600 text-white scale-105'
                            : 'text-zinc-500 hover:text-red-400'
                        }`}
                      >
                        {confirmDeleteShiftId === shift.id ? '?' : <Trash2 size={15} />}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <MobileNav isAdmin />

            {/* ==================== МОДАЛ НОВОГО ПОЛЬЗОВАТЕЛЯ ==================== */}
      {showAddUserModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 sm:p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md shadow-2xl animate-slide-up sm:animate-none">
            <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
              <h2 className="text-lg font-semibold tracking-tight">{t('admin.newUserModal.title')}</h2>
              <button onClick={() => setShowAddUserModal(false)} className="text-zinc-400 hover:text-white transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"><X size={20} /></button>
            </div>

            <div className="p-6 space-y-5">
              <input type="email" placeholder={t('admin.newUserModal.email')} className="w-full bg-zinc-800 border border-zinc-700 p-3 rounded-xl" 
                value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} />

              <input type="password" placeholder={t('admin.newUserModal.password')} className="w-full bg-zinc-800 border border-zinc-700 p-3 rounded-xl" 
                value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} />

              {/* Выбор роли — как было */}
              <select className="w-full bg-zinc-800 border border-zinc-700 p-3 rounded-xl" 
                value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value as any})}>
                <option value="viewer">Viewer — только просмотр</option>
                <option value="editor">Editor — может редактировать</option>
              </select>

              {/* Новый динамический выбор групп */}
              <div>
                <p className="mb-2 text-zinc-400">{t('admin.groups')} ({t('admin.choose')}):</p>
                <div className="grid grid-cols-2 gap-3">
                  {allGroups.map(group => (
                    <label key={group.id} className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox"
                        checked={newUser.groups.includes(group.name)}
                        onChange={() => {
                          let g = [...newUser.groups];
                          if (g.includes(group.name)) {
                            g = g.filter(name => name !== group.name);
                          } else {
                            g.push(group.name);
                          }
                          setNewUser({...newUser, groups: g});
                        }}
                      />
                      {group.name}
                    </label>
                  ))}
                </div>
                {allGroups.length === 0 && <p className="text-amber-400 text-sm">{t('admin.firstcreategroup')}</p>}
              </div>

              <button
                onClick={createNewUser}
                disabled={creating}
                className="w-full bg-emerald-600 hover:bg-emerald-500 py-3 rounded-xl font-medium transition-colors">
                {creating ? t('admin.loading') : t('admin.createNewUser')}
              </button>
            </div>
          </div>
        </div>
      )}
            {/* ==================== МОДАЛ СОЗДАНИЯ НОВОЙ ГРУППЫ ==================== */}
      {showNewGroupModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 sm:p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-6 shadow-2xl animate-slide-up sm:animate-none">
            <h2 className="text-lg font-semibold tracking-tight mb-4">{t('admin.newGroupModal.addNewGroup')}</h2>
            
            <input 
              type="text" 
              placeholder={t('admin.newGroupModal.GroupName')}
              className="w-full bg-zinc-800 border border-zinc-700 p-3 rounded-xl mb-4"
              value={newGroupName}
              onChange={e => setNewGroupName(e.target.value)}
            />

            <div className="flex gap-3">
              <button
                onClick={createNewGroup}
                disabled={creatingGroup}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 py-3 rounded-xl font-medium transition-colors">
                {creatingGroup ? t('admin.newGroupModal.loading') : t('admin.newGroupModal.addNewGroup')}
              </button>
              <button 
                onClick={() => {setShowNewGroupModal(false); setNewGroupName('');}}
                className="flex-1 py-3 border border-zinc-600 rounded-xl">
                {t('admin.newGroupModal.cancel')}
              </button>
            </div>

            <p className="text-xs text-zinc-500 mt-4 text-center">
            </p>
          </div>
        </div>
      )}
              {/* ==================== МОДАЛ РЕДАКТИРОВАНИЯ ПОЛЬЗОВАТЕЛЕЙ ==================== */}
      {showEditUsersModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
              <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2"><Pencil size={18} /> {t('admin.Modal.editUsers')}</h2>
              <button
                onClick={() => setShowEditUsersModal(false)}
                className="text-zinc-400 hover:text-white transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"><X size={20} /></button>
            </div>

            <div className="px-6 pt-4 pb-2">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Поиск..."
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-zinc-500 transition-colors"
                />
              </div>
            </div>

            <div className="px-6 pb-2 overflow-auto flex-1">
              <table className="w-full">
                <thead>
                  <tr className="bg-zinc-800">
                    <th className="p-4 text-left">{t('admin.Modal.User')}</th>
                    <th className="p-4">{t('admin.Modal.role')}</th>
                    <th className="p-4">{t('admin.Modal.Groups')}</th>
                    <th className="p-4 text-center w-28">{t('admin.Modal.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user: any) => {
                    const userGroups = user.user_groups || [];
                    const currentRole = userGroups.length > 0 ? userGroups[0].role : 'viewer';
                    const currentGroupNames = userGroups.map((ug: any) => ug.groups?.name).filter(Boolean);

                    return (
                      <tr key={user.id} className="border-t border-zinc-700">
                        <td className="p-4 font-medium">{user.username || '—'}</td>
                        
                        {/* Роль */}
                        <td className="p-4">
                          <select 
                            value={currentRole}
                            onChange={(e) => updateUserRole(user.id, e.target.value as 'viewer' | 'editor')}
                            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1 text-sm"
                          >
                            <option value="viewer">Viewer</option>
                            <option value="editor">Editor</option>
                          </select>
                        </td>

                        {/* Группы — с возможностью добавлять и удалять */}
                        <td className="p-4">
                          <div className="flex flex-wrap gap-2">
                            {currentGroupNames.map((groupName: string) => (
                              <div key={groupName} className="bg-zinc-800 text-white text-sm px-3 py-1 rounded-xl flex items-center gap-2">
                                {groupName}
                                <button
                                  onClick={() => updateUserGroups(user.id, groupName, 'remove')}
                                  className="text-zinc-500 hover:text-red-400 transition-colors"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            ))}
                          </div>

                          {/* Добавление новой группы */}
                          <select
                            className="mt-3 bg-zinc-800 border border-zinc-600 rounded-xl px-3 py-2 text-sm w-full"
                            onChange={(e) => {
                              if (e.target.value) {
                                updateUserGroups(user.id, e.target.value, 'add');
                                e.target.value = ''; // сбрасываем select
                              }
                            }}
                          >
                            <option value="">+ {t('admin.Modal.addGroup')}...</option>
                            {allGroups
                              .filter(g => !currentGroupNames.includes(g.name))
                              .map(group => (
                                <option key={group.id} value={group.name}>
                                  {group.name}
                                </option>
                              ))}
                          </select>
                        </td>

                        {/* Действия */}
                        <td className="p-4 text-center">
                          <button
                            onClick={() => deleteUser(user.id)}
                            className={`min-w-[44px] min-h-[44px] flex items-center justify-center mx-auto rounded-lg transition-all text-xs font-medium px-2 ${
                              confirmDeleteUserId === user.id
                                ? 'bg-red-600 text-white scale-105'
                                : 'text-zinc-500 hover:text-red-400'
                            }`}
                          >
                            {confirmDeleteUserId === user.id ? '?' : <Trash2 size={15} />}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="p-6 border-t flex justify-end">
              <button 
                onClick={() => setShowEditUsersModal(false)}
                className="px-8 py-3 bg-zinc-700 hover:bg-zinc-600 rounded-xl">
                {t('admin.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}