'use client';

import { useRouter } from 'next/navigation';
import { useSetupStatus } from '@/lib/hooks/use-setup-status';

export function SetupWizard() {
  const router = useRouter();
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

  const progressPct = Math.round((completedSteps / totalSteps) * 100);

  const steps = [
    { done: !needsBusinessProfile, label: 'Completa el perfil de tu negocio', desc: 'Agrega descripción, logo, foto de portada y datos del negocio', href: '/settings/business' },
    { done: !needsBusinessHours, label: 'Configura tu horario de atención', desc: 'Define los días y horas en que tu negocio está abierto', href: '/settings/hours' },
    { done: !needsServices, label: 'Crea tu primer servicio', desc: 'Configura los servicios que ofreces a tus clientes', href: '/services?new=true' },
    { done: !needsEmployees, label: 'Invita a tu equipo', desc: 'Genera un código de invitación para que tus empleados se unan', href: '/settings/invite-codes' },
    { done: !needsEmployeeSchedules, label: 'Configura horarios del equipo', desc: needsEmployeeSchedules ? `${employeesWithoutSchedule.length} empleado(s) sin horario configurado` : 'Todos los empleados tienen horario', href: employees.length > 1 ? `/staff/${employeesWithoutSchedule[0]?.id || ''}` : '/staff' },
  ];

  return (
    <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
      {/* Header */}
      <div className="px-6 py-5" style={{ backgroundColor: '#008080' }}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Configura tu negocio</h2>
            <p className="text-sm text-white/70 mt-0.5">Completa estos pasos para empezar a recibir citas</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-white">{progressPct}%</p>
            <p className="text-xs text-white/60">{completedSteps} de {totalSteps}</p>
          </div>
        </div>
        {/* Progress bar */}
        <div className="mt-3 h-2 bg-white/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-white rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Steps timeline */}
      <div className="bg-white px-6 py-5">
        {steps.map((step, i) => {
          const isLast = i === steps.length - 1;
          const prevDone = i === 0 || steps[i - 1].done;
          const isCurrent = !step.done && prevDone;

          return (
            <div key={i} className="flex gap-4 cursor-pointer" onClick={() => router.push(step.href)}>
              {/* Timeline column */}
              <div className="flex flex-col items-center">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 border-2 transition-colors ${
                  step.done
                    ? 'bg-green-500 border-green-500'
                    : isCurrent
                      ? 'bg-[#008080] border-[#008080]'
                      : 'bg-white border-gray-300'
                }`}>
                  {step.done ? (
                    <svg className="w-4.5 h-4.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <span className={`text-sm font-bold ${isCurrent ? 'text-white' : 'text-gray-400'}`}>{i + 1}</span>
                  )}
                </div>
                {!isLast && (
                  <div className={`w-0.5 flex-1 my-1 ${step.done ? 'bg-green-400' : 'bg-gray-200'}`} style={{ minHeight: 24 }} />
                )}
              </div>

              {/* Content */}
              <div className="pb-5 flex-1 min-w-0">
                <p className={`text-sm font-semibold ${step.done ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                  {step.label}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{step.desc}</p>
                {isCurrent && (
                  <button className="mt-2 text-xs font-semibold text-[#008080] hover:text-[#006666] flex items-center gap-1">
                    Completar ahora
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
