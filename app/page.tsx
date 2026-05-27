'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/login');
  }, [router]);

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-white">
      <p className="text-xl">Перенаправление...</p>
    </div>
  );
}