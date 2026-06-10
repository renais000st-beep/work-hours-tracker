import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  try {
    // === Получаем текущее берлинское время (HH:MM) ===
    const now = new Date();
    const hh = String(parseInt(new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Berlin', hour: 'numeric', hour12: false
    }).format(now))).padStart(2, '0').replace('24', '00');
    const mm = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Berlin', minute: '2-digit'
    }).format(now).padStart(2, '0');
    const currentTime = `${hh}:${mm}`;

    // === 1. Получаем пользователей с подходящим notification_time ===
    const notifRes = await fetch(
      `${SUPABASE_URL}/rest/v1/user_notification_settings?notification_time=eq.${currentTime}&select=telegram_id`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    );
    const notificationUsers = await notifRes.json();

    if (!notificationUsers || notificationUsers.length === 0) {
      return new Response("Нет пользователей с подходящим временем");
    }

    const telegramIds = notificationUsers.map((u: any) => u.telegram_id);

    // === 2. Получаем telegram_users ===
    const tuRes = await fetch(
      `${SUPABASE_URL}/rest/v1/telegram_users?telegram_id=in.(${telegramIds.join(",")})&select=telegram_id,profile_id`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    );
    const telegramUsers = await tuRes.json();

    if (!telegramUsers || telegramUsers.length === 0) {
      return new Response("Нет привязанных пользователей");
    }

    const profileIds = telegramUsers.map((u: any) => u.profile_id);
    const today = new Date().toISOString().split("T")[0];

    // === 3. Получаем planned_shifts на сегодня ===
    const psRes = await fetch(
      `${SUPABASE_URL}/rest/v1/planned_shifts?date=eq.${today}&user_id=in.(${profileIds.join(",")})&select=id,user_id,group_name,start_time,end_time`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    );
    const plannedShifts = await psRes.json();

    if (!plannedShifts || plannedShifts.length === 0) {
      return new Response("Нет запланированных смен");
    }

    let sentCount = 0;

    for (const shift of plannedShifts) {
      // Проверяем, есть ли уже work_shifts
      const wsRes = await fetch(
        `${SUPABASE_URL}/rest/v1/work_shifts?user_id=eq.${shift.user_id}&date=eq.${today}&select=id`,
        {
          headers: {
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
        }
      );
      const existingWork = await wsRes.json();

      if (existingWork.length > 0) continue;

      const tu = telegramUsers.find((u: any) => u.profile_id === shift.user_id);
      if (!tu) continue;

      const timeText = shift.start_time && shift.end_time
        ? `${shift.start_time.slice(0, 5)} – ${shift.end_time.slice(0, 5)}`
        : "время не указано";

      const message =
        `📅 Напоминание о смене\n\n` +
        `Группа: *${shift.group_name}*\n` +
        `Дата: ${today}\n` +
        `Время: *${timeText}*\n\n` +
        `Всё верно?`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "✅ Подтвердить", callback_data: `confirm_shift:${shift.id}` },
            { text: "✏️ Изменить время", callback_data: `change_time:${shift.id}` }
          ],
          [{ text: "❌ Сегодня нет смены", callback_data: `no_shift:${shift.id}` }]
        ]
      };

      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: tu.telegram_id,
          text: message,
          parse_mode: "Markdown",
          reply_markup: keyboard,
        }),
      });

      sentCount++;
    }

    return new Response(`Отправлено напоминаний: ${sentCount}`);
  } catch (err) {
    console.error("Ошибка:", err);
    return new Response("Error", { status: 500 });
  }
});