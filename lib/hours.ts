import { isSunday } from 'date-fns';
import { germanHolidays } from './constants';

export function calculateHours(startTime: string, endTime: string, date: string) {
  if (!startTime || !endTime) {
    return { day_hours: 0, night_hours: 0, total_hours: 0, sunday_hours: 0, holiday_hours: 0 };
  }

  if (startTime === '00:00' && endTime === '00:00') {
    const isHolidayDay = germanHolidays.includes(date);
    const isSun = isSunday(new Date(date));
    return {
      day_hours: 16,
      night_hours: 6,
      total_hours: 22,
      sunday_hours: isSun ? 22 : 0,
      holiday_hours: isHolidayDay ? 22 : 0,
    };
  }

  const start = new Date(`2000-01-01T${startTime}`);
  const end = new Date(`2000-01-01T${endTime}`);

  let totalMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
  if (totalMinutes < 0) totalMinutes += 24 * 60;

  let paidMinutes = 0;
  let nightMinutes = 0;
  let current = new Date(start);

  for (let i = 0; i < totalMinutes; i += 60) {
    const hour = current.getHours();
    const minutesLeft = Math.min(60, totalMinutes - i);

    if (hour >= 22) {
      current.setMinutes(current.getMinutes() + 60);
      continue;
    }

    paidMinutes += minutesLeft;

    if (hour >= 0 && hour < 6) {
      nightMinutes += minutesLeft;
    }

    current.setMinutes(current.getMinutes() + 60);
  }

  const total_hours = Number((paidMinutes / 60).toFixed(2));
  const night_hours = Number((nightMinutes / 60).toFixed(2));
  const day_hours = Number((total_hours - night_hours).toFixed(2));

  const isHolidayDay = germanHolidays.includes(date);
  const isSun = isSunday(new Date(date));

  return {
    day_hours: Math.max(0, day_hours),
    night_hours: Math.max(0, night_hours),
    total_hours,
    sunday_hours: isSun ? total_hours : 0,
    holiday_hours: isHolidayDay ? total_hours : 0,
  };
}
