export interface ServiceAddon {
  id: string;
  serviceId: string;
  name: string;
  durationMinutes: number;
  price: number;
  isActive: boolean;
  createdAt: string;
}

export interface Service {
  id: string;
  tenantId: string;
  name: string;
  description?: string | null;
  durationMinutes: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  price: number;
  currency: string;
  color: string;
  category?: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  addons?: ServiceAddon[];
}

export interface CreateServiceRequest {
  name: string;
  description?: string;
  durationMinutes: number;
  bufferBeforeMinutes?: number;
  bufferAfterMinutes?: number;
  price: number;
  currency?: string;
  color?: string;
  category?: string;
}

export type UpdateServiceRequest = Partial<CreateServiceRequest>;
