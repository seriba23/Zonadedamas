// ─────────────────────────────────────────────────────────────────────────────
// ARCHIVO: apps/web/src/app/employee/inbox/page.tsx
// RUTA EN EL NAVEGADOR: /employee/inbox
//
// QUÉ ES ESTO:
//   Esta es la página de la "Bandeja de entrada" (Inbox) del portal del
//   empleado. Es la pantalla donde el empleado ve sus mensajes internos,
//   por ejemplo: avisos del negocio, notificaciones de nuevas citas, etc.
//
// CONCEPTO — App Router (Next.js 14):
//   En Next.js 14 con App Router, CADA CARPETA dentro de "app/" puede tener
//   un archivo llamado "page.tsx". Ese archivo representa la página que se
//   muestra cuando el usuario visita esa URL.
//   Ejemplo: la carpeta "employee/inbox/" + "page.tsx" → URL /employee/inbox
//
// CONCEPTO — 'use client':
//   Esta directiva al inicio del archivo le dice a Next.js:
//   "Este componente se ejecuta en el NAVEGADOR (cliente), no en el servidor."
//   Es necesario cuando el componente usa hooks de React (useState, useEffect),
//   o cuando importa otros componentes que también usan esas cosas.
//   Sin 'use client', Next.js intentaría renderizarlo en el servidor y fallaría.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

// ─── IMPORTACIÓN ─────────────────────────────────────────────────────────────
// Importamos el componente StaffInbox desde la carpeta de componentes.
//
// CONCEPTO — Componentes en React:
//   Un componente es una función que devuelve JSX (HTML especial de React).
//   En lugar de escribir toda la lógica aquí, la tenemos en un componente
//   separado llamado StaffInbox, y simplemente lo usamos aquí.
//   Esto se llama "composición": una página grande se arma con piezas más
//   pequeñas y reutilizables.
//
// '@/components/notifications/staff-inbox' → el "@/" es un alias de ruta que
//   apunta a la carpeta "src/", así no tenemos que escribir "../../components/..."
// ─────────────────────────────────────────────────────────────────────────────
import { StaffInbox } from '@/components/notifications/staff-inbox';

// ─── COMPONENTE DE PÁGINA ─────────────────────────────────────────────────────
// "export default" significa que este es el componente PRINCIPAL del archivo.
// Next.js busca específicamente un "export default" en page.tsx para saber
// qué renderizar cuando el usuario visita la ruta /employee/inbox.
//
// CONCEPTO — JSX:
//   El código que parece HTML dentro de una función de JavaScript/TypeScript
//   se llama JSX. React lo transforma en elementos reales de la pantalla.
//   Aquí simplemente devolvemos <StaffInbox />, que es el componente importado
//   arriba. React lo renderizará como si fuese una etiqueta HTML personalizada.
// ─────────────────────────────────────────────────────────────────────────────
export default function EmployeeInboxPage() {
  // Esta página es un simple "contenedor": no tiene lógica propia.
  // Toda la lógica (llamadas al API, estado, renderizado de mensajes)
  // vive dentro del componente StaffInbox.
  // Devolvemos directamente el componente sin envolverlo en nada más.
  return <StaffInbox />;
}
