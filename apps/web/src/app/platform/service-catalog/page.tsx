'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { platformApi } from '@/lib/platform-auth';

interface CatalogItem {
  id: string;
  name: string;
  category: string | null;
  isActive: boolean;
}

const DEFAULT_CATEGORIES = ['Cabello', 'Barbería', 'Rostro', 'Cuerpo', 'Uñas'];

export default function ServiceCatalogPage() {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newCustomCategory, setNewCustomCategory] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editCategoryName, setEditCategoryName] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['platform-service-catalog'],
    queryFn: async () => {
      const res = await platformApi.get<{ data: CatalogItem[] }>('/api/platform/service-catalog');
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: (body: { name: string; category?: string }) => platformApi.post('/api/platform/service-catalog', body),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['platform-service-catalog'] }); setNewName(''); setNewCategory(''); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: string; name?: string; category?: string }) => platformApi.patch(`/api/platform/service-catalog/${id}`, body),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['platform-service-catalog'] }); setEditingId(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => platformApi.delete(`/api/platform/service-catalog/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platform-service-catalog'] }),
  });

  const renameCategoryMutation = useMutation({
    mutationFn: ({ oldName, newName }: { oldName: string; newName: string }) =>
      platformApi.patch('/api/platform/service-catalog/rename-category', { oldName, newName }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-service-catalog'] });
      setEditingCategory(null);
      setEditCategoryName('');
      if (filterCategory === editingCategory) setFilterCategory('');
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (categoryName: string) =>
      platformApi.delete(`/api/platform/service-catalog/category/${encodeURIComponent(categoryName)}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-service-catalog'] });
      setFilterCategory('');
    },
  });

  const items = data || [];

  // All unique categories (default + from data)
  const existingCategories = [...new Set(items.map((i) => i.category).filter(Boolean) as string[])];
  const allCategories = [...new Set([...DEFAULT_CATEGORIES, ...existingCategories])].sort((a, b) => a.localeCompare(b, 'es'));

  // Resolve new category (custom or selected)
  const resolvedNewCategory = newCategory === '__custom__' ? newCustomCategory.trim() : newCategory;

  // Group by category
  const grouped = items.reduce<Record<string, CatalogItem[]>>((acc, item) => {
    const cat = item.category || 'Sin categoría';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});
  const sortedCategories = Object.keys(grouped)
    .filter((cat) => !filterCategory || cat === filterCategory)
    .sort((a, b) => a.localeCompare(b, 'es'));

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Catalogo de Servicios</h1>
      <p className="text-sm text-gray-500 mb-6">Los negocios solo pueden ofrecer servicios de este catalogo. Esto evita duplicados y mantiene la busqueda organizada.</p>

      {/* Add new */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 space-y-3">
        <div className="flex gap-3 flex-wrap">
          <input
            type="text"
            placeholder="Nombre del servicio..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && newName.trim() && resolvedNewCategory) createMutation.mutate({ name: newName.trim(), category: resolvedNewCategory }); }}
            className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <select
            value={newCategory}
            onChange={(e) => { setNewCategory(e.target.value); if (e.target.value !== '__custom__') setNewCustomCategory(''); }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Categoría</option>
            {allCategories.map((c) => <option key={c} value={c}>{c}</option>)}
            <option value="__custom__">+ Nueva categoría</option>
          </select>
          {newCategory === '__custom__' && (
            <input
              type="text"
              placeholder="Nombre de la categoría..."
              value={newCustomCategory}
              onChange={(e) => setNewCustomCategory(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 min-w-[160px]"
            />
          )}
          <button
            onClick={() => { if (newName.trim() && resolvedNewCategory) createMutation.mutate({ name: newName.trim(), category: resolvedNewCategory }); }}
            disabled={!newName.trim() || !resolvedNewCategory || createMutation.isPending}
            className="px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 transition-colors"
            style={{ backgroundColor: '#008080' }}
          >
            {createMutation.isPending ? 'Agregando...' : 'Agregar'}
          </button>
        </div>
      </div>

      {/* Filter by category + edit/delete */}
      <div className="mb-4 flex items-center gap-3 flex-wrap">
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">Todas las categorías</option>
          {allCategories.map((cat) => (
            <option key={cat} value={cat}>{cat} ({grouped[cat]?.length || 0})</option>
          ))}
        </select>

        {filterCategory && editingCategory === filterCategory ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={editCategoryName}
              onChange={(e) => setEditCategoryName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && editCategoryName.trim()) renameCategoryMutation.mutate({ oldName: filterCategory, newName: editCategoryName.trim() }); if (e.key === 'Escape') setEditingCategory(null); }}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#008080]"
              autoFocus
            />
            <button
              onClick={() => renameCategoryMutation.mutate({ oldName: filterCategory, newName: editCategoryName.trim() })}
              disabled={!editCategoryName.trim() || renameCategoryMutation.isPending}
              className="px-3 py-1.5 text-xs font-medium text-white rounded-lg"
              style={{ backgroundColor: '#008080' }}
            >
              Guardar
            </button>
            <button onClick={() => setEditingCategory(null)} className="px-3 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg">
              Cancelar
            </button>
          </div>
        ) : filterCategory ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setEditingCategory(filterCategory); setEditCategoryName(filterCategory); }}
              className="text-xs text-[#008080] font-medium hover:underline"
            >
              Editar categoría
            </button>
            <button
              onClick={() => { if (confirm(`¿Eliminar la categoría "${filterCategory}" y todos sus ${grouped[filterCategory]?.length || 0} servicios?`)) deleteCategoryMutation.mutate(filterCategory); }}
              disabled={deleteCategoryMutation.isPending}
              className="text-xs text-red-500 font-medium hover:underline disabled:opacity-50"
            >
              Eliminar categoría
            </button>
          </div>
        ) : null}
      </div>

      {/* List grouped by category */}
      {isLoading ? (
        <div className="p-8 text-center text-gray-400">Cargando...</div>
      ) : items.length === 0 ? (
        <div className="p-8 text-center text-gray-400">No hay servicios en el catalogo</div>
      ) : (
        <div className="space-y-4">
          {sortedCategories.map((cat) => (
            <div key={cat} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-2.5 bg-gray-50 border-b border-gray-100">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{cat}</h3>
              </div>
              <ul className="divide-y divide-gray-100">
                {grouped[cat].map((item) => (
                  <li key={item.id} className="px-5 py-3 flex items-center justify-between gap-3">
                    {editingId === item.id ? (
                      <div className="flex-1 flex gap-2 flex-wrap">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') updateMutation.mutate({ id: item.id, name: editName.trim(), category: editCategory || undefined }); if (e.key === 'Escape') setEditingId(null); }}
                          className="flex-1 min-w-[150px] px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#008080]"
                          autoFocus
                        />
                        <select value={editCategory} onChange={(e) => setEditCategory(e.target.value)} className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm">
                          <option value="">Sin categoría</option>
                          {allCategories.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <button onClick={() => updateMutation.mutate({ id: item.id, name: editName.trim(), category: editCategory || undefined })} disabled={updateMutation.isPending} className="px-3 py-1.5 text-xs font-medium text-white rounded-lg" style={{ backgroundColor: '#008080' }}>Guardar</button>
                        <button onClick={() => setEditingId(null)} className="px-3 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg">Cancelar</button>
                      </div>
                    ) : (
                      <>
                        <span className="text-sm font-medium text-gray-900">{item.name}</span>
                        <div className="flex items-center gap-2">
                          <button onClick={() => { setEditingId(item.id); setEditName(item.name); setEditCategory(item.category || ''); }} className="text-xs text-[#008080] font-medium">Editar</button>
                          <button onClick={() => deleteMutation.mutate(item.id)} disabled={deleteMutation.isPending} className="text-xs text-red-500 font-medium disabled:opacity-50">Eliminar</button>
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-400 mt-3">{items.length} servicio{items.length !== 1 ? 's' : ''} en el catalogo.</p>
    </div>
  );
}
