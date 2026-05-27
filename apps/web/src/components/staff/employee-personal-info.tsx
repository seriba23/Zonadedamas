'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface PersonalInfoForm {
  bloodType: string;
  emergencyContactName: string;
  emergencyContactLastName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;
  allergies: string;
}

interface BasicInfoForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  color: string;
  bio: string;
}

interface EmployeeDocument {
  id: string;
  documentType: string;
  fileUrl: string;
  createdAt: string;
}

const BLOOD_TYPES = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];

const RELATION_OPTIONS = [
  'Padre/Madre',
  'Hermano/a',
  'Esposo/a',
  'Pareja',
  'Hijo/a',
  'Tío/a',
  'Amigo/a',
  'Otro',
];

const COLOR_PALETTE = [
  '#008080', '#6366f1', '#ec4899', '#f59e0b', '#10b981', '#ef4444',
  '#3b82f6', '#8b5cf6', '#f97316', '#14b8a6', '#06b6d4', '#84cc16',
];

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export function EmployeePersonalInfo({
  employeeId,
  initialData,
  canEdit,
}: {
  employeeId: string;
  initialData?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    color?: string;
    bio?: string;
    bloodType?: string | null;
    emergencyContactName?: string | null;
    emergencyContactLastName?: string | null;
    emergencyContactPhone?: string | null;
    emergencyContactRelation?: string | null;
    allergies?: string | null;
  };
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const ineInputRef = useRef<HTMLInputElement>(null!);
  const comprobanteInputRef = useRef<HTMLInputElement>(null!);

  const [isEditing, setIsEditing] = useState(false);

  const [basicForm, setBasicForm] = useState<BasicInfoForm>({
    firstName: initialData?.firstName || '',
    lastName: initialData?.lastName || '',
    email: initialData?.email || '',
    phone: initialData?.phone || '',
    color: initialData?.color || '#008080',
    bio: initialData?.bio || '',
  });

  const [form, setForm] = useState<PersonalInfoForm>({
    bloodType: initialData?.bloodType || '',
    emergencyContactName: initialData?.emergencyContactName || '',
    emergencyContactLastName: initialData?.emergencyContactLastName || '',
    emergencyContactPhone: initialData?.emergencyContactPhone || '',
    emergencyContactRelation: initialData?.emergencyContactRelation || '',
    allergies: initialData?.allergies || '',
  });
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const { data: docsData, isLoading: loadingDocs } = useQuery({
    queryKey: ['employee-documents', employeeId],
    queryFn: () =>
      api.get<{ data: EmployeeDocument[] }>(
        `/api/employees/${employeeId}/documents`,
      ),
    enabled: !!employeeId,
  });

  const documents = docsData?.data || [];
  const ineDoc = documents.find((d) => d.documentType === 'INE');
  const comprobanteDoc = documents.find(
    (d) => d.documentType === 'COMPROBANTE_DOMICILIO',
  );

  const saveBasicMutation = useMutation({
    mutationFn: (data: Partial<BasicInfoForm>) =>
      api.put(`/api/employees/${employeeId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee', employeeId] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });

  const savePersonalMutation = useMutation({
    mutationFn: (data: PersonalInfoForm) =>
      api.put(`/api/employees/${employeeId}/personal-info`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee', employeeId] });
    },
  });

  const uploadDocMutation = useMutation({
    mutationFn: ({ file, documentType }: { file: File; documentType: string }) =>
      api.upload(`/api/employees/${employeeId}/documents`, file, {
        documentType,
      }),
    onSuccess: () => {
      setUploadError(null);
      queryClient.invalidateQueries({
        queryKey: ['employee-documents', employeeId],
      });
      queryClient.invalidateQueries({ queryKey: ['employee', employeeId] });
    },
    onError: (err: { message?: string }) => {
      setUploadError(err.message || 'Error al subir el documento');
      setTimeout(() => setUploadError(null), 5000);
    },
  });

  const deleteDocMutation = useMutation({
    mutationFn: (docId: string) =>
      api.delete(`/api/employees/${employeeId}/documents/${docId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['employee-documents', employeeId],
      });
      queryClient.invalidateQueries({ queryKey: ['employee', employeeId] });
    },
  });

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    try {
      await Promise.all([
        saveBasicMutation.mutateAsync(basicForm),
        savePersonalMutation.mutateAsync(form),
      ]);
      setSaveSuccess(true);
      setIsEditing(false);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch {
      // errors handled by mutation onError
    }
  }

  function handleCancel() {
    setBasicForm({
      firstName: initialData?.firstName || '',
      lastName: initialData?.lastName || '',
      email: initialData?.email || '',
      phone: initialData?.phone || '',
      color: initialData?.color || '#008080',
      bio: initialData?.bio || '',
    });
    setForm({
      bloodType: initialData?.bloodType || '',
      emergencyContactName: initialData?.emergencyContactName || '',
      emergencyContactLastName: initialData?.emergencyContactLastName || '',
      emergencyContactPhone: initialData?.emergencyContactPhone || '',
      emergencyContactRelation: initialData?.emergencyContactRelation || '',
      allergies: initialData?.allergies || '',
    });
    setIsEditing(false);
  }

  function handleDocUpload(
    e: React.ChangeEvent<HTMLInputElement>,
    documentType: string,
  ) {
    const file = e.target.files?.[0];
    if (file) {
      setUploadError(null);
      uploadDocMutation.mutate({ file, documentType });
    }
    e.target.value = '';
  }

  function getFileUrl(fileUrl: string) {
    return fileUrl.startsWith('http') ? fileUrl : `${API_URL}${fileUrl}`;
  }

  const isSaving = saveBasicMutation.isPending || savePersonalMutation.isPending;
  const ineUploading =
    uploadDocMutation.isPending &&
    uploadDocMutation.variables?.documentType === 'INE';
  const comprobanteUploading =
    uploadDocMutation.isPending &&
    uploadDocMutation.variables?.documentType === 'COMPROBANTE_DOMICILIO';

  // ─── VIEW MODE ───
  if (!isEditing) {
    return (
      <div className="space-y-8">
        {/* Success banner */}
        {saveSuccess && (
          <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 px-4 py-2 rounded-lg border border-green-200">
            <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Información guardada correctamente
          </div>
        )}

        {/* Basic Data */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Datos Básicos</h3>
            {canEdit && (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Editar
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ViewField label="Nombre completo" value={`${basicForm.firstName} ${basicForm.lastName}`.trim()} />
            <ViewField label="Email" value={basicForm.email} />
            <ViewField label="Teléfono" value={basicForm.phone} />
            <div>
              <p className="text-xs text-gray-400 mb-1">Color</p>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full border border-gray-200" style={{ backgroundColor: basicForm.color }} />
                <span className="text-sm text-gray-700">{basicForm.color}</span>
              </div>
            </div>
          </div>
          {basicForm.bio && (
            <div className="mt-4">
              <p className="text-xs text-gray-400 mb-1">Presentación</p>
              <p className="text-sm text-gray-700">{basicForm.bio}</p>
            </div>
          )}
        </div>

        {/* Personal Info */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Información Personal</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ViewField label="Tipo de sangre" value={form.bloodType} placeholder="Sin especificar" />
            <ViewField label="Alergias" value={form.allergies} placeholder="Ninguna conocida" />
          </div>

          <div className="pt-4 mt-4 border-t border-gray-100">
            <h4 className="text-sm font-semibold text-gray-800 mb-3">Contacto de emergencia</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ViewField label="Nombre" value={form.emergencyContactName} />
              <ViewField label="Apellido" value={form.emergencyContactLastName} />
              <ViewField label="Teléfono" value={form.emergencyContactPhone} />
              <ViewField label="Relación" value={form.emergencyContactRelation} />
            </div>
          </div>
        </div>

        {/* Documents Section — always interactive */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Documentos</h3>

          {uploadError && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm border border-red-200">
              {uploadError}
            </div>
          )}

          {loadingDocs ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2].map((i) => (
                <div key={i} className="h-24 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <DocumentSlot
                label="INE"
                labelLoaded="INE cargada"
                doc={ineDoc}
                canEdit={canEdit}
                uploading={ineUploading}
                fileInputRef={ineInputRef}
                onUpload={(e) => handleDocUpload(e, 'INE')}
                onDelete={() => ineDoc && deleteDocMutation.mutate(ineDoc.id)}
                deleting={deleteDocMutation.isPending}
                getFileUrl={getFileUrl}
              />
              <DocumentSlot
                label="Comprobante de domicilio"
                labelLoaded="Comprobante cargado"
                doc={comprobanteDoc}
                canEdit={canEdit}
                uploading={comprobanteUploading}
                fileInputRef={comprobanteInputRef}
                onUpload={(e) => handleDocUpload(e, 'COMPROBANTE_DOMICILIO')}
                onDelete={() =>
                  comprobanteDoc && deleteDocMutation.mutate(comprobanteDoc.id)
                }
                deleting={deleteDocMutation.isPending}
                getFileUrl={getFileUrl}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── EDIT MODE ───
  return (
    <form onSubmit={handleSave} className="space-y-8">
      {/* Basic Data */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Datos Básicos</h3>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
              <input
                type="text"
                value={basicForm.firstName}
                onChange={(e) => setBasicForm((f) => ({ ...f, firstName: e.target.value }))}
                className="input-field"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Apellido *</label>
              <input
                type="text"
                value={basicForm.lastName}
                onChange={(e) => setBasicForm((f) => ({ ...f, lastName: e.target.value }))}
                className="input-field"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={basicForm.email}
                onChange={(e) => setBasicForm((f) => ({ ...f, email: e.target.value }))}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
              <input
                type="tel"
                value={basicForm.phone}
                onChange={(e) => setBasicForm((f) => ({ ...f, phone: e.target.value }))}
                className="input-field"
                placeholder="Ej: +52 55 1234 5678"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
            <div className="flex flex-wrap gap-2">
              {COLOR_PALETTE.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setBasicForm((f) => ({ ...f, color }))}
                  className={`w-8 h-8 rounded-full border-2 transition-transform ${
                    basicForm.color === color
                      ? 'border-gray-900 scale-110'
                      : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Presentación</label>
            <p className="text-[11px] text-gray-400 mb-1.5 leading-relaxed">
              Cuéntale a tus clientes quién eres, tu experiencia y especialidades. Este texto aparece en el perfil público del marketplace.
            </p>
            <textarea
              value={basicForm.bio}
              onChange={(e) => {
                if (e.target.value.length <= 500) {
                  setBasicForm((f) => ({ ...f, bio: e.target.value }));
                }
              }}
              className="input-field min-h-[80px] resize-y"
              rows={3}
              placeholder="Descripción breve del empleado..."
            />
            <p className="text-xs text-gray-400 mt-1 text-right">{basicForm.bio.length}/500</p>
          </div>
        </div>
      </div>

      {/* Personal Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Información Personal</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de sangre</label>
              <select
                value={form.bloodType}
                onChange={(e) => setForm((f) => ({ ...f, bloodType: e.target.value }))}
                className="input-field"
              >
                <option value="">Sin especificar</option>
                {BLOOD_TYPES.map((bt) => (
                  <option key={bt} value={bt}>{bt}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Alergias</label>
              <input
                type="text"
                value={form.allergies}
                onChange={(e) => setForm((f) => ({ ...f, allergies: e.target.value }))}
                className="input-field"
                placeholder="Ninguna conocida"
              />
            </div>
          </div>

          {/* Emergency Contact */}
          <div className="pt-2">
            <h4 className="text-sm font-semibold text-gray-800 mb-3">Contacto de emergencia</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <input
                  type="text"
                  value={form.emergencyContactName}
                  onChange={(e) => setForm((f) => ({ ...f, emergencyContactName: e.target.value }))}
                  className="input-field"
                  placeholder="Nombre"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Apellido</label>
                <input
                  type="text"
                  value={form.emergencyContactLastName}
                  onChange={(e) => setForm((f) => ({ ...f, emergencyContactLastName: e.target.value }))}
                  className="input-field"
                  placeholder="Apellido"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                <input
                  type="tel"
                  value={form.emergencyContactPhone}
                  onChange={(e) => setForm((f) => ({ ...f, emergencyContactPhone: e.target.value }))}
                  className="input-field"
                  placeholder="Ej: +52 55 1234 5678"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Relación</label>
                <select
                  value={form.emergencyContactRelation}
                  onChange={(e) => setForm((f) => ({ ...f, emergencyContactRelation: e.target.value }))}
                  className="input-field"
                >
                  <option value="">Seleccionar...</option>
                  {RELATION_OPTIONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Documents Section */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Documentos</h3>

        {uploadError && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm border border-red-200">
            {uploadError}
          </div>
        )}

        {loadingDocs ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2].map((i) => (
              <div key={i} className="h-24 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DocumentSlot
              label="INE"
              labelLoaded="INE cargada"
              doc={ineDoc}
              canEdit={canEdit}
              uploading={ineUploading}
              fileInputRef={ineInputRef}
              onUpload={(e) => handleDocUpload(e, 'INE')}
              onDelete={() => ineDoc && deleteDocMutation.mutate(ineDoc.id)}
              deleting={deleteDocMutation.isPending}
              getFileUrl={getFileUrl}
            />
            <DocumentSlot
              label="Comprobante de domicilio"
              labelLoaded="Comprobante cargado"
              doc={comprobanteDoc}
              canEdit={canEdit}
              uploading={comprobanteUploading}
              fileInputRef={comprobanteInputRef}
              onUpload={(e) => handleDocUpload(e, 'COMPROBANTE_DOMICILIO')}
              onDelete={() =>
                comprobanteDoc && deleteDocMutation.mutate(comprobanteDoc.id)
              }
              deleting={deleteDocMutation.isPending}
              getFileUrl={getFileUrl}
            />
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-4">
        <button type="submit" disabled={isSaving} className="btn-primary">
          {isSaving ? 'Guardando...' : 'Guardar información'}
        </button>
        <button type="button" onClick={handleCancel} className="btn-secondary">
          Cancelar
        </button>
      </div>
    </form>
  );
}

function ViewField({
  label,
  value,
  placeholder = '—',
}: {
  label: string;
  value?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className="text-sm text-gray-700">{value || placeholder}</p>
    </div>
  );
}

function DocumentSlot({
  label,
  labelLoaded,
  doc,
  canEdit,
  uploading,
  fileInputRef,
  onUpload,
  onDelete,
  deleting,
  getFileUrl,
}: {
  label: string;
  labelLoaded: string;
  doc?: { id: string; fileUrl: string; createdAt: string };
  canEdit: boolean;
  uploading: boolean;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDelete: () => void;
  deleting: boolean;
  getFileUrl: (url: string) => string;
}) {
  if (uploading) {
    return (
      <div className="border-2 border-primary-300 bg-primary-50 rounded-lg p-5 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-primary-500 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-primary-700">Subiendo {label}...</p>
            <p className="text-xs text-primary-500 mt-0.5">Espere un momento</p>
          </div>
        </div>
        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={onUpload} className="hidden" />
      </div>
    );
  }

  if (doc) {
    return (
      <div className="relative group">
        <a
          href={getFileUrl(doc.fileUrl)}
          target="_blank"
          rel="noopener noreferrer"
          className="block border-2 border-green-300 bg-green-50 rounded-lg p-5 cursor-pointer hover:bg-green-100 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-green-800">{labelLoaded}</p>
              <p className="text-xs text-green-600 mt-0.5">Click para ver documento</p>
            </div>
            <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </div>
        </a>
        {canEdit && (
          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); fileInputRef.current?.click(); }}
              className="p-1.5 rounded-lg bg-white/90 border border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-white shadow-sm"
              title="Reemplazar"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </button>
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(); }}
              disabled={deleting}
              className="p-1.5 rounded-lg bg-white/90 border border-gray-200 text-red-400 hover:text-red-600 hover:bg-white shadow-sm"
              title="Eliminar"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        )}
        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={onUpload} className="hidden" />
      </div>
    );
  }

  return (
    <div
      role={canEdit ? 'button' : undefined}
      tabIndex={canEdit ? 0 : undefined}
      onClick={canEdit ? () => fileInputRef.current?.click() : undefined}
      onKeyDown={
        canEdit
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }
          : undefined
      }
      className={`border-2 border-dashed rounded-lg p-5 transition-colors ${
        canEdit
          ? 'border-gray-300 hover:border-primary-400 hover:bg-primary-50 cursor-pointer'
          : 'border-gray-200'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-600">{label}</p>
          {canEdit ? (
            <p className="text-xs text-primary-600 font-medium mt-0.5">Click para subir documento</p>
          ) : (
            <p className="text-xs text-gray-400 mt-0.5">Sin documento</p>
          )}
        </div>
      </div>
      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={onUpload} className="hidden" />
    </div>
  );
}
