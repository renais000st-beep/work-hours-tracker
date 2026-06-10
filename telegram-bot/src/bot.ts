import 'dotenv/config';
import { Bot, InlineKeyboard } from 'grammy';
import { supabase } from './supabase';
import { getCurrentMonthShifts, getUnrecordedPlannedShifts } from './shifts';
import { t, setLanguage } from './i18n';

console.log('🚀 Запуск бота...');

if (!process.env.TELEGRAM_BOT_TOKEN) {
  throw new Error('TELEGRAM_BOT_TOKEN не найден в .env');
}

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);

// ==================== ГЛАВНАЯ КЛАВИАТУРА ====================
function getMainKeyboard() {
  const buttons: any[][] = [
    [{ text: '📝 ' + t('bot.writeshift') }, { text: '📋 ' + t('bot.myshift') }],
  ];

  if (process.env.WEBAPP_URL) {
    buttons.push([{ text: '📱 Приложение', web_app: { url: process.env.WEBAPP_URL } }]);
  }

  buttons.push([{ text: '⚙️ ' + t('bot.settings') }]);

  return { keyboard: buttons, resize_keyboard: true, one_time_keyboard: false };
}

// ==================== СОСТОЯНИЯ ====================
type ShiftState =
  | { step: 'idle' }
  | { step: 'awaiting_notification_time' }
  | { step: 'awaiting_custom_date' }
  | { step: 'awaiting_custom_time'; date: string }
  | { step: 'awaiting_new_start_time'; plannedId: string }
  | { step: 'awaiting_new_end_time'; plannedId: string; newStartTime: string };

const userStates = new Map<number, ShiftState>();

function getUserState(userId: number): ShiftState {
  return userStates.get(userId) || { step: 'idle' };
}

function setUserState(userId: number, state: ShiftState) {
  userStates.set(userId, state);
}

function resetUserState(userId: number) {
  userStates.set(userId, { step: 'idle' });
}

// ==================== РАСЧЁТ ЧАСОВ ====================
const germanHolidays = [
  '2025-01-01','2025-04-18','2025-04-21','2025-05-01','2025-05-29','2025-06-09','2025-10-03','2025-12-25','2025-12-26',
  '2026-01-01','2026-04-03','2026-04-06','2026-05-01','2026-05-14','2026-05-25','2026-10-03','2026-12-25','2026-12-26',
];

function calculateHours(date: string, startTime: string, endTime: string) {
  const st = startTime.slice(0, 5);
  const et = endTime.slice(0, 5);

  if (st === '00:00' && et === '00:00') {
    const isSun = new Date(date).getDay() === 0;
    const isHol = germanHolidays.includes(date);
    return { day_hours: 16, night_hours: 6, total_hours: 22, sunday_hours: isSun ? 22 : 0, holiday_hours: isHol ? 22 : 0 };
  }

  const start = new Date(`2000-01-01T${st}`);
  const end = new Date(`2000-01-01T${et}`);
  let totalMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
  if (totalMinutes < 0) totalMinutes += 24 * 60;

  let paidMinutes = 0;
  let nightMinutes = 0;
  let current = new Date(start);

  for (let i = 0; i < totalMinutes; i += 60) {
    const hour = current.getHours();
    const minutesLeft = Math.min(60, totalMinutes - i);
    if (hour >= 22) { current.setMinutes(current.getMinutes() + 60); continue; }
    paidMinutes += minutesLeft;
    if (hour < 6) nightMinutes += minutesLeft;
    current.setMinutes(current.getMinutes() + 60);
  }

  const total_hours = Number((paidMinutes / 60).toFixed(2));
  const night_hours = Number((nightMinutes / 60).toFixed(2));
  const day_hours = Number((total_hours - night_hours).toFixed(2));
  const isSun = new Date(date).getDay() === 0;
  const isHol = germanHolidays.includes(date);

  return {
    day_hours: Math.max(0, day_hours),
    night_hours: Math.max(0, night_hours),
    total_hours,
    sunday_hours: isSun ? total_hours : 0,
    holiday_hours: isHol ? total_hours : 0,
  };
}

async function saveWorkShift(params: {
  userId: string;
  groupName: string;
  date: string;
  startTime: string;
  endTime: string;
}): Promise<{ error?: string }> {
  const { userId, groupName, date, startTime, endTime } = params;

  const { data: existing } = await supabase
    .from('work_shifts')
    .select('id')
    .eq('user_id', userId)
    .eq('date', date)
    .eq('group', groupName)
    .eq('start_time', startTime)
    .maybeSingle();

  if (existing) return { error: 'already_exists' };

  const { data: groupRow } = await supabase
    .from('groups')
    .select('id')
    .eq('name', groupName)
    .maybeSingle();

  const hours = calculateHours(date, startTime, endTime);

  const { error } = await supabase.from('work_shifts').insert({
    user_id: userId,
    group: groupName,
    group_id: groupRow?.id || null,
    date,
    start_time: startTime,
    end_time: endTime,
    ...hours,
  });

  if (error) return { error: error.message };
  return {};
}

// ==================== /start ====================
// ==================== /start ====================
// ==================== /start ====================
bot.command('start', async (ctx) => {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const payload = ctx.match; // то, что идёт после /start=

  try {
    // === Если пришёл токен привязки ===
    if (payload && payload.startsWith('verify_')) {
      const token = payload.replace('verify_', '');

      // Проверяем токен
      const { data: linkToken, error: tokenError } = await supabase
        .from('telegram_link_tokens')
        .select('profile_id, expires_at, used_at')
        .eq('token', token)
        .single();

      if (tokenError || !linkToken) {
        await ctx.reply(`${t('bot.invalidLink')}`);
        return;
      }

      if (new Date(linkToken.expires_at) < new Date()) {
        await ctx.reply(`${t('bot.linkExpired')}`);
        return;
      }

      if (linkToken.used_at) {
        await ctx.reply(`${t('bot.linkUsed')}`);
        return;
      }

      // === Получаем язык пользователя из профиля ===
      const { data: profile } = await supabase
        .from('profiles')
        .select('language')
        .eq('id', linkToken.profile_id)
        .single();

      const userLanguage = profile?.language || 'ru';

      // Привязываем аккаунт + сохраняем язык
      const { error: upsertError } = await supabase.from('telegram_users').upsert({
        telegram_id: telegramId,
        profile_id: linkToken.profile_id,
        username: ctx.from?.username || null,
        first_name: ctx.from?.first_name || null,
        last_name: ctx.from?.last_name || null,
        linked_at: new Date().toISOString(),
        language: userLanguage,
      }, { onConflict: 'telegram_id' });

      if (upsertError) {
        console.error('Ошибка привязки telegram_users:', upsertError);
        await ctx.reply('Ошибка при привязке аккаунта. Попробуйте снова.');
        return;
      }

      // Помечаем токен как использованный (только после успешной привязки)
      await supabase
        .from('telegram_link_tokens')
        .update({ used_at: new Date().toISOString() })
        .eq('token', token);

      setLanguage(userLanguage as 'ru' | 'de');

      await ctx.reply(`${t('bot.linkSuccess')}`);
      await ctx.reply(`${t('bot.choose')}`, { reply_markup: getMainKeyboard() });
      return;
    }

    // === Обычный запуск ===
    const { data: user } = await supabase
      .from('telegram_users')
      .select('first_name, profile_id, language')
      .eq('telegram_id', telegramId)
      .single();

    if (user?.language) {
      setLanguage(user.language as 'ru' | 'de');
    }

    if (user?.profile_id) {
      await ctx.reply(`${t('bot.welcomeback')}${user.first_name ? ', ' + user.first_name : ''}! 👋`);
    } else {
      await ctx.reply(`${t('bot.notLinked')}`);
    }

    await ctx.reply(`${t('bot.choose')}`, { reply_markup: getMainKeyboard() });

  } catch (err) {
    console.error('Ошибка в /start:', err);
    await ctx.reply(`${t('bot.errorr')}`);
  }
});

// ==================== КНОПКА "Записать смену" ====================
bot.hears('📝 ' + t('bot.writeshift'), async (ctx) => {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const shifts = await getUnrecordedPlannedShifts(telegramId);

  if (shifts.length === 0) {
    await ctx.reply(`${t('bot.noshifts')}`, {
      reply_markup: new InlineKeyboard().text('📅 ' + t('bot.other'), 'other_date'),
    });
    return;
  }

  const keyboard = new InlineKeyboard();
  shifts.forEach((shift: any) => {
    const date = new Date(shift.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
    keyboard.text(`${date} • ${shift.group_name}`, `record_shift:${shift.id}`).row();
  });
  keyboard.text('📅 ' + t('bot.other'), 'other_date');

  await ctx.reply(`${t('bot.chooseshift')}`, { reply_markup: keyboard });
});

// ==================== CALLBACK: Выбор запланированной смены ====================
bot.callbackQuery(/^record_shift:/, async (ctx) => {
  const shiftId = ctx.callbackQuery.data.split(':')[1];
  const { data: shift } = await supabase
    .from('planned_shifts')
    .select('id, date, start_time, end_time, group_name')
    .eq('id', shiftId)
    .single();

  if (!shift) {
    await ctx.answerCallbackQuery(`${t('bot.notfind')}`);
    return;
  }

  const dateFormatted = new Date(shift.date).toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  const message =
    `📅 *${t('bot.Group')}* ${shift.group_name}\n` +
    `📆 *${t('bot.Date')}* ${dateFormatted}\n` +
    `🕒 *${t('bot.Time')}* ${shift.start_time.slice(0, 5)} – ${shift.end_time.slice(0, 5)}\n\n` +
    `Записать эту смену?`;

  const keyboard = new InlineKeyboard()
    .text('✅ ' + t('bot.confirm'), `confirm_planned:${shift.id}`)
    .text('✏️ ' + t('bot.change_time'), `change_time_planned:${shift.id}`).row()
    .text('❌ ' + t('bot.cancell'), `cancel_planned:${shift.id}`);

  await ctx.editMessageText(message, { parse_mode: 'Markdown', reply_markup: keyboard });
  await ctx.answerCallbackQuery();
});

// ==================== CALLBACK: Подтвердить / Изменить / Отменить ====================
bot.callbackQuery(/^confirm_planned:/, async (ctx) => {
  const shiftId = ctx.callbackQuery.data.split(':')[1];
  const telegramId = ctx.from?.id;

  if (!telegramId) return;

  try {
    // Получаем данные о запланированной смене
    const { data: planned, error } = await supabase
      .from('planned_shifts')
      .select('*')
      .eq('id', shiftId)
      .single();

    if (error || !planned) {
      await ctx.answerCallbackQuery(`${t('bot.notfind')}`);
      return;
    }

    const result = await saveWorkShift({
      userId: planned.user_id,
      groupName: planned.group_name,
      date: planned.date,
      startTime: planned.start_time,
      endTime: planned.end_time,
    });

    await ctx.answerCallbackQuery();
    if (result.error === 'already_exists') {
      await ctx.editMessageText(`${t('bot.thisshift')}`);
    } else if (result.error) {
      console.error('Ошибка сохранения в work_shifts:', result.error);
      await ctx.editMessageText(`${t('bot.error')}`);
    } else {
      await ctx.editMessageText(`${t('bot.success')}`);
    }

  } catch (err) {
    console.error('Ошибка в confirm_planned:', err);
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(`${t('bot.errorr')}`);
  }
});

bot.callbackQuery(/^change_time_planned:/, async (ctx) => {
  const shiftId = ctx.callbackQuery.data.split(':')[1];
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  setUserState(telegramId, { step: 'awaiting_new_start_time', plannedId: shiftId });
  await ctx.editMessageText(`${t('bot.newTime')}`);
  await ctx.answerCallbackQuery();
});

bot.callbackQuery(/^cancel_planned:/, async (ctx) => {
  await ctx.editMessageText(`${t('bot.cancel')}`);
  await ctx.answerCallbackQuery();
});

// ==================== CALLBACK: Уведомления — подтвердить смену ====================
bot.callbackQuery(/^confirm_shift:/, async (ctx) => {
  const shiftId = ctx.callbackQuery.data.split(':')[1];
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  try {
    const { data: planned, error } = await supabase
      .from('planned_shifts')
      .select('*')
      .eq('id', shiftId)
      .single();

    if (error || !planned) {
      await ctx.answerCallbackQuery(`${t('bot.notfind')}`);
      return;
    }

    const result = await saveWorkShift({
      userId: planned.user_id,
      groupName: planned.group_name,
      date: planned.date,
      startTime: planned.start_time,
      endTime: planned.end_time,
    });

    await ctx.answerCallbackQuery();
    if (result.error === 'already_exists') {
      await ctx.editMessageText(`${t('bot.thisshift')}`);
    } else if (result.error) {
      console.error('Ошибка сохранения:', result.error);
      await ctx.editMessageText(`${t('bot.error')}`);
    } else {
      await ctx.editMessageText(`${t('bot.success')}`);
    }
  } catch (err) {
    console.error('Ошибка в confirm_shift:', err);
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(`${t('bot.errorr')}`);
  }
});

// ==================== CALLBACK: Уведомления — изменить время ====================
bot.callbackQuery(/^change_time:/, async (ctx) => {
  const shiftId = ctx.callbackQuery.data.split(':')[1];
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  setUserState(telegramId, { step: 'awaiting_new_start_time', plannedId: shiftId });
  await ctx.editMessageText(`${t('bot.newTime')}`);
  await ctx.answerCallbackQuery();
});

// ==================== CALLBACK: Уведомления — нет смены ====================
bot.callbackQuery(/^no_shift:/, async (ctx) => {
  await ctx.editMessageText('Понял, сегодня смены нет. 👍');
  await ctx.answerCallbackQuery();
});

// ==================== ДРУГАЯ ДАТА ====================
bot.callbackQuery('other_date', async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  await ctx.answerCallbackQuery();
  setUserState(userId, { step: 'awaiting_custom_date' });

  await ctx.editMessageText(
    `${t('bot.newDate')}`
  );
});

// ==================== НАСТРОЙКИ ====================
bot.hears('⚙️ Настройки', async (ctx) => {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  await ctx.reply(`${t('bot.time')}`);
  setUserState(telegramId, { step: 'awaiting_notification_time' });
});

// ==================== МОИ СМЕНЫ ====================
bot.hears('📋 Мои смены', async (ctx) => {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  try {
    const shifts = await getCurrentMonthShifts(telegramId);

    if (shifts.length === 0) {
      await ctx.reply(`${t('bot.donthave')}`);
      return;
    }

    let message = `📊 *Твои смены за текущий месяц:*\n\n`;
    let totalHours = 0;

    shifts.forEach((shift: any, index: number) => {
      const date = new Date(shift.date).toLocaleDateString('ru-RU');
      message += `${index + 1}. ${date} — ${shift.start_time.slice(0, 5)}–${shift.end_time.slice(0, 5)} (${shift.total_hours} ч.)\n`;
      totalHours += Number(shift.total_hours);
    });

    message += `\n*Итого за месяц:* ${totalHours.toFixed(2)} ч.`;
    await ctx.reply(message, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Ошибка при получении смен:', error);
    await ctx.reply(`${t('bot.trylater')}`);
  }
});

// ==================== ОБРАБОТКА ТЕКСТОВЫХ СООБЩЕНИЙ (СОСТОЯНИЯ) ====================
bot.on('message:text', async (ctx, next) => {
  const telegramId = ctx.from?.id;
  if (!telegramId) return next();

  const state = getUserState(telegramId);
  const text = ctx.message.text.trim();

  // === Настройка уведомлений ===
  if (state.step === 'awaiting_notification_time') {
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(text)) {
      await ctx.reply(`${t('bot.wrong')}`);
      return;
    }

    await supabase.from('user_notification_settings').upsert({
      telegram_id: telegramId,
      notification_time: text,
    }, { onConflict: 'telegram_id' });

    await ctx.reply(`✅ ${t('bot.okay')} ${text}.`);
    await ctx.reply(`${t('bot.choose')}`, { reply_markup: getMainKeyboard() });
    resetUserState(telegramId);
    return;
  }

  // === Ожидание новой даты ===
  if (state.step === 'awaiting_custom_time') {
  if (text.toLowerCase() === 'отмена') {
    resetUserState(telegramId);
    await ctx.reply(`${t('bot.cancel')}`, { reply_markup: getMainKeyboard() });
    return;
  }

  // TODO: Здесь нужно будет добавить выбор группы, если их несколько
  // Пока берём первую группу пользователя (или жёстко задаём)

  const { data: telegramUser } = await supabase
    .from('telegram_users')
    .select('profile_id')
    .eq('telegram_id', telegramId)
    .single();

  if (!telegramUser?.profile_id) {
    await ctx.reply(`${t('bot.noUser')}`);
    resetUserState(telegramId);
    return;
  }

  // Временно берём первую группу (позже сделаем выбор)
  // Получаем первую группу пользователя
const { data: userGroups } = await supabase
  .from('user_groups')
  .select(`
    group_id,
    groups (
      name
    )
  `)
  .eq('user_id', telegramUser.profile_id)
  .limit(1);

// Безопасное получение названия группы
const firstGroup = userGroups?.[0] as any;
const groupName = firstGroup?.groups?.name || firstGroup?.groups?.[0]?.name || 'Основная';

  const startTime = text.split('-')[0].trim();
  const endTime = text.split('-')[1].trim();
  const result = await saveWorkShift({
    userId: telegramUser.profile_id,
    groupName,
    date: state.date,
    startTime,
    endTime,
  });

  if (result.error === 'already_exists') {
    await ctx.reply(`${t('bot.thisshift')}`);
  } else if (result.error) {
    console.error('Ошибка сохранения:', result.error);
    await ctx.reply(`${t('bot.noUser')}`);
  } else {
    await ctx.reply(`✅ ${t('bot.success')}`);
  }

  resetUserState(telegramId);
  return;
}
// === Изменение времени (начало) ===
if (state.step === 'awaiting_new_start_time') {
  const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
  if (!timeRegex.test(text)) {
    await ctx.reply(`${t('bot.wrong')}`);
    return;
  }

  setUserState(telegramId, {
    step: 'awaiting_new_end_time',
    plannedId: state.plannedId,
    newStartTime: text
  });

  await ctx.reply('Теперь введи новое время окончания (ЧЧ:ММ)');
  return;
}

// === Изменение времени (окончание) ===
if (state.step === 'awaiting_new_end_time') {
  const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
  if (!timeRegex.test(text)) {
    await ctx.reply(`${t('bot.wrong')}`);
    return;
  }

  const { plannedId, newStartTime } = state;

  try {
    // Получаем данные о запланированной смене
    const { data: planned } = await supabase
      .from('planned_shifts')
      .select('*')
      .eq('id', plannedId)
      .single();

    if (!planned) {
      await ctx.reply(`${t('bot.notfound')}`);
      resetUserState(telegramId);
      return;
    }

    // Обновляем planned_shifts
    await supabase.from('planned_shifts').update({
      start_time: newStartTime,
      end_time: text
    }).eq('id', plannedId);

    const result = await saveWorkShift({
      userId: planned.user_id,
      groupName: planned.group_name,
      date: planned.date,
      startTime: newStartTime,
      endTime: text,
    });

    if (result.error && result.error !== 'already_exists') {
      console.error('Ошибка сохранения:', result.error);
      await ctx.reply(`${t('bot.errorr')}`);
    } else {
      await ctx.reply(`✅ ${t('bot.successs')}`);
    }
    resetUserState(telegramId);

  } catch (err) {
    console.error('Ошибка при изменении времени:', err);
    await ctx.reply(`${t('bot.errorr')}`);
    resetUserState(telegramId);
  }
  return;
}

  return next();
});

// ==================== ЕЖЕДНЕВНЫЕ НАПОМИНАНИЯ ====================
async function sendDailyReminders() {
  const today = new Date().toISOString().split('T')[0];

  const { data: plannedShifts } = await supabase
    .from('planned_shifts')
    .select(`
      id, user_id, group_name, date, start_time, end_time,
      telegram_users!inner(telegram_id)
    `)
    .eq('date', today);

  if (!plannedShifts || plannedShifts.length === 0) {
    console.log('Сегодня нет запланированных смен.');
    return;
  }

  for (const shift of plannedShifts) {
    const telegramId = (shift as any).telegram_users?.telegram_id;
    if (!telegramId) continue;

    const timeText = shift.start_time && shift.end_time
      ? `${shift.start_time.slice(0, 5)} – ${shift.end_time.slice(0, 5)}`
      : 'время не указано';

    try {
      await bot.api.sendMessage(telegramId, 
        `📅 ${t('bot.notification')}\n\n` +
        `${t('bot.Group')} **${shift.group_name}**\n` +
        `${t('bot.Date')} ${today}\n` +
        `${t('bot.Time')} **${timeText}**\n\n` +
        `${t('bot.right')}`,
        {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '✅ ' + t('bot.confirm'), callback_data: `confirm_shift:${shift.id}` },
                { text: '✏️ ' + t('bot.change_time'), callback_data: `change_time:${shift.id}` },
              ],
              [{ text: '❌ Сегодня нет смены', callback_data: `no_shift:${shift.id}` }],
            ],
          },
        }
      );
    } catch (err) {
      console.error(`Не удалось отправить напоминание пользователю ${telegramId}:`, err);
    }
  }

  console.log('Ежедневные напоминания отправлены.');
}

// Тестовая команда
bot.command('sendreminders', async (ctx) => {
  await ctx.reply('Запускаю отправку напоминаний...');
  await sendDailyReminders();
  await ctx.reply('Готово. Проверь логи.');
});

// ==================== ЗАПУСК БОТА ====================
bot.start();
console.log('✅ Бот успешно запущен и слушает сообщения');