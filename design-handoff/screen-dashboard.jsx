// screen-dashboard.jsx — Admin home/dashboard, mobile + desktop

function AppShell({ children, currentNav = 'Inicio', title }) {
  const navItems = [
    { label: 'Inicio',         icon: <Icons.Home /> },
    { label: 'Punto de Venta', icon: <Icons.POS /> },
    { label: 'Reportes',       icon: <Icons.Reports /> },
    { label: 'Citas',          icon: <Icons.Calendar /> },
    { label: 'Clientes',       icon: <Icons.Clients /> },
    { label: 'Servicios',      icon: <Icons.Services /> },
    { label: 'Personal',       icon: <Icons.Staff /> },
    { label: 'Inventario',     icon: <Icons.Inventory /> },
    { label: 'Tienda',         icon: <Icons.Shop /> },
    { label: 'Notificaciones', icon: <Icons.Bell /> },
    { label: 'Configuración',  icon: <Icons.Cog /> },
  ];

  return (
    <div style={{ display: 'flex', height: '100%', background: 'var(--bg-canvas)' }}>
      {/* Sidebar (desktop) */}
      <aside style={{
        width: 232, background: 'var(--bg-surface)', borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', flexShrink: 0,
      }}>
        <div style={{ height: 64, display: 'flex', alignItems: 'center', padding: '0 20px', borderBottom: '1px solid var(--border)' }}>
          <Logo size={22} />
        </div>
        <nav style={{ flex: 1, padding: '14px 10px', overflow: 'auto' }}>
          {navItems.map(it => {
            const active = it.label === currentNav;
            return (
              <div key={it.label} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '8px 12px', borderRadius: 10,
                fontSize: 13.5, fontWeight: active ? 600 : 500,
                color: active ? 'var(--primary-700)' : 'var(--text-secondary)',
                background: active ? 'var(--primary-50)' : 'transparent',
                marginBottom: 2, cursor: 'pointer',
              }}>
                <span style={{ width: 20, height: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: active ? 'var(--primary-600)' : 'var(--text-muted)' }}>{it.icon}</span>
                {it.label}
              </div>
            );
          })}
        </nav>
        <div style={{ padding: 14, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar initials="SO" size={36} color="var(--primary-600)" />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Sergio O.</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Administrador</div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Topbar */}
        <div style={{
          height: 60, padding: '0 28px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)',
        }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text-muted)' }}>
              {TODAY.weekday}, {TODAY.date}
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginTop: 1, letterSpacing: '-.01em' }}>
              {title}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              position: 'relative', height: 36, width: 220,
              background: 'var(--bg-canvas)', border: '1px solid var(--border)', borderRadius: 10,
              padding: '0 10px 0 32px', display: 'flex', alignItems: 'center',
            }}>
              <div style={{ position: 'absolute', left: 10, color: 'var(--text-muted)' }}><Icons.Search /></div>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Buscar cliente o cita...</span>
            </div>
            <button style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--bg-canvas)', border: '1px solid var(--border)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative' }}>
              <Icons.Bell />
              <span style={{ position: 'absolute', top: 6, right: 7, width: 8, height: 8, borderRadius: 999, background: 'var(--danger-600)', border: '2px solid var(--bg-surface)' }}/>
            </button>
            <Button size="md" icon={<Icons.Plus />}>Nueva cita</Button>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: 28 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// Last 7 days mini chart
function MiniChart() {
  const data = [180, 320, 290, 410, 280, 360, 240];
  const max = Math.max(...data);
  const w = 280, h = 110, pad = 6;
  const step = (w - pad*2) / (data.length - 1);
  const points = data.map((v, i) => [pad + i * step, h - pad - (v/max) * (h - pad*2)]);
  const path = points.map((p, i) => (i===0?'M':'L') + p[0] + ' ' + p[1]).join(' ');
  const area = path + ` L ${w-pad} ${h-pad} L ${pad} ${h-pad} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: h }}>
      <defs>
        <linearGradient id="chart-grad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#008080" stopOpacity=".25" />
          <stop offset="100%" stopColor="#008080" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#chart-grad)" />
      <path d={path} fill="none" stroke="#008080" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p,i) => <circle key={i} cx={p[0]} cy={p[1]} r="3" fill="#fff" stroke="#008080" strokeWidth="2" />)}
    </svg>
  );
}

// ─── DESKTOP DASHBOARD ─────────────────────────────────────────────────
function DashboardDesktop() {
  return (
    <AppShell title="Inicio">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1100 }}>

        {/* KPI row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          <KpiCard icon={<Icons.Calendar />} label="Citas hoy"   value={TODAY.appointments}                   trend="+2 vs ayer" />
          <KpiCard icon={<Icons.Cash />}     label="Ingresos hoy" value={money(TODAY.revenue)}                  trend="+18%" />
          <KpiCard icon={<Icons.POS />}      label="Pagos hoy"   value={TODAY.payments}                       sub="2 pendientes" />
          <KpiCard icon={<Icons.TrendUp />}  label="Mes"          value={TODAY.monthAppointments}              sub={`${money(TODAY.monthRevenue)} ingresos`} />
        </div>

        {/* Highlight: alerts */}
        <Card highlight padding={16}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--primary-600)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icons.Bell />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--primary-700)' }}>2 citas pendientes de confirmar</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>Camila R. a las 14:30 · Ana B. a las 16:00 — envía recordatorio para asegurar la visita.</div>
            </div>
            <Button size="sm" variant="primary">Enviar recordatorio</Button>
          </div>
        </Card>

        {/* 2-col: chart + upcoming */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 14 }}>
          <Card padding={20}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <SectionLabel>Últimos 7 días</SectionLabel>
                <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-.01em', fontVariantNumeric: 'tabular-nums' }}>{money(2080)}</div>
                <div style={{ fontSize: 12, color: 'var(--success-700)', fontWeight: 600, marginTop: 2 }}>↑ 12% vs semana anterior</div>
              </div>
              <div style={{ display: 'flex', gap: 4, background: 'var(--bg-canvas)', padding: 3, borderRadius: 8, border: '1px solid var(--border)' }}>
                {['7d','30d','3m'].map((p,i) => (
                  <div key={p} style={{
                    padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                    background: i===0?'var(--bg-surface)':'transparent',
                    color: i===0?'var(--text-primary)':'var(--text-muted)',
                    boxShadow: i===0?'var(--shadow-sm)':'none',
                  }}>{p}</div>
                ))}
              </div>
            </div>
            <MiniChart />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: 'var(--text-muted)' }}>
              {['Vie','Sáb','Dom','Lun','Mar','Mié','Jue'].map(d => <span key={d}>{d}</span>)}
            </div>
          </Card>

          <Card padding={20}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <SectionLabel>Próximas citas</SectionLabel>
              <a style={{ fontSize: 12, fontWeight: 600, color: 'var(--primary-600)', cursor: 'pointer' }}>Ver todas →</a>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {APPOINTMENTS_TODAY.filter(a => ['confirmed','pending','in_progress'].includes(a.status)).slice(0,4).map(a => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'var(--bg-canvas)', borderRadius: 10 }}>
                  <div style={{ textAlign: 'center', minWidth: 48 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary-600)', fontVariantNumeric: 'tabular-nums' }}>{a.start}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{a.end}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.client}</span>
                      <StatusBadge status={a.status} />
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.services}</div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{money(a.price)}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* 2-col: quick actions + employees today */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Card padding={20}>
            <SectionLabel>Acciones rápidas</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {[
                { icon: <Icons.Plus />,      label: 'Nueva cita' },
                { icon: <Icons.Clients />,   label: 'Nuevo cliente' },
                { icon: <Icons.POS />,       label: 'Cobrar' },
                { icon: <Icons.Services />,  label: 'Nuevo servicio' },
                { icon: <Icons.Staff />,     label: 'Nuevo empleado' },
                { icon: <Icons.Reports />,   label: 'Cierre del día' },
              ].map(a => (
                <button key={a.label} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                  padding: '14px 8px', background: 'var(--bg-canvas)', border: '1px solid var(--border)',
                  borderRadius: 12, cursor: 'pointer', color: 'var(--text-primary)',
                }}>
                  <span style={{ color: 'var(--primary-600)' }}>{a.icon}</span>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{a.label}</span>
                </button>
              ))}
            </div>
          </Card>

          <Card padding={20}>
            <SectionLabel right={<a style={{ fontSize: 12, fontWeight: 600, color: 'var(--primary-600)', cursor: 'pointer' }}>Ver personal →</a>}>Personal en agenda</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {EMPLOYEES.map(e => (
                <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 0' }}>
                  <Avatar initials={e.initials} size={36} color={e.color} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>{e.name}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{e.role}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{e.todayCount} citas</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>hoy</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

// ─── MOBILE DASHBOARD (empleado view) ──────────────────────────────────
function DashboardMobile() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-canvas)' }}>
      {/* Header */}
      <div style={{
        background: 'var(--primary-600)', color: '#fff', padding: '18px 18px 64px',
        position: 'relative',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 600, opacity: .9, letterSpacing: '.08em', textTransform: 'uppercase' }}>{TODAY.weekday}, {TODAY.date}</div>
            <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4, letterSpacing: '-.01em' }}>Hola, Renata</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(255,255,255,.18)', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              <Icons.Bell />
              <span style={{ position: 'absolute', top: 7, right: 8, width: 8, height: 8, borderRadius: 999, background: '#fef08a' }}/>
            </button>
          </div>
        </div>
        <div style={{ fontSize: 13.5, opacity: .92, marginTop: 14 }}>
          Tienes <b style={{ fontWeight: 700 }}>4 citas hoy</b> · próxima en 35 min
        </div>
      </div>

      {/* Pulled-up KPI cards */}
      <div style={{ padding: '0 16px', marginTop: -48, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Card padding={14} elevated>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--primary-50)', color: 'var(--primary-600)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icons.Calendar />
            </div>
            <div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 500 }}>Citas hoy</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1, letterSpacing: '-.01em' }}>4</div>
            </div>
          </div>
        </Card>
        <Card padding={14} elevated>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--success-50)', color: 'var(--success-700)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icons.Cash />
            </div>
            <div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 500 }}>Ingresos</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1, letterSpacing: '-.01em', fontVariantNumeric: 'tabular-nums' }}>$280</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '20px 16px 80px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <section>
          <SectionLabel right={<a style={{ fontSize: 12, fontWeight: 600, color: 'var(--primary-600)' }}>Ver todas</a>}>Hoy</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {APPOINTMENTS_TODAY.filter(a => a.emp.initials === 'RC').slice(0,3).map(a => (
              <Card key={a.id} padding={14}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{
                    width: 44, textAlign: 'center', flexShrink: 0, paddingTop: 2,
                  }}>
                    <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--primary-600)', letterSpacing: '-.01em', fontVariantNumeric: 'tabular-nums' }}>{a.start}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{a.end}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text-primary)' }}>{a.client}</span>
                      <StatusBadge status={a.status} />
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>{a.services}</div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{money(a.price)}</div>
                </div>
              </Card>
            ))}
          </div>
        </section>

        <Card highlight padding={16}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--primary-600)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icons.TrendUp size={18} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--primary-700)' }}>Tu mejor semana del mes</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                Llevas <b>{money(1850)}</b> en ingresos — 22% más que la semana anterior.
              </div>
            </div>
          </div>
        </Card>

        <section>
          <SectionLabel>Acciones rápidas</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {[
              { icon: <Icons.Plus />, label: 'Nueva cita' },
              { icon: <Icons.Camera />, label: 'Subir foto' },
              { icon: <Icons.Clients />, label: 'Cliente' },
            ].map(a => (
              <button key={a.label} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                padding: '14px 8px', background: 'var(--bg-surface)', border: '1px solid var(--border)',
                borderRadius: 12, cursor: 'pointer', color: 'var(--text-primary)',
              }}>
                <span style={{ color: 'var(--primary-600)' }}>{a.icon}</span>
                <span style={{ fontSize: 12, fontWeight: 600 }}>{a.label}</span>
              </button>
            ))}
          </div>
        </section>
      </div>

      {/* Bottom nav */}
      <MobileBottomNav active="home" />
    </div>
  );
}

Object.assign(window, { DashboardDesktop, DashboardMobile, AppShell });
