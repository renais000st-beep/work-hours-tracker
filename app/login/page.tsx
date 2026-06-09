'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/i18n';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<'ru' | 'de'>('ru');

  const router = useRouter();
  const { t, setLanguage } = useTranslation();

  // Проверка — если уже залогинен, сразу на dashboard
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.push('/dashboard');
      }
    });

    const savedLang = localStorage.getItem('preferredLanguage') as 'ru' | 'de' | null;
    if (savedLang) {
      setSelectedLanguage(savedLang);
      setLanguage(savedLang);
    }
  }, [router, setLanguage]);

  const handleLanguageChange = (lang: 'ru' | 'de') => {
    setSelectedLanguage(lang);
    setLanguage(lang);
    localStorage.setItem('preferredLanguage', lang);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert('Ошибка входа: ' + error.message);
      setLoading(false);
    } else {
      router.push('/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4 sm:p-6">
      <div className="bg-zinc-900 w-full max-w-md mx-auto rounded-3xl border border-zinc-700 p-8 sm:p-10">

        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-8 text-center">
          {t('login.title')}
        </h1>

        {/* Выбор языка */}
        <div className="flex gap-2 bg-zinc-800 p-1.5 rounded-3xl mb-10">
          <button
            onClick={() => handleLanguageChange('ru')}
            className={`flex-1 py-4 rounded-2xl font-medium transition text-base ${
              selectedLanguage === 'ru' ? 'bg-white text-black shadow font-semibold' : 'text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            🇷🇺 Русский
          </button>

          <button
            onClick={() => handleLanguageChange('de')}
            className={`flex-1 py-4 rounded-2xl font-medium transition text-base ${
              selectedLanguage === 'de' ? 'bg-white text-black shadow font-semibold' : 'text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            🇩🇪 Deutsch
          </button>
        </div>

        <form onSubmit={handleLogin} className="space-y-8">
          <div>
            <label className="text-zinc-400 text-sm block mb-2">{t('login.email')}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-3xl px-6 py-6 text-lg text-white focus:outline-none focus:border-white transition"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="text-zinc-400 text-sm block mb-2">{t('login.password')}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-3xl px-6 py-6 text-lg text-white focus:outline-none focus:border-white transition"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-6 bg-white text-black rounded-3xl font-semibold text-xl hover:bg-zinc-200 disabled:opacity-50 transition mt-4"
          >
            {loading ? t('login.loggingIn') : t('login.login')}
          </button>
        </form>
      </div>
    </div>
  );
}