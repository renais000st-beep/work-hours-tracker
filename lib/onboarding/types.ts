export const ONBOARDING_STEPS = [
  'idle',
  'dashboard-banner',
  'calendar-tab',
  'date-click',
  'shift-modal',
  'stats-tab',
  'stats-banner',
  'stats-month',
  'stats-group',
  'stats-summary',
  'stats-table',
  'schedule-nav',
  'schedule-banner',
  'schedule-date',
  'schedule-modal',
  'schedule-notes',
  'telegram-cta',
  'complete',
] as const;

export type OnboardingStepId = typeof ONBOARDING_STEPS[number];

export interface OnboardingContextType {
  step: OnboardingStepId;
  advance: () => void;
  skipAll: () => void;
  startOnboarding: () => void;
  setUserGroupCount: (count: number) => void;
  isActive: boolean;
  handleTelegramLink: () => Promise<void>;
}
