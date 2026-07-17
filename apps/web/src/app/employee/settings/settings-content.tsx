// ─────────────────────────────────────────────────────────────────────────────
// ARCHIVO: apps/web/src/app/employee/settings/settings-content.tsx
//
// QUÉ HACE ESTE ARCHIVO:
//   Exporta el componente EmployeeSettingsContent, que es el formulario
//   completo de edición de perfil del empleado. Permite:
//   - Ver y editar nombre, apellido, email, teléfono y bio (presentación).
//   - Cambiar la foto de perfil (avatar) con recorte.
//   - Cambiar la foto de portada (cover).
//   - Editar información médica (tipo de sangre, alergias).
//   - Editar el contacto de emergencia.
//   - Cambiar la contraseña.
//   - Cerrar sesión o cambiar de perfil.
//
// CUÁNDO SE USA:
//   1. Desde /employee/settings?section=profile (página de configuración).
//   2. Embebido en la pestaña "Info Personal" del perfil del empleado
//      (prop embedded=true).
//
// CONCEPTOS CLAVE:
//   - useQuery: carga datos del servidor de forma automática y los cachea.
//   - useMutation: envía cambios al servidor (guardar, subir imagen).
//   - useRef: referencia directa a un elemento del DOM (el input de archivo).
//   - Estado múltiple con useState para formularios complejos.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

// ─── IMPORTACIONES ────────────────────────────────────────────────────────────
// useState: crea variables de estado que hacen re-render al cambiar.
// useRef: crea una referencia mutable a un elemento DOM. A diferencia de
//   useState, cambiar un ref NO dispara re-render. Se usa para acceder
//   programáticamente al input[type="file"] (abrirlo sin que el usuario
//   haga clic directamente en él).
import { useState, useRef } from 'react';

// Hook de autenticación: devuelve "user" (datos del usuario logueado)
// y "logout" (función para cerrar sesión).
import { useAuth } from '@/lib/hooks/use-auth';

// signOutAll: función que limpia TODOS los tokens de sesión almacenados
// (útil cuando el usuario tiene múltiples perfiles/tokens activos).
import { signOutAll } from '@/lib/sign-out-all';

// TanStack Query (antes React Query):
// - useQuery: para LEER datos del servidor (GET).
// - useMutation: para ESCRIBIR datos en el servidor (POST/PUT/DELETE).
// - useQueryClient: accede al cliente global de caché para invalidar queries.
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Hooks de Next.js para navegación:
// - useRouter: permite navegar programáticamente (router.push('/ruta')).
// - useSearchParams: lee los parámetros de la URL (?key=value).
import { useRouter, useSearchParams } from 'next/navigation';

// api: objeto cliente HTTP que envuelve fetch con el token JWT automáticamente.
// Métodos: api.get(), api.post(), api.put(), api.upload() (multipart).
import { api } from '@/lib/api';

// Modal estándar de confirmación de guardado (único para toda la app).
import { showSaveSuccess } from '@/lib/save-toast';

// Modal para recortar la foto de perfil antes de subirla.
// Muestra una interfaz de crop circular para que el avatar quede bien.
import { AvatarCropModal } from '@/components/ui/avatar-crop-modal';
import { CoverCropModal } from '@/components/ui/cover-crop-modal';

// Selector de alergias: un componente con chips/píldoras seleccionables
// (Látex, Polen, Mariscos, etc.).
import { AllergiesSelector } from '@/components/ui/allergies-selector';

// Link de Next.js para navegación interna sin recarga de página.
import Link from 'next/link';

// ─── CONSTANTES ───────────────────────────────────────────────────────────────
// URL base del API. Se lee desde una variable de entorno de Next.js.
// Las variables NEXT_PUBLIC_ son las únicas accesibles en el navegador
// (las demás son sólo para el servidor). Si no está definida, usamos localhost.
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Lista de tipos de sangre válidos para el selector.
const BLOOD_TYPES = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];

// Lista de relaciones posibles para el contacto de emergencia.
const RELATIONS = ['Padre/Madre', 'Hermano/a', 'Esposo/a', 'Pareja', 'Hijo/a', 'Tío/a', 'Amigo/a', 'Otro'];

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
// ─── Profile Editor (used embedded in Mi Perfil → Info Personal) ───
//
// CONCEPTO — Props (propiedades) e interfaz TypeScript:
//   La firma "{ embedded }: { embedded?: boolean } = {}" define que:
//   - El componente recibe un objeto de props.
//   - "embedded" es una prop opcional (el "?" la hace opcional).
//   - Si no se pasa ninguna prop, el objeto por defecto es {} (vacío).
//   Cuando embedded=true, el componente se muestra sin padding exterior
//   y sin cabecera "Mi Perfil", porque ya está dentro de otra página.
export function EmployeeSettingsContent({ embedded }: { embedded?: boolean } = {}) {
  // ─── HOOKS DE CONTEXTO Y NAVEGACIÓN ──────────────────────────────────────
  // Obtenemos el usuario logueado y la función logout del contexto global.
  const { user, logout } = useAuth();
  // Freelancer (profesional independiente): puede elegir su profesión para
  // aparecer en el filtro de profesionales del marketplace.
  const isFreelancer = (user as any)?.tenantType === 'FREELANCER';

  // Router de Next.js para navegar programáticamente (ej. router.push('/login')).
  const router = useRouter();

  // Leemos los parámetros de la URL actual.
  const searchParams = useSearchParams();

  // Cliente de caché de React Query. Permite invalidar (borrar de caché)
  // queries para que se vuelvan a cargar con datos frescos del servidor.
  const queryClient = useQueryClient();

  // ─── REFS ─────────────────────────────────────────────────────────────────
  // CONCEPTO — useRef:
  //   useRef(null) crea un objeto { current: null }.
  //   Cuando se pone "ref={fileInputRef}" en un elemento JSX, React asigna
  //   automáticamente el elemento DOM real a "fileInputRef.current".
  //   Así podemos llamar a fileInputRef.current.click() para abrir el
  //   selector de archivos del sistema operativo programáticamente.

  // Ref para el input de archivo del AVATAR (foto de perfil).
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Ref para el input de archivo de la PORTADA (cover/banner).
  const coverFileInputRef = useRef<HTMLInputElement>(null);

  // ─── ESTADO LOCAL ─────────────────────────────────────────────────────────
  // Archivo de imagen seleccionado para recortar (antes de subir el avatar).
  // null = no hay archivo pendiente de recortar.
  const [cropFile, setCropFile] = useState<File | null>(null);
  // Archivo de portada seleccionado, para recortarlo en el CoverCropModal antes
  // de subir (igual que el avatar). Así se redimensiona y no supera el límite.
  const [coverCropFile, setCoverCropFile] = useState<File | null>(null);

  // Controla si el formulario de edición está visible.
  // Se inicia como "true" (abierto) si:
  //   - La URL tiene ?edit=true, O
  //   - La URL tiene ?section=profile (abierto desde configuración), O
  //   - Se pasa embedded=true (siempre en modo edición cuando está embebido).
  const [isEditing, setIsEditing] = useState(searchParams.get('edit') === 'true' || searchParams.get('section') === 'profile' || embedded === true);

  // Formulario de datos básicos del empleado (se sincroniza con la BD).
  // Empieza con strings vacíos; se llena cuando llegan los datos del servidor.
  const [editForm, setEditForm] = useState({ firstName: '', lastName: '', email: '', phone: '', bio: '', jobTitle: '' });

  // Formulario de información personal/médica y contacto de emergencia.
  const [personalForm, setPersonalForm] = useState({ bloodType: '', allergies: '', emergencyContactName: '', emergencyContactLastName: '', emergencyContactPhone: '', emergencyContactRelation: '' });

  // Formulario de cambio de contraseña.
  // "current": contraseña actual, "new": nueva, "confirm": confirmación.
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });

  // Mensaje de error al intentar cambiar la contraseña (null = sin error).
  const [passwordError, setPasswordError] = useState<string | null>(null);


  // ─── QUERY: carga de datos del empleado ──────────────────────────────────
  // CONCEPTO — useQuery (TanStack Query):
  //   useQuery hace una petición GET al servidor y:
  //   - Mientras carga: data=undefined, isLoading=true.
  //   - Al terminar: data = respuesta del servidor.
  //   - En error: isError=true, error=objeto de error.
  //   El resultado se cachea con la "queryKey". Si otro componente pide
  //   la misma key, reutiliza el caché sin volver a pedir al servidor.
  //
  // queryKey: ['employee-settings', user?.employeeId]
  //   Es el identificador único de este caché. Es un array porque permite
  //   incluir variables (el ID del empleado) para tener cachés distintos
  //   por empleado.
  //
  // queryFn: función que hace la petición real. Retorna una promesa.
  //   api.get() devuelve { data: <objeto empleado> }, por eso hacemos
  //   .then((r) => r.data) para quedarnos sólo con el objeto.
  //
  // enabled: !!user?.employeeId
  //   La query SÓLO se ejecuta si empleadoId existe.
  //   "!!" convierte cualquier valor a boolean (truthy/falsy).
  //   Si user es null, !!null = false → la query no se lanza.
  const { data: empData } = useQuery({
    queryKey: ['employee-settings', user?.employeeId],
    queryFn: () => api.get<{ data: any }>(`/api/employees/me`).then((r) => r.data),
    enabled: !!user?.employeeId,
  });

  // Catálogo de profesiones del marketplace (barbero, colorista, etc.). Solo se
  // pide para freelancers, que son quienes eligen su profesión.
  const { data: professionList } = useQuery({
    queryKey: ['professions-catalog'],
    queryFn: () => api.get<{ data: string[] }>('/api/marketplace/professions').then((r) => r.data),
    enabled: isFreelancer,
  });

  // ─── INICIALIZACIÓN DEL FORMULARIO (una sola vez) ─────────────────────────
  // Fill form when data loads
  //
  // Patrón de inicialización diferida: el formulario comienza vacío y se
  // llena cuando llegan los datos del servidor (empData).
  //
  // "formInitialized" evita que el formulario se sobrescriba en cada re-render.
  // Sin este flag, cada vez que React re-renderizara el componente (por
  // cualquier cambio de estado), los formularios se reiniciarían con los
  // datos de empData, borrando lo que el usuario haya escrito.
  //
  // NOTA TÉCNICA: llamar a setState directamente durante el renderizado
  // (fuera de useEffect) está permitido en React sólo si se hace de forma
  // condicional como aquí (sólo la primera vez que empData llega).
  const [formInitialized, setFormInitialized] = useState(false);
  if (empData && !formInitialized) {
    // Llenamos editForm con los datos actuales del empleado.
    // "|| ''" proporciona un string vacío como fallback si el campo es null.
    setEditForm({ firstName: empData.firstName, lastName: empData.lastName, email: empData.email || '', phone: empData.phone || '', bio: empData.bio || '', jobTitle: empData.jobTitle || '' });
    // Llenamos personalForm con los datos médicos y de emergencia.
    setPersonalForm({ bloodType: empData.bloodType || '', allergies: empData.allergies || '', emergencyContactName: empData.emergencyContactName || '', emergencyContactLastName: empData.emergencyContactLastName || '', emergencyContactPhone: empData.emergencyContactPhone || '', emergencyContactRelation: empData.emergencyContactRelation || '' });
    // Marcamos como inicializado para no volver a ejecutar este bloque.
    setFormInitialized(true);
  }

  // ─── MUTATION: guardar perfil ─────────────────────────────────────────────
  // CONCEPTO — useMutation (TanStack Query):
  //   useMutation es para operaciones que MODIFICAN datos (POST/PUT/DELETE).
  //   A diferencia de useQuery, NO se ejecuta automáticamente al montar
  //   el componente. Se llama manualmente con saveMutation.mutate().
  //
  //   mutationFn: la función async que hace las peticiones. Puede ser una
  //   función que recibe parámetros (en este caso no los necesita porque
  //   usa los estados locales directamente).
  //
  //   onSuccess: se ejecuta cuando mutationFn termina sin error.
  const saveMutation = useMutation({
    mutationFn: async () => {
      // Primera petición: actualiza los datos básicos del empleado.
      await api.put('/api/employees/me', editForm);
      // Segunda petición: actualiza los datos personales/médicos.
      await api.put('/api/employees/me/personal-info', personalForm);
    },
    // Recarga la pagina post-guardado: garantiza que el banner "Completa
    // tu perfil" del layout reevalue el progreso desde cero (la query de
    // empData solo invalida los hooks del componente, no el layout padre).
    //
    // window.location.reload() fuerza una recarga completa del navegador.
    // Esto es necesario porque el layout padre (employee/layout.tsx) tiene
    // un banner de progreso que no se actualiza con invalidateQueries.
    onSuccess: () => { window.location.reload(); },
  });

  // ─── MUTATION: subir avatar ───────────────────────────────────────────────
  // mutationFn recibe el archivo (File) a subir.
  // api.upload() construye un FormData y lo envía como multipart/form-data.
  const avatarMutation = useMutation({
    mutationFn: (file: File) => api.upload('/api/employees/me/avatar', file),
    // Mismo motivo que saveMutation: el banner vive en employee/layout.tsx
    // y solo refresca su estado cuando la pagina se vuelve a montar.
    onSuccess: () => { window.location.reload(); },
    onError: () => alert('No se pudo subir la foto de perfil'),
  });

  // ─── MUTATION: subir foto de portada ─────────────────────────────────────
  const coverMutation = useMutation({
    mutationFn: (file: File) => api.upload('/api/employees/me/cover', file),
    // Mismo motivo que saveMutation: el banner vive en employee/layout.tsx
    // y solo refresca su estado cuando la pagina se vuelve a montar.
    onSuccess: () => { window.location.reload(); },
    onError: () => alert('No se pudo subir la portada'),
  });

  // ─── MUTATION: cambiar contraseña ─────────────────────────────────────────
  const passwordMutation = useMutation({
    // Envía la contraseña actual y la nueva al backend para verificar y cambiar.
    mutationFn: () => api.put('/api/auth/change-password', { currentPassword: passwordForm.current, newPassword: passwordForm.new }),
    onSuccess: () => {
      // Limpiamos el formulario de contraseña.
      setPasswordForm({ current: '', new: '', confirm: '' });
      // Modal estándar de confirmación de guardado.
      showSaveSuccess({ title: 'Contraseña actualizada' });
    },
    // Si el backend devuelve error (contraseña actual incorrecta, etc.),
    // guardamos el mensaje de error en el estado para mostrarlo.
    onError: (err: any) => setPasswordError(err.message || 'Error al cambiar contraseña'),
  });

  // ─── FUNCIÓN: activar modo edición ───────────────────────────────────────
  // Antes de mostrar el formulario, sincronizamos los estados del formulario
  // con los datos actuales del servidor (por si empData cambió).
  function startEdit() {
    if (empData) {
      setEditForm({ firstName: empData.firstName, lastName: empData.lastName, email: empData.email || '', phone: empData.phone || '', bio: empData.bio || '', jobTitle: empData.jobTitle || '' });
      setPersonalForm({ bloodType: empData.bloodType || '', allergies: empData.allergies || '', emergencyContactName: empData.emergencyContactName || '', emergencyContactLastName: empData.emergencyContactLastName || '', emergencyContactPhone: empData.emergencyContactPhone || '', emergencyContactRelation: empData.emergencyContactRelation || '' });
    }
    // Activamos el modo edición (muestra el formulario).
    setIsEditing(true);
  }

  // ─── GUARDIA: sin perfil de empleado ──────────────────────────────────────
  // Si el usuario no tiene employeeId vinculado, mostramos un mensaje de error
  // y terminamos. Este "early return" evita errores en el resto del componente.
  if (!user?.employeeId) return <div className="p-6 text-sm text-gray-400">Sin perfil de empleado</div>;

  // ─── RENDERIZADO ──────────────────────────────────────────────────────────
  return (
    // El className cambia según si el componente está embebido o no.
    // - Embebido (embedded=true): sin padding propio (la página padre lo pone).
    // - No embebido: padding propio + ancho máximo + padding inferior para móvil.
    <div className={embedded ? 'max-w-2xl mx-auto' : 'p-6 max-w-2xl mx-auto pb-24 lg:pb-6'}>

      {/* CABECERA (sólo cuando NO está embebido) ────────────────────────────
          CONCEPTO — Renderizado condicional con &&:
          "!embedded && (<JSX>)" significa:
          - Si embedded es false/undefined, muestra el JSX.
          - Si embedded es true, no muestra nada.
          Es el equivalente a un "if" sin "else":
            if (!embedded) { return <JSX /> }
          El operador && en JSX: cuando la izquierda es truthy, React renderiza
          la derecha. Cuando es falsy (false, null, undefined, 0), no renderiza nada. */}
      {!embedded && (
        <div className="flex items-center gap-3 mb-6">
          {/* Botón de volver: navega al inicio del portal del empleado */}
          <button onClick={() => router.push('/employee')} className="w-9 h-9 rounded-full flex items-center justify-center bg-white border border-gray-200 hover:bg-gray-50">
            {/* Icono flecha izquierda (SVG) */}
            <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
          </button>
          <h1 className="text-lg font-bold text-gray-900">Mi Perfil</h1>
        </div>
      )}

      {/* "space-y-4": margen vertical de 4 unidades entre tarjetas */}
      <div className="space-y-4">
        {/* ── TARJETA: Avatar + datos básicos ──────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Foto de portada — banner editable. Click para cambiarla; si no
              hay foto, fondo teal con icono camara. */}

          {/* ── Portada (cover/banner) ───────────────────────────────────────
              "group": clase de Tailwind que permite que los hijos reaccionen
              al hover del padre con "group-hover:". */}
          <div
            className="relative h-28 cursor-pointer group"
            onClick={() => coverFileInputRef.current?.click()}
            style={{
              // Si hay foto de portada, la ponemos como imagen de fondo.
              // template literal: `url(${API_URL}${empData.coverImageUrl})`
              // Une la URL del servidor con la ruta de la imagen.
              backgroundImage: empData?.coverImageUrl ? `url(${API_URL}${empData.coverImageUrl})` : undefined,
              // Si NO hay foto, usamos el color del empleado como fondo sólido.
              // "undefined" desactiva la propiedad CSS (no la aplica).
              backgroundColor: empData?.coverImageUrl ? undefined : (empData?.color || '#008080'),
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            {/* Overlay semitransparente que oscurece la portada en hover.
                "absolute inset-0": cubre exactamente el div padre (posición absoluta,
                a 0px de todos los bordes). */}
            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center">
              {/* CONCEPTO — Renderizado condicional con ternario:
                  condición ? <siVerdadero> : <siFalso>
                  Si la mutación de portada está en curso (isPending=true),
                  mostramos un spinner (animación de carga).
                  Si no está cargando, mostramos el botón de cambiar portada. */}
              {coverMutation.isPending ? (
                // Spinner: círculo animado que gira. CSS animation "animate-spin".
                // "border-t-transparent" hace que sólo 3/4 del borde sean visibles,
                // creando el efecto de carga circular.
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent" />
              ) : (
                // Botón "Cambiar/Agregar portada" SIEMPRE visible (antes solo en
                // hover, lo que ocultaba para qué servía el rectángulo).
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 text-gray-700 text-xs font-semibold shadow-sm">
                  {/* Icono cámara SVG */}
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M9 2L7.17 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V6a2 2 0 00-2-2h-3.17L15 2H9zm3 15a5 5 0 110-10 5 5 0 010 10zm0-2a3 3 0 100-6 3 3 0 000 6z"/>
                  </svg>
                  {/* Texto dinámico: "Cambiar" si ya hay portada, "Agregar" si no. */}
                  {empData?.coverImageUrl ? 'Cambiar portada' : 'Agregar portada'}
                </div>
              )}
            </div>

            {/* Input de archivo OCULTO para la portada.
                "hidden": invisible pero funcional.
                "ref={coverFileInputRef}": permite abrirlo con .click() programáticamente.
                "accept": restringe los tipos de archivo aceptados.
                onChange: cuando el usuario selecciona un archivo, lo subimos. */}
            <input
              ref={coverFileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                // e.target.files es un FileList (como un array). [0] = primer archivo.
                // "?." = optional chaining: si files es null, devuelve undefined.
                const f = e.target.files?.[0];
                // En vez de subir el archivo RAW (que puede pasar de 5MB y fallar
                // en silencio), lo pasamos por el modal de recorte, que genera un
                // JPEG redimensionado — igual que el avatar.
                if (f) setCoverCropFile(f);
                // Limpiamos el input para que el onChange se dispare aunque el
                // usuario seleccione el mismo archivo dos veces.
                e.target.value = '';
              }}
            />
          </div>

          {/* ── Área de datos (bajo la portada) ──────────────────────────── */}
          <div className="p-5">
          {/* Fila: avatar + nombre + botón editar */}
          <div className="flex items-center gap-4 mb-4">
            {/* ── Avatar (foto de perfil) ───────────────────────────────────
                "flex-shrink-0": evita que el avatar se achique en pantallas pequeñas. */}
            <div
              className="relative group cursor-pointer flex-shrink-0"
              onClick={() => fileInputRef.current?.click()}
              title={empData?.avatarUrl ? 'Cambiar foto de perfil' : 'Agregar foto de perfil'}
            >
              {/* Círculo del avatar: fondo con el color del empleado.
                  "overflow-hidden": recorta la imagen para que no salga del círculo. */}
              <div className="w-16 h-16 rounded-full overflow-hidden flex items-center justify-center text-xl font-bold text-white" style={{ backgroundColor: empData?.color || '#008080' }}>
                {/* CONCEPTO — Renderizado condicional con ternario:
                    Si el empleado tiene foto (avatarUrl), la mostramos.
                    Si no, mostramos sus iniciales (primera letra de nombre y apellido).
                    "empData?.firstName?.[0]" → accede al primer carácter del nombre. */}
                {empData?.avatarUrl ? <img src={`${API_URL}${empData.avatarUrl}`} alt="" className="w-full h-full object-cover" /> : <>{empData?.firstName?.[0]}{empData?.lastName?.[0]}</>}
              </div>
              {/* Overlay completo en hover (desktop) */}
              {/* Overlay oscuro con icono cámara, visible sólo en hover del grupo. */}
              <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" /><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" /></svg>
              </div>
              {/* Badge camara permanente — visible siempre (mobile + desktop) */}
              {/* Insignia circular con icono cámara, siempre visible en la
                  esquina inferior derecha del avatar. En hover escala un poco. */}
              <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-[#008080] border-2 border-white flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M9 2L7.17 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V6a2 2 0 00-2-2h-3.17L15 2H9zm3 15a5 5 0 110-10 5 5 0 010 10zm0-2a3 3 0 100-6 3 3 0 000 6z"/>
                </svg>
              </div>

              {/* Input de archivo OCULTO para el avatar.
                  A diferencia del de la portada, este NO sube directamente:
                  guarda el archivo en "cropFile" para mostrarlo en el modal
                  de recorte (AvatarCropModal) antes de subirlo. */}
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setCropFile(f); e.target.value = ''; }} />
            </div>

            {/* Nombre y email del empleado */}
            <div className="flex-1">
              <p className="font-semibold text-gray-900">{empData?.firstName} {empData?.lastName}</p>
              <p className="text-xs text-gray-500">{empData?.email}</p>
            </div>

            {/* Botón "Editar perfil": sólo visible cuando NO estamos editando.
                CONCEPTO — && para renderizado condicional:
                "!isEditing && <botón>" → el botón sólo aparece si isEditing es false. */}
            {!isEditing && (
              <button onClick={startEdit} className="text-xs text-[#008080] font-medium hover:underline">Editar perfil</button>
            )}
          </div>

          {/* ── Formulario de edición (sólo visible en modo edición) ─────────
              "isEditing && (<formulario>)" → se muestra sólo cuando isEditing=true. */}
          {isEditing && (
            <div className="space-y-3 pt-3 border-t border-gray-100">
              {/* Nombre y Apellido en dos columnas */}
              <div className="grid grid-cols-2 gap-3">
                {/* Campo Nombre:
                    - value={editForm.firstName}: el input muestra el estado actual.
                    - onChange: actualiza sólo el campo "firstName" del estado,
                      manteniendo el resto igual con spread "...f".
                    "input-field": clase CSS reutilizable definida en globals.css. */}
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Nombre</label><input type="text" value={editForm.firstName} onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))} className="input-field" /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Apellido</label><input type="text" value={editForm.lastName} onChange={(e) => setEditForm((f) => ({ ...f, lastName: e.target.value }))} className="input-field" /></div>
              </div>
              {/* Campo Email */}
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Email</label><input type="email" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} className="input-field" /></div>
              {/* Campo Teléfono */}
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Teléfono</label><input type="tel" value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} className="input-field" /></div>
              {/* Campo Bio (presentación): textarea de varias líneas */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Presentación</label>
                <p className="text-[11px] text-gray-400 mb-1.5 leading-relaxed">
                  Cuéntale a tus clientes quién eres, tu experiencia y especialidades. Este texto aparece en tu perfil público del marketplace.
                </p>
                {/* textarea: área de texto de múltiples líneas.
                    "resize-none": desactiva el redimensionado manual con el mouse.
                    "rows={4}": altura inicial de 4 líneas. */}
                <textarea
                  value={editForm.bio}
                  onChange={(e) => setEditForm((f) => ({ ...f, bio: e.target.value }))}
                  className="input-field resize-none"
                  rows={4}
                  placeholder="Ej: Estilista con 8 años de experiencia, especializada en colorimetría y cortes modernos…"
                />
              </div>

              {/* Profesión — solo freelancers. Determina en qué profesión(es)
                  aparece en el filtro de profesionales del marketplace. Se guarda
                  en jobTitle (varias separadas por coma), donde el filtro ya busca. */}
              {isFreelancer && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Profesión</label>
                  <p className="text-[11px] text-gray-400 mb-1.5 leading-relaxed">
                    Elige a qué te dedicas. Así los clientes te encuentran en el filtro de profesionales del marketplace. Puedes marcar más de una.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(professionList || []).map((name) => {
                      const selected = editForm.jobTitle.split(',').map((s) => s.trim()).filter(Boolean);
                      const active = selected.includes(name);
                      return (
                        <button
                          key={name}
                          type="button"
                          onClick={() => setEditForm((f) => {
                            const cur = f.jobTitle.split(',').map((s) => s.trim()).filter(Boolean);
                            const next = cur.includes(name) ? cur.filter((p) => p !== name) : [...cur, name];
                            return { ...f, jobTitle: next.join(', ') };
                          })}
                          className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
                            active
                              ? 'bg-[#008080] border-[#008080] text-white'
                              : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          {name}
                        </button>
                      );
                    })}
                    {(!professionList || professionList.length === 0) && (
                      <span className="text-xs text-gray-400">No hay profesiones en el catálogo todavía.</span>
                    )}
                  </div>
                </div>
              )}

              {/* ── Sección: Información médica ───────────────────────────── */}
              <h4 className="text-xs font-semibold text-gray-500 uppercase pt-2">Información médica</h4>
              {/* Selector de alergias: componente especializado con chips seleccionables.
                  "value": el string actual de alergias seleccionadas.
                  "onChange": callback que recibe el nuevo valor cuando el usuario
                  selecciona/deselecciona una alergia. */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Alergias <span className="text-[10px] text-gray-400 font-normal">(opcional)</span>
                </label>
                <AllergiesSelector value={personalForm.allergies} onChange={(v) => setPersonalForm((f) => ({ ...f, allergies: v }))} />
              </div>

              {/* ── Sección: Contacto de emergencia ──────────────────────── */}
              <h4 className="text-xs font-semibold text-gray-500 uppercase pt-2">Contacto de emergencia</h4>
              <div className="grid grid-cols-2 gap-3">
                {/* Campo Nombre del contacto de emergencia.
                    "autoComplete="off"" desactiva el autocompletado del navegador
                    (para que no confunda con el campo de nombre propio arriba). */}
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Nombre</label><input type="text" autoComplete="off" name="emergencyName" value={personalForm.emergencyContactName} onChange={(e) => setPersonalForm((f) => ({ ...f, emergencyContactName: e.target.value }))} className="input-field" /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Apellido</label><input type="text" autoComplete="off" name="emergencyLastName" value={personalForm.emergencyContactLastName} onChange={(e) => setPersonalForm((f) => ({ ...f, emergencyContactLastName: e.target.value }))} className="input-field" /></div>
                {/* Campo Teléfono del contacto de emergencia.
                    "inputMode="numeric"": en móvil muestra el teclado numérico.
                    "maxLength={10}": máximo 10 caracteres.
                    onChange: .replace(/\D/g, '') elimina todo lo que NO sea dígito.
                    .slice(0, 10) limita a 10 caracteres. */}
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Teléfono</label><input type="tel" autoComplete="off" inputMode="numeric" name="emergencyPhone" maxLength={10} placeholder="10 dígitos" value={personalForm.emergencyContactPhone} onChange={(e) => setPersonalForm((f) => ({ ...f, emergencyContactPhone: e.target.value.replace(/\D/g, '').slice(0, 10) }))} className="input-field" /></div>
                {/* Select de relación con el contacto */}
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Relación</label><select value={personalForm.emergencyContactRelation} onChange={(e) => setPersonalForm((f) => ({ ...f, emergencyContactRelation: e.target.value }))} className="input-field"><option value="">—</option>{RELATIONS.map((r) => <option key={r} value={r}>{r}</option>)}</select></div>
              </div>

              {/* Botones de acción: Guardar (grande, abajo) y Cancelar.
                  Al guardar, la mutación recarga y el formulario vuelve a modo
                  sólo lectura → efecto de "salir de la edición". */}
              <div className="flex gap-2 pt-3">
                {/* Botón Cancelar: vuelve al modo de sólo lectura (oculta el formulario) */}
                <button onClick={() => setIsEditing(false)} className="px-4 py-3 rounded-xl text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50">Cancelar</button>
                {/* Botón Guardar: grande y ocupa el resto del ancho. */}
                <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: '#008080' }}>{saveMutation.isPending ? 'Guardando...' : 'Guardar'}</button>
              </div>
            </div>
          )}
          </div>
        </div>

        {/* ── TARJETA: Cambiar contraseña ──────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Cambiar contraseña</h3>
          <div className="space-y-3">
            {/* Tres campos de contraseña: actual, nueva y confirmación.
                "type="password"": el texto se oculta con puntos/asteriscos.
                El pattern de actualización es el mismo para los tres:
                setPasswordForm((f) => ({ ...f, campo: nuevoValor }))
                Este patrón usa el "setter funcional" de useState:
                - (f) => { ... } es una función que recibe el estado ACTUAL (f)
                - { ...f, campo: valor } crea un nuevo objeto copiando f y
                  sobreescribiendo sólo el campo que cambió.
                Esto es necesario porque si usáramos setPasswordForm({ campo: valor })
                sin el spread, borraríamos los otros campos del objeto. */}
            <input type="password" value={passwordForm.current} onChange={(e) => setPasswordForm((f) => ({ ...f, current: e.target.value }))} className="input-field" placeholder="Contraseña actual" />
            <input type="password" value={passwordForm.new} onChange={(e) => setPasswordForm((f) => ({ ...f, new: e.target.value }))} className="input-field" placeholder="Nueva contraseña" />
            <input type="password" value={passwordForm.confirm} onChange={(e) => setPasswordForm((f) => ({ ...f, confirm: e.target.value }))} className="input-field" placeholder="Confirmar contraseña" />

            {/* Mensaje de error (sólo si passwordError no es null).
                CONCEPTO — && para renderizado condicional:
                "passwordError && <p>..." → si hay error, muestra el párrafo. */}
            {passwordError && <p className="text-xs text-red-600">{passwordError}</p>}

            {/* Botón Cambiar contraseña:
                onClick hace 3 cosas:
                1. Comprueba que las contraseñas coinciden. Si no, muestra error y sale.
                2. Limpia cualquier error previo.
                3. Lanza la mutation de cambio de contraseña.
                disabled: el botón está desactivado si cualquiera de los dos campos
                principales está vacío (cortocircuito con "||"). */}
            <button onClick={() => { if (passwordForm.new !== passwordForm.confirm) { setPasswordError('Las contraseñas no coinciden'); return; } setPasswordError(null); passwordMutation.mutate(); }} disabled={!passwordForm.current || !passwordForm.new} className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50" style={{ backgroundColor: '#008080' }}>Cambiar</button>
          </div>
        </div>

        {/* Cambiar perfil + Logout */}
        {/* Botón "Cambiar perfil": navega al login para iniciar sesión con otra cuenta */}
        <button
          onClick={() => router.push('/login')}
          className="w-full py-3 rounded-xl text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 transition-colors mb-2"
        >
          Elige el tipo de acceso
        </button>

        {/* Botón "Cerrar sesión":
            "async" porque signOutAll() es una promesa (operación asíncrona).
            "await signOutAll()" espera a que limpie todos los tokens.
            Luego redirige al login. */}
        <button
          onClick={async () => {
            await signOutAll();
            router.push('/login');
          }}
          className="w-full py-3 rounded-xl text-sm font-medium text-red-600 bg-white border border-gray-200 hover:bg-red-50 transition-colors"
        >
          Cerrar sesión
        </button>
      </div>

      {/* ── MODAL DE RECORTE DE AVATAR ─────────────────────────────────────────
          CONCEPTO — Renderizado condicional con && para modales:
          "cropFile && <Modal />" → el modal SÓLO se monta (aparece) cuando
          hay un archivo seleccionado para recortar (cropFile no es null).
          Cuando el usuario cancela o acepta, setCropFile(null) lo desmonta.

          Props del modal:
          - imageFile: el archivo a recortar.
          - onCancel: cancela y cierra el modal (cropFile = null).
          - onChooseAnother: cierra el modal y abre el selector de archivos de nuevo.
          - onAccept: recibe el archivo recortado y lo sube con avatarMutation. */}
      {cropFile && (
        <AvatarCropModal imageFile={cropFile} onCancel={() => setCropFile(null)} onChooseAnother={() => { setCropFile(null); fileInputRef.current?.click(); }} onAccept={(f) => { avatarMutation.mutate(f); setCropFile(null); }} />
      )}

      {/* Modal de recorte de la PORTADA (vertical 9:16). Al aceptar, sube el
          archivo recortado/redimensionado con coverMutation. */}
      {coverCropFile && (
        <CoverCropModal
          imageFile={coverCropFile}
          aspect="portrait"
          onCancel={() => setCoverCropFile(null)}
          onChooseAnother={() => { setCoverCropFile(null); coverFileInputRef.current?.click(); }}
          onAccept={(f) => { coverMutation.mutate(f); setCoverCropFile(null); }}
        />
      )}
    </div>
  );
}
