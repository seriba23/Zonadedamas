'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import Link from 'next/link';
import dayjs from 'dayjs';

// Profesiones se cargan del catálogo centralizado

interface InviteCode {
  id: string;
  code: string;
  jobTitle: string | null;
  maxUses: number;
  usedCount: number;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
  services: { service: { id: string; name: string } }[];
}

interface Service {
  id: string;
  name: string;
}

export default function InviteCodesPage() {
  const queryClient = useQueryClient();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [jobTitles, setJobTitles] = useState<string[]>([]);
  const [customJobTitle, setCustomJobTitle] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [maxUses, setMaxUses] = useState<number>(1);

  const { data: codes, isLoading } = useQuery({
    queryKey: ['invite-codes'],
    queryFn: async () => {
      const res = await api.get<{ data: InviteCode[] }>('/api/invite-codes');
      return res.data;
    },
  });

  const { data: servicesData } = useQuery({
    queryKey: ['services-for-invite'],
    queryFn: async () => {
      const res = await api.get<{ data: Service[] }>('/api/services?perPage=100');
      return res.data;
    },
  });

  const { data: tenantData } = useQuery({
    queryKey: ['tenant-me'],
    queryFn: async () => {
      const res = await api.get<any>('/api/tenants/current');
      return res.data;
    },
  });

  const { data: professionsData } = useQuery({
    queryKey: ['professions-catalog'],
    queryFn: async () => {
      const res = await api.get<{ data: string[] }>('/api/marketplace/professions');
      return res.data;
    },
  });

  const { data: catalogData } = useQuery({
    queryKey: ['service-catalog-invite'],
    queryFn: async () => {
      const res = await api.get<{ data: { name: string; category: string | null }[] }>('/api/marketplace/service-catalog');
      return res.data;
    },
  });
  const rawCatalog = catalogData as any;
  const catalogItems: { name: string; category: string | null }[] = rawCatalog?.data?.data || rawCatalog?.data || [];

  const services: Service[] = Array.isArray(servicesData) ? servicesData : [];
  const hasServices = services.length > 0;
  const jobSuggestions: string[] = Array.isArray(professionsData) ? professionsData : ((professionsData as any)?.data || []);

  // Filter catalog services by selected job titles (professions)
  const catalogServicesForJob = jobTitles.length > 0
    ? catalogItems.filter((s) => jobTitles.includes(s.category || ''))
    : catalogItems;

  const createMutation = useMutation({
    mutationFn: (data: { jobTitle?: string; serviceIds?: string[] }) =>
      api.post('/api/invite-codes', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invite-codes'] });
      setShowModal(false);
      setJobTitles([]);
      setCustomJobTitle('');
      setShowCustomInput(false);
      setSelectedServiceIds([]);
      setMaxUses(1);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/invite-codes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invite-codes'] });
    },
  });

  async function copyToClipboard(code: string, id: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {}
  }

  function toggleService(id: string) {
    setSelectedServiceIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }

  function toggleJobTitle(title: string) {
    setJobTitles((prev) => prev.includes(title) ? prev.filter((t) => t !== title) : [...prev, title]);
  }

  function handleSubmitCreate() {
    const finalJobTitle = jobTitles.length > 0 ? jobTitles.join(', ') : customJobTitle.trim();
    createMutation.mutate({
      jobTitle: finalJobTitle || undefined,
      serviceIds: selectedServiceIds.length > 0 ? selectedServiceIds : undefined,
      maxUses,
    });
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Códigos de Invitación</h1>
          <p className="text-sm text-gray-500 mt-1">
            Genera códigos para que tus empleados se registren en la plataforma
          </p>
        </div>
        {hasServices && (
          <button
            onClick={() => setShowModal(true)}
            className="btn-primary flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Generar código
          </button>
        )}
      </div>

      {!hasServices && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 bg-teal-50 rounded-full flex items-center justify-center mb-4">
            <svg className="w-7 h-7 text-[#008080]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
          <p className="text-gray-900 font-semibold mb-1">Crea tu primer servicio</p>
          <p className="text-sm text-gray-500 mb-5 max-w-xs">
            Para generar códigos de invitación necesitas tener al menos un servicio configurado
          </p>
          <Link
            href="/services?new=true"
            className="px-5 py-2.5 rounded-xl text-sm font-medium text-white transition-colors"
            style={{ backgroundColor: '#008080' }}
          >
            Crear servicio
          </Link>
        </div>
      )}

      {hasServices && <div className="bg-white rounded-xl border border-gray-200">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Cargando...</div>
        ) : !codes || codes.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            No hay códigos activos. Genera uno para empezar.
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {codes.map((code) => (
              <li key={code.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="bg-gray-100 px-3 py-1.5 rounded-lg flex-shrink-0">
                      <code className="text-lg font-mono font-bold tracking-widest text-gray-900">
                        {code.code}
                      </code>
                    </div>
                    <div>
                      {code.jobTitle && (
                        <p className="text-sm font-semibold text-gray-800 mb-0.5">{code.jobTitle}</p>
                      )}
                      <p className="text-sm text-gray-500">
                        Usos: {code.usedCount}
                        {code.maxUses > 0 ? ` / ${code.maxUses}` : ' (ilimitado)'}
                      </p>
                      <p className="text-xs text-gray-400">
                        Creado {dayjs(code.createdAt).format('D MMM YYYY')}
                        {code.expiresAt &&
                          ` · Expira ${dayjs(code.expiresAt).format('D MMM YYYY')}`}
                      </p>
                      {code.services && code.services.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {code.services.map((s) => (
                            <span key={s.service.id} className="text-[11px] bg-teal-50 text-[#008080] border border-teal-100 rounded-full px-2 py-0.5">
                              {s.service.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => copyToClipboard(code.code, code.id)}
                      className="px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      {copiedId === code.id ? '¡Copiado!' : 'Copiar'}
                    </button>
                    <button
                      onClick={() => deleteMutation.mutate(code.id)}
                      disabled={deleteMutation.isPending}
                      className="px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                    >
                      Desactivar
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>}

      {/* Modal crear código */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-gray-900">Nuevo código de invitación</h2>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Puestos (multi-select) */}
              <div className="mb-5">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Profesión(es)
                </label>
                <p className="text-xs text-gray-400 mb-2">Puedes seleccionar más de una</p>
                <div className="flex flex-wrap gap-2 mb-2">
                  {jobSuggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => { toggleJobTitle(s); setShowCustomInput(false); setCustomJobTitle(''); }}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        jobTitles.includes(s)
                          ? 'bg-[#008080] text-white'
                          : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setShowCustomInput(!showCustomInput)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      showCustomInput
                        ? 'bg-[#008080] text-white'
                        : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    + Personalizado
                  </button>
                </div>
                {showCustomInput && (
                  <input
                    type="text"
                    value={customJobTitle}
                    onChange={(e) => setCustomJobTitle(e.target.value)}
                    placeholder="Escribe el nombre del puesto"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#008080] focus:ring-1 focus:ring-[#008080]"
                  />
                )}
              </div>

              {/* Servicios */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Servicios que puede realizar
                </label>
                <p className="text-xs text-gray-400 mb-2">Puedes modificar esto después desde el perfil del empleado</p>
                {jobTitles.length === 0 && (
                  <p className="text-xs text-gray-400 mb-2">Selecciona primero una profesión para ver los servicios disponibles</p>
                )}
                <div className="border border-gray-200 rounded-xl max-h-60 overflow-y-auto">
                  {jobTitles.length > 0 ? (
                    <>
                      {jobTitles.sort((a, b) => a.localeCompare(b, 'es')).map((prof) => {
                        const profServices = catalogServicesForJob.filter((c) => c.category === prof);
                        return (
                          <div key={prof}>
                            <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 sticky top-0">
                              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{prof}</span>
                            </div>
                            {profServices.length > 0 ? profServices.sort((a, b) => a.name.localeCompare(b.name, 'es')).map((catalogSvc) => {
                              const bizService = services.find((s) => s.name === catalogSvc.name);
                              return (
                                <label key={`${prof}-${catalogSvc.name}`} className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50 border-b border-gray-50 ${!bizService ? 'opacity-40' : ''}`}>
                                  <input
                                    type="checkbox"
                                    checked={bizService ? selectedServiceIds.includes(bizService.id) : false}
                                    onChange={() => bizService && toggleService(bizService.id)}
                                    disabled={!bizService}
                                    className="h-4 w-4 rounded border-gray-300 text-[#008080] focus:ring-[#008080] disabled:opacity-30"
                                  />
                                  <span className="text-sm text-gray-700">{catalogSvc.name}</span>
                                  {!bizService && <span className="text-[10px] text-gray-400 ml-auto">No creado</span>}
                                </label>
                              );
                            }) : (
                              <div className="px-4 py-3 text-xs text-gray-400 text-center border-b border-gray-50">Sin servicios en catálogo</div>
                            )}
                          </div>
                        );
                      })}
                    </>
                  ) : (
                    <div className="px-4 py-6 text-xs text-gray-400 text-center">Selecciona una profesión arriba</div>
                  )}
                </div>
                {selectedServiceIds.length === 0 && jobTitles.length > 0 && (
                  <p className="text-xs text-amber-600 mt-1.5">Selecciona al menos un servicio para el empleado</p>
                )}
                <a
                  href="/services?new=true&returnTo=invite-codes"
                  target="_blank"
                  className="inline-flex items-center gap-1 text-xs text-[#008080] font-medium mt-2 hover:underline"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Crear nuevo servicio
                </a>
              </div>

              {/* Usos */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Número de usos
                </label>
                <input
                  type="number"
                  min="1"
                  value={maxUses}
                  onChange={(e) => setMaxUses(Math.max(1, Number(e.target.value) || 1))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#008080] focus:ring-1 focus:ring-[#008080]"
                />
                <p className="text-xs text-gray-400 mt-1">Cantidad de empleados que pueden usar este código para afiliarse a <span className="font-medium text-gray-600">{(tenantData as any)?.name || 'tu negocio'}</span></p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSubmitCreate}
                  disabled={createMutation.isPending || selectedServiceIds.length === 0}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-50"
                  style={{ backgroundColor: '#008080' }}
                  onMouseEnter={(e) => { if (!createMutation.isPending) e.currentTarget.style.backgroundColor = '#006666'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#008080'; }}
                >
                  {createMutation.isPending ? 'Generando...' : 'Generar código'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
