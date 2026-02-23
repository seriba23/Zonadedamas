'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import dayjs from 'dayjs';

interface InviteCode {
  id: string;
  code: string;
  maxUses: number;
  usedCount: number;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
}

export default function InviteCodesPage() {
  const queryClient = useQueryClient();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: codes, isLoading } = useQuery({
    queryKey: ['invite-codes'],
    queryFn: async () => {
      const res = await api.get<{ data: InviteCode[] }>('/api/invite-codes');
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: () => api.post('/api/invite-codes', {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invite-codes'] });
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
    } catch {
      // Fallback
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Códigos de Invitación
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Genera códigos para que tus empleados se registren en la plataforma
          </p>
        </div>
        <button
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending}
          className="btn-primary flex items-center gap-2"
        >
          {createMutation.isPending ? (
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          )}
          Generar código
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
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
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="bg-gray-100 px-3 py-1.5 rounded-lg">
                      <code className="text-lg font-mono font-bold tracking-widest text-gray-900">
                        {code.code}
                      </code>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">
                        Usos: {code.usedCount}
                        {code.maxUses > 0 ? ` / ${code.maxUses}` : ' (ilimitado)'}
                      </p>
                      <p className="text-xs text-gray-400">
                        Creado {dayjs(code.createdAt).format('D MMM YYYY')}
                        {code.expiresAt &&
                          ` · Expira ${dayjs(code.expiresAt).format('D MMM YYYY')}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => copyToClipboard(code.code, code.id)}
                      className="px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      {copiedId === code.id ? 'Copiado!' : 'Copiar'}
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
      </div>
    </div>
  );
}
