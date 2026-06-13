export const GROUP_DEFAULT_TIMES: Record<string, { start: string; end: string }> = {
  ingo:     { start: '10:00', end: '00:00' },
  kuby:     { start: '10:00', end: '00:00' },
  stefan:   { start: '07:00', end: '20:00' },
  kasjutin: { start: '07:00', end: '20:00' },
};

// Quick-add config: times and whether to auto-create a 00:00–10:00 tail on the next day
export const GROUP_QUICK_CONFIG: Record<string, { start: string; end: string; nextDayTail: boolean }> = {
  ingo:     { start: '10:00', end: '00:00', nextDayTail: true },
  kuby:     { start: '10:00', end: '00:00', nextDayTail: true },
  stefan:   { start: '07:00', end: '20:00', nextDayTail: false },
  kasjutin: { start: '07:00', end: '20:00', nextDayTail: false },
};

export function getGroupQuickConfig(groupName: string) {
  const key = Object.keys(GROUP_QUICK_CONFIG).find(k => groupName.toLowerCase().includes(k));
  return key ? GROUP_QUICK_CONFIG[key] : { start: '10:00', end: '00:00', nextDayTail: true };
}

export const germanHolidays = [
  '2025-01-01','2025-04-18','2025-04-21','2025-05-01','2025-05-29','2025-06-09','2025-10-03','2025-12-25','2025-12-26',
  '2026-01-01','2026-04-03','2026-04-06','2026-05-01','2026-05-14','2026-05-25','2026-10-03','2026-12-25','2026-12-26',
];
