// screen-services.jsx — Servicios (admin), desktop + mobile

const SERVICES = [
  { id:'s1',  name:'Tinte de cabello',  duration: 90, price: 75, category:'Cabello',     color:'var(--purple-600)',  emp:['RC','SF'],       bookings30d: 38, active: true },
  { id:'s2',  name:'Corte + peinado',   duration: 60, price: 45, category:'Cabello',     color:'var(--purple-600)',  emp:['RC','SF'],       bookings30d: 26, active: true },
  { id:'s3',  name:'Lavado y secado',   duration: 30, price: 18, category:'Cabello',     color:'var(--purple-600)',  emp:['SF'],            bookings30d: 14, active: true },
  { id:'s4',  name:'Manicure clásica',  duration: 45, price: 28, category:'Uñas',        color:'var(--info-600)',    emp:['JP'],            bookings30d: 32, active: true },
  { id:'s5',  name:'Pedicure',          duration: 60, price: 35, category:'Uñas',        color:'var(--info-600)',    emp:['JP'],            bookings30d: 16, active: true },
  { id:'s6',  name:'Uñas acrílicas',    duration: 90, price: 65, category:'Uñas',        color:'var(--info-600)',    emp:['JP'],            bookings30d: 10, active: true },
  { id:'s7',  name:'Limpieza facial',   duration: 60, price: 55, category:'Facial',      color:'var(--success-600)', emp:['ML'],            bookings30d: 18, active: true },
  { id:'s8',  name:'Facial premium',    duration: 90, price: 95, category:'Facial',      color:'var(--success-600)', emp:['ML'],            bookings30d: 8,  active: true },
  { id:'s9',  name:'Masaje relajante',  duration: 60, price: 65, category:'Cuerpo',      color:'var(--warning-600)', emp:['ML'],            bookings30d: 12, active: true },
  { id:'s10', name:'Depilación cera',   duration: 45, price: 40, category:'Cuerpo',      color:'var(--warning-600)', emp:['ML'],            bookings30d: 6,  active: false },
];

const CATEGORIES = [
  { name: 'Cabello',  color: 'var(--purple-600)',  bg: 'var(--purple-50)',  count: 3, revenue: 4830 },
  { name: 'Uñas',     color: 'var(--info-600)',    bg: 'var(--info-50)',    count: 3, revenue: 2436 },
  { name: 'Facial',   color: 'var(--success-600)', bg: 'var(--success-50)', count: 2, revenue: 1750 },
  { name: 'Cuerpo',   color: 'var(--warning-600)', bg: 'var(--warning-50)', count: 2, revenue: 1020 },
];

const BUNDLES = [
  { id:'b1', name:'Paquete Novia', services: ['Maquillaje','Peinado','Manicure','Pedicure'], duration: 240, regularPrice: 280, price: 240, savings: 40, color: 'var(--primary-600)' },
  { id:'b2', name:'Día de spa',    services: ['Facial premium','Masaje','Manicure'],         duration: 195, regularPrice: 188, price: 160, savings: 28, color: 'var(--success-600)' },
  { id:'b3', name:'Cambio de look',services: ['Corte','Tinte','Peinado'],                    duration: 180, regularPrice: 160, price: 140, savings: 20, color: 'var(--purple-600)' },
];

// ─── Service card (grid item) ──────────────────────────────────────────
function ServiceCard({ s }) {
  return (
    <Card padding={0} style={{ overflow: 'hidden', opacity: s.active ? 1 : 0.6 }}>
      <div style={{ height: 6, background: s.color }}/>
      <div style={{ padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <span style={{
                padding: '2px 8px', borderRadius: 999,
                background: s.color.replace('600','50'), color: s.color.replace('600','700'),
                fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em',
              }}>{s.category}</span>
              {!s.active && <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>· Pausado</span>}
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-.005em', lineHeight: 1.25 }}>{s.name}</div>
          </div>
          <button style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icons.Dots />
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '3px 9px', borderRadius: 999,
            background: 'var(--bg-canvas)', color: 'var(--text-secondary)',
            fontSize: 11.5, fontWeight: 600, fontVariantNumeric: 'tabular-nums',
          }}>
            <Icons.Clock size={12} /> {s.duration} min
          </span>
          <div style={{ flex: 1 }}/>
          <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-.01em', fontVariantNumeric: 'tabular-nums' }}>{money(s.price)}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTop: '1px dashed var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ display: 'flex', marginRight: 2 }}>
              {s.emp.map((e, i) => {
                const emp = EMPLOYEES.find(x => x.initials === e);
                return (
                  <div key={i} style={{ marginLeft: i === 0 ? 0 : -8 }}>
                    <Avatar initials={e} size={22} color={emp?.color} />
                  </div>
                );
              })}
            </div>
            <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{s.emp.length} {s.emp.length === 1 ? 'empleado' : 'empleados'}</span>
          </div>
          <span style={{ fontSize: 11.5, color: 'var(--text-secondary)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
            {s.bookings30d}<span style={{ color: 'var(--text-muted)', fontWeight: 500 }}> · 30d</span>
          </span>
        </div>
      </div>
    </Card>
  );
}

// ─── Lista tab ─────────────────────────────────────────────────────────
function ServicesListTab() {
  const [filter, setFilter] = React.useState('Todos');
  const filtered = filter === 'Todos' ? SERVICES : SERVICES.filter(s => s.category === filter);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            position: 'relative', height: 40, width: 280,
            background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10,
            padding: '0 12px 0 36px', display: 'flex', alignItems: 'center',
          }}>
            <div style={{ position: 'absolute', left: 12, color: 'var(--text-muted)' }}><Icons.Search /></div>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Buscar servicio...</span>
          </div>
        </div>
        <Button size="md" icon={<Icons.Plus />}>Nuevo servicio</Button>
      </div>

      {/* Category chips */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {['Todos', ...CATEGORIES.map(c => c.name)].map(c => {
          const active = c === filter;
          const cat = CATEGORIES.find(x => x.name === c);
          return (
            <button key={c} onClick={() => setFilter(c)} style={{
              height: 32, padding: '0 14px', borderRadius: 999,
              background: active ? 'var(--primary-600)' : 'var(--bg-surface)',
              color: active ? '#fff' : 'var(--text-secondary)',
              border: '1px solid ' + (active ? 'var(--primary-600)' : 'var(--border)'),
              fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
              {cat && <span style={{ width: 6, height: 6, borderRadius: 999, background: active ? '#fff' : cat.color }}/>}
              {c}
              <span style={{
                fontSize: 11, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                background: active ? 'rgba(255,255,255,.2)' : 'var(--bg-canvas)',
                color: active ? '#fff' : 'var(--text-muted)',
                padding: '1px 6px', borderRadius: 999,
              }}>{c === 'Todos' ? SERVICES.length : cat.count}</span>
            </button>
          );
        })}
      </div>

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        <KpiCard icon={<Icons.Services />} label="Total servicios" value={SERVICES.length} sub={`${SERVICES.filter(s=>s.active).length} activos`} />
        <KpiCard icon={<Icons.TrendUp />}  label="Más reservado"   value="Tinte" sub="38 citas · 30 días" />
        <KpiCard icon={<Icons.Clock />}    label="Duración prom."   value={`${Math.round(SERVICES.reduce((s,x)=>s+x.duration,0)/SERVICES.length)} min`} />
        <KpiCard icon={<Icons.Cash />}     label="Ticket promedio"  value={money(Math.round(SERVICES.reduce((s,x)=>s+x.price,0)/SERVICES.length))} />
      </div>

      {/* Service grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        {filtered.map(s => <ServiceCard key={s.id} s={s} />)}
      </div>
    </div>
  );
}

// ─── Categorías tab ────────────────────────────────────────────────────
function ServicesCategoriesTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <SectionLabel>Categorías del catálogo</SectionLabel>
        <Button size="md" icon={<Icons.Plus />}>Nueva categoría</Button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
        {CATEGORIES.map(c => {
          const services = SERVICES.filter(s => s.category === c.name);
          return (
            <Card key={c.name} padding={20}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 12,
                    background: c.bg, color: c.color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18, fontWeight: 800,
                  }}>
                    {c.name[0]}
                  </div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{c.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.count} servicios</div>
                  </div>
                </div>
                <button style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: 'var(--bg-canvas)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icons.Dots />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                {services.map(s => (
                  <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px dashed var(--border)' }}>
                    <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{s.name}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 11.5, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{s.duration}m</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', minWidth: 50, textAlign: 'right' }}>{money(s.price)}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 8 }}>
                <span style={{ fontSize: 11.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 700 }}>Ingresos · 30d</span>
                <span style={{ fontSize: 20, fontWeight: 800, color: c.color, letterSpacing: '-.01em', fontVariantNumeric: 'tabular-nums' }}>{money(c.revenue)}</span>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ─── Paquetes tab ──────────────────────────────────────────────────────
function ServicesBundlesTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <SectionLabel>Paquetes y combos</SectionLabel>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: -8 }}>Combina servicios con descuento para vender más por cita.</div>
        </div>
        <Button size="md" icon={<Icons.Plus />}>Nuevo paquete</Button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        {BUNDLES.map(b => (
          <Card key={b.id} padding={0} style={{ overflow: 'hidden' }}>
            <div style={{ background: b.color, color: '#fff', padding: '16px 18px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', opacity: .85 }}>Paquete</div>
              <div style={{ fontSize: 18, fontWeight: 800, marginTop: 2, letterSpacing: '-.01em' }}>{b.name}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 8 }}>
                <span style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-.01em', fontVariantNumeric: 'tabular-nums' }}>{money(b.price)}</span>
                <span style={{ fontSize: 12, opacity: .75, textDecoration: 'line-through', fontVariantNumeric: 'tabular-nums' }}>{money(b.regularPrice)}</span>
                <span style={{
                  fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                  background: 'rgba(255,255,255,.18)', color: '#fff',
                }}>AHORRA {money(b.savings)}</span>
              </div>
            </div>
            <div style={{ padding: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-muted)', marginBottom: 8 }}>Incluye</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                {b.services.map(s => (
                  <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Icons.Check style={{ color: 'var(--success-600)' }} />
                    <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{s}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTop: '1px dashed var(--border)' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-muted)' }}>
                  <Icons.Clock size={13} /> <span style={{ fontVariantNumeric: 'tabular-nums' }}>{Math.floor(b.duration/60)}h {b.duration%60}m</span>
                </span>
                <Button size="sm" variant="secondary">Editar</Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Desktop wrapper ───────────────────────────────────────────────────
function ServicesDesktop() {
  const [tab, setTab] = React.useState('lista');
  const tabs = [
    { key: 'lista',       label: 'Lista',       icon: <Icons.Services size={16} />, badge: SERVICES.length },
    { key: 'categorias',  label: 'Categorías',  icon: <Icons.Filter size={16} />,   badge: CATEGORIES.length },
    { key: 'paquetes',    label: 'Paquetes',    icon: <Icons.Bookmark size={16} />, badge: BUNDLES.length },
  ];

  return (
    <AppShell currentNav="Servicios" title="Servicios">
      <div style={{ marginBottom: 18 }}>
        <TabNav tabs={tabs} value={tab} onChange={setTab} />
      </div>
      {tab === 'lista' && <ServicesListTab />}
      {tab === 'categorias' && <ServicesCategoriesTab />}
      {tab === 'paquetes' && <ServicesBundlesTab />}
    </AppShell>
  );
}

// ─── Mobile view ───────────────────────────────────────────────────────
function ServicesMobile() {
  const [filter, setFilter] = React.useState('Todos');
  const filtered = filter === 'Todos' ? SERVICES : SERVICES.filter(s => s.category === filter);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-canvas)' }}>
      <MobileTopbar title="Servicios" eyebrow={`${SERVICES.length} en el catálogo`} onSearch onFilter />

      {/* Category scroll chips */}
      <div style={{ padding: '12px 16px 14px', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
        <div style={{ display: 'flex', gap: 6, whiteSpace: 'nowrap' }}>
          {['Todos', ...CATEGORIES.map(c => c.name)].map(c => {
            const active = c === filter;
            const cat = CATEGORIES.find(x => x.name === c);
            return (
              <button key={c} onClick={() => setFilter(c)} style={{
                height: 32, padding: '0 12px', borderRadius: 999,
                background: active ? 'var(--primary-600)' : 'var(--bg-canvas)',
                color: active ? '#fff' : 'var(--text-secondary)',
                border: '1px solid ' + (active ? 'var(--primary-600)' : 'var(--border)'),
                fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0,
              }}>
                {cat && <span style={{ width: 6, height: 6, borderRadius: 999, background: active ? '#fff' : cat.color }}/>}
                {c}
              </button>
            );
          })}
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflow: 'auto', padding: '14px 16px 80px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text-muted)', marginBottom: 10 }}>
          {filtered.length} servicio{filtered.length !== 1 ? 's' : ''}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(s => (
            <Card key={s.id} padding={0} style={{ overflow: 'hidden', opacity: s.active ? 1 : 0.6 }}>
              <div style={{ display: 'flex', alignItems: 'stretch', minHeight: 76 }}>
                <div style={{ width: 6, background: s.color, flexShrink: 0 }}/>
                <div style={{ flex: 1, padding: 14, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text-primary)' }}>{s.name}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                        <span style={{
                          padding: '1px 7px', borderRadius: 999,
                          background: s.color.replace('600','50'), color: s.color.replace('600','700'),
                          fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em',
                        }}>{s.category}</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                          <Icons.Clock size={11} /> {s.duration}m
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>· {s.bookings30d} citas</span>
                      </div>
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-.01em', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{money(s.price)}</div>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* FAB */}
      <button style={{
        position: 'absolute', right: 16, bottom: 80,
        width: 52, height: 52, borderRadius: 999,
        background: 'var(--primary-600)', color: '#fff',
        border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 8px 22px -4px rgba(0,128,128,.5)',
        zIndex: 2,
      }}>
        <Icons.Plus size={22} />
      </button>

      <MobileBottomNav active="home" />
    </div>
  );
}

Object.assign(window, { ServicesDesktop, ServicesMobile });
