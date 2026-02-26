import { SubscriptionPlan } from '@prisma/client';

export interface PlanLimits {
  maxEmployees: number;
  maxAppointmentsPerMonth: number;
  maxLocations: number;
  fullReports: boolean;
  exportReports: boolean;
  monthlyPriceUsd: number;
}

export const PLAN_LIMITS: Record<SubscriptionPlan, PlanLimits> = {
  BASICO: {
    maxEmployees: 3,
    maxAppointmentsPerMonth: 150,
    maxLocations: 1,
    fullReports: false,
    exportReports: false,
    monthlyPriceUsd: 29.99,
  },
  PLUS: {
    maxEmployees: 8,
    maxAppointmentsPerMonth: 500,
    maxLocations: 3,
    fullReports: true,
    exportReports: false,
    monthlyPriceUsd: 49.99,
  },
  PRO: {
    maxEmployees: 20,
    maxAppointmentsPerMonth: -1, // unlimited
    maxLocations: -1, // unlimited
    fullReports: true,
    exportReports: true,
    monthlyPriceUsd: 79.99,
  },
};
