import type { DriveStep } from 'driver.js';

export function getDashboardCalendarSteps(t: (k: string) => string): DriveStep[] {
  return [
    {
      element: '[data-tour="dashboard-group-selector"]',
      popover: {
        title: t('tour.dashboard.calendar.step1.title'),
        description: t('tour.dashboard.calendar.step1.desc'),
      },
    },
    {
      element: '[data-tour="dashboard-month-prev"]',
      popover: {
        title: t('tour.dashboard.calendar.step2.title'),
        description: t('tour.dashboard.calendar.step2.desc'),
      },
    },
    {
      element: '[data-tour="dashboard-month-next"]',
      popover: {
        title: t('tour.dashboard.calendar.step3.title'),
        description: t('tour.dashboard.calendar.step3.desc'),
      },
    },
    {
      element: '[data-tour="dashboard-calendar-grid"]',
      popover: {
        title: t('tour.dashboard.calendar.step4.title'),
        description: t('tour.dashboard.calendar.step4.desc'),
      },
    },
    {
      element: '[data-tour="dashboard-stats-tab"]',
      popover: {
        title: t('tour.dashboard.calendar.step5.title'),
        description: t('tour.dashboard.calendar.step5.desc'),
      },
    },
  ];
}

export function getDashboardStatsSteps(t: (k: string) => string): DriveStep[] {
  return [
    {
      element: '[data-tour="stats-group-selector"]',
      popover: {
        title: t('tour.dashboard.stats.step1.title'),
        description: t('tour.dashboard.stats.step1.desc'),
      },
    },
    {
      element: '[data-tour="stats-month-selector"]',
      popover: {
        title: t('tour.dashboard.stats.step2.title'),
        description: t('tour.dashboard.stats.step2.desc'),
      },
    },
    {
      element: '[data-tour="stats-summary-card"]',
      popover: {
        title: t('tour.dashboard.stats.step3.title'),
        description: t('tour.dashboard.stats.step3.desc'),
      },
    },
    {
      element: '[data-tour="stats-shifts-table"]',
      popover: {
        title: t('tour.dashboard.stats.step4.title'),
        description: t('tour.dashboard.stats.step4.desc'),
      },
    },
  ];
}

export function getScheduleSteps(t: (k: string) => string): DriveStep[] {
  return [
    {
      element: '[data-tour="schedule-group-tabs"]',
      popover: {
        title: t('tour.schedule.step1.title'),
        description: t('tour.schedule.step1.desc'),
      },
    },
    {
      element: '[data-tour="schedule-month-prev"]',
      popover: {
        title: t('tour.schedule.step2.title'),
        description: t('tour.schedule.step2.desc'),
      },
    },
    {
      element: '[data-tour="schedule-month-next"]',
      popover: {
        title: t('tour.schedule.step3.title'),
        description: t('tour.schedule.step3.desc'),
      },
    },
    {
      element: '[data-tour="schedule-calendar-grid"]',
      popover: {
        title: t('tour.schedule.step4.title'),
        description: t('tour.schedule.step4.desc'),
      },
    },
    {
      element: '[data-tour="schedule-notes-area"]',
      popover: {
        title: t('tour.schedule.step5.title'),
        description: t('tour.schedule.step5.desc'),
      },
    },
  ];
}
