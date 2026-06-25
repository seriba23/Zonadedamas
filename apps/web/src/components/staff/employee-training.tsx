// ============================================================
// ARCHIVO: employee-training.tsx
// ¿QUÉ HACE ESTE COMPONENTE?
//   Muestra y gestiona el historial de formación de un empleado:
//   cursos, diplomados, certificaciones, etc. Permite al admin
//   (si canEdit es true) agregar nuevos registros con nombre del
//   curso, institución, fecha de finalización y un certificado
//   en formato imagen o PDF. También permite eliminar registros.
// ¿QUÉ RECIBE? (props)
//   - employeeId: ID del empleado cuya formación se gestiona.
//   - canEdit: si el usuario puede agregar/eliminar registros.
// ============================================================

'use client';
// Necesario para usar hooks y eventos interactivos.

import { useState, useRef } from 'react';
// useState: controla el formulario y si está visible.
// useRef: referencia al input[type=file] oculto para disparar el
//   selector de archivos programáticamente.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
// useQuery: carga la lista de formaciones del servidor.
// useMutation: crea y elimina registros de formación.
// useQueryClient: invalida caché para refrescar datos.

import { api } from '@/lib/api';
// Módulo propio de peticiones HTTP.

import { formatDate } from '@/lib/utils';
// Función de utilidad para formatear fechas. Ej: formatDate("2024-06-01", "MMM YYYY") → "Jun 2024"

// ─── TIPOS ──────────────────────────────────────────────────

interface Training {
  // Un registro de formación del empleado.
  id: string;
  title: string;                 // nombre del curso o diplomado
  institution?: string | null;   // donde lo tomó (opcional)
  dateCompleted?: string | null; // fecha de finalización (opcional)
  fileUrl?: string | null;       // URL del certificado subido (opcional)
  createdAt: string;             // cuándo se registró en el sistema
}

// URL base del servidor de API para construir URLs absolutas de archivos.
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// ─── COMPONENTE PRINCIPAL ────────────────────────────────────
export function EmployeeTraining({
  employeeId,
  canEdit,
}: {
  employeeId: string;
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();

  // Ref al input[type=file] del certificado.
  // Se usa para programáticamente abrir el selector de archivos
  // cuando el usuario hace clic en el botón del formulario.
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estado: si el formulario de nueva formación está visible.
  const [showForm, setShowForm] = useState(false);

  // ── Estados de los campos del formulario ─────────────────
  const [title, setTitle] = useState('');           // campo requerido
  const [institution, setInstitution] = useState('');
  const [dateCompleted, setDateCompleted] = useState('');
  // El archivo seleccionado (File es el tipo nativo del navegador).
  // null = ningún archivo seleccionado todavía.
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // ─── QUERY: formaciones del empleado ────────────────────
  // Carga el historial de formación desde el servidor.
  // "enabled: !!employeeId" evita la petición si no hay ID.
  const { data, isLoading } = useQuery({
    queryKey: ['employee-trainings', employeeId],
    queryFn: () =>
      api.get<{ data: Training[] }>(
        `/api/employees/${employeeId}/trainings`,
      ),
    enabled: !!employeeId,
  });

  // Extraemos el array de formaciones (o [] si aún no cargó).
  const trainings = data?.data || [];

  // ─── MUTATION: crear formación ───────────────────────────
  // Esta mutación sube el formulario como multipart/form-data porque
  // puede incluir un archivo (el certificado).
  const addMutation = useMutation({
    // "mutationFn: async () =>" define la función asíncrona que se ejecuta.
    // No recibe argumentos porque usa los estados directamente.
    mutationFn: async () => {
      // Construimos un objeto con los campos de texto del formulario.
      // Solo incluimos institución y fecha si tienen valor.
      const fields: Record<string, string> = { title };
      if (institution) fields.institution = institution;
      if (dateCompleted) fields.dateCompleted = dateCompleted;

      // api.uploadForm envía los campos de texto Y el archivo opcional
      // como un FormData (formato multipart/form-data).
      return api.uploadForm(
        `/api/employees/${employeeId}/trainings`,
        fields,
        // "selectedFile || undefined" = si selectedFile es null, enviamos
        // undefined para que uploadForm sepa que no hay archivo.
        selectedFile || undefined,
      );
    },
    onSuccess: () => {
      // Refrescamos la lista de formaciones y los datos del empleado.
      queryClient.invalidateQueries({
        queryKey: ['employee-trainings', employeeId],
      });
      queryClient.invalidateQueries({ queryKey: ['employee', employeeId] });
      // Limpiamos el formulario y lo ocultamos.
      resetForm();
    },
  });

  // ─── MUTATION: eliminar formación ────────────────────────
  const deleteMutation = useMutation({
    mutationFn: (trainingId: string) =>
      api.delete(`/api/employees/${employeeId}/trainings/${trainingId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['employee-trainings', employeeId],
      });
      queryClient.invalidateQueries({ queryKey: ['employee', employeeId] });
    },
  });

  // ─── resetForm ───────────────────────────────────────────
  // Limpia todos los campos del formulario y lo oculta.
  function resetForm() {
    setTitle('');
    setInstitution('');
    setDateCompleted('');
    setSelectedFile(null);
    setShowForm(false);
    // Limpiamos el input de archivo para que el mismo archivo pueda
    // volver a seleccionarse si el usuario lo desea.
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  // ─── handleSubmit ────────────────────────────────────────
  // Manejador del evento submit del formulario.
  function handleSubmit(e: React.FormEvent) {
    // Previene el comportamiento por defecto (recarga de página).
    e.preventDefault();
    // Validación: el título es requerido. .trim() elimina espacios.
    if (!title.trim()) return;
    // Disparamos la mutación (no necesita argumentos porque usa los estados).
    addMutation.mutate();
  }

  // ─── getFileUrl ──────────────────────────────────────────
  // Construye la URL completa del certificado.
  // Si ya es una URL absoluta (empieza con http), la devuelve tal cual.
  // Si es relativa (ej: "/uploads/cert.pdf"), añade la URL base del servidor.
  function getFileUrl(fileUrl: string) {
    return fileUrl.startsWith('http') ? fileUrl : `${API_URL}${fileUrl}`;
  }

  // ─── JSX ────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header: contador de registros + botón de agregar */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">
            {/* Ternario para plural: "registro" vs "registros".
                trainings.length !== 1 es true cuando hay 0 o 2+ registros. */}
            {trainings.length} registro{trainings.length !== 1 ? 's' : ''} de
            formación
          </p>
        </div>
        {/* El botón solo aparece si canEdit y el formulario no está visible.
            "canEdit && !showForm" = ambas condiciones deben ser true. */}
        {canEdit && !showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="btn-primary"
          >
            + Agregar formación
          </button>
        )}
      </div>

      {/* Add form */}
      {/* Renderizado condicional: el formulario solo se muestra si showForm es true. */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">
            Nueva formación
          </h3>
          {/* "onSubmit={handleSubmit}" llama a handleSubmit cuando se envía el form. */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Título / Nombre del curso *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="input-field"
                placeholder="Ej: Diplomado en Colorimetría Avanzada"
                required  // HTML5: no permite enviar si está vacío
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Institución
                </label>
                <input
                  type="text"
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  className="input-field"
                  placeholder="Ej: Academia L'Oréal"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha de finalización
                </label>
                <input
                  type="date"
                  value={dateCompleted}
                  onChange={(e) => setDateCompleted(e.target.value)}
                  className="input-field"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Certificado (opcional)
              </label>
              {/* Input de archivo visible (no oculto como en otros componentes).
                  "accept" filtra los tipos de archivo permitidos en el diálogo.
                  "e.target.files?.[0]" = primer archivo seleccionado o undefined.
                  "|| null" convierte undefined a null para el estado selectedFile. */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                // Las clases "file:" aplican estilos al botón "Examinar" del input.
              />
              <p className="text-xs text-gray-400 mt-1">
                Imagen o PDF del certificado (max 5MB)
              </p>
            </div>

            {/* Botones del formulario */}
            <div className="flex justify-end gap-3 pt-2">
              {/* "type=button" evita que cancele enviando el formulario. */}
              <button
                type="button"
                onClick={resetForm}
                className="btn-secondary"
              >
                Cancelar
              </button>
              <button
                type="submit"
                // Deshabilitado mientras se guarda O si el título está vacío.
                disabled={addMutation.isPending || !title.trim()}
                className="btn-primary"
              >
                {addMutation.isPending ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Trainings list */}
      {/* Renderizado condicional con tres ramas (ternarios anidados):
          1. isLoading: mostramos esqueletos animados.
          2. Sin formaciones y sin formulario: mostramos estado vacío.
          3. Hay formaciones: mostramos la lista. */}
      {isLoading ? (
        <div className="space-y-3">
          {/* [1, 2, 3] = array de tres números. Solo usamos el índice para key. */}
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 bg-gray-100 rounded-lg animate-pulse"
            />
          ))}
        </div>
      ) : trainings.length === 0 && !showForm ? (
        // Estado vacío: muestra ícono y mensaje (y enlace si puede editar).
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          {/* Ícono SVG de graduación / libro */}
          <svg
            className="w-12 h-12 text-gray-300 mx-auto mb-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222"
            />
          </svg>
          <p className="text-gray-500 text-sm">
            No hay registros de formación
          </p>
          {/* El enlace para agregar solo aparece si tiene permiso. */}
          {canEdit && (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="mt-3 text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              Agregar primer registro
            </button>
          )}
        </div>
      ) : (
        // Lista de formaciones: una tarjeta por registro.
        <div className="space-y-3">
          {/* .map() genera una tarjeta por cada formación.
              "training" = objeto Training { id, title, institution, dateCompleted, fileUrl, createdAt } */}
          {trainings.map((training) => (
            <div
              key={training.id}
              className="bg-white rounded-xl border border-gray-200 p-4 flex items-start justify-between gap-4"
            >
              <div className="flex items-start gap-3 min-w-0">
                {/* Icon */}
                <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
                  {/* Ícono de birrete/graduación */}
                  <svg
                    className="w-5 h-5 text-primary-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222"
                    />
                  </svg>
                </div>
                <div className="min-w-0">
                  {/* Título del curso */}
                  <p className="text-sm font-semibold text-gray-900">
                    {training.title}
                  </p>
                  {/* Institución: solo si existe (string no vacío = truthy). */}
                  {training.institution && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      {training.institution}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-1">
                    {/* Fecha de finalización: solo si existe. */}
                    {training.dateCompleted && (
                      <span className="text-xs text-gray-400">
                        {/* formatDate formatea la fecha con el patrón dado.
                            'MMM YYYY' → "Jun 2024" */}
                        {formatDate(training.dateCompleted, 'MMM YYYY')}
                      </span>
                    )}
                    {/* Enlace al certificado: solo si existe. */}
                    {training.fileUrl && (
                      <a
                        href={getFileUrl(training.fileUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700"
                      >
                        {/* Ícono de ojo (ver) */}
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                          />
                        </svg>
                        Ver certificado
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Botón de eliminar: solo si canEdit. */}
              {canEdit && (
                <button
                  // Al hacer clic, disparamos la mutación de eliminar
                  // pasando el ID de esta formación específica.
                  onClick={() => deleteMutation.mutate(training.id)}
                  disabled={deleteMutation.isPending}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 flex-shrink-0"
                  title="Eliminar"
                >
                  {/* Ícono de papelera */}
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
