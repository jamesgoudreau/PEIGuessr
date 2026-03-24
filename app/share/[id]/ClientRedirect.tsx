'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ClientRedirect() {
  const router = useRouter();
  
  useEffect(() => {
    router.replace('/');
  }, [router]);
  
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-red-500 font-black text-3xl animate-pulse">Launching RedDirtRadar...</div>
    </div>
  );
}
