// screen-inventory.jsx — Inventario, desktop + mobile

const INVENTORY = [
  { id:'i1',  name:"Tinte L'Oréal 6N",         sku:'LRL-6N',    stock: 3,   min: 5,   cost: 180,  price: 320,  category:'Tintes',      supplier:"L'Oréal" },
  { id:'i2',  name:"Tinte L'Oréal 4M",         sku:'LRL-4M',    stock: 12,  min: 5,   cost: 180,  price: 320,  category:'Tintes',      supplier:"L'Oréal" },
  { id:'i3',  name:"Tinte Wella 7/0",          sku:'WLA-70',    stock: 0,   min: 4,   cost: 165,  price: 280,  category:'Tintes',      supplier:'Wella' },
  { id:'i4',  name:'Oxidante 30 vol.',         sku:'OX-30',     stock: 8,   min: 6,   cost: 95,   price: 160,  category:'Tintes',      supplier:'Wella' },
  { id:'i5',  name:'Esmalte OPI · Rojo',       sku:'OPI-RD-01', stock: 2,   min: 3,   cost: 120,  price: 220,  category:'Esmaltes',    supplier:'OPI' },
  { id:'i6',  name:'Esmalte OPI · Nude',       sku:'OPI-ND-02', stock: 5,   min: 3,   cost: 120,  price: 220,  category:'Esmaltes',    supplier:'OPI' },
  { id:'i7',  name:'Crema hidratante 500ml',   sku:'CR-H-500',  stock: 15,  min: 5,   cost: 220,  price: 380,  category:'Cremas',      supplier:'Cetaphil' },
  { id:'i8',  name:'Mascarilla facial',        sku:'MSK-FC-01', stock: 8,   min: 4,   cost: 145,  price: 260,  category:'Cremas',      supplier:'Cetaphil' },
  { id:'i9',  name:'Toallas desechables',      sku:'TLL-DSP',   stock: 240, min: 100, cost: 1.5,  price: 4,    category:'Consumibles', supplier:'Sanitas' },
  { id:'i10', name:'Algodón cosmético',        sku:'ALG-100',   stock: 6,   min: 8,   cost: 65,   price: 120,  category:'Consumibles', supplier:'Sanitas' },
  { id:'i11', name:'Aceite esencial · Lavanda',sku:'AE-LAV',    stock: 4,   min: 3,   cost: 280,  price: 480,  category:'Cremas',      supplier:'Aromaterapia MX' },
  { id:'i12', name:'Cera depilatoria 500g',    sku:'CER-500',   stock: 9,   min: 4,   cost: 180,  price: 320,  category:'Consumibles', supplier:'Depilex' },
];

const MOVEMENTS = [
  { date:'14 may · 11:30', type:'out', item:"Tinte L'Oréal 6N", qty: 1,  by:'Renata C.', note:'Cita #841' },
  { date:'14 may · 10:15', type:'out', item:'Esmalte OPI · Rojo', qty: 1,  by:'Julia P.', note:'Cita #840' },
  { date:'14 may · 09:00', type:'in',  item:'Toallas desechables', qty: 100, by:'Sergio O.', note:'Compra · Sanitas' },
  { date:'13 may · 17:45', type:'out', item:'Oxidante 30 vol.', qty: 1,  by:'Renata C.', note:'Cita #838' },
  { date:'13 may · 16:20', type:'out', item:'Crema hidratante 500ml', qty: 1,  by:'María L.', note:'Cita #837' },
  { date:'13 may · 11:00', type:'adj', item:"Tinte Wella 7/0", qty: -2, by:'Sergio O.', note:'Ajuste · merma' },
  { date:'12 may · 14:00', type:'in',  item:'Cera depilatoria 500g', qty: 6,  by:'Sergio O.', note:'Compra · Depilex' },
];

const SUPPLIERS = [
  { name:"L'Oréal Profesional", contact:'Carlos M.', phone:'+52 55 1234 5678', email:'ventas@loreal.mx', items: 6, lastOrder: '10 may', spent: 4280 },
  { name:'Wella',                contact:'Sandra G.', phone:'+52 55 2345 6789', email:'pedidos@wella.mx', items: 4, lastOrder:  '5 may',  spent: 2150 },
  { name:'OPI',                  contact:'Pedro R.',  phone:'+52 55 3456 7890', email:'mx@opi.com',         items: 8, lastOrder: '8 may',  spent: 1840 },
  { name:'Cetaphil',             contact:'Ana V.',    phone:'+52 55 4567 8901', email:'b2b@cetaphil.mx',    items: 5, lastOrder: '11 may', spent: 3220 },
  { name:'Sanitas',              contact:'Luis F.',   phone:'+52 55 5678 9012', email:'sanitas@dist.mx',    items: 3, lastOrder: '14 may', spent: 920 },
  { name:'Depilex',              contact:'Mariana S.',phone:'+52 55 6789 0123', email:'pedidos@depilex.mx', items: 2, lastOrder: '12 may', spent: 1180 },
];

// ─── Stock status helpers ──────────────────────────────────────────────
function stockState(it) {
  if (it.stock === 0) return { label: 'Sin stock', color: 'var(--danger-700)', bg: 'var(--danger-50)', dot: 'var(--danger-600)' };
  if (it.stock < it.min) return { label: 'Bajo', color: 'var(--warning-700)', bg: 'var(--warning-50)', dot: 'var(--warning-600)' };
  return { label: 'Ok', color: 'var(--success-700)', bg: 'var(--success-50)', dot: 'var(--success-600)' };
}

// ─── Productos tab ─────────────────────────────────────────────────────
function InventoryProductsTab() {
  const [filter, setFilter] = React.useState('Todos');
  const cats = Array.from(new Set(INVENTORY.map(i => i.category)));
  const filtered = filter === 'Todos' ? INVENTORY :
                   filter === 'Bajo'  ? INVENTORY.filter(i => i.stock > 0 && i.stock < i.min) :
                   filter === 'Sin stock' ? INVENTORY.filter(i => i.stock === 0) :
                   INVENTORY.filter(i => i.category === filter);

  const totalValue = INVENTORY.reduce((s, i) => s + i.stock * i.cost, 0);
  const lowCount = INVENTORY.filter(i => i.stock > 0 && i.stock < i.min).length;
  const outCount = INVENTORY.filter(i => i.stock === 0).length;

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
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Buscar por nombre o SKU...</span>
          </div>
          <Button variant="secondary" size="md" icon={<Icons.Filter />}>Filtros</Button>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="secondary" size="md" icon={<Icons.Arrow />}>Exportar</Button>
          <Button size="md" icon={<Icons.Plus />}>Nuevo producto</Button>
        </div>
      </div>

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        <KpiCard icon={<Icons.Inventory />} label="SKUs activos"     value={INVENTORY.length} sub={`${cats.length} categorías`} />
        <KpiCard icon={<Icons.Cash />}      label="Valor inventario" value={money(totalValue)} sub="al costo" />
        <KpiCard icon={<Icons.Bell />}      label="Stock bajo"       value={lowCount} sub="requieren reorden" />
        <KpiCard icon={<Icons.X />}         label="Sin stock"        value={outCount} sub="agotados" />
      </div>

      {/* Alert banner if low or out */}
      {(lowCount + outCount) > 0 && (
        <Card highlight padding={16} style={{ borderColor: 'var(--warning-600)', background: 'var(--warning-50)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--warning-600)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icons.Bell />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--warning-700)' }}>{outCount} producto sin stock · {lowCount} con stock bajo</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>Genera órdenes de compra antes de que afecten servicios programados.</div>
            </div>
            <Button size="sm" variant="primary" style={{ background: 'var(--warning-600)' }}>Ver alertas</Button>
          </div>
        </Card>
      )}

      {/* Filter chips */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {['Todos', 'Bajo', 'Sin stock', ...cats].map(c => {
          const active = c === filter;
          return (
            <button key={c} onClick={() => setFilter(c)} style={{
              height: 30, padding: '0 12px', borderRadius: 999,
              background: active ? 'var(--primary-600)' : 'var(--bg-surface)',
              color: active ? '#fff' : 'var(--text-secondary)',
              border: '1px solid ' + (active ? 'var(--primary-600)' : 'var(--border)'),
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 5,
            }}>
              {c === 'Bajo' && <span style={{ width: 6, height: 6, borderRadius: 999, background: active ? '#fff' : 'var(--warning-600)' }}/>}
              {c === 'Sin stock' && <span style={{ width: 6, height: 6, borderRadius: 999, background: active ? '#fff' : 'var(--danger-600)' }}/>}
              {c}
            </button>
          );
        })}
      </div>

      {/* Product table */}
      <Card padding={0}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--bg-canvas)' }}>
              {['Producto','SKU','Categoría','Stock','Costo','Precio','Valor',''].map(h => (
                <th key={h} style={{
                  textAlign: ['Stock','Costo','Precio','Valor'].includes(h) ? 'right' : 'left',
                  padding: '12px 14px', fontSize: 11, fontWeight: 700,
                  color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em',
                  borderBottom: '1px solid var(--border)',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(it => {
              const st = stockState(it);
              return (
                <tr key={it.id} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 999, background: st.dot, flexShrink: 0, marginRight: 4 }}/>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>{it.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>{it.sku}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 6, background: 'var(--bg-canvas)', fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)' }}>{it.category}</span>
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                      <div style={{ width: 56, height: 5, background: 'var(--bg-canvas)', borderRadius: 999, overflow: 'hidden' }}>
                        <div style={{
                          width: `${Math.min(100, (it.stock / Math.max(it.min*2, 1)) * 100)}%`,
                          height: '100%', background: st.dot,
                        }}/>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: st.color, fontVariantNumeric: 'tabular-nums', minWidth: 30 }}>{it.stock}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>/ {it.min}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', fontSize: 13, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{money(it.cost)}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{money(it.price)}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{money(it.stock * it.cost)}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                    <button style={{ width: 28, height: 28, borderRadius: 6, background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icons.Dots />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ─── Movimientos tab ───────────────────────────────────────────────────
function InventoryMovementsTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <SectionLabel>Movimientos · últimos 7 días</SectionLabel>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: -8 }}>Cada uso, compra o ajuste queda registrado automáticamente.</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="secondary" size="md" icon={<Icons.Arrow />}>Exportar</Button>
          <Button size="md" icon={<Icons.Plus />}>Registrar entrada</Button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        <KpiCard icon={<Icons.TrendUp />}  label="Entradas"  value="+106 uds" sub="en 7 días · 2 compras" />
        <KpiCard icon={<Icons.Cash />}     label="Salidas"   value="-12 uds"  sub="por servicios" />
        <KpiCard icon={<Icons.Bell />}     label="Ajustes"   value="-2 uds"   sub="merma · 13 may" />
      </div>

      <Card padding={0}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--bg-canvas)' }}>
              {['Fecha','Tipo','Producto','Cantidad','Usuario','Notas',''].map(h => (
                <th key={h} style={{
                  textAlign: h === 'Cantidad' ? 'right' : 'left',
                  padding: '12px 14px', fontSize: 11, fontWeight: 700,
                  color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em',
                  borderBottom: '1px solid var(--border)',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MOVEMENTS.map((m, i) => {
              const typeMap = {
                in:  { label: 'Entrada', bg: 'var(--success-50)', fg: 'var(--success-700)' },
                out: { label: 'Salida',  bg: 'var(--info-50)',    fg: 'var(--info-700)' },
                adj: { label: 'Ajuste',  bg: 'var(--warning-50)', fg: 'var(--warning-700)' },
              };
              const t = typeMap[m.type];
              const qty = m.type === 'in' ? '+' + m.qty : m.type === 'adj' ? m.qty : '-' + m.qty;
              const qtyColor = m.type === 'in' ? 'var(--success-700)' : 'var(--text-primary)';
              return (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '11px 14px', fontSize: 12.5, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{m.date}</td>
                  <td style={{ padding: '11px 14px' }}>
                    <span style={{ padding: '3px 9px', borderRadius: 999, background: t.bg, color: t.fg, fontSize: 11, fontWeight: 700 }}>{t.label}</span>
                  </td>
                  <td style={{ padding: '11px 14px', fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>{m.item}</td>
                  <td style={{ padding: '11px 14px', textAlign: 'right', fontSize: 14, fontWeight: 700, color: qtyColor, fontVariantNumeric: 'tabular-nums' }}>{qty}</td>
                  <td style={{ padding: '11px 14px', fontSize: 12.5, color: 'var(--text-secondary)' }}>{m.by}</td>
                  <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--text-muted)' }}>{m.note}</td>
                  <td style={{ padding: '11px 14px', textAlign: 'right' }}>
                    <button style={{ width: 28, height: 28, borderRadius: 6, background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icons.Dots />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ─── Proveedores tab ───────────────────────────────────────────────────
function InventorySuppliersTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <SectionLabel>Proveedores · {SUPPLIERS.length} activos</SectionLabel>
        <Button size="md" icon={<Icons.Plus />}>Nuevo proveedor</Button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        {SUPPLIERS.map(s => (
          <Card key={s.name} padding={18}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: 'var(--primary-50)', color: 'var(--primary-700)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, fontWeight: 800, flexShrink: 0,
              }}>
                {s.name.split(/[\s']+/).filter(Boolean).slice(0,2).map(w => w[0]).join('').toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{s.contact}</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                <Icons.Phone size={13} style={{ color: 'var(--text-muted)' }}/>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{s.phone}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                <Icons.Mail size={13} style={{ color: 'var(--text-muted)' }}/>
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.email}</span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, paddingTop: 12, borderTop: '1px dashed var(--border)' }}>
              <div>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 700 }}>SKUs</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{s.items}</div>
              </div>
              <div>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 700 }}>Última</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 }}>{s.lastOrder}</div>
              </div>
              <div>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 700 }}>Gastado</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--primary-700)', fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{money(s.spent)}</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <Button variant="secondary" size="sm" style={{ flex: 1 }}>Ver SKUs</Button>
              <Button variant="primary" size="sm" style={{ flex: 1 }}>Nueva orden</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Desktop wrapper ───────────────────────────────────────────────────
function InventoryDesktop() {
  const [tab, setTab] = React.useState('productos');
  const tabs = [
    { key: 'productos',   label: 'Productos',    icon: <Icons.Inventory size={16} />, badge: INVENTORY.length },
    { key: 'movimientos', label: 'Movimientos',  icon: <Icons.TrendUp size={16} />,   badge: MOVEMENTS.length },
    { key: 'proveedores', label: 'Proveedores',  icon: <Icons.Shop size={16} />,      badge: SUPPLIERS.length },
  ];

  return (
    <AppShell currentNav="Inventario" title="Inventario">
      <div style={{ marginBottom: 18 }}>
        <TabNav tabs={tabs} value={tab} onChange={setTab} />
      </div>
      {tab === 'productos' && <InventoryProductsTab />}
      {tab === 'movimientos' && <InventoryMovementsTab />}
      {tab === 'proveedores' && <InventorySuppliersTab />}
    </AppShell>
  );
}

// ─── Mobile view ───────────────────────────────────────────────────────
function InventoryMobile() {
  const [filter, setFilter] = React.useState('Todos');
  const filtered = filter === 'Todos' ? INVENTORY :
                   filter === 'Bajo' ? INVENTORY.filter(i => i.stock > 0 && i.stock < i.min) :
                   filter === 'Sin stock' ? INVENTORY.filter(i => i.stock === 0) :
                   INVENTORY.filter(i => i.category === filter);

  const lowCount = INVENTORY.filter(i => i.stock > 0 && i.stock < i.min).length;
  const outCount = INVENTORY.filter(i => i.stock === 0).length;
  const cats = Array.from(new Set(INVENTORY.map(i => i.category)));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-canvas)' }}>
      <MobileTopbar title="Inventario" eyebrow={`${INVENTORY.length} productos`} onSearch onFilter />

      {/* Alert */}
      {(lowCount + outCount) > 0 && (
        <div style={{ padding: '12px 16px 0' }}>
          <Card padding={12} style={{ background: 'var(--warning-50)', borderColor: 'var(--warning-100)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--warning-600)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icons.Bell />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--warning-700)' }}>{outCount} sin stock · {lowCount} bajo mínimo</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Toca para revisar</div>
              </div>
              <Icons.Chevron style={{ color: 'var(--warning-700)' }}/>
            </div>
          </Card>
        </div>
      )}

      {/* Filter chips */}
      <div style={{ padding: '12px 16px 14px', overflowX: 'auto' }}>
        <div style={{ display: 'flex', gap: 6, whiteSpace: 'nowrap' }}>
          {['Todos','Bajo','Sin stock', ...cats].map(c => {
            const active = c === filter;
            return (
              <button key={c} onClick={() => setFilter(c)} style={{
                height: 30, padding: '0 12px', borderRadius: 999,
                background: active ? 'var(--primary-600)' : 'var(--bg-surface)',
                color: active ? '#fff' : 'var(--text-secondary)',
                border: '1px solid ' + (active ? 'var(--primary-600)' : 'var(--border)'),
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0,
              }}>
                {c === 'Bajo' && <span style={{ width: 5, height: 5, borderRadius: 999, background: active ? '#fff' : 'var(--warning-600)' }}/>}
                {c === 'Sin stock' && <span style={{ width: 5, height: 5, borderRadius: 999, background: active ? '#fff' : 'var(--danger-600)' }}/>}
                {c}
              </button>
            );
          })}
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 16px 80px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(it => {
            const st = stockState(it);
            return (
              <Card key={it.id} padding={14}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{
                    width: 6, alignSelf: 'stretch', borderRadius: 999, background: st.dot, flexShrink: 0,
                  }}/>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{it.name}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>{it.sku}</span>
                          <span style={{ width: 3, height: 3, borderRadius: 999, background: 'var(--text-muted)' }}/>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{it.category}</span>
                        </div>
                      </div>
                      <span style={{
                        padding: '3px 9px', borderRadius: 999,
                        background: st.bg, color: st.color,
                        fontSize: 10.5, fontWeight: 700, whiteSpace: 'nowrap',
                      }}>{st.label}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 3 }}>
                          <span style={{ fontSize: 16, fontWeight: 800, color: st.color, fontVariantNumeric: 'tabular-nums', letterSpacing: '-.01em' }}>{it.stock}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>/ mín {it.min}</span>
                        </div>
                        <div style={{ height: 4, background: 'var(--bg-canvas)', borderRadius: 999, overflow: 'hidden' }}>
                          <div style={{
                            width: `${Math.min(100, (it.stock / Math.max(it.min*2, 1)) * 100)}%`,
                            height: '100%', background: st.dot,
                          }}/>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 700 }}>Precio</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', marginTop: 1 }}>{money(it.price)}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

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

Object.assign(window, { InventoryDesktop, InventoryMobile });
