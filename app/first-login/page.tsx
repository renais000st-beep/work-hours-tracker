'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/i18n';
import { useToast } from '@/app/components/Toast';

export default function FirstLogin() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);

  const router = useRouter();
  const { t } = useTranslation();
  const { showToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      showToast(t('firstLogin.enterName'), 'info');
      return;
    }

    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('profiles')
      .update({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        profile_completed: true,
      })
      .eq('id', user?.id);

    if (error) {
      showToast(t('firstLogin.error') + ': ' + error.message, 'error');
    } else {
      showToast(t('firstLogin.saved'), 'success');
      router.push('/dashboard');
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="bg-zinc-900 p-10 rounded-3xl w-full max-w-md border border-zinc-700">
        <h1 className="text-3xl font-bold text-center mb-6">{t('firstLogin.title')}</h1>
        <p className="text-zinc-400 text-center mb-8">{t('firstLogin.subtitle')}</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <input
            type="text"
            placeholder={t('firstLogin.firstName')}
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl px-5 py-4 text-lg focus:outline-none focus:border-zinc-500 transition-colors"
            required
          />
          <input
            type="text"
            placeholder={t('firstLogin.lastName')}
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl px-5 py-4 text-lg focus:outline-none focus:border-zinc-500 transition-colors"
            required
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-white text-black rounded-2xl font-medium text-lg hover:bg-zinc-200 disabled:opacity-50 transition-colors"
          >
            {loading ? t('firstLogin.saving') : t('firstLogin.save')}
          </button>
        </form>
      </div>
    </div>
  );
}
