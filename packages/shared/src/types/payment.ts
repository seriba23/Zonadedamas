// ─── ENUMS ───────────────────────────────────────────────────────────────────

export const PaymentMethod = {
  CASH: 'CASH',
  CARD: 'CARD',
  TRANSFER: 'TRANSFER',
  OTHER: 'OTHER',
} as const;

export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

export const PaymentStatus = {
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED',
  REFUNDED: 'REFUNDED',
  PARTIALLY_REFUNDED: 'PARTIALLY_REFUNDED',
} as const;

export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const PaymentItemType = {
  SERVICE: 'SERVICE',
  PRODUCT: 'PRODUCT',
  OTHER: 'OTHER',
} as const;

export type PaymentItemType =
  (typeof PaymentItemType)[keyof typeof PaymentItemType];

// ─── CORE TYPES ──────────────────────────────────────────────────────────────

export interface PaymentItem {
  id: string;
  paymentId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  itemType: PaymentItemType;
  referenceId?: string | null;
  referenceType?: string | null;
}

export interface Payment {
  id: string;
  tenantId: string;
  appointmentId?: string | null;
  clientId: string;
  locationId: string;
  amount: number;
  tipAmount: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
  paymentMethod: PaymentMethod;
  status: PaymentStatus;
  reference?: string | null;
  notes?: string | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
  items?: PaymentItem[];
}

// ─── REQUEST TYPES ───────────────────────────────────────────────────────────

export interface CreatePaymentRequest {
  appointmentId?: string;
  clientId: string;
  locationId: string;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    itemType: PaymentItemType;
  }>;
  paymentMethod: PaymentMethod;
  tipAmount?: number;
  discountAmount?: number;
}
