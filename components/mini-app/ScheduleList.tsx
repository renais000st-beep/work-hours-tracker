'use client';

import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, CheckCircle2, Clock, CopyCheck } from 'lucide-react';
import { calculateHours } from '@/lib/hours';
import type { UserProfile, WorkShift, PlannedShift } from '@/types/mini-app';

export default function ScheduleList({ profile }: { profile: UserProfile }) {
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [planned, setPlanned] = useState<PlannedShift[]>([]);
  const [work, setWork] = useState<WorkShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [recording, setRecording] = useState<string | null>(null);
  const [copyingAll, setCopyingAll] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [pRes, wRes] = await Promise.all([
      fetch(`/api/mini-app/planned?month=${month}`, { headers: { 'x-profile-id': profile.profileId } }),
      fetch(`/api/mini-app/shifts?month=${month}`, { headers: { 'x-profile-id': profile.profileId } }),
    ]);
    const [pData, wData] = await Promise.all([pRes.json(), wRes.json()]);
    setPlanned(Array.isArray(pData) ? pData : []);
    setWork(Array.isArray(wData) ? wData : []);
    setLoading(false);
  }, [month, profile.profileId]);

  useEffect(() => { loadData(); }, [loadData]);

  const isRecorded = (shift: PlannedShift) =>
    work.some(w => w.date === shift.date && w.group === shift.group_name);

  const record = async (shift: PlannedShift) => {
    setRecording(shift.id);
    const hours = calculateHours(
      shift.start_time.slice(0, 5),
      shift.end_time.slice(0, 5),
      shift.date
    );
    await fetch('/api/mini-app/shifts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-profile-id': profile.profileId },
      body: JSON.stringify({
        date: shift.date,
        start_time: shift.start_time,
        end_time: shift.end_time,
        group: shift.group_name,
        ...hours,
      }),
    });
    setRecording(null);
    loadData();
  };

  const copyAllToWork = async () => {
    if (copyingAll) return;
    setCopyingAll(true);
    try {
      const res = await fetch('/api/mini-app/copy-planned', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-profile-id': profile.profileId },
        body: JSON.stringify({ month }),
      });
      const result = await res.json();
      if (res.ok) {
        await loadData();
      } else {
        console.error('copy-planned error:', result.error);
      }
    } finally {
      setCopyingAll(false);
    }
  };

  const changeMonth = (dir: 1 | -1) => {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m - 1 + dir, 1);
    setMonth(format(d, 'yyyy-MM'));
  };

  const monthLabel = format(new Date(`${month}-15`), 'LLLL yyyy', { locale: de });
  const unrecorded = planned.filter(s => !isRecorded(s)).length;

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

      {/* Summary */}
      {!loading && planned.length > 0 && (
        <>
          <div className="bg-zinc-900 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <div className="text-sm text-zinc-400">Плановых смен</div>
              <div className="text-2xl font-bold">{planned.length}</div>
            </div>
            {unrecorded > 0 ? (
              <div className="text-right">
                <div className="text-sm text-zinc-400">Не записано</div>
                <div className="text-2xl font-bold text-amber-400">{unrecorded}</div>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-emerald-400 text-sm font-medium">
                <CheckCircle2 size={18} /> Всё записано
              </div>
            )}
          </div>
          {unrecorded > 0 && (
            <button
              onClick={copyAllToWork}
              disabled={copyingAll}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600/90 hover:bg-emerald-600 active:bg-emerald-700 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
            >
              <CopyCheck size={15} />
              {copyingAll ? 'Kopiere...' : `Alle übernehmen (${unrecorded})`}
            </button>
          )}
        </>
      )}

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-emerald-500 border-t-transparent" />
        </div>
      ) : planned.length === 0 ? (
        <div className="text-center py-10 text-zinc-500 text-sm">Нет плановых смен</div>
      ) : (
        <div className="space-y-2">
          {planned.map(shift => {
            const done = isRecorded(shift);
            return (
              <div
                key={shift.id}
                className={`rounded-2xl p-4 flex items-center gap-3 ${
                  done
                    ? 'bg-emerald-900/20 border border-emerald-800/30'
                    : 'bg-zinc-900'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{shift.date}</div>
                  <div className="text-zinc-400 text-sm flex items-center gap-1 mt-0.5">
                    <Clock size={12} />
                    {shift.start_time?.slice(0, 5)} — {shift.end_time?.slice(0, 5)}
                    <span className="text-zinc-700">·</span>
                    <span className="text-zinc-500 truncate">{shift.group_name}</span>
                  </div>
                </div>
                {done ? (
                  <div className="flex items-center gap-1 text-emerald-500 shrink-0">
                    <CheckCircle2 size={16} />
                    <span className="text-xs">Записано</span>
                  </div>
                ) : (
                  <button
                    onClick={() => record(shift)}
                    disabled={recording === shift.id}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 rounded-xl text-sm font-medium disabled:opacity-50 transition-colors shrink-0"
                  >
                    {recording === shift.id ? '...' : 'Записать'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
