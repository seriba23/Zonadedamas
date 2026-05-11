'use client';

import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { usePermissions } from '@/lib/hooks/use-permissions';
import { ClientDrawer } from '@/components/clients/client-drawer';
import { formatDate } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Pagination } from '@/components/ui/pagination';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  avatarUrl?: string | null;
  tags?: Array<{ id: string; name: string; color: string }>;
  lastVisit?: string;
}

export default function ClientsPage() {
  const { hasPermission } = usePermissions();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const perPage = 20;

  // Debounce search
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  function handleSearchChange(value: string) {
    setSearch(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1);
    }, 400);
  }

  const params = new URLSearchParams({
    page: String(page),
    perPage: String(perPage),
    ...(debouncedSearch && { search: debouncedSearch }),
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['clients', page, debouncedSearch],
    queryFn: () =>
      api.get<{
        data: Client[];
        meta: { total: number; page: number; perPage: number; totalPages: number };
      }>(`/api/clients?${params.toString()}`),
  });

  const clients = data?.data || [];
  const meta = data?.meta;

  function openClient(client: Client) {
    setSelectedClientId(client.id);
    setIsDrawerOpen(true);
  }

  function closeDrawer() {
    setIsDrawerOpen(false);
    setSelectedClientId(null);
    refetch();
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Clientes" />

      <div className="flex-1 overflow-y-auto p-3 md:p-6">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-3 md:mb-6 flex-wrap gap-2">
          <div className="relative w-80">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Buscar clientes..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="input-field pl-10"
            />
          </div>

          {hasPermission('clients.create') && (
            <button
              onClick={() => {
                setSelectedClientId(null);
                setIsDrawerOpen(true);
              }}
              className="btn-primary"
            >
              + Nuevo Cliente
            </button>
          )}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Nombre
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Teléfono
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Tags
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Última visita
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : clients.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <p className="text-gray-500 text-sm">
                      {debouncedSearch
                        ? `No hay clientes que coincidan con "${debouncedSearch}"`
                        : 'No hay clientes aún'}
                    </p>
                    {!debouncedSearch && hasPermission('clients.create') && (
                      <button
                        onClick={() => setIsDrawerOpen(true)}
                        className="mt-3 btn-primary text-sm"
                      >
                        Agregar primer cliente
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                clients.map((client) => (
                  <tr
                    key={client.id}
                    onClick={() => openClient(client)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-semibold flex-shrink-0 overflow-hidden">
                          {client.avatarUrl ? (
                            <img src={`${API_URL}${client.avatarUrl}`} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <>{client.firstName.charAt(0)}{client.lastName.charAt(0)}</>
                          )}
                        </div>
                        <span className="text-sm font-medium text-gray-900">
                          {client.firstName} {client.lastName}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {client.email || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {client.phone || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {client.tags?.slice(0, 3).map((tag) => (
                          <span
                            key={tag.id}
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                            style={{
                              backgroundColor: tag.color + '20',
                              color: tag.color,
                            }}
                          >
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {client.lastVisit
                        ? formatDate(client.lastVisit)
                        : 'Sin visitas'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
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

      {isDrawerOpen && (
        <ClientDrawer
          clientId={selectedClientId}
          onClose={closeDrawer}
        />
      )}
    </div>
  );
}
