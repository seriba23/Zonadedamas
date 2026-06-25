// 'use client': componente de navegador. Necesita hooks (useState, useEffect)
// y responde a interacciones del usuario (clics en días y slots).
'use client';

// Hooks de React que usamos:
// - useState: variables reactivas (fecha seleccionada, slot seleccionado)
// - useEffect: auto-selección del slot inicial cuando llegan los datos
// - useRef: referencia mutable que NO provoca re-render (flag de auto-selección)
import { useState, useEffect, useRef } from 'react';
// useQuery: consulta al backend con caché automático
import { useQuery } from '@tanstack/react-query';
// dayjs: librería para manejar fechas. Dayjs = el tipo TypeScript del objeto.
import dayjs, { type Dayjs } from 'dayjs';
// api: cliente HTTP del proyecto
import { api } from '@/lib/api';
// formatTime: convierte "HH:mm" a formato de presentación (p. ej. "9:00 AM" o "09:00")
import { formatTime } from '@/lib/utils';

// Slot disponible en modo estándar (cualquier empleado disponible).
// Cada slot incluye el employeeId del profesional que atendería.
interface AvailableSlot {
  startTime: string;   // "YYYY-MM-DDTHH:mm:00" o "HH:mm" según el endpoint
  endTime: string;
  employeeId: string;
  employeeName?: string; // ? = campo opcional (puede no llegar)
}

// Slot en modo "todos los slots" (para un empleado específico).
// Incluye TODOS los slots del horario del empleado, disponibles o no.
interface AllSlotsSlot {
  startTime: string; // "HH:mm" — solo la hora (no incluye fecha)
  endTime: string;
  available: boolean; // true = libre, false = ya tiene cita en ese horario
}

// Respuesta completa del endpoint /api/availability/all-slots.
// scheduleStart/End: hora de inicio/fin del turno del empleado ese día.
// null = el empleado no trabaja ese día.
// closureReason: texto que explica por qué está cerrado (p. ej. "Festivo").
interface AllSlotsResponse {
  scheduleStart: string | null;
  scheduleEnd: string | null;
  slots: AllSlotsSlot[];
  closureReason?: string;
}

// Props del componente AvailabilityPicker.
// Recibe los parámetros de búsqueda y callback cuando el usuario elige un slot.
interface AvailabilityPickerProps {
  locationId?: string;       // Filtra disponibilidad por sede
  serviceIds: string[];      // Los servicios que se van a realizar (afecta la duración)
  employeeId?: string;       // Si se especifica → modo "todos los slots"
  initialDateTime?: string;  // Fecha+hora pre-seleccionada, p. ej. "2026-02-22T09:00:00"
  onSelect: (employeeId: string, startTime: string, endTime: string) => void; // Callback al elegir slot
  onDateChange?: (dateStr: string) => void; // Callback al cambiar el día (YYYY-MM-DD)
  // ? en el nombre → prop opcional (puede no enviarse)
}

// ── Componente AvailabilityPicker ─────────────────────────────────────────
// Selector combinado de fecha (mini calendario mensual) + slots de tiempo.
// Tiene dos modos:
//   - Modo estándar (useAllSlots=false): consulta /api/availability/query
//     y solo muestra los slots disponibles (verde).
//   - Modo todos los slots (useAllSlots=true): consulta /api/availability/all-slots
//     y muestra TODOS los slots del empleado, disponibles (verde) y ocupados (rojo).
export function AvailabilityPicker({
  locationId,
  serviceIds,
  employeeId,
  initialDateTime,
  onSelect,
  onDateChange,
}: AvailabilityPickerProps) {
  // Extraemos fecha y hora de initialDateTime si existe.
  // dayjs(initialDateTime) crea un objeto Dayjs desde la cadena ISO.
  // dayjs() sin argumento = ahora mismo.
  const initialDate = initialDateTime ? dayjs(initialDateTime) : dayjs();
  // split('T')[1] extrae la parte de la hora; substring(0, 5) toma solo "HH:mm".
  // ?. evita error si split devuelve un array sin segundo elemento.
  const initialTime = initialDateTime ? initialDateTime.split('T')[1]?.substring(0, 5) : null;

  // selectedDate: el día actualmente seleccionado en el calendario.
  const [selectedDate, setSelectedDate] = useState<Dayjs>(initialDate);
  // selectedSlot: el slot de hora elegido (null = ninguno elegido aún).
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  // autoSelectedRef: useRef crea una referencia mutable que persiste entre renders
  // pero NO provoca re-render cuando cambia. Lo usamos como "flag" para
  // auto-seleccionar el slot inicial UNA SOLA VEZ (evita bucle infinito).
  const autoSelectedRef = useRef(false);

  // ── Cálculos para el mini-calendario ─────────────────────────────────────
  // .startOf('month'): el primer día del mes a las 00:00:00.
  const startOfMonth = selectedDate.startOf('month');
  // .daysInMonth(): cantidad de días del mes (28, 29, 30 o 31).
  const daysInMonth = selectedDate.daysInMonth();
  // .day(): número del día de la semana del primer día (0=Dom, 1=Lun…6=Sáb).
  // Necesario para saber cuántas celdas vacías poner al inicio del grid.
  const firstDayOfWeek = startOfMonth.day();
  // Array de objetos Dayjs, uno por cada día del mes.
  // Array.from({ length: N }, (_, i) => ...) crea N elementos; _ ignora el valor, i es el índice.
  const calendarDays = Array.from({ length: daysInMonth }, (_, i) =>
    startOfMonth.add(i, 'day'),
  );

  // dateStr: la fecha seleccionada como "YYYY-MM-DD" para las queries.
  const dateStr = selectedDate.format('YYYY-MM-DD');

  // isToday: true si selectedDate es el día de hoy.
  // Necesario para filtrar slots que ya pasaron (el cajero no puede agendar a las 9:00 si ya son las 9:45).
  // Si la fecha seleccionada es HOY, descartamos slots cuyo inicio ya pasó.
  // El backend no filtra por hora actual; el cajero no debe poder agendar
  // a las 9:00 cuando ya son las 9:45.
  const isToday = selectedDate.isSame(dayjs(), 'day');

  // isSlotPast: helper que devuelve true si el slot ya pasó (solo cuando es hoy).
  // slotStartTime puede venir como "HH:mm" (modo all-slots) o como ISO "YYYY-MM-DDTHH:mm:00".
  // Soportamos ambos formatos para ser compatibles con los dos endpoints.
  const isSlotPast = (slotStartTime: string): boolean => {
    if (!isToday) return false; // Si no es hoy, ningún slot es "pasado"
    // slotStartTime puede venir como "HH:mm" (all-slots) o como ISO completo.
    // Si tiene 'T' → es ISO → extraemos la parte de la hora.
    const time = slotStartTime.includes('T')
      ? slotStartTime.split('T')[1]?.substring(0, 5) || slotStartTime
      : slotStartTime;
    // Construimos un objeto Dayjs con la hora del slot para compararlo con "ahora".
    const [h, m] = time.split(':').map(Number); // .map(Number) convierte strings a números
    const slotDate = selectedDate.hour(h).minute(m).second(0);
    return slotDate.isBefore(dayjs()); // ¿El slot es anterior al momento actual?
  };

  // useAllSlots: true si se especificó un employeeId concreto.
  // !! convierte el valor a booleano: undefined → false, 'abc' → true.
  // Use all-slots endpoint when a specific employee is selected
  const useAllSlots = !!employeeId;

  // ── Queries de disponibilidad ─────────────────────────────────────────────
  // Hay DOS queries posibles según el modo. Solo UNA está habilitada a la vez
  // (la opción `enabled` lo controla).

  // Modo estándar: cualquier empleado (o sin filtrar).
  // Devuelve solo slots disponibles con su empleado asignado.
  // Standard availability query (any employee or no specific employee).
  // staleTime=0 + refetchOnMount='always' garantiza que ver el componente
  // siempre dispara una consulta nueva — la disponibilidad cambia con cada
  // cita que se crea, no podemos servir cache stale.
  const standardQuery = useQuery({
    queryKey: ['availability', dateStr, serviceIds, employeeId, locationId],
    queryFn: () =>
      api.post<{ data: AvailableSlot[] }>('/api/availability/query', {
        startDate: dateStr,
        endDate: dateStr,
        serviceIds,
        // employeeId || undefined: si está vacío ('') mandamos undefined para no filtrar.
        employeeId: employeeId || undefined,
        locationId: locationId || undefined,
      }),
    // enabled: solo ejecuta esta query si hay servicios Y NO estamos en modo all-slots.
    enabled: serviceIds.length > 0 && !useAllSlots,
    staleTime: 0,       // Los datos nunca son "frescos" en caché
    refetchOnMount: 'always', // Siempre refetch al montar (disponibilidad cambia constantemente)
  });

  // Modo todos los slots: para un empleado específico.
  // Devuelve su horario completo del día con cada slot marcado como available o no.
  // All-slots query (specific employee selected)
  const allSlotsQuery = useQuery({
    queryKey: ['all-slots', dateStr, serviceIds, employeeId],
    queryFn: () =>
      api.post<{ data: AllSlotsResponse }>('/api/availability/all-slots', {
        date: dateStr,
        employeeId,
        serviceIds,
      }),
    // Solo se ejecuta si hay servicios Y estamos en modo all-slots.
    enabled: serviceIds.length > 0 && useAllSlots,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  // isLoading: true mientras la query activa está cargando.
  // Ternario: si es modo all-slots → usamos la query de all-slots; si no → la estándar.
  const isLoading = useAllSlots ? allSlotsQuery.isLoading : standardQuery.isLoading;
  // standardSlots: los slots del modo estándar (o array vacío si no hay datos).
  const standardSlots = standardQuery.data?.data || [];
  // allSlotsData: la respuesta completa del modo all-slots (puede ser undefined).
  const allSlotsData = allSlotsQuery.data?.data;

  // Auto-selección del slot inicial: cuando llegan los datos, buscamos el slot
  // que coincide con initialTime y lo seleccionamos automáticamente.
  // autoSelectedRef.current: el flag evita que esto se repita en cada render.
  // Auto-select the initial time slot if available
  useEffect(() => {
    // Si ya auto-seleccionamos, o no hay hora inicial, o ya hay slot elegido → salir.
    if (autoSelectedRef.current || !initialTime || selectedSlot) return;

    if (useAllSlots && allSlotsData && allSlotsData.slots.length > 0) {
      // Buscamos el slot que coincide con la hora inicial Y está disponible.
      const match = allSlotsData.slots.find(
        (s) => s.startTime === initialTime && s.available,
      );
      if (match && employeeId) {
        autoSelectedRef.current = true; // Marcamos el flag para no repetir
        // Construimos el ISO completo: "YYYY-MM-DD" + "T" + "HH:mm" + ":00"
        const fullStart = `${dateStr}T${match.startTime}:00`;
        const fullEnd = `${dateStr}T${match.endTime}:00`;
        setSelectedSlot({ startTime: fullStart, endTime: fullEnd, employeeId });
        onSelect(employeeId, fullStart, fullEnd); // Notifica al componente padre
      }
    } else if (!useAllSlots && standardSlots.length > 0) {
      // En modo estándar, la hora puede venir como ISO o solo "HH:mm".
      // Extraemos solo "HH:mm" para comparar.
      const match = standardSlots.find((s) => {
        const time = s.startTime.includes('T')
          ? s.startTime.split('T')[1].substring(0, 5)
          : s.startTime.substring(0, 5);
        return time === initialTime;
      });
      if (match) {
        autoSelectedRef.current = true;
        setSelectedSlot(match);
        onSelect(match.employeeId, match.startTime, match.endTime);
      }
    }
  }, [allSlotsData, standardSlots, initialTime, useAllSlots, employeeId, dateStr]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cuando el usuario hace click en un slot del modo estándar:
  // guarda el slot en estado y notifica al padre.
  function handleSlotSelect(slot: AvailableSlot) {
    setSelectedSlot(slot);
    onSelect(slot.employeeId, slot.startTime, slot.endTime);
  }

  // Cuando el usuario hace click en un slot del modo all-slots:
  // solo si está disponible y hay employeeId. Construye el ISO completo
  // y guarda el slot antes de notificar al padre.
  function handleAllSlotSelect(slot: AllSlotsSlot) {
    if (!slot.available || !employeeId) return; // Guarda: slot ocupado o sin empleado → ignorar
    // slot.startTime en all-slots es solo "HH:mm"; construimos el ISO completo.
    const fullStart = `${dateStr}T${slot.startTime}:00`;
    const fullEnd = `${dateStr}T${slot.endTime}:00`;
    setSelectedSlot({ startTime: fullStart, endTime: fullEnd, employeeId });
    onSelect(employeeId, fullStart, fullEnd);
  }

  // ── JSX: interfaz del componente ──────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Mini calendario mensual con navegación ‹ Mes YYYY › */}
      {/* Mini calendar */}
      <div>
        <div className="flex items-center justify-between mb-3">
          {/* Botón ‹: retrocede un mes y limpia el slot elegido (ya no sería válido). */}
          <button
            type="button"
            onClick={() => {
              setSelectedDate((d) => d.subtract(1, 'month')); // Función de actualización: d = valor anterior
              setSelectedSlot(null); // Limpiamos el slot porque cambió el mes
            }}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-sm font-semibold text-gray-900">
            {selectedDate.format('MMMM YYYY')}
          </span>
          <button
            type="button"
            onClick={() => {
              setSelectedDate((d) => d.add(1, 'month'));
              setSelectedSlot(null);
            }}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Cabecera del grid: etiquetas de días (Do Lu Ma Mi Ju Vi Sa).
            .map() genera un <div> por cada elemento del array. key={d} es único. */}
        <div className="grid grid-cols-7 gap-0.5 text-center mb-2">
          {['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'].map((d) => (
            <div key={d} className="text-xs font-medium text-gray-400 py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Grid de días del mes. grid-cols-7 = 7 columnas (una por día). */}
        <div className="grid grid-cols-7 gap-0.5">
          {/* Celdas vacías antes del primer día del mes.
              Si el mes empieza en miércoles (3), necesitamos 3 celdas vacías.
              Array.from({ length: firstDayOfWeek }) crea ese número de elementos. */}
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}
          {/* Un botón por cada día del mes. */}
          {calendarDays.map((day) => {
            // Variables locales para determinar el estilo de cada día.
            const isToday = day.isSame(dayjs(), 'day');    // ¿Es hoy?
            const isPast = day.isBefore(dayjs(), 'day');   // ¿Ya pasó?
            const isSelected = day.isSame(selectedDate, 'day'); // ¿Está seleccionado?

            return (
              <button
                key={day.format('YYYY-MM-DD')} // key único = la fecha como string
                type="button"
                disabled={isPast} // Días pasados no son clicables
                onClick={() => {
                  setSelectedDate(day);         // Actualiza la fecha seleccionada
                  setSelectedSlot(null);         // Limpia el slot (al cambiar el día, el slot ya no es válido)
                  // onDateChange?.(…): llama al callback solo si fue pasado como prop.
                  // ?. evita error si onDateChange es undefined.
                  onDateChange?.(day.format('YYYY-MM-DD'));
                }}
                // Clase dinámica: cambia según el estado del día.
                // Template literal con ternarios anidados:
                //   - Seleccionado → fondo teal sólido
                //   - Hoy → fondo teal claro
                //   - Pasado → texto gris claro, cursor prohibido
                //   - Otro → texto gris oscuro, hover gris claro
                className={`text-sm py-1.5 rounded-lg transition-colors ${
                  isSelected
                    ? 'bg-primary-600 text-white font-semibold'
                    : isToday
                      ? 'bg-primary-100 text-primary-700 font-semibold'
                      : isPast
                        ? 'text-gray-300 cursor-not-allowed'
                        : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {day.date()} {/* .date() devuelve el número del día (1–31) */}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sección de slots de tiempo. Muestra la cuadrícula de horarios. */}
      {/* Time slots */}
      <div>
        <div className="flex items-center justify-between mb-2">
          {/* Título dinámico: cambia según el modo. */}
          <p className="text-sm font-medium text-gray-700">
            {useAllSlots ? 'Horarios del empleado' : 'Horarios disponibles'}
          </p>
          {/* Leyenda verde/rojo: solo en modo all-slots y si hay datos cargados.
              Tres condiciones unidas con &&: si alguna es falsa, no renderiza. */}
          {useAllSlots && allSlotsData && allSlotsData.slots.length > 0 && (
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded border-2 border-green-400 bg-green-50 inline-block" />
                Disponible
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded border-2 border-red-300 bg-red-50 inline-block" />
                Ocupado
              </span>
            </div>
          )}
        </div>

        {/* Renderizado condicional con ternarios encadenados.
            Patrón: condición ? <A> : condición2 ? <B> : condición3 ? <C> : <D>
            Se evalúan en orden hasta que una sea true. */}
        {serviceIds.length === 0 ? (
          // Sin servicios seleccionados → pedir que elija primero
          <p className="text-sm text-gray-400">
            Selecciona un servicio primero
          </p>
        ) : isLoading ? (
          // Cargando → skeleton de 8 rectángulos animados (animate-pulse)
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-9 bg-gray-100 rounded-lg animate-pulse"
              />
            ))}
          </div>
        ) : useAllSlots ? (
          // ── Modo all-slots: muestra TODOS los slots del empleado ──────────
          // All-slots mode: show available + occupied
          !allSlotsData || allSlotsData.slots.length === 0 ? (
            // Sin datos → el empleado no trabaja ese día (o negocio cerrado)
            <div className="py-4 text-center">
              {/* Ternario: si hay closureReason → muestra "negocio cerrado",
                  si no → muestra "el empleado no trabaja". */}
              {allSlotsData?.closureReason ? (
                <p className="text-sm text-red-500 font-medium">
                  Negocio cerrado el día {selectedDate.date()} de {selectedDate.format('MMMM')}
                </p>
              ) : (
                <p className="text-sm text-gray-400">
                  El empleado no trabaja este día
                </p>
              )}
            </div>
          ) : (
            // Cuadrícula de todos los slots del empleado
            <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto">
              {allSlotsData.slots.map((slot) => {
                // isSelected: true si este slot es el que el usuario eligió.
                // Comparamos el ISO completo: "YYYY-MM-DDTHH:mm:00"
                const isSelected =
                  selectedSlot?.startTime === `${dateStr}T${slot.startTime}:00`;
                // past: true si la hora del slot ya pasó (solo hoy).
                const past = isSlotPast(slot.startTime);

                // Horarios pasados (mismo día, hora ya vencida): no
                // seleccionables y visualmente apagados.
                if (past) {
                  // <div> en lugar de <button>: no clicable, solo informativo.
                  return (
                    <div
                      key={slot.startTime}
                      className="py-1.5 text-sm rounded-lg border-2 border-gray-200 bg-gray-50 text-gray-300 text-center cursor-not-allowed"
                      title="Ese horario ya pasó"
                    >
                      {formatTime(slot.startTime)}
                    </div>
                  );
                }

                if (slot.available) {
                  // Slot disponible → <button> verde clicable
                  return (
                    <button
                      key={slot.startTime}
                      type="button"
                      onClick={() => handleAllSlotSelect(slot)}
                      className={`py-1.5 text-sm rounded-lg border-2 transition-colors ${
                        isSelected
                          ? 'bg-primary-600 text-white border-primary-600'
                          : 'border-green-400 bg-green-50 text-green-700 hover:bg-green-100'
                      }`}
                    >
                      {formatTime(slot.startTime)}
                    </button>
                  );
                }

                // Slot ocupado → <div> rojo no clicable (tiene cita)
                return (
                  <div
                    key={slot.startTime}
                    className="py-1.5 text-sm rounded-lg border-2 border-red-300 bg-red-50 text-red-400 text-center cursor-not-allowed"
                  >
                    {formatTime(slot.startTime)}
                  </div>
                );
              })}
            </div>
          )
        ) : (
          // ── Modo estándar: solo slots disponibles ─────────────────────────
          // Standard mode: only available slots
          // Usamos una IIFE (función auto-invocada) para poder declarar
          // variables locales (futureStandardSlots) dentro del JSX.
          (() => {
            // Filtramos los slots cuyo inicio ya pasó (solo aplica al día
            // de hoy). Si tras el filtro no queda nada, mostramos vacío.
            const futureStandardSlots = standardSlots.filter(
              (s) => !isSlotPast(s.startTime), // ! invierte el booleano: si pasó → excluir
            );
            if (futureStandardSlots.length === 0) {
              return (
                <p className="text-sm text-gray-400 py-4 text-center">
                  No hay horarios disponibles para esta fecha
                </p>
              );
            }
            return (
              <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto">
                {futureStandardSlots.map((slot) => {
                  // Extraemos solo "HH:mm" para mostrar en el botón.
                  // Si el startTime tiene 'T' → es ISO → tomamos la parte de la hora.
                  const time = slot.startTime.includes('T')
                    ? slot.startTime.split('T')[1].substring(0, 5)
                    : slot.startTime.substring(0, 5);
                  // isSelected: el slot seleccionado actualmente.
                  const isSelected = selectedSlot?.startTime === slot.startTime;
                  return (
                    // key compuesto: evita conflictos si dos empleados tienen el mismo slot.
                    <button
                      key={`${slot.employeeId}-${slot.startTime}`}
                      type="button"
                      onClick={() => handleSlotSelect(slot)}
                      className={`py-1.5 text-sm rounded-lg border transition-colors ${
                        isSelected
                          ? 'bg-primary-600 text-white border-primary-600'
                          : 'border-gray-300 text-gray-700 hover:border-primary-400 hover:bg-primary-50'
                      }`}
                    >
                      {formatTime(time)}
                    </button>
                  );
                })}
              </div>
            );
          })() // () al final: invoca la función inmediatamente
        )}
      </div>
    </div>
  );
}
