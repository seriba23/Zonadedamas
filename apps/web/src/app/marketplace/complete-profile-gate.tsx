'use client';

import { useState, useEffect } from 'react';
import { useMarketplaceAuth } from '@/lib/hooks/use-marketplace-auth';
import { CompleteProfileModal } from '@/components/ui/complete-profile-modal';

const DISMISSED_KEY = 'marketplace_profile_dismissed';

function isProfileIncomplete(user: any): boolean {
  return !user.phone || !user.birthDate || !user.gender;
}

export function CompleteProfileGate() {
  const { user, isAuthenticated, isLoading, refreshUser } = useMarketplaceAuth();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isLoading || !isAuthenticated || !user) return;

    // Don't show if user dismissed it this session
    const dismissed = sessionStorage.getItem(DISMISSED_KEY);
    if (dismissed) return;

    // Show if profile is incomplete
    if (isProfileIncomplete(user)) {
      // Small delay so the page renders first
      const timer = setTimeout(() => setShow(true), 800);
      return () => clearTimeout(timer);
    }
  }, [isLoading, isAuthenticated, user]);

  if (!show || !user) return null;

  return (
    <CompleteProfileModal
      user={user}
      onComplete={() => {
        setShow(false);
        refreshUser();
      }}
      onSkip={() => {
        setShow(false);
        sessionStorage.setItem(DISMISSED_KEY, '1');
      }}
    />
  );
}
