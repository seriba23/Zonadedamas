// screen-reports.jsx — Reportes, mobile + desktop

function BarChart({ data, color = 'var(--primary-600)', height = 180 }) {
  const max = Math.max(...data.map(d => d.value));
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height, gap: 4 }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end' }}>
            <div style={{ width: '100%', height: `${(d.value/max)*100}%`, background: d.highlight ? color : 'var(--primary-200)', borderRadius: '6px 6px 0 0', transition: 'all .2s', minHeight: 4 }}/>
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 600 }}>{d.label}</div>
        </div>
      ))}
    </div>
  );
}

function DonutChart({ slices, size = 140 }) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  const r = size / 2 - 12;
  let cumulative = 0;
  const segments = slices.map(s => {
    const dash = (s.value / total) * 2 * Math.PI * r;
    const seg = { dash, offset: -cumulative, color: s.color, label: s.label, value: s.value };
    cumulative += dash;
    return seg;
  });
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--bg-canvas)" strokeWidth="14"/>
      {segments.map((s, i) => (
        <circle
          key={i}
          cx={size/2} cy={size/2} r={r}
          fill="none" stroke={s.color} strokeWidth="14"
          strokeDasharray={`${s.dash} ${2*Math.PI*r}`}
          strokeDashoffset={s.offset}
          transform={`rotate(-90 ${size/2} ${size/2})`}
        />
      ))}
      <text x={size/2} y={size/2 - 2} textAnchor="middle" style={{ fontSize: 22, fontWeight: 800, fill: 'var(--text-primary)', fontFamily: 'inherit', letterSpacing: '-.01em' }}>{total}</text>
      <text x={size/2} y={size/2 + 16} textAnchor="middle" style={{ fontSize: 10, fill: 'var(--text-muted)', fontFamily: 'inherit', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>Total</text>
    </svg>
  );
}

function ReportsDesktop() {
  const last30 = [
    {label:'1', value:280},{label:'',  value:340},{label:'',  value:240},{label:'',  value:380},
    {label:'5', value:290},{label:'',  value:420},{label:'',  value:310},{label:'',  value:350},
    {label:'9', value:280},{label:'',  value:450},{label:'',  value:380},{label:'',  value:330},
    {label:'13',value:410, highlight: true},{label:'',  value:390},{label:'',  value:430},{label:'',  value:520},
    {label:'17',value:480},{label:'',  value:430},{label:'',  value:380},{label:'',  value:360},
    {label:'21',value:410},{label:'',  value:520},{label:'',  value:480},{label:'',  value:550},
    {label:'25',value:520},{label:'',  value:490},{label:'',  value:580},{label:'',  value:610, highlight: true},
    {label:'29',value:540},{label:'30',value:520},
  ];

  const statusBreakdown = [
    { label: 'Completadas', value: 98, color: '#059669' },
    { label: 'Confirmadas', value: 28, color: '#008080' },
    { label: 'Pendientes',  value: 8,  color: '#d97706' },
    { label: 'Canceladas',  value: 6,  color: '#dc2626' },
    { label: 'No-show',     value: 2,  color: '#94a3b8' },
  ];

  return (
    <AppShell currentNav="Reportes" title="Reportes">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', gap: 0, background: 'var(--bg-canvas)', padding: 3, borderRadius: 10, border: '1px solid var(--border)' }}>
            {['Hoy','Semana','Mes','Año','Personalizado'].map((p, i) => (
              <div key={p} style={{
                padding: '6px 16px', borderRadius: 7, fontSize: 13, fontWeight: 600,
                background: i===2?'var(--bg-surface)':'transparent',
                color: i===2?'var(--text-primary)':'var(--text-muted)',
                boxShadow: i===2?'var(--shadow-sm)':'none', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}>
                {p}
                {p === 'Personalizado' && <Icons.Calendar size={14} />}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="secondary" size="md" icon={<Icons.Filter />}>Filtros</Button>
            <Button variant="secondary" size="md" icon={<Icons.Arrow />}>Exportar</Button>
          </div>
        </div>

        {/* KPI Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          <KpiCard icon={<Icons.Cash />}     label="Ingresos del mes" value={money(48200)} trend="+18% vs mes pasado" />
          <KpiCard icon={<Icons.Calendar />} label="Citas"            value="142"          sub="98 completadas · 6 canceladas" />
          <KpiCard icon={<Icons.Clients />}  label="Clientes activos" value="84"           trend="+12 nuevos" />
          <KpiCard icon={<Icons.TrendUp />}  label="Ticket promedio"  value={money(340)}   sub="vs $312 mes anterior" />
        </div>

        {/* Charts row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 14 }}>
          <Card padding={20}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
              <div>
                <SectionLabel>Ingresos · últimos 30 días</SectionLabel>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-.015em', fontVariantNumeric: 'tabular-nums' }}>{money(48200)}</div>
                <div style={{ fontSize: 12.5, color: 'var(--success-700)', fontWeight: 600, marginTop: 2, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Icons.TrendUp /> +18% vs período anterior
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 600 }}>Mejor día</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--primary-600)', fontVariantNumeric: 'tabular-nums' }}>{money(610)}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>28 de mayo</div>
              </div>
            </div>
            <div style={{ marginTop: 20 }}>
              <BarChart data={last30} height={200} />
            </div>
          </Card>

          <Card padding={20}>
            <SectionLabel>Citas por estado</SectionLabel>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 8 }}>
              <DonutChart slices={statusBreakdown} size={140} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {statusBreakdown.map(s => (
                  <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color }}/>
                    <span style={{ fontSize: 12.5, color: 'var(--text-secondary)', flex: 1 }}>{s.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* Tables row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Card padding={20}>
            <SectionLabel right={<a style={{ fontSize: 12, fontWeight: 600, color: 'var(--primary-600)' }}>Ver todo →</a>}>Top servicios</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { name: 'Tinte de cabello',    count: 38, revenue: 2850, color: 'var(--primary-600)' },
                { name: 'Manicure clásica',    count: 32, revenue: 1120, color: 'var(--purple-600)' },
                { name: 'Corte + peinado',     count: 26, revenue: 1170, color: 'var(--warning-600)' },
                { name: 'Limpieza facial',     count: 18, revenue: 990,  color: 'var(--success-600)' },
                { name: 'Pedicure',            count: 16, revenue: 448,  color: 'var(--info-600)' },
              ].map((s, i) => (
                <div key={s.name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, alignItems: 'baseline' }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>{s.name}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{money(s.revenue)}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, height: 6, background: 'var(--bg-canvas)', borderRadius: 999 }}>
                      <div style={{ width: `${(s.count/38)*100}%`, height: '100%', background: s.color, borderRadius: 999 }}/>
                    </div>
                    <span style={{ fontSize: 11.5, color: 'var(--text-muted)', minWidth: 40, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{s.count} citas</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card padding={20}>
            <SectionLabel right={<a style={{ fontSize: 12, fontWeight: 600, color: 'var(--primary-600)' }}>Ver personal →</a>}>Ranking de personal</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {EMPLOYEES.map((e, i) => (
                <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: i===0?'none':'1px dashed var(--border)' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', width: 18, fontVariantNumeric: 'tabular-nums' }}>#{i+1}</span>
                  <Avatar initials={e.initials} size={32} color={e.color} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>{e.name}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{e.role}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{money(e.weekRevenue)}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>esta semana</div>
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

function ReportsMobile() {
  const last7 = [
    { label: 'Vie', value: 280 },
    { label: 'Sáb', value: 410, highlight: true },
    { label: 'Dom', value: 0 },
    { label: 'Lun', value: 320 },
    { label: 'Mar', value: 380 },
    { label: 'Mié', value: 290 },
    { label: 'Jue', value: 240 },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-canvas)' }}>
      {/* Header */}
      <div style={{ padding: '14px 16px 12px', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button style={{ width: 36, height: 36, borderRadius: 10, background: 'transparent', border: 'none', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icons.Bars />
        </button>
        <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Reportes</span>
        <button style={{ width: 36, height: 36, borderRadius: 10, background: 'transparent', border: 'none', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icons.Arrow />
        </button>
      </div>

      {/* Period selector */}
      <div style={{ padding: '14px 16px 0' }}>
        <div style={{ display: 'flex', gap: 0, background: 'var(--bg-surface)', padding: 3, borderRadius: 10, border: '1px solid var(--border)' }}>
          {['Hoy','Semana','Mes','Año'].map((p, i) => (
            <div key={p} style={{
              flex: 1, padding: '7px 0', borderRadius: 7, fontSize: 12.5, fontWeight: 600, textAlign: 'center',
              background: i===1?'var(--primary-600)':'transparent',
              color: i===1?'#fff':'var(--text-muted)',
              cursor: 'pointer',
            }}>{p}</div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px 16px 80px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Hero KPI */}
        <Card padding={20}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text-muted)' }}>Ingresos esta semana</div>
          <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-.02em', fontVariantNumeric: 'tabular-nums', marginTop: 4 }}>{money(1920)}</div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4, fontSize: 12.5, fontWeight: 600, color: 'var(--success-700)' }}>
            <Icons.TrendUp /> +12% vs semana anterior
          </div>
          <div style={{ marginTop: 18 }}>
            <BarChart data={last7} height={120} />
          </div>
        </Card>

        {/* Mini KPI cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Card padding={14}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-muted)' }}>Citas</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-.01em', fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>34</div>
            <div style={{ fontSize: 11.5, color: 'var(--success-700)', fontWeight: 600, marginTop: 2 }}>+6 vs semana ant.</div>
          </Card>
          <Card padding={14}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-muted)' }}>Ticket promedio</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-.01em', fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{money(56)}</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 500, marginTop: 2 }}>vs $52 semana ant.</div>
          </Card>
        </div>

        {/* Status breakdown */}
        <Card padding={18}>
          <SectionLabel>Citas por estado</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'Completadas', value: 22, total: 34, color: 'var(--success-600)' },
              { label: 'Confirmadas', value: 8,  total: 34, color: 'var(--primary-600)' },
              { label: 'Canceladas',  value: 3,  total: 34, color: 'var(--danger-600)' },
              { label: 'No-show',     value: 1,  total: 34, color: 'var(--gray-400)' },
            ].map(s => (
              <div key={s.label}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{s.label}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{s.value} <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>/ {s.total}</span></span>
                </div>
                <div style={{ height: 6, background: 'var(--bg-canvas)', borderRadius: 999 }}>
                  <div style={{ width: `${(s.value/s.total)*100}%`, height: '100%', background: s.color, borderRadius: 999 }}/>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Top staff */}
        <Card padding={18}>
          <SectionLabel right={<a style={{ fontSize: 12, fontWeight: 600, color: 'var(--primary-600)' }}>Ver todo →</a>}>Top personal</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {EMPLOYEES.slice(0, 3).map((e, i) => (
              <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderTop: i===0?'none':'1px dashed var(--border)' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: i===0?'var(--warning-600)':'var(--text-muted)', width: 16, fontVariantNumeric: 'tabular-nums' }}>#{i+1}</span>
                <Avatar initials={e.initials} size={32} color={e.color} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{e.name}</div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{money(e.weekRevenue)}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <MobileBottomNav active="reports" />
    </div>
  );
}

Object.assign(window, { ReportsDesktop, ReportsMobile });
