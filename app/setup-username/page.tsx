// app/setup-username/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/i18n';

export default function SetupUsername() {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const { t, language, setLanguage } = useTranslation();

  // Проверяем, есть ли уже username
  useEffect(() => {
    const checkProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('username, language')
        .eq('id', user.id)
        .single();

      if (profile?.username) {
        if (profile.language) setLanguage(profile.language as 'ru' | 'de');
        window.location.href = '/dashboard';
      }
    };

    checkProfile();
  }, [router, setLanguage]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (username.length < 3 || username.length > 30) {
      setError('Имя должно быть от 3 до 30 символов');
      setLoading(false);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error: upsertError } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        username: username.trim(),
        display_name: username.trim(),
        language: language,
      }, { onConflict: 'id' });

    if (upsertError) {
      if (upsertError.code === '23505') {
        setError(t('setup.NameUsed'));
      } else {
        setError(t('setup.Error') + upsertError.message);
      }
    } else {
      console.log('✅ ' + t('setup.savedUsername'));
      window.location.href = '/dashboard';
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4 sm:p-6">
      <div className="bg-zinc-900 w-full max-w-md mx-auto rounded-2xl border border-zinc-800 p-8 sm:p-10">
        <h1 className="text-3xl font-bold text-center mb-4 text-white tracking-tight">
          {t('setup.usernameTitle')}
        </h1>
        <p className="text-zinc-500 text-center mb-10 text-lg">
          {t('setup.usernameSubtitle')}
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <input
              type="text"
              placeholder="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-4 text-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-zinc-500 transition-colors"
              required
              autoFocus
            />
          </div>

          {error && (
            <p className="text-red-400 text-center text-sm font-medium">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-white text-black rounded-xl font-semibold text-xl hover:bg-zinc-200 disabled:opacity-50 transition-colors"
          >
            {loading ? t('setup.loading') : t('common.save')}
          </button>
        </form>
      </div>
    </div>
  );
}