'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';

interface Training {
  id: string;
  title: string;
  institution?: string | null;
  dateCompleted?: string | null;
  fileUrl?: string | null;
  createdAt: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export function EmployeeTraining({
  employeeId,
  canEdit,
}: {
  employeeId: string;
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [institution, setInstitution] = useState('');
  const [dateCompleted, setDateCompleted] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['employee-trainings', employeeId],
    queryFn: () =>
      api.get<{ data: Training[] }>(
        `/api/employees/${employeeId}/trainings`,
      ),
    enabled: !!employeeId,
  });

  const trainings = data?.data || [];

  const addMutation = useMutation({
    mutationFn: async () => {
      const fields: Record<string, string> = { title };
      if (institution) fields.institution = institution;
      if (dateCompleted) fields.dateCompleted = dateCompleted;

      return api.uploadForm(
        `/api/employees/${employeeId}/trainings`,
        fields,
        selectedFile || undefined,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['employee-trainings', employeeId],
      });
      queryClient.invalidateQueries({ queryKey: ['employee', employeeId] });
      resetForm();
    },
  });

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

  function resetForm() {
    setTitle('');
    setInstitution('');
    setDateCompleted('');
    setSelectedFile(null);
    setShowForm(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    addMutation.mutate();
  }

  function getFileUrl(fileUrl: string) {
    return fileUrl.startsWith('http') ? fileUrl : `${API_URL}${fileUrl}`;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">
            {trainings.length} registro{trainings.length !== 1 ? 's' : ''} de
            formación
          </p>
        </div>
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
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">
            Nueva formación
          </h3>
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
                required
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
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
              />
              <p className="text-xs text-gray-400 mt-1">
                Imagen o PDF del certificado (max 5MB)
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={resetForm}
                className="btn-secondary"
              >
                Cancelar
              </button>
              <button
                type="submit"
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
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 bg-gray-100 rounded-lg animate-pulse"
            />
          ))}
        </div>
      ) : trainings.length === 0 && !showForm ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
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
        <div className="space-y-3">
          {trainings.map((training) => (
            <div
              key={training.id}
              className="bg-white rounded-xl border border-gray-200 p-4 flex items-start justify-between gap-4"
            >
              <div className="flex items-start gap-3 min-w-0">
                {/* Icon */}
                <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
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
                  <p className="text-sm font-semibold text-gray-900">
                    {training.title}
                  </p>
                  {training.institution && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      {training.institution}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-1">
                    {training.dateCompleted && (
                      <span className="text-xs text-gray-400">
                        {formatDate(training.dateCompleted, 'MMM YYYY')}
                      </span>
                    )}
                    {training.fileUrl && (
                      <a
                        href={getFileUrl(training.fileUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700"
                      >
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

              {canEdit && (
                <button
                  onClick={() => deleteMutation.mutate(training.id)}
                  disabled={deleteMutation.isPending}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 flex-shrink-0"
                  title="Eliminar"
                >
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
