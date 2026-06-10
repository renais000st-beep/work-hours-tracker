import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getProfileId(req: NextRequest) {
  return req.headers.get('x-profile-id');
}

export async function GET(request: NextRequest) {
  const profileId = getProfileId(request);
  if (!profileId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month') || new Date().toISOString().slice(0, 7);
  const group = searchParams.get('group');

  const [year, mon] = month.split('-').map(Number);
  const firstDay = `${month}-01`;
  const lastDay = new Date(year, mon, 0).toISOString().slice(0, 10);

  let query = supabaseAdmin
    .from('work_shifts')
    .select('*')
    .eq('user_id', profileId)
    .gte('date', firstDay)
    .lte('date', lastDay)
    .order('date', { ascending: false });

  if (group) query = query.eq('group', group);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const profileId = getProfileId(request);
  if (!profileId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();

  const { data, error } = await supabaseAdmin
    .from('work_shifts')
    .insert({ ...body, user_id: profileId })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const profileId = getProfileId(request);
  if (!profileId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, ...updates } = await request.json();

  const { data, error } = await supabaseAdmin
    .from('work_shifts')
    .update(updates)
    .eq('id', id)
    .eq('user_id', profileId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const profileId = getProfileId(request);
  if (!profileId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const { error } = await supabaseAdmin
    .from('work_shifts')
    .delete()
    .eq('id', id)
    .eq('user_id', profileId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
