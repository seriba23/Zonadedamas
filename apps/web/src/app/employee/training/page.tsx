// ─────────────────────────────────────────────────────────────────────────────
// ARCHIVO: apps/web/src/app/employee/training/page.tsx
// RUTA EN EL NAVEGADOR: /employee/training
//
// QUÉ HACE ESTA PÁGINA:
//   Muestra la sección de Formación del empleado. Aquí el empleado puede
//   ver y gestionar su historial de capacitaciones, cursos, certificaciones
//   y cualquier formación profesional relacionada con su puesto de trabajo.
//
//   Ejemplos: "Curso de colorimetría avanzada", "Certificación en uñas gel",
//   "Taller de atención al cliente", etc.
//
// FLUJO PRINCIPAL:
//   1. Se obtiene el usuario autenticado con useAuth().
//   2. Si el usuario NO tiene employeeId, se muestra un aviso de advertencia.
//   3. Si tiene employeeId, se muestra el componente EmployeeTraining con:
//      - "employeeId": el ID del empleado (para cargar sus datos).
//      - "canEdit=true": el empleado puede editar su propia formación.
//
// DIFERENCIA CON schedule/page.tsx:
//   El aviso de error aquí usa colores amarillos (bg-yellow-50, border-yellow-200)
//   mientras que schedule usa teal. Ambos cumplen la misma función de guardia.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

// ─── IMPORTACIONES ────────────────────────────────────────────────────────────
// Hook de autenticación para obtener el usuario logueado.
import { useAuth } from '@/lib/hooks/use-auth';

// Componente que renderiza la lista de formaciones con opciones de edición.
// Recibe el ID del empleado y si puede editar o sólo ver.
import { EmployeeTraining } from '@/components/staff/employee-training';

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function EmployeeTrainingPage() {
  // Obtenemos el objeto user del contexto de autenticación.
  // Sólo necesitamos "user" (no logout ni otras propiedades).
  const { user } = useAuth();

  // ─── GUARDIA: sin perfil de empleado ──────────────────────────────────────
  // Si el usuario no tiene un employeeId vinculado (puede ser un usuario
  // de tipo administrador puro sin ficha de empleado), mostramos un aviso
  // amarillo de advertencia en lugar de la pantalla de formación.
  //
  // NOTA: el color amarillo (yellow) es intencional aquí para distinguirlo
  // visualmente del aviso teal que usa schedule/page.tsx, aunque ambos son
  // mensajes informativos similares.
  if (!user?.employeeId) {
    return (
      <div className="p-6">
        {/* Cuadro de aviso amarillo (tono "warning"):
            - bg-yellow-50: fondo amarillo muy claro
            - border border-yellow-200: borde amarillo suave
            - text-yellow-800: texto amarillo oscuro para contraste */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-800 text-sm">
          Tu cuenta no está vinculada a un perfil de empleado.
        </div>
      </div>
    );
  }

  // ─── RENDERIZADO NORMAL ────────────────────────────────────────────────────
  // Si el usuario tiene employeeId, mostramos la sección de formación.
  return (
    // Contenedor con padding, ancho máximo para escritorio y centrado.
    // No tiene "pb-24" como otras páginas porque EmployeeTraining
    // probablemente ya gestiona su propio espaciado interno.
    <div className="p-6 max-w-4xl mx-auto">
      {/* Título con tamaño "text-2xl" (más grande que otras páginas) */}
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Formación</h1>

      {/* Componente de formación del empleado.
          CONCEPTO — Props (propiedades):
          Pasamos dos props:
          - "employeeId={user.employeeId}": el ID del empleado en la BD.
            El componente lo usará para hacer GET /api/employees/:id/training
            y cargar las formaciones de ese empleado específico.
          - "canEdit={true}": prop booleana que le dice al componente que
            el empleado tiene permiso de editar su propia formación.
            Si fuera "canEdit={false}" (o sin esa prop), el componente
            sólo mostraría los datos en modo lectura, sin botones de
            agregar/editar/eliminar. */}
      <EmployeeTraining employeeId={user.employeeId} canEdit={true} />
    </div>
  );
}
