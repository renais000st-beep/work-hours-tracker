// app/schedule/ScheduleViewModal.tsx
'use client';

import { useTranslation } from '@/lib/i18n';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { X } from 'lucide-react';
import { useOnboarding } from '@/lib/onboarding/OnboardingContext';
import { OnboardingModalBanner } from '@/lib/onboarding/OnboardingModalBanner';

interface Shift {
  username?: string;
  startTime?: string;
  endTime?: string;
  start_time?: string;
  end_time?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: string;
  shifts: Shift[];
}

export default function ScheduleViewModal({ isOpen, onClose, selectedDate, shifts }: Props) {
  const { t } = useTranslation();
  const { step, advance } = useOnboarding();

  const handleClose = () => {
    if (step === 'schedule-modal') advance();
    onClose();
  };

  if (!isOpen) return null;

  const sortedShifts = [...shifts].sort((a, b) => {
    const timeA = a.startTime || a.start_time || '00:00';
    const timeB = b.startTime || b.start_time || '00:00';
    return timeA.localeCompare(timeB);
  });

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 rounded-3xl w-full max-w-lg mx-auto overflow-hidden">
        
        <div className="px-6 py-5 border-b border-zinc-700 flex items-center justify-between bg-zinc-950">
          <h2 className="text-xl font-semibold">
            {t('schedule.Shifton')} {format(new Date(selectedDate), 'dd.MM.yyyy', { locale: de })}
          </h2>
          <button onClick={handleClose} className="p-2 hover:bg-zinc-800 rounded-2xl">
            <X size={28} />
          </button>
        </div>

        {step === 'schedule-modal' && (
          <OnboardingModalBanner message={t('onboarding.step14.desc')} />
        )}

        <div className="p-6 max-h-[60vh] overflow-auto">
          {sortedShifts.length === 0 ? (
            <div className="text-center py-20 text-zinc-400 text-lg">
              {t('schedule.nodaywork')}
            </div>
          ) : (
            <div className="space-y-4">
              {sortedShifts.map((shift, i) => (
                <div key={i} className="bg-zinc-800 rounded-3xl p-5 flex justify-between items-center">
                  <div className="font-medium text-white text-lg">
                    {shift.username || t('schedule.unknownUser')}
                  </div>
                  <div className="font-mono text-emerald-400 text-xl">
                    {(shift.startTime || shift.start_time || '—')} — {(shift.endTime || shift.end_time || '—')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-zinc-700">
          <button
            onClick={handleClose}
            className="w-full py-5 text-white bg-zinc-800 hover:bg-zinc-700 rounded-3xl font-medium text-lg"
          >
            {t('schedule.close')}
          </button>
        </div>
      </div>
    </div>
  );
}