// ─── attendance/page.tsx — Asistencia del Empleado ───────────────────────
//
// Esta página está en /employee/attendance y permite al empleado:
//   1. Registrar su ENTRADA al trabajo (check-in con geolocalización).
//   2. Registrar su SALIDA del trabajo (check-out con geolocalización).
//   3. Ver el HISTORIAL de sus registros de los últimos 30 días.
//
// ¿CÓMO FUNCIONA LA GEOLOCALIZACIÓN?
// El navegador obtiene la ubicación GPS del dispositivo (con permiso del usuario).
// El backend valida que las coordenadas estén dentro del radio permitido del negocio.
// Si está fuera del radio → muestra un aviso y ofrece enviar a revisión manual.
//
// ESTRUCTURA:
// - EmployeeAttendancePage (componente principal con las 2 pestañas)
//   - RegisterTab (Tab 1: reloj y botones de entrada/salida)
//   - HistoryTab  (Tab 2: lista de registros de los últimos 30 días)

'use client';
// 'use client' → obligatorio por el uso de useState, useQuery, etc.

import { useState } from 'react';
// useState → para controlar la pestaña activa, errores, estado de carga, etc.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
// useQuery     → para obtener el registro de asistencia de hoy.
// useMutation  → para registrar entrada/salida (modifican datos en el servidor).
// useQueryClient → para invalidar la caché después de hacer check-in/out.

import { api } from '@/lib/api';
// api → cliente HTTP con JWT.

import { useAuth } from '@/lib/hooks/use-auth';
// useAuth → para obtener los datos del usuario autenticado (avatar, nombre).

// Tab: tipo de unión que define las dos pestañas de la página.
type Tab = 'register' | 'history';

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────
export default function EmployeeAttendancePage() {
  // activeTab: pestaña activa. Empieza en 'register' (la más usada).
  const [activeTab, setActiveTab] = useState<Tab>('register');

  return (
    <div className="flex flex-col h-full">
      {/* ─── Barra de pestañas ────────────────────────────────────────── */}
      <div className="border-b border-gray-200 px-6 flex items-center gap-6">
        {/* Generamos los botones de pestaña con .map() */}
        {([
          { key: 'register' as Tab, label: 'Registrar' },
          { key: 'history' as Tab, label: 'Historial de registros' },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)} // cambia la pestaña al hacer clic
            // Clases dinámicas con template literal:
            // Si es la pestaña activa → línea inferior teal + texto teal.
            // Si no → sin línea + texto gris (con hover más oscuro).
            className={`py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-[#008080] text-[#008080]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─── Contenido de la pestaña activa ──────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {/* Renderizado condicional: mostramos el componente correspondiente
            a la pestaña activa. Solo uno se renderiza a la vez. */}
        {activeTab === 'register' && <RegisterTab />}
        {activeTab === 'history' && <HistoryTab />}
      </div>
    </div>
  );
}

// ─── RegisterTab: Pestaña de registro de asistencia ──────────────────────
// Muestra la hora actual y los botones de entrada/salida.
// La geolocalización se obtiene ANTES de enviar al servidor.
function RegisterTab() {
  const queryClient = useQueryClient();
  const { user } = useAuth(); // para mostrar el avatar y nombre del empleado

  // error: mensaje de error a mostrar al usuario (null = sin error)
  const [error, setError] = useState<string | null>(null);

  // geoLoading: true mientras el navegador está obteniendo la ubicación GPS.
  // Esta operación puede tardar unos segundos.
  const [geoLoading, setGeoLoading] = useState(false);

  // outOfRangeInfo: datos del error "fuera de rango". Si el empleado está
  // demasiado lejos del negocio, guardamos aquí la distancia y las coordenadas
  // para poder enviarlas igualmente si el empleado decide "Enviar a revisión".
  // null = no hay error de rango.
  const [outOfRangeInfo, setOutOfRangeInfo] = useState<{ distance: number; type: 'in' | 'out'; coords: { latitude: number; longitude: number } } | null>(null);

  // Obtenemos el registro de asistencia de HOY.
  // refetchInterval: 30000 → React Query refresca automáticamente cada 30 segundos.
  // Esto actualiza el estado si el administrador modifica el registro desde el panel.
  const { data, isLoading } = useQuery({
    queryKey: ['my-attendance-today'],
    queryFn: () => api.get<{ data: any }>('/api/attendance/me/today'),
    refetchInterval: 30000, // 30,000 milisegundos = 30 segundos
  });

  // Extraemos el registro. data?.data → acceso seguro al objeto de datos.
  const record = data?.data || null;
  // !! convierte un valor a booleano: !!null = false, !!"2026-03-15T10:00:00Z" = true
  const hasCheckedIn = !!record?.checkInTime;   // true si ya registró entrada
  const hasCheckedOut = !!record?.checkOutTime; // true si ya registró salida

  // checkInMutation: registra la ENTRADA. Recibe las coordenadas GPS.
  // forceOutOfRange (opcional) → si true, registra aunque esté fuera del rango.
  const checkInMutation = useMutation({
    mutationFn: (body: { latitude: number; longitude: number; forceOutOfRange?: boolean }) =>
      api.post('/api/attendance/check-in', body),
    onSuccess: () => {
      setError(null);
      setOutOfRangeInfo(null);
      // Invalidamos la caché para que la pantalla se actualice con el nuevo registro.
      queryClient.invalidateQueries({ queryKey: ['my-attendance-today'] });
    },
    onError: (err: any) => handleError(err, 'in'), // 'in' = era un check-in
  });

  // checkOutMutation: registra la SALIDA. Misma estructura que checkInMutation.
  const checkOutMutation = useMutation({
    mutationFn: (body: { latitude: number; longitude: number; forceOutOfRange?: boolean }) =>
      api.post('/api/attendance/check-out', body),
    onSuccess: () => {
      setError(null);
      setOutOfRangeInfo(null);
      queryClient.invalidateQueries({ queryKey: ['my-attendance-today'] });
    },
    onError: (err: any) => handleError(err, 'out'), // 'out' = era un check-out
  });

  // lastCoords: variable local (no estado) que guarda las coordenadas obtenidas.
  // Se usa para reenviarlas si el usuario decide forzar el registro fuera de rango.
  // No usamos useState porque no necesitamos re-renderizar al cambiar.
  let lastCoords: { latitude: number; longitude: number } | null = null;

  // handleError: procesa los errores de las mutaciones.
  // Si el error es 'OUT_OF_RANGE', guardamos info del rango para el panel de aviso.
  // Si es otro error, mostramos el mensaje genérico.
  function handleError(err: any, type: 'in' | 'out') {
    try {
      // El backend envía el error como un JSON en el mensaje → lo parseamos.
      const parsed = JSON.parse(err.message);
      if (parsed.code === 'OUT_OF_RANGE') {
        // Guardamos la distancia, el tipo (in/out) y las coordenadas para el reintento.
        setOutOfRangeInfo({ distance: parsed.distance, type, coords: lastCoords! });
        setError(`Estás a ${parsed.distance}m del negocio (máximo ${parsed.allowedRadius}m).`);
        return;
      }
    } catch {} // Si el mensaje no es JSON válido, ignoramos el error de parseo
    setError(err.message || 'Error al registrar');
  }

  // handleAction: función principal para registrar entrada o salida.
  // 1. Pide permiso de geolocalización al navegador.
  // 2. Obtiene las coordenadas GPS.
  // 3. Envía las coordenadas al backend con la mutación correspondiente.
  function handleAction(type: 'in' | 'out') {
    setError(null); setOutOfRangeInfo(null); setGeoLoading(true);

    // navigator.geolocation → API del navegador para geolocalización.
    // No todos los navegadores la tienen (aunque es raro hoy en día).
    if (!navigator.geolocation) {
      setError('Tu navegador no soporta geolocalización.');
      setGeoLoading(false);
      return;
    }

    // getCurrentPosition: pide la ubicación actual al dispositivo.
    // CALLBACK DE ÉXITO: recibe el objeto Position con las coordenadas.
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoLoading(false);
        // pos.coords.latitude y pos.coords.longitude son los valores GPS.
        const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        lastCoords = coords; // guardamos para posible reintento fuera de rango
        // Según el tipo, ejecutamos check-in o check-out.
        if (type === 'in') checkInMutation.mutate(coords); else checkOutMutation.mutate(coords);
      },
      // CALLBACK DE ERROR: si el usuario rechazó el permiso o hubo otro error.
      (err) => {
        setGeoLoading(false);
        // err.PERMISSION_DENIED es una constante del API de geolocalización.
        // err.code === err.PERMISSION_DENIED → el usuario bloqueó el acceso.
        setError(err.code === err.PERMISSION_DENIED
          ? 'Debes permitir el acceso a tu ubicación.'
          : 'No se pudo obtener tu ubicación.');
      },
      // OPCIONES: máxima precisión, timeout de 10 segundos.
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  // handleForceRegister: el empleado está fuera del rango pero quiere registrar
  // igual (el administrador revisará manualmente).
  // Reenvía las coordenadas con forceOutOfRange=true.
  function handleForceRegister() {
    if (!outOfRangeInfo) return;
    // Desestructuramos para obtener el tipo y las coordenadas guardadas.
    const { type, coords } = outOfRangeInfo;
    // ...coords es el "spread operator": expande las propiedades de coords
    // (latitude y longitude) como campos del nuevo objeto.
    if (type === 'in') checkInMutation.mutate({ ...coords, forceOutOfRange: true });
    else checkOutMutation.mutate({ ...coords, forceOutOfRange: true });
  }

  // Hora y fecha actuales para mostrar en la pantalla del reloj.
  // new Date() → fecha/hora del navegador (hora local del dispositivo).
  // toLocaleTimeString('es', ...) → formatea en español (ej: "10:30")
  const now = new Date();
  const timeStr = now.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });

  // isPending: true si cualquiera de las operaciones asíncronas está en progreso.
  // Se usa para desactivar los botones y evitar doble clic.
  const isPending = geoLoading || checkInMutation.isPending || checkOutMutation.isPending;

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 py-10">
      {/* Identidad — deja claro de quién es la asistencia que se registra */}
      {user && (
        <div className="mb-6 flex items-center gap-3 bg-white border border-gray-200 rounded-full pl-1 pr-4 py-1">
          <div className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: '#008080' }}>
            {user.avatarUrl
              ? <img src={user.avatarUrl.startsWith('http') ? user.avatarUrl : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}${user.avatarUrl}`} alt="" className="w-full h-full object-cover" />
              : <span>{(user.firstName?.[0] || '') + (user.lastName?.[0] || '')}</span>}
          </div>
          <div className="leading-tight">
            <p className="text-[10px] text-gray-400">Registrando asistencia de</p>
            <p className="text-sm font-semibold text-gray-900">{user.firstName} {user.lastName}</p>
          </div>
        </div>
      )}

      <p className="text-5xl font-bold text-gray-900 tabular-nums mb-1">{timeStr}</p>
      <p className="text-sm text-gray-400 capitalize mb-8">{dateStr}</p>

      <div className="w-full max-w-sm bg-white rounded-2xl border border-gray-200 shadow-sm p-6 text-center">
        {isLoading ? (
          <div className="h-24 animate-pulse bg-gray-100 rounded-xl" />
        ) : hasCheckedOut ? (
          <>
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-50 flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            </div>
            <p className="text-sm font-semibold text-gray-900 mb-1">Turno completado</p>
            {record.status === 'PENDING_REVIEW' && <p className="text-xs text-teal-700 bg-teal-50 rounded-lg px-2 py-1 inline-block mb-2">Pendiente de revisión por admin</p>}
            <div className="flex justify-center gap-6 text-xs text-gray-500 mt-3">
              <div><p className="text-gray-400">Entrada</p><p className="font-mono font-medium text-gray-700">{new Date(record.checkInTime).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</p></div>
              <div><p className="text-gray-400">Salida</p><p className="font-mono font-medium text-gray-700">{new Date(record.checkOutTime).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</p></div>
              <div>
                <p className="text-gray-400">Duración</p>
                <p className="font-mono font-medium text-gray-700">
                  {(() => { const mins = Math.round((new Date(record.checkOutTime).getTime() - new Date(record.checkInTime).getTime()) / 60000); return mins < 60 ? `${mins}min` : `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, '0')}`; })()}
                </p>
              </div>
            </div>
          </>
        ) : hasCheckedIn ? (
          <>
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-teal-50 flex items-center justify-center"><div className="w-3 h-3 rounded-full bg-[#008080] animate-pulse" /></div>
            <p className="text-sm font-semibold text-gray-900 mb-1">En turno</p>
            {record.status === 'PENDING_REVIEW' && <p className="text-xs text-teal-700 bg-teal-50 rounded-lg px-2 py-1 inline-block mb-2">Pendiente de revisión</p>}
            <p className="text-xs text-gray-400 mb-4">Entrada: {new Date(record.checkInTime).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</p>
            <button onClick={() => handleAction('out')} disabled={isPending} className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-50 bg-red-600 hover:bg-red-700">
              {isPending ? 'Obteniendo ubicación...' : 'Registrar salida'}
            </button>
          </>
        ) : (
          <>
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-50 flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <p className="text-sm text-gray-500 mb-4">Aún no has registrado tu entrada hoy.</p>
            <button onClick={() => handleAction('in')} disabled={isPending} className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-50" style={{ backgroundColor: '#008080' }}>
              {isPending ? 'Obteniendo ubicación...' : 'Registrar entrada'}
            </button>
          </>
        )}

        {error && !outOfRangeInfo && <div className="mt-4 px-3 py-2 rounded-lg bg-red-50 border border-red-200"><p className="text-xs text-red-700">{error}</p></div>}
        {outOfRangeInfo && (
          <div className="mt-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-center">
            <p className="text-xs text-red-700 mb-3">No estás dentro del rango, te encuentras a <span className="font-bold">{outOfRangeInfo.distance}m</span>. ¿Deseas enviar tu registro de todos modos? El administrador revisará el registro.</p>
            <button onClick={handleForceRegister} disabled={isPending} className="w-full py-2.5 rounded-xl text-xs font-medium bg-gray-100 border border-gray-200 text-gray-700 hover:bg-gray-200 disabled:opacity-50 transition-colors">
              {isPending ? 'Enviando...' : 'Enviar a revisión'}
            </button>
          </div>
        )}
      </div>

      <p className="text-[10px] text-gray-300 mt-6 text-center max-w-xs">Tu ubicación se valida para confirmar que estás en el lugar de trabajo.</p>
    </div>
  );
}

// ─── HistoryTab: Historial de registros de asistencia ─────────────────────
// Muestra los registros de los últimos 30 días con entrada, salida y duración.
function HistoryTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['my-attendance-history'],
    queryFn: () => api.get<{ data: any[] }>('/api/attendance/me/history'),
    // Sin refetchInterval: el historial no necesita actualizarse cada 30s.
  });

  // records: arreglo de registros de asistencia. Si aún no llegaron, usamos [].
  const records = data?.data || [];

  return (
    <div className="p-6 max-w-lg mx-auto pb-24 lg:pb-6">
      <p className="text-sm text-gray-500 mb-4">Tu historial de asistencia de los últimos 30 días.</p>

      {/* Renderizado condicional en cadena:
          1. Cargando → skeletons animados
          2. Sin registros → mensaje vacío
          3. Con registros → lista */}
      {isLoading ? (
        // Skeletons: cajas grises animadas que simulan el contenido mientras carga.
        // [1, 2, 3].map() → genera 3 elementos con índice como key.
        <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      ) : records.length === 0 ? (
        <p className="text-center text-sm text-gray-400 py-12">Sin registros de asistencia</p>
      ) : (
        // divide-y → línea horizontal entre cada elemento de la lista.
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {/* Iteramos sobre cada registro. r es el objeto del registro actual. */}
          {records.map((r: any) => {
            // Formateamos la hora de entrada y salida.
            // Si no hay hora registrada, mostramos '—' (guión largo).
            const checkIn = r.checkInTime
              ? new Date(r.checkInTime).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
              : '—';
            const checkOut = r.checkOutTime
              ? new Date(r.checkOutTime).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
              : '—';

            // Calculamos la duración del turno en minutos.
            // Solo si hay AMBAS horas (entrada y salida registradas).
            // .getTime() convierte fecha a milisegundos.
            // / 60000 convierte milisegundos a minutos (1 min = 60,000 ms).
            const totalMin = r.checkInTime && r.checkOutTime
              ? Math.round((new Date(r.checkOutTime).getTime() - new Date(r.checkInTime).getTime()) / 60000)
              : null;

            // Formateamos la duración:
            // < 60 minutos → "45min"
            // >= 60 minutos → "8:30" (horas:minutos)
            // Math.floor(totalMin / 60) → parte entera de las horas
            // totalMin % 60 → minutos restantes (módulo)
            // String(...).padStart(2, '0') → si son 5 minutos, muestra "05" (rellena con ceros)
            const duration = totalMin != null
              ? (totalMin < 60
                ? `${totalMin}min`
                : `${Math.floor(totalMin / 60)}:${String(totalMin % 60).padStart(2, '0')}`)
              : '—';

            // Diccionario de estados del registro con su etiqueta y color.
            const statusInfo: Record<string, { label: string; color: string }> = {
              APPROVED:      { label: 'Aprobado',    color: 'text-green-600 bg-green-50' },
              PENDING_REVIEW:{ label: 'En revisión', color: 'text-teal-700 bg-teal-50' },
              REJECTED:      { label: 'Rechazado',   color: 'text-red-600 bg-red-50' },
            };
            // Si el estado no está en el diccionario, usamos APPROVED como fallback.
            const st = statusInfo[r.status] || statusInfo.APPROVED;

            return (
              <div key={r.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  {/* Fecha del registro formateada en español. capitalize → primera letra en mayúscula */}
                  <p className="text-sm font-medium text-gray-900 capitalize">
                    {new Date(r.date).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'short' })}
                  </p>
                  {/* Rango de horas: "10:00 — 18:30" */}
                  <p className="text-xs text-gray-400 mt-0.5">{checkIn} — {checkOut}</p>
                </div>
                <div className="flex items-center gap-3">
                  {/* font-mono → fuente monoespaciada para alinear los números */}
                  <span className="text-sm font-mono font-medium text-gray-700">{duration}</span>
                  {/* Badge de estado con color dinámico del diccionario statusInfo */}
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${st.color}`}>{st.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
