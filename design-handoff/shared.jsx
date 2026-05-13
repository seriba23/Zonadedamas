// shared.jsx — shared primitives + mock appointment data for both variations

// ─── Mock appointment data ────────────────────────────────────────────────
const APPT = {
  id: 'cita-841',
  status: 'confirmada',
  date: '14 may 2026',
  weekday: 'Jueves',
  timeStart: '11:00',
  timeEnd: '12:30',
  duration: 90,
  client: {
    name: 'Fernando Ortiz',
    initials: 'FO',
    email: 'cliente.demo8@example.com',
    phone: '+52 55 1822 4471',
    visits: 7,
    lastVisit: 'hace 3 semanas',
  },
  pro: {
    name: 'Renata Castillo',
    initials: 'RC',
    role: 'Estilista senior',
  },
  services: [
    { name: 'Tinte de Cabello', minutes: 90, price: 75 },
  ],
  subtotal: 75,
  total: 75,
  notes: 'Cliente prefiere tonos cálidos. Alergia leve al amoníaco — usar línea sin amoníaco.',
};

// ─── Icons ────────────────────────────────────────────────────────────────
const Icon = {
  Close:    (p) => <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...p}><path d="M6 6l12 12M18 6L6 18"/></svg>,
  Phone:    (p) => <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.72 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0 1 22 16.92z"/></svg>,
  Whatsapp: (p) => <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" {...p}><path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.1s-.8.9-1 1.1c-.2.2-.4.2-.7.1-.3-.1-1.2-.4-2.4-1.5-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6.1-.1.3-.4.4-.5.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5 0-.1-.7-1.7-1-2.3-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4s-1 1-1 2.5 1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.2 4.5.7.3 1.3.5 1.7.6.7.2 1.3.2 1.8.1.6-.1 1.7-.7 1.9-1.3.2-.7.2-1.2.2-1.3-.1-.2-.3-.2-.6-.4zM12 2C6.5 2 2 6.5 2 12c0 1.8.5 3.4 1.3 4.9L2 22l5.3-1.3c1.4.8 3 1.2 4.7 1.2 5.5 0 10-4.5 10-10S17.5 2 12 2z"/></svg>,
  Message:  (p) => <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>,
  Camera:   (p) => <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>,
  Plus:     (p) => <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...p}><path d="M12 5v14M5 12h14"/></svg>,
  Calendar: (p) => <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>,
  Clock:    (p) => <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>,
  Check:    (p) => <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M20 6L9 17l-5-5"/></svg>,
  Sparkle:  (p) => <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z"/></svg>,
  Upload:   (p) => <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>,
  Dots:     (p) => <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" {...p}><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>,
  ChevR:    (p) => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M9 6l6 6-6 6"/></svg>,
  X:        (p) => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" {...p}><path d="M6 6l12 12M18 6L6 18"/></svg>,
};

// ─── Avatar with deterministic gradient + initials ────────────────────────
function Avatar({ initials, size = 40, ring }) {
  // Hash initials to a hue
  const hue = (initials.charCodeAt(0) * 17 + initials.charCodeAt(1) * 31) % 360;
  const bg = `linear-gradient(135deg, oklch(0.75 0.08 ${hue}) 0%, oklch(0.55 0.10 ${(hue+40)%360}) 100%)`;
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontWeight: 700, fontSize: size * 0.36,
      flexShrink: 0,
      boxShadow: ring ? '0 0 0 3px ' + ring : 'inset 0 -2px 6px rgba(0,0,0,.08)',
      letterSpacing: '0.01em',
    }}>
      {initials}
    </div>
  );
}

// ─── Status pill ──────────────────────────────────────────────────────────
function StatusPill({ status, size = 'md' }) {
  const map = {
    confirmada: { bg: 'var(--info-soft)', fg: 'var(--info)',    dot: 'var(--info)',    label: 'Confirmada' },
    en_curso:   { bg: '#fff4d6',          fg: '#9a6a00',         dot: '#f59e0b',        label: 'En curso' },
    completada: { bg: 'var(--teal-50)',   fg: 'var(--teal-700)', dot: 'var(--teal-500)',label: 'Completada' },
    cancelada:  { bg: 'var(--rose-soft)', fg: 'var(--rose)',     dot: 'var(--rose)',    label: 'Cancelada' },
  };
  const s = map[status] || map.confirmada;
  const pad = size === 'lg' ? '6px 12px 6px 10px' : '3px 10px 3px 8px';
  const fs = size === 'lg' ? 13 : 11.5;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: pad, borderRadius: 999,
      background: s.bg, color: s.fg,
      fontWeight: 600, fontSize: fs, letterSpacing: '.01em',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: s.dot }} />
      {s.label}
    </span>
  );
}

// ─── Money formatter ──────────────────────────────────────────────────────
const money = (n) => 'MXN ' + Number(n).toFixed(2);

// Expose to other Babel scripts
Object.assign(window, { APPT, Icon, Avatar, StatusPill, money });
