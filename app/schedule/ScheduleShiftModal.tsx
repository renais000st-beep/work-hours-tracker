'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useTranslation } from '@/lib/i18n';
import { Trash2, PenLine, ChevronLeft } from 'lucide-react';
import { useToast } from '@/app/components/Toast';
import { GROUP_DEFAULT_TIMES, getGroupQuickConfig } from '@/lib/constants';
import { useOnboarding } from '@/lib/onboarding/OnboardingContext';
import { OnboardingModalBanner } from '@/lib/onboarding/OnboardingModalBanner';
import { format, addDays } from 'date-fns';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: string;
  activeGroup: string;
  currentUserId: string | undefined;
  onShiftAdded: (newShift: any) => void;
  onShiftUpdated?: (updatedShift: any) => void;
  onShiftDeleted?: (shiftId: string) => void;
}

export default function ScheduleShiftModal({
  isOpen,
  onClose,
  selectedDate,
  activeGroup,
  onShiftAdded,
  onShiftUpdated,
  onShiftDeleted,
}: Props) {
  const [mode, setMode] = useState<'quick' | 'manual'>('quick');
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('16:00');
  const [loading, setLoading] = useState(false);
  const [loadingUserId, setLoadingUserId] = useState<string | null>(null);
  const [shiftsOnDate, setShiftsOnDate] = useState<any[]>([]);
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);

  const { t } = useTranslation();
  const { showToast } = useToast();
  const { step, advance } = useOnboarding();

  useEffect(() => {
    if (isOpen) {
      setMode('quick');
      setEditingShiftId(null);
      setSelectedUserId('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (!activeGroup) return;
    const key = Object.keys(GROUP_DEFAULT_TIMES).find(k => activeGroup.toLowerCase().includes(k));
    if (key) {
      setStartTime(GROUP_DEFAULT_TIMES[key].start);
      setEndTime(GROUP_DEFAULT_TIMES[key].end);
    }
  }, [activeGroup]);

  useEffect(() => {
    if (!isOpen || !activeGroup) return;
    const fetchGroupUsers = async () => {
      const { data: group } = await supabase
        .from('groups').select('id').eq('name', activeGroup).single();
      if (!group) return;
      const { data: userGroupData } = await supabase
        .from('user_groups').select('user_id').eq('group_id', group.id);
      if (!userGroupData?.length) return;
      const userIds = userGroupData.map(item => item.user_id);
      const { data: profiles } = await supabase
        .from('profiles').select('id, username').in('id', userIds).order('username');
      setUsers(profiles || []);
    };
    fetchGroupUsers();
  }, [isOpen, activeGroup]);

  useEffect(() => {
    if (!isOpen || !selectedDate || !activeGroup) return;
    const loadShifts = async () => {
      const { data, error } = await supabase
        .from('planned_shifts').select('*')
        .eq('group_name', activeGroup).eq('date', selectedDate).order('start_time');
      if (!error) setShiftsOnDate(data || []);
    };
    loadShifts();
  }, [isOpen, selectedDate, activeGroup]);

  const quickConfig = getGroupQuickConfig(activeGroup);

  // A "primary" shift is one the user was explicitly selected for via quick-add.
  // A "tail" shift (00:00–10:00) is the overnight continuation — only for nextDayTail groups.
  const isPrimary = (s: any) => {
    if (quickConfig.nextDayTail) {
      return (s.start_time?.slice(0, 5) === '10:00' && s.end_time?.slice(0, 5) === '00:00') ||
             (s.start_time?.slice(0, 5) === '00:00' && s.end_time?.slice(0, 5) === '00:00');
    }
    return s.start_time?.slice(0, 5) === quickConfig.start &&
           s.end_time?.slice(0, 5) === quickConfig.end;
  };

  const isTail = (s: any) =>
    s.start_time?.slice(0, 5) === '00:00' && s.end_time?.slice(0, 5) === '10:00';

  const hasPrimaryShift = (userId: string) =>
    shiftsOnDate.some(s => s.user_id === userId && isPrimary(s));

  const getNextDay = () =>
    format(addDays(new Date(`${selectedDate}T00:00:00`), 1), 'yyyy-MM-dd');

  const handleQuickToggle = async (userId: string) => {
    if (loadingUserId) return;
    setLoadingUserId(userId);
    try {
      if (hasPrimaryShift(userId)) {
        await removeQuickShifts(userId);
      } else {
        await addQuickShifts(userId);
      }
    } catch {
      showToast(t('schedule.Alert.saveFailed'), 'error');
    } finally {
      setLoadingUserId(null);
    }
  };

  const addQuickShifts = async (userId: string) => {
    const username = users.find(u => u.id === userId)?.username || '';

    if (quickConfig.nextDayTail) {
      // Overnight style (e.g. Ingo Kuby): 10:00–00:00 + next-day 00:00–10:00, with merge if needed
      const nextDay = getNextDay();
      const tailOnThisDate = shiftsOnDate.find(s => s.user_id === userId && isTail(s));

      if (tailOnThisDate) {
        // Merge 00:00–10:00 + 10:00–00:00 → 00:00–00:00
        await supabase.from('planned_shifts').delete().eq('id', tailOnThisDate.id);
        onShiftDeleted?.(tailOnThisDate.id);
        const { data } = await supabase.from('planned_shifts').insert({
          user_id: userId, username, group_name: activeGroup,
          date: selectedDate, start_time: '00:00', end_time: '00:00',
        }).select().single();
        if (data) {
          onShiftAdded(data);
          setShiftsOnDate(prev => [...prev.filter(s => s.id !== tailOnThisDate.id), data]);
        }
      } else {
        const { data } = await supabase.from('planned_shifts').insert({
          user_id: userId, username, group_name: activeGroup,
          date: selectedDate, start_time: '10:00', end_time: '00:00',
        }).select().single();
        if (data) {
          onShiftAdded(data);
          setShiftsOnDate(prev => [...prev, data]);
        }
      }

      const { data: tailData } = await supabase.from('planned_shifts').insert({
        user_id: userId, username, group_name: activeGroup,
        date: nextDay, start_time: '00:00', end_time: '10:00',
      }).select().single();
      if (tailData) onShiftAdded(tailData);
    } else {
      // Single-day style (e.g. Stefan Kasjutin): configured start–end, no next-day record
      const { data } = await supabase.from('planned_shifts').insert({
        user_id: userId, username, group_name: activeGroup,
        date: selectedDate, start_time: quickConfig.start, end_time: quickConfig.end,
      }).select().single();
      if (data) {
        onShiftAdded(data);
        setShiftsOnDate(prev => [...prev, data]);
      }
    }
  };

  const removeQuickShifts = async (userId: string) => {
    const primaryShifts = shiftsOnDate.filter(s => s.user_id === userId && isPrimary(s));
    for (const shift of primaryShifts) {
      await supabase.from('planned_shifts').delete().eq('id', shift.id);
      onShiftDeleted?.(shift.id);
      setShiftsOnDate(prev => prev.filter(s => s.id !== shift.id));
    }

    if (quickConfig.nextDayTail) {
      // Remove the auto-created tail on next day (only for overnight-style groups)
      const nextDay = getNextDay();
      const { data: nextDayShifts } = await supabase.from('planned_shifts').select('*')
        .eq('user_id', userId).eq('group_name', activeGroup).eq('date', nextDay);
      const tails = (nextDayShifts || []).filter(isTail);
      for (const tail of tails) {
        await supabase.from('planned_shifts').delete().eq('id', tail.id);
        onShiftDeleted?.(tail.id);
      }
    }
  };

  const handleEditShift = (shift: any) => {
    setMode('manual');
    setEditingShiftId(shift.id);
    setSelectedUserId(shift.user_id);
    setStartTime(shift.start_time?.slice(0, 5) || '08:00');
    setEndTime(shift.end_time?.slice(0, 5) || '16:00');
  };

  const handleDeleteShift = async (shiftId: string) => {
    if (!confirm(t('schedule.deleteConfirm'))) return;
    const { error } = await supabase.from('planned_shifts').delete().eq('id', shiftId);
    if (!error) {
      setShiftsOnDate(prev => prev.filter(s => s.id !== shiftId));
      onShiftDeleted?.(shiftId);
    } else {
      showToast(t('schedule.Alert.deleteFailed'), 'error');
    }
  };

  const handleSave = async () => {
    if (!selectedUserId || !selectedDate) return;
    setLoading(true);
    const username = users.find(u => u.id === selectedUserId)?.username || t('schedule.unknownUser');
    const shiftData = {
      user_id: selectedUserId, username, group_name: activeGroup,
      date: selectedDate, start_time: startTime, end_time: endTime,
    };

    if (editingShiftId) {
      const { error } = await supabase.from('planned_shifts').update(shiftData).eq('id', editingShiftId);
      if (!error && onShiftUpdated) {
        onShiftUpdated({ id: editingShiftId, ...shiftData });
        setShiftsOnDate(prev => prev.map(s => s.id === editingShiftId ? { id: editingShiftId, ...shiftData } : s));
      } else if (error) {
        showToast(t('schedule.Alert.saveFailed'), 'error');
      }
    } else {
      const { data, error } = await supabase.from('planned_shifts').insert(shiftData).select().single();
      if (!error && data) {
        onShiftAdded(data);
        setShiftsOnDate(prev => [...prev, data]);
      } else if (error) {
        showToast(t('schedule.Alert.saveFailed'), 'error');
      }
    }

    setLoading(false);
    setEditingShiftId(null);
    setSelectedUserId('');
    setMode('quick');
  };

  const handleClose = () => {
    if (step === 'schedule-modal') advance();
    setMode('quick');
    setEditingShiftId(null);
    setSelectedUserId('');
    onClose();
  };

  if (!isOpen) return null;

  // In quick mode, only show non-auto shifts in the list (auto shifts are shown via buttons)
  const manualShifts = shiftsOnDate.filter(s => !isPrimary(s) && !isTail(s));

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 sm:p-4"
      onClick={handleClose}
    >
      <div
        className="bg-zinc-900 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg shadow-2xl overflow-hidden max-h-[95vh] flex flex-col animate-slide-up sm:animate-none"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-zinc-800 text-center bg-zinc-950 flex-shrink-0">
          <h2 className="text-lg font-semibold tracking-tight">{t('schedule.selectUser')}</h2>
          <p className="text-zinc-500 text-sm mt-0.5">{selectedDate}</p>
        </div>

        {step === 'schedule-modal' && (
          <OnboardingModalBanner message={t('onboarding.step14.desc')} />
        )}

        {mode === 'quick' ? (
          /* ── Quick mode ── */
          <div className="flex-1 overflow-auto">
            {manualShifts.length > 0 && (
              <div className="px-4 pt-4 pb-2">
                <p className="text-xs text-zinc-500 mb-2">{t('schedule.alreadyPlanned')}</p>
                {manualShifts.map(shift => (
                  <div
                    key={shift.id}
                    onClick={() => handleEditShift(shift)}
                    className="flex justify-between items-center bg-zinc-800 rounded-xl px-4 py-3 mb-2 text-sm cursor-pointer hover:bg-zinc-700 transition-colors"
                  >
                    <span className="font-medium">{shift.username || t('schedule.unknown')}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-emerald-400 font-mono text-sm">
                        {shift.start_time?.slice(0, 5)} — {shift.end_time?.slice(0, 5)}
                      </span>
                      <button
                        onClick={e => { e.stopPropagation(); handleDeleteShift(shift.id); }}
                        className="text-zinc-500 hover:text-red-400 transition-colors p-1"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="p-4 grid grid-cols-2 gap-2">
              {users.map(u => {
                const active = hasPrimaryShift(u.id);
                const busy = loadingUserId === u.id;
                return (
                  <button
                    key={u.id}
                    onClick={() => handleQuickToggle(u.id)}
                    disabled={!!loadingUserId}
                    className={`py-4 px-3 rounded-xl font-medium text-sm transition-all active:scale-95 disabled:opacity-60 ${
                      active
                        ? 'bg-emerald-600/25 border border-emerald-500/50 text-emerald-300'
                        : 'bg-zinc-800 border border-zinc-700 text-white hover:bg-zinc-700'
                    }`}
                  >
                    {busy ? '…' : active ? `✓ ${u.username}` : u.username}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setMode('manual')}
              className="mx-4 mb-4 w-[calc(100%-2rem)] flex items-center justify-center gap-2 py-2.5 text-zinc-500 hover:text-zinc-300 text-sm transition-colors border border-zinc-800 rounded-xl hover:border-zinc-600"
            >
              <PenLine size={14} />
              {t('schedule.enterManualTime')}
            </button>
          </div>
        ) : (
          /* ── Manual mode ── */
          <>
            {shiftsOnDate.length > 0 && (
              <div className="px-6 py-4 border-b border-zinc-800 max-h-52 overflow-y-auto flex-shrink-0">
                <p className="text-xs text-zinc-500 mb-3">{t('schedule.alreadyPlanned')}</p>
                {shiftsOnDate.map(shift => {
                  const isEditing = shift.id === editingShiftId;
                  return (
                    <div
                      key={shift.id}
                      onClick={() => handleEditShift(shift)}
                      className={`flex justify-between items-center bg-zinc-800 rounded-xl px-4 py-3 mb-2 text-sm cursor-pointer hover:bg-zinc-700 transition-colors ${isEditing ? 'ring-1 ring-emerald-500' : ''}`}
                    >
                      <span className="font-medium">{shift.username || t('schedule.unknown')}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-emerald-400 font-mono text-sm">
                          {(shift.start_time || '').slice(0, 5)} — {(shift.end_time || '').slice(0, 5)}
                        </span>
                        <button
                          onClick={e => { e.stopPropagation(); handleDeleteShift(shift.id); }}
                          className="text-zinc-500 hover:text-red-400 transition-colors p-1"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="p-6 space-y-5 flex-1 overflow-auto">
              <div>
                <label className="block text-sm text-zinc-500 mb-2">{t('schedule.selectUser')}</label>
                <select
                  value={selectedUserId}
                  onChange={e => setSelectedUserId(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-zinc-500 transition-colors"
                >
                  <option value="">— {t('schedule.selectUser')} —</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-zinc-500 mb-2">{t('schedule.from')}</label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={e => setStartTime(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-4 text-white text-lg focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-zinc-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm text-zinc-500 mb-2">{t('schedule.to')}</label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={e => setEndTime(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-4 text-white text-lg focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-zinc-500 transition-colors"
                  />
                </div>
              </div>
            </div>
          </>
        )}

        {/* Footer */}
        {mode === 'quick' ? (
          <div className="border-t border-zinc-800 flex-shrink-0">
            <button
              onClick={handleClose}
              className="w-full py-5 sm:py-4 text-zinc-400 hover:bg-zinc-800 font-medium transition-colors"
            >
              {t('schedule.close')}
            </button>
          </div>
        ) : (
          <div className="flex border-t border-zinc-800 flex-shrink-0">
            <button
              onClick={() => { setMode('quick'); setEditingShiftId(null); setSelectedUserId(''); }}
              className="flex items-center justify-center px-5 py-5 sm:py-4 text-zinc-400 hover:bg-zinc-800 transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={handleSave}
              disabled={loading || !selectedUserId}
              className="flex-1 py-5 sm:py-4 bg-emerald-600 hover:bg-emerald-500 font-medium disabled:opacity-50 transition-colors"
            >
              {loading
                ? t('schedule.saving')
                : editingShiftId
                  ? t('schedule.update')
                  : t('schedule.saveShift')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
