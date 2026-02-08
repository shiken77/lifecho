"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    router.push('/chat');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-echo-cream">
      <div className="text-center">
        <p className="text-echo-ink text-lg">正在跳转...</p>
      </div>
    </div>
  );
}
