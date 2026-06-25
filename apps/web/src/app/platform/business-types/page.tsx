// ============================================================
// ARCHIVO: apps/web/src/app/platform/business-types/page.tsx
// RUTA EN EL NAVEGADOR: /platform/business-types
//
// Página de administración de los TIPOS DE NEGOCIO disponibles
// en la plataforma Siliba (Salón, Barbería, Spa, Clínica, etc.).
//
// ¿QUÉ MUESTRA?
// - Formulario para agregar un nuevo tipo de negocio (clave + etiqueta)
// - Lista de todos los tipos existentes con botones Editar/Eliminar
// - Modo edición inline: al hacer clic en "Editar" los campos
//   aparecen directamente en el ítem de la lista (sin modal)
//
// ¿QUÉ HACE?
// CRUD completo de tipos de negocio vía API:
//   GET    /api/platform/business-types   → listar
//   POST   /api/platform/business-types   → crear
//   PATCH  /api/platform/business-types/:id → actualizar
//   DELETE /api/platform/business-types/:id → eliminar
//
// CONCEPTOS CLAVE:
// - useQuery: hook de React Query para leer datos de la API con caché.
// - useMutation: hook de React Query para operaciones de escritura (crear/editar/borrar).
// - queryClient.invalidateQueries: "invalida" el caché para que React Query
//   vuelva a pedir los datos actualizados después de una mutación.
// ============================================================

// 'use client': usa hooks de React y React Query → requiere el navegador.
'use client';

// useState: para manejar los valores de los formularios de alta y edición.
import { useState } from 'react';

// useQuery: lee y cachea datos del servidor. Reintenta si falla.
// useMutation: maneja operaciones de escritura (POST/PATCH/DELETE).
// useQueryClient: acceso al cliente de caché de React Query para invalidar queries.
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// platformApi: cliente HTTP del Super Admin con token JWT automático.
import { platformApi } from '@/lib/platform-auth';

// ─── TIPO ────────────────────────────────────────────────
// BusinessType: forma de cada tipo de negocio que devuelve la API.
interface BusinessType {
  id: string;       // ID único (CUID) en la base de datos.
  value: string;    // Clave interna en MAYÚSCULAS (ej: 'SALON', 'BARBERIA').
  label: string;    // Nombre visible en la UI (ej: 'Salón', 'Barbería').
  isActive: boolean; // Si está activo o desactivado.
}

// Componente principal de la página.
export default function BusinessTypesPage() {
  // queryClient: instancia del cliente de caché de React Query.
  // Se usa para "invalidar" (marcar como obsoletos) los datos en caché
  // después de crear, editar o eliminar un tipo de negocio.
  const queryClient = useQueryClient();

  // ── ESTADOS DEL FORMULARIO DE ALTA ────────────────────
  // newValue: clave interna que el admin escribe (ej: "PELUQUERIA").
  const [newValue, setNewValue] = useState('');
  // newLabel: nombre visible que el admin escribe (ej: "Peluquería").
  const [newLabel, setNewLabel] = useState('');

  // ── ESTADOS DEL FORMULARIO DE EDICIÓN ─────────────────
  // editingId: ID del tipo de negocio que se está editando actualmente.
  // null = nadie se está editando.
  const [editingId, setEditingId] = useState<string | null>(null);
  // editValue y editLabel: valores actuales en los campos de edición.
  const [editValue, setEditValue] = useState('');
  const [editLabel, setEditLabel] = useState('');

  // ── LECTURA DE DATOS (useQuery) ────────────────────────
  // useQuery es el hook de React Query para LEER datos.
  // queryKey: identificador único del query en el caché. Si ya hay datos
  //           en caché con esa clave, los usa sin hacer nueva petición.
  // queryFn: función async que hace la petición real. Se llama cuando
  //          no hay datos en caché o cuando se invalida el caché.
  const { data, isLoading } = useQuery({
    queryKey: ['platform-business-types'], // Clave del caché.
    queryFn: async () => {
      const res = await platformApi.get<{ data: BusinessType[] }>('/api/platform/business-types');
      // Devolvemos solo res.data (el arreglo) para simplificar el uso.
      return res.data;
    },
  });

  // ── MUTACIÓN: CREAR ───────────────────────────────────
  // useMutation maneja operaciones que MODIFICAN datos (POST/PATCH/DELETE).
  // mutationFn: función que hace la petición de escritura.
  // onSuccess: callback que se ejecuta si la mutación tiene éxito.
  const createMutation = useMutation({
    mutationFn: (body: { value: string; label: string }) =>
      platformApi.post('/api/platform/business-types', body),
    onSuccess: () => {
      // invalidateQueries: marca como obsoleto el caché de 'platform-business-types'.
      // React Query vuelve a llamar a queryFn automáticamente para actualizar la lista.
      queryClient.invalidateQueries({ queryKey: ['platform-business-types'] });
      // Limpia los campos del formulario de alta.
      setNewValue('');
      setNewLabel('');
    },
  });

  // ── MUTACIÓN: ACTUALIZAR ──────────────────────────────
  // La función recibe un objeto con id + campos a actualizar.
  // "{ id, ...body }": destructura "id" del objeto y el resto queda en "body".
  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: string; value?: string; label?: string }) =>
      platformApi.patch(`/api/platform/business-types/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-business-types'] });
      // Cierra el modo de edición (null = ningún ítem editándose).
      setEditingId(null);
    },
  });

  // ── MUTACIÓN: ELIMINAR ────────────────────────────────
  // Recibe solo el "id" del tipo a eliminar.
  const deleteMutation = useMutation({
    mutationFn: (id: string) => platformApi.delete(`/api/platform/business-types/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platform-business-types'] }),
  });

  // types: el arreglo de tipos de negocio.
  // "data || []": si data es undefined (aún cargando o error), usa arreglo vacío.
  // El operador "||" devuelve el operando derecho si el izquierdo es falsy.
  const types = data || [];

  // ── RENDERIZADO ──────────────────────────────────────────
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Tipos de Negocio</h1>
      <p className="text-sm text-gray-500 mb-6">Define las categorias disponibles para los negocios que se registran en Siliba.</p>

      {/* Add new */}
      {/* Formulario de alta: dos inputs + botón en fila horizontal. */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex gap-3 flex-wrap">
        {/* Campo para la CLAVE INTERNA (ej: SALON).
            e.target.value.toUpperCase(): convierte a mayúsculas automáticamente. */}
        <input
          type="text"
          placeholder="Clave (ej: PELUQUERIA)"
          value={newValue}
          onChange={(e) => setNewValue(e.target.value.toUpperCase())}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 w-40 uppercase"
        />
        {/* Campo para el NOMBRE VISIBLE (ej: Peluquería).
            onKeyDown: al presionar Enter con datos válidos, crea el tipo directamente. */}
        <input
          type="text"
          placeholder="Nombre visible (ej: Peluquería)"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => {
            // e.key === 'Enter': detecta la tecla Enter.
            // .trim(): elimina espacios al inicio y al final.
            if (e.key === 'Enter' && newValue.trim() && newLabel.trim())
              createMutation.mutate({ value: newValue.trim(), label: newLabel.trim() });
          }}
          className="flex-1 min-w-[180px] px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        {/* Botón Agregar.
            disabled: desactivado si falta algún campo O si la mutación está en curso.
            "!newValue.trim()": verdadero si el campo está vacío (! = negación).
            createMutation.isPending: true mientras la petición POST está en curso. */}
        <button
          onClick={() => {
            if (newValue.trim() && newLabel.trim())
              createMutation.mutate({ value: newValue.trim(), label: newLabel.trim() });
          }}
          disabled={!newValue.trim() || !newLabel.trim() || createMutation.isPending}
          className="px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50"
          style={{ backgroundColor: '#008080' }}
        >
          {/* Ternario: muestra texto de carga si la mutación está en curso. */}
          {createMutation.isPending ? 'Agregando...' : 'Agregar'}
        </button>
      </div>

      {/* List */}
      {/* Lista de tipos de negocio existentes. */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Renderizado condicional en cadena (if-else):
            1. Si cargando → mensaje de carga
            2. Si lista vacía → mensaje vacío
            3. Si hay datos → lista de ítems */}
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Cargando...</div>
        ) : types.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No hay tipos de negocio</div>
        ) : (
          // divide-y: agrega una línea separadora entre cada <li>.
          <ul className="divide-y divide-gray-100">
            {/* .map() genera un <li> por cada tipo de negocio.
                "bt" = business type (objeto actual de la iteración).
                key={bt.id}: identificador único para React. */}
            {types.map((bt) => (
              <li key={bt.id} className="px-5 py-3 flex items-center justify-between gap-3">
                {/* Renderizado condicional: si este ítem está en modo edición
                    (editingId === bt.id), muestra inputs; si no, muestra el texto. */}
                {editingId === bt.id ? (
                  // ── MODO EDICIÓN: campos inline ────────────────
                  <div className="flex-1 flex gap-2 flex-wrap">
                    {/* Campo de clave (en edición). autoFocus: el cursor va aquí al abrir. */}
                    <input value={editValue} onChange={(e) => setEditValue(e.target.value.toUpperCase())}
                      className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm uppercase w-32 focus:outline-none focus:border-[#008080]" autoFocus />
                    {/* Campo de etiqueta (en edición). Enter guarda, Escape cancela. */}
                    <input value={editLabel} onChange={(e) => setEditLabel(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter')
                          updateMutation.mutate({ id: bt.id, value: editValue.trim(), label: editLabel.trim() });
                        if (e.key === 'Escape')
                          setEditingId(null); // Cancela la edición.
                      }}
                      className="flex-1 min-w-[140px] px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#008080]" />
                    {/* Botón Guardar: llama a la mutación de actualización. */}
                    <button
                      onClick={() => updateMutation.mutate({ id: bt.id, value: editValue.trim(), label: editLabel.trim() })}
                      className="px-3 py-1.5 text-xs font-medium text-white rounded-lg"
                      style={{ backgroundColor: '#008080' }}>
                      Guardar
                    </button>
                    {/* Botón Cancelar: sale del modo edición sin guardar. */}
                    <button onClick={() => setEditingId(null)} className="px-3 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg">Cancelar</button>
                  </div>
                ) : (
                  // ── MODO LECTURA: muestra label y value ────────
                  <>
                    <div>
                      {/* Nombre visible (ej: Salón) */}
                      <span className="text-sm font-medium text-gray-900">{bt.label}</span>
                      {/* Clave interna en fuente monoespaciada (ej: SALON).
                          "ml-2": margen izquierdo de 8px. */}
                      <span className="text-xs text-gray-400 ml-2 font-mono">{bt.value}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Botón Editar: activa el modo edición para este ítem.
                          Pre-rellena editValue y editLabel con los valores actuales. */}
                      <button
                        onClick={() => { setEditingId(bt.id); setEditValue(bt.value); setEditLabel(bt.label); }}
                        className="text-xs text-[#008080] font-medium">
                        Editar
                      </button>
                      {/* Botón Eliminar: llama a la mutación de borrado con el ID.
                          disabled mientras la mutación DELETE está en curso. */}
                      <button
                        onClick={() => deleteMutation.mutate(bt.id)}
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
        )}
      </div>
    </div>
  );
}
