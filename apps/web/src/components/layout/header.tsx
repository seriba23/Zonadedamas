'use client';

import { useAuth } from '@/lib/hooks/use-auth';
import { getInitials } from '@/lib/utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface HeaderProps {
  title: string;
}

export function Header({ title }: HeaderProps) {
  const { user } = useAuth();

  return (
    <header className="h-16 bg-white border-b border-gray-200 px-6 flex items-center justify-between">
      <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
      {user && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600 hidden sm:block">
            {user.firstName} {user.lastName}
          </span>
          <div className="w-9 h-9 rounded-full bg-primary-600 text-white flex items-center justify-center text-sm font-semibold overflow-hidden">
            {user.avatarUrl ? (
              <img src={`${API_URL}${user.avatarUrl}`} alt="" className="w-full h-full object-cover" />
            ) : (
              getInitials(user.firstName, user.lastName)
            )}
          </div>
        </div>
      )}
    </header>
  );
}
