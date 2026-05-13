// screen-calendar.jsx — Calendario de citas, mobile + desktop + week + registro

// ─── Day-of-week column header label ───────────────────────────────────
function DayColHeader({ short, num, isToday }) {
  return (
    <div style={{
      padding: '10px 12px',
      borderLeft: '1px solid var(--border)',
      textAlign: 'center',
      background: isToday ? 'var(--primary-50)' : 'transparent',
    }}>
      <div style={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em', color: isToday ? 'var(--primary-700)' : 'var(--text-muted)' }}>{short}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: isToday ? 'var(--primary-700)' : 'var(--text-primary)', letterSpacing: '-.01em', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1, marginTop: 2 }}>{num}</div>
    </div>
  );
}

// ─── Calendar toolbar (shared by Day + Week + Registro) ────────────────
function CalendarToolbar({ view = 'day', subtitle, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Button variant="secondary" size="md">Hoy</Button>
        <div style={{ display: 'flex' }}>
          <button style={{ width: 36, height: 36, borderRadius: '10px 0 0 10px', background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Icons.Chevron style={{ transform: 'rotate(180deg)' }} /></button>
          <button style={{ width: 36, height: 36, borderRadius: '0 10px 10px 0', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderLeft: 'none', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Icons.Chevron /></button>
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-.01em' }}>
            {view === 'week' ? 'Semana del 11 al 17 de mayo' : view === 'registro' ? 'Registro de citas' : 'Jueves 14 de mayo'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{subtitle}</div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ display: 'flex', gap: 0, background: 'var(--bg-canvas)', padding: 3, borderRadius: 10, border: '1px solid var(--border)' }}>
          {[{k:'day',l:'Día'},{k:'week',l:'Semana'},{k:'month',l:'Mes'},{k:'registro',l:'Registro'}].map(p => (
            <div key={p.k} onClick={() => onChange?.(p.k)} style={{
              padding: '5px 14px', borderRadius: 7, fontSize: 13, fontWeight: 600,
              background: view===p.k?'var(--bg-surface)':'transparent',
              color: view===p.k?'var(--text-primary)':'var(--text-muted)',
              boxShadow: view===p.k?'var(--shadow-sm)':'none', cursor: 'pointer',
            }}>{p.l}</div>
          ))}
        </div>
        <Button variant="secondary" size="md" icon={<Icons.Filter />}>Filtros</Button>
        <Button size="md" icon={<Icons.Plus />}>Nueva cita</Button>
      </div>
    </div>
  );
}

// ─── DAY VIEW (by employee column) ─────────────────────────────────────
function DayView() {
  const hours = ['9:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00'];
  const employees = EMPLOYEES;

  const slotFor = (startStr, endStr) => {
    const [sh, sm] = startStr.split(':').map(Number);
    const [eh, em] = endStr.split(':').map(Number);
    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;
    return { top: ((startMin - 9*60) / 60) * 60, h: ((endMin - startMin) / 60) * 60 };
  };

  return (
    <Card padding={0} style={{ overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: `60px repeat(${employees.length}, 1fr)`, borderBottom: '1px solid var(--border)', background: 'var(--bg-canvas)' }}>
        <div style={{ padding: '10px 8px', fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text-muted)' }}>Jueves 14</div>
        {employees.map(e => (
          <div key={e.id} style={{ padding: '10px 12px', borderLeft: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Avatar initials={e.initials} size={28} color={e.color} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.name.split(' ')[0]}</div>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{e.todayCount} citas</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: `60px repeat(${employees.length}, 1fr)`, position: 'relative' }}>
        <div>
          {hours.map(h => (
            <div key={h} style={{ height: 60, borderTop: '1px solid var(--border)', padding: '4px 8px', fontSize: 10.5, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{h}</div>
          ))}
        </div>

        {employees.map(e => {
          const appts = APPOINTMENTS_TODAY.filter(a => a.emp.initials === e.initials);
          return (
            <div key={e.id} style={{ borderLeft: '1px solid var(--border)', position: 'relative' }}>
              {hours.map((_, i) => (
                <div key={i} style={{ height: 60, borderTop: '1px solid var(--border)' }}></div>
              ))}
              {appts.map(a => {
                const { top, h } = slotFor(a.start, a.end);
                const colorMap = {
                  confirmed:   { bg: 'var(--primary-50)',  bar: 'var(--primary-600)', fg: 'var(--primary-700)' },
                  pending:     { bg: 'var(--warning-50)',  bar: 'var(--warning-600)', fg: 'var(--warning-700)' },
                  in_progress: { bg: 'var(--purple-50)',   bar: 'var(--purple-600)',  fg: 'var(--purple-600)' },
                  completed:   { bg: 'var(--success-50)',  bar: 'var(--success-600)', fg: 'var(--success-700)' },
                  cancelled:   { bg: 'var(--danger-50)',   bar: 'var(--danger-600)',  fg: 'var(--danger-700)' },
                };
                const c = colorMap[a.status] || colorMap.confirmed;
                return (
                  <div key={a.id} style={{
                    position: 'absolute', top, left: 6, right: 6, height: h - 4,
                    background: c.bg, borderLeft: `3px solid ${c.bar}`,
                    borderRadius: 8, padding: '6px 8px', overflow: 'hidden', cursor: 'pointer',
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: c.fg, fontVariantNumeric: 'tabular-nums' }}>{a.start} · {a.client}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-secondary)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.services}</div>
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* Now indicator */}
        <div style={{ position: 'absolute', left: 60, right: 0, top: (2*60 + 35), height: 2, background: 'var(--danger-600)', zIndex: 1 }}>
          <div style={{ position: 'absolute', left: -34, top: -8, fontSize: 10.5, fontWeight: 700, color: 'var(--danger-600)', fontVariantNumeric: 'tabular-nums' }}>11:35</div>
          <div style={{ position: 'absolute', left: -3, top: -4, width: 8, height: 8, borderRadius: 999, background: 'var(--danger-600)' }}/>
        </div>
      </div>
    </Card>
  );
}

// ─── WEEK VIEW (day columns) ───────────────────────────────────────────
function WeekView() {
  const hours = ['9:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00'];
  const days = [
    { short: 'Lun', num: 11, dow: 1, count: 5 },
    { short: 'Mar', num: 12, dow: 2, count: 6 },
    { short: 'Mié', num: 13, dow: 3, count: 4 },
    { short: 'Jue', num: 14, dow: 4, count: 7, today: true },
    { short: 'Vie', num: 15, dow: 5, count: 8 },
    { short: 'Sáb', num: 16, dow: 6, count: 9 },
    { short: 'Dom', num: 17, dow: 7, count: 0 },
  ];

  // Mock week appointments per day
  const weekAppts = {
    1: [
      { start:'10:00', end:'11:00', client:'Lucía R.', service:'Manicure', status:'completed' },
      { start:'14:00', end:'15:30', client:'Andrea P.', service:'Tinte', status:'completed' },
    ],
    2: [
      { start:'9:30',  end:'10:30', client:'Mónica L.', service:'Pedicure', status:'completed' },
      { start:'12:00', end:'13:00', client:'Ana B.', service:'Corte', status:'completed' },
      { start:'16:00', end:'17:30', client:'Sara F.', service:'Facial', status:'completed' },
    ],
    3: [
      { start:'10:00', end:'12:00', client:'Camila R.', service:'Tinte + corte', status:'completed' },
      { start:'15:00', end:'16:00', client:'Julia G.', service:'Manicure', status:'completed' },
    ],
    4: [
      { start:'9:00',  end:'9:45',  client:'María G.', service:'Manicure', status:'completed' },
      { start:'10:00', end:'11:30', client:'Andrea S.', service:'Tinte', status:'in_progress' },
      { start:'12:00', end:'12:45', client:'Lucía M.', service:'Pedicure', status:'confirmed' },
      { start:'14:30', end:'15:30', client:'Camila R.', service:'Facial', status:'pending' },
      { start:'16:00', end:'17:00', client:'Ana B.', service:'Masaje', status:'pending' },
    ],
    5: [
      { start:'9:00',  end:'10:30', client:'Renata C.', service:'Tinte', status:'confirmed' },
      { start:'11:00', end:'12:00', client:'Daniela O.', service:'Corte', status:'confirmed' },
      { start:'13:00', end:'14:00', client:'Mariana T.', service:'Manicure', status:'confirmed' },
      { start:'15:30', end:'17:00', client:'Carolina P.', service:'Facial premium', status:'confirmed' },
    ],
    6: [
      { start:'10:00', end:'11:00', client:'Sofía H.', service:'Pedicure', status:'confirmed' },
      { start:'11:30', end:'13:00', client:'Patricia M.', service:'Tinte', status:'confirmed' },
      { start:'14:00', end:'15:30', client:'Verónica D.', service:'Limpieza facial', status:'confirmed' },
      { start:'16:00', end:'17:00', client:'Lucía P.', service:'Manicure', status:'confirmed' },
    ],
    7: [],
  };

  const slotFor = (startStr, endStr) => {
    const [sh, sm] = startStr.split(':').map(Number);
    const [eh, em] = endStr.split(':').map(Number);
    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;
    return { top: ((startMin - 9*60) / 60) * 50, h: ((endMin - startMin) / 60) * 50 };
  };

  return (
    <Card padding={0} style={{ overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: `60px repeat(7, 1fr)`, borderBottom: '1px solid var(--border)', background: 'var(--bg-canvas)' }}>
        <div></div>
        {days.map(d => <DayColHeader key={d.short} short={d.short} num={d.num} isToday={d.today} />)}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: `60px repeat(7, 1fr)`, position: 'relative' }}>
        <div>
          {hours.map(h => (
            <div key={h} style={{ height: 50, borderTop: '1px solid var(--border)', padding: '4px 8px', fontSize: 10.5, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{h}</div>
          ))}
        </div>

        {days.map(d => {
          const appts = weekAppts[d.dow] || [];
          return (
            <div key={d.short} style={{ borderLeft: '1px solid var(--border)', position: 'relative', background: d.today ? 'rgba(0,128,128,.02)' : 'transparent' }}>
              {hours.map((_, i) => (
                <div key={i} style={{ height: 50, borderTop: '1px solid var(--border)' }}></div>
              ))}
              {appts.map((a, i) => {
                const { top, h } = slotFor(a.start, a.end);
                const colorMap = {
                  confirmed:   { bg: 'var(--primary-50)',  bar: 'var(--primary-600)', fg: 'var(--primary-700)' },
                  pending:     { bg: 'var(--warning-50)',  bar: 'var(--warning-600)', fg: 'var(--warning-700)' },
                  in_progress: { bg: 'var(--purple-50)',   bar: 'var(--purple-600)',  fg: 'var(--purple-600)' },
                  completed:   { bg: 'var(--success-50)',  bar: 'var(--success-600)', fg: 'var(--success-700)' },
                };
                const c = colorMap[a.status] || colorMap.confirmed;
                return (
                  <div key={i} style={{
                    position: 'absolute', top, left: 3, right: 3, height: Math.max(h - 2, 18),
                    background: c.bg, borderLeft: `3px solid ${c.bar}`,
                    borderRadius: 6, padding: '3px 6px', overflow: 'hidden', cursor: 'pointer',
                  }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: c.fg, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.start} {a.client}</div>
                    {h >= 35 && <div style={{ fontSize: 9.5, color: 'var(--text-secondary)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.service}</div>}
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* Now indicator on today column (Jueves = 4th day column) */}
        <div style={{ position: 'absolute', left: `calc(60px + (100% - 60px) / 7 * 3)`, width: `calc((100% - 60px) / 7)`, top: (2*50 + 30), height: 2, background: 'var(--danger-600)', zIndex: 1 }}>
          <div style={{ position: 'absolute', left: -2, top: -4, width: 8, height: 8, borderRadius: 999, background: 'var(--danger-600)' }}/>
        </div>
      </div>
    </Card>
  );
}

// ─── REGISTRO (table list view) ────────────────────────────────────────
function RegistroView() {
  // Combine today's appts with a few from yesterday/tomorrow for the list view feel
  const allAppts = [
    { ...APPOINTMENTS_TODAY[6], date: '14 may' },
    { ...APPOINTMENTS_TODAY[5], date: '14 may' },
    { ...APPOINTMENTS_TODAY[4], date: '14 may' },
    { ...APPOINTMENTS_TODAY[3], date: '14 may' },
    { ...APPOINTMENTS_TODAY[2], date: '14 may' },
    { ...APPOINTMENTS_TODAY[1], date: '14 may' },
    { ...APPOINTMENTS_TODAY[0], date: '14 may' },
    { id:'y1', start:'15:00', end:'16:00', client:'Patricia Méndez', services:'Tinte + corte', price: 95, status: 'completed', emp:{ initials:'RC', name:'Renata C.', color:'#9333ea' }, date: '13 may' },
    { id:'y2', start:'11:00', end:'11:45', client:'Verónica Díaz',  services:'Manicure',     price: 35, status: 'completed', emp:{ initials:'JP', name:'Julia P.', color:'#d97706' }, date: '13 may' },
  ];

  return (
    <Card padding={0} style={{ overflow: 'hidden' }}>
      {/* Filter row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-canvas)' }}>
        <div style={{
          flex: 1, maxWidth: 320, height: 34,
          background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8,
          padding: '0 10px 0 32px', position: 'relative', display: 'flex', alignItems: 'center',
        }}>
          <div style={{ position: 'absolute', left: 10, color: 'var(--text-muted)' }}><Icons.Search /></div>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Buscar cliente, servicio...</span>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: 1 }}>
          {['Todos los estados', 'Todos los empleados'].map((c) => (
            <button key={c} style={{
              height: 30, padding: '0 12px', borderRadius: 999,
              background: 'var(--bg-surface)', border: '1px solid var(--border)',
              color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600,
              display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer',
            }}>{c} <Icons.Chevron style={{ transform: 'rotate(90deg)' }} /></button>
          ))}
        </div>
        <span style={{ fontSize: 11.5, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>9 resultados</span>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--bg-canvas)' }}>
              {['Fecha y hora','Cliente','Servicios','Empleado','Estado','Total',''].map(h => (
                <th key={h} style={{
                  textAlign: h === 'Total' ? 'right' : 'left',
                  padding: '10px 14px', fontSize: 11, fontWeight: 700,
                  color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em',
                  borderBottom: '1px solid var(--border)',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allAppts.map(a => (
              <tr key={a.id} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
                <td style={{ padding: '10px 14px', verticalAlign: 'middle' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{a.date}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{a.start} – {a.end}</div>
                </td>
                <td style={{ padding: '10px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Avatar initials={a.client.split(' ').map(p=>p[0]).slice(0,2).join('')} size={28} />
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{a.client}</div>
                  </div>
                </td>
                <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--text-secondary)' }}>{a.services}</td>
                <td style={{ padding: '10px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Avatar initials={a.emp.initials} size={22} color={a.emp.color} />
                    <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{a.emp.name}</span>
                  </div>
                </td>
                <td style={{ padding: '10px 14px' }}><StatusBadge status={a.status} /></td>
                <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{money(a.price)}</td>
                <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                  <button style={{ width: 28, height: 28, borderRadius: 6, background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icons.Dots />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border)', background: 'var(--bg-canvas)' }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Mostrando 9 de 142 · Mayo 2026</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button style={{ height: 28, padding: '0 12px', borderRadius: 6, background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Anterior</button>
          <button style={{ height: 28, padding: '0 12px', borderRadius: 6, background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Siguiente</button>
        </div>
      </div>
    </Card>
  );
}

// ─── Desktop Calendar wrapper with view switcher ───────────────────────
function CalendarDesktop() {
  const [view, setView] = React.useState('day');
  const subtitle = view === 'week' ? '47 citas · ' + money(2880) + ' esperado' : view === 'registro' ? '142 citas este mes · ' + money(48200) : '7 citas · ' + money(398) + ' esperado';
  return (
    <AppShell currentNav="Citas" title="Citas">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <CalendarToolbar view={view} subtitle={subtitle} onChange={setView} />
        {view === 'day' && <DayView />}
        {view === 'week' && <WeekView />}
        {view === 'registro' && <RegistroView />}
        {view === 'month' && (
          <Card padding={40} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Vista de mes — heatmap mensual</div>
          </Card>
        )}
      </div>
    </AppShell>
  );
}

// ─── Mobile Calendar ───────────────────────────────────────────────────
function CalendarMobile() {
  const [view, setView] = React.useState('agenda');
  const weekDays = [
    { label: 'L', date: 11, active: false, count: 5 },
    { label: 'M', date: 12, active: false, count: 6 },
    { label: 'M', date: 13, active: false, count: 4 },
    { label: 'J', date: 14, active: true,  count: 7 },
    { label: 'V', date: 15, active: false, count: 8 },
    { label: 'S', date: 16, active: false, count: 9 },
    { label: 'D', date: 17, active: false, count: 0 },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-canvas)' }}>
      {/* Topbar with title + search + filter + bell */}
      <MobileTopbar
        eyebrow="Mayo 2026"
        title="Citas"
        onSearch onFilter onBell
      />

      {/* Week strip */}
      <div style={{ padding: '12px 16px 0', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, paddingBottom: 14 }}>
          {weekDays.map((d, i) => (
            <div key={i} style={{
              textAlign: 'center', padding: '8px 0',
              borderRadius: 10, cursor: 'pointer',
              background: d.active ? 'var(--primary-600)' : 'transparent',
              color: d.active ? '#fff' : 'var(--text-primary)',
            }}>
              <div style={{ fontSize: 10.5, fontWeight: 600, opacity: d.active ? .9 : .5, textTransform: 'uppercase' }}>{d.label}</div>
              <div style={{ fontSize: 18, fontWeight: 800, marginTop: 2, fontVariantNumeric: 'tabular-nums', letterSpacing: '-.01em' }}>{d.date}</div>
              {d.count > 0 && <div style={{ width: 4, height: 4, borderRadius: 999, background: d.active ? '#fff' : 'var(--primary-600)', margin: '4px auto 0' }}/>}
            </div>
          ))}
        </div>
      </div>

      {/* Agenda / Registro toggle */}
      <div style={{ padding: '12px 16px 0', display: 'flex', gap: 0, background: 'var(--bg-canvas)' }}>
        <div style={{ display: 'flex', flex: 1, gap: 0, background: 'var(--bg-surface)', padding: 3, borderRadius: 10, border: '1px solid var(--border)' }}>
          {[{k:'agenda',l:'Agenda del día'},{k:'registro',l:'Registro'}].map(p => (
            <div key={p.k} onClick={() => setView(p.k)} style={{
              flex: 1, padding: '7px 0', borderRadius: 7, fontSize: 12.5, fontWeight: 600, textAlign: 'center',
              background: view===p.k?'var(--primary-600)':'transparent',
              color: view===p.k?'#fff':'var(--text-muted)', cursor: 'pointer',
            }}>{p.l}</div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '14px 16px 80px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text-muted)' }}>Jueves 14 de mayo</div>
            <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 600, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>7 citas · {money(398)}</div>
          </div>
        </div>

        {view === 'agenda' ? (
          <div style={{ position: 'relative' }}>
            {/* AHORA line at 11:35 */}
            <div style={{
              position: 'absolute', left: 48, right: 0, top: 232,
              display: 'flex', alignItems: 'center', gap: 8, zIndex: 1, pointerEvents: 'none',
            }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--danger-600)', fontVariantNumeric: 'tabular-nums', background: 'var(--bg-canvas)', padding: '0 4px' }}>AHORA</span>
              <div style={{ flex: 1, height: 2, background: 'var(--danger-600)' }}/>
            </div>

            {APPOINTMENTS_TODAY.map(a => (
              <div key={a.id} style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
                <div style={{ width: 38, flexShrink: 0, paddingTop: 12, textAlign: 'right' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: a.status==='completed' ? 'var(--text-muted)' : 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{a.start}</div>
                </div>
                <Card padding={14} style={{
                  flex: 1,
                  opacity: a.status === 'completed' ? 0.55 : 1,
                  borderLeft: '4px solid ' + (
                    a.status === 'confirmed'   ? 'var(--primary-600)' :
                    a.status === 'pending'     ? 'var(--warning-600)' :
                    a.status === 'in_progress' ? 'var(--purple-600)' :
                    a.status === 'completed'   ? 'var(--success-600)' :
                    'var(--border)'
                  ),
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text-primary)' }}>{a.client}</span>
                        <StatusBadge status={a.status} />
                      </div>
                      <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>{a.services}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                        <Avatar initials={a.emp.initials} size={20} color={a.emp.color} />
                        <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{a.emp.name}</span>
                        <span style={{ width: 3, height: 3, borderRadius: 999, background: 'var(--text-muted)' }}/>
                        <span style={{ fontSize: 11.5, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{a.start} – {a.end}</span>
                      </div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{money(a.price)}</div>
                  </div>
                </Card>
              </div>
            ))}
          </div>
        ) : (
          // Registro mobile view — compact list
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {APPOINTMENTS_TODAY.map(a => (
              <Card key={a.id} padding={12} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ textAlign: 'center', minWidth: 38 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{a.start}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{a.end}</div>
                </div>
                <Avatar initials={a.client.split(' ').map(p=>p[0]).slice(0,2).join('')} size={32} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.client}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.services}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{money(a.price)}</div>
                  <div style={{ marginTop: 2 }}><StatusBadge status={a.status} /></div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Floating + button */}
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

      <MobileBottomNav active="calendar" />
    </div>
  );
}

Object.assign(window, { CalendarDesktop, CalendarMobile });
