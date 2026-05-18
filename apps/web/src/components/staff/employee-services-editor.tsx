'use client';

import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface Service {
  id: string;
  name: string;
  category?: string;
  subcategory?: string;
  durationMinutes: number;
  price: number;
}

interface EmployeeServiceEntry {
  employeeId: string;
  serviceId: string;
  customPrice: number | null;
  commission: number | null;
  service: Service;
}

interface ServiceConfig {
  serviceId: string;
  commission: number | null;
  customPrice: number | null;
}

interface EmployeeServicesEditorProps {
  employeeId: string;
}

export function EmployeeServicesEditor({ employeeId }: EmployeeServicesEditorProps) {
  const queryClient = useQueryClient();
  const [selectedMap, setSelectedMap] = useState<Map<string, ServiceConfig>>(new Map());
  const [initialized, setInitialized] = useState(false);

  // Fetch all available services
  const { data: servicesData, isLoading: loadingServices } = useQuery({
    queryKey: ['services'],
    queryFn: () => api.get<{ data: Service[] }>('/api/services'),
  });

  // Fetch employee's current services
  const { data: employeeServicesData, isLoading: loadingEmployee } = useQuery({
    queryKey: ['employee-services', employeeId],
    queryFn: () =>
      api.get<{ data: EmployeeServiceEntry[] }>(`/api/employees/${employeeId}/services`),
  });

  const allServices = servicesData?.data || [];
  const currentEntries = employeeServicesData?.data || [];

  // Initialize from current data on first load
  if (!initialized && !loadingEmployee && !loadingServices) {
    const map = new Map<string, ServiceConfig>();
    for (const entry of currentEntries) {
      map.set(entry.serviceId, {
        serviceId: entry.serviceId,
        commission: entry.commission != null ? Number(entry.commission) : null,
        customPrice: entry.customPrice != null ? Number(entry.customPrice) : null,
      });
    }
    setSelectedMap(map);
    setInitialized(true);
  }

  // Group services by category. Al crear un servicio en /services la
  // profesion se guarda en subcategory (no en category), asi que ese
  // campo es la fuente principal.
  const grouped = useMemo(() => {
    const groups: Record<string, Service[]> = {};
    for (const svc of allServices) {
      const cat = svc.subcategory || svc.category || 'Sin categoria';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(svc);
    }
    return Object.entries(groups).sort(([a], [b]) => {
      if (a === 'Sin categoria') return 1;
      if (b === 'Sin categoria') return -1;
      return a.localeCompare(b);
    });
  }, [allServices]);

  const toggleService = useCallback((serviceId: string) => {
    setSelectedMap((prev) => {
      const next = new Map(prev);
      if (next.has(serviceId)) {
        next.delete(serviceId);
      } else {
        next.set(serviceId, { serviceId, commission: null, customPrice: null });
      }
      return next;
    });
  }, []);

  const updateConfig = useCallback((serviceId: string, field: 'commission' | 'customPrice', value: string) => {
    setSelectedMap((prev) => {
      const next = new Map(prev);
      const existing = next.get(serviceId);
      if (!existing) return prev;
      const numValue = value === '' ? null : parseFloat(value);
      next.set(serviceId, { ...existing, [field]: numValue });
      return next;
    });
  }, []);

  function selectAll() {
    setSelectedMap((prev) => {
      const next = new Map(prev);
      for (const svc of allServices) {
        if (!next.has(svc.id)) {
          next.set(svc.id, { serviceId: svc.id, commission: null, customPrice: null });
        }
      }
      return next;
    });
  }

  function deselectAll() {
    setSelectedMap(new Map());
  }

  const saveMutation = useMutation({
    mutationFn: (services: ServiceConfig[]) =>
      api.put<{ data: EmployeeServiceEntry[] }>(`/api/employees/${employeeId}/services`, { services }),
    onSuccess: (response) => {
      // Re-sync local state from server response to avoid stale comparisons
      const map = new Map<string, ServiceConfig>();
      for (const entry of response.data) {
        map.set(entry.serviceId, {
          serviceId: entry.serviceId,
          commission: entry.commission != null ? Number(entry.commission) : null,
          customPrice: entry.customPrice != null ? Number(entry.customPrice) : null,
        });
      }
      setSelectedMap(map);
      queryClient.invalidateQueries({ queryKey: ['employee-services', employeeId] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });

  const hasChanges = useMemo(() => {
    const currentMap = new Map(currentEntries.map((e) => [e.serviceId, e]));
    if (selectedMap.size !== currentMap.size) return true;
    for (const [id, config] of selectedMap) {
      const current = currentMap.get(id);
      if (!current) return true;
      const curCommission = current.commission != null ? Number(current.commission) : null;
      const curCustomPrice = current.customPrice != null ? Number(current.customPrice) : null;
      if ((config.commission ?? null) !== curCommission) return true;
      if ((config.customPrice ?? null) !== curCustomPrice) return true;
    }
    return false;
  }, [selectedMap, currentEntries]);

  const isLoading = loadingServices || loadingEmployee;

  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-8 bg-gray-100 rounded" />
        ))}
      </div>
    );
  }

  if (allServices.length === 0) {
    return (
      <p className="text-sm text-gray-500 text-center py-8">
        No hay servicios configurados. Crea servicios primero en la seccion de Servicios.
      </p>
    );
  }

  function handleSave() {
    const services = Array.from(selectedMap.values()).map((config) => ({
      serviceId: config.serviceId,
      ...(config.commission != null ? { commission: config.commission } : {}),
      ...(config.customPrice != null ? { customPrice: config.customPrice } : {}),
    }));
    saveMutation.mutate(services as ServiceConfig[]);
  }

  function getEffectivePrice(svc: Service, config: ServiceConfig | undefined) {
    return Number(config?.customPrice ?? svc.price);
  }

  function getBusinessProfit(svc: Service, config: ServiceConfig | undefined) {
    if (!config || config.commission == null) return null;
    const price = getEffectivePrice(svc, config);
    return price - Number(config.commission);
  }

  return (
    <div className="space-y-4">
      {/* Header actions */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {selectedMap.size} de {allServices.length} seleccionado{selectedMap.size !== 1 ? 's' : ''}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={selectAll}
            className="text-xs text-primary-600 hover:text-primary-700 font-medium"
          >
            Seleccionar todo
          </button>
          <span className="text-gray-300">|</span>
          <button
            type="button"
            onClick={deselectAll}
            className="text-xs text-gray-500 hover:text-gray-700 font-medium"
          >
            Deseleccionar todo
          </button>
        </div>
      </div>

      {/* Services table grouped by category */}
      <div className="max-h-[500px] overflow-y-auto">
        {grouped.map(([category, services]) => (
          <div key={category} className="mb-4">
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              {category}
            </h4>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-xs">
                    <th className="w-8 px-2 py-2"></th>
                    <th className="text-left px-2 py-2 font-medium">Servicio</th>
                    <th className="text-right px-2 py-2 font-medium w-20">Base</th>
                    <th className="text-right px-2 py-2 font-medium w-28">Precio cliente</th>
                    <th className="text-right px-2 py-2 font-medium w-28">Comision</th>
                    <th className="text-right px-2 py-2 font-medium w-24">Ganancia</th>
                  </tr>
                </thead>
                <tbody>
                  {services.map((svc) => {
                    const isSelected = selectedMap.has(svc.id);
                    const config = selectedMap.get(svc.id);
                    const profit = getBusinessProfit(svc, config);
                    const effectivePrice = getEffectivePrice(svc, config);

                    return (
                      <tr
                        key={svc.id}
                        className={`border-t border-gray-100 transition-colors ${
                          isSelected ? 'bg-primary-50/50' : ''
                        }`}
                      >
                        <td className="px-2 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleService(svc.id)}
                            className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <span className={isSelected ? 'text-gray-900' : 'text-gray-400'}>
                            {svc.name}
                          </span>
                          <span className="text-xs text-gray-400 ml-1">
                            ({svc.durationMinutes}min)
                          </span>
                        </td>
                        <td className="px-2 py-2 text-right text-gray-500 tabular-nums">
                          ${Number(svc.price).toFixed(2)}
                        </td>
                        <td className="px-2 py-2 text-right">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            disabled={!isSelected}
                            placeholder={Number(svc.price).toFixed(2)}
                            value={config?.customPrice ?? ''}
                            onChange={(e) => updateConfig(svc.id, 'customPrice', e.target.value)}
                            className="w-24 text-right text-sm border border-gray-200 rounded px-2 py-1 tabular-nums
                              disabled:bg-gray-50 disabled:text-gray-300 disabled:cursor-not-allowed
                              focus:border-primary-400 focus:ring-1 focus:ring-primary-400"
                          />
                        </td>
                        <td className="px-2 py-2 text-right">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            disabled={!isSelected}
                            placeholder="0.00"
                            value={config?.commission ?? ''}
                            onChange={(e) => updateConfig(svc.id, 'commission', e.target.value)}
                            className="w-24 text-right text-sm border border-gray-200 rounded px-2 py-1 tabular-nums
                              disabled:bg-gray-50 disabled:text-gray-300 disabled:cursor-not-allowed
                              focus:border-primary-400 focus:ring-1 focus:ring-primary-400"
                          />
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">
                          {isSelected && profit != null ? (
                            <span className={profit >= 0 ? 'text-green-600' : 'text-red-600'}>
                              ${profit.toFixed(2)}
                            </span>
                          ) : isSelected ? (
                            <span className="text-gray-300">--</span>
                          ) : (
                            <span className="text-gray-300">--</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      {selectedMap.size > 0 && (
        <div className="flex gap-4 text-xs text-gray-500 border-t border-gray-100 pt-3">
          <span>
            Total precio:{' '}
            <strong className="text-gray-700">
              ${allServices
                .filter((s) => selectedMap.has(s.id))
                .reduce((sum, s) => sum + getEffectivePrice(s, selectedMap.get(s.id)), 0)
                .toFixed(2)}
            </strong>
          </span>
          <span>
            Total comisiones:{' '}
            <strong className="text-gray-700">
              ${Array.from(selectedMap.values())
                .reduce((sum, c) => sum + Number(c.commission ?? 0), 0)
                .toFixed(2)}
            </strong>
          </span>
        </div>
      )}

      {/* Save button */}
      <div className="flex justify-end pt-2 border-t border-gray-100">
        <button
          type="button"
          onClick={handleSave}
          disabled={!hasChanges || saveMutation.isPending}
          className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saveMutation.isPending ? 'Guardando...' : 'Guardar servicios'}
        </button>
      </div>

      {saveMutation.isSuccess && (
        <p className="text-sm text-green-600 text-center">Servicios actualizados correctamente</p>
      )}
      {saveMutation.isError && (
        <p className="text-sm text-red-600 text-center">Error al guardar los servicios</p>
      )}
    </div>
  );
}
