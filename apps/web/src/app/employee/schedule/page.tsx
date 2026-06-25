// ─────────────────────────────────────────────────────────────────────────────
// ARCHIVO: apps/web/src/app/employee/schedule/page.tsx
// RUTA EN EL NAVEGADOR: /employee/schedule
//
// QUÉ HACE ESTA PÁGINA:
//   Muestra el editor de horario del empleado. El empleado puede ver y
//   modificar en qué días y horarios trabaja cada semana.
//   Por ejemplo: Lunes a Viernes de 9:00 a 18:00, Sábados de 10:00 a 14:00.
//
// FLUJO PRINCIPAL:
//   1. Se obtiene el usuario autenticado con useAuth().
//   2. Si el usuario NO tiene employeeId (no está vinculado a un empleado),
//      se muestra un aviso de error en lugar de la pantalla normal.
//   3. Si sí tiene employeeId, se muestra el editor de horario pasándole
//      el ID del empleado como prop.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

// ─── IMPORTACIONES ────────────────────────────────────────────────────────────
// useAuth: hook personalizado que devuelve el usuario autenticado actualmente.
// Un "hook" en React es una función especial que empieza con "use" y permite
// acceder a estado o funcionalidades del sistema (como el usuario logueado).
import { useAuth } from '@/lib/hooks/use-auth';

// EmployeeScheduleEditor: componente visual que muestra y permite editar
// los horarios semanales del empleado. Recibe el ID del empleado como prop.
import { EmployeeScheduleEditor } from '@/components/staff/employee-schedule-editor';

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function EmployeeSchedulePage() {
  // ─── HOOK useAuth ───────────────────────────────────────────────────────────
  // Llamamos a useAuth() para obtener el objeto "user" con los datos del
  // usuario actualmente logueado. "user" puede ser null si no hay sesión.
  // Desestructuramos sólo la propiedad "user" porque es lo único que
  // necesitamos en esta página.
  const { user } = useAuth();

  // ─── RENDERIZADO CONDICIONAL (GUARDIA) ───────────────────────────────────────
  // CONCEPTO — Renderizado condicional:
  //   En React podemos devolver JSX diferente según condiciones, igual que
  //   en un "if/else" normal de JavaScript.
  //
  // "user?.employeeId" usa "optional chaining" (?.) de JavaScript/TypeScript:
  //   - Si "user" es null o undefined, NO lanza un error; simplemente devuelve
  //     undefined (que es falsy, es decir, evaluado como "falso").
  //   - Si "user" existe, accede a su propiedad "employeeId".
  //
  // "!user?.employeeId" significa: "si NO hay employeeId" (o no hay usuario).
  // En ese caso mostramos un aviso y terminamos (el "return" sale de la función).
  if (!user?.employeeId) {
    return (
      // "p-6" → padding de 6 unidades en todos los lados (espaciado interior).
      <div className="p-6">
        {/* Cuadro de aviso con estilo teal (verde-azulado):
            - bg-teal-50: fondo teal muy claro
            - border border-teal-200: borde teal suave
            - rounded-lg: bordes redondeados
            - text-teal-800: texto en teal oscuro
            - text-sm: texto pequeño */}
        <div className="bg-teal-50 border border-teal-200 rounded-lg p-4 text-teal-800 text-sm">
          Tu cuenta no está vinculada a un perfil de empleado.
        </div>
      </div>
    );
  }

  // ─── RENDERIZADO NORMAL ───────────────────────────────────────────────────────
  // Si llegamos aquí, sabemos que user.employeeId existe (el "if" de arriba
  // habría cortado la ejecución si no fuera así).
  return (
    // Contenedor principal con padding, ancho máximo centrado y padding
    // inferior extra en móvil (pb-24) para que la barra de navegación
    // inferior del móvil no tape el contenido. En pantallas grandes (lg:)
    // se reduce a pb-6 porque no hay barra inferior.
    <div className="p-6 max-w-4xl mx-auto pb-24 lg:pb-6">
      {/* Título de la página */}
      <h1 className="text-lg font-semibold text-gray-900 mb-6">Mi Horario</h1>

      {/* CONCEPTO — Props (propiedades):
          Los componentes pueden recibir datos externos llamados "props".
          Son como los parámetros de una función.
          Aquí le pasamos "employeeId" al componente EmployeeScheduleEditor
          para que sepa de qué empleado debe mostrar y editar el horario.
          "user.employeeId" es el ID único del empleado en la base de datos. */}
      <EmployeeScheduleEditor employeeId={user.employeeId} />
    </div>
  );
}
