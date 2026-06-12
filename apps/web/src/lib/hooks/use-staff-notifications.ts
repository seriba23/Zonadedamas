'use client';

import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { useAuth } from './use-auth';
import {
  pushSupported,
  pushPermission,
  registerServiceWorker,
  subscribePushOnServer,
} from '../push';

export interface StaffNotification {
  id: string;
  tenantId: string;
  userId: string;
  type: string;
  section: string;
  title: string;
  body: string;
  link: string | null;
  entityType: string | null;
  entityId: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface UnreadCounts {
  counts: Record<string, number>;
  total: number;
}

/**
 * Polea los counts no leidos cada 30 segundos. Sirve de fuente unica de
 * verdad para los badges del sidebar y el bell del topbar.
 */
export function useUnreadCounts() {
  const { isAuthenticated } = useAuth();
  return useQuery<UnreadCounts>({
    queryKey: ['staff-notifications', 'unread-counts'],
    queryFn: async () => {
      const res = await api.get<{ data: UnreadCounts }>(
        '/api/staff-notifications/unread-counts',
      );
      return res.data;
    },
    enabled: isAuthenticated,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}

export function useNotificationsList(filters?: {
  page?: number;
  perPage?: number;
  section?: string;
  unreadOnly?: boolean;
}) {
  const { isAuthenticated } = useAuth();
  const params = new URLSearchParams();
  if (filters?.page) params.set('page', String(filters.page));
  if (filters?.perPage) params.set('perPage', String(filters.perPage));
  if (filters?.section) params.set('section', filters.section);
  if (filters?.unreadOnly) params.set('unreadOnly', 'true');
  const qs = params.toString();
  return useQuery<{
    data: StaffNotification[];
    meta: { page: number; perPage: number; total: number; totalPages: number };
  }>({
    queryKey: ['staff-notifications', 'list', filters],
    queryFn: async () => {
      const res = await api.get<{
        data: StaffNotification[];
        meta: { page: number; perPage: number; total: number; totalPages: number };
      }>(`/api/staff-notifications${qs ? `?${qs}` : ''}`);
      return res;
    },
    enabled: isAuthenticated,
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/api/staff-notifications/${id}/read`, {});
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff-notifications'] });
    },
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (section?: string) => {
      await api.post(`/api/staff-notifications/read-all`, section ? { section } : {});
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff-notifications'] });
    },
  });
}

/**
 * Registra el service worker y suscribe al push si el usuario ya
 * concedio permiso. Idempotente. Para llamar una vez en el shell del
 * portal del empleado / dashboard.
 */
export function useEnsurePushSubscription() {
  const { isAuthenticated } = useAuth();
  useEffect(() => {
    if (!isAuthenticated) return;
    if (!pushSupported()) return;
    let cancelled = false;
    (async () => {
      await registerServiceWorker();
      if (cancelled) return;
      if (pushPermission() === 'granted') {
        await subscribePushOnServer();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);
}
