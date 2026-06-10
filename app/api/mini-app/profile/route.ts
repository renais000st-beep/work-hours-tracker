import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  const profileId = request.headers.get('x-profile-id');
  if (!profileId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data } = await supabaseAdmin
    .from('user_notification_settings')
    .select('notification_time')
    .eq('profile_id', profileId)
    .single();

  return NextResponse.json({ notificationTime: data?.notification_time ?? null });
}

export async function PUT(request: NextRequest) {
  const profileId = request.headers.get('x-profile-id');
  if (!profileId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { notificationTime } = await request.json();

  const { error } = await supabaseAdmin
    .from('user_notification_settings')
    .upsert({ profile_id: profileId, notification_time: notificationTime });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
