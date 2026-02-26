'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PlatformPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/platform/dashboard');
  }, [router]);
  return null;
}
