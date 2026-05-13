// screens-app.jsx — wires every screen into the design canvas + tweaks

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "darkMode": false
}/*EDITMODE-END*/;

function ScreensApp() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  React.useEffect(() => {
    document.documentElement.dataset.theme = t.darkMode ? 'dark' : 'light';
  }, [t.darkMode]);

  return (
    <React.Fragment>
      <DesignCanvas>
        <DCSection id="dashboard" title="01 · Dashboard / Inicio" subtitle="Admin web (desktop) y empleado (móvil).">
          <DCArtboard id="dash-desktop" label="Admin · Dashboard"   width={1280} height={820} style={{ background: 'var(--bg-canvas)' }}>
            <DashboardDesktop />
          </DCArtboard>
          <DCArtboard id="dash-mobile"  label="Empleado · Mi día"   width={390}  height={820} style={{ background: 'var(--bg-canvas)' }}>
            <DashboardMobile />
          </DCArtboard>
        </DCSection>

        <DCSection id="calendar" title="02 · Calendario de citas" subtitle="Vista de día por empleado en desktop; lista cronológica en móvil con la línea AHORA.">
          <DCArtboard id="cal-desktop" label="Admin · Día (por empleado)" width={1280} height={820} style={{ background: 'var(--bg-canvas)' }}>
            <CalendarDesktop />
          </DCArtboard>
          <DCArtboard id="cal-mobile"  label="Empleado · Día"             width={390}  height={820} style={{ background: 'var(--bg-canvas)' }}>
            <CalendarMobile />
          </DCArtboard>
        </DCSection>

        <DCSection id="staff" title="03 · Personal" subtitle="Grid de cards en admin; perfil propio en móvil para empleado.">
          <DCArtboard id="staff-desktop" label="Admin · Personal"          width={1280} height={820} style={{ background: 'var(--bg-canvas)' }}>
            <StaffDesktop />
          </DCArtboard>
          <DCArtboard id="staff-mobile"  label="Empleado · Mi perfil"      width={390}  height={820} style={{ background: 'var(--bg-canvas)' }}>
            <StaffMobile />
          </DCArtboard>
        </DCSection>

        <DCSection id="reports" title="04 · Reportes" subtitle="Dashboard analítico para admin; resumen compacto en móvil.">
          <DCArtboard id="reports-desktop" label="Admin · Reportes"        width={1280} height={820} style={{ background: 'var(--bg-canvas)' }}>
            <ReportsDesktop />
          </DCArtboard>
          <DCArtboard id="reports-mobile"  label="Móvil · Resumen semana"  width={390}  height={820} style={{ background: 'var(--bg-canvas)' }}>
            <ReportsMobile />
          </DCArtboard>
        </DCSection>

        <DCSection id="services" title="05 · Servicios" subtitle="Catálogo de servicios — tabs Lista / Categorías / Paquetes.">
          <DCArtboard id="services-desktop" label="Admin · Servicios"      width={1280} height={820} style={{ background: 'var(--bg-canvas)' }}>
            <ServicesDesktop />
          </DCArtboard>
          <DCArtboard id="services-mobile"  label="Móvil · Catálogo"       width={390}  height={820} style={{ background: 'var(--bg-canvas)' }}>
            <ServicesMobile />
          </DCArtboard>
        </DCSection>

        <DCSection id="inventory" title="06 · Inventario" subtitle="Productos, movimientos y proveedores con alertas de stock.">
          <DCArtboard id="inventory-desktop" label="Admin · Inventario"     width={1280} height={820} style={{ background: 'var(--bg-canvas)' }}>
            <InventoryDesktop />
          </DCArtboard>
          <DCArtboard id="inventory-mobile"  label="Móvil · Stock"           width={390}  height={820} style={{ background: 'var(--bg-canvas)' }}>
            <InventoryMobile />
          </DCArtboard>
        </DCSection>

        <DCSection id="notes" title="Notas de aplicación" subtitle="Cambios sugeridos por pantalla, alineados al sistema.">
          <DCArtboard id="notes" label="Notas de diseño" width={560} height={820} style={{ background: '#fff' }}>
            <DesignNotes />
          </DCArtboard>
        </DCSection>
      </DesignCanvas>

      <TweaksPanel>
        <TweakSection label="Apariencia" />
        <TweakToggle label="Modo oscuro" value={t.darkMode} onChange={(v) => setTweak('darkMode', v)} />
      </TweaksPanel>
    </React.Fragment>
  );
}

function DesignNotes() {
  const N = ({ n, title, body }) => (
    <div style={{ display: 'flex', gap: 14, marginBottom: 18 }}>
      <div style={{ width: 28, height: 28, borderRadius: 999, background: 'var(--primary-600)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12.5, flexShrink: 0 }}>{n}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{body}</div>
      </div>
    </div>
  );
  return (
    <div style={{ padding: 28, height: '100%', overflow: 'auto', fontFamily: 'Inter' }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--primary-600)' }}>Resumen</div>
      <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', margin: '4px 0 18px', letterSpacing: '-.015em' }}>Qué cambia en cada pantalla</h2>

      <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-muted)', marginBottom: 10 }}>Dashboard</div>
      <N n="1" title="KPI cards consistentes" body="Reemplazar el actual con el nuevo (icono 44×44 en primary-50, número 22/800)." />
      <N n="2" title="Alerts panel con acción" body="El panel de alertas debe sugerir UNA acción concreta. Hoy solo informa. Botón inline a la derecha." />
      <N n="3" title="Sección 'Personal en agenda'" body="Reemplaza la card actual de employees-today con avatares más grandes (36) y conteo a la derecha." />

      <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-muted)', marginTop: 24, marginBottom: 10 }}>Calendario</div>
      <N n="1" title="Vista por empleado" body="Columnas por empleado. Citas con barra lateral del color del estado (no del empleado — el empleado está en el header de la columna)." />
      <N n="2" title="Línea AHORA visible" body="Línea horizontal danger-600 con etiqueta de hora. Falta en el calendario actual." />
      <N n="3" title="Móvil = lista vertical" body="Grid no funciona en móvil. Lista cronológica con la cita pasada en opacity 55%." />

      <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-muted)', marginTop: 24, marginBottom: 10 }}>Personal</div>
      <N n="1" title="Cards con cover de color" body="El campo 'color' del backend se usa como banner superior. Identifica al empleado de un vistazo." />
      <N n="2" title="Stats inline" body="Hoy / Semana / Rating debajo de servicios. Reemplaza el detalle separado que tenías." />
      <N n="3" title="Vista 'Mi perfil' móvil" body="Header verde tipo hero. Stats grandes, portfolio en grid 3×N, agenda semanal con barras." />

      <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-muted)', marginTop: 24, marginBottom: 10 }}>Reportes</div>
      <N n="1" title="Hero KPI con tendencia" body="Cada KPI con su delta vs período anterior. Sin delta = falta de contexto." />
      <N n="2" title="Donut + lista" body="Citas por estado: donut a la izquierda, leyenda con totales a la derecha." />
      <N n="3" title="Móvil hero más grande" body="En móvil, el número principal pasa a 36px. El resto es secundario." />

      <div style={{ marginTop: 24, padding: 16, background: 'var(--primary-50)', borderRadius: 14, border: '1px solid var(--primary-200)' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary-700)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Modo oscuro</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.55 }}>
          Activa el toggle de Tweaks (esquina inferior derecha) para ver todas las pantallas en oscuro. Implementación: <code style={{ background:'#fff', padding:'1px 6px', borderRadius:4, fontSize:12, color:'var(--primary-700)' }}>data-theme="dark"</code> en <code style={{ background:'#fff', padding:'1px 6px', borderRadius:4, fontSize:12, color:'var(--primary-700)' }}>&lt;html&gt;</code> + variables CSS. Sin duplicar clases.
        </div>
      </div>

      <div style={{ marginTop: 20, padding: 16, background: 'var(--bg-canvas)', borderRadius: 14, border: '1px solid var(--border)' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Siguiente paso</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.55 }}>
          Abre <b>design-system.html</b> para ver tokens + componentes + las instrucciones específicas para Claude Code (qué archivos editar y qué cambiar).
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<ScreensApp />);
