// ─── page.tsx — Dashboard principal del Empleado ──────────────────────────
//
// En App Router de Next.js, el archivo page.tsx dentro de una carpeta
// define la PÁGINA que se muestra cuando el usuario visita esa ruta.
// Este archivo es /employee/page.tsx → se muestra en /employee (la ruta raíz
// del portal del empleado, que es el dashboard o "inicio").
//
// ¿QUÉ MUESTRA ESTA PÁGINA?
// 1. Cabecera con avatar y saludo personalizado ("Hola, nombre").
// 2. Cuatro tarjetas de estadísticas: citas hoy, citas este mes,
//    ingresos totales y valoración promedio.
// 3. Acciones rápidas: botones de acceso directo a las secciones principales.
// 4. Bloque de comisiones (si tiene comisiones registradas).
// 5. Próxima cita del día (si existe alguna próxima a comenzar).
// 6. Lista de citas del día actual.
// 7. Servicios más realizados (con barras de progreso comparativas).
// 8. Clientes más frecuentes (con barras de progreso comparativas).

'use client';
// 'use client' es necesario porque usamos hooks (useState, useQuery, etc.)
// que solo funcionan en el navegador, no en el servidor.

import { useAuth } from '@/lib/hooks/use-auth';
// useAuth → hook que devuelve el usuario autenticado y su estado de sesión.

import { useQuery } from '@tanstack/react-query';
// useQuery → hace peticiones HTTP al servidor y guarda los datos en caché.
// Si dos componentes piden los mismos datos, React Query los comparte.

import { api } from '@/lib/api';
// api → cliente HTTP configurado con el baseURL y el token JWT automático.

import { formatDate, formatCurrency as rawFormatCurrency } from '@/lib/utils';
// formatDate → formatea fechas (usa dayjs internamente).
// rawFormatCurrency → formatea montos como "$1,500.00" (formato base sin divisa).
// "as rawFormatCurrency" es un alias: importamos formatCurrency pero la llamamos
// rawFormatCurrency para distinguirla de la versión con moneda preferida del usuario.

import { useCurrency } from '@/lib/hooks/use-currency';
// useCurrency → hook que devuelve la función format() configurada con la
// moneda preferida del usuario (MXN, USD, etc.).

import dayjs from 'dayjs';
// dayjs → librería de manejo de fechas (más ligera que moment.js).
// Permite formatear, comparar y manipular fechas fácilmente.

import Link from 'next/link';
// Link → componente de Next.js para navegar entre páginas sin recargar.

// URL base del backend (sin ruta). Se usa para construir URLs de imágenes.
// process.env.NEXT_PUBLIC_API_URL → variable de entorno definida en .env.local
// Las variables NEXT_PUBLIC_* están disponibles en el navegador (lado cliente).
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// ─── INTERFACES (contratos de tipos TypeScript) ────────────────────────────
// Las interfaces definen la FORMA que deben tener los objetos.
// TypeScript usa esto para detectar errores antes de ejecutar el código.
// Es como decir "este objeto SIEMPRE tendrá estos campos con estos tipos".

// AppointmentItem: un servicio dentro de una cita.
// "Snapshot" significa que es una copia del precio/nombre en el momento de
// la reserva (aunque el servicio cambie de precio después, este queda fijo).
interface AppointmentItem {
  serviceNameSnapshot: string;       // nombre del servicio al momento de reservar
  priceSnapshot: string | number;    // precio (puede venir como texto o número)
  durationSnapshot: number;          // duración en minutos
}

// Appointment: una cita completa con su cliente y sus servicios.
interface Appointment {
  id: string;        // identificador único (UUID)
  startTime: string; // fecha/hora de inicio en formato ISO (ej: "2026-03-15T10:00:00Z")
  endTime: string;   // fecha/hora de fin
  status: string;    // estado: "PENDING", "CONFIRMED", "COMPLETED", etc.
  client: { id: string; firstName: string; lastName: string };
  // client es un objeto anidado con los datos básicos del cliente
  items: AppointmentItem[]; // arreglo de servicios (una cita puede tener varios)
}

// Stats: estadísticas del empleado, calculadas por el backend.
interface Stats {
  completedAllTime: number;          // total de citas completadas en toda la historia
  completedThisMonth: number;        // completadas en el mes actual
  cancelledCount: number;            // total de cancelaciones
  noShowCount: number;               // total de ausencias (no-shows)
  cancellationRate: number;          // tasa de cancelación (porcentaje)
  totalRevenue: number;              // ingresos generados en total
  revenueThisMonth: number;          // ingresos generados este mes
  totalCommissions: number;          // comisiones acumuladas totales
  commissionsThisMonth: number;      // comisiones del mes actual
  averageRating: number | null;      // valoración promedio (null si no hay reseñas)
  totalReviews: number;              // número total de reseñas
  topServices: { serviceName: string; count: number }[]; // servicios más realizados
  topClients: { clientName: string; count: number }[];   // clientes más frecuentes
  upcomingAppointments: any[];       // próximas citas (no usadas en el dashboard)
}

// STATUS_LABELS: diccionario que convierte los códigos de estado (en inglés,
// como los guarda la BD) a etiquetas legibles en español con sus colores.
// Record<string, { label: string; color: string }> → tipo TypeScript que
// describe un objeto donde las claves son strings y los valores tienen
// esa forma específica.
const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING:     { label: 'Pendiente',  color: 'bg-yellow-100 text-yellow-800' },
  CONFIRMED:   { label: 'Confirmada', color: 'bg-blue-100 text-blue-800' },
  RESCHEDULED: { label: 'Reagendada', color: 'bg-orange-100 text-orange-800' },
  IN_PROGRESS: { label: 'En curso',   color: 'bg-purple-100 text-purple-800' },
  COMPLETED:   { label: 'Completada', color: 'bg-green-100 text-green-800' },
  CANCELLED:   { label: 'Cancelada',  color: 'bg-red-100 text-red-800' },
  NO_SHOW:     { label: 'Ausente',    color: 'bg-gray-100 text-gray-800' },
};

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────
// export default → exporta el componente como principal del archivo.
// Next.js lo renderiza cuando el usuario visita /employee.
export default function EmployeeDashboard() {
  // Obtenemos el usuario autenticado del contexto de autenticación.
  const { user } = useAuth();

  // useCurrency() devuelve un objeto con la función format() configurada
  // con la moneda del usuario. Si el hook devuelve null (no configurado),
  // usamos rawFormatCurrency como respaldo.
  // ?? es el operador "nullish coalescing": si lo de la izquierda es
  // null o undefined, usa lo de la derecha.
  const currencyHook = useCurrency();
  const formatCurrency = currencyHook?.format ?? rawFormatCurrency;

  // today: fecha de hoy en formato "YYYY-MM-DD" (ej: "2026-06-17").
  // dayjs() sin argumentos = momento actual.
  // .format('YYYY-MM-DD') = lo convierte al string de esa forma.
  const today = dayjs().format('YYYY-MM-DD');

  // ─── QUERY 1: Citas de hoy ───────────────────────────────────────────
  // useQuery hace la petición automáticamente cuando el componente se monta.
  // Devuelve { data, isLoading, isError, refetch, ... }.
  // data → los datos del servidor (undefined mientras carga).
  // isLoading → true mientras espera la respuesta.
  const { data: appointments, isLoading } = useQuery({
    // queryKey: identificador único. Si cambia user?.employeeId, React Query
    // detecta que son datos diferentes y vuelve a hacer la petición.
    queryKey: ['employee-appointments-today', user?.employeeId],
    queryFn: async () => {
      // Si no hay employeeId (aún cargando), devolvemos arreglo vacío.
      if (!user?.employeeId) return [];
      const res = await api.get<{ data: Appointment[] }>(
        // Petición al backend filtrando por empleado y fecha de hoy.
        // startDate=endDate=today → solo citas de hoy.
        `/api/appointments?employeeId=${user.employeeId}&startDate=${today}&endDate=${today}`,
      );
      // res.data contiene el arreglo de citas devuelto por el backend.
      return res.data;
    },
    // enabled: la query no se ejecuta hasta que haya employeeId.
    // !! convierte undefined → false (sin ejecutar), string → true (ejecuta).
    enabled: !!user?.employeeId,
  });

  // ─── QUERY 2: Estadísticas del empleado ──────────────────────────────
  // Se hace de forma paralela a la query de citas (React Query las lanza
  // al mismo tiempo sin esperar una a la otra).
  const { data: stats } = useQuery({
    queryKey: ['employee-stats', user?.employeeId],
    queryFn: async () => {
      const res = await api.get<{ data: Stats }>(
        `/api/employees/me/stats`,
        // user! → el "!" es el operador "non-null assertion" de TypeScript.
        // Le dice al compilador "confía en mí, user no es null aquí"
        // (porque enabled ya lo verifica antes).
      );
      return res.data;
    },
    enabled: !!user?.employeeId,
  });

  // sortedAppointments: lista de citas de hoy SIN canceladas, ordenadas
  // por hora de inicio (la más temprana primero).
  // (appointments || []) → si appointments es undefined (cargando), usamos [].
  // .filter() → crea un nuevo arreglo excluyendo las canceladas.
  // .sort() → ordena; devuelve negativo si 'a' va antes, positivo si va después.
  // .getTime() convierte una fecha a milisegundos para comparar numéricamente.
  const sortedAppointments = (appointments || [])
    .filter((a) => a.status !== 'CANCELLED')
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  // nextAppointment: la PRÓXIMA cita que aún no comenzó y está activa.
  // .find() devuelve el PRIMER elemento que cumple la condición (o undefined).
  // new Date(a.startTime) > new Date() → la cita es en el futuro.
  // .includes(a.status) → el estado es uno de los activos (no cancelada ni completada).
  const nextAppointment = sortedAppointments.find(
    (a) => new Date(a.startTime) > new Date() && ['PENDING', 'CONFIRMED', 'RESCHEDULED'].includes(a.status),
  );

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4">
          {user?.avatarUrl ? (
            <div className="w-14 h-14 rounded-full overflow-hidden flex-shrink-0">
              <img src={`${API_URL}${user.avatarUrl}`} alt="" className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-14 h-14 rounded-full bg-teal-50 text-[#008080] flex items-center justify-center text-lg font-bold flex-shrink-0">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Hola, {user?.firstName}
            </h1>
            <p className="text-gray-500 mt-0.5">
              {formatDate(new Date(), 'dddd, D [de] MMMM [de] YYYY')}
            </p>
          </div>
        </div>
      </div>

      {/* ─── TARJETAS DE ESTADÍSTICAS ─────────────────────────────────── */}
      {/* grid: disposición en cuadrícula.
          grid-cols-2 → 2 columnas en móvil.
          lg:grid-cols-4 → 4 columnas en pantallas grandes (>= 1024px). */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">

        {/* Tarjeta 1: Citas de hoy → lleva a Mis citas (pestaña Hoy). */}
        <Link
          href="/employee/appointments?section=today"
          className="bg-white rounded-xl border border-gray-200 p-4 hover:border-[#008080]/30 hover:shadow-sm transition-all"
        >
          <p className="text-xs font-medium text-gray-500 mb-1">Citas hoy</p>
          <p className="text-2xl font-bold text-gray-900">
            {/* Ternario: si isLoading es true muestra "...", si no muestra
                el número de citas (sortedAppointments.length = cantidad). */}
            {isLoading ? '...' : sortedAppointments.length}
          </p>
        </Link>

        {/* Tarjeta 2: Completadas este mes → Mis citas (mes corriente, completadas). */}
        <Link
          href="/employee/appointments?range=month&status=COMPLETED"
          className="bg-white rounded-xl border border-gray-200 p-4 hover:border-[#008080]/30 hover:shadow-sm transition-all"
        >
          <p className="text-xs font-medium text-gray-500 mb-1">Este mes</p>
          <p className="text-2xl font-bold text-gray-900">
            {/* stats?.completedThisMonth → acceso seguro: si stats es undefined
                (aún cargando), devuelve undefined en lugar de dar error.
                ?? '...' → si es undefined, muestra '...' como respaldo. */}
            {stats?.completedThisMonth ?? '...'}
          </p>
          <p className="text-xs text-gray-400">completadas</p>
        </Link>

        {/* Tarjeta 3: Ingresos generados ESTE MES → atajo a Comisiones. */}
        <Link
          href="/employee/commissions?period=this_month"
          className="bg-white rounded-xl border border-gray-200 p-4 hover:border-[#008080]/30 hover:shadow-sm transition-all"
        >
          <p className="text-xs font-medium text-gray-500 mb-1">Ingresos generados</p>
          <p className="text-2xl font-bold text-[#008080]">
            {/* Ingresos del mes corriente (mismo filtro que se lleva a Comisiones). */}
            {stats ? formatCurrency(stats.revenueThisMonth) : '...'}
          </p>
          <p className="text-xs text-gray-400">este mes</p>
        </Link>

        {/* Tarjeta 4: Valoración promedio → Mis reseñas. */}
        <Link
          href="/employee/reviews"
          className="bg-white rounded-xl border border-gray-200 p-4 hover:border-[#008080]/30 hover:shadow-sm transition-all"
        >
          <p className="text-xs font-medium text-gray-500 mb-1">Valoración</p>
          <div className="flex items-center gap-1.5">
            <p className="text-2xl font-bold text-amber-500">
              {/* Si no hay valoración (null), mostramos '-' en lugar de un número */}
              {stats?.averageRating ?? '-'}
            </p>
            {/* && → solo muestra la estrella si averageRating tiene valor (no es null/0) */}
            {stats?.averageRating && (
              <svg className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            )}
          </div>
          {/* ?? 0 → si totalReviews es undefined/null, usa 0 */}
          <p className="text-xs text-gray-400">{stats?.totalReviews ?? 0} reseñas</p>
        </Link>
      </div>

      {/* ─── ACCIONES RÁPIDAS ────────────────────────────────────────────── */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Acciones rápidas</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {/* Generamos los botones con .map() sobre un arreglo de objetos.
              Cada objeto tiene: label (texto del botón), href (ruta de destino),
              e icon (el trazado SVG del ícono correspondiente).

              .map() recorre cada elemento del arreglo y devuelve JSX.
              key={action.label} → React necesita una clave única por elemento
              para hacer el reconciliado eficiente del DOM virtual. */}
          {[
            { label: 'Mis Citas', href: '/employee/appointments', icon: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5' },
            { label: 'Comisiones', href: '/employee/commissions', icon: 'M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
            { label: 'Galería', href: '/employee/profile?tab=portfolio', icon: 'M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z' },
            { label: 'Mi Horario', href: '/employee/schedule', icon: 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z' },
            { label: 'Reseñas', href: '/employee/reviews', icon: 'M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z' },
            { label: 'Asistencia', href: '/employee/attendance', icon: 'M15 10.5a3 3 0 11-6 0 3 3 0 016 0z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z' },
          ].map((action) => (
            <Link
              key={action.label}
              href={action.href}
              // Clases de hover (estado al pasar el ratón):
              // hover:bg-[#e0f2f1] → fondo teal suave al hacer hover
              // hover:text-[#008080] → texto teal al hacer hover
              className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border border-gray-100 bg-gray-50 hover:bg-[#e0f2f1] hover:border-[#008080]/20 text-gray-600 hover:text-[#008080] transition-colors"
            >
              {/* El trazado SVG viene del objeto action.icon (string con el "d" del path).
                  Esto permite reusar el mismo código SVG para todos los botones
                  y solo cambiar el trazado según el ícono que necesitamos. */}
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d={action.icon} />
              </svg>
              <span className="text-xs font-medium">{action.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Commission highlight */}
      {stats && stats.totalCommissions > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900">Comisiones</h2>
            <Link href="/employee/commissions" className="text-xs text-[#008080] font-medium hover:underline">
              Ver detalle
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500">Total acumulado</p>
              <p className="text-xl font-bold text-green-600">{formatCurrency(stats.totalCommissions)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Este mes</p>
              <p className="text-xl font-bold text-[#008080]">{formatCurrency(stats.commissionsThisMonth)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Next appointment highlight */}
      {nextAppointment && (
        <div className="bg-primary-50 border border-primary-200 rounded-xl p-5 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-[#008080] mb-1">Próxima cita</p>
              <p className="text-lg font-bold text-gray-900">
                {dayjs.utc(nextAppointment.startTime).format('h:mm A')}
              </p>
              <p className="text-sm text-gray-600">
                {nextAppointment.client.firstName} {nextAppointment.client.lastName}
                {' — '}
                {nextAppointment.items.map((i) => i.serviceNameSnapshot).join(', ')}
              </p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-[#008080]">
                {formatCurrency(nextAppointment.items.reduce((s, i) => s + Number(i.priceSnapshot), 0))}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ─── LISTA DE CITAS DEL DÍA ──────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 mb-6">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Citas del día</h2>
          <Link href="/employee/appointments" className="text-xs text-[#008080] font-medium hover:underline">
            Ver todas
          </Link>
        </div>

        {/* Renderizado condicional en cadena (if-else con ternarios anidados):
            1. Si está cargando → mostrar "Cargando..."
            2. Si no hay citas → mostrar mensaje vacío
            3. Si hay citas → renderizar la lista */}
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Cargando...</div>
        ) : sortedAppointments.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            No tienes citas programadas para hoy
          </div>
        ) : (
          // <ul> semántico para listas. divide-y → línea horizontal entre items.
          <ul className="divide-y divide-gray-100">
            {/* .map() convierte cada cita en un <li> (elemento de lista).
                El bloque de código dentro del .map() se ejecuta para CADA
                elemento del arreglo sortedAppointments. */}
            {sortedAppointments.map((apt) => {
              // Buscamos el objeto de etiqueta/color para este estado.
              // Si el estado no está en el diccionario, usamos PENDING como fallback.
              const status = STATUS_LABELS[apt.status] || STATUS_LABELS.PENDING;

              // Calculamos el total de la cita sumando los precios de todos
              // los servicios incluidos en apt.items.
              // .reduce(acumulador, valorInicial):
              //   - empieza con sum=0
              //   - por cada item 'i', suma el precio al acumulador
              //   - Number() convierte string "150.00" → número 150
              const totalPrice = apt.items.reduce(
                (sum, i) => sum + Number(i.priceSnapshot),
                0, // valor inicial del acumulador
              );

              return (
                // key={apt.id} → React necesita un identificador único por elemento
                // de lista. Usamos el id de la cita que es un UUID único.
                <li key={apt.id} className="px-5 py-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {/* Bloque de hora */}
                      <div className="text-center min-w-[60px]">
                        <p className="text-sm font-semibold text-gray-900">
                          {/* dayjs.utc() → interpreta la fecha como UTC (zona horaria
                              del servidor) para mostrarla correctamente.
                              'h:mm A' → formato 12 horas con AM/PM (ej: "3:30 PM") */}
                          {dayjs.utc(apt.startTime).format('h:mm A')}
                        </p>
                        <p className="text-xs text-gray-400">
                          {dayjs.utc(apt.endTime).format('h:mm A')}
                        </p>
                      </div>
                      {/* Nombre y servicios */}
                      <div>
                        <p className="font-medium text-gray-900">
                          {apt.client.firstName} {apt.client.lastName}
                        </p>
                        <p className="text-sm text-gray-500">
                          {/* .map() para extraer el nombre de cada servicio,
                              .join(', ') los une con coma: "Corte, Tinte, Manicure" */}
                          {apt.items.map((i) => i.serviceNameSnapshot).join(', ')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-700">
                        {formatCurrency(totalPrice)}
                      </span>
                      {/* Badge de estado con color dinámico. Las clases CSS vienen
                          del diccionario STATUS_LABELS (línea teal, verde, etc.) */}
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}
                      >
                        {status.label}
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* ─── SERVICIOS MÁS REALIZADOS ────────────────────────────────────── */}
      {/* stats && stats.topServices.length > 0 → doble condición:
          primero verificamos que stats exista, luego que tenga al menos un servicio.
          Si alguna condición falla, no se renderiza nada (&&). */}
      {stats && stats.topServices.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 mb-6">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Servicios más realizados</h2>
          </div>
          <div className="p-5">
            <div className="space-y-3">
              {/* Iteramos sobre los servicios más realizados.
                  'i' es el ÍNDICE (posición: 0, 1, 2...) del elemento en el arreglo.
                  Lo usamos como key porque los servicios no tienen un id propio aquí. */}
              {stats.topServices.map((s, i) => {
                // El primer elemento [0] siempre tiene el count más alto
                // (el backend devuelve la lista ordenada de mayor a menor).
                // Lo usamos como máximo para calcular el porcentaje de la barra.
                const maxCount = stats.topServices[0].count;

                // pct: porcentaje relativo al servicio más realizado.
                // Si el más realizado tiene 20 y este tiene 10, pct = 50%.
                // Esto hace que la barra del primero llegue al 100% y las
                // demás sean proporcionales.
                const pct = Math.round((s.count / maxCount) * 100);

                return (
                  <div key={i}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-700">{s.serviceName}</span>
                      {/* s.count → número de veces que se realizó este servicio */}
                      <span className="font-medium text-gray-900">{s.count}</span>
                    </div>
                    {/* Barra de progreso: fondo gris + relleno teal proporcional */}
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-primary-500 h-2 rounded-full transition-all"
                        // El ancho de la barra azul/teal cambia dinámicamente
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ─── CLIENTES MÁS FRECUENTES ─────────────────────────────────────── */}
      {/* Misma lógica de barras proporcionales, pero para clientes. */}
      {stats && stats.topClients && stats.topClients.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 mb-6">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Clientes más frecuentes</h2>
          </div>
          <div className="p-5">
            <div className="space-y-3">
              {stats.topClients.map((c, i) => {
                // 'c' es el objeto cliente actual (clientName + count).
                // 'i' es el índice (0, 1, 2...) para usar como key.
                const maxCount = stats.topClients[0].count;
                const pct = Math.round((c.count / maxCount) * 100);
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-700">{c.clientName}</span>
                      {/* c.count → número de veces que vino este cliente */}
                      <span className="font-medium text-gray-900">{c.count} visitas</span>
                    </div>
                    {/* Barra dorada (bg-amber-400) para diferenciar de la de servicios */}
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-amber-400 h-2 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
