'use client';

import { useOnboarding } from './OnboardingContext';
import { OnboardingOverlay } from './OnboardingOverlay';
import { OnboardingTooltip } from './OnboardingTooltip';
import { useTranslation } from '@/lib/i18n';
import type { OnboardingStepId } from './types';

interface TooltipConfig {
  target: string;
  msgKey: string;
  mode: 'click' | 'button';
  skipIfMissing?: boolean;
}

const TOOLTIP_STEPS: Partial<Record<OnboardingStepId, TooltipConfig>> = {
  'calendar-tab':   { target: '[data-tour="calendar-tab"]',        msgKey: 'onboarding.step2.desc',  mode: 'click' },
  'date-click':     { target: '[data-tour="today-cell"]',           msgKey: 'onboarding.step3.desc',  mode: 'click' },
  'stats-tab':      { target: '[data-tour="dashboard-stats-tab"]',  msgKey: 'onboarding.step5.desc',  mode: 'click' },
  'stats-month':    { target: '[data-tour="stats-month-selector"]', msgKey: 'onboarding.step7.desc',  mode: 'button' },
  'stats-group':    { target: '[data-tour="stats-group-selector"]', msgKey: 'onboarding.step8.desc',  mode: 'button' },
  'stats-summary':  { target: '[data-tour="stats-summary-card"]',   msgKey: 'onboarding.step9.desc',  mode: 'button', skipIfMissing: true },
  'stats-table':    { target: '[data-tour="stats-shifts-table"]',   msgKey: 'onboarding.step10.desc', mode: 'button', skipIfMissing: true },
  'schedule-nav':   { target: '[data-tour="sidebar-schedule"]',     msgKey: 'onboarding.step11.desc', mode: 'click' },
  'schedule-date':  { target: '[data-tour="schedule-today-cell"]',  msgKey: 'onboarding.step13.desc', mode: 'click' },
  'schedule-notes': { target: '[data-tour="schedule-notes-area"]',  msgKey: 'onboarding.step15.desc', mode: 'button', skipIfMissing: true },
};

export function OnboardingRenderer() {
  const { step, advance, skipAll, handleTelegramLink } = useOnboarding();
  const { t } = useTranslation();

  if (step === 'idle' || step === 'complete') return null;

  // Full-screen overlay steps
  if (step === 'dashboard-banner') {
    return (
      <OnboardingOverlay
        title={t('onboarding.step1.title')}
        desc={t('onboarding.step1.desc')}
        onNext={advance}
        onSkip={skipAll}
        t={t}
      />
    );
  }
  if (step === 'stats-banner') {
    return (
      <OnboardingOverlay
        title={t('onboarding.step6.title')}
        desc={t('onboarding.step6.desc')}
        onNext={advance}
        onSkip={skipAll}
        t={t}
      />
    );
  }
  if (step === 'schedule-banner') {
    return (
      <OnboardingOverlay
        title={t('onboarding.step12.title')}
        desc={t('onboarding.step12.desc')}
        onNext={advance}
        onSkip={skipAll}
        t={t}
      />
    );
  }
  if (step === 'telegram-cta') {
    return (
      <OnboardingOverlay
        title={t('onboarding.step16.title')}
        desc={t('onboarding.step16.desc')}
        onNext={skipAll}
        onSkip={skipAll}
        isFinal
        onTelegramLink={handleTelegramLink}
        t={t}
      />
    );
  }

  // Modal-banner steps — rendered inside the modals themselves
  if (step === 'shift-modal' || step === 'schedule-modal') return null;

  // Tooltip steps
  const config = TOOLTIP_STEPS[step];
  if (!config) return null;

  return (
    <OnboardingTooltip
      key={step}
      targetSelector={config.target}
      message={t(config.msgKey)}
      mode={config.mode}
      onAdvance={advance}
      onSkip={skipAll}
      t={t}
      skipIfMissing={config.skipIfMissing}
    />
  );
}
