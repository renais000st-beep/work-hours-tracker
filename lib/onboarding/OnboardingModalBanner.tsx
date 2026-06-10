'use client';

import { Info } from 'lucide-react';

interface Props {
  message: string;
}

export function OnboardingModalBanner({ message }: Props) {
  return (
    <div className="flex items-start gap-3 mx-6 mt-4 p-3 bg-emerald-900/30 border border-emerald-600/40 rounded-xl">
      <Info size={15} className="text-emerald-400 mt-0.5 flex-shrink-0" />
      <p className="text-emerald-300 text-sm leading-relaxed">{message}</p>
    </div>
  );
}
