'use client';

import { useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { usePermissions } from '@/lib/hooks/use-permissions';
import { useRegisterTopbarAction } from '@/lib/hooks/use-topbar-action';
import { ClientDrawer } from '@/components/clients/client-drawer';
import { Pagination } from '@/components/ui/pagination';
import { Avatar } from '@/components/ui/avatar';

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  avatarUrl?: string | null;
}

function sanitizePhone(raw: string): string {
  return raw.replace(/[^\d+]/g, '');
}

export default function ClientsPage() {
  const router = useRouter();
  // clientsBase: la misma página se usa en /clients (admin) y /employee/clients
  // (freelancer). Navegamos al detalle/volver según dónde estemos, para no sacar
  // al freelancer de su portal (el layout admin lo redirige a /employee).
  const pathname = usePathname();
  const clientsBase = pathname?.startsWith('/employee') ? '/employee/clients' : '/clients';
  const { hasPermission } = usePermissions();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const perPage = 20;

  // ── Búsqueda avanzada (panel de filtros) ──
  // filters: filtros APLICADOS (alimentan la query). draft: lo que se edita en
  // el panel antes de pulsar "Aplicar".
  const emptyFilters = { email: '', phone: '', createdAfter: '', createdBefore: '' };
  const [filters, setFilters] = useState(emptyFilters);
  const [draft, setDraft] = useState(emptyFilters);
  const [showFilters, setShowFilters] = useState(false);
  // Nº de filtros activos (para el punto rojo del icono).
  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  function openFilters() { setDraft(filters); setShowFilters(true); }
  function applyFilters() { setFilters(draft); setPage(1); setShowFilters(false); }
  function clearFilters() { setFilters(emptyFilters); setDraft(emptyFilters); setPage(1); setShowFilters(false); }

  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  function handleSearchChange(value: string) {
    setSearch(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1);
    }, 400);
  }

  useRegisterTopbarAction(
    hasPermission('clients.create') ? (
      <button
        onClick={() => setIsCreateOpen(true)}
        className="px-3 md:px-3.5 py-1.5 text-xs md:text-sm font-semibold rounded-lg bg-[#008080] text-white hover:bg-[#006666] transition-colors whitespace-nowrap"
      >
        Nuevo
      </button>
    ) : null,
    [hasPermission('clients.create')],
  );

  const params = new URLSearchParams({
    page: String(page),
    perPage: String(perPage),
    ...(debouncedSearch && { search: debouncedSearch }),
    ...(filters.email && { email: filters.email }),
    ...(filters.phone && { phone: filters.phone }),
    ...(filters.createdAfter && { createdAfter: filters.createdAfter }),
    ...(filters.createdBefore && { createdBefore: filters.createdBefore }),
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['clients', page, debouncedSearch, filters.email, filters.phone, filters.createdAfter, filters.createdBefore],
    queryFn: () =>
      api.get<{
        data: Client[];
        meta: { total: number; page: number; perPage: number; totalPages: number };
      }>(`/api/clients?${params.toString()}`),
  });

  const clients = data?.data || [];
  const meta = data?.meta;

  function closeCreate() {
    setIsCreateOpen(false);
    refetch();
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-3 md:p-6">
        {/* Buscador estilo marketplace + icono de filtros (búsqueda avanzada) */}
        <div className="mb-4 md:mb-6 max-w-2xl">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Buscar cliente por nombre, email o teléfono..."
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-[13px] bg-white focus:outline-none focus:ring-2 focus:border-transparent"
                style={{ ['--tw-ring-color' as any]: '#008080' }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#008080';
                  e.currentTarget.style.boxShadow = '0 0 0 2px rgba(0,128,128,0.25)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#e5e7eb';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
            </div>
            {/* Icono de filtros: abre el panel de búsqueda avanzada. */}
            <button
              type="button"
              onClick={openFilters}
              title="Búsqueda avanzada"
              aria-label="Búsqueda avanzada"
              className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 relative transition-colors"
              style={activeFilterCount > 0
                ? { backgroundColor: '#008080', color: 'white', border: '1.5px solid #008080' }
                : { backgroundColor: 'white', color: '#6b7280', border: '1.5px solid #e5e7eb' }
              }
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
              </svg>
              {activeFilterCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white" />
              )}
            </button>
          </div>
        </div>

        {/* Lista de tarjetas */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse h-16"
              />
            ))}
          </div>
        ) : clients.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <p className="text-gray-500 text-sm">
              {debouncedSearch
                ? `No hay clientes que coincidan con "${debouncedSearch}"`
                : 'No hay clientes aún'}
            </p>
            {!debouncedSearch && hasPermission('clients.create') && (
              <button
                onClick={() => setIsCreateOpen(true)}
                className="mt-3 px-3.5 py-1.5 text-sm font-semibold rounded-lg bg-[#008080] text-white hover:bg-[#006666] transition-colors"
              >
                Agregar primer cliente
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {clients.map((client) => {
              const phoneRaw = client.phone || '';
              const phoneClean = sanitizePhone(phoneRaw);
              const hasPhone = phoneClean.length > 0;
              const hasEmail = !!client.email;

              return (
                <div
                  key={client.id}
                  onClick={() => router.push(`${clientsBase}/${client.id}`)}
                  className="bg-white rounded-xl border border-gray-200 hover:border-[#008080] hover:shadow-sm transition-all p-3 cursor-pointer flex items-center gap-3"
                >
                  <Avatar
                    avatarUrl={client.avatarUrl}
                    firstName={client.firstName}
                    lastName={client.lastName}
                    className="w-11 h-11"
                    textClassName="text-sm"
                  />

                  {/* Nombre + distintivo de cliente vinculado a la plataforma */}
                  <div className="flex-1 min-w-0 flex items-center gap-1.5">
                    <span className="text-sm font-medium text-gray-900 truncate">
                      {client.firstName} {client.lastName}
                    </span>
                    {(client as any).userId && (
                      <span className="flex-shrink-0 inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: '#e4f5ee', color: '#0a7d54' }} title="Cuenta de la plataforma vinculada">
                        <span className="w-1 h-1 rounded-full" style={{ backgroundColor: '#12a86e' }} />
                        Plataforma
                      </span>
                    )}
                  </div>

                  {/* Iconos de contacto */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {/* Teléfono */}
                    <a
                      href={hasPhone ? `tel:${phoneClean}` : undefined}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!hasPhone) e.preventDefault();
                      }}
                      title={hasPhone ? `Llamar a ${phoneRaw}` : 'Sin teléfono'}
                      className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                        hasPhone
                          ? 'bg-[var(--primary-tint)] text-[var(--primary-tint-fg)] hover:bg-[#008080] hover:text-white'
                          : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                      }`}
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"
                        />
                      </svg>
                    </a>

                    {/* WhatsApp */}
                    <a
                      href={hasPhone ? `https://wa.me/${phoneClean.replace(/^\+/, '')}` : undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!hasPhone) e.preventDefault();
                      }}
                      title={hasPhone ? `WhatsApp a ${phoneRaw}` : 'Sin teléfono'}
                      className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                        hasPhone
                          ? 'bg-[var(--primary-tint)] text-[var(--primary-tint-fg)] hover:bg-[#008080] hover:text-white'
                          : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                      }`}
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                      </svg>
                    </a>

                    {/* Correo */}
                    <a
                      href={hasEmail ? `mailto:${client.email}` : undefined}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!hasEmail) e.preventDefault();
                      }}
                      title={hasEmail ? `Enviar correo a ${client.email}` : 'Sin correo'}
                      className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                        hasEmail
                          ? 'bg-[var(--primary-tint)] text-[var(--primary-tint-fg)] hover:bg-[#008080] hover:text-white'
                          : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                      }`}
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
                        />
                      </svg>
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Paginación */}
        {meta && meta.total > perPage && (
          <div className="mt-4">
            <Pagination
              total={meta.total}
              page={meta.page}
              perPage={meta.perPage}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>

      {/* Drawer solo para crear nuevo cliente desde la lista */}
      {isCreateOpen && (
        <ClientDrawer clientId={null} onClose={closeCreate} />
      )}

      {/* Panel de búsqueda avanzada (bottom-sheet, mismo patrón que el marketplace) */}
      {showFilters && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ touchAction: 'none' }}>
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowFilters(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-t-2xl shadow-xl pb-safe">
            <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 bg-gray-300 rounded-full" /></div>
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">Búsqueda avanzada</h3>
              <button onClick={() => setShowFilters(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">
                <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Email</label>
                <input
                  type="text"
                  value={draft.email}
                  onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
                  placeholder="Contiene…"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-[#008080]/30 focus:border-[#008080]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Teléfono</label>
                <input
                  type="text"
                  value={draft.phone}
                  onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
                  placeholder="Contiene…"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-[#008080]/30 focus:border-[#008080]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Cliente desde</label>
                  <input
                    type="date"
                    value={draft.createdAfter}
                    onChange={(e) => setDraft((d) => ({ ...d, createdAfter: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-[#008080]/30 focus:border-[#008080]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Cliente hasta</label>
                  <input
                    type="date"
                    value={draft.createdBefore}
                    onChange={(e) => setDraft((d) => ({ ...d, createdBefore: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-[#008080]/30 focus:border-[#008080]"
                  />
                </div>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-gray-100 flex items-center gap-2">
              <button
                onClick={clearFilters}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Limpiar
              </button>
              <button
                onClick={applyFilters}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-[#008080] text-white hover:bg-[#006666] transition-colors"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
