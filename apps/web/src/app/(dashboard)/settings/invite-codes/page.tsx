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
  // maxUses como string para que el input pueda quedar vacío durante la
  // edición (en móvil no hay flechas para reemplazar el 1 por otro dígito).
  // Al perder foco, si quedó vacío o < 1, se normaliza a "1". El payload
  // hacia el backend se convierte a number en el submit.
  const [maxUses, setMaxUses] = useState<string>('1');

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
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/marketplace/service-catalog`);
      const json = await res.json();
      return json.data as { name: string; category: string | null }[];
    },
  });
  const catalogItems: { name: string; category: string | null }[] = catalogData || [];

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
      setMaxUses('1');
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

  function shareWhatsApp(code: string, jobTitle: string | null) {
    const tenantName = tenantData?.name || 'nuestro negocio';
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://siliba.com';
    const registerUrl = `${origin}/register?code=${encodeURIComponent(code)}`;
    const roleClause = jobTitle ? ` como ${jobTitle}` : '';
    const message =
      `Te invito a unirte a ${tenantName}${roleClause}.\n\n` +
      `Codigo: ${code}\n` +
      `Registra tu cuenta aqui: ${registerUrl}`;
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank', 'noopener');
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
      maxUses: Math.max(1, parseInt(maxUses, 10) || 1),
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
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white flex-shrink-0"
            style={{ backgroundColor: '#008080' }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.4}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Nuevo
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

      {hasServices && (
        <>
          {isLoading ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">Cargando...</div>
          ) : !codes || codes.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
              No hay códigos activos. Genera uno para empezar.
            </div>
          ) : (
            <div className="space-y-3">
              {codes.map((code) => (
                <div key={code.id} className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
                  {/* Header: codigo grande + jobTitle */}
                  <div className="flex items-start gap-3 mb-3">
                    <div className="bg-gray-100 px-3 py-1.5 rounded-lg flex-shrink-0">
                      <code className="text-base font-mono font-bold tracking-widest text-gray-900">
                        {code.code}
                      </code>
                    </div>
                    <div className="flex-1 min-w-0">
                      {code.jobTitle && (
                        <p className="text-sm font-semibold text-gray-800 truncate">{code.jobTitle}</p>
                      )}
                      <p className="text-xs text-gray-500">
                        Usos: {code.usedCount}
                        {code.maxUses > 0 ? ` / ${code.maxUses}` : ' (ilimitado)'}
                      </p>
                    </div>
                  </div>

                  {/* Meta: creado / expira */}
                  <p className="text-xs text-gray-400 mb-2">
                    Creado {dayjs(code.createdAt).format('D MMM YYYY')}
                    {code.expiresAt && ` · Expira ${dayjs(code.expiresAt).format('D MMM YYYY')}`}
                  </p>

                  {/* Servicios (chips) */}
                  {code.services && code.services.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {code.services.map((s) => (
                        <span key={s.service.id} className="text-[11px] bg-teal-50 text-[#008080] border border-teal-100 rounded-full px-2 py-0.5">
                          {s.service.name}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Acciones: en mobile ocupan toda la fila y wrappean; en desktop quedan en una linea */}
                  <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => copyToClipboard(code.code, code.id)}
                      className="flex-1 min-w-[80px] px-3 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      {copiedId === code.id ? '¡Copiado!' : 'Copiar'}
                    </button>
                    <button
                      onClick={() => shareWhatsApp(code.code, code.jobTitle)}
                      className="flex-1 min-w-[120px] px-3 py-2 text-sm font-medium text-white bg-[#25D366] hover:bg-[#1ebe57] rounded-lg transition-colors inline-flex items-center justify-center gap-1.5"
                      title="Compartir por WhatsApp"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.148-.669-1.611-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                      </svg>
                      WhatsApp
                    </button>
                    <button
                      onClick={() => deleteMutation.mutate(code.id)}
                      disabled={deleteMutation.isPending}
                      className="flex-1 min-w-[100px] px-3 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                    >
                      Desactivar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Modal crear código */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-start justify-between mb-5 gap-3">
                <h2 className="text-lg font-bold text-gray-900 flex-1 min-w-0">Nuevo código de invitación</h2>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 flex-shrink-0 mt-0.5">
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
                      {(() => {
                        const sorted = [...jobTitles].sort((a, b) => a.localeCompare(b, 'es'));
                        return sorted.map((prof) => {
                          // Siempre mostrar solo los servicios que el negocio
                          // tiene creados (decisión de producto: no listar
                          // "no creado" porque confunde). Si la profesión no
                          // tiene ninguno, mostrar empty state inline.
                          const enabled = catalogServicesForJob
                            .filter((c) => c.category === prof)
                            .filter((c) => services.find((s) => s.name === c.name));

                          return (
                            <div key={prof}>
                              {/* Header sticky con fondo SÓLIDO y z-index alto
                                  para no transparentarse encima de los items. */}
                              <div className="px-4 py-2 bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
                                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{prof}</span>
                              </div>
                              {enabled.length > 0 ? enabled.sort((a, b) => a.name.localeCompare(b.name, 'es')).map((catalogSvc) => {
                                const bizService = services.find((s) => s.name === catalogSvc.name)!;
                                return (
                                  <label key={`${prof}-${catalogSvc.name}`} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50 border-b border-gray-50">
                                    <input
                                      type="checkbox"
                                      checked={selectedServiceIds.includes(bizService.id)}
                                      onChange={() => toggleService(bizService.id)}
                                      className="h-4 w-4 rounded border-gray-300 text-[#008080] focus:ring-[#008080]"
                                    />
                                    <span className="text-sm text-gray-700">{catalogSvc.name}</span>
                                  </label>
                                );
                              }) : (
                                <div className="px-4 py-3 text-xs text-gray-400 text-center border-b border-gray-50">
                                  Aún no tienes servicios habilitados para esta profesión
                                </div>
                              )}
                            </div>
                          );
                        });
                      })()}
                    </>
                  ) : (
                    <div className="px-4 py-6 text-xs text-gray-400 text-center">Selecciona una profesión arriba</div>
                  )}
                </div>
                {selectedServiceIds.length === 0 && jobTitles.length > 0 && (
                  <p className="text-xs text-amber-600 mt-1.5">Selecciona al menos un servicio para el empleado</p>
                )}
                {jobTitles.length > 0 && (
                  <a
                    href={`/services?new=true&returnTo=invite-codes${jobTitles[0] ? `&profession=${encodeURIComponent(jobTitles[0])}` : ''}`}
                    target="_blank"
                    className="mt-3 w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border-2 border-dashed transition-colors hover:bg-teal-50"
                    style={{ borderColor: '#008080', color: '#008080' }}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    Crear nuevo servicio
                  </a>
                )}
              </div>

              {/* Usos */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Número de usos
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  min="1"
                  value={maxUses}
                  // Acepta cualquier dígito o vacío durante la edición; al
                  // perder foco se normaliza a un entero >= 1 para no
                  // dejar el campo vacío al enviar.
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^\d]/g, '');
                    setMaxUses(v);
                  }}
                  onBlur={() => {
                    const n = parseInt(maxUses, 10);
                    if (!Number.isFinite(n) || n < 1) setMaxUses('1');
                    else setMaxUses(String(n));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#008080] focus:ring-1 focus:ring-[#008080]"
                />
                <p className="text-xs text-gray-400 mt-1">Este número corresponde a la cantidad de empleados que pueden usar este código para afiliarse a <span className="font-medium text-gray-600">{(tenantData as any)?.name || 'tu negocio'}</span></p>
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
