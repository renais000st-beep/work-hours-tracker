// app/setup-username/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/i18n';

export default function SetupUsername() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const { t, language, setLanguage } = useTranslation();

  // Проверка существующего профиля
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
        router.push('/dashboard');
      }
    };

    checkProfile();
  }, [router, setLanguage]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Валидация username
    if (username.length < 3 || username.length > 30) {
      setError('Имя должно быть от 3 до 30 символов');
      setLoading(false);
      return;
    }

    // Валидация пароля (если пользователь решил его задать)
    if (password) {
      if (password.length < 6) {
        setError('Пароль должен быть минимум 6 символов');
        setLoading(false);
        return;
      }

      if (password !== confirmPassword) {
        setError('Пароли не совпадают');
        setLoading(false);
        return;
      }
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      // 1. Сохраняем username
      const { error: upsertError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          username: username.trim(),
          display_name: username.trim(),
          language: language,
        }, { onConflict: 'id' });

      if (upsertError) throw upsertError;

      // 2. Если пользователь ввёл пароль — обновляем его
      if (password) {
        const { error: passwordError } = await supabase.auth.updateUser({
          password: password,
        });

        if (passwordError) throw passwordError;
      }

      router.push('/dashboard');

    } catch (err: any) {
      setError(err.message || 'Произошла ошибка');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4 sm:p-6">
      <div className="bg-zinc-900 w-full max-w-md mx-auto rounded-3xl border border-zinc-700 p-8 sm:p-10">
        <h1 className="text-3xl font-bold text-center mb-4 text-white">
          {t('setup.usernameTitle')}
        </h1>
        <p className="text-zinc-400 text-center mb-10 text-lg">
          {t('setup.usernameSubtitle')}
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Username */}
          <div>
            <input
              type="text"
              placeholder="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-3xl px-6 py-6 text-xl text-white placeholder-zinc-500 focus:outline-none focus:border-white transition"
              required
              autoFocus
            />
          </div>

          {/* Новый пароль (опционально) */}
          <div className="space-y-4">
            <div>
              <input
                type="password"
                placeholder={t('setup.newPassword')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-3xl px-6 py-6 text-xl text-white placeholder-zinc-500 focus:outline-none focus:border-white transition"
              />
            </div>
            {password && (
              <div>
                <input
                  type="password"
                  placeholder={t('setup.confirmPassword')}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-3xl px-6 py-6 text-xl text-white placeholder-zinc-500 focus:outline-none focus:border-white transition"
                />
              </div>
            )}
          </div>

          {error && (
            <p className="text-red-400 text-center text-sm font-medium">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-6 bg-white text-black rounded-3xl font-semibold text-xl hover:bg-zinc-200 disabled:opacity-50 transition mt-4"
          >
            {loading ? t('setup.loading') : t('common.save')}
          </button>
        </form>
      </div>
    </div>
  );
}