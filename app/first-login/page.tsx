'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function FirstLogin() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      alert('Введите имя и фамилию');
      return;
    }

    setLoading(true);

    const { error } = await supabase
      .from('profiles')
      .update({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        profile_completed: true
      })
      .eq('id', (await supabase.auth.getUser()).data.user?.id);

    if (error) {
      alert('Ошибка: ' + error.message);
    } else {
      alert('Данные сохранены!');
      window.location.href = '/dashboard';   // Полная перезагрузка — самое надёжное
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="bg-zinc-900 p-10 rounded-3xl w-full max-w-md border border-zinc-700">
        <h1 className="text-3xl font-bold text-center mb-6">Добро пожаловать!</h1>
        <p className="text-zinc-400 text-center mb-8">
          Пожалуйста, введите ваше имя и фамилию.<br />
          Это нужно сделать только один раз.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <input
            type="text"
            placeholder="Имя"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl px-5 py-4 text-lg"
            required
          />
          <input
            type="text"
            placeholder="Фамилия"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl px-5 py-4 text-lg"
            required
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-white text-black rounded-2xl font-medium text-lg hover:bg-zinc-200 disabled:opacity-50"
          >
            {loading ? 'Сохранение...' : 'Сохранить и продолжить'}
          </button>
        </form>
      </div>
    </div>
  );
}