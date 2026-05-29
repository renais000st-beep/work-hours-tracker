// app/admin/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { LogOut, ArrowLeft, X, Download, Menu } from 'lucide-react';
import * as XLSX from 'xlsx';
import { isSunday } from 'date-fns';

const germanHolidays = [
  '2025-01-01','2025-04-18','2025-04-21','2025-05-01','2025-05-29','2025-06-09','2025-10-03','2025-12-25','2025-12-26',
  '2026-01-01','2026-04-03','2026-04-06','2026-05-01','2026-05-14','2026-05-25','2026-10-03','2026-12-25','2026-12-26',
];

export default function AdminPanel() {
  const [usersWithMonths, setUsersWithMonths] = useState<any[]>([]);
  const [selectedUserMonth, setSelectedUserMonth] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    loadAdminData();
  }, []);

  const loadAdminData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.push('/login');

      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single();

      if (!profile?.is_admin) {
        alert('Zugriff verweigert');
        return router.push('/dashboard');
      }

      const { data: shiftsData } = await supabase
        .from('work_shifts')
        .select('*')
        .order('date', { ascending: false });

      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, username, email');

      const shifts = shiftsData || [];
      const profiles = profilesData || [];
      const profileMap = new Map(profiles.map((p: any) => [p.id, p]));

      const grouped = shifts.reduce((acc: any, shift: any) => {
        const userId = shift.user_id;
        const profile = profileMap.get(userId) || {};
        const displayName = profile.username || profile.email || userId;

        const monthKey = format(new Date(shift.date), 'yyyy-MM');
        const monthName = format(new Date(shift.date), 'LLLL yyyy', { locale: de });

        if (!acc[userId]) {
          acc[userId] = { displayName, months: {} };
        }

        if (!acc[userId].months[monthKey]) {
          acc[userId].months[monthKey] = { key: monthKey, name: monthName, shifts: [] };
        }

        acc[userId].months[monthKey].shifts.push(shift);
        return acc;
      }, {});

      const result = Object.values(grouped).map((u: any) => ({
        displayName: u.displayName,
        months: Object.values(u.months)
      }));

      setUsersWithMonths(result);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const downloadExcel = (userDisplayName: string, monthData: any) => {
    const sortedShifts = monthData.shifts.sort((a: any, b: any) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const rows = sortedShifts.map((shift: any) => {
      const date = new Date(shift.date);
      const isHoliday = germanHolidays.includes(format(date, 'yyyy-MM-dd'));
      const isSun = isSunday(date);

      return [
        format(date, 'dd/MM'),
        shift.start_time?.slice(0, 5) || '',
        shift.end_time?.slice(0, 5) || '',
        shift.day_hours || 0,
        shift.night_hours || 0,
        isSun ? shift.total_hours : 0,
        isHoliday ? shift.total_hours : 0,
        '',
        '',
      ];
    });

    const totalDay = rows.reduce((sum: number, r: any) => sum + (r[3] || 0), 0);
    const totalNight = rows.reduce((sum: number, r: any) => sum + (r[4] || 0), 0);
    const totalHours = totalDay + totalNight;

    rows.push(['Summe', '', '', totalDay, totalNight, 0, 0, '', '']);

    const worksheetData = [
      ['Sozialbär GmbH i.Gr.'],
      ['Mozartstraße 4 – 56288 Kastellaun Email: sozialbaer@web.de Amtsgericht Bad Kreuznach HBR 25057'],
      [],
      ['Mitarbeiter', '', '', '', 'Monat/Jahr'],
      [userDisplayName, '', '', '', monthData.name],
      [],
      ['Zeit', 'Zeit von', 'bis', 'Q4', 'Nacht*', 'So. 25%', 'Feiertag (35%)', 'Urlaub', 'Krankheit'],
      ...rows,
      [],
      ['Insgesamt', '', '', totalHours, '', '', '', 'Insgesamt', '']
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Tabelle1');
    XLSX.writeFile(workbook, `StundenZettel_${userDisplayName}_${monthData.name}.xlsx`);
  };

  if (loading) {
    return <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">Lade Admin-Panel...</div>;
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* MOBILE TOP BAR */}
      <div className="lg:hidden bg-zinc-900 border-b border-zinc-800 px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <button onClick={() => router.push('/dashboard')} className="flex items-center gap-2 text-zinc-400">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold">Admin-Panel</h1>
        <button onClick={() => supabase.auth.signOut().then(() => router.push('/login'))}>
          <LogOut size={24} />
        </button>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 lg:py-8">
        {/* Desktop Header */}
        <div className="hidden lg:flex justify-between items-center mb-10">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => router.push('/dashboard')} 
              className="flex items-center gap-2 text-zinc-400 hover:text-white"
            >
              <ArrowLeft size={24} /> Zurück
            </button>
            <h1 className="text-4xl font-bold">Admin-Panel</h1>
          </div>
          <button onClick={() => supabase.auth.signOut().then(() => router.push('/login'))}>
            <LogOut size={28} />
          </button>
        </div>

        {usersWithMonths.length === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-12 text-center text-zinc-500">
            Noch keine Schichten vorhanden
          </div>
        ) : (
          <div className="space-y-8">
            {usersWithMonths.map((user, index) => (
              <div key={index} className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
                <h2 className="text-2xl font-semibold mb-6 break-words">{user.displayName}</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {user.months.map((month: any) => (
                    <button
                      key={month.key}
                      onClick={() => setSelectedUserMonth({ user, month })}
                      className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-2xl p-6 text-left transition"
                    >
                      <div className="text-lg font-medium capitalize">{month.name}</div>
                      <div className="text-sm text-zinc-400 mt-2">
                        {month.shifts.length} Schichten • {month.shifts.reduce((sum: number, s: any) => sum + (s.total_hours || 0), 0).toFixed(1)} h
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Детальный модал */}
      {selectedUserMonth && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-3xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden">
            <div className="px-6 sm:px-8 py-5 border-b flex justify-between items-center bg-zinc-950">
              <h3 className="text-xl sm:text-2xl font-semibold break-words">
                {selectedUserMonth.user.displayName} — {selectedUserMonth.month.name}
              </h3>
              <div className="flex gap-3">
                <button
                  onClick={() => downloadExcel(selectedUserMonth.user.displayName, selectedUserMonth.month)}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 px-5 py-3 rounded-2xl font-medium transition text-sm sm:text-base"
                >
                  <Download size={20} />
                  Excel
                </button>
                <button 
                  onClick={() => setSelectedUserMonth(null)} 
                  className="text-zinc-400 hover:text-white p-2"
                >
                  <X size={28} />
                </button>
              </div>
            </div>

            {/* Здесь можно добавить таблицу смен в будущем, если нужно */}
            <div className="flex-1 p-6 overflow-auto text-zinc-400 text-center">
              Пока таблица смен в модале не реализована.<br />
              (Можно добавить позже)
            </div>
          </div>
        </div>
      )}
    </div>
  );
}