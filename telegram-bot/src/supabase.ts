import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
import ws from 'ws';

// Проверка, что переменные окружения есть
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_URL или SUPABASE_SERVICE_ROLE_KEY не найдены в .env');
}

// Создаём Supabase клиент с полными правами (Service Role)
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    realtime: {
      transport: ws,
    },
  }
);