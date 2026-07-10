// ─────────────────────────────────────────────────────────────────────────────
// Registro de "ayuda por sección" (onboarding contextual).
//
// Cada entrada asocia una RUTA con unos slides que explican esa sección. El
// componente <SectionHelp> (header) toma la ruta actual, busca aquí sus slides y
// muestra el ícono ⓘ que abre el onboarding. Para añadir/editar una sección solo
// se toca este archivo — no hay que editar cada página.
//
// IMPORTANTE: getSectionHelp devuelve la PRIMERA entrada cuyo match() da true, así
// que las rutas más específicas (p. ej. /settings/notificaciones) deben ir ANTES
// que las genéricas (/settings).
// ─────────────────────────────────────────────────────────────────────────────
import type { OnboardingSlide } from '@/components/ui/onboarding-carousel';

export interface SectionHelpEntry {
  key: string;
  title: string;
  match: (pathname: string) => boolean;
  slides: OnboardingSlide[];
}

// Íconos (paths SVG de Heroicons) reutilizados en los slides.
const I = {
  home: 'M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25',
  chart: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z',
  calendar: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5',
  plus: 'M12 4.5v15m7.5-7.5h-15',
  check: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  users: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z',
  userGroup: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z',
  chat: 'M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z',
  card: 'M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z',
  receipt: 'M8.25 6.75h7.5M8.25 12h7.5m-7.5 5.25h4.5M3.375 3h17.25c.621 0 1.125.504 1.125 1.125v15.75l-3-1.5-3 1.5-3-1.5-3 1.5-3-1.5-3 1.5V4.125C2.25 3.504 2.754 3 3.375 3z',
  sparkles: 'M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z',
  tag: 'M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3zM6 6h.008v.008H6V6z',
  key: 'M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z',
  box: 'M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10.5 11.25h3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z',
  arrowDown: 'M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3',
  truck: 'M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12',
  storefront: 'M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72M6 6.75h.008v.008H6V6.75z',
  bookmark: 'M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z',
  star: 'M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z',
  bell: 'M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0',
  gear: 'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281zM15 12a3 3 0 11-6 0 3 3 0 016 0z',
  gift: 'M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z',
  clock: 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z',
  coin: 'M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  person: 'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z',
  cube: 'M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9',
  warn: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.008v.008H12v-.008z',
};

export const SECTION_HELP: SectionHelpEntry[] = [
  // ─── PANEL DE ADMINISTRACIÓN ───────────────────────────────────────────────
  {
    key: 'home', title: 'Inicio', match: (p) => p.startsWith('/home'),
    slides: [
      { icon: I.home, title: 'Tu panel de inicio', text: 'Un vistazo rápido a tu día: ventas, próximas citas y las métricas clave de tu negocio.' },
      { icon: I.chart, title: 'Todo empieza aquí', text: 'Desde el menú lateral llegas a cada sección. El ícono ⓘ te explica cómo funciona la que estés viendo.' },
    ],
  },
  {
    key: 'pos', title: 'Punto de Venta', match: (p) => p.startsWith('/pos'),
    slides: [
      { icon: I.card, title: 'Cobra en segundos', text: 'Registra ventas de servicios y productos, aplica descuentos y elige el método de pago.' },
      { icon: I.receipt, title: 'Todo queda registrado', text: 'Cada venta se guarda y suma a tus reportes. Puedes cobrar con o sin una cita asociada.' },
    ],
  },
  {
    key: 'reports', title: 'Reportes', match: (p) => p.startsWith('/reports'),
    slides: [
      { icon: I.chart, title: 'Cómo va tu negocio', text: 'Ingresos, servicios más vendidos, mejores clientes y comisiones, todo con gráficas claras.' },
      { icon: I.calendar, title: 'Filtra por periodo', text: 'Elige el rango de fechas para analizar tu día, tu semana, tu mes o un periodo a la medida.' },
    ],
  },
  {
    key: 'calendar', title: 'Citas', match: (p) => p.startsWith('/calendar'),
    slides: [
      { icon: I.calendar, title: 'Tu agenda en un lugar', text: 'Ve y gestiona todas las citas por día, semana o mes. Cada empleado aparece con su propio color.' },
      { icon: I.plus, title: 'Crea y organiza', text: 'Toca un espacio libre para agendar. Edita o mueve citas, y filtra por empleado o servicio.' },
      { icon: I.check, title: 'Cierra la cita', text: 'Al terminar, registra el pago y marca la cita como completada desde la misma tarjeta.' },
    ],
  },
  {
    key: 'reminders', title: 'Recordatorios', match: (p) => p.startsWith('/reminders'),
    slides: [
      { icon: I.bell, title: 'Recordatorios automáticos', text: 'Siliba avisa a tus clientes de sus próximas citas para reducir las inasistencias.' },
      { icon: I.chat, title: 'Menos ausencias', text: 'Revisa qué recordatorios se enviaron y a quién, y da seguimiento cuando haga falta.' },
    ],
  },
  {
    key: 'clients', title: 'Clientes', match: (p) => p.startsWith('/clients'),
    slides: [
      { icon: I.users, title: 'Tu cartera de clientes', text: 'Todos tus clientes en un solo lugar, con su historial de citas, notas y datos de contacto.' },
      { icon: I.chat, title: 'Agrega y contacta', text: 'Crea clientes con el botón "Nuevo" y contáctalos por teléfono, WhatsApp o correo desde su ficha.' },
      { icon: I.person, title: 'No necesitan cuenta', text: 'Tus clientes no requieren una cuenta en Siliba: los das de alta directamente con su nombre y teléfono, sin que ellos tengan que registrarse.' },
    ],
  },
  {
    key: 'services', title: 'Servicios', match: (p) => p.startsWith('/services'),
    slides: [
      { icon: I.sparkles, title: 'Tu catálogo de servicios', text: 'Aquí van los trabajos que REALIZAS y que tus clientes reservan: nombre, precio, duración y qué profesionales lo hacen.' },
      { icon: I.warn, title: 'Aquí NO van productos', text: 'Los productos que vendes (cremas, velas, aceites, etc.) NO se cargan como servicios ni como fotos de portafolio. Los productos van en Inventario y Tienda; un servicio siempre es algo que se agenda y se realiza.' },
      { icon: I.tag, title: 'Precios, anticipos y puntos', text: 'Configura comisiones, el anticipo requerido y los puntos de recompensa de cada servicio.' },
    ],
  },
  {
    key: 'staff', title: 'Personal', match: (p) => p.startsWith('/staff'),
    slides: [
      { icon: I.userGroup, title: 'Tu equipo', text: 'Da de alta a tus empleados y asígnales un color, sus servicios y su horario.' },
      { icon: I.key, title: 'Permisos y roles', text: 'Controla qué ve y hace cada quien: tus empleados solo verán lo que tú quieras que vean. Incluso puedes convertir a un empleado en administrador parcial.' },
    ],
  },
  // Pestañas de Personal (misma URL /staff). No se seleccionan por ruta —el ⓘ las
  // toma por "key" cuando la página fija la pestaña activa (match: () => false).
  {
    key: 'staff-permisos', title: 'Permisos', match: () => false,
    slides: [
      { icon: I.calendar, title: 'Aprueba ausencias', text: 'Cuando un empleado pide un día libre o una ausencia, aquí la revisas y la apruebas o rechazas.' },
    ],
  },
  {
    key: 'staff-asistencias', title: 'Asistencias', match: () => false,
    slides: [
      { icon: I.clock, title: 'Asistencia de tu equipo', text: 'Consulta las entradas y salidas de tus empleados y su historial de asistencia.' },
    ],
  },
  {
    key: 'staff-horarios', title: 'Horarios', match: () => false,
    slides: [
      { icon: I.clock, title: 'Horarios del equipo', text: 'Define el horario de cada empleado; sus citas solo se agendan dentro de su disponibilidad.' },
    ],
  },
  {
    key: 'staff-comisiones', title: 'Comisiones', match: () => false,
    slides: [
      { icon: I.coin, title: 'Comisiones del equipo', text: 'Consulta las comisiones que gana cada empleado y confírmalas cuando se las pagues.' },
    ],
  },
  {
    key: 'staff-organigrama', title: 'Organigrama', match: () => false,
    slides: [
      { icon: I.userGroup, title: 'Organigrama', text: 'Visualiza la estructura de tu equipo: quién es administrador y cómo se organiza tu personal.' },
    ],
  },
  {
    key: 'bundles', title: 'Paquetes', match: (p) => p.startsWith('/bundles'),
    slides: [
      { icon: I.cube, title: '¿Qué es un paquete?', text: 'Combina varios servicios en uno solo con precio especial (ej. "corte + barba") o un bono de varias sesiones. Tu cliente lo compra como un solo producto.' },
      { icon: I.tag, title: 'Vende más por visita', text: 'Los paquetes suben el ticket promedio y fidelizan: ideales para promociones y bonos de sesiones.' },
    ],
  },
  {
    key: 'rewards', title: 'Cupones', match: (p) => p.startsWith('/rewards'),
    slides: [
      { icon: I.gift, title: '¿Qué son los cupones?', text: 'Recompensas que tus clientes canjean: acumulan puntos por sus compras y los cambian por servicios o descuentos. Aquí también viven las promociones tipo 2×1.' },
      { icon: I.sparkles, title: 'Crea una recompensa', text: 'Defines qué se canjea y con cuántos puntos; el cupón se genera solo y el cliente lo usa al pagar.' },
    ],
  },
  {
    key: 'inventory', title: 'Inventario', match: (p) => p.startsWith('/inventory'),
    slides: [
      { icon: I.box, title: 'Controla tu stock', text: 'Registra tus productos y existencias. Sabes qué tienes y qué se está agotando.' },
      { icon: I.arrowDown, title: 'Entradas y salidas', text: 'El stock baja solo al vender en el Punto de Venta; ajústalo manualmente cuando lo necesites.' },
    ],
  },
  {
    key: 'suppliers', title: 'Proveedores', match: (p) => p.startsWith('/suppliers'),
    slides: [
      { icon: I.truck, title: 'Tus proveedores', text: 'Guarda a quién le compras tus productos y su información de contacto.' },
      { icon: I.box, title: 'Ligado al inventario', text: 'Asocia productos a su proveedor para reordenar fácil cuando se agoten.' },
    ],
  },
  {
    key: 'shop', title: 'Tienda', match: (p) => p.startsWith('/shop'),
    slides: [
      { icon: I.storefront, title: 'Vende en línea', text: 'Publica productos para que tus clientes los aparten o compren desde el marketplace.' },
      { icon: I.card, title: 'Cobra y entrega', text: 'Recibe apartados, confirma pagos y coordina la entrega desde aquí.' },
    ],
  },
  {
    key: 'reservations', title: 'Apartados', match: (p) => p.startsWith('/reservations'),
    slides: [
      { icon: I.bookmark, title: 'Apartados de productos', text: 'Cuando un cliente aparta un producto de tu tienda, aparece aquí para que lo gestiones.' },
      { icon: I.check, title: 'Confirma y entrega', text: 'Revisa el comprobante de pago y marca el apartado como entregado.' },
    ],
  },
  {
    key: 'reviews', title: 'Reseñas', match: (p) => p.startsWith('/reviews'),
    slides: [
      { icon: I.star, title: 'Lo que dicen de ti', text: 'Consulta las reseñas de tus clientes sobre tu negocio y tus profesionales.' },
      { icon: I.chat, title: 'Cuida tu reputación', text: 'Las buenas reseñas atraen más clientes desde el marketplace.' },
    ],
  },
  {
    key: 'resources', title: 'Activos y Recursos', match: (p) => p.startsWith('/resources'),
    slides: [
      { icon: I.cube, title: 'Activos y recursos', text: 'Gestiona salas, equipos o recursos que se reservan junto con una cita para no empalmarlos.' },
    ],
  },
  // Ajustes: las rutas específicas van ANTES que /settings genérico.
  {
    key: 'settings-notifications', title: 'Notificaciones', match: (p) => p.startsWith('/settings/notifications'),
    slides: [
      { icon: I.bell, title: 'Notificaciones', text: 'Elige qué avisos quieres recibir y activa las notificaciones push de tu navegador.' },
    ],
  },
  {
    key: 'subscription', title: 'Suscripción', match: (p) => p.startsWith('/settings/subscription'),
    slides: [
      { icon: I.card, title: 'Tu suscripción', text: 'Consulta tu plan, tu método de pago y las licencias de empleados activas.' },
      { icon: I.sparkles, title: 'Crece sin límites', text: 'Agrega empleados o mejora tu plan cuando quieras; se cobra por asiento activo.' },
    ],
  },
  {
    key: 'settings', title: 'Configuración', match: (p) => p.startsWith('/settings'),
    slides: [
      { icon: I.gear, title: 'Configuración', text: 'Ajusta los datos de tu negocio, tus ubicaciones, horarios y preferencias generales.' },
    ],
  },

  // ─── PORTAL DE EMPLEADO / FREELANCER (/employee/*) ─────────────────────────
  {
    key: 'emp-appointments', title: 'Mis Citas', match: (p) => p.startsWith('/employee/appointments'),
    slides: [
      { icon: I.calendar, title: 'Tus citas', text: 'Consulta y gestiona tus citas del día. Cada tarjeta muestra el servicio, el cliente y la hora.' },
      { icon: I.check, title: 'Cierra tu cita', text: 'Al terminar, registra el pago y márcala como completada desde la propia cita.' },
    ],
  },
  {
    key: 'emp-pos', title: 'Punto de Venta', match: (p) => p.startsWith('/employee/pos'),
    slides: [
      { icon: I.card, title: 'Cobra en segundos', text: 'Registra ventas de servicios y productos, con o sin cita, y elige el método de pago.' },
    ],
  },
  {
    key: 'emp-clients', title: 'Clientes', match: (p) => p.startsWith('/employee/clients'),
    slides: [
      { icon: I.users, title: 'Tus clientes', text: 'Tu cartera personal con el historial de cada cliente y sus datos de contacto.' },
    ],
  },
  {
    key: 'emp-reports', title: 'Reportes', match: (p) => p.startsWith('/employee/reports'),
    slides: [
      { icon: I.chart, title: 'Tus números', text: 'Ingresos, servicios más vendidos y tu desempeño, con gráficas por periodo.' },
    ],
  },
  {
    key: 'emp-services', title: 'Servicios', match: (p) => p.startsWith('/employee/services'),
    slides: [
      { icon: I.sparkles, title: 'Tus servicios', text: 'Define lo que ofreces: nombre, precio y duración de cada servicio.' },
    ],
  },
  {
    key: 'emp-inventory', title: 'Inventario', match: (p) => p.startsWith('/employee/inventory'),
    slides: [
      { icon: I.box, title: 'Tu inventario', text: 'Controla el stock de tus productos; baja solo al vender.' },
    ],
  },
  {
    key: 'emp-shop', title: 'Tienda', match: (p) => p.startsWith('/employee/shop'),
    slides: [
      { icon: I.storefront, title: 'Tu tienda', text: 'Publica productos para vender en línea desde el marketplace.' },
    ],
  },
  {
    key: 'emp-anticipo', title: 'Anticipo', match: (p) => p.startsWith('/employee/anticipo'),
    slides: [
      { icon: I.card, title: 'Anticipos', text: 'Pide un anticipo al reservar para asegurar la cita y reducir inasistencias.' },
    ],
  },
  {
    key: 'emp-attendance', title: 'Asistencia', match: (p) => p.startsWith('/employee/attendance'),
    slides: [
      { icon: I.clock, title: 'Tu asistencia', text: 'Registra tu entrada y salida; tu asistencia queda registrada para tu negocio.' },
    ],
  },
  {
    key: 'emp-commissions', title: 'Comisiones', match: (p) => p.startsWith('/employee/commissions'),
    slides: [
      { icon: I.coin, title: 'Tus comisiones', text: 'Consulta cuánto has ganado en comisiones y el estado de cada pago.' },
    ],
  },
  {
    key: 'emp-reviews', title: 'Reseñas', match: (p) => p.startsWith('/employee/reviews'),
    slides: [
      { icon: I.star, title: 'Tus reseñas', text: 'Mira lo que opinan tus clientes sobre tu trabajo.' },
    ],
  },
  {
    key: 'emp-schedule', title: 'Mi Horario', match: (p) => p.startsWith('/employee/schedule'),
    slides: [
      { icon: I.clock, title: 'Tu horario', text: 'Define los días y horas en que atiendes; tus citas se agendan dentro de tu disponibilidad.' },
    ],
  },
  {
    key: 'emp-timeoff', title: 'Permisos', match: (p) => p.startsWith('/employee/time-off'),
    slides: [
      { icon: I.calendar, title: 'Permisos y ausencias', text: 'Solicita días libres o ausencias; tu administrador los aprueba.' },
    ],
  },
  {
    key: 'emp-profile', title: 'Mi Perfil', match: (p) => p.startsWith('/employee/profile'),
    slides: [
      { icon: I.person, title: 'Tu perfil', text: 'Tu foto, tus datos y la galería de tu trabajo que ven los clientes en el marketplace.' },
    ],
  },
  {
    key: 'emp-inbox', title: 'Notificaciones', match: (p) => p.startsWith('/employee/inbox') || p.startsWith('/employee/notifications'),
    slides: [
      { icon: I.bell, title: 'Tus notificaciones', text: 'Avisos de nuevas citas, cambios y más. Actívalas en tu navegador para no perdértelas.' },
    ],
  },
  {
    key: 'emp-subscription', title: 'Suscripción', match: (p) => p.startsWith('/employee/subscription'),
    slides: [
      { icon: I.card, title: 'Tu suscripción', text: 'Consulta y gestiona tu plan de Siliba.' },
    ],
  },
  {
    key: 'emp-settings', title: 'Configuración', match: (p) => p.startsWith('/employee/settings'),
    slides: [
      { icon: I.gear, title: 'Configuración', text: 'Ajusta tus preferencias y los datos de tu cuenta.' },
    ],
  },
  // Inicio del empleado (ruta exacta, para no chocar con las subrutas de arriba).
  {
    key: 'emp-home', title: 'Inicio', match: (p) => p === '/employee',
    slides: [
      { icon: I.home, title: 'Tu inicio', text: 'Un resumen de tu día: tus próximas citas y accesos rápidos a lo que más usas.' },
    ],
  },
];

// getSectionHelp(): devuelve la entrada de ayuda que aplica a la ruta actual, o
// null si esa sección aún no tiene onboarding definido.
export function getSectionHelp(pathname: string): SectionHelpEntry | null {
  return SECTION_HELP.find((h) => h.match(pathname)) || null;
}

// getSectionHelpByKey(): busca una entrada por su key (para la ayuda por pestaña,
// donde la página fija el key de la pestaña activa en vez de depender de la ruta).
export function getSectionHelpByKey(key: string): SectionHelpEntry | null {
  return SECTION_HELP.find((h) => h.key === key) || null;
}
