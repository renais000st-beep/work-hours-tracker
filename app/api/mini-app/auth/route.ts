import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHmac } from 'crypto';

export const dynamic = 'force-dynamic';

const getAdmin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function verifyInitData(initData: string): boolean {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return false;

    params.delete('hash');

    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    const secretKey = createHmac('sha256', 'WebAppData')
      .update(process.env.TELEGRAM_BOT_TOKEN!)
      .digest();

    const computed = createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    return computed === hash;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { initData } = body;

    console.log('[mini-app/auth] initData length:', initData?.length ?? 0);
    console.log('[mini-app/auth] initData preview:', initData?.slice(0, 100));

    if (!initData) {
      console.error('[mini-app/auth] Empty initData — opened outside Telegram or in test mode');
      return NextResponse.json({ error: 'No initData' }, { status: 400 });
    }

    const verified = verifyInitData(initData);
    console.log('[mini-app/auth] HMAC verified:', verified);
    console.log('[mini-app/auth] BOT_TOKEN set:', !!process.env.TELEGRAM_BOT_TOKEN);

    if (!verified) {
      return NextResponse.json({ error: 'Invalid initData' }, { status: 401 });
    }

    const params = new URLSearchParams(initData);
    const userStr = params.get('user');
    if (!userStr) {
      return NextResponse.json({ error: 'No user data' }, { status: 400 });
    }

    const tgUser = JSON.parse(userStr);
    const telegramId = String(tgUser.id);

    const { data: linked, error: linkError } = await getAdmin()
      .from('telegram_users')
      .select('profile_id')
      .eq('telegram_id', telegramId)
      .single();

    if (linkError || !linked) {
      return NextResponse.json({ error: 'User not linked' }, { status: 404 });
    }

    const profileId = linked.profile_id;

    const [profileRes, groupsRes] = await Promise.all([
      getAdmin().from('profiles').select('username, is_admin').eq('id', profileId).single(),
      getAdmin().from('user_groups').select('role, groups(id, name)').eq('user_id', profileId),
    ]);

    return NextResponse.json({
      profileId,
      username: profileRes.data?.username || tgUser.first_name || 'User',
      isAdmin: profileRes.data?.is_admin || false,
      groups: (groupsRes.data || []).map((g: any) => ({
        id: g.groups.id,
        name: g.groups.name,
        role: g.role,
      })),
    });
  } catch (err) {
    console.error('Mini app auth error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
