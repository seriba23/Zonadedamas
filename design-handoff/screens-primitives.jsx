// screens-primitives.jsx — shared icons, primitives, mock data

// ─── Icons (heroicons outline, 1.5 stroke) ─────────────────────────────
const I = (d, size=20) => (props) => (
  <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" {...props}>
    {Array.isArray(d) ? d.map((p,i) => <path key={i} strokeLinecap="round" strokeLinejoin="round" d={p}/>) : <path strokeLinecap="round" strokeLinejoin="round" d={d}/>}
  </svg>
);
const Icons = {
  Home:     I('M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75'),
  POS:      I('M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75'),
  Reports:  I('M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z'),
  Calendar: I('M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5'),
  Clients:  I('M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z'),
  Services: I('M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z'),
  Staff:    I('M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z'),
  Inventory:I('M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z'),
  Shop:     I('M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z'),
  Bell:     I('M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0'),
  Cog:      I('M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z M15 12a3 3 0 11-6 0 3 3 0 016 0z'),
  Plus:     I('M12 4.5v15m7.5-7.5h-15', 18),
  Search:   I('M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z', 18),
  Filter:   I('M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z', 18),
  Bars:     I('M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5', 22),
  Cash:     I('M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75'),
  Check:    I('M4.5 12.75l6 6 9-13.5', 18),
  Chevron:  I('M8.25 4.5l7.5 7.5-7.5 7.5', 14),
  Dots:     I('M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM18.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0z'),
  Phone:    I('M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z', 16),
  Mail:     I('M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75', 16),
  Map:      I('M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z', 16),
  Camera:   I('M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.822 1.316z'),
  Sun:      I('M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z', 18),
  Moon:     I('M21.752 15.002A9.72 9.72 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z', 18),
  Star:     I('M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z', 14),
  Clock:    I('M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z', 16),
  Arrow:    I('M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25', 14),
  TrendUp:  I('M2.25 18L9 11.25l4.306 4.306a11.95 11.95 0 015.814-5.518l2.74-1.22m0 0l-5.94-2.281m5.94 2.28l-2.28 5.941', 16),
  Bookmark: I('M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z', 16),
  X:        I('M6 18L18 6M6 6l12 12', 18),
};

// ─── Brand / chrome — wordmark only (no S icon) ────────────────────────
function Logo({ size = 22, color = 'var(--primary-600)' }) {
  return (
    <span style={{
      fontFamily: 'Inter', fontWeight: 800, fontSize: size,
      letterSpacing: '-.025em', color,
      lineHeight: 1,
    }}>Siliba</span>
  );
}

// ─── Mobile chrome ─────────────────────────────────────────────────────
function MobileTopbar({ title, eyebrow, accent = false, onSearch, onFilter, onBell, onMore, leading }) {
  const bg = accent ? 'var(--primary-600)' : 'var(--bg-surface)';
  const fg = accent ? '#fff' : 'var(--text-primary)';
  const ico = accent ? 'rgba(255,255,255,.18)' : 'transparent';
  const icoColor = accent ? '#fff' : 'var(--text-secondary)';
  return (
    <div style={{ padding: '14px 16px 12px', background: bg, borderBottom: accent ? 'none' : '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {leading || (
          <button style={{ width: 36, height: 36, borderRadius: 10, background: ico, border: 'none', color: icoColor, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <Icons.Bars />
          </button>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          {eyebrow && <div style={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em', color: accent ? 'rgba(255,255,255,.85)' : 'var(--text-muted)' }}>{eyebrow}</div>}
          <div style={{ fontSize: 16, fontWeight: 700, color: fg, letterSpacing: '-.01em' }}>{title}</div>
        </div>
        {onSearch && (
          <button style={{ width: 36, height: 36, borderRadius: 10, background: ico, border: 'none', color: icoColor, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <Icons.Search />
          </button>
        )}
        {onFilter && (
          <button style={{ width: 36, height: 36, borderRadius: 10, background: ico, border: 'none', color: icoColor, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <Icons.Filter />
          </button>
        )}
        {onBell && (
          <button style={{ width: 36, height: 36, borderRadius: 10, background: ico, border: 'none', color: icoColor, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative' }}>
            <Icons.Bell />
            <span style={{ position: 'absolute', top: 8, right: 9, width: 7, height: 7, borderRadius: 999, background: accent ? '#fef08a' : 'var(--danger-600)', border: `2px solid ${accent ? 'var(--primary-600)' : 'var(--bg-surface)'}` }}/>
          </button>
        )}
        {onMore && (
          <button style={{ width: 36, height: 36, borderRadius: 10, background: ico, border: 'none', color: icoColor, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <Icons.Plus />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Mobile bottom nav · 4 main slots + "Más" sheet ───────────────────
const MOBILE_NAV_PRIMARY = [
  { key: 'home',     label: 'Inicio',   icon: <Icons.Home /> },
  { key: 'calendar', label: 'Citas',    icon: <Icons.Calendar /> },
  { key: 'reports',  label: 'Reportes', icon: <Icons.Reports /> },
  { key: 'profile',  label: 'Perfil',   icon: <Icons.Staff /> },
];

const MOBILE_NAV_MORE = [
  { key: 'pos',          label: 'Punto de Venta', icon: <Icons.POS /> },
  { key: 'clients',      label: 'Clientes',       icon: <Icons.Clients /> },
  { key: 'services',     label: 'Servicios',      icon: <Icons.Services /> },
  { key: 'staff',        label: 'Personal',       icon: <Icons.Staff /> },
  { key: 'inventory',    label: 'Inventario',     icon: <Icons.Inventory /> },
  { key: 'shop',         label: 'Tienda',         icon: <Icons.Shop /> },
  { key: 'notifications',label: 'Notificaciones', icon: <Icons.Bell /> },
  { key: 'settings',     label: 'Configuración',  icon: <Icons.Cog /> },
];

function MobileBottomNav({ active = 'home' }) {
  const [moreOpen, setMoreOpen] = React.useState(false);

  return (
    <React.Fragment>
      {/* "Más" bottom sheet */}
      {moreOpen && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 10 }}>
          {/* backdrop */}
          <div onClick={() => setMoreOpen(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,.5)', backdropFilter: 'blur(2px)' }} />
          {/* sheet */}
          <div style={{
            position: 'absolute', left: 0, right: 0, bottom: 0,
            background: 'var(--bg-surface)',
            borderRadius: '22px 22px 0 0',
            padding: '12px 16px 22px',
            boxShadow: '0 -16px 50px rgba(0,0,0,.2)',
          }}>
            {/* grabber */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
              <div style={{ width: 36, height: 4, borderRadius: 999, background: 'var(--gray-300)' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, padding: '0 4px' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Más opciones</div>
              <button onClick={() => setMoreOpen(false)} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'var(--bg-canvas)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icons.X size={16} />
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {MOBILE_NAV_MORE.map(it => (
                <button key={it.key} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '14px 6px', background: 'var(--bg-canvas)', border: '1px solid var(--border)',
                  borderRadius: 12, cursor: 'pointer', minHeight: 84,
                }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--primary-50)', color: 'var(--primary-600)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {it.icon}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', textAlign: 'center', lineHeight: 1.2 }}>{it.label}</span>
                </button>
              ))}
            </div>
            {/* Logout */}
            <button style={{
              width: '100%', marginTop: 12, height: 44, borderRadius: 12,
              background: 'transparent', border: '1px solid var(--border)',
              color: 'var(--danger-600)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
            }}>
              Cerrar sesión
            </button>
          </div>
        </div>
      )}

      {/* Bottom nav bar */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        background: 'var(--bg-surface)', borderTop: '1px solid var(--border)',
        display: 'flex', height: 66, padding: '6px 0 12px',
      }}>
        {MOBILE_NAV_PRIMARY.map(t => {
          const isActive = t.key === active;
          return (
            <button key={t.key} style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
              color: isActive ? 'var(--primary-600)' : 'var(--text-muted)',
              background: 'transparent', border: 'none', cursor: 'pointer',
            }}>
              <span>{t.icon}</span>
              <span style={{ fontSize: 10.5, fontWeight: isActive ? 700 : 500 }}>{t.label}</span>
            </button>
          );
        })}
        {/* Más button */}
        <button onClick={() => setMoreOpen(true)} style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
          color: moreOpen ? 'var(--primary-600)' : 'var(--text-muted)',
          background: 'transparent', border: 'none', cursor: 'pointer',
        }}>
          <Icons.Dots />
          <span style={{ fontSize: 10.5, fontWeight: moreOpen ? 700 : 500 }}>Más</span>
        </button>
      </div>
    </React.Fragment>
  );
}

// ─── Avatar with deterministic color from initials ─────────────────────
function Avatar({ initials, size = 40, color, photo }) {
  const hue = (initials.charCodeAt(0) * 17 + (initials[1]?.charCodeAt(0) ?? 0) * 31) % 360;
  const bg = color || `oklch(0.55 0.12 ${hue})`;
  return (
    <div style={{
      width: size, height: size, borderRadius: 999,
      background: photo ? `url(${photo}) center/cover` : bg,
      color: '#fff', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 700, fontSize: size * 0.38, letterSpacing: '.01em',
      overflow: 'hidden',
    }}>
      {!photo && initials}
    </div>
  );
}

// ─── Status badge — uses NEW token map (confirmed = teal) ──────────────
function StatusBadge({ status, size = 'sm' }) {
  const map = {
    pending:     { bg: 'var(--warning-50)', fg: 'var(--warning-700)', dot: 'var(--warning-600)', label: 'Pendiente' },
    confirmed:   { bg: 'var(--primary-50)', fg: 'var(--primary-700)', dot: 'var(--primary-600)', label: 'Confirmada' },
    in_progress: { bg: 'var(--purple-50)',  fg: 'var(--purple-600)',  dot: 'var(--purple-600)',  label: 'En curso' },
    completed:   { bg: 'var(--success-50)', fg: 'var(--success-700)', dot: 'var(--success-600)', label: 'Completada' },
    cancelled:   { bg: 'var(--danger-50)',  fg: 'var(--danger-700)',  dot: 'var(--danger-600)',  label: 'Cancelada' },
    no_show:     { bg: 'var(--gray-100)',   fg: 'var(--gray-600)',    dot: 'var(--gray-400)',    label: 'No-show' },
  };
  const s = map[status] || map.confirmed;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: size === 'md' ? '5px 12px' : '3px 9px',
      borderRadius: 999, background: s.bg, color: s.fg,
      fontWeight: 600, fontSize: size === 'md' ? 12.5 : 11.5,
      lineHeight: 1, whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: s.dot }} />
      {s.label}
    </span>
  );
}

// ─── Buttons ───────────────────────────────────────────────────────────
const btnBase = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  fontFamily: 'inherit', fontWeight: 600, cursor: 'pointer',
  border: '1px solid transparent', transition: 'all .15s', whiteSpace: 'nowrap',
};
function Button({ variant='primary', size='md', icon, children, style = {}, ...rest }) {
  const sizes = {
    sm: { fontSize: 12.5, padding: '6px 12px',  borderRadius: 8,  height: 32 },
    md: { fontSize: 14,   padding: '9px 16px',  borderRadius: 10, height: 40 },
    lg: { fontSize: 15,   padding: '12px 20px', borderRadius: 12, height: 48 },
  };
  const variants = {
    primary:   { background: 'var(--primary-600)', color: '#fff' },
    secondary: { background: 'var(--bg-surface)',  color: 'var(--text-secondary)', borderColor: 'var(--border)' },
    outline:   { background: 'transparent',         color: 'var(--primary-600)',    borderColor: 'var(--primary-600)' },
    ghost:     { background: 'transparent',         color: 'var(--text-secondary)' },
    danger:    { background: 'var(--danger-600)',   color: '#fff' },
  };
  return (
    <button style={{ ...btnBase, ...sizes[size], ...variants[variant], ...style }} {...rest}>
      {icon}{children}
    </button>
  );
}

// Section label
function SectionLabel({ children, right }) {
  return (
    <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom: 12 }}>
      <div style={{
        fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '.08em', color: 'var(--text-muted)',
      }}>{children}</div>
      {right}
    </div>
  );
}

// Card
function Card({ children, style = {}, padding = 20, highlight = false, elevated = false, ...rest }) {
  return (
    <div style={{
      background: highlight ? 'var(--primary-50)' : 'var(--bg-surface)',
      border: `1px solid ${highlight ? 'var(--primary-200)' : 'var(--border)'}`,
      borderRadius: 14,
      padding,
      boxShadow: elevated ? 'var(--shadow-sm)' : 'none',
      ...style,
    }} {...rest}>
      {children}
    </div>
  );
}

// KPI card
function KpiCard({ icon, label, value, sub, trend }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 16,
      padding: 18,
      background: 'var(--bg-surface)', border: '1px solid var(--border)',
      borderRadius: 14,
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 12,
        background: 'var(--primary-50)', color: 'var(--primary-600)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>{icon}</div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1, letterSpacing: '-.01em', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
        {sub && <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{sub}</div>}
        {trend && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3, marginTop: 4,
            fontSize: 11.5, fontWeight: 600,
            color: trend.startsWith('+') ? 'var(--success-700)' : 'var(--danger-700)',
          }}>
            <Icons.TrendUp /> {trend}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Mock data ─────────────────────────────────────────────────────────
const TODAY = {
  weekday: 'Jueves', date: '14 de mayo',
  appointments: 12, revenue: 3240, payments: 8,
  monthAppointments: 142, monthRevenue: 48200,
  noShowRate: 4.2,
};

const APPOINTMENTS_TODAY = [
  { id:'1', start:'09:00', end:'09:45', client:'María González',     services:'Manicure clásica',          price: 35,  status:'completed',   emp:{name:'Renata C.',  initials:'RC', color:'#9333ea'} },
  { id:'2', start:'10:00', end:'11:30', client:'Andrea Soto',         services:'Tinte + lavado',            price: 95,  status:'in_progress', emp:{name:'Renata C.',  initials:'RC', color:'#9333ea'} },
  { id:'3', start:'11:00', end:'12:30', client:'Fernando Ortiz',      services:'Tinte de cabello',          price: 75,  status:'confirmed',   emp:{name:'Renata C.',  initials:'RC', color:'#9333ea'} },
  { id:'4', start:'12:00', end:'12:45', client:'Lucía Martín',        services:'Pedicure',                  price: 28,  status:'confirmed',   emp:{name:'Julia P.',   initials:'JP', color:'#d97706'} },
  { id:'5', start:'13:00', end:'14:00', client:'Sofía Hernández',     services:'Corte + peinado',           price: 45,  status:'confirmed',   emp:{name:'Julia P.',   initials:'JP', color:'#d97706'} },
  { id:'6', start:'14:30', end:'15:30', client:'Camila Restrepo',     services:'Limpieza facial',           price: 55,  status:'pending',     emp:{name:'María L.',   initials:'ML', color:'#dc2626'} },
  { id:'7', start:'16:00', end:'17:00', client:'Ana Beltrán',         services:'Masaje relajante',          price: 65,  status:'pending',     emp:{name:'María L.',   initials:'ML', color:'#dc2626'} },
];

const EMPLOYEES = [
  { id:'r', initials:'RC', name:'Renata Castillo', role:'Estilista senior', color:'#9333ea', rating: 4.9, reviews: 128, services: ['Tinte','Corte','Peinado'], todayCount: 4, weekRevenue: 1850 },
  { id:'j', initials:'JP', name:'Julia Pérez',     role:'Manicurista',      color:'#d97706', rating: 4.8, reviews: 96,  services: ['Manicure','Pedicure','Acrílicas'], todayCount: 5, weekRevenue: 1240 },
  { id:'m', initials:'ML', name:'María López',     role:'Esteticista',      color:'#dc2626', rating: 4.7, reviews: 64,  services: ['Facial','Masaje','Depilación'], todayCount: 3, weekRevenue: 1620 },
  { id:'s', initials:'SF', name:'Sara Flores',     role:'Estilista jr.',    color:'#059669', rating: 4.6, reviews: 42,  services: ['Corte','Lavado'], todayCount: 2, weekRevenue: 720 },
];

const money = n => '$' + n.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

Object.assign(window, { Icons, Logo, Avatar, StatusBadge, Button, SectionLabel, Card, KpiCard, TODAY, APPOINTMENTS_TODAY, EMPLOYEES, money, MobileTopbar, MobileBottomNav });
