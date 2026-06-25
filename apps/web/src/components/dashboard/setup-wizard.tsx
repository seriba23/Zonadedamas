// 'use client': este componente usa hooks de React/Next.js; corre en el navegador.
'use client';

// useRouter: permite navegar a otras páginas sin recargar la aplicación.
import { useRouter } from 'next/navigation';
// useSetupStatus: hook personalizado que consulta qué pasos de configuración
// del negocio están pendientes. Encapsula toda la lógica de estado del wizard.
import { useSetupStatus } from '@/lib/hooks/use-setup-status';

// SetupWizard: componente que muestra un checklist visual de configuración inicial.
// Guía al dueño del negocio para completar los 5 pasos mínimos antes de operar.
// Aparece en el dashboard mientras haya pasos incompletos.
export function SetupWizard() {
  // useRouter: instancia del enrutador de Next.js para programar navegación.
  const router = useRouter();

  // useSetupStatus: devuelve un objeto con múltiples valores.
  // Desestructuramos solo los que necesitamos:
  // - needsX: booleanos — true si ese paso está pendiente.
  // - employeesWithoutSchedule: array de empleados sin horario asignado.
  // - employees: todos los empleados del negocio.
  // - completedSteps / totalSteps: contadores para la barra de progreso.
  const {
    needsBusinessProfile,
    needsBusinessHours,
    needsServices,
    needsEmployees,
    needsEmployeeSchedules,
    employeesWithoutSchedule,
    employees,
    completedSteps,
    totalSteps,
  } = useSetupStatus();

  // progressPct: porcentaje de pasos completados (0–100).
  // Math.round: redondea al entero más cercano (p.ej. 2/5 = 40%).
  const progressPct = Math.round((completedSteps / totalSteps) * 100);

  // steps: array de objetos que describe cada paso del wizard.
  // Cada paso tiene:
  //   done: boolean — si el paso está completado (negado del "needs*").
  //   label: texto del paso.
  //   desc: descripción corta de qué hacer.
  //   href: ruta a la que navegar si el usuario hace click en ese paso.
  //
  // Paso 5 (horarios del equipo): el href es dinámico —
  //   Si hay más de 1 empleado: va directo al perfil del primer empleado sin horario.
  //   Si solo hay 1: va al listado de staff.
  //   employeesWithoutSchedule[0]?.id || '': acceso seguro al id del primer empleado,
  //   con '' como fallback si el array está vacío.
  const steps = [
    { done: !needsBusinessProfile, label: 'Completa el perfil de tu negocio', desc: 'Agrega descripción, logo, foto de portada y datos del negocio', href: '/settings/business' },
    { done: !needsBusinessHours, label: 'Configura tu horario de atención', desc: 'Define los días y horas en que tu negocio está abierto', href: '/settings/hours' },
    { done: !needsServices, label: 'Crea tu primer servicio', desc: 'Configura los servicios que ofreces a tus clientes', href: '/services?new=true' },
    { done: !needsEmployees, label: 'Invita a tu equipo', desc: 'Genera un código de invitación para que tus empleados se unan', href: '/settings/invite-codes' },
    { done: !needsEmployeeSchedules, label: 'Configura horarios del equipo', desc: needsEmployeeSchedules ? `${employeesWithoutSchedule.length} empleado(s) sin horario configurado` : 'Todos los empleados tienen horario', href: employees.length > 1 ? `/staff/${employeesWithoutSchedule[0]?.id || ''}` : '/staff' },
  ];

  // ── JSX: tarjeta completa con header teal + timeline de pasos ────────────
  return (
    <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
      {/* Header: fondo teal con título y porcentaje de completado */}
      {/* Header */}
      <div className="px-6 py-5" style={{ backgroundColor: '#008080' }}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Configura tu negocio</h2>
            <p className="text-sm text-white/70 mt-0.5">Completa estos pasos para empezar a recibir citas</p>
          </div>
          {/* Porcentaje en grande a la derecha: p.ej. "40%" + "2 de 5" */}
          <div className="text-right">
            <p className="text-2xl font-bold text-white">{progressPct}%</p>
            <p className="text-xs text-white/60">{completedSteps} de {totalSteps}</p>
          </div>
        </div>
        {/* Barra de progreso blanca sobre fondo semi-transparente.
            style={{ width: `${progressPct}%` }}: ajusta el ancho dinámicamente.
            transition-all duration-500: animación suave al cambiar el progreso. */}
        {/* Progress bar */}
        <div className="mt-3 h-2 bg-white/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-white rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Timeline de pasos: línea vertical conecta los círculos numerados.
          steps.map((step, i)): itera el array de pasos; i = índice (0,1,2,3,4).
          key={i}: React necesita una clave única por elemento de lista. */}
      {/* Steps timeline */}
      <div className="bg-white px-6 py-5">
        {steps.map((step, i) => {
          // isLast: true si es el último paso (para no dibujar la línea vertical final).
          const isLast = i === steps.length - 1;
          // prevDone: el paso anterior está completo (o es el primero).
          // Permite saber si este paso es "accesible" (flujo lineal).
          const prevDone = i === 0 || steps[i - 1].done;
          // isCurrent: este paso está pendiente Y el anterior ya se completó.
          // Es el paso activo en el que el usuario debe trabajar ahora.
          const isCurrent = !step.done && prevDone;

          // onClick: al hacer click en cualquier parte de la fila, navega al href del paso.
          return (
            <div key={i} className="flex gap-4 cursor-pointer" onClick={() => router.push(step.href)}>
              {/* Columna izquierda: círculo de estado + línea vertical conectora */}
              {/* Timeline column */}
              <div className="flex flex-col items-center">
                {/* Círculo de estado:
                    - Verde con checkmark: paso completado.
                    - Teal con número: paso actual (pendiente y anterior completo).
                    - Gris con número: paso futuro (aún no accesible). */}
                <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 border-2 transition-colors ${
                  step.done
                    ? 'bg-green-500 border-green-500'
                    : isCurrent
                      ? 'bg-[#008080] border-[#008080]'
                      : 'bg-white border-gray-300'
                }`}>
                  {/* Renderizado condicional: checkmark SVG si done, número si no. */}
                  {step.done ? (
                    <svg className="w-4.5 h-4.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    // {i + 1}: muestra 1,2,3,4,5 (índice base-0 + 1).
                    <span className={`text-sm font-bold ${isCurrent ? 'text-white' : 'text-gray-400'}`}>{i + 1}</span>
                  )}
                </div>
                {/* Línea vertical que une este círculo con el siguiente.
                    !isLast: solo se dibuja si NO es el último paso.
                    Verde si el paso está completo, gris si no. */}
                {!isLast && (
                  <div className={`w-0.5 flex-1 my-1 ${step.done ? 'bg-green-400' : 'bg-gray-200'}`} style={{ minHeight: 24 }} />
                )}
              </div>

              {/* Columna derecha: texto del paso */}
              {/* Content */}
              <div className="pb-5 flex-1 min-w-0">
                {/* Título del paso: tachado y gris si está completo. */}
                <p className={`text-sm font-semibold ${step.done ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                  {step.label}
                </p>
                {/* Descripción del paso (siempre visible). */}
                <p className="text-xs text-gray-500 mt-0.5">{step.desc}</p>
                {/* Botón "Completar ahora": solo aparece en el paso actual (isCurrent).
                    && short-circuit: si isCurrent es false, el botón no se renderiza. */}
                {isCurrent && (
                  <button className="mt-2 text-xs font-semibold text-[#008080] hover:text-[#006666] flex items-center gap-1">
                    Completar ahora
                    {/* Ícono de flecha → para indicar que lleva a otra página */}
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
