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

  const deleteMutation = useMutation({
    mutationFn: (id: string) => platformApi.delete(`/api/platform/professions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-professions'] });
    },
  });

  const professions = data || [];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Catalogo de Profesiones</h1>

      {/* Add new */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex gap-3">
        <input
          type="text"
          placeholder="Nueva profesion..."
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
              <li key={prof.id} className="px-5 py-3 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-900">{prof.name}</span>
                <button
                  onClick={() => deleteMutation.mutate(prof.id)}
                  disabled={deleteMutation.isPending}
                  className="text-xs text-red-500 hover:text-red-700 font-medium disabled:opacity-50"
                >
                  Eliminar
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-xs text-gray-400 mt-3">
        {professions.length} profesion{professions.length !== 1 ? 'es' : ''} en el catalogo.
        Los negocios solo pueden asignar puestos de esta lista.
      </p>
    </div>
  );
}
