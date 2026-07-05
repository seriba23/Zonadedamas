// 'use client': marca este archivo como Componente de Cliente de Next.js.
// Es OBLIGATORIO cuando usamos hooks (useQuery, useState...) o eventos del
// navegador, porque esos solo funcionan en el navegador, no en el servidor.
'use client';

import Link from 'next/link';                       // navegación SPA (sin recargar).
import { useQuery } from '@tanstack/react-query';    // hook para PEDIR datos al servidor.
import { api } from '@/lib/api';                     // cliente HTTP propio (hace fetch al backend).
import { getInitials } from '@/lib/utils';           // helper: "Ana Gil" -> "AG".
import dayjs from 'dayjs';                            // librería para manejar fechas con comodidad.

// URL base del backend. process.env.NEXT_PUBLIC_API_URL la define el entorno;
// "|| 'http://localhost:3001'" es un VALOR POR DEFECTO: si esa variable no
// existe (es undefined/""), usamos localhost. El "||" devuelve el primer valor
// "verdadero" de izquierda a derecha.
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Mapa que traduce el día (texto que da la BD) al número que usa dayjs/JS.
// Record<string, number> = "objeto cuyas claves son texto y valores números".
// JS numera la semana así: 0=domingo, 1=lunes ... 6=sábado.
const DAY_MAP: Record<string, number> = {
  MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3, THURSDAY: 4, FRIDAY: 5, SATURDAY: 6, SUNDAY: 0,
};

// ─────────────────────────────────────────────────────────────────────────────
// EmployeesToday: tarjeta "Trabajan hoy". Lista los empleados activos cuyo
// horario incluye el día de hoy, y junto a cada uno cuántas citas tiene hoy.
// ─────────────────────────────────────────────────────────────────────────────
export function EmployeesToday() {
  // useQuery: hook de react-query que descarga datos y los cachea.
  //   - queryKey: identificador único de esta consulta (para la caché).
  //   - queryFn: la función que realmente pide los datos (aquí, lista de empleados).
  //   - staleTime: cuánto tiempo se considera "fresca" la data antes de refrescar
  //     (5 * 60 * 1000 ms = 5 minutos).
  //   "data" es el resultado de la petición (undefined mientras carga).
  const { data } = useQuery({
    queryKey: ['employees-count'],
    queryFn: () => api.get<{ data: any[] }>('/api/employees?perPage=100'),
    staleTime: 5 * 60 * 1000,
  });

  // Citas de hoy para contar por empleado.
  // dayjs() = ahora. startOf('day') = 00:00 de hoy. endOf('day') = 23:59 de hoy.
  // toISOString() lo convierte al texto estándar que el backend espera.
  const todayStart = dayjs().startOf('day').toISOString();
  const todayEnd = dayjs().endOf('day').toISOString();
  // Segunda consulta: las citas dentro del rango de hoy. Incluimos las fechas en
  // la queryKey para que, si cambian, react-query vuelva a pedir los datos.
  const { data: aptsData } = useQuery({
    queryKey: ['employees-today-appointments', todayStart, todayEnd],
    queryFn: () => api.get<{ data: Array<{ employeeId: string }> }>(
      `/api/appointments?startDate=${todayStart}&endDate=${todayEnd}&perPage=200`,
    ),
    staleTime: 60 * 1000,
  });

  // ── CONTAR CITAS POR EMPLEADO con reduce() ──
  // (aptsData?.data || []) = la lista de citas, o [] si aún no llegó (evita error).
  // reduce recorre las citas acumulando un objeto { idEmpleado: cantidad }.
  //   - "acc" es el acumulador (empieza en {} al final).
  //   - "a" es cada cita.
  //   - acc[a.employeeId] = (lo que ya había || 0) + 1: suma 1 al contador de ese
  //     empleado; si todavía no existía la clave, parte de 0.
  const countsByEmployee = (aptsData?.data || []).reduce<Record<string, number>>((acc, a) => {
    acc[a.employeeId] = (acc[a.employeeId] || 0) + 1;
    return acc; // devolvemos el acumulador para la siguiente vuelta.
  }, {});

  // Número del día de hoy (0..6) para comparar con los horarios.
  const todayDow = dayjs().day();
  // ── FILTRAR EMPLEADOS QUE TRABAJAN HOY ──
  // .filter() recorre la lista y se queda SOLO con los que devuelven true.
  const employees = (data?.data || []).filter((e: any) => {
    if (!e.isActive) return false;                                  // descartar inactivos.
    if (!e.schedules || e.schedules.length === 0) return false;     // sin horario -> fuera.
    // .some(): true si AL MENOS UN bloque de horario cumple: que trabaje ese día
    // (isWorking) y que el día del horario coincida con hoy (DAY_MAP traduce el
    // nombre del día a su número y lo comparamos con todayDow).
    return e.schedules.some((s: any) => s.isWorking && DAY_MAP[s.dayOfWeek] === todayDow);
  });

  return (
    <div
      className="rounded-[22px] shadow-soft p-5"
      style={{ backgroundColor: 'var(--soft-card)', border: '1px solid var(--soft-border)' }}
    >
      {/* Título con el total de empleados de hoy. {employees.length} = cantidad. */}
      <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-secondary)' }}>
        Trabajan hoy <span className="font-normal" style={{ color: 'var(--text-muted)' }}>({employees.length})</span>
      </h2>

      {/* RENDERIZADO CONDICIONAL con ternario (condición ? A : B):
          si NO hay empleados hoy mostramos un mensaje; si los hay, la lista. */}
      {employees.length === 0 ? (
        <p className="text-sm text-center py-6" style={{ color: 'var(--text-muted)' }}>
          No hay empleados programados hoy
        </p>
      ) : (
        <ul className="space-y-2">
          {/* Recorremos cada empleado filtrado y pintamos una fila por cada uno. */}
          {employees.map((emp: any) => {
            // count = cuántas citas tiene HOY este empleado (0 si no aparece en el mapa).
            const count = countsByEmployee[emp.id] || 0;
            return (
              <li key={emp.id}> {/* key única = id del empleado. */}
                {/* Toda la fila es un enlace al detalle del empleado (/staff/:id). */}
                <Link href={`/staff/${emp.id}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--bg-muted)] transition-colors">
                  {/* Avatar circular. Su color de fondo es el del empleado, o teal
                      (#008080) por defecto si no tiene (operador ||). */}
                  <div
                    className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold overflow-hidden"
                    style={{ backgroundColor: emp.color || '#008080' }}
                  >
                    {/* Si tiene foto (avatarUrl) la mostramos; si no, las iniciales.
                        startsWith('http'): si la URL ya es absoluta la usamos tal cual;
                        si es relativa, le anteponemos API_URL. */}
                    {emp.avatarUrl ? (
                      <img src={emp.avatarUrl.startsWith('http') ? emp.avatarUrl : `${API_URL}${emp.avatarUrl}`} alt="" className="w-full h-full object-cover" />
                    ) : (
                      getInitials(emp.firstName, emp.lastName)
                    )}
                  </div>
                  {/* Nombre + puesto del empleado. */}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                      {emp.firstName} {emp.lastName}
                    </p>
                    {/* jobTitle o "Empleado" por defecto si no tiene puesto. */}
                    <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                      {emp.jobTitle || 'Empleado'}
                    </p>
                  </div>
                  {/* Contador de citas a la derecha. Se pinta en teal si tiene
                      alguna (count > 0) o en gris si no tiene ninguna. */}
                  <div className="flex-shrink-0 text-right">
                    <p className="text-sm font-semibold" style={{ color: count > 0 ? '#008080' : 'var(--text-muted)' }}>
                      {count}
                    </p>
                    {/* Singular/plural: "cita" si es exactamente 1, "citas" en otro caso. */}
                    <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                      {count === 1 ? 'cita' : 'citas'}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
