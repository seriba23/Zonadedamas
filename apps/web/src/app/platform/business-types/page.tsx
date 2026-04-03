'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { platformApi } from '@/lib/platform-auth';

interface BusinessType {
  id: string;
  value: string;
  label: string;
  isActive: boolean;
}

export default function BusinessTypesPage() {
  const queryClient = useQueryClient();
  const [newValue, setNewValue] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editLabel, setEditLabel] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['platform-business-types'],
    queryFn: async () => {
      const res = await platformApi.get<{ data: BusinessType[] }>('/api/platform/business-types');
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: (body: { value: string; label: string }) => platformApi.post('/api/platform/business-types', body),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['platform-business-types'] }); setNewValue(''); setNewLabel(''); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: string; value?: string; label?: string }) => platformApi.patch(`/api/platform/business-types/${id}`, body),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['platform-business-types'] }); setEditingId(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => platformApi.delete(`/api/platform/business-types/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platform-business-types'] }),
  });

  const types = data || [];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Tipos de Negocio</h1>
      <p className="text-sm text-gray-500 mb-6">Define las categorias disponibles para los negocios que se registran en Siliba.</p>

      {/* Add new */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Clave (ej: PELUQUERIA)"
          value={newValue}
          onChange={(e) => setNewValue(e.target.value.toUpperCase())}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 w-40 uppercase"
        />
        <input
          type="text"
          placeholder="Nombre visible (ej: Peluquería)"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && newValue.trim() && newLabel.trim()) createMutation.mutate({ value: newValue.trim(), label: newLabel.trim() }); }}
          className="flex-1 min-w-[180px] px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <button
          onClick={() => { if (newValue.trim() && newLabel.trim()) createMutation.mutate({ value: newValue.trim(), label: newLabel.trim() }); }}
          disabled={!newValue.trim() || !newLabel.trim() || createMutation.isPending}
          className="px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50"
          style={{ backgroundColor: '#008080' }}
        >
          {createMutation.isPending ? 'Agregando...' : 'Agregar'}
        </button>
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Cargando...</div>
        ) : types.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No hay tipos de negocio</div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {types.map((bt) => (
              <li key={bt.id} className="px-5 py-3 flex items-center justify-between gap-3">
                {editingId === bt.id ? (
                  <div className="flex-1 flex gap-2 flex-wrap">
                    <input value={editValue} onChange={(e) => setEditValue(e.target.value.toUpperCase())}
                      className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm uppercase w-32 focus:outline-none focus:border-[#008080]" autoFocus />
                    <input value={editLabel} onChange={(e) => setEditLabel(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') updateMutation.mutate({ id: bt.id, value: editValue.trim(), label: editLabel.trim() }); if (e.key === 'Escape') setEditingId(null); }}
                      className="flex-1 min-w-[140px] px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#008080]" />
                    <button onClick={() => updateMutation.mutate({ id: bt.id, value: editValue.trim(), label: editLabel.trim() })} className="px-3 py-1.5 text-xs font-medium text-white rounded-lg" style={{ backgroundColor: '#008080' }}>Guardar</button>
                    <button onClick={() => setEditingId(null)} className="px-3 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg">Cancelar</button>
                  </div>
                ) : (
                  <>
                    <div>
                      <span className="text-sm font-medium text-gray-900">{bt.label}</span>
                      <span className="text-xs text-gray-400 ml-2 font-mono">{bt.value}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => { setEditingId(bt.id); setEditValue(bt.value); setEditLabel(bt.label); }} className="text-xs text-[#008080] font-medium">Editar</button>
                      <button onClick={() => deleteMutation.mutate(bt.id)} disabled={deleteMutation.isPending} className="text-xs text-red-500 font-medium disabled:opacity-50">Eliminar</button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
