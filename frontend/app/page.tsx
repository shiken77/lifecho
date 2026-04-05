"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    router.push('/chat');
  }, [router]);

  return (
    <div className="paper-texture flex min-h-screen w-full items-center justify-center">
      <div className="text-center">
        <p className="text-echo-ink text-lg">正在跳转...</p>
      </div>
    </div>
  );
}
