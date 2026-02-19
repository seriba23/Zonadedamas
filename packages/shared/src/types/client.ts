import { PaginationParams } from './common';

export interface ClientTag {
  id: string;
  tenantId: string;
  name: string;
  color: string;
  createdAt: string;
}

export interface Client {
  id: string;
  tenantId: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  gender?: string | null;
  dateOfBirth?: string | null;
  notes?: string | null;
  avatarUrl?: string | null;
  isActive: boolean;
  source?: string | null;
  createdAt: string;
  updatedAt: string;
  tags?: ClientTag[];
}

export interface CreateClientRequest {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  gender?: string;
  dateOfBirth?: string;
  notes?: string;
}

export type UpdateClientRequest = Partial<CreateClientRequest>;

export interface ClientSearchParams extends PaginationParams {
  search?: string;
}
