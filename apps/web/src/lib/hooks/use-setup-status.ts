'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useSetupStatus() {
  const { data: businessData, isLoading: l1 } = useQuery({
    queryKey: ['tenant-setup-check'],
    queryFn: () => api.get<any>('/api/tenants/current'),
    staleTime: 5 * 60 * 1000,
  });

  const { data: employeesData, isLoading: l2 } = useQuery({
    queryKey: ['employees-count'],
    queryFn: () => api.get<{ data: any[] }>('/api/employees?perPage=100'),
    staleTime: 5 * 60 * 1000,
  });

  const { data: servicesData, isLoading: l3 } = useQuery({
    queryKey: ['services-count'],
    queryFn: () => api.get<{ data: any[] }>('/api/services'),
    staleTime: 5 * 60 * 1000,
  });

  const { data: businessHoursData, isLoading: l4 } = useQuery({
    queryKey: ['business-hours-check'],
    queryFn: () => api.get<{ data: any[] }>('/api/tenant/business-hours'),
    staleTime: 5 * 60 * 1000,
  });

  const isLoading = l1 || l2 || l3 || l4;

  const business = businessData?.data as any;
  const employees = employeesData?.data || [];
  const services = servicesData?.data || [];
  const businessHours = businessHoursData?.data || [];

  const needsBusinessProfile = business && !business.description && !business.logoUrl;
  const needsBusinessHours = businessHours.length === 0 || businessHours.every((h: any) => !h.isOpen);
  const needsServices = services.length === 0;
  const needsEmployees = employees.length <= 1;
  const employeesWithoutSchedule = employees.filter(
    (e: any) => e.isActive && (!e.schedules || e.schedules.length === 0 || e.schedules.every((s: any) => !s.isWorking)),
  );
  const needsEmployeeSchedules = employeesWithoutSchedule.length > 0;

  const checks = [
    !needsBusinessProfile,
    !needsBusinessHours,
    !needsServices,
    !needsEmployees,
    !needsEmployeeSchedules,
  ];
  const totalSteps = checks.length;
  const completedSteps = checks.filter(Boolean).length;
  const isSetupComplete = !needsBusinessProfile && !needsBusinessHours && !needsServices && !needsEmployees && !needsEmployeeSchedules;

  return {
    isSetupComplete,
    isLoading,
    completedSteps,
    totalSteps,
    // Expose individual checks for the wizard
    needsBusinessProfile,
    needsBusinessHours,
    needsServices,
    needsEmployees,
    needsEmployeeSchedules,
    employeesWithoutSchedule,
    employees,
  };
}
