// ─────────────────────────────────────────────────────────────────────────────
// Registro de "ayuda por sección" (onboarding contextual).
//
// Cada entrada asocia una RUTA con unos slides que explican esa sección. El
// componente <SectionHelp> (header) toma la ruta actual, busca aquí sus slides y
// muestra el ícono ⓘ + el onboarding. Para añadir/editar una sección, solo se
// toca este archivo — no hay que editar cada página.
//
// key: identificador estable para recordar en localStorage si ya se vio.
// ─────────────────────────────────────────────────────────────────────────────
import type { OnboardingSlide } from '@/components/ui/onboarding-carousel';

export interface SectionHelpEntry {
  key: string;
  title: string;
  // match: decide si esta entrada aplica a la ruta actual.
  match: (pathname: string) => boolean;
  slides: OnboardingSlide[];
}

// Íconos (paths SVG de Heroicons) reutilizados en varios slides.
const I = {
  calendar: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5',
  plus: 'M12 4.5v15m7.5-7.5h-15',
  check: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  home: 'M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25',
  chart: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z',
  users: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z',
  chat: 'M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z',
  card: 'M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z',
  receipt: 'M8.25 6.75h7.5M8.25 12h7.5m-7.5 5.25h4.5M3.375 3h17.25c.621 0 1.125.504 1.125 1.125v15.75l-3-1.5-3 1.5-3-1.5-3 1.5-3-1.5-3 1.5V4.125C2.25 3.504 2.754 3 3.375 3z',
};

// Nota: por ahora incluye el primer lote (Inicio, Citas, Clientes, Punto de
// Venta). El resto de secciones se irá agregando aquí mismo.
export const SECTION_HELP: SectionHelpEntry[] = [
  {
    key: 'home',
    title: 'Inicio',
    match: (p) => p === '/home' || p.startsWith('/home'),
    slides: [
      { icon: I.home, title: 'Tu panel de inicio', text: 'Un vistazo rápido a tu día: ventas, próximas citas y las métricas clave de tu negocio.' },
      { icon: I.chart, title: 'Todo empieza aquí', text: 'Desde el menú lateral llegas a Citas, Clientes, Punto de Venta y más. El ícono ⓘ de cada sección te explica cómo funciona.' },
    ],
  },
  {
    key: 'calendar',
    title: 'Citas',
    match: (p) => p.startsWith('/calendar'),
    slides: [
      { icon: I.calendar, title: 'Tu agenda en un lugar', text: 'Ve y gestiona todas las citas por día, semana o mes. Cada empleado aparece con su propio color.' },
      { icon: I.plus, title: 'Crea y organiza', text: 'Toca un espacio libre para agendar. Edita o mueve citas, y filtra por empleado o servicio.' },
      { icon: I.check, title: 'Cierra la cita', text: 'Al terminar, registra el pago y marca la cita como completada desde la misma tarjeta.' },
    ],
  },
  {
    key: 'clients',
    title: 'Clientes',
    match: (p) => p.startsWith('/clients'),
    slides: [
      { icon: I.users, title: 'Tu cartera de clientes', text: 'Todos tus clientes en un solo lugar, con su historial de citas, notas y datos de contacto.' },
      { icon: I.chat, title: 'Agrega y contacta', text: 'Crea clientes con el botón "Nuevo" y contáctalos por teléfono, WhatsApp o correo desde su ficha.' },
    ],
  },
  {
    key: 'pos',
    title: 'Punto de Venta',
    match: (p) => p.startsWith('/pos'),
    slides: [
      { icon: I.card, title: 'Cobra en segundos', text: 'Registra ventas de servicios y productos, aplica descuentos y elige el método de pago.' },
      { icon: I.receipt, title: 'Todo queda registrado', text: 'Cada venta se guarda y suma a tus reportes. Puedes cobrar con o sin una cita asociada.' },
    ],
  },
];

// getSectionHelp(): devuelve la entrada de ayuda que aplica a la ruta actual, o
// null si esa sección aún no tiene onboarding.
export function getSectionHelp(pathname: string): SectionHelpEntry | null {
  return SECTION_HELP.find((h) => h.match(pathname)) || null;
}
