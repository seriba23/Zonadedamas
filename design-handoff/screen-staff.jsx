// screen-staff.jsx — Personal con tabs: Lista, Organigrama, Asistencia, Horarios, Comisiones

// ─── Tab navigation ────────────────────────────────────────────────────
function TabNav({ tabs, value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)' }}>
      {tabs.map(t => {
        const active = t.key === value;
        return (
          <button key={t.key} onClick={() => onChange(t.key)} style={{
            padding: '12px 16px', background: 'transparent', border: 'none',
            borderBottom: active ? '2px solid var(--primary-600)' : '2px solid transparent',
            color: active ? 'var(--primary-700)' : 'var(--text-secondary)',
            fontSize: 13.5, fontWeight: active ? 700 : 500,
            cursor: 'pointer', position: 'relative', top: 1,
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            {t.icon}
            {t.label}
            {t.badge !== undefined && (
              <span style={{
                background: active ? 'var(--primary-100)' : 'var(--bg-canvas)',
                color: active ? 'var(--primary-700)' : 'var(--text-muted)',
                borderRadius: 999, padding: '1px 7px', fontSize: 11, fontWeight: 700,
              }}>{t.badge}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Lista tab (the grid we had) ───────────────────────────────────────
function StaffListTab() {
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
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Buscar empleado o rol...</span>
          </div>
          <Button variant="secondary" size="md" icon={<Icons.Filter />}>Filtros</Button>
        </div>
        <Button size="md" icon={<Icons.Plus />}>Nuevo empleado</Button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        <KpiCard icon={<Icons.Staff />}    label="Activos"        value={EMPLOYEES.length}            sub="0 en pausa" />
        <KpiCard icon={<Icons.Calendar />} label="Citas hoy"      value={EMPLOYEES.reduce((s,e)=>s+e.todayCount,0)} />
        <KpiCard icon={<Icons.Cash />}     label="Semana"          value={money(EMPLOYEES.reduce((s,e)=>s+e.weekRevenue,0))} trend="+12%" />
        <KpiCard icon={<Icons.Star />}     label="Promedio rating" value={(EMPLOYEES.reduce((s,e)=>s+e.rating,0)/EMPLOYEES.length).toFixed(1)} sub={`${EMPLOYEES.reduce((s,e)=>s+e.reviews,0)} reseñas`} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
        {EMPLOYEES.map(e => (
          <Card key={e.id} padding={0}>
            <div style={{
              height: 76,
              background: `linear-gradient(135deg, ${e.color}, ${e.color}88)`,
              borderRadius: '14px 14px 0 0',
            }}/>
            <div style={{ padding: '0 20px 18px', marginTop: -32 }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
                <div style={{
                  width: 64, height: 64, borderRadius: 999, background: e.color, color: '#fff',
                  border: '4px solid var(--bg-surface)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 800, fontSize: 22,
                }}>{e.initials}</div>
                <StatusBadge status="confirmed" />
              </div>
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-.01em' }}>{e.name}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 1 }}>{e.role}</div>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
                {e.services.map(s => (
                  <span key={s} style={{
                    padding: '3px 10px', borderRadius: 999,
                    background: 'var(--bg-canvas)', border: '1px solid var(--border)',
                    fontSize: 11.5, fontWeight: 500, color: 'var(--text-secondary)',
                  }}>{s}</span>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 16, paddingTop: 14, borderTop: '1px dashed var(--border)' }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 600 }}>Hoy</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{e.todayCount}<span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)' }}> citas</span></div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 600 }}>Semana</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{money(e.weekRevenue)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 600 }}>Rating</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                    {e.rating} <Icons.Star style={{ color: 'var(--warning-600)' }} />
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <Button variant="secondary" size="sm" style={{ flex: 1 }}>Ver agenda</Button>
                <Button variant="primary" size="sm" style={{ flex: 1 }}>Editar</Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Organigrama tab ───────────────────────────────────────────────────
function OrganigramaTab() {
  // Tree node
  const TreeNode = ({ name, role, initials, color, children }) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
      <Card padding={14} style={{ width: 200, textAlign: 'center', borderColor: 'var(--border)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <Avatar initials={initials} size={48} color={color} />
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>{name}</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>{role}</div>
          </div>
        </div>
      </Card>
      {children && (
        <React.Fragment>
          <div style={{ width: 2, height: 24, background: 'var(--border)' }} />
          <div style={{ display: 'flex', gap: 20, position: 'relative' }}>
            {/* Horizontal connector */}
            {children.length > 1 && (
              <div style={{
                position: 'absolute', left: '50%', top: -24, width: `calc(100% - 200px)`, height: 2,
                background: 'var(--border)',
                transform: 'translateX(-50%)',
              }} />
            )}
            {React.Children.map(children, (c, i) => (
              <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ width: 2, height: 24, background: 'var(--border)', marginTop: -24 }} />
                {c}
              </div>
            ))}
          </div>
        </React.Fragment>
      )}
    </div>
  );

  return (
    <Card padding={32} style={{ overflow: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <SectionLabel>Organigrama · 7 personas</SectionLabel>
        <Button variant="secondary" size="sm" icon={<Icons.Plus />}>Agregar rol</Button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12 }}>
        <TreeNode name="Sergio Ortiz" role="Administrador" initials="SO" color="var(--primary-600)">
          {[
            <TreeNode key="1" name="Renata Castillo" role="Estilista senior · Jefa de equipo" initials="RC" color="#9333ea">
              {[
                <TreeNode key="a" name="Sara Flores" role="Estilista jr." initials="SF" color="#059669" />,
              ]}
            </TreeNode>,
            <TreeNode key="2" name="Julia Pérez" role="Manicurista" initials="JP" color="#d97706" />,
            <TreeNode key="3" name="María López" role="Esteticista" initials="ML" color="#dc2626" />,
          ]}
        </TreeNode>
      </div>
    </Card>
  );
}

// ─── Asistencia tab ────────────────────────────────────────────────────
function AsistenciaTab() {
  const days = ['L11','M12','M13','J14','V15','S16','D17'];
  // Status grid: A=presente, T=tarde, F=falta, V=vacaciones, -=descanso
  const grid = {
    'r': ['A','A','A','A','A','-','-'],
    'j': ['A','T','A','A','A','A','-'],
    'm': ['A','A','A','F','A','A','-'],
    's': ['A','A','-','A','A','V','-'],
  };
  const colorOf = (c) => ({
    A: { bg: 'var(--success-50)',  fg: 'var(--success-700)' },
    T: { bg: 'var(--warning-50)',  fg: 'var(--warning-700)' },
    F: { bg: 'var(--danger-50)',   fg: 'var(--danger-700)' },
    V: { bg: 'var(--info-50)',     fg: 'var(--info-700)' },
    '-':{ bg: 'var(--bg-canvas)',  fg: 'var(--text-muted)' },
  }[c]);
  const labelOf = (c) => ({ A: '✓', T: 'T', F: 'F', V: 'V', '-': '–' }[c]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        <Card padding={16}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text-muted)' }}>Asistencia</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--success-700)', letterSpacing: '-.01em', fontVariantNumeric: 'tabular-nums', marginTop: 4 }}>92%</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>esta semana</div>
        </Card>
        <Card padding={16}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text-muted)' }}>Llegadas tarde</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--warning-700)', letterSpacing: '-.01em', fontVariantNumeric: 'tabular-nums', marginTop: 4 }}>1</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Julia P. · Mar 12</div>
        </Card>
        <Card padding={16}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text-muted)' }}>Faltas</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--danger-700)', letterSpacing: '-.01em', fontVariantNumeric: 'tabular-nums', marginTop: 4 }}>1</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>María L. · Jue 14</div>
        </Card>
        <Card padding={16}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text-muted)' }}>Vacaciones</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--info-700)', letterSpacing: '-.01em', fontVariantNumeric: 'tabular-nums', marginTop: 4 }}>1</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Sara F. · Sáb 16</div>
        </Card>
      </div>

      {/* Attendance grid */}
      <Card padding={0} style={{ overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Semana del 11 al 17 de mayo</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>Toca una celda para registrar entrada/salida</div>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: 'var(--text-secondary)' }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--success-100)' }}/> Presente
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: 'var(--text-secondary)' }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--warning-100)' }}/> Tarde
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: 'var(--text-secondary)' }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--danger-100)' }}/> Falta
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: 'var(--text-secondary)' }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--info-100)' }}/> Vacaciones
            </span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '240px repeat(7, 1fr)', borderBottom: '1px solid var(--border)' }}>
          <div></div>
          {days.map((d, i) => (
            <div key={d} style={{ padding: '12px', textAlign: 'center', borderLeft: '1px solid var(--border)', background: i === 3 ? 'var(--primary-50)' : 'transparent' }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: i === 3 ? 'var(--primary-700)' : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{d.slice(0,1)===d.slice(0,1).toUpperCase() ? ({L:'Lun',M:'Mar/Mié',J:'Jue',V:'Vie',S:'Sáb',D:'Dom'}[d[0]] || d.slice(0,3)) : d}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: i === 3 ? 'var(--primary-700)' : 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{d.slice(1)}</div>
            </div>
          ))}
        </div>

        {EMPLOYEES.map(e => (
          <div key={e.id} style={{ display: 'grid', gridTemplateColumns: '240px repeat(7, 1fr)', borderBottom: '1px solid var(--border)' }}>
            <div style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Avatar initials={e.initials} size={32} color={e.color} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{e.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{e.role}</div>
              </div>
            </div>
            {grid[e.id].map((c, i) => {
              const col = colorOf(c);
              return (
                <div key={i} style={{ borderLeft: '1px solid var(--border)', padding: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{
                    width: '100%', height: 36, borderRadius: 8,
                    background: col.bg, color: col.fg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  }}>{labelOf(c)}</div>
                </div>
              );
            })}
          </div>
        ))}
      </Card>
    </div>
  );
}

// ─── Horarios tab ──────────────────────────────────────────────────────
function HorariosTab() {
  const slots = {
    'r': [{from:'9:00',to:'18:00',color:'var(--primary-200)',label:'Tienda'}],
    'j': [{from:'10:00',to:'19:00',color:'var(--warning-200)',label:'Tienda'}],
    'm': [{from:'12:00',to:'20:00',color:'var(--danger-200)',label:'Tienda'}],
    's': [{from:'9:00',to:'14:00',color:'var(--success-200)',label:'Tienda'}],
  };
  const days = ['Lun 11','Mar 12','Mié 13','Jue 14','Vie 15','Sáb 16','Dom 17'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text-muted)' }}>Semana del 11 al 17 de mayo</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>Horario de personal</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="secondary" size="md" icon={<Icons.Calendar />}>Copiar semana</Button>
          <Button size="md" icon={<Icons.Plus />}>Asignar turno</Button>
        </div>
      </div>

      <Card padding={0} style={{ overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '220px repeat(7, 1fr)', background: 'var(--bg-canvas)', borderBottom: '1px solid var(--border)' }}>
          <div></div>
          {days.map((d, i) => (
            <div key={d} style={{ padding: '10px 12px', borderLeft: '1px solid var(--border)', textAlign: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: i===3?'var(--primary-700)':'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{d.split(' ')[0]}</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: i===3?'var(--primary-700)':'var(--text-primary)', fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{d.split(' ')[1]}</div>
            </div>
          ))}
        </div>

        {/* Hour scale */}
        <div style={{ display: 'grid', gridTemplateColumns: '220px repeat(7, 1fr)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '6px 14px', fontSize: 10, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', borderBottom: '1px solid var(--border)' }}>
            9 – 20 hrs
          </div>
          {days.map((d, i) => (
            <div key={d} style={{
              position: 'relative', height: 24, borderLeft: '1px solid var(--border)', borderBottom: '1px solid var(--border)',
              background: 'linear-gradient(90deg, var(--bg-canvas) 0%, var(--bg-canvas) 100%)',
            }}>
              <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
                {[9,10,11,12,13,14,15,16,17,18,19].map(h => (
                  <div key={h} style={{ flex: 1, borderRight: '1px dashed var(--border)' }}/>
                ))}
              </div>
            </div>
          ))}
        </div>

        {EMPLOYEES.map(e => (
          <div key={e.id} style={{ display: 'grid', gridTemplateColumns: '220px repeat(7, 1fr)', borderBottom: '1px solid var(--border)' }}>
            <div style={{ padding: '14px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Avatar initials={e.initials} size={32} color={e.color} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{e.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{slots[e.id][0].from} – {slots[e.id][0].to}</div>
              </div>
            </div>
            {days.map((d, i) => {
              const slot = slots[e.id][0];
              const [fh, fm] = slot.from.split(':').map(Number);
              const [th, tm] = slot.to.split(':').map(Number);
              const startPct = ((fh - 9) + fm/60) / 11 * 100;
              const endPct = ((th - 9) + tm/60) / 11 * 100;
              const isOff = i === 6 || (e.id === 's' && (i === 2 || i === 5));
              return (
                <div key={i} style={{
                  position: 'relative', borderLeft: '1px solid var(--border)', height: 50,
                  background: i === 3 ? 'rgba(0,128,128,.03)' : 'transparent',
                }}>
                  {!isOff && (
                    <div style={{
                      position: 'absolute', top: 8, height: 34,
                      left: `calc(${startPct}% + 4px)`,
                      width: `calc(${endPct - startPct}% - 8px)`,
                      borderRadius: 6,
                      background: slot.color,
                      borderLeft: `3px solid ${slot.color.replace('200','600')}`,
                      padding: '4px 8px',
                      overflow: 'hidden',
                    }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: slot.color.replace('200','700'), fontVariantNumeric: 'tabular-nums' }}>{slot.from}–{slot.to}</div>
                      <div style={{ fontSize: 9.5, color: 'var(--text-secondary)' }}>{slot.label}</div>
                    </div>
                  )}
                  {isOff && (
                    <div style={{
                      position: 'absolute', inset: 8, borderRadius: 6,
                      background: 'repeating-linear-gradient(45deg, var(--bg-canvas) 0 4px, var(--bg-surface) 4px 8px)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, color: 'var(--text-muted)', fontWeight: 600,
                    }}>Descanso</div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </Card>
    </div>
  );
}

// ─── Comisiones tab ────────────────────────────────────────────────────
function ComisionesTab() {
  const rows = EMPLOYEES.map((e, i) => ({
    ...e,
    appts: [22, 28, 18, 14][i],
    gross: [3120, 2480, 2240, 1180][i],
    rate: [40, 35, 35, 25][i],
    commission: 0,
  })).map(r => ({ ...r, commission: Math.round(r.gross * r.rate / 100) }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Period selector */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', gap: 0, background: 'var(--bg-canvas)', padding: 3, borderRadius: 10, border: '1px solid var(--border)' }}>
            {['Quincena 1', 'Quincena 2', 'Mes completo'].map((p, i) => (
              <div key={p} style={{
                padding: '6px 14px', borderRadius: 7, fontSize: 12.5, fontWeight: 600,
                background: i===0?'var(--bg-surface)':'transparent',
                color: i===0?'var(--text-primary)':'var(--text-muted)',
                boxShadow: i===0?'var(--shadow-sm)':'none', cursor: 'pointer',
              }}>{p}</div>
            ))}
          </div>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>1 – 15 de mayo</span>
        </div>
        <Button variant="secondary" size="md" icon={<Icons.Arrow />}>Exportar nómina</Button>
      </div>

      {/* Summary KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        <KpiCard icon={<Icons.Cash />}    label="Total a pagar"    value={money(rows.reduce((s,r)=>s+r.commission,0))} sub="quincena en curso" />
        <KpiCard icon={<Icons.Calendar />} label="Citas atendidas" value={rows.reduce((s,r)=>s+r.appts,0)} />
        <KpiCard icon={<Icons.TrendUp />} label="Promedio comisión" value={`${(rows.reduce((s,r)=>s+r.rate,0)/rows.length).toFixed(0)}%`} />
        <KpiCard icon={<Icons.Staff />}   label="Empleados"        value={rows.length} sub={`${rows.length} con comisión`} />
      </div>

      <Card padding={0}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--bg-canvas)' }}>
              {['Empleado','Citas','Ingresos generados','Comisión %','Comisión a pagar','Estado',''].map(h => (
                <th key={h} style={{
                  textAlign: ['Citas','Comisión %'].includes(h) ? 'center' : ['Ingresos generados','Comisión a pagar'].includes(h) ? 'right' : 'left',
                  padding: '12px 16px', fontSize: 11, fontWeight: 700,
                  color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em',
                  borderBottom: '1px solid var(--border)',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Avatar initials={r.initials} size={32} color={r.color} />
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>{r.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.role}</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '14px 16px', textAlign: 'center', fontSize: 13, color: 'var(--text-primary)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{r.appts}</td>
                <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: 13, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{money(r.gross)}</td>
                <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary-700)', background: 'var(--primary-50)', padding: '3px 10px', borderRadius: 999, fontVariantNumeric: 'tabular-nums' }}>{r.rate}%</span>
                </td>
                <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: 14.5, fontWeight: 800, color: 'var(--primary-700)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-.01em' }}>{money(r.commission)}</td>
                <td style={{ padding: '14px 16px' }}>
                  <StatusBadge status={r.id === 'r' ? 'completed' : 'pending'} />
                </td>
                <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                  <Button variant="ghost" size="sm">Detalle</Button>
                </td>
              </tr>
            ))}
            <tr style={{ background: 'var(--bg-canvas)' }}>
              <td style={{ padding: '14px 16px', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Total</td>
              <td style={{ padding: '14px 16px', textAlign: 'center', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{rows.reduce((s,r)=>s+r.appts,0)}</td>
              <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{money(rows.reduce((s,r)=>s+r.gross,0))}</td>
              <td></td>
              <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: 16, fontWeight: 800, color: 'var(--primary-700)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-.01em' }}>{money(rows.reduce((s,r)=>s+r.commission,0))}</td>
              <td colSpan="2"></td>
            </tr>
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ─── Desktop wrapper with tabs ─────────────────────────────────────────
function StaffDesktop() {
  const [tab, setTab] = React.useState('lista');
  const tabs = [
    { key: 'lista',       label: 'Lista',       icon: <Icons.Staff size={16} />,    badge: EMPLOYEES.length },
    { key: 'organigrama', label: 'Organigrama', icon: <Icons.Map size={16} /> },
    { key: 'asistencia',  label: 'Asistencia',  icon: <Icons.Check size={16} /> },
    { key: 'horarios',    label: 'Horarios',    icon: <Icons.Clock size={16} /> },
    { key: 'comisiones',  label: 'Comisiones',  icon: <Icons.Cash size={16} /> },
  ];

  return (
    <AppShell currentNav="Personal" title="Personal">
      <div style={{ marginBottom: 18 }}>
        <TabNav tabs={tabs} value={tab} onChange={setTab} />
      </div>

      {tab === 'lista' && <StaffListTab />}
      {tab === 'organigrama' && <OrganigramaTab />}
      {tab === 'asistencia' && <AsistenciaTab />}
      {tab === 'horarios' && <HorariosTab />}
      {tab === 'comisiones' && <ComisionesTab />}
    </AppShell>
  );
}

// ─── Mobile "Mi perfil" view (unchanged for employee role) ──────────────
function StaffMobile() {
  const me = EMPLOYEES[0];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-canvas)' }}>
      <div style={{
        background: 'var(--primary-600)',
        color: '#fff', padding: '18px 18px 22px',
        position: 'relative', overflow: 'hidden',
      }}>
        <div aria-hidden style={{ position: 'absolute', right: -30, top: -40, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,.07)' }}/>
        <div aria-hidden style={{ position: 'absolute', left: -40, bottom: -60, width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,.05)' }}/>

        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,.18)', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icons.Chevron style={{ transform: 'rotate(180deg)' }} />
          </button>
          <span style={{ fontSize: 14, fontWeight: 600 }}>Mi perfil</span>
          <button style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,.18)', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icons.Cog />
          </button>
        </div>

        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 14, marginTop: 18 }}>
          <div style={{
            width: 72, height: 72, borderRadius: 999, background: me.color, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 26, border: '3px solid rgba(255,255,255,.4)',
          }}>{me.initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-.01em' }}>{me.name}</div>
            <div style={{ fontSize: 13, opacity: .9, marginTop: 2 }}>{me.role}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6 }}>
              <Icons.Star style={{ color: '#fef08a' }} />
              <span style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{me.rating}</span>
              <span style={{ fontSize: 12, opacity: .8 }}>· {me.reviews} reseñas</span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: '0 16px', marginTop: -16 }}>
        <Card padding={14} elevated>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-.01em', fontVariantNumeric: 'tabular-nums' }}>{me.todayCount}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 600 }}>Hoy</div>
            </div>
            <div style={{ textAlign: 'center', borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-.01em', fontVariantNumeric: 'tabular-nums' }}>{me.weekRevenue/1000}k</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 600 }}>Semana</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-.01em', fontVariantNumeric: 'tabular-nums' }}>{me.reviews}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 600 }}>Reseñas</div>
            </div>
          </div>
        </Card>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '18px 16px 80px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <section>
          <SectionLabel>Mis servicios</SectionLabel>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {me.services.map(s => (
              <div key={s} style={{
                padding: '8px 14px', borderRadius: 10,
                background: 'var(--bg-surface)', border: '1px solid var(--border)',
                fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
              }}>{s}</div>
            ))}
            <button style={{
              padding: '8px 14px', borderRadius: 10,
              background: 'transparent', border: '1px dashed var(--border)',
              fontSize: 13, fontWeight: 600, color: 'var(--text-muted)',
              display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer',
            }}><Icons.Plus size={14} /> Agregar</button>
          </div>
        </section>

        <section>
          <SectionLabel right={<a style={{ fontSize: 12, fontWeight: 600, color: 'var(--primary-600)' }}>Ver portfolio →</a>}>Portfolio</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
            {[1,2,3,4,5,6].map(i => (
              <div key={i} style={{
                aspectRatio: '1',
                background: `linear-gradient(135deg, oklch(0.7 0.08 ${i*60}), oklch(0.5 0.12 ${(i*60+40)%360}))`,
                borderRadius: 10,
              }}/>
            ))}
          </div>
        </section>

        <Card padding={16}>
          <SectionLabel>Mi semana</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map((d, i) => {
              const v = [3,5,4,4,6,7,0][i];
              const max = 7;
              return (
                <div key={d} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted)', width: 28 }}>{d}</span>
                  <div style={{ flex: 1, height: 8, background: 'var(--bg-canvas)', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ width: `${(v/max)*100}%`, height: '100%', background: i===3?'var(--primary-600)':'var(--primary-300)', borderRadius: 999 }}/>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', minWidth: 18, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{v}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <MobileBottomNav active="profile" />
    </div>
  );
}

Object.assign(window, { StaffDesktop, StaffMobile, TabNav });
