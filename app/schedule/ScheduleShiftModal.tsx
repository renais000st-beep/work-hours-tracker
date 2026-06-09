// app/schedule/ScheduleShiftModal.tsx
'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useTranslation } from '@/lib/i18n';
import { Trash2 } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: string;
  activeGroup: string;
  currentUserId: string | undefined;
  onShiftAdded: (newShift: any) => void;
  onShiftUpdated?: (updatedShift: any) => void;
  onShiftDeleted?: (shiftId: number) => void;
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
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('16:00');
  const [loading, setLoading] = useState(false);
  const [shiftsOnDate, setShiftsOnDate] = useState<any[]>([]);
  const [editingShiftId, setEditingShiftId] = useState<number | null>(null);

  const { t } = useTranslation();

  useEffect(() => {
    if (!activeGroup) return;

    if (activeGroup.toLowerCase().includes("ingo") || activeGroup.toLowerCase().includes("kuby")) {
      setStartTime('10:00');
      setEndTime('00:00');
    } else if (activeGroup.toLowerCase().includes("stefan") || activeGroup.toLowerCase().includes("kasjutin")) {
      setStartTime('07:00');
      setEndTime('20:00');
    }
  }, [activeGroup]);

  useEffect(() => {
    if (!isOpen || !activeGroup) return;

    const fetchGroupUsers = async () => {
      const { data: group } = await supabase
        .from('groups')
        .select('id')
        .eq('name', activeGroup)
        .single();

      if (!group) return;

      const { data: userGroupData } = await supabase
        .from('user_groups')
        .select('user_id')
        .eq('group_id', group.id);

      if (!userGroupData || userGroupData.length === 0) return;

      const userIds = userGroupData.map(item => item.user_id);

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', userIds)
        .order('username');

      setUsers(profiles || []);
    };

    fetchGroupUsers();
  }, [isOpen, activeGroup]);

  useEffect(() => {
    if (!isOpen || !selectedDate) return;

    const key = `workPlanShifts_${activeGroup}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      const allShifts = JSON.parse(saved);
      const filtered = allShifts
        .filter((s: any) => s.date === selectedDate)
        .sort((a: any, b: any) => (a.start_time || '').localeCompare(b.start_time || ''));
      setShiftsOnDate(filtered);
    }
  }, [isOpen, selectedDate, activeGroup]);

  const handleEditShift = (shift: any) => {
    setEditingShiftId(shift.id);
    setSelectedUserId(shift.user_id);
    setStartTime(shift.start_time || shift.startTime || '08:00');
    setEndTime(shift.end_time || shift.endTime || '16:00');
  };

  const handleDeleteShift = (shiftId: number) => {
    if (!confirm(t('schedule.deleteConfirm'))) return;

    const key = `workPlanShifts_${activeGroup}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      const allShifts = JSON.parse(saved).filter((s: any) => s.id !== shiftId);
      localStorage.setItem(key, JSON.stringify(allShifts));
      setShiftsOnDate(prev => prev.filter(s => s.id !== shiftId));
      if (onShiftDeleted) onShiftDeleted(shiftId);
    }
  };

  const handleSave = () => {
    if (!selectedUserId || !selectedDate) return;

    setLoading(true);

    const selectedUser = users.find(u => u.id === selectedUserId);
    const username = selectedUser ? selectedUser.username : t('schedule.unknownUser');

    const newShiftData = {
      id: editingShiftId || Date.now(),
      user_id: selectedUserId,
      username: username,
      date: selectedDate,
      start_time: startTime,
      end_time: endTime,
      group: activeGroup,
    };

    const key = `workPlanShifts_${activeGroup}`;
    const saved = localStorage.getItem(key);
    let allShifts = saved ? JSON.parse(saved) : [];

    if (editingShiftId) {
      allShifts = allShifts.map((s: any) => s.id === editingShiftId ? newShiftData : s);
      if (onShiftUpdated) onShiftUpdated(newShiftData);
    } else {
      allShifts.push(newShiftData);
      onShiftAdded(newShiftData);
    }

    localStorage.setItem(key, JSON.stringify(allShifts));
    setLoading(false);

    setEditingShiftId(null);
    setSelectedUserId('');
    setStartTime('08:00');
    setEndTime('16:00');
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg shadow-2xl overflow-hidden max-h-[95vh] flex flex-col animate-slide-up sm:animate-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Заголовок */}
        <div className="px-6 py-5 border-b border-zinc-800 text-center bg-zinc-950 flex-shrink-0">
          <h2 className="text-lg font-semibold tracking-tight">{t('schedule.selectUser')}</h2>
          <p className="text-zinc-500 text-sm mt-0.5">{selectedDate}</p>
        </div>

        {/* Существующие смены */}
        {shiftsOnDate.length > 0 && (
          <div className="px-6 py-4 border-b border-zinc-800 max-h-52 overflow-y-auto flex-shrink-0">
            <p className="text-xs text-zinc-500 mb-3">{t('schedule.alreadyPlanned')}</p>
            {shiftsOnDate.map((shift) => {
              const userName = shift.username || t('schedule.unknown');
              const isEditing = shift.id === editingShiftId;

              return (
                <div
                  key={shift.id}
                  onClick={() => handleEditShift(shift)}
                  className={`flex justify-between items-center bg-zinc-800 rounded-xl px-4 py-3 mb-2 text-sm cursor-pointer hover:bg-zinc-700 transition-colors ${isEditing ? 'ring-1 ring-emerald-500' : ''}`}
                >
                  <span className="font-medium">{userName}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-emerald-400 font-mono text-sm">
                      {shift.start_time || shift.startTime} — {shift.end_time || shift.endTime}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteShift(shift.id); }}
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

        {/* Форма */}
        <div className="p-6 space-y-5 flex-1 overflow-auto">
          <div>
            <label className="block text-sm text-zinc-500 mb-2">{t('schedule.selectUser')}</label>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-zinc-500 transition-colors"
            >
              <option value="">— {t('schedule.selectUser')} —</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.username}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-zinc-500 mb-2">{t('schedule.from')}</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-4 text-white text-lg focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-zinc-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-500 mb-2">{t('schedule.to')}</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-4 text-white text-lg focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-zinc-500 transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Кнопки */}
        <div className="flex border-t border-zinc-800 flex-shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-5 sm:py-4 text-zinc-400 hover:bg-zinc-800 font-medium transition-colors"
          >
            {t('common.cancel')}
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
      </div>
    </div>
  );
}