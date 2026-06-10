'use client';

import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import type { OnboardingContextType, OnboardingStepId } from './types';
import { ONBOARDING_STEPS } from './types';
import { supabase } from '@/lib/supabase';

const OnboardingContext = createContext<OnboardingContextType | null>(null);

function getNextStep(current: OnboardingStepId, groupCount: number): OnboardingStepId {
  const idx = ONBOARDING_STEPS.indexOf(current);
  if (idx === -1 || idx >= ONBOARDING_STEPS.length - 1) return 'complete';
  let nextIdx = idx + 1;
  let next = ONBOARDING_STEPS[nextIdx] as OnboardingStepId;
  // Skip stats-group if user has only one group
  if (next === 'stats-group' && groupCount <= 1) {
    nextIdx++;
    next = ONBOARDING_STEPS[nextIdx] as OnboardingStepId;
  }
  return next ?? 'complete';
}

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [step, setStep] = useState<OnboardingStepId>('idle');
  const groupCountRef = useRef(0);

  useEffect(() => {
    if (localStorage.getItem('onboarding_complete')) {
      setStep('complete');
      return;
    }
    const saved = localStorage.getItem('onboarding_step') as OnboardingStepId | null;
    if (saved && ONBOARDING_STEPS.includes(saved as OnboardingStepId)) {
      setStep(saved as OnboardingStepId);
    }
  }, []);

  const persistStep = useCallback((s: OnboardingStepId) => {
    if (s === 'complete') {
      localStorage.setItem('onboarding_complete', 'true');
      localStorage.removeItem('onboarding_step');
    } else {
      localStorage.setItem('onboarding_step', s);
    }
  }, []);

  const advance = useCallback(() => {
    setStep(prev => {
      const next = getNextStep(prev, groupCountRef.current);
      persistStep(next);
      return next;
    });
  }, [persistStep]);

  const skipAll = useCallback(() => {
    localStorage.setItem('onboarding_complete', 'true');
    localStorage.removeItem('onboarding_step');
    setStep('complete');
  }, []);

  const startOnboarding = useCallback(() => {
    if (localStorage.getItem('onboarding_complete')) return;
    setStep(prev => {
      if (prev !== 'idle') return prev;
      localStorage.setItem('onboarding_step', 'dashboard-banner');
      return 'dashboard-banner';
    });
  }, []);

  const setUserGroupCount = useCallback((count: number) => {
    groupCountRef.current = count;
  }, []);

  const handleTelegramLink = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const token = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      await supabase.from('telegram_link_tokens').insert({ profile_id: user.id, token, expires_at: expiresAt });
      window.open(`https://t.me/work_hours_sozialbaer_bot?start=verify_${token}`, '_blank');
    } catch {}
    skipAll();
  }, [skipAll]);

  return (
    <OnboardingContext.Provider value={{
      step,
      advance,
      skipAll,
      startOnboarding,
      setUserGroupCount,
      isActive: step !== 'idle' && step !== 'complete',
      handleTelegramLink,
    }}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used within OnboardingProvider');
  return ctx;
}
