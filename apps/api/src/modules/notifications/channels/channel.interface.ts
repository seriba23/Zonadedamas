export interface NotificationPayload {
  to: string;
  subject?: string;
  body: string;
  metadata?: Record<string, any>;
}

export interface NotificationChannel {
  send(
    payload: NotificationPayload,
  ): Promise<{ success: boolean; error?: string }>;
}
