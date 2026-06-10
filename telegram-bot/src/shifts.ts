import { supabase } from './supabase';

export async function getCurrentMonthShifts(telegramId: number) {
  // Получаем profile_id по telegram_id
  const { data: telegramUser, error: telegramError } = await supabase
    .from('telegram_users')
    .select('profile_id')
    .eq('telegram_id', telegramId)
    .single();

  if (telegramError || !telegramUser?.profile_id) {
    throw new Error('Пользователь не найден или не привязан');
  }

  const profileId = telegramUser.profile_id;

  // Получаем текущий месяц
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

  // Запрашиваем смены за текущий месяц
  const { data: shifts, error } = await supabase
    .from('work_shifts')
    .select('date, start_time, end_time, total_hours')
    .eq('user_id', profileId)
    .gte('date', firstDay)
    .lte('date', lastDay)
    .order('date', { ascending: true });

  if (error) {
    throw error;
  }

  return shifts || [];
}
export async function getUnrecordedPlannedShifts(telegramId: number) {
  // Получаем profile_id
  const { data: telegramUser } = await supabase
    .from('telegram_users')
    .select('profile_id')
    .eq('telegram_id', telegramId)
    .single();

  if (!telegramUser?.profile_id) return [];

  const profileId = telegramUser.profile_id;
  const today = new Date().toISOString().split('T')[0];

  // Получаем planned_shifts, у которых нет work_shifts
  const { data: plannedShifts } = await supabase
    .from('planned_shifts')
    .select('id, date, start_time, end_time, group_name')
    .eq('user_id', profileId)
    .gte('date', today)                    // можно убрать, если хочешь показывать и прошлые
    .order('date', { ascending: true });

  if (!plannedShifts || plannedShifts.length === 0) return [];

  // Проверяем, какие из них уже записаны
  const unrecorded: any[] = [];

  for (const shift of plannedShifts) {
    const { data: existing } = await supabase
      .from('work_shifts')
      .select('id')
      .eq('user_id', profileId)
      .eq('date', shift.date)
      .eq('group', shift.group_name)
      .eq('start_time', shift.start_time)
      .maybeSingle();

    if (!existing) {
      unrecorded.push(shift);
    }
  }

  return unrecorded;
}