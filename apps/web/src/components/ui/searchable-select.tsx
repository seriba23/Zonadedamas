// Componente de cliente: usa hooks, manipula el DOM y escucha eventos de ventana.
'use client';

// Importamos tres hooks de React:
// - useState: variable de estado reactiva (cuando cambia → re-render).
// - useRef: referencia persistente a un elemento del DOM.
// - useEffect: ejecuta código después del render (efectos secundarios).
import { useState, useRef, useEffect } from 'react';

// createPortal: función de React que renderiza JSX en un nodo DOM diferente
// al componente que lo genera. Aquí lo usamos para renderizar el dropdown
// directamente en document.body, evitando que quede "atrapado" dentro de
// contenedores con overflow:hidden o z-index bajo.
import { createPortal } from 'react-dom';

// URL base del servidor (para construir URLs absolutas de imágenes de avatar).
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// ─── Interfaz de cada opción del select ─────────────────────────────────────
// "export interface" permite que otros archivos importen este tipo y lo usen
// para tipar sus propias variables.
export interface SelectOption {
  id: string;              // identificador único (se envía al padre cuando se selecciona)
  label: string;           // texto principal que se muestra en la lista
  sublabel?: string;       // texto secundario opcional (ej. nombre del rol)
  avatarUrl?: string | null; // URL de la foto de perfil (opcional)
  color?: string;          // color de fondo del círculo de iniciales (ej. "#008080")
  initials?: string;       // iniciales precomputadas (si no se pasan, se calculan del label)
}

// ─── Props del componente ────────────────────────────────────────────────────
interface SearchableSelectProps {
  // ID de la opción actualmente seleccionada (string vacío = "Todos" / sin selección).
  value: string;

  // Función del padre que recibe el ID de la opción elegida.
  onChange: (value: string) => void;

  // Array de opciones disponibles para mostrar en la lista.
  options: SelectOption[];

  // Placeholder del input de búsqueda. Por defecto: 'Buscar...'.
  placeholder?: string;

  // Texto de la opción "sin filtro". Por defecto: 'Todos'.
  allLabel?: string;
}

// ─── Componente principal exportado ─────────────────────────────────────────
export function SearchableSelect({ value, onChange, options, placeholder = 'Buscar...', allLabel = 'Todos' }: SearchableSelectProps) {
  // Estado "open": si el dropdown está abierto o cerrado.
  const [open, setOpen] = useState(false);

  // Estado "search": texto que el usuario escribe en el campo de búsqueda
  // dentro del dropdown.
  const [search, setSearch] = useState('');

  // Estado "coords": posición y dimensiones calculadas del dropdown en la pantalla.
  // Es null cuando el dropdown está cerrado (no necesitamos las coordenadas).
  // "openUp": si true, el dropdown se abre hacia ARRIBA (porque no hay espacio abajo).
  const [coords, setCoords] = useState<{ top: number; left: number; width: number; openUp: boolean } | null>(null);

  // Referencia al botón del select (el "trigger" que abre/cierra el dropdown).
  // La usamos para calcular su posición en la pantalla con getBoundingClientRect().
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Referencia al div del dropdown (el menú desplegable).
  // La usamos para detectar clicks DENTRO del dropdown (no cierran el menú).
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Calcula coords cuando abre. Si no hay espacio abajo, abre hacia arriba.
  // useEffect con dependencia [open]: se ejecuta cada vez que "open" cambia.
  useEffect(() => {
    // Si el dropdown se acaba de cerrar, borramos las coordenadas.
    if (!open || !buttonRef.current) {
      setCoords(null);
      return;
    }

    // Función que calcula y guarda las coordenadas del dropdown.
    function update() {
      if (!buttonRef.current) return;

      // getBoundingClientRect() devuelve las dimensiones y posición del elemento
      // relativas al viewport (la ventana visible del navegador).
      // rect.top, rect.bottom, rect.left, rect.width son los valores en píxeles.
      const rect = buttonRef.current.getBoundingClientRect();

      // Altura estimada del dropdown (en píxeles).
      const dropdownH = 320;

      // Espacio disponible debajo del botón hasta el borde de la ventana.
      const spaceBelow = window.innerHeight - rect.bottom;

      // Si no cabe abajo Y sí cabe arriba, abrimos hacia arriba.
      const openUp = spaceBelow < dropdownH && rect.top > dropdownH;

      setCoords({
        // Si abre arriba: top = posición del botón - altura del dropdown - margen.
        // Si abre abajo: top = borde inferior del botón + margen (4px).
        top: openUp ? rect.top - dropdownH - 4 : rect.bottom + 4,
        left: rect.left,
        // El ancho mínimo del dropdown es 240px o el ancho del botón, lo mayor.
        width: Math.max(rect.width, 240),
        openUp,
      });
    }

    // Calculamos las coordenadas inmediatamente al abrir.
    update();

    // También recalculamos si el usuario redimensiona la ventana o hace scroll,
    // para que el dropdown no quede "flotando" en la posición incorrecta.
    // El "true" en scroll significa que escuchamos la fase de captura (todos los scrolls).
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);

    // Función de limpieza: se ejecuta cuando el efecto se vuelve a ejecutar
    // (el dropdown se cierra o el componente se desmonta).
    // Quitamos los listeners para no acumular múltiples suscripciones.
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open]);

  // Click fuera: cerrar (chequea button Y dropdown porque ya no son padre/hijo).
  // Como el dropdown usa createPortal, está en document.body y NO es hijo del botón.
  // Por eso necesitamos checar AMBAS referencias manualmente.
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      // Si el click fue dentro del botón → NO cerramos (lo gestiona el onClick del botón).
      // .contains(node) devuelve true si el elemento contiene al nodo dado como descendiente.
      // "e.target as Node" castea el target (que puede ser EventTarget) al tipo Node del DOM.
      if (buttonRef.current?.contains(e.target as Node)) return;

      // Si el click fue dentro del dropdown → NO cerramos (el usuario está interactuando).
      if (dropdownRef.current?.contains(e.target as Node)) return;

      // Click fuera de ambos → cerramos el dropdown.
      setOpen(false);
    }

    // Solo registramos el listener cuando el dropdown está abierto.
    // "mousedown" se dispara antes de "click", para detectar el inicio del clic.
    if (open) document.addEventListener('mousedown', handleClick);

    // Limpieza: removemos el listener cuando el dropdown se cierra o el efecto
    // se vuelve a ejecutar (para no acumular múltiples listeners).
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Encontramos el objeto SelectOption cuyo id coincide con el value actual.
  // .find() recorre el array y devuelve el PRIMER elemento que cumpla la condición.
  // Si no hay selección (value=''), find devuelve undefined.
  const selected = options.find((o) => o.id === value);

  // Filtramos las opciones según el texto de búsqueda.
  // Si search está vacío (!search = true), mostramos TODAS las opciones.
  // Si hay texto, solo mostramos las opciones cuyo label contiene el texto
  // (comparación insensible a mayúsculas con .toLowerCase()).
  const filtered = options.filter((o) => !search || o.label.toLowerCase().includes(search.toLowerCase()));

  // ── JSX retornado ────────────────────────────────────────────────────────
  return (
    // Contenedor relativo. w-full en móvil, ancho automático en md (≥768px).
    <div className="relative inline-block w-full md:w-auto">
      {/* Botón "trigger" del select: muestra la opción seleccionada o el allLabel.
          ref={buttonRef}: conecta la referencia para leer su posición.
          onClick: alterna entre abierto/cerrado Y limpia el campo de búsqueda. */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => { setOpen(!open); setSearch(''); }}
        className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white hover:border-gray-400 transition-colors w-full md:min-w-[180px] text-left"
      >
        {/* Si hay una opción seleccionada, mostramos su avatar y label.
            Si no, mostramos el allLabel (ej. "Todos") en gris. */}
        {selected ? (
          // Fragment: devolvemos múltiples elementos sin div extra.
          <>
            {/* Avatar del empleado/cliente seleccionado (pequeño, size=20px) */}
            <Avatar option={selected} size={20} />
            {/* truncate: texto largo se corta con "..." en lugar de romper el layout */}
            <span className="text-gray-900 truncate flex-1">{selected.label}</span>
          </>
        ) : (
          <span className="text-gray-500 flex-1">{allLabel}</span>
        )}

        {/* Flecha indicadora: se rota 180° cuando el dropdown está abierto.
            La clase open ? 'rotate-180' : '' aplica o no la rotación. */}
        <svg className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Renderizado condicional del dropdown:
          - open: el usuario lo abrió.
          - coords: las coordenadas ya se calcularon (no null).
          - typeof document !== 'undefined': verificación de seguridad para SSR.
            En el servidor (Node.js) no existe "document", así que no creamos el portal.

          createPortal(JSX, nodo) "teletransporta" el JSX al nodo dado del DOM.
          Aquí lo ponemos en document.body para que el z-index y overflow sean libres. */}
      {open && coords && typeof document !== 'undefined' && createPortal(
        <div
          ref={dropdownRef}
          // Posicionamos el dropdown con position:fixed y las coordenadas calculadas.
          // position:fixed es relativo al viewport (no al scroll), lo que lo mantiene
          // visible aunque el padre tenga overflow:hidden.
          style={{ position: 'fixed', top: coords.top, left: coords.left, width: coords.width, zIndex: 100 }}
          className="bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden"
        >
          {/* Campo de búsqueda en la parte superior del dropdown */}
          <div className="p-2 border-b border-gray-100">
            <input
              type="text"
              value={search}
              // Actualiza el estado "search" en tiempo real conforme el usuario escribe.
              onChange={(e) => setSearch(e.target.value)}
              placeholder={placeholder}
              className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#008080]"
              // autoFocus: el cursor va directamente a este campo al abrir el dropdown.
              autoFocus
            />
          </div>

          {/* Lista de opciones con scroll vertical (max-h-56 = 224px máx) */}
          <div className="max-h-56 overflow-y-auto">
            {/* Opción "Todos" (limpia la selección): se resalta en teal si no hay valor */}
            <button
              onClick={() => { onChange(''); setOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-gray-50 transition-colors ${!value ? 'bg-teal-50 text-[#008080] font-medium' : 'text-gray-700'}`}
            >
              {allLabel}
            </button>

            {/* Iteramos sobre las opciones filtradas con .map().
                Por cada "option" en el array "filtered", creamos un botón.
                key={option.id}: propiedad obligatoria en listas de React.
                Usamos el id porque es único entre las opciones. */}
            {filtered.map((option) => (
              <button
                key={option.id}
                // Al hacer clic: actualizamos el valor en el padre y cerramos el dropdown.
                onClick={() => { onChange(option.id); setOpen(false); }}
                // Resaltamos en teal-50 si esta opción está seleccionada.
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-gray-50 transition-colors ${value === option.id ? 'bg-teal-50' : ''}`}
              >
                {/* Avatar del empleado/cliente (más grande que en el trigger, size=24px) */}
                <Avatar option={option} size={24} />
                <div className="flex-1 min-w-0">
                  {/* Label principal: teal+negrita si está seleccionada, gris oscuro si no */}
                  <p className={`truncate ${value === option.id ? 'text-[#008080] font-medium' : 'text-gray-900'}`}>{option.label}</p>
                  {/* sublabel: texto secundario opcional (ej. "Empleado", "Gerente").
                      El && hace que solo se renderice si option.sublabel tiene valor. */}
                  {option.sublabel && <p className="text-[10px] text-gray-400 truncate">{option.sublabel}</p>}
                </div>
              </button>
            ))}

            {/* Si la búsqueda no arroja resultados, mostramos un mensaje de aviso */}
            {filtered.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-3">Sin resultados</p>
            )}
          </div>
        </div>,
        // Segundo argumento de createPortal: el nodo DOM destino.
        document.body,
      )}
    </div>
  );
}

// ─── Componente auxiliar interno: Avatar ─────────────────────────────────────
// Muestra el avatar de una opción: foto si tiene avatarUrl, iniciales si no.
// Props:
// - option: la opción de la que mostramos el avatar.
// - size: tamaño en píxeles del círculo del avatar.
function Avatar({ option, size }: { option: SelectOption; size: number }) {
  // Construimos el string de tamaño para usarlo en width y height.
  // Template literal: `${size}px` → "20px", "24px", etc.
  const s = `${size}px`;

  return (
    // Círculo con color de fondo del empleado (o teal por defecto).
    // fontSize: el texto de iniciales ocupa el 40% del tamaño del círculo.
    // option.color || '#008080': si no hay color definido, usamos teal.
    <div
      className="rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 overflow-hidden"
      style={{ width: s, height: s, fontSize: `${size * 0.4}px`, backgroundColor: option.color || '#008080' }}
    >
      {/* Renderizado condicional: foto si existe avatarUrl, iniciales si no */}
      {option.avatarUrl ? (
        // Si la URL ya empieza con "http", la usamos tal cual (URL absoluta).
        // Si no (ej. "/uploads/foto.jpg"), la prefijamos con la URL del servidor.
        <img src={option.avatarUrl.startsWith('http') ? option.avatarUrl : `${API_URL}${option.avatarUrl}`} alt="" className="w-full h-full object-cover" />
      ) : (
        // Generamos las iniciales: tomamos el label (ej. "María García"),
        // lo dividimos por espacios con .split(' ') → ["María", "García"],
        // tomamos la primera letra de cada palabra con .map((w) => w[0]) → ["M", "G"],
        // los unimos con .join('') → "MG",
        // tomamos los primeros 2 caracteres con .substring(0, 2) → "MG",
        // y los ponemos en mayúsculas con .toUpperCase() → "MG".
        // Si option.initials está definido, lo usamos directamente.
        <span>{option.initials || option.label.split(' ').map((w) => w[0]).join('').substring(0, 2).toUpperCase()}</span>
      )}
    </div>
  );
}
