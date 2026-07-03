// ============================================================
// ARCHIVO: apps/web/src/app/platform/service-catalog/page.tsx
// RUTA EN EL NAVEGADOR: /platform/service-catalog
//
// Página de gestión del CATÁLOGO GLOBAL DE SERVICIOS de la plataforma.
//
// ¿QUÉ ES EL CATÁLOGO DE SERVICIOS?
// Es una lista maestra de servicios que los negocios SOLO pueden
// elegir (no inventar libremente). Esto garantiza uniformidad
// y mejora la búsqueda en el marketplace. Ejemplos: "Corte de
// cabello", "Depilación con cera", "Manicure rusa".
//
// Los servicios se agrupan por CATEGORÍA. Las categorías provienen
// de la tabla de Profesiones (ej: "Barbero/a", "Estilista").
//
// ¿QUÉ MUESTRA?
// - Botón "Agregar servicio" → abre un Modal
// - Buscador de texto libre (filtra por nombre y categoría)
// - Botón de filtros → Modal con selector de categoría y gestión de categorías
// - Lista agrupada por categoría, con edición inline por ítem
//
// ¿QUÉ HACE? (CRUD completo)
//   GET    /api/platform/service-catalog                          → listar
//   POST   /api/platform/service-catalog                         → crear
//   PATCH  /api/platform/service-catalog/:id                     → editar nombre/categoría
//   DELETE /api/platform/service-catalog/:id                     → eliminar ítem
//   PATCH  /api/platform/service-catalog/rename-category         → renombrar categoría entera
//   DELETE /api/platform/service-catalog/category/:name          → eliminar categoría + servicios
//
// CONCEPTOS AVANZADOS:
// - useMemo equivalente manual (filtrado y agrupación calculados en el render)
// - Fuente de categorías combinada: profesiones de DB + categorías existentes en items
// - Modal reutilizable para agregar y para gestionar filtros/categorías
// ============================================================

// 'use client': usa hooks de React y React Query → navegador.
'use client';

// useState: para múltiples estados locales (formularios, filtros, edición, modales).
import { useState } from 'react';

// useQuery, useMutation, useQueryClient: React Query para lectura y escritura.
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// platformApi: cliente HTTP del Super Admin.
import { platformApi } from '@/lib/platform-auth';

// Modal: componente de UI reutilizable para ventanas emergentes.
import { Modal } from '@/components/ui/modal';

// ─── TIPOS ───────────────────────────────────────────────

// CatalogItem: forma de cada ítem del catálogo.
interface CatalogItem {
  id: string;              // CUID único.
  name: string;            // Nombre del servicio (ej: "Corte de cabello").
  category: string | null; // Categoría/profesión a la que pertenece. Puede ser null.
  description: string | null; // Descripción por defecto (se precarga al crear un servicio).
  isActive: boolean;       // Si el servicio está activo.
}

// No defaults — categories come from professions in DB
// Las categorías NO se definen aquí; vienen de la tabla Profession en la base de datos.
// Este arreglo vacío es el punto de partida antes de combinar con las fuentes reales.
const DEFAULT_CATEGORIES: string[] = [];

// Componente principal del Catálogo de Servicios.
export default function ServiceCatalogPage() {
  // queryClient: acceso al caché de React Query para invalidaciones.
  const queryClient = useQueryClient();

  // ── ESTADOS DEL FORMULARIO DE ALTA (Modal "Agregar servicio") ─
  const [newName, setNewName] = useState('');            // Nombre del nuevo servicio.
  const [newCategory, setNewCategory] = useState('');    // Categoría seleccionada en el dropdown.
  // newCustomCategory: si el usuario elige "+ Nueva categoría", escribe aquí.
  const [newCustomCategory, setNewCustomCategory] = useState('');

  // ── ESTADOS DE EDICIÓN INLINE ─────────────────────────
  // editingId: ID del ítem actualmente en edición. null = ninguno.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');           // Nombre en edición.
  const [editCategory, setEditCategory] = useState('');   // Categoría en edición.
  const [editDescription, setEditDescription] = useState(''); // Descripción por defecto en edición.

  // ── ESTADOS DE FILTROS Y BÚSQUEDA ─────────────────────
  // filterCategory: categoría seleccionada en el modal de filtros. '' = todas.
  const [filterCategory, setFilterCategory] = useState('');
  // searchQuery: texto escrito en el buscador libre.
  const [searchQuery, setSearchQuery] = useState('');

  // ── ESTADOS PARA RENOMBRAR/ELIMINAR CATEGORÍA ─────────
  // editingCategory: nombre de la categoría que se está renombrando. null = ninguna.
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  // editCategoryName: nuevo nombre de la categoría en edición.
  const [editCategoryName, setEditCategoryName] = useState('');

  // ── ESTADOS DE VISIBILIDAD DE MODALES ─────────────────
  const [showFilters, setShowFilters] = useState(false);    // ¿Mostrar modal de filtros?
  const [showAddModal, setShowAddModal] = useState(false);  // ¿Mostrar modal de agregar?

  // ── LECTURA: CATÁLOGO ─────────────────────────────────
  // Obtiene todos los ítems del catálogo de servicios.
  const { data, isLoading } = useQuery({
    queryKey: ['platform-service-catalog'],
    queryFn: async () => {
      const res = await platformApi.get<{ data: CatalogItem[] }>('/api/platform/service-catalog');
      return res.data;
    },
  });

  // Profesiones de la tabla Profession (fuente de verdad de categorias).
  // Asi cuando agregas "Lashista" en /platform/professions aparece como
  // opcion en el dropdown de categoria al crear plantillas aqui.
  // ── LECTURA: PROFESIONES (fuente de categorías) ───────
  // Se piden en paralelo con el catálogo. Su lista de nombres
  // se usa como opciones de categoría en el dropdown del formulario.
  const { data: professionsList } = useQuery({
    queryKey: ['platform-professions-list'],
    queryFn: async () => {
      const res = await platformApi.get<{ data: { id: string; name: string }[] }>('/api/platform/professions');
      return res.data;
    },
  });

  // ── MUTACIÓN: CREAR ÍTEM ──────────────────────────────
  const createMutation = useMutation({
    mutationFn: (body: { name: string; category?: string }) =>
      platformApi.post('/api/platform/service-catalog', body),
    onSuccess: () => {
      // Invalida el caché para recargar la lista.
      queryClient.invalidateQueries({ queryKey: ['platform-service-catalog'] });
      // Limpia todos los campos del formulario de alta.
      setNewName('');
      setNewCategory('');
      setNewCustomCategory('');
      setShowAddModal(false); // Cierra el modal.
    },
  });

  // ── MUTACIÓN: ACTUALIZAR ÍTEM ─────────────────────────
  // "{ id, ...body }": desestructura id y agrupa el resto en body.
  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: string; name?: string; category?: string; description?: string }) =>
      platformApi.patch(`/api/platform/service-catalog/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-service-catalog'] });
      setEditingId(null); // Sale del modo edición.
    },
  });

  // ── MUTACIÓN: ELIMINAR ÍTEM ───────────────────────────
  const deleteMutation = useMutation({
    mutationFn: (id: string) => platformApi.delete(`/api/platform/service-catalog/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platform-service-catalog'] }),
  });

  // ── MUTACIÓN: RENOMBRAR CATEGORÍA ─────────────────────
  // Cambia el nombre de UNA categoría en TODOS los ítems que la tengan.
  const renameCategoryMutation = useMutation({
    mutationFn: ({ oldName, newName }: { oldName: string; newName: string }) =>
      platformApi.patch('/api/platform/service-catalog/rename-category', { oldName, newName }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-service-catalog'] });
      setEditingCategory(null);   // Sale del modo edición de categoría.
      setEditCategoryName('');    // Limpia el campo.
      // Si el filtro activo era la categoría renombrada, limpia el filtro
      // (ya no existe con ese nombre).
      if (filterCategory === editingCategory) setFilterCategory('');
    },
  });

  // ── MUTACIÓN: ELIMINAR CATEGORÍA ─────────────────────
  // Elimina todos los ítems de una categoría de una sola vez.
  // encodeURIComponent: codifica caracteres especiales para la URL (ej: espacios → %20).
  const deleteCategoryMutation = useMutation({
    mutationFn: (categoryName: string) =>
      platformApi.delete(`/api/platform/service-catalog/category/${encodeURIComponent(categoryName)}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-service-catalog'] });
      setFilterCategory(''); // Limpia el filtro porque la categoría ya no existe.
    },
  });

  // ── CÁLCULOS DERIVADOS ────────────────────────────────

  // items: todos los ítems del catálogo, o [] si aún no cargó.
  const items = data || [];

  // professionNames: solo los nombres de las profesiones (sin id ni isActive).
  // (professionsList || []): si aún no cargó, usa arreglo vacío.
  // .map((p) => p.name): extrae solo la propiedad "name" de cada objeto.
  const professionNames = (professionsList || []).map((p) => p.name);

  // Unifica categorias: profesiones de DB (fuente principal) + categorias
  // ya presentes en items del catalogo (compat con historicas).
  // existingCategories: categorías únicas ya presentes en los ítems del catálogo.
  // "new Set(...)": elimina duplicados.
  // .filter(Boolean): elimina valores null/undefined/'' del arreglo.
  // "as string[]": TypeScript necesita saber que son strings (filter no lo infiere).
  const existingCategories = [...new Set(items.map((i) => i.category).filter(Boolean) as string[])];

  // allCategories: unión de todas las fuentes, sin duplicados, ordenadas alfabéticamente en español.
  // "new Set([...A, ...B, ...C])": fusiona los tres arreglos y elimina duplicados.
  // .sort((a, b) => a.localeCompare(b, 'es')): ordena respetando el alfabeto español.
  const allCategories = [...new Set([...professionNames, ...DEFAULT_CATEGORIES, ...existingCategories])]
    .sort((a, b) => a.localeCompare(b, 'es'));

  // Resolve new category (custom or selected)
  // resolvedNewCategory: la categoría real que se enviará al backend.
  // Si el usuario eligió "__custom__" en el dropdown, usa el texto personalizado;
  // si no, usa la categoría seleccionada del dropdown.
  // El operador ternario: condición ? valor_verdadero : valor_falso.
  const resolvedNewCategory = newCategory === '__custom__' ? newCustomCategory.trim() : newCategory;

  // Filtrado por busqueda libre (match en name + category, case-insensitive).
  // normalizedQuery: el texto de búsqueda en minúsculas y sin espacios extra.
  const normalizedQuery = searchQuery.trim().toLowerCase();

  // filteredItems: ítems que coinciden con la búsqueda de texto.
  // Si normalizedQuery está vacío (no hay búsqueda), muestra todos.
  // Si hay búsqueda, filtra los ítems donde "haystack" incluye el término.
  const filteredItems = !normalizedQuery
    ? items
    : items.filter((i) => {
        // hay (haystack): concatena nombre + categoría en minúsculas para buscar en ambos.
        const hay = `${i.name} ${i.category || ''}`.toLowerCase();
        // .includes(normalizedQuery): verdadero si el texto de búsqueda aparece en "hay".
        return hay.includes(normalizedQuery);
      });

  // Group by category
  // grouped: objeto cuyas claves son categorías y valores son arreglos de ítems.
  // Ej: { "Barbero/a": [item1, item2], "Estilista": [item3] }
  // .reduce(): recorre filteredItems y va construyendo el objeto agrupado.
  // acc (accumulator): el objeto en construcción.
  // item: el ítem actual de la iteración.
  const grouped = filteredItems.reduce<Record<string, CatalogItem[]>>((acc, item) => {
    // Si item.category es null, agrupa bajo 'Sin categoría'.
    const cat = item.category || 'Sin categoría';
    // Si esta categoría aún no existe en acc, crea un arreglo vacío.
    if (!acc[cat]) acc[cat] = [];
    // Agrega el ítem al arreglo de su categoría.
    acc[cat].push(item);
    return acc; // Devuelve el accumulator para la próxima iteración.
  }, {}); // El {} es el valor inicial del accumulator.

  // sortedCategories: las claves de grouped (nombres de categorías),
  // filtradas si hay un filterCategory activo, y ordenadas en español.
  const sortedCategories = Object.keys(grouped)
    // Si filterCategory tiene valor, solo muestra esa categoría;
    // si está vacío (''), muestra todas (!filterCategory = true = no filtra).
    .filter((cat) => !filterCategory || cat === filterCategory)
    .sort((a, b) => a.localeCompare(b, 'es'));

  // ── RENDERIZADO ──────────────────────────────────────────
  return (
    <div>
      {/* Cabecera con título y botón "Agregar servicio" */}
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Catalogo de Servicios</h1>
          <p className="text-sm text-gray-500">Los negocios solo pueden ofrecer servicios de este catalogo. Esto evita duplicados y mantiene la busqueda organizada.</p>
        </div>
        {/* Botón que abre el modal de agregar servicio.
            "shrink-0": no se encoge en pantallas pequeñas. */}
        <button
          onClick={() => setShowAddModal(true)}
          className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white rounded-lg"
          style={{ backgroundColor: '#008080' }}
        >
          {/* Ícono "+" */}
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          {/* "hidden sm:inline": en móvil oculta el texto, en sm (≥640px) lo muestra. */}
          <span className="hidden sm:inline">Agregar servicio</span>
        </button>
      </div>

      {/* Modal: agregar servicio */}
      {/* Solo se renderiza si showAddModal es true. */}
      {showAddModal && (
        // Modal es un componente de UI que dibuja una ventana emergente centrada.
        // title: texto de la cabecera del modal.
        // onClose: función para cerrar el modal (al hacer clic en X o fuera).
        // size: tamaño predefinido del modal.
        <Modal title="Agregar servicio" onClose={() => setShowAddModal(false)} size="md">
          <div className="space-y-3">
            {/* Campo de nombre del servicio.
                autoFocus: el cursor se pone aquí al abrir el modal.
                onKeyDown con Enter: permite crear con la tecla Enter si hay datos válidos. */}
            <input
              type="text"
              placeholder="Nombre del servicio..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newName.trim() && resolvedNewCategory)
                  createMutation.mutate({ name: newName.trim(), category: resolvedNewCategory });
              }}
              autoFocus
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#008080]"
            />
            {/* Dropdown de categoría. Las opciones son las categorías calculadas en allCategories.
                La última opción '__custom__' permite ingresar una categoría nueva a mano. */}
            <select
              value={newCategory}
              onChange={(e) => {
                setNewCategory(e.target.value);
                // Si selecciona una opción que NO es '__custom__', limpia el campo de categoría custom.
                if (e.target.value !== '__custom__') setNewCustomCategory('');
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#008080]"
            >
              <option value="">Categoría</option>
              {/* .map(): genera una opción por cada categoría disponible.
                  key={c} y value={c}: la clave y el valor del option son el nombre de la categoría. */}
              {allCategories.map((c) => <option key={c} value={c}>{c}</option>)}
              {/* Opción especial para crear una categoría nueva. */}
              <option value="__custom__">+ Nueva categoría</option>
            </select>
            {/* Campo de categoría personalizada: solo aparece si se eligió '__custom__'. */}
            {newCategory === '__custom__' && (
              <input
                type="text"
                placeholder="Nombre de la categoría..."
                value={newCustomCategory}
                onChange={(e) => setNewCustomCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#008080]"
              />
            )}
            {/* Botones de acción del modal */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (newName.trim() && resolvedNewCategory)
                    createMutation.mutate({ name: newName.trim(), category: resolvedNewCategory });
                }}
                // Desactivado si falta nombre, categoría, o la mutación está en curso.
                // "!newName.trim()": true si el campo está vacío.
                // "!resolvedNewCategory": true si no se seleccionó/escribió categoría.
                disabled={!newName.trim() || !resolvedNewCategory || createMutation.isPending}
                className="flex-1 px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50"
                style={{ backgroundColor: '#008080' }}
              >
                {createMutation.isPending ? 'Agregando...' : 'Agregar'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Buscador + ícono de filtros */}
      {/* Barra de búsqueda libre + botón de filtros. */}
      <div className="mb-4 flex items-center gap-2">
        {/* Contenedor con posición relativa para el ícono y el botón X dentro del input. */}
        <div className="relative flex-1">
          {/* Ícono de lupa: posicionado absolutamente dentro del input.
              "pointer-events-none": el ícono no captura clics (los clics van al input). */}
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {/* Input de búsqueda.
              "pl-9": padding-left de 36px para dejar espacio a la lupa.
              "pr-9": padding-right de 36px para dejar espacio al botón X. */}
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nombre o categoría..."
            className="w-full pl-9 pr-9 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#008080]"
          />
          {/* Botón X para limpiar la búsqueda. Solo aparece si hay texto escrito. */}
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Limpiar búsqueda"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 flex items-center justify-center"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        {/* Botón de filtros (ícono de embudo).
            Se pone en teal si hay un filtro de categoría activo (filterCategory no es ''). */}
        <button
          type="button"
          onClick={() => setShowFilters(true)}
          aria-label="Filtros"
          className={`shrink-0 p-2.5 rounded-lg border transition-colors ${
            filterCategory
              ? 'bg-[#008080] border-[#008080] text-white'  // Activo: teal
              : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50' // Inactivo: blanco
          }`}
        >
          {/* Ícono de embudo (funnel) */}
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
        </button>
      </div>

      {/* Modal de filtros (categoría + gestión de categoría) */}
      {/* Modal de filtros: seleccionar categoría y gestionar (renombrar/eliminar) la seleccionada. */}
      {showFilters && (
        <Modal title="Filtros" onClose={() => setShowFilters(false)} size="sm">
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Categoría</label>
              {/* Dropdown para filtrar por categoría.
                  "grouped[cat]?.length || 0": muestra el conteo de ítems por categoría.
                  "?.": operador de acceso opcional, por si la categoría no existe en grouped. */}
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#008080]"
              >
                <option value="">Todas las categorías</option>
                {allCategories.map((cat) => (
                  // Muestra nombre + conteo de ítems entre paréntesis.
                  <option key={cat} value={cat}>{cat} ({grouped[cat]?.length || 0})</option>
                ))}
              </select>
            </div>

            {/* Gestión de la categoría seleccionada */}
            {/* Solo se muestra si hay una categoría seleccionada en el filtro. */}
            {filterCategory && (
              <div className="border-t border-gray-100 pt-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Gestionar "{filterCategory}"</p>
                {/* Si se está editando ESTA categoría (editingCategory === filterCategory),
                    muestra el formulario de renombrar; si no, muestra los botones de acción. */}
                {editingCategory === filterCategory ? (
                  // ── MODO EDICIÓN DE CATEGORÍA ──────────────
                  <div className="space-y-2">
                    {/* Campo para el nuevo nombre de la categoría. */}
                    <input
                      type="text"
                      value={editCategoryName}
                      onChange={(e) => setEditCategoryName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && editCategoryName.trim())
                          renameCategoryMutation.mutate({ oldName: filterCategory, newName: editCategoryName.trim() });
                        if (e.key === 'Escape') setEditingCategory(null);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#008080]"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => renameCategoryMutation.mutate({ oldName: filterCategory, newName: editCategoryName.trim() })}
                        disabled={!editCategoryName.trim() || renameCategoryMutation.isPending}
                        className="px-3 py-1.5 text-xs font-medium text-white rounded-lg disabled:opacity-50"
                        style={{ backgroundColor: '#008080' }}
                      >
                        Guardar
                      </button>
                      <button onClick={() => setEditingCategory(null)} className="px-3 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg">Cancelar</button>
                    </div>
                  </div>
                ) : (
                  // ── MODO LECTURA DE CATEGORÍA ────────────
                  <div className="flex items-center gap-3">
                    {/* Botón Editar categoría: activa modo edición y pre-rellena el campo. */}
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
                )}
              </div>
            )}

            {/* Botones Limpiar y Aplicar del modal de filtros. */}
            <div className="flex gap-2 pt-2">
              {/* Limpiar: resetea el filtro de categoría y sale del modo edición de categoría. */}
              <button onClick={() => { setFilterCategory(''); setEditingCategory(null); }}
                className="flex-1 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                Limpiar
              </button>
              {/* Aplicar: solo cierra el modal (el filtro ya se aplicó en tiempo real). */}
              <button onClick={() => setShowFilters(false)}
                className="flex-1 py-2 text-sm font-medium text-white rounded-lg" style={{ backgroundColor: '#008080' }}>
                Aplicar
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* List grouped by category */}
      {/* Renderizado condicional en cascada (múltiples condiciones):
          1. isLoading → cargando
          2. Sin ítems en el catálogo → mensaje vacío
          3. Sin coincidencias con la búsqueda → mensaje de búsqueda sin resultados
          4. Con datos → lista agrupada por categoría */}
      {isLoading ? (
        <div className="p-8 text-center text-gray-400">Cargando...</div>
      ) : items.length === 0 ? (
        <div className="p-8 text-center text-gray-400">No hay servicios en el catalogo</div>
      ) : filteredItems.length === 0 ? (
        <div className="p-8 text-center text-gray-400">
          {/* Muestra el texto de búsqueda que no encontró resultados. */}
          No hay coincidencias para <span className="font-medium text-gray-600">"{searchQuery}"</span>
        </div>
      ) : (
        // Lista de grupos de categorías. "space-y-4": separación vertical entre grupos.
        <div className="space-y-4">
          {/* .map() recorre sortedCategories. "cat" = nombre de la categoría. */}
          {sortedCategories.map((cat) => (
            // Una tarjeta por cada categoría.
            <div key={cat} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Cabecera de la categoría en fondo gris claro. */}
              <div className="px-5 py-2.5 bg-gray-50 border-b border-gray-100">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{cat}</h3>
              </div>
              {/* Lista de ítems de esta categoría. grouped[cat] es el arreglo de ítems. */}
              <ul className="divide-y divide-gray-100">
                {/* .map() recorre los ítems de esta categoría. "item" = ítem actual. */}
                {grouped[cat].map((item) => (
                  <li key={item.id} className="px-5 py-3 flex items-center justify-between gap-3">
                    {/* Modo edición si editingId coincide con el ID de este ítem. */}
                    {editingId === item.id ? (
                      // ── MODO EDICIÓN INLINE ──────────────────
                      // flex-wrap + textarea w-full: el nombre y la categoría van en
                      // la primera fila, la descripción por defecto ocupa su propia
                      // fila completa, y los botones abajo.
                      <div className="flex-1 flex gap-2 flex-wrap items-start">
                        {/* Campo de nombre en edición. */}
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter')
                              updateMutation.mutate({ id: item.id, name: editName.trim(), category: editCategory || undefined, description: editDescription });
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          className="flex-1 min-w-[150px] px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#008080]"
                          autoFocus
                        />
                        {/* Selector de categoría en edición. */}
                        <select value={editCategory} onChange={(e) => setEditCategory(e.target.value)} className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm">
                          <option value="">Sin categoría</option>
                          {allCategories.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                        {/* Descripción por defecto (fila completa). Es la que se
                            precarga al crear este servicio en cualquier negocio. */}
                        <textarea
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          rows={3}
                          placeholder="Descripción por defecto (se precarga al crear este servicio en un negocio; cada negocio puede editar la suya)…"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#008080] resize-none"
                        />
                        <div className="flex gap-2">
                          {/* Guardar: envía la mutación de actualización. */}
                          <button
                            onClick={() => updateMutation.mutate({ id: item.id, name: editName.trim(), category: editCategory || undefined, description: editDescription })}
                            disabled={updateMutation.isPending}
                            className="px-3 py-1.5 text-xs font-medium text-white rounded-lg"
                            style={{ backgroundColor: '#008080' }}>
                            Guardar
                          </button>
                          {/* Cancelar: sale del modo edición sin guardar. */}
                          <button onClick={() => setEditingId(null)} className="px-3 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg">Cancelar</button>
                        </div>
                      </div>
                    ) : (
                      // ── MODO LECTURA ─────────────────────────
                      <>
                        <div className="flex-1 min-w-0">
                          {/* Nombre del servicio. */}
                          <span className="text-sm font-medium text-gray-900">{item.name}</span>
                          {/* Descripción por defecto (si tiene). Ayuda al superadmin a
                              ver de un vistazo qué texto se precargará. */}
                          {item.description
                            ? <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{item.description}</p>
                            : <p className="text-xs text-gray-300 mt-0.5 italic">Sin descripción por defecto</p>}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {/* Editar: activa edición inline y pre-rellena los campos. */}
                          <button
                            onClick={() => { setEditingId(item.id); setEditName(item.name); setEditCategory(item.category || ''); setEditDescription(item.description || ''); }}
                            className="text-xs text-[#008080] font-medium">
                            Editar
                          </button>
                          {/* Eliminar: borra el ítem del catálogo. */}
                          <button
                            onClick={() => deleteMutation.mutate(item.id)}
                            disabled={deleteMutation.isPending}
                            className="text-xs text-red-500 font-medium disabled:opacity-50">
                            Eliminar
                          </button>
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

      {/* Pie: total de servicios en el catálogo.
          Ternario para singular/plural: 1 "servicio" vs 2+ "servicios". */}
      <p className="text-xs text-gray-400 mt-3">{items.length} servicio{items.length !== 1 ? 's' : ''} en el catalogo.</p>
    </div>
  );
}
