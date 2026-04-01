'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './use-auth';

const WS_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface EmployeeJoinedEvent {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string | null;
  services: string[];
}

export function useWebSocket() {
  const { user, isAuthenticated } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [notifications, setNotifications] = useState<EmployeeJoinedEvent[]>([]);

  const dismissNotification = useCallback((employeeId: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== employeeId));
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !user?.tenantId) return;

    const socket = io(WS_URL, {
      query: { tenantId: user.tenantId },
      transports: ['websocket', 'polling'],
    });

    socket.on('employee:joined', (data: EmployeeJoinedEvent) => {
      setNotifications((prev) => [...prev, data]);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isAuthenticated, user?.tenantId]);

  return { notifications, dismissNotification };
}
