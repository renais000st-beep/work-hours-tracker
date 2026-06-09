'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { ArrowLeft, Download, Trash2, Users, Calendar, UserPlus} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useTranslation } from '@/lib/i18n';

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

  const [allGroups, setAllGroups] = useState<any[]>([]); // все группы из базы

  const router = useRouter();
  const { t } = useTranslation();

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
        alert(t('admin.noAllert'));
        return router.push('/dashboard');
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
      alert(t('admin.Alert.writeEmail'));
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

      alert(`✅ ${t('admin.Alert.User')} ${newUser.email} ${t('admin.Alert.success')}`);

      setShowAddUserModal(false);
      setNewUser({ email: '', password: '', groups: [], role: 'viewer' });
      loadAdminData();

      // Принудительно обновляем страницу, чтобы гарантированно остаться в админке
      setTimeout(() => {
        window.location.reload();
      }, 300);

    } catch (err: any) {
      alert(t('admin.Alert.Error') + (err.message || err));
    } finally {
      setCreating(false);
    }
  };
    const createNewGroup = async () => {
    if (!newGroupName.trim()) {
      alert(t('admin.Alert.nameGroup'));
      return;
    }

    setCreatingGroup(true);
    try {
      const { error } = await supabase
        .from('groups')
        .insert({ name: newGroupName.trim() });

      if (error) throw error;

      alert(`✅ ${t('admin.Alert.group')} "${newGroupName}" ${t('admin.Alert.success')}`);
      setShowNewGroupModal(false);
      setNewGroupName('');
      loadAdminData(); // обновляем данные

    } catch (err: any) {
      alert(t('admin.Alert.Error') + err.message);
    } finally {
      setCreatingGroup(false);
    }
  };

    // Удаление пользователя
  const deleteUser = async (userId: string) => {
    if (!confirm(t('admin.Alert.confirmdeleteUser'))) return;

    const { error } = await supabase.from('profiles').delete().eq('id', userId);
    if (error) alert(t('admin.Alert.errordelete') + error.message);
    else loadAdminData();
  };

  // Обновление роли
  const updateUserRole = async (userId: string, newRole: 'viewer' | 'editor') => {
    const { error } = await supabase
      .from('user_groups')
      .update({ role: newRole })
      .eq('user_id', userId);

    if (error) alert(t('admin.Alert.NewRoleError') + error.message);
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
          alert(t('admin.Alert.groupNotFound'));
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
      alert(t('admin.Alert.errordeleteGroup') + err.message);
    }
  };

    const handleDeleteShift = async (id: number) => {
    if (!confirm(t('admin.Alert.confirmdelete'))) return;

    const { error } = await supabase
      .from('work_shifts')
      .delete()
      .eq('id', id);

    if (error) {
      alert(t('admin.Alert.errordelete'));
    } else {
      alert(t('admin.Alert.shiftdeleted'));
      loadAdminData(); // обновляем таблицу
    }
  };

  if (loading) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-white">{t('admin.loadAdminData')}</div>;

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <div className="border-b border-zinc-700 bg-zinc-900 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <button onClick={() => router.push('/dashboard')} className="flex items-center gap-2 text-zinc-400 hover:text-white">
            ← {t('admin.backtoDashboard')}
          </button>
          <h1 className="text-3xl font-bold">🔧 {t('admin.title')}</h1>
          <button onClick={() => supabase.auth.signOut().then(() => router.push('/login'))} className="text-zinc-400 hover:text-white">
            {t('admin.logout')}
          </button>
        </div>

                {/* Фильтры */}
        <div className="max-w-7xl mx-auto px-6 pb-4 flex flex-wrap gap-4">
          
          {/* 1. Группа — теперь динамическая */}
          <select 
            value={activeGroupFilter} 
            onChange={(e) => setActiveGroupFilter(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 text-white px-4 py-2 rounded-xl"
          >
            <option value="all">{t('admin.allGroups') || t('admin.allGroups')}</option>
            {allGroups.map((group) => (
              <option key={group.id} value={group.name}>
                {group.name}
              </option>
            ))}
          </select>

          {/* 2. Месяц — динамический */}
          <select 
            value={selectedMonth} 
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 text-white px-4 py-2 rounded-xl"
          >
            <option value="all">{t('admin.allMonths') || t('admin.allMonths')}</option>
            
            {monthList.map((monthKey) => {
              const monthName = format(new Date(monthKey + '-01'), 'LLLL yyyy', { locale: de });
              return (
                <option key={monthKey} value={monthKey}>
                  {monthName}
                </option>
              );
            })}
          </select>

          {/* 3. Пользователь */}
          <select 
            value={selectedUserId} 
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 text-white px-4 py-2 rounded-xl flex-1 min-w-[200px]"
          >
            <option value="all">{t('admin.allUsers')}</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>
                {u.username || u.email}
              </option>
            ))}
          </select>

          <button onClick={downloadExcel} className="bg-emerald-600 hover:bg-emerald-500 px-5 py-2 rounded-xl flex items-center gap-2">
            <Download size={20} /> {t('admin.downloadExcel')}
          </button>

          <button onClick={downloadPDF} className="bg-rose-600 hover:bg-rose-500 px-5 py-2 rounded-xl flex items-center gap-2 text-white">
            📄 {t('admin.downloadPDF')}
          </button>

           <button 
            onClick={() => setShowEditUsersModal(true)}
            className="bg-zinc-700 hover:bg-zinc-600 px-5 py-2 rounded-xl flex items-center gap-2 text-white">
            ✏️ {t('admin.editUsers')}
          </button>

          <button 
            onClick={() => setShowAddUserModal(true)}
            className="bg-emerald-600 hover:bg-emerald-500 px-5 py-2 rounded-xl flex items-center gap-2">
            <UserPlus size={20} /> {t('admin.newUser')}
          </button>

          <button 
            onClick={() => setShowNewGroupModal(true)}
            className="bg-violet-600 hover:bg-violet-500 px-5 py-2 rounded-xl flex items-center gap-2">
            <Users size={20} /> {t('admin.newGroup')}
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <h2 className="text-xl mb-4">{t('admin.shifts')} • {filteredShifts.length} {t('admin.records')}</h2>

        <div className="bg-zinc-900 border border-zinc-700 rounded-3xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-zinc-800">
                <th className="p-4 text-left">{t('admin.table.User')}</th>
                <th className="p-4 text-left">{t('admin.table.date')}</th>
                <th className="p-4 text-left">{t('admin.table.time')}</th>
                <th className="p-4 text-right">{t('admin.table.total')}</th>
                <th className="p-4 text-center">{t('admin.table.actions')}</th>
              </tr>
            </thead>
                                        <tbody>
                      {[...filteredShifts]
                        .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
                        .map((shift: any) => (
                          <tr key={shift.id} className="border-t border-zinc-700 hover:bg-zinc-800">
                            <td className="p-4 font-medium">
                              {users.find(u => u.id === shift.user_id)?.username || t('admin.unknown')}
                            </td>
                            <td className="p-4">{format(new Date(shift.date), 'dd.MM.yyyy')}</td>
                            <td className="p-4">{shift.start_time?.slice(0,5) || '-'} — {shift.end_time?.slice(0,5) || '-'}</td>
                            <td className="p-4 text-right font-bold text-emerald-400">{shift.total_hours || 0} ч</td>
                            <td className="p-4 text-center">
  <button 
    onClick={() => handleDeleteShift(shift.id)}
    className="text-red-500 hover:text-red-600 font-medium">
    {t('admin.delete')}
  </button>
</td>
                          </tr>
                        ))}
                    </tbody>
          </table>
        </div>
      </div>

            {/* ==================== МОДАЛ НОВОГО ПОЛЬЗОВАТЕЛЯ ==================== */}
      {showAddUserModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-3xl w-full max-w-md">
            <div className="p-6 border-b flex justify-between">
              <h2 className="text-xl font-bold">➕ {t('admin.newUserModal.title')}</h2>
              <button onClick={() => setShowAddUserModal(false)} className="text-3xl">✕</button>
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
                className="w-full bg-emerald-600 hover:bg-emerald-500 py-3 rounded-xl font-medium">
                {creating ? t('admin.loading') : "✅ " + t('admin.createNewUser')}
              </button>
            </div>
          </div>
        </div>
      )}
            {/* ==================== МОДАЛ СОЗДАНИЯ НОВОЙ ГРУППЫ ==================== */}
      {showNewGroupModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-700 rounded-3xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4">{t('admin.newGroupModal.addNewGroup')}</h2>
            
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
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 py-3 rounded-xl font-medium">
                {creatingGroup ? t('admin.newGroupModal.loading') : "✅ " + t('admin.newGroupModal.addNewGroup')}
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
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-3xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b flex justify-between items-center">
              <h2 className="text-2xl font-bold">✏️ {t('admin.Modal.editUsers')}</h2>
              <button 
                onClick={() => setShowEditUsersModal(false)}
                className="text-3xl leading-none hover:text-zinc-400">✕</button>
            </div>

            <div className="p-6 overflow-auto flex-1">
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
                  {users.map((user: any) => {
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
                                  className="text-red-400 hover:text-red-500 text-xs font-bold"
                                >
                                  ✕
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
                            className="text-red-500 hover:text-red-600 px-4 py-1 font-medium">
                            {t('admin.delete')}
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