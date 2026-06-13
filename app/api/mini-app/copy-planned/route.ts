import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { calculateHours } from '@/lib/hours';

export const dynamic = 'force-dynamic';

const getAdmin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  const profileId = request.headers.get('x-profile-id');
  if (!profileId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { month } = await request.json();
  if (!month) return NextResponse.json({ error: 'Missing month' }, { status: 400 });

  const [year, mon] = month.split('-').map(Number);
  const firstDay = `${month}-01`;
  const lastDay = new Date(year, mon, 0).toISOString().slice(0, 10);

  const { data: planned } = await getAdmin()
    .from('planned_shifts')
    .select('*')
    .eq('user_id', profileId)
    .gte('date', firstDay)
    .lte('date', lastDay);

  if (!planned || planned.length === 0) {
    return NextResponse.json({ inserted: 0, skipped: 0 });
  }

  const { data: existing } = await getAdmin()
    .from('work_shifts')
    .select('date, group, start_time')
    .eq('user_id', profileId)
    .gte('date', firstDay)
    .lte('date', lastDay);

  const existingKeys = new Set(
    (existing || []).map((s: any) => `${s.date}__${s.group}__${s.start_time}`)
  );

  const groupNames = [...new Set(planned.map((s: any) => s.group_name))];
  const { data: groups } = await getAdmin()
    .from('groups')
    .select('id, name')
    .in('name', groupNames);
  const groupMap = new Map((groups || []).map((g: any) => [g.name, g.id]));

  const toInsert = planned
    .filter((shift: any) => !existingKeys.has(`${shift.date}__${shift.group_name}__${shift.start_time}`))
    .map((shift: any) => ({
      user_id: profileId,
      group: shift.group_name,
      group_id: groupMap.get(shift.group_name) || null,
      date: shift.date,
      start_time: shift.start_time,
      end_time: shift.end_time,
      ...calculateHours(shift.start_time.slice(0, 5), shift.end_time.slice(0, 5), shift.date),
    }));

  if (toInsert.length === 0) {
    return NextResponse.json({ inserted: 0, skipped: planned.length });
  }

  const { error } = await getAdmin().from('work_shifts').insert(toInsert);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ inserted: toInsert.length, skipped: planned.length - toInsert.length });
}
