'use client';
// ============================================================
// AppointmentsCalendar — vista de calendario MENSUAL para las citas del cliente.
// Muestra una cuadrícula del mes; cada día con citas lleva puntos del color del
// perfil de cada cita. Al tocar un día, abajo se listan sus citas (el padre
// decide cómo renderlas, vía la prop renderList, para reusar su tarjeta).
// ============================================================

import { useState } from 'react';

const WEEKDAYS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

// Construye una clave "AAAA-MM-DD" a partir de año, mes (0-11) y día.
function ymd(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

interface Props {
  appointments: any[];
  // Color del punto para una cita (normalmente el color del perfil dueño).
  colorOf: (appt: any) => string;
  // Cómo renderizar la lista de citas del día seleccionado (el padre reusa su
  // tarjeta de cita).
  renderList: (appts: any[]) => React.ReactNode;
}

export function AppointmentsCalendar({ appointments, colorOf, renderList }: Props) {
  const today = new Date();
  const todayKey = ymd(today.getFullYear(), today.getMonth(), today.getDate());

  // Mes mostrado (año + mes 0-11) y día seleccionado (clave AAAA-MM-DD).
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selected, setSelected] = useState<string | null>(todayKey);

  // Agrupamos las citas por fecha. startTime viene como "AAAA-MM-DDThh:mm..."
  // en hora del negocio cruda; nos quedamos con los primeros 10 caracteres.
  const byDate = new Map<string, any[]>();
  for (const a of appointments) {
    const key = (a.startTime || '').substring(0, 10);
    if (!key) continue;
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(a);
  }

  // getDay() del día 1 = en qué columna (0=domingo) arranca el mes.
  const firstDow = new Date(viewYear, viewMonth, 1).getDay();
  // getDate() del día 0 del mes siguiente = cuántos días tiene este mes.
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  }

  // Celdas: primero los huecos antes del día 1, luego los días del mes.
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const selectedAppts = selected ? byDate.get(selected) || [] : [];

  return (
    <div>
      {/* Encabezado: mes + navegación */}
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={prevMonth} className="w-8 h-8 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100" aria-label="Mes anterior">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
        </button>
        <p className="text-sm font-semibold text-gray-900">{MONTHS[viewMonth]} {viewYear}</p>
        <button type="button" onClick={nextMonth} className="w-8 h-8 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100" aria-label="Mes siguiente">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
        </button>
      </div>

      {/* Cabecera de días de la semana */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((w, i) => (
          <div key={i} className="text-center text-[10px] text-gray-400 font-medium py-1">{w}</div>
        ))}
      </div>

      {/* Cuadrícula de días */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (d === null) return <div key={i} />;
          const key = ymd(viewYear, viewMonth, d);
          const dayAppts = byDate.get(key) || [];
          const isToday = key === todayKey;
          const isSelected = key === selected;
          return (
            <button
              key={i}
              type="button"
              onClick={() => setSelected(key)}
              className={`aspect-square rounded-lg flex flex-col items-center justify-center text-xs transition-colors ${
                isSelected ? 'bg-[#008080] text-white' : 'hover:bg-gray-100 text-gray-700'
              }`}
            >
              <span className={isToday && !isSelected ? 'font-bold text-[#008080]' : ''}>{d}</span>
              {dayAppts.length > 0 && (
                <span className="flex gap-0.5 mt-0.5 h-1.5">
                  {dayAppts.slice(0, 3).map((a, j) => (
                    <span
                      key={j}
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: isSelected ? '#fff' : colorOf(a) }}
                    />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Citas del día seleccionado */}
      <div className="mt-4 space-y-3">
        {selected && (selectedAppts.length > 0
          ? renderList(selectedAppts)
          : <p className="text-center text-xs text-gray-400 py-6">Sin citas este día</p>)}
      </div>
    </div>
  );
}
