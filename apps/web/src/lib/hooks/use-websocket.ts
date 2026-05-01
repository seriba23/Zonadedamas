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

export interface PurchaseCreatedEvent {
  id: string;
  customerName: string;
  customerEmail?: string | null;
  customerPhone: string;
  fulfillmentType: string;
  paymentMethod: string;
  items: Array<{
    productId: string;
    productName: string;
    productImage: string | null;
    quantity: number;
    unitPrice: number;
  }>;
  total: number;
  createdAt: string;
}

export function useWebSocket() {
  const { user, isAuthenticated } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [notifications, setNotifications] = useState<EmployeeJoinedEvent[]>([]);
  const [purchases, setPurchases] = useState<PurchaseCreatedEvent[]>([]);

  const dismissNotification = useCallback((employeeId: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== employeeId));
  }, []);

  const dismissPurchase = useCallback((purchaseId: string) => {
    setPurchases((prev) => prev.filter((p) => p.id !== purchaseId));
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

    socket.on('purchase:created', (data: PurchaseCreatedEvent) => {
      setPurchases((prev) => [...prev, data]);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isAuthenticated, user?.tenantId]);

  return { notifications, dismissNotification, purchases, dismissPurchase };
}
