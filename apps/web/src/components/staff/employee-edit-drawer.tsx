// ============================================================
// ARCHIVO: employee-edit-drawer.tsx
// ¿QUÉ HACE ESTE COMPONENTE?
//   Muestra un "cajón" (drawer) que ocupa toda la pantalla en
//   móvil o aparece como una tarjeta modal centrada en escritorio.
//   Dentro contiene pestañas para editar tres secciones del
//   empleado: Información, Servicios y Permisos.
// ¿QUÉ RECIBE? (props)
//   - employeeId: el ID único del empleado que se está editando.
//   - initialData: los datos actuales del empleado (nombre, email, etc.)
//   - canEdit: booleano que indica si el usuario puede editar datos.
//   - canManagePermissions: booleano para saber si puede ver la
//     pestaña de permisos.
//   - onClose: función que se llama para cerrar este cajón.
// ============================================================

'use client';
// 'use client' le dice a Next.js que este componente se ejecuta
// en el navegador (cliente), no en el servidor. Es necesario porque
// usa useState (estado interactivo) y responde a clics del usuario.

import { useState } from 'react';
// useState: hook de React que permite guardar un valor que, cuando
// cambia, hace que el componente se vuelva a dibujar (re-render).
// Aquí lo usamos para saber qué pestaña está activa.

import { EmployeePersonalInfo } from './employee-personal-info';
import { EmployeeServicesEditor } from './employee-services-editor';
import { EmployeePermissions } from './employee-permissions';
// Importamos los tres subcomponentes que se muestran según la
// pestaña activa. Cada uno maneja su propio apartado del perfil.

// ─── TIPOS (interfaces de TypeScript) ───────────────────────
// Una "interface" en TypeScript describe la forma que debe tener
// un objeto: qué propiedades tiene y de qué tipo es cada una.
// El signo "?" significa que la propiedad es opcional (puede no venir).
// "string | null" significa que puede ser texto o puede ser null (vacío).

interface InitialData {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  color?: string;
  bio?: string | null;                      // null si el empleado no escribió presentación
  bloodType?: string | null;               // tipo de sangre, opcional
  emergencyContactName?: string | null;
  emergencyContactLastName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelation?: string | null;
  allergies?: string | null;
}

interface EmployeeEditDrawerProps {
  // Estas son las "props" del componente: datos que le pasa el padre.
  employeeId: string;              // ID único del empleado (obligatorio)
  initialData: InitialData;        // datos actuales para rellenar el formulario
  canEdit: boolean;                // ¿puede el usuario logueado editar?
  canManagePermissions: boolean;   // ¿puede gestionar permisos del empleado?
  onClose: () => void;             // función sin argumentos, llama al padre para cerrar
}

// "SubTab" es un tipo especial llamado "union type": solo puede ser
// uno de estos tres strings exactos. TypeScript avisará si se usa otro valor.
type SubTab = 'info' | 'servicios' | 'permisos';

// ─── FUNCIÓN AUXILIAR ───────────────────────────────────────
// EmployeePersonalInfo declara los campos como `string | undefined`.
// Nuestro InitialData los pasa como `string | null | undefined` porque
// vienen directo del backend. Convierto null -> undefined para que TS no
// proteste y el componente no reciba un null inesperado.
function nullsToUndefined(data: InitialData): {
  // Esta función recibe datos con posibles null y los convierte a
  // undefined, porque el subcomponente EmployeePersonalInfo espera
  // undefined (no null) cuando un campo está vacío.
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  color?: string;
  bio?: string;
  bloodType?: string;
  emergencyContactName?: string;
  emergencyContactLastName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;
  allergies?: string;
} {
  return {
    firstName: data.firstName,
    lastName: data.lastName,
    email: data.email,
    phone: data.phone,
    color: data.color,
    // El operador "??" (nullish coalescing) significa: si el valor de
    // la izquierda es null o undefined, usar el de la derecha.
    // data.bio ?? undefined → si bio es null, lo convierte a undefined.
    bio: data.bio ?? undefined,
    bloodType: data.bloodType ?? undefined,
    emergencyContactName: data.emergencyContactName ?? undefined,
    emergencyContactLastName: data.emergencyContactLastName ?? undefined,
    emergencyContactPhone: data.emergencyContactPhone ?? undefined,
    emergencyContactRelation: data.emergencyContactRelation ?? undefined,
    allergies: data.allergies ?? undefined,
  };
}

// ─── COMPONENTE PRINCIPAL ────────────────────────────────────
// Usamos "destructuring" en los parámetros: en lugar de recibir un
// objeto "props" y acceder a "props.employeeId", desestructuramos
// directamente para tener las variables listas para usar.
export function EmployeeEditDrawer({
  employeeId,
  initialData,
  canEdit,
  canManagePermissions,
  onClose,
}: EmployeeEditDrawerProps) {

  // Estado local: guarda qué pestaña está activa.
  // "tab" es el valor actual, "setTab" es la función para cambiarlo.
  // El valor inicial es 'info' (siempre empieza en la primera pestaña).
  const [tab, setTab] = useState<SubTab>('info');

  // Definimos todas las pestañas posibles en un array de objetos.
  // Cada objeto tiene: key (el id interno), label (texto visible), y
  // visible (si se debe mostrar o no según los permisos del usuario).
  const tabs: { key: SubTab; label: string; visible: boolean }[] = [
    { key: 'info',      label: 'Información', visible: true },
    // La pestaña "Servicios" solo aparece si el usuario puede editar.
    { key: 'servicios', label: 'Servicios',   visible: canEdit },
    // La pestaña "Permisos" solo aparece si tiene permiso de gestionarlos.
    { key: 'permisos',  label: 'Permisos',    visible: canManagePermissions },
  ];

  // .filter() devuelve un nuevo array con solo los elementos que cumplen
  // la condición. Aquí filtramos las pestañas que tienen visible === true.
  // "t" es cada elemento del array en cada iteración.
  const visibleTabs = tabs.filter((t) => t.visible);

  // ─── JSX (lo que se dibuja en pantalla) ─────────────────────
  return (
    // Capa de fondo oscuro (overlay). Ocupa toda la pantalla con
    // position: fixed y un fondo negro semitransparente (bg-black/50).
    // Al hacer clic en este fondo, se llama onClose para cerrar el cajón.
    <div
      className="fixed inset-0 z-50 flex items-stretch md:items-center justify-center bg-black/50"
      onClick={onClose}
      // "fixed inset-0" = position:fixed + top/right/bottom/left:0 (pantalla completa)
      // "z-50" = z-index alto para quedar encima de todo
      // "flex items-stretch md:items-center" = en móvil ocupa todo el alto,
      //   en pantallas md+ se centra verticalmente
    >
      {/* Contenedor del cajón en sí. e.stopPropagation() evita que el
          clic dentro del cajón llegue al fondo oscuro y lo cierre. */}
      <div
        className="bg-white w-full md:max-w-3xl md:rounded-2xl md:max-h-[90vh] flex flex-col overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        // "e.stopPropagation()" detiene la "burbuja" del evento de clic:
        // si el usuario hace clic dentro del cajón, el evento no sube
        // hasta el div padre (el fondo oscuro) y por lo tanto no cierra.
      >
        {/* ── Encabezado del cajón ───────────────────────────── */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-shrink-0">
          {/* "flex-shrink-0" evita que este encabezado se encoja si el
              contenido es muy largo. Siempre ocupa su espacio fijo. */}
          <h2 className="text-base font-semibold text-gray-900">Editar perfil</h2>
          {/* Botón de cierre (X) en la esquina superior derecha */}
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500"
            aria-label="Cerrar"
            // aria-label: texto alternativo para lectores de pantalla (accesibilidad)
          >
            {/* Ícono SVG de "X" dibujado con dos líneas diagonales */}
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Sub-tabs (solo si hay mas de uno) */}
        {/* Renderizado condicional con &&: solo se renderiza lo que está
            a la derecha del && si la condición de la izquierda es verdadera.
            Si visibleTabs.length > 1, muestra las pestañas; si no, nada. */}
        {visibleTabs.length > 1 && (
          <div className="px-4 pt-3 flex-shrink-0">
            {/* Contenedor de las pestañas con borde redondeado */}
            <div className="flex rounded-lg border border-gray-300 overflow-hidden">
              {/* .map() recorre el array visibleTabs y devuelve un
                  botón por cada pestaña visible.
                  "t" = objeto de cada pestaña { key, label, visible }
                  "key={t.key}" es obligatorio en listas de React para
                  identificar cada elemento de forma única. */}
              {visibleTabs.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  // Al hacer clic, actualizamos el estado "tab" con la
                  // key de la pestaña clicada. Esto provoca un re-render
                  // y el contenido cambia a la sección correspondiente.
                  onClick={() => setTab(t.key)}
                  // Estilo condicional con template literal (${}).
                  // Si la pestaña activa (tab) es igual a esta (t.key),
                  // se aplica el estilo de "seleccionado" (teal + texto blanco).
                  // Si no, estilo de "no seleccionado" (blanco + texto gris).
                  className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                    tab === t.key
                      ? 'bg-[#008080] text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Contenido scrolleable */}
        {/* "flex-1" hace que este div ocupe todo el espacio restante
            después del header y las pestañas. "overflow-y-auto" permite
            scroll vertical si el contenido es más alto que el espacio. */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Renderizado condicional: solo muestra el subcomponente
              cuya key coincide con la pestaña activa (tab). */}

          {/* Pestaña "Información": información básica y personal */}
          {tab === 'info' && (
            <EmployeePersonalInfo
              employeeId={employeeId}
              // Pasamos los datos convertidos (null → undefined) para
              // que EmployeePersonalInfo los acepte sin errores de TS.
              initialData={nullsToUndefined(initialData)}
              canEdit={canEdit}
            />
          )}

          {/* Pestaña "Servicios": qué servicios ofrece el empleado.
              Doble condición: la pestaña activa debe ser 'servicios'
              Y además el usuario debe tener permiso de editar. */}
          {tab === 'servicios' && canEdit && (
            <EmployeeServicesEditor employeeId={employeeId} />
          )}

          {/* Pestaña "Permisos": roles y acceso de administrador.
              Solo se muestra si la pestaña activa es 'permisos' y
              el usuario tiene canManagePermissions = true. */}
          {tab === 'permisos' && canManagePermissions && (
            <EmployeePermissions
              employeeId={employeeId}
              canManage={canManagePermissions}
            />
          )}
        </div>
      </div>
    </div>
  );
}
