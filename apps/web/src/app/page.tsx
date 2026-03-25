'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // Detect if running on mobile (non-localhost = Capacitor or mobile browser)
    const isMobile = typeof window !== 'undefined'
      && !window.location.hostname.includes('localhost')
      && !window.location.hostname.includes('127.0.0.1');

    if (isMobile) {
      router.replace('/marketplace');
    } else {
      router.replace('/dashboard');
    }
  }, [router]);

  return null;
}
