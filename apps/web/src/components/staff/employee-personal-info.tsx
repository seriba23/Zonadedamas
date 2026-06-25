// ============================================================
// ARCHIVO: employee-personal-info.tsx
// ¿QUÉ HACE ESTE COMPONENTE?
//   Muestra y permite editar la información completa de un empleado:
//   datos básicos (nombre, email, teléfono, color, presentación),
//   datos personales (tipo de sangre, alergias, contacto de emergencia),
//   y documentos (INE, comprobante de domicilio).
//   Tiene dos "modos": modo visualización y modo edición.
//   En modo visualización todo es de solo lectura.
//   En modo edición aparece un formulario con inputs editables.
// ¿QUÉ RECIBE? (props)
//   - employeeId: ID del empleado.
//   - initialData: datos actuales del empleado para pre-rellenar el form.
//   - canEdit: si el usuario puede editar (muestra/oculta botón Editar).
// ============================================================

'use client';
// 'use client': necesario porque usa hooks (useState, useRef, etc.)
// y responde a eventos del usuario.

import { useState, useRef } from 'react';
// useState: para guardar el estado del formulario y modo edición.
// useRef: para acceder directamente a elementos del DOM (los inputs de archivo)
//   sin causar re-renders. Aquí se usa para programáticamente hacer clic
//   en el input[type=file] invisible.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
// useQuery: carga datos del servidor (documentos del empleado).
// useMutation: envía cambios al servidor (guardar info, subir documentos, etc.).
// useQueryClient: para invalidar (refrescar) datos en caché.

import { api } from '@/lib/api';
// Módulo propio que encapsula las peticiones HTTP con autenticación.

// ─── TIPOS ──────────────────────────────────────────────────

interface PersonalInfoForm {
  // Datos del formulario de "Información Personal" (médica y de emergencia).
  bloodType: string;
  emergencyContactName: string;
  emergencyContactLastName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;
  allergies: string;
}

interface BasicInfoForm {
  // Datos del formulario de "Datos Básicos" (contacto y perfil público).
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  color: string;   // color HEX para el avatar y calendario
  bio: string;     // presentación pública del empleado
}

interface EmployeeDocument {
  // Estructura de un documento subido al servidor.
  id: string;
  documentType: string;  // "INE" o "COMPROBANTE_DOMICILIO"
  fileUrl: string;       // ruta relativa o URL completa del archivo
  createdAt: string;     // fecha ISO de cuando se subió
}

// ─── CONSTANTES ─────────────────────────────────────────────

// Tipos de sangre disponibles para el selector <select>.
const BLOOD_TYPES = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];

// Opciones de relación para el contacto de emergencia.
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

// Paleta de 12 colores disponibles para el empleado.
// Se usan en el calendario de citas y en el avatar.
const COLOR_PALETTE = [
  '#008080', '#6366f1', '#ec4899', '#f59e0b', '#10b981', '#ef4444',
  '#3b82f6', '#8b5cf6', '#f97316', '#14b8a6', '#06b6d4', '#84cc16',
];

// URL base del servidor de API. Se usa para construir URLs absolutas
// de archivos cuando la URL del archivo es relativa (empieza con "/").
// process.env.NEXT_PUBLIC_API_URL es una variable de entorno de Next.js.
// Si no está definida, usa localhost:3001 como fallback.
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// ─── COMPONENTE PRINCIPAL ────────────────────────────────────
export function EmployeePersonalInfo({
  employeeId,
  initialData,
  canEdit,
}: {
  employeeId: string;
  initialData?: {
    // "?" en el tipo del parámetro = initialData puede no pasar.
    // Las propiedades también son opcionales.
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
  // queryClient para poder invalidar la caché de 'employees' y 'employee'
  // cuando se guarden cambios, forzando que otros componentes recarguen.
  const queryClient = useQueryClient();

  // Ref al input[type=file] del documento INE.
  // useRef<HTMLInputElement> crea una referencia tipada al elemento input.
  // "null!" (con !) le dice a TS que confiamos en que no será null
  // cuando se use (aunque se inicializa como null).
  const ineInputRef = useRef<HTMLInputElement>(null!);

  // Ref al input[type=file] del comprobante de domicilio.
  const comprobanteInputRef = useRef<HTMLInputElement>(null!);

  // Estado: si estamos en modo edición (true) o visualización (false).
  const [isEditing, setIsEditing] = useState(false);

  // Estado: datos del formulario básico.
  // Se inicializa con los datos que llegan por props (initialData).
  // "initialData?.firstName" usa optional chaining: si initialData es
  // undefined, devuelve undefined. Luego "|| ''" convierte undefined a string vacío.
  const [basicForm, setBasicForm] = useState<BasicInfoForm>({
    firstName: initialData?.firstName || '',
    lastName: initialData?.lastName || '',
    email: initialData?.email || '',
    phone: initialData?.phone || '',
    color: initialData?.color || '#008080',   // teal por defecto
    bio: initialData?.bio || '',
  });

  // Estado: datos del formulario personal (médico/emergencia).
  const [form, setForm] = useState<PersonalInfoForm>({
    bloodType: initialData?.bloodType || '',
    emergencyContactName: initialData?.emergencyContactName || '',
    emergencyContactLastName: initialData?.emergencyContactLastName || '',
    emergencyContactPhone: initialData?.emergencyContactPhone || '',
    emergencyContactRelation: initialData?.emergencyContactRelation || '',
    allergies: initialData?.allergies || '',
  });

  // Estado: true durante 4 segundos después de guardar exitosamente.
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Estado: mensaje de error al subir un documento (o null si no hay error).
  const [uploadError, setUploadError] = useState<string | null>(null);

  // ─── QUERY: documentos del empleado ─────────────────────
  // Carga la lista de documentos del empleado desde el servidor.
  // Se ejecuta solo si employeeId tiene valor (!!employeeId = true).
  const { data: docsData, isLoading: loadingDocs } = useQuery({
    queryKey: ['employee-documents', employeeId],
    queryFn: () =>
      api.get<{ data: EmployeeDocument[] }>(
        `/api/employees/${employeeId}/documents`,
      ),
    enabled: !!employeeId,
  });

  // Extraemos el array de documentos (o [] si aún no cargó).
  const documents = docsData?.data || [];

  // Buscamos específicamente el documento de tipo INE.
  // .find() devuelve el primer elemento que cumple la condición, o undefined.
  const ineDoc = documents.find((d) => d.documentType === 'INE');

  // Buscamos el comprobante de domicilio.
  const comprobanteDoc = documents.find(
    (d) => d.documentType === 'COMPROBANTE_DOMICILIO',
  );

  // ─── MUTATION: guardar datos básicos ────────────────────
  // Envía los datos básicos (nombre, email, color, etc.) al servidor.
  const saveBasicMutation = useMutation({
    mutationFn: (data: Partial<BasicInfoForm>) =>
      // "Partial<BasicInfoForm>" = todas las propiedades se vuelven opcionales.
      api.put(`/api/employees/${employeeId}`, data),
    onSuccess: () => {
      // Invalida la caché de 'employee' y 'employees' para forzar refetch.
      queryClient.invalidateQueries({ queryKey: ['employee', employeeId] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });

  // ─── MUTATION: guardar info personal ────────────────────
  const savePersonalMutation = useMutation({
    mutationFn: (data: PersonalInfoForm) =>
      api.put(`/api/employees/${employeeId}/personal-info`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee', employeeId] });
    },
  });

  // ─── MUTATION: subir documento ──────────────────────────
  // api.upload envía el archivo como multipart/form-data.
  const uploadDocMutation = useMutation({
    mutationFn: ({ file, documentType }: { file: File; documentType: string }) =>
      // Recibe un objeto con el archivo y el tipo de documento.
      api.upload(`/api/employees/${employeeId}/documents`, file, {
        documentType,
      }),
    onSuccess: () => {
      setUploadError(null);
      // Refrescamos la lista de documentos para que aparezca el nuevo.
      queryClient.invalidateQueries({
        queryKey: ['employee-documents', employeeId],
      });
      queryClient.invalidateQueries({ queryKey: ['employee', employeeId] });
    },
    onError: (err: { message?: string }) => {
      // Si la subida falla, mostramos el mensaje de error.
      // "err.message || '...'" = usa el mensaje del error, o el texto
      // por defecto si el error no tiene mensaje.
      setUploadError(err.message || 'Error al subir el documento');
      // Limpiamos el error automáticamente después de 5 segundos.
      setTimeout(() => setUploadError(null), 5000);
    },
  });

  // ─── MUTATION: eliminar documento ───────────────────────
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

  // ─── handleSave ──────────────────────────────────────────
  // Manejador del submit del formulario de edición.
  // "e: React.FormEvent" es el tipo del evento de formulario en React.
  async function handleSave(e: React.FormEvent) {
    // Previene el comportamiento por defecto del formulario HTML:
    // sin esto, el submit recargaría la página completa.
    e.preventDefault();
    try {
      // Promise.all() ejecuta ambas mutaciones EN PARALELO y espera
      // a que ambas terminen. Es más eficiente que hacerlas en serie.
      // "mutateAsync" devuelve una Promise (a diferencia de "mutate").
      await Promise.all([
        saveBasicMutation.mutateAsync(basicForm),
        savePersonalMutation.mutateAsync(form),
      ]);
      // Si ambas tuvieron éxito:
      setSaveSuccess(true);    // mostrar banner de éxito
      setIsEditing(false);     // volver al modo visualización
      // Ocultar el banner de éxito después de 4 segundos.
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch {
      // errors handled by mutation onError
      // Los errores ya los maneja React Query internamente.
      // El bloque catch vacío evita que el error no controlado
      // rompa la ejecución silenciosamente.
    }
  }

  // ─── handleCancel ────────────────────────────────────────
  // Cancela la edición y restaura los formularios a los valores originales.
  function handleCancel() {
    // Restauramos basicForm a los valores que llegaron por props.
    setBasicForm({
      firstName: initialData?.firstName || '',
      lastName: initialData?.lastName || '',
      email: initialData?.email || '',
      phone: initialData?.phone || '',
      color: initialData?.color || '#008080',
      bio: initialData?.bio || '',
    });
    // Restauramos form a los valores originales.
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

  // ─── handleDocUpload ────────────────────────────────────
  // Manejador del evento onChange del input[type=file].
  // Se llama cuando el usuario selecciona un archivo.
  // "e.target.files" es un FileList (no un array normal) con los archivos.
  // "documentType" indica si es 'INE' o 'COMPROBANTE_DOMICILIO'.
  function handleDocUpload(
    e: React.ChangeEvent<HTMLInputElement>,
    documentType: string,
  ) {
    // "e.target.files?.[0]" = el primer archivo seleccionado (o undefined).
    const file = e.target.files?.[0];
    if (file) {
      setUploadError(null);
      uploadDocMutation.mutate({ file, documentType });
    }
    // Limpiamos el valor del input para que el mismo archivo pueda
    // volver a seleccionarse si el usuario lo desea (de otro modo,
    // onChange no se dispara con el mismo archivo dos veces seguidas).
    e.target.value = '';
  }

  // ─── getFileUrl ──────────────────────────────────────────
  // Construye la URL completa de un archivo.
  // Si la URL ya es absoluta (empieza con "http"), la devuelve tal cual.
  // Si es relativa (ej: "/uploads/doc.pdf"), añade la URL base del servidor.
  function getFileUrl(fileUrl: string) {
    return fileUrl.startsWith('http') ? fileUrl : `${API_URL}${fileUrl}`;
  }

  // Indicadores de estado derivados de las mutaciones.
  // "isPending" es true mientras la petición está en vuelo (no ha terminado).
  const isSaving = saveBasicMutation.isPending || savePersonalMutation.isPending;

  // Detecta si la subida en curso es de tipo INE.
  // uploadDocMutation.variables guarda los argumentos del último .mutate() llamado.
  const ineUploading =
    uploadDocMutation.isPending &&
    uploadDocMutation.variables?.documentType === 'INE';

  const comprobanteUploading =
    uploadDocMutation.isPending &&
    uploadDocMutation.variables?.documentType === 'COMPROBANTE_DOMICILIO';

  // ─── MODO VISUALIZACIÓN ──────────────────────────────────
  // Si no estamos editando, mostramos la información como texto de solo lectura.
  if (!isEditing) {
    return (
      <div className="space-y-8">
        {/* Banner de éxito: solo visible justo después de guardar. */}
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
            {/* El botón "Editar" solo aparece si canEdit es true. */}
            {canEdit && (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                // Al hacer clic, cambiamos isEditing a true y React
                // re-renderiza el componente mostrando el formulario.
                className="flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Editar
              </button>
            )}
          </div>
          {/* Grid de campos de solo lectura. ViewField es un subcomponente
              definido abajo en este mismo archivo. */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Template literal para combinar nombre y apellido en un string. */}
            <ViewField label="Nombre completo" value={`${basicForm.firstName} ${basicForm.lastName}`.trim()} />
            <ViewField label="Email" value={basicForm.email} />
            <ViewField label="Teléfono" value={basicForm.phone} />
            <div>
              <p className="text-xs text-gray-400 mb-1">Color</p>
              <div className="flex items-center gap-2">
                {/* Círculo de color usando style prop en línea. */}
                <div className="w-5 h-5 rounded-full border border-gray-200" style={{ backgroundColor: basicForm.color }} />
                <span className="text-sm text-gray-700">{basicForm.color}</span>
              </div>
            </div>
          </div>
          {/* La bio solo se muestra si tiene contenido (string no vacío = truthy). */}
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
        {/* La sección de documentos es siempre interactiva (se puede
            subir/ver aunque no estemos en modo edición). */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Documentos</h3>

          {/* Mensaje de error de subida */}
          {uploadError && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm border border-red-200">
              {uploadError}
            </div>
          )}

          {/* Mostrar esqueletos de carga mientras se obtienen los documentos,
              o los slots reales cuando ya están disponibles. */}
          {loadingDocs ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Generamos 2 esqueletos usando un array de literales [1, 2].
                  "i" es el índice que usamos como key. */}
              {[1, 2].map((i) => (
                <div key={i} className="h-24 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* DocumentSlot es un subcomponente definido abajo.
                  Maneja el estado de "cargando", "con archivo" y "vacío". */}
              <DocumentSlot
                label="INE"
                labelLoaded="INE cargada"
                doc={ineDoc}               // undefined si no hay INE
                canEdit={canEdit}
                uploading={ineUploading}   // true si la subida está en curso
                fileInputRef={ineInputRef}
                onUpload={(e) => handleDocUpload(e, 'INE')}
                // Arrow function para pasar el tipo de documento al handler.
                onDelete={() => ineDoc && deleteDocMutation.mutate(ineDoc.id)}
                // "ineDoc &&" evita llamar .mutate() si ineDoc es undefined.
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

  // ─── MODO EDICIÓN ────────────────────────────────────────
  // Cuando isEditing es true, renderizamos el formulario completo.
  return (
    // <form> con onSubmit: cuando el usuario hace clic en "Guardar"
    // (botón type="submit") o presiona Enter, se llama handleSave.
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
                // onChange: se llama cada vez que el usuario escribe.
                // "e.target.value" es el texto actual del input.
                // Usamos la forma funcional de setBasicForm: (f) => {...}
                // "f" es el estado anterior. Usamos spread "...f" para
                // copiar todos los campos y solo cambiar firstName.
                onChange={(e) => setBasicForm((f) => ({ ...f, firstName: e.target.value }))}
                className="input-field"
                required  // HTML5: el formulario no se puede enviar si está vacío
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
            {/* Paleta de colores: un botón circular por cada color. */}
            <div className="flex flex-wrap gap-2">
              {/* .map() recorre COLOR_PALETTE. "color" es cada string HEX. */}
              {COLOR_PALETTE.map((color) => (
                <button
                  key={color}
                  type="button"  // evita que este botón envíe el formulario
                  // Al hacer clic, actualiza solo el campo "color" del form.
                  onClick={() => setBasicForm((f) => ({ ...f, color }))}
                  // Estilo condicional: si este color es el seleccionado,
                  // añade borde oscuro y escala ligeramente para resaltarlo.
                  className={`w-8 h-8 rounded-full border-2 transition-transform ${
                    basicForm.color === color
                      ? 'border-gray-900 scale-110'
                      : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}  // tooltip al pasar el mouse
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
                // Limitamos a 500 caracteres: solo actualizamos el estado
                // si el texto no supera ese límite.
                if (e.target.value.length <= 500) {
                  setBasicForm((f) => ({ ...f, bio: e.target.value }));
                }
              }}
              className="input-field min-h-[80px] resize-y"
              rows={3}
              placeholder="Descripción breve del empleado..."
            />
            {/* Contador de caracteres en tiempo real (se actualiza en cada tecla). */}
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo de sangre <span className="text-xs text-gray-400 font-normal">(opcional)</span>
              </label>
              {/* <select> controlado: su valor siempre refleja form.bloodType. */}
              <select
                value={form.bloodType}
                onChange={(e) => setForm((f) => ({ ...f, bloodType: e.target.value }))}
                className="input-field"
              >
                <option value="">Sin especificar</option>
                {/* .map() genera un <option> por cada tipo de sangre. */}
                {BLOOD_TYPES.map((bt) => (
                  <option key={bt} value={bt}>{bt}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Alergias <span className="text-xs text-gray-400 font-normal">(opcional)</span>
              </label>
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
                  {/* Genera un <option> por cada relación posible. */}
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
        {/* type="submit" envía el formulario y llama handleSave. */}
        <button type="submit" disabled={isSaving} className="btn-primary">
          {isSaving ? 'Guardando...' : 'Guardar información'}
        </button>
        {/* type="button" evita enviar el formulario. Solo cancela. */}
        <button type="button" onClick={handleCancel} className="btn-secondary">
          Cancelar
        </button>
      </div>
    </form>
  );
}

// ─── SUBCOMPONENTE: ViewField ─────────────────────────────
// Componente pequeño para mostrar un campo de solo lectura.
// Recibe un label (etiqueta) y un value (valor a mostrar).
// Si value está vacío, muestra el placeholder (por defecto "—").
function ViewField({
  label,
  value,
  placeholder = '—',   // valor por defecto si no se pasa placeholder
}: {
  label: string;
  value?: string;       // opcional: puede no haber valor
  placeholder?: string; // opcional: texto a mostrar si no hay valor
}) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      {/* "value || placeholder" = muestra value si tiene contenido,
          si no (vacío, undefined, null), muestra placeholder. */}
      <p className="text-sm text-gray-700">{value || placeholder}</p>
    </div>
  );
}

// ─── SUBCOMPONENTE: DocumentSlot ────────────────────────
// Muestra un slot de documento con tres posibles estados:
//   1. Cargando (uploading): spinner animado.
//   2. Con documento (doc): tarjeta verde con enlace para ver el archivo.
//   3. Vacío: área punteada para arrastrar/hacer clic y subir.
// El input[type=file] está siempre oculto. Se activa con .click().
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
  label: string;         // nombre del tipo de documento, ej: "INE"
  labelLoaded: string;   // texto cuando ya está cargado, ej: "INE cargada"
  doc?: { id: string; fileUrl: string; createdAt: string };
  // doc es undefined si no hay documento subido todavía.
  canEdit: boolean;
  uploading: boolean;    // true mientras el archivo está subiéndose al servidor
  fileInputRef: React.RefObject<HTMLInputElement>;
  // RefObject<T>: referencia de React a un elemento HTML del tipo T.
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDelete: () => void;
  deleting: boolean;     // true mientras el archivo se está eliminando del servidor
  getFileUrl: (url: string) => string;
}) {
  // ── Estado 1: subiendo archivo ──────────────────────────
  if (uploading) {
    return (
      <div className="border-2 border-primary-300 bg-primary-50 rounded-lg p-5 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
            {/* Ícono de spinner (rueda girando) */}
            <svg className="w-5 h-5 text-primary-500 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            {/* Template literal: "Subiendo INE..." o "Subiendo Comprobante..." */}
            <p className="text-sm font-semibold text-primary-700">Subiendo {label}...</p>
            <p className="text-xs text-primary-500 mt-0.5">Espere un momento</p>
          </div>
        </div>
        {/* Input oculto (se necesita aunque no se usa en este estado) */}
        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={onUpload} className="hidden" />
      </div>
    );
  }

  // ── Estado 2: documento existente ──────────────────────
  if (doc) {
    return (
      // "group" en Tailwind activa estilos con "group-hover:" en hijos.
      // Cuando el mouse está sobre el contenedor "group", los botones
      // ocultos (opacity-0) se vuelven visibles (opacity-100).
      <div className="relative group">
        <a
          href={getFileUrl(doc.fileUrl)}
          target="_blank"     // abre el documento en una nueva pestaña
          rel="noopener noreferrer"
          // "noopener noreferrer" es seguridad: evita que la nueva pestaña
          // tenga acceso al contexto de la original.
          className="block border-2 border-green-300 bg-green-50 rounded-lg p-5 cursor-pointer hover:bg-green-100 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
              {/* Ícono de checkmark verde */}
              <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-green-800">{labelLoaded}</p>
              <p className="text-xs text-green-600 mt-0.5">Click para ver documento</p>
            </div>
            {/* Ícono de enlace externo */}
            <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </div>
        </a>
        {/* Botones de acción superpuestos: solo si canEdit.
            "opacity-0 group-hover:opacity-100" = invisibles hasta hover. */}
        {canEdit && (
          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {/* Botón "Reemplazar" */}
            <button
              type="button"
              onClick={(e) => {
                // Prevenimos que el clic suba al <a> (que abriría el archivo).
                e.preventDefault();
                e.stopPropagation();
                // Disparamos el clic en el input[type=file] oculto.
                fileInputRef.current?.click();
              }}
              className="p-1.5 rounded-lg bg-white/90 border border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-white shadow-sm"
              title="Reemplazar"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </button>
            {/* Botón "Eliminar" */}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDelete();   // llama la función que borra el documento en el servidor
              }}
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
        {/* Input oculto para reemplazar el documento existente */}
        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={onUpload} className="hidden" />
      </div>
    );
  }

  // ── Estado 3: sin documento (área de subida) ────────────
  return (
    <div
      // "role" y "tabIndex" hacen el div accesible como botón
      // (solo cuando canEdit es true).
      role={canEdit ? 'button' : undefined}
      tabIndex={canEdit ? 0 : undefined}
      // "canEdit ? handler : undefined" = si no puede editar, no hay
      // manejador de eventos (el div no es interactivo).
      onClick={canEdit ? () => fileInputRef.current?.click() : undefined}
      onKeyDown={
        canEdit
          ? (e) => {
              // Permite activar el input con teclado (Enter o Espacio).
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
          {/* Ícono de subida de archivo */}
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-600">{label}</p>
          {/* Ternario: texto diferente según si puede editar o no. */}
          {canEdit ? (
            <p className="text-xs text-primary-600 font-medium mt-0.5">Click para subir documento</p>
          ) : (
            <p className="text-xs text-gray-400 mt-0.5">Sin documento</p>
          )}
        </div>
      </div>
      {/* Input oculto que se activa al hacer clic en el div */}
      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={onUpload} className="hidden" />
    </div>
  );
}
