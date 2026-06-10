'use client';

import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, Trash2, Clock, Pencil } from 'lucide-react';
import AddShiftSheet from './AddShiftSheet';
import type { UserProfile, WorkShift } from '@/types/mini-app';

export default function ShiftsList({ profile }: { profile: UserProfile }) {
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [selectedGroup, setSelectedGroup] = useState(profile.groups[0]?.name ?? '');
  const [shifts, setShifts] = useState<WorkShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSheet, setShowSheet] = useState(false);
  const [editingShift, setEditingShift] = useState<WorkShift | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const loadShifts = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/mini-app/shifts?month=${month}&group=${selectedGroup}`, {
      headers: { 'x-profile-id': profile.profileId },
    });
    const data = await res.json();
    setShifts(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [month, selectedGroup, profile.profileId]);

  useEffect(() => { loadShifts(); }, [loadShifts]);

  const totalHours = shifts.reduce((sum, s) => sum + (s.total_hours ?? 0), 0);

  const handleSave = async (shiftData: any) => {
    const method = shiftData.id ? 'PUT' : 'POST';
    await fetch('/api/mini-app/shifts', {
      method,
      headers: { 'Content-Type': 'application/json', 'x-profile-id': profile.profileId },
      body: JSON.stringify({ ...shiftData, group: selectedGroup }),
    });
    loadShifts();
  };

  const handleDelete = async (id: number) => {
    if (deletingId === id) {
      await fetch(`/api/mini-app/shifts?id=${id}`, {
        method: 'DELETE',
        headers: { 'x-profile-id': profile.profileId },
      });
      setDeletingId(null);
      loadShifts();
    } else {
      setDeletingId(id);
      setTimeout(() => setDeletingId(prev => (prev === id ? null : prev)), 3000);
    }
  };

  const changeMonth = (dir: 1 | -1) => {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m - 1 + dir, 1);
    setMonth(format(d, 'yyyy-MM'));
  };

  const monthLabel = format(new Date(`${month}-15`), 'LLLL yyyy', { locale: de });

  return (
    <div className="p-4 space-y-4">
      {/* Month nav */}
      <div className="flex items-center justify-between">
        <button onClick={() => changeMonth(-1)} className="p-2 rounded-xl bg-zinc-800/60 active:bg-zinc-700">
          <ChevronLeft size={18} />
        </button>
        <span className="text-base font-semibold capitalize">{monthLabel}</span>
        <button onClick={() => changeMonth(1)} className="p-2 rounded-xl bg-zinc-800/60 active:bg-zinc-700">
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Group tabs */}
      {profile.groups.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-0.5">
          {profile.groups.map(g => (
            <button
              key={g.id}
              onClick={() => setSelectedGroup(g.name)}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
                selectedGroup === g.name
                  ? 'bg-emerald-600 text-white'
                  : 'bg-zinc-800 text-zinc-400 active:bg-zinc-700'
              }`}
            >
              {g.name}
            </button>
          ))}
        </div>
      )}

      {/* Total */}
      <div className="bg-zinc-900 rounded-2xl p-5 text-center">
        <div className="text-5xl font-bold text-emerald-400 tabular-nums">
          {totalHours.toFixed(2)}
        </div>
        <div className="text-zinc-500 text-sm mt-1">часов за месяц</div>
      </div>

      {/* Shifts */}
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-emerald-500 border-t-transparent" />
        </div>
      ) : shifts.length === 0 ? (
        <div className="text-center py-10 text-zinc-500 text-sm">Нет смен за этот месяц</div>
      ) : (
        <div className="space-y-2">
          {shifts.map(shift => (
            <div key={shift.id} className="bg-zinc-900 rounded-2xl p-4 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-medium">{shift.date}</div>
                <div className="text-zinc-400 text-sm flex items-center gap-1 mt-0.5">
                  <Clock size={12} />
                  {shift.start_time?.slice(0, 5)} — {shift.end_time?.slice(0, 5)}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-emerald-400 font-semibold tabular-nums">{shift.total_hours}ч</div>
                {shift.night_hours > 0 && (
                  <div className="text-zinc-500 text-xs tabular-nums">{shift.night_hours}н</div>
                )}
                {shift.sunday_hours > 0 && <div className="text-amber-400 text-xs">So</div>}
              </div>
              <button
                onClick={() => { setEditingShift(shift); setShowSheet(true); }}
                className="p-2 rounded-xl bg-zinc-800 text-zinc-500 active:bg-zinc-700 shrink-0"
              >
                <Pencil size={15} />
              </button>
              <button
                onClick={() => handleDelete(shift.id)}
                className={`p-2 rounded-xl shrink-0 transition-colors ${
                  deletingId === shift.id
                    ? 'bg-red-500/20 text-red-400'
                    : 'bg-zinc-800 text-zinc-500 active:bg-zinc-700'
                }`}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => { setEditingShift(null); setShowSheet(true); }}
        className="fixed bottom-20 right-4 w-14 h-14 bg-emerald-600 rounded-full flex items-center justify-center shadow-lg active:bg-emerald-700 z-10"
        aria-label="Добавить смену"
      >
        <Plus size={24} />
      </button>

      {showSheet && (
        <AddShiftSheet
          profile={profile}
          group={selectedGroup}
          existingShift={editingShift}
          onSave={handleSave}
          onClose={() => { setShowSheet(false); setEditingShift(null); }}
        />
      )}
    </div>
  );
}
