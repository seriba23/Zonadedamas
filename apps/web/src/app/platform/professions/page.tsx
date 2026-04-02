'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { platformApi } from '@/lib/platform-auth';

interface Profession {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
}

export default function ProfessionsPage() {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['platform-professions'],
    queryFn: async () => {
      const res = await platformApi.get<{ data: Profession[] }>('/api/platform/professions');
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: (name: string) => platformApi.post('/api/platform/professions', { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-professions'] });
      setNewName('');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      platformApi.patch(`/api/platform/professions/${id}`, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-professions'] });
      setEditingId(null);
      setEditName('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => platformApi.delete(`/api/platform/professions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-professions'] });
    },
  });

  const professions = data || [];

  function startEdit(prof: Profession) {
    setEditingId(prof.id);
    setEditName(prof.name);
  }

  function saveEdit() {
    if (editingId && editName.trim()) {
      updateMutation.mutate({ id: editingId, name: editName.trim() });
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Catalogo de Profesiones</h1>
      <p className="text-sm text-gray-500 mb-6">Al editar una profesion, se actualizara automaticamente en todos los empleados que la tengan asignada.</p>

      {/* Add new */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex gap-3">
        <input
          type="text"
          placeholder="Nueva profesion (ej: Cosmetologo/a)..."
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && newName.trim()) createMutation.mutate(newName.trim()); }}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <button
          onClick={() => { if (newName.trim()) createMutation.mutate(newName.trim()); }}
          disabled={!newName.trim() || createMutation.isPending}
          className="px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 transition-colors"
          style={{ backgroundColor: '#008080' }}
        >
          {createMutation.isPending ? 'Agregando...' : 'Agregar'}
        </button>
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Cargando...</div>
        ) : professions.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No hay profesiones registradas</div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {professions.map((prof) => (
              <li key={prof.id} className="px-5 py-3 flex items-center justify-between gap-3">
                {editingId === prof.id ? (
                  <div className="flex-1 flex gap-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingId(null); }}
                      className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#008080] focus:ring-1 focus:ring-[#008080]"
                      autoFocus
                    />
                    <button
                      onClick={saveEdit}
                      disabled={updateMutation.isPending || !editName.trim()}
                      className="px-3 py-1.5 text-xs font-medium text-white rounded-lg disabled:opacity-50"
                      style={{ backgroundColor: '#008080' }}
                    >
                      {updateMutation.isPending ? '...' : 'Guardar'}
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="px-3 py-1.5 text-xs font-medium text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="text-sm font-medium text-gray-900">{prof.name}</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => startEdit(prof)}
                        className="text-xs text-[#008080] hover:text-[#006666] font-medium"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => deleteMutation.mutate(prof.id)}
                        disabled={deleteMutation.isPending}
                        className="text-xs text-red-500 hover:text-red-700 font-medium disabled:opacity-50"
                      >
                        Eliminar
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-xs text-gray-400 mt-3">
        {professions.length} profesion{professions.length !== 1 ? 'es' : ''} en el catalogo.
        Usa formato inclusivo: Barbero/a, Tatuador/a, Cosmetologo/a.
      </p>
    </div>
  );
}
