// app.jsx — wires everything into design canvas + tweaks panel

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "density": "cozy",
  "showCalendarBg": true
}/*EDITMODE-END*/;

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  React.useEffect(() => {
    document.body.dataset.density = t.density;
  }, [t.density]);

  return (
    <React.Fragment>
      <DesignCanvas>
        <DCSection id="overview" title="Cita a detalle · Siliba" subtitle="Dos direcciones, móvil + desktop. Toca un artboard para enfocarlo.">
          <DCArtboard id="a-mobile"  label="A · Móvil — Conservadora pulida"   width={390} height={780} style={{ background: '#0f1715' }}>
            <AMobile />
          </DCArtboard>
          <DCArtboard id="a-desktop" label="A · Desktop — Drawer lateral"      width={1280} height={780} style={{ background: '#f7f7f4' }}>
            <ADesktop />
          </DCArtboard>
          <DCArtboard id="b-mobile"  label="B · Móvil — Atrevida (verde)"      width={390} height={780} style={{ background: '#0f1715' }}>
            <BMobile />
          </DCArtboard>
          <DCArtboard id="b-desktop" label="B · Desktop — Drawer verde"        width={1280} height={780} style={{ background: '#f7f7f4' }}>
            <BDesktop />
          </DCArtboard>
        </DCSection>

        <DCSection id="notes" title="Notas de diseño" subtitle="Decisiones clave para esta exploración">
          <DCArtboard id="design-notes" label="Decisiones" width={520} height={780} style={{ background: '#ffffff' }}>
            <DesignNotes />
          </DCArtboard>
        </DCSection>
      </DesignCanvas>

      <TweaksPanel>
        <TweakSection label="Densidad" />
        <TweakRadio label="Espaciado" value={t.density}
          options={['compact','cozy']}
          onChange={(v) => setTweak('density', v)} />
      </TweaksPanel>
    </React.Fragment>
  );
}

function DesignNotes() {
  const Item = ({ title, body }) => (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-900)', marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 13, color: 'var(--ink-700)', lineHeight: 1.5 }}>{body}</div>
    </div>
  );
  return (
    <div style={{ padding: 28, height: '100%', overflow: 'auto', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--teal-600)' }}>Resumen</div>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink-900)', margin: '4px 0 18px', letterSpacing: '-.01em' }}>Qué cambia y por qué</h2>

      <Item
        title="1 · Jerarquía clara desde el header"
        body="El nombre del cliente sube a título; status, fecha y duración pasan a una fila secundaria con íconos. Antes competían entre sí."
      />
      <Item
        title="2 · Foto + completar fusionados"
        body="Antes había una zona de subir foto y un botón 'Sube foto para completar' que hacían lo mismo. Ahora son un solo bloque destacado: drop zone + CTA primario."
      />
      <Item
        title="3 · Contacto rápido al cliente"
        body="Llamar y WhatsApp como acciones visibles en la card del cliente. En B se vuelven botones de tamaño completo — son la acción más usada cuando algo cambia."
      />
      <Item
        title="4 · Acciones jerarquizadas"
        body="Antes 4 botones del mismo peso. Ahora: una CTA primaria (completar), secundarias en línea (reagendar, agregar) y la destructiva (cancelar) discreta a la derecha."
      />
      <Item
        title="5 · Side drawer en desktop"
        body="Reemplaza el modal centrado que oculta todo el calendario. Mantiene contexto del día visible y permite cerrar con un click fuera."
      />

      <div style={{ marginTop: 24, padding: 16, background: 'var(--teal-50)', borderRadius: 14, border: '1px solid var(--teal-100)' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--teal-700)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Diferencia A vs B</div>
        <div style={{ fontSize: 13, color: 'var(--ink-700)', marginTop: 6, lineHeight: 1.5 }}>
          <b>A</b> mantiene el lenguaje actual con disciplina visual. Es la apuesta segura para hacer hoy.
          <br /><br />
          <b>B</b> introduce un header verde con timeline del estado, contacto del cliente como acción principal y una drop zone gigante. Más memorable, requiere más componentes nuevos.
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
