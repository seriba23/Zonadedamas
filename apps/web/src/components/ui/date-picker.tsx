'use client';
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ date-picker.tsx                                                         │
// │                                                                         │
// │ ¿QUÉ HACE ESTE COMPONENTE?                                              │
// │ Campo de fecha con dos modos de entrada:                                │
// │  1. TEXTO: el usuario puede escribir la fecha directamente en formato   │
// │     dd/mm/aaaa con máscara automática (los "/" se insertan solos)       │
// │  2. CALENDARIO visual: al presionar el ícono de calendario, se abre un  │
// │     modal con una grilla de días, con navegación por meses y años.      │
// │                                                                         │
// │ El calendario tiene 3 "vistas" que cambian al hacer click en el título: │
// │  - Vista de días: la cuadrícula de días del mes (7 columnas)           │
// │  - Vista de meses: los 12 meses del año (3 columnas)                   │
// │  - Vista de años: grupos de 12 años con paginación                     │
// │                                                                         │
// │ RESTRICCIÓN: No permite seleccionar fechas futuras (maxDate = hoy).     │
// │                                                                         │
// │ El valor siempre se almacena en formato ISO "YYYY-MM-DD" (estándar     │
// │ para bases de datos), pero se MUESTRA como "dd/mm/aaaa" al usuario.   │
// └─────────────────────────────────────────────────────────────────────────┘

// Hooks de React
import { useState, useRef, useEffect, useCallback } from 'react';

// ─── COLORES DE LA IDENTIDAD VISUAL ──────────────────────────────────────────
const TEAL = '#008080';
const TEAL_LIGHT = '#e0f2f1';

// ─── DATOS ESTÁTICOS DEL CALENDARIO ──────────────────────────────────────────
// Nombres completos de los 12 meses (para el encabezado del calendario)
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

// Nombres cortos de los 12 meses (para la vista de selección de mes)
const MESES_CORTOS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

// Abreviaturas de los días de la semana (comenzando en lunes, como en México)
const DIAS_SEMANA = ['Lu','Ma','Mi','Ju','Vi','Sá','Do'];

// ─── INTERFAZ DE PROPS ───────────────────────────────────────────────────────
interface DatePickerProps {
  value: string;                    // Fecha actual en formato "YYYY-MM-DD" (o cadena vacía)
  onChange: (value: string) => void; // Callback para notificar la fecha seleccionada
  placeholder?: string;             // Texto de ayuda (default: 'dd/mm/aaaa')
  maxDate?: Date;                   // Fecha máxima seleccionable (default: hoy)
  className?: string;               // Clases CSS adicionales
}

// ─── TIPO: Vista del calendario ───────────────────────────────────────────────
// El calendario puede estar en uno de tres modos (vistas)
type Vista = 'dias' | 'meses' | 'anios';

// ─── COMPONENTE PRINCIPAL ────────────────────────────────────────────────────
export function DatePicker({ value, onChange, placeholder = 'dd/mm/aaaa', maxDate, className }: DatePickerProps) {

  // ─── ESTADO LOCAL ─────────────────────────────────────────────────────────

  // open: controla si el panel del calendario está visible
  const [open, setOpen] = useState(false);

  // vista: cuál de las 3 vistas del calendario se muestra
  const [vista, setVista] = useState<Vista>('dias');

  // anio: año actualmente mostrado en el calendario (no necesariamente el seleccionado)
  // Se inicializa con el año actual usando una "función lazy de useState":
  // () => new Date().getFullYear() → se ejecuta solo una vez al montar
  const [anio, setAnio] = useState(() => new Date().getFullYear());

  // mes: mes actualmente mostrado (0 = enero, 11 = diciembre)
  const [mes, setMes] = useState(() => new Date().getMonth());

  // aniosPagInicio: el primer año visible en la vista de años (paginación de 12 en 12)
  const [aniosPagInicio, setAniosPagInicio] = useState(0);

  // inputText: lo que se muestra en el campo de texto (formato dd/mm/aaaa)
  const [inputText, setInputText] = useState('');

  // containerRef: referencia al div contenedor (no se usa para click-outside en este componente;
  // el calendario se cierra con el overlay oscuro)
  const containerRef = useRef<HTMLDivElement>(null);

  // ─── FECHA MÁXIMA ─────────────────────────────────────────────────────────
  // Si no se pasa maxDate, usamos hoy como límite (no se pueden seleccionar fechas futuras)
  const max = maxDate || new Date();
  const maxAnio = max.getFullYear();
  const maxMes = max.getMonth();
  const maxDia = max.getDate();

  // ─── EFECTO 1: Sincronizar el texto del input con la prop "value" ─────────
  // Cuando el padre cambia el valor (ej. resetea el formulario), actualizamos el texto.
  useEffect(() => {
    if (value) {
      // value viene como "1990-01-15" → lo mostramos como "15/01/1990"
      const [y, m, d] = value.split('-'); // Separamos por guión
      if (y && m && d) setInputText(`${d}/${m}/${y}`); // Reordenamos al formato visual
    } else {
      setInputText(''); // Si no hay valor, el campo queda vacío
    }
  }, [value]); // Se ejecuta cada vez que value cambia

  // ─── EFECTO 2: Inicializar la posición del calendario desde el valor ───────
  // Al montar, si ya hay una fecha seleccionada, el calendario debe mostrarse
  // en ese mes y año (no en el mes actual).
  useEffect(() => {
    if (value) {
      // .map(Number) convierte cada string a número: ["1990", "01"] → [1990, 1]
      const [y, m] = value.split('-').map(Number);
      if (y && m) { setAnio(y); setMes(m - 1); } // m-1 porque getMonth() es 0-indexado
    }
  }, []); // Solo al montar ([] sin dependencias)

  // ─── EFECTO 3: Bloquear scroll mientras el calendario está abierto ─────────
  useEffect(() => {
    if (!open) return; // Solo si el calendario está abierto

    const prev = document.body.style.overflow; // Guardamos el valor anterior
    document.body.style.overflow = 'hidden';   // Bloqueamos el scroll

    // Cerrar con tecla ESC (accesibilidad)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);

    return () => {
      document.body.style.overflow = prev; // Restauramos el scroll
      document.removeEventListener('keydown', onKey);
    };
  }, [open]); // Se ejecuta cuando "open" cambia

  // ─── VALORES DERIVADOS: fecha seleccionada ────────────────────────────────
  // Extraemos día, mes y año de la prop "value" para saber qué celda marcar como seleccionada.
  // parseInt(str, 10): convierte string a entero en base 10
  // Si no hay valor, usamos -1 como sentinela (ningún día coincide con -1)
  const selDia = value ? parseInt(value.split('-')[2], 10) : -1;
  const selMes = value ? parseInt(value.split('-')[1], 10) - 1 : -1; // -1 por ser 0-indexado
  const selAnio = value ? parseInt(value.split('-')[0], 10) : -1;

  // ─── VALORES DERIVADOS: fecha de hoy ─────────────────────────────────────
  // Para resaltar el día/mes/año de hoy en el calendario
  const hoy = new Date();
  const hoyDia = hoy.getDate();
  const hoyMes = hoy.getMonth();
  const hoyAnio = hoy.getFullYear();

  // ─── FUNCIÓN: handleInputChange (máscara de fecha) ────────────────────────
  // Se llama en cada tecla que el usuario presiona en el campo de texto.
  // Aplica una "máscara" que formatea automáticamente como dd/mm/aaaa.
  const handleInputChange = (raw: string) => {
    // Eliminamos todo lo que no sea dígito (letras, barras, guiones, etc.)
    let v = raw.replace(/\D/g, '');

    // Limitamos a 8 dígitos (dd mm aaaa = 2+2+4 = 8)
    if (v.length > 8) v = v.substring(0, 8);

    // Insertamos las barras "/" automáticamente en las posiciones correctas
    if (v.length >= 5) {
      // "ddmmaaaa" → "dd/mm/aaaa"
      v = v.substring(0, 2) + '/' + v.substring(2, 4) + '/' + v.substring(4);
    } else if (v.length >= 3) {
      // "ddmm" → "dd/mm"
      v = v.substring(0, 2) + '/' + v.substring(2);
    }

    setInputText(v); // Actualizamos el texto del campo

    // Si ya tenemos los 10 caracteres (dd/mm/aaaa), intentamos parsear la fecha
    if (v.length === 10) {
      const [dd, mm, yyyy] = v.split('/'); // Separamos por "/"
      const d = parseInt(dd, 10), m = parseInt(mm, 10), y = parseInt(yyyy, 10);

      // Validamos rangos básicos
      if (d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 1900 && y <= maxAnio) {
        // Construimos el formato ISO para el backend: "1990-01-15"
        // .padStart(2, '0'): si dd es "5", lo convierte a "05"
        const iso = `${yyyy}-${mm}-${dd}`;
        onChange(iso); // Notificamos al padre
        setAnio(y); setMes(m - 1); // Movemos el calendario al mes de la fecha escrita
      }
    }
  };

  // ─── FUNCIÓN: selectDay ───────────────────────────────────────────────────
  // Se llama cuando el usuario hace click en un día del calendario.
  // d: día (número), m: mes (0-indexado), y: año
  const selectDay = (d: number, m: number, y: number) => {
    // padStart(2, '0'): garantiza formato de 2 dígitos (ej. "1" → "01")
    const dd = String(d).padStart(2, '0');
    const mm = String(m + 1).padStart(2, '0'); // +1 porque nuestros meses son 0-indexados
    onChange(`${y}-${mm}-${dd}`); // Formato ISO al padre
    setOpen(false); // Cerramos el calendario
  };

  // ─── FUNCIONES DE NAVEGACIÓN del calendario ────────────────────────────────
  // navPrev: retrocede según la vista actual (año anterior, mes anterior, página de años)
  const navPrev = () => {
    if (vista === 'anios') {
      setAniosPagInicio((p) => p - 12); // Página anterior de años
    } else if (vista === 'meses') {
      setAnio((a) => a - 1); // Año anterior
    } else {
      // Vista de días: retrocedemos un mes
      if (mes === 0) { setMes(11); setAnio((a) => a - 1); } // Enero → Diciembre del año anterior
      else setMes((m) => m - 1);
    }
  };

  // navNext: avanza según la vista actual
  const navNext = () => {
    if (vista === 'anios') {
      // Solo avanzamos si la siguiente página no se pasa del año máximo
      if (aniosPagInicio + 12 <= maxAnio) setAniosPagInicio((p) => p + 12);
    } else if (vista === 'meses') {
      if (anio < maxAnio) setAnio((a) => a + 1);
    } else {
      // Vista de días: avanzamos un mes
      if (mes === 11) { setMes(0); setAnio((a) => a + 1); } // Diciembre → Enero del año siguiente
      else setMes((m) => m + 1);
    }
  };

  // showNextArrow: controla si la flecha "siguiente" está visible
  // No la mostramos si ya llegamos al límite (maxAnio)
  const showNextArrow = vista === 'anios'
    ? aniosPagInicio + 11 < maxAnio
    : vista === 'meses'
      ? anio < maxAnio
      : true; // En vista de días siempre se muestra (el límite lo controlan los botones deshabilitados)

  // ─── FUNCIÓN: toggleOpen ─────────────────────────────────────────────────
  // Abre o cierra el calendario. Al abrir, resetea la vista y posiciona
  // el calendario en la fecha actualmente seleccionada.
  const toggleOpen = () => {
    if (!open) {
      setVista('dias'); // Siempre abrimos en la vista de días
      if (value) {
        // Si ya hay fecha, mostramos ese mes y año
        const [y, m] = value.split('-').map(Number);
        setAnio(y); setMes(m - 1);
      }
    }
    setOpen(!open); // Alternamos entre abierto/cerrado
  };

  // ─── MANEJADORES: click en el título del calendario ───────────────────────
  // Al hacer click en el mes del título, vamos a la vista de meses
  const clickMes = () => {
    setVista('meses');
  };

  // Al hacer click en el año del título, vamos a la vista de años
  // y la centramos en el año actual ± 5 (para que el año actual esté visible)
  const clickAnio = () => {
    setAniosPagInicio(anio - 5); // El año actual queda en la 6ª posición de 12
    setVista('anios');
  };

  // ─── FUNCIÓN: renderDias ──────────────────────────────────────────────────
  // Genera el array de celdas <button> para la vista de días del mes.
  // Incluye los días del mes anterior y siguiente para completar las filas de 7.
  const renderDias = () => {
    // Primer día del mes actual (para saber en qué columna empieza)
    const primerDia = new Date(anio, mes, 1);

    // Cuántos días tiene el mes actual (ej. 31 para enero, 28 o 29 para febrero)
    const diasEnMes = new Date(anio, mes + 1, 0).getDate(); // El día "0" del mes siguiente

    // Día de la semana del primer día (0=Domingo, 1=Lunes, ..., 6=Sábado)
    let diaInicio = primerDia.getDay() - 1; // -1 porque queremos Lunes como primer día
    if (diaInicio < 0) diaInicio = 6; // Si era Domingo (0), ahora es el 7º día (índice 6)

    // Array donde acumulamos los elementos JSX de la cuadrícula
    const cells: JSX.Element[] = [];

    // ── Días del mes ANTERIOR (para llenar las celdas vacías al inicio) ─────
    const prevUltimo = new Date(anio, mes, 0).getDate(); // Último día del mes anterior
    for (let i = diaInicio - 1; i >= 0; i--) {
      const d = prevUltimo - i; // Calculamos qué día del mes anterior mostrar
      const mPrev = mes === 0 ? 11 : mes - 1; // Mes anterior (con wrap: enero → diciembre)
      const aPrev = mes === 0 ? anio - 1 : anio; // Año anterior si es enero
      cells.push(
        <button key={`p${d}`} type="button" className="zdp-cell zdp-other" onClick={() => selectDay(d, mPrev, aPrev)}>
          {d}
          {/* "zdp-other" → estilo gris claro para días de otro mes */}
        </button>
      );
    }

    // ── Días del mes ACTUAL ────────────────────────────────────────────────
    for (let d = 1; d <= diasEnMes; d++) {
      // Calculamos si este día debe tener clase especial
      const isHoy = d === hoyDia && mes === hoyMes && anio === hoyAnio; // Es el día de hoy?
      const isSel = d === selDia && mes === selMes && anio === selAnio; // Es el día seleccionado?

      // ¿Es una fecha futura? Se prohíbe seleccionarla.
      const isFuture = anio > maxAnio ||
        (anio === maxAnio && mes > maxMes) ||
        (anio === maxAnio && mes === maxMes && d > maxDia);

      cells.push(
        <button
          key={d} // key única (el número del día es único dentro del mes)
          type="button"
          disabled={isFuture} // disabled=true → no se puede clickear
          // Construimos la clase CSS combinando clases condicionales
          // zdp-today → borde teal  |  zdp-selected → fondo teal  |  zdp-disabled → gris
          className={`zdp-cell ${isHoy ? 'zdp-today' : ''} ${isSel ? 'zdp-selected' : ''} ${isFuture ? 'zdp-disabled' : ''}`}
          onClick={() => selectDay(d, mes, anio)}
        >
          {d}
        </button>
      );
    }

    // ── Días del mes SIGUIENTE (para completar la última fila) ────────────
    const total = diaInicio + diasEnMes; // Total de celdas ocupadas hasta ahora
    // Si total es múltiplo de 7, la última fila está completa y no necesitamos más
    const rest = total % 7 === 0 ? 0 : 7 - (total % 7);
    for (let d = 1; d <= rest; d++) {
      const mNext = mes === 11 ? 0 : mes + 1; // Mes siguiente (con wrap: diciembre → enero)
      const aNext = mes === 11 ? anio + 1 : anio;
      cells.push(
        <button key={`n${d}`} type="button" className="zdp-cell zdp-other" onClick={() => selectDay(d, mNext, aNext)}>
          {d}
        </button>
      );
    }

    return cells; // Array de <button> que React renderizará en el grid
  };

  // ─── FUNCIÓN: renderMeses ─────────────────────────────────────────────────
  // Genera los 12 botones de meses para la vista de selección de mes.
  const renderMeses = () => {
    // .map((label, m) => ...) → label es el texto (ej. "Ene"), m es el índice 0-11
    return MESES_CORTOS.map((label, m) => {
      const isSel = m === mes;                         // ¿Es el mes actualmente visible?
      const isHoy = m === hoyMes && anio === hoyAnio; // ¿Es el mes actual?
      const isFuture = anio === maxAnio && m > maxMes; // ¿Mes futuro en el año máximo?

      return (
        <button
          key={m} // El índice del mes como clave única
          type="button"
          disabled={isFuture}
          className={`zdp-grid-item ${isSel ? 'zdp-selected' : ''} ${isHoy ? 'zdp-today' : ''} ${isFuture ? 'zdp-disabled' : ''}`}
          // Al clickear: guardamos el mes y volvemos a la vista de días
          onClick={() => { setMes(m); setVista('dias'); }}
        >
          {label}
        </button>
      );
    });
  };

  // ─── FUNCIÓN: renderAnios ────────────────────────────────────────────────
  // Genera los 12 botones de años para la vista de selección de año.
  const renderAnios = () => {
    const items: JSX.Element[] = [];

    // Mostramos 12 años comenzando desde aniosPagInicio
    for (let a = aniosPagInicio; a <= aniosPagInicio + 11; a++) {
      const isSel = a === anio;     // ¿Es el año actualmente visible en el calendario?
      const isHoy = a === hoyAnio; // ¿Es el año actual?
      const isFuture = a > maxAnio; // ¿Año en el futuro?

      items.push(
        <button
          key={a}
          type="button"
          disabled={isFuture}
          className={`zdp-grid-item ${isSel ? 'zdp-selected' : ''} ${isHoy ? 'zdp-today' : ''} ${isFuture ? 'zdp-disabled' : ''}`}
          // Al clickear: guardamos el año y vamos a vista de meses
          onClick={() => { setAnio(a); setVista('meses'); }}
        >
          {a}
        </button>
      );
    }
    return items;
  };

  // ─── TEXTOS DEL ENCABEZADO DEL CALENDARIO ────────────────────────────────
  // Cada vista muestra un texto diferente en el centro del encabezado
  const tituloMes = vista === 'dias' ? MESES[mes] : vista === 'meses' ? '' : '';
  const tituloAnio = vista === 'dias' ? anio : vista === 'meses' ? anio : '';
  // En vista de años mostramos el rango (ej. "2010 - 2021")
  const tituloRango = vista === 'anios' ? `${aniosPagInicio} - ${Math.min(aniosPagInicio + 11, maxAnio)}` : '';

  // ─── JSX PRINCIPAL ────────────────────────────────────────────────────────
  return (
    <div ref={containerRef} className="relative">
      {/* Input de texto + botón del ícono de calendario */}
      <div className="relative">
        <input
          type="text"
          value={inputText}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder={placeholder} // "dd/mm/aaaa" por defecto
          maxLength={10}  // "dd/mm/aaaa" tiene exactamente 10 caracteres
          className={`w-full px-3 py-2.5 pr-10 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:outline-none ${className || ''}`}
          style={{ '--tw-ring-color': TEAL } as any}
        />
        {/* Botón del ícono de calendario (abre/cierra el panel) */}
        <button
          type="button"
          onClick={toggleOpen}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-gray-400 hover:text-[#008080] hover:bg-[#e0f2f1] transition-colors"
          // -translate-y-1/2: centra verticalmente el botón dentro del input
        >
          {/* SVG del ícono de calendario */}
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
        </button>
      </div>

      {/* Modal del calendario */}
      {/* El operador && solo renderiza el bloque si "open" es true */}
      {open && (
        // Overlay oscuro: al hacer click fuera del panel, cerramos
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40"
          onClick={() => setOpen(false)} // Click en el overlay cierra el calendario
          role="dialog"
          aria-modal="true" // Accesibilidad: indica que es un diálogo modal
        >
        {/* Panel blanco del calendario */}
        <div
          className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 w-[280px] max-w-full"
          onClick={(e) => e.stopPropagation()} // No propagamos el click al overlay
        >
          {/* Encabezado: flechas de navegación + título central */}
          <div className="flex items-center justify-between mb-2.5">
            {/* Flecha izquierda: retrocede */}
            <button type="button" onClick={navPrev} className="px-2 py-1 rounded text-lg font-bold hover:bg-[#e0f2f1] transition-colors" style={{ color: TEAL }}>
              ‹
              {/* "‹" es la entidad HTML del carácter "‹" (flecha simple izquierda) */}
            </button>

            {/* Título central: clicable para cambiar la vista */}
            <span className="text-sm font-extrabold text-gray-900">
              {/* Ternario anidado: si hay rango de años, lo mostramos; si no, mes y año */}
              {tituloRango || (
                <>
                  {/* Fragmento de React: agrupa elementos sin añadir un div al DOM */}
                  {/* Clicar en el mes → vista de meses */}
                  <span className="cursor-pointer border-b border-dashed border-gray-400 hover:text-[#008080] hover:border-[#008080] transition-colors" onClick={clickMes}>
                    {tituloMes}
                  </span>
                  {tituloMes && ' '}
                  {/* Clicar en el año → vista de años */}
                  <span className="cursor-pointer border-b border-dashed border-gray-400 hover:text-[#008080] hover:border-[#008080] transition-colors" onClick={clickAnio}>
                    {tituloAnio}
                  </span>
                </>
              )}
            </span>

            {/* Flecha derecha: avanza. Se oculta cuando llegamos al límite */}
            <button
              type="button"
              onClick={navNext}
              className="px-2 py-1 rounded text-lg font-bold hover:bg-[#e0f2f1] transition-colors"
              style={{ color: TEAL, visibility: showNextArrow ? 'visible' : 'hidden' }}
              // visibility: 'hidden' oculta el botón pero mantiene su espacio (vs display:none)
            >
              ›
            </button>
          </div>

          {/* Vista de DÍAS */}
          {/* El operador && renderiza este bloque solo si vista === 'dias' */}
          {vista === 'dias' && (
            <>
              {/* Cabecera de la cuadrícula: Lu Ma Mi Ju Vi Sá Do */}
              <div className="grid grid-cols-7 text-center text-[11px] font-bold text-gray-400 mb-1">
                {/* .map() genera un <span> por cada día de la semana */}
                {DIAS_SEMANA.map((d) => <span key={d}>{d}</span>)}
              </div>
              {/* Cuadrícula de días: 7 columnas, gap pequeño */}
              <div className="grid grid-cols-7 gap-0.5">
                {renderDias()}
                {/* renderDias() devuelve el array de <button> generado arriba */}
              </div>
            </>
          )}

          {/* Vista de MESES */}
          {vista === 'meses' && (
            <div className="grid grid-cols-3 gap-1">
              {renderMeses()}
              {/* renderMeses() devuelve 12 botones de meses */}
            </div>
          )}

          {/* Vista de AÑOS */}
          {vista === 'anios' && (
            <div className="grid grid-cols-3 gap-1">
              {renderAnios()}
              {/* renderAnios() devuelve 12 botones de años */}
            </div>
          )}

          {/* Footer: solo en vista de días */}
          {vista === 'dias' && (
            <div className="flex justify-between mt-2 pt-2 border-t border-gray-100">
              {/* Botón "Hoy": selecciona la fecha de hoy rápidamente */}
              <button
                type="button"
                className="text-xs font-bold px-2.5 py-1 rounded hover:bg-[#e0f2f1] transition-colors"
                style={{ color: TEAL }}
                onClick={() => selectDay(hoyDia, hoyMes, hoyAnio)}
              >
                Hoy
              </button>
              {/* Botón "Limpiar": borra la fecha seleccionada */}
              <button
                type="button"
                className="text-xs font-bold text-gray-400 px-2.5 py-1 rounded hover:bg-gray-100 transition-colors"
                onClick={() => { onChange(''); setOpen(false); }}
                // onChange(''): le decimos al padre que el valor es vacío
              >
                Limpiar
              </button>
            </div>
          )}
        </div>
        </div>
      )}

      {/* Estilos CSS del componente inyectados como <style> */}
      {/* eslint-disable-next-line react/no-danger */}
      {/* dangerouslySetInnerHTML: React normalmente escapa el HTML por seguridad.
          Aquí lo usamos deliberadamente para inyectar CSS. No es peligroso porque
          nosotros controlamos totalmente el contenido (no viene del usuario). */}
      <style dangerouslySetInnerHTML={{ __html: `
        .zdp-cell {
          aspect-ratio: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          font-size: 13px;
          cursor: pointer;
          border: none;
          background: none;
          transition: all 0.12s;
        }
        .zdp-cell:hover:not(.zdp-disabled):not(.zdp-selected) { background: rgba(0,128,128,.1); }
        .zdp-today { border: 2px solid ${TEAL}; font-weight: 700; }
        .zdp-selected { background: ${TEAL} !important; color: #fff !important; font-weight: 700; }
        .zdp-other { color: #cbd5e1; }
        .zdp-other:hover:not(.zdp-disabled) { color: #94a3b8; background: rgba(0,128,128,.06); }
        .zdp-disabled { color: #cbd5e1; cursor: not-allowed; }
        .zdp-grid-item {
          padding: 10px 4px;
          border: none;
          background: none;
          border-radius: 6px;
          font-size: 14px;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.12s;
        }
        .zdp-grid-item:hover:not(.zdp-disabled):not(.zdp-selected) { background: rgba(0,128,128,.1); }
        .zdp-grid-item.zdp-today { border: 2px solid ${TEAL}; font-weight: 700; }
        .zdp-grid-item.zdp-selected { background: ${TEAL}; color: #fff; font-weight: 700; }
        .zdp-grid-item.zdp-disabled { color: #cbd5e1; cursor: not-allowed; }
      `}} />
    </div>
  );
}
