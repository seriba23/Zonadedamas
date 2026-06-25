// ============================================================
// ARCHIVO: apps/web/src/app/platform/professions/page.tsx
// RUTA EN EL NAVEGADOR: /platform/professions
//
// Página de administración del CATÁLOGO DE PROFESIONES de la
// plataforma. Las profesiones son los títulos que se asignan
// a los empleados de los negocios (Barbero/a, Estilista,
// Cosmetólogo/a, etc.).
//
// IMPORTANTE: Este catálogo también sirve como fuente de
// categorías para el Catálogo de Servicios (/platform/service-catalog).
// Cuando se agrega una profesión aquí, aparece como opción
// de categoría en el catálogo de servicios.
//
// ¿QUÉ MUESTRA?
// - Input + botón para agregar nueva profesión
// - Lista de todas las profesiones con edición inline y eliminación
//
// ¿QUÉ HACE?
// CRUD completo vía API:
//   GET    /api/platform/professions      → listar
//   POST   /api/platform/professions      → crear
//   PATCH  /api/platform/professions/:id  → actualizar
//   DELETE /api/platform/professions/:id  → eliminar
//
// Nota: editar un nombre actualiza automáticamente todos los
// empleados que tengan asignada esa profesión (en el backend).
// ============================================================

// 'use client': usa hooks de React y React Query → requiere el navegador.
'use client';

// useState: para manejar el texto del nuevo campo y el modo de edición.
import { useState } from 'react';

// useQuery, useMutation, useQueryClient: de React Query (@tanstack/react-query).
// Manejo de datos del servidor con caché automático.
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// platformApi: cliente HTTP con autenticación de super admin automática.
import { platformApi } from '@/lib/platform-auth';

// ─── TIPO ────────────────────────────────────────────────
// Profession: forma de cada profesión que devuelve la API.
interface Profession {
  id: string;        // CUID único en la base de datos.
  name: string;      // Nombre de la profesión (ej: "Barbero/a", "Estilista").
  isActive: boolean; // Si la profesión está activa.
  createdAt: string; // Fecha de creación (formato ISO string).
}

// Componente principal de la página.
export default function ProfessionsPage() {
  // queryClient: acceso al caché de React Query para invalidar datos.
  const queryClient = useQueryClient();

  // newName: texto del campo "nueva profesión" en el formulario de alta.
  const [newName, setNewName] = useState('');

  // editingId: ID de la profesión que está en modo edición.
  // null = ninguna profesión está editándose.
  const [editingId, setEditingId] = useState<string | null>(null);

  // editName: texto del campo de edición de la profesión seleccionada.
  const [editName, setEditName] = useState('');

  // ── LECTURA DE DATOS ──────────────────────────────────
  // useQuery obtiene la lista de profesiones desde la API.
  // queryKey: 'platform-professions' identifica este query en el caché.
  const { data, isLoading } = useQuery({
    queryKey: ['platform-professions'],
    queryFn: async () => {
      const res = await platformApi.get<{ data: Profession[] }>('/api/platform/professions');
      // Devolvemos el arreglo directamente para mayor comodidad.
      return res.data;
    },
  });

  // ── MUTACIÓN: CREAR ───────────────────────────────────
  // Recibe solo el nombre (string) de la nueva profesión.
  const createMutation = useMutation({
    mutationFn: (name: string) => platformApi.post('/api/platform/professions', { name }),
    onSuccess: () => {
      // Invalida el caché → React Query vuelve a pedir la lista actualizada.
      queryClient.invalidateQueries({ queryKey: ['platform-professions'] });
      // Limpia el campo de texto.
      setNewName('');
    },
  });

  // ── MUTACIÓN: ACTUALIZAR ──────────────────────────────
  // Recibe el id y el nuevo nombre.
  const updateMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      platformApi.patch(`/api/platform/professions/${id}`, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-professions'] });
      // Sale del modo edición y limpia el campo temporal.
      setEditingId(null);
      setEditName('');
    },
  });

  // ── MUTACIÓN: ELIMINAR ────────────────────────────────
  // Recibe solo el id de la profesión a eliminar.
  const deleteMutation = useMutation({
    mutationFn: (id: string) => platformApi.delete(`/api/platform/professions/${id}`),
    onSuccess: () => {
      // Actualiza la lista tras eliminar.
      queryClient.invalidateQueries({ queryKey: ['platform-professions'] });
    },
  });

  // professions: la lista de profesiones, o arreglo vacío si aún no cargó.
  // El operador "||" devuelve el lado derecho si el izquierdo es undefined/null.
  const professions = data || [];

  // startEdit: activa el modo de edición para una profesión específica.
  // prof: el objeto Profession que el usuario quiere editar.
  function startEdit(prof: Profession) {
    setEditingId(prof.id);     // Marca este ítem como "en edición".
    setEditName(prof.name);    // Pre-rellena el campo con el nombre actual.
  }

  // saveEdit: guarda los cambios de la edición activa.
  // Solo ejecuta si hay un editingId válido Y el nombre no está vacío.
  function saveEdit() {
    if (editingId && editName.trim()) {
      updateMutation.mutate({ id: editingId, name: editName.trim() });
    }
  }

  // ── RENDERIZADO ──────────────────────────────────────────
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Catalogo de Profesiones</h1>
      <p className="text-sm text-gray-500 mb-6">Al editar una profesion, se actualizara automaticamente en todos los empleados que la tengan asignada.</p>

      {/* Add new */}
      {/* Formulario de alta: input de texto + botón en fila. */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex gap-3">
        <input
          type="text"
          placeholder="Nueva profesion (ej: Cosmetologo/a)..."
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          // Permite crear presionando Enter (siempre que el campo no esté vacío).
          onKeyDown={(e) => {
            if (e.key === 'Enter' && newName.trim())
              createMutation.mutate(newName.trim());
          }}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        {/* Botón Agregar. Desactivado si el campo está vacío o hay una mutación en curso. */}
        <button
          onClick={() => { if (newName.trim()) createMutation.mutate(newName.trim()); }}
          disabled={!newName.trim() || createMutation.isPending}
          className="px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 transition-colors"
          style={{ backgroundColor: '#008080' }}
        >
          {/* Ternario: texto dinámico según el estado de la mutación. */}
          {createMutation.isPending ? 'Agregando...' : 'Agregar'}
        </button>
      </div>

      {/* List */}
      {/* Lista de profesiones existentes. */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Lógica condicional de visualización:
            1. isLoading → spinner de texto
            2. Lista vacía → mensaje
            3. Con datos → renderiza cada profesión */}
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Cargando...</div>
        ) : professions.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No hay profesiones registradas</div>
        ) : (
          // divide-y: líneas separadoras entre ítems.
          <ul className="divide-y divide-gray-100">
            {/* .map() recorre cada profesión. "prof" = objeto actual.
                key={prof.id}: clave única para el reconciliador de React. */}
            {professions.map((prof) => (
              <li key={prof.id} className="px-5 py-3 flex items-center justify-between gap-3">
                {/* Si este ítem está en edición (editingId coincide con prof.id),
                    muestra los controles de edición; si no, muestra el texto. */}
                {editingId === prof.id ? (
                  // ── MODO EDICIÓN ──────────────────────────────
                  <div className="flex-1 flex gap-2">
                    {/* Campo de texto de edición.
                        autoFocus: el cursor aparece aquí automáticamente al activar edición. */}
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEdit();        // Guardar con Enter.
                        if (e.key === 'Escape') setEditingId(null); // Cancelar con Escape.
                      }}
                      className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#008080] focus:ring-1 focus:ring-[#008080]"
                      autoFocus
                    />
                    {/* Botón Guardar. Desactivado si la mutación está en curso o el campo vacío. */}
                    <button
                      onClick={saveEdit}
                      disabled={updateMutation.isPending || !editName.trim()}
                      className="px-3 py-1.5 text-xs font-medium text-white rounded-lg disabled:opacity-50"
                      style={{ backgroundColor: '#008080' }}
                    >
                      {/* "..." como texto de carga para botones pequeños. */}
                      {updateMutation.isPending ? '...' : 'Guardar'}
                    </button>
                    {/* Botón Cancelar: sale del modo edición sin guardar. */}
                    <button
                      onClick={() => setEditingId(null)}
                      className="px-3 py-1.5 text-xs font-medium text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  // ── MODO LECTURA ──────────────────────────────
                  // <> </> = Fragment: agrupa elementos sin añadir nodo DOM.
                  <>
                    {/* Nombre de la profesión */}
                    <span className="text-sm font-medium text-gray-900">{prof.name}</span>
                    <div className="flex items-center gap-2">
                      {/* Botón Editar: llama a startEdit() que pre-rellena el formulario
                          y activa el modo de edición para este ítem. */}
                      <button
                        onClick={() => startEdit(prof)}
                        className="text-xs text-[#008080] hover:text-[#006666] font-medium"
                      >
                        Editar
                      </button>
                      {/* Botón Eliminar: llama directamente a la mutación con el ID.
                          Desactivado si hay una eliminación en curso (evita doble clic). */}
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

      {/* Pie de página con contador total.
          professions.length !== 1: si hay exactamente 1, usa singular "profesion";
          si hay 0 o más de 1, usa plural "profesiones".
          Ternario: condición ? 'es' : '' agrega el sufijo del plural. */}
      <p className="text-xs text-gray-400 mt-3">
        {professions.length} profesion{professions.length !== 1 ? 'es' : ''} en el catalogo.
        Usa formato inclusivo: Barbero/a, Tatuador/a, Cosmetologo/a.
      </p>
    </div>
  );
}
