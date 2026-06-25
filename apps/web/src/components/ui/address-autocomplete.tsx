'use client';
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ address-autocomplete.tsx                                                │
// │                                                                         │
// │ ¿QUÉ HACE ESTE COMPONENTE?                                              │
// │ Muestra un campo de texto para escribir una dirección. Mientras el      │
// │ usuario escribe, consulta la API de Google Places (Autocompletar) y     │
// │ despliega un menú con sugerencias de calles reales. Al elegir una, la  │
// │ rellena en el campo y llama a la función onChange del padre.            │
// │                                                                         │
// │ CONCEPTO CLAVE – DEBOUNCE:                                              │
// │ Para no llamar a Google en CADA tecla que el usuario presiona, se       │
// │ espera 300 ms desde que el usuario dejó de escribir antes de hacer la  │
// │ consulta. Esto ahorra cuota de la API y hace la UX más fluida.         │
// └─────────────────────────────────────────────────────────────────────────┘

// Importamos los hooks de React que necesitamos:
//   useState  → guarda valores que cambian en el tiempo (estado local)
//   useRef    → guarda referencias a elementos del DOM o valores que NO
//               disparan re-render cuando cambian
//   useEffect → ejecuta código DESPUÉS de que React pinta el componente
//   useCallback → memoriza funciones para no recrearlas en cada render
import { useState, useRef, useEffect, useCallback } from 'react';

// Leemos la clave de la API de Google Maps desde las variables de entorno de
// Next.js. Las variables que empiezan con NEXT_PUBLIC_ son accesibles desde
// el navegador. Si no está definida, usamos una cadena vacía ''.
const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

// ─── INTERFAZ DE PROPS ───────────────────────────────────────────────────────
// TypeScript usa "interface" para describir la forma exacta que debe tener
// el objeto de props. Cada campo tiene un tipo y ? significa "opcional".
interface AddressAutocompleteProps {
  value: string;              // Texto actual del campo (controlado por el padre)
  onChange: (address: string) => void; // Función que el padre pasa para recibir cambios
  placeholder?: string;       // Texto de ayuda cuando el campo está vacío (opcional)
  className?: string;         // Clases CSS adicionales (opcional)
}

// ─── VARIABLES DE MÓDULO (fuera del componente) ──────────────────────────────
// Estas variables viven en el módulo JavaScript, NO dentro de React.
// Eso significa que sobreviven a los re-renders y se comparten entre todas
// las instancias del componente en la misma página.

// scriptLoaded: indica si el script de Google Maps ya terminó de cargar.
let scriptLoaded = false;

// scriptLoading: indica si estamos en proceso de carga (evita cargar dos veces).
let scriptLoading = false;

// loadCallbacks: lista de funciones "resolve" de promesas que están esperando
// a que Google Maps se cargue. Cuando el script termina, llamamos a todas.
const loadCallbacks: (() => void)[] = [];

// ─── FUNCIÓN AUXILIAR: loadGoogleMapsScript ──────────────────────────────────
// Carga el script de Google Maps Places UNA SOLA VEZ aunque se llame
// varias veces. Si ya está cargado, resuelve inmediatamente. Si ya está
// cargando, encola la promesa. Si no ha comenzado, inyecta el <script>.
function loadGoogleMapsScript(): Promise<void> {
  // Devolvemos una Promesa. El código dentro se ejecuta de inmediato.
  return new Promise((resolve) => {
    // Si el script ya cargó (ya sea por nosotros o por otro medio), resolvemos.
    // (window as any) → "TypeScript, confía en mí; sé que window.google existe"
    // ?. → "acceso seguro": si google no existe, no lanza error, devuelve undefined
    if (scriptLoaded || (window as any).google?.maps?.places) {
      scriptLoaded = true;
      resolve(); // La promesa se cumple con éxito
      return;    // Salimos de la función
    }

    // Guardamos este "resolve" para llamarlo cuando el script termine de cargar.
    loadCallbacks.push(resolve);

    // Si ya hay otra carga en progreso, no lanzamos otra. Solo esperamos.
    if (scriptLoading) return;
    scriptLoading = true; // Marcamos que comenzamos a cargar

    // Creamos un elemento <script> de forma dinámica (como si lo escribiéramos en HTML)
    const script = document.createElement('script');
    // URL del script de Google Maps con nuestra API key y la librería "places"
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
    script.async = true; // Se carga en segundo plano, sin bloquear la página

    // Cuando el script termina de cargarse, ejecutamos este callback:
    script.onload = () => {
      scriptLoaded = true;
      // Llamamos a TODAS las promesas que estaban esperando
      loadCallbacks.forEach((cb) => cb());
      // Vaciamos el array (truco: length = 0 limpia el array in place)
      loadCallbacks.length = 0;
    };

    // Insertamos el <script> dentro del <head> del HTML
    document.head.appendChild(script);
  });
}

// ─── INTERFAZ PARA PREDICCIONES ──────────────────────────────────────────────
// Así se ve cada sugerencia que devuelve Google
interface Prediction {
  placeId: string;      // ID único del lugar en Google (ej. "ChIJ2eUgeAK6j4AR...")
  description: string;  // Texto legible (ej. "Av. Insurgentes Sur 123, CDMX, México")
}

// ─── COMPONENTE PRINCIPAL ────────────────────────────────────────────────────
// Desestructuramos las props directamente en los parámetros de la función.
// Los = '...' son valores por defecto cuando la prop no se pasa.
export function AddressAutocomplete({
  value,
  onChange,
  placeholder = 'Buscar dirección...',
  className = '',
}: AddressAutocompleteProps) {

  // ─── ESTADO LOCAL ─────────────────────────────────────────────────────────
  // inputValue: lo que se muestra en el campo de texto en este momento
  const [inputValue, setInputValue] = useState(value);

  // predictions: la lista de sugerencias de Google (array vacío al inicio)
  const [predictions, setPredictions] = useState<Prediction[]>([]);

  // showDropdown: controla si el menú de sugerencias es visible o no
  const [showDropdown, setShowDropdown] = useState(false);

  // ready: true cuando Google Maps terminó de cargar y podemos usarlo
  const [ready, setReady] = useState(false);

  // ─── REFS ─────────────────────────────────────────────────────────────────
  // autocompleteService: guarda la instancia del servicio de Google
  // Places. useRef porque NO queremos re-renderizar al asignarlo.
  const autocompleteService = useRef<any>(null);

  // containerRef: referencia al div exterior para detectar clicks fuera del componente
  const containerRef = useRef<HTMLDivElement>(null);

  // debounceRef: guarda el ID del setTimeout del debounce para poder cancelarlo
  // antes de crear uno nuevo (así evitamos llamadas duplicadas a Google)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── EFECTO 1: Sincronizar el texto del campo con la prop externa ──────────
  // Se ejecuta cada vez que el padre cambia la prop "value" (por ejemplo, si
  // el padre resetea el formulario o precarga una dirección).
  useEffect(() => {
    setInputValue(value);
  }, [value]); // Solo se ejecuta cuando "value" cambia

  // ─── EFECTO 2: Cargar el script de Google Maps ────────────────────────────
  // [] como segundo argumento → se ejecuta SOLO UNA VEZ al montar el componente
  useEffect(() => {
    // Si no hay clave de API configurada, no intentamos cargar Google Maps
    if (!GOOGLE_MAPS_API_KEY) return;

    // Llamamos a nuestra función auxiliar y cuando la Promesa se resuelve:
    loadGoogleMapsScript().then(() => {
      // Creamos una instancia del servicio de autocompletado de Google
      autocompleteService.current = new (window as any).google.maps.places.AutocompleteService();
      // Marcamos que todo está listo para usarse
      setReady(true);
    });
  }, []); // Sin dependencias → solo al montar

  // ─── EFECTO 3: Cerrar el menú al hacer click fuera del componente ─────────
  useEffect(() => {
    // Definimos la función que revisa si el click fue fuera del contenedor
    function handleClick(e: MouseEvent) {
      // containerRef.current → el div contenedor del componente
      // contains(e.target) → ¿el elemento clickeado está DENTRO del div?
      // Si el target NO está dentro, cerramos el menú
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }

    // Escuchamos clicks en todo el documento
    document.addEventListener('mousedown', handleClick);

    // Función de limpieza: se ejecuta cuando el componente se desmonta
    // Siempre hay que quitar los listeners para evitar memory leaks
    return () => document.removeEventListener('mousedown', handleClick);
  }, []); // Solo al montar/desmontar

  // ─── FUNCIÓN: fetchPredictions ────────────────────────────────────────────
  // Consulta a Google Places con el texto que el usuario escribió.
  // useCallback memoiza la función para que no se recree en cada render,
  // lo que evita efectos secundarios indeseados. [] = sin dependencias.
  const fetchPredictions = useCallback(
    (input: string) => {
      // Si no hay servicio cargado o el texto está vacío, limpiamos y salimos
      if (!autocompleteService.current || !input.trim()) {
        setPredictions([]);
        return;
      }

      // Llamamos a Google Places con el texto y el tipo de resultado deseado
      autocompleteService.current.getPlacePredictions(
        { input, types: ['address'] }, // Solo direcciones (no negocios, ciudades, etc.)
        (results: any, status: any) => {
          // Google llama a este callback con los resultados y un estado
          if (
            status === (window as any).google.maps.places.PlacesServiceStatus.OK &&
            results
          ) {
            // .map() transforma el array de Google en nuestro formato Prediction
            // r es cada resultado, r.place_id y r.description son campos de Google
            setPredictions(
              results.map((r: any) => ({
                placeId: r.place_id,
                description: r.description,
              })),
            );
            setShowDropdown(true); // Mostramos el menú desplegable
          } else {
            // Si Google no encontró nada o hubo error, vaciamos las sugerencias
            setPredictions([]);
          }
        },
      );
    },
    [], // Sin dependencias (autocompleteService es un ref, no cambia)
  );

  // ─── MANEJADOR: handleInputChange ─────────────────────────────────────────
  // Se llama cada vez que el usuario escribe algo en el campo de texto.
  // e: React.ChangeEvent<HTMLInputElement> → evento del input HTML
  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value; // Leemos el texto nuevo del campo

    setInputValue(val);  // Actualizamos lo que se muestra en el campo
    onChange(val);       // Notificamos al padre del nuevo valor (sin esperar a Google)

    // Cancelamos el debounce anterior si existía
    if (debounceRef.current) clearTimeout(debounceRef.current);

    // Iniciamos un nuevo debounce: esperamos 300ms antes de consultar a Google.
    // Si el usuario sigue escribiendo antes de 300ms, este setTimeout se cancela
    // y se crea uno nuevo. Así solo consultamos cuando el usuario se detiene.
    debounceRef.current = setTimeout(() => fetchPredictions(val), 300);
  }

  // ─── MANEJADOR: handleSelect ──────────────────────────────────────────────
  // Se llama cuando el usuario hace click en una sugerencia del menú.
  function handleSelect(prediction: Prediction) {
    setInputValue(prediction.description); // Pone el texto seleccionado en el campo
    onChange(prediction.description);      // Notifica al padre
    setPredictions([]);                    // Limpia las sugerencias
    setShowDropdown(false);                // Cierra el menú
  }

  // ─── RENDERIZADO CONDICIONAL: Sin API key ─────────────────────────────────
  // Si no hay clave de Google Maps configurada, mostramos un input normal
  // sin capacidad de autocompletado. Esto evita errores en desarrollo.
  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <input
        type="text"
        value={inputValue}
        onChange={(e) => {
          setInputValue(e.target.value);
          onChange(e.target.value);
        }}
        placeholder={placeholder}
        className={className || 'input-field'}
      />
    );
  }

  // ─── JSX PRINCIPAL ───────────────────────────────────────────────────────
  // "relative" en el div padre permite posicionar el menú de forma absoluta
  // relativa a este contenedor (no a la página entera).
  return (
    <div ref={containerRef} className="relative">
      {/* Campo de texto principal */}
      <input
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onFocus={() => {
          // Al enfocar el campo, si ya hay sugerencias previas, las volvemos a mostrar
          if (predictions.length > 0) setShowDropdown(true);
        }}
        // Mientras Google carga, mostramos "Cargando Google Maps..." en vez del placeholder normal
        placeholder={ready ? placeholder : 'Cargando Google Maps...'}
        className={className || 'input-field'}
        disabled={!ready} // Deshabilitamos el campo hasta que Google esté listo
      />

      {/* Menú desplegable de sugerencias */}
      {/* Doble &&: primero verificamos showDropdown, luego que haya sugerencias */}
      {showDropdown && predictions.length > 0 && (
        // <ul> = lista desordenada de HTML (unordered list)
        // "absolute z-50" → posición flotante encima de todo lo demás
        // "max-h-48 overflow-y-auto" → máximo 192px de alto, con scroll si hay más
        <ul className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {/* .map() itera cada predicción y devuelve un elemento <li> */}
          {predictions.map((p) => (
            // key={p.placeId} → React necesita una clave única para cada elemento
            // de la lista para optimizar las actualizaciones del DOM
            <li key={p.placeId}>
              <button
                type="button"
                onClick={() => handleSelect(p)} // Al hacer click, seleccionamos esta predicción
                className="w-full text-left px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-start gap-2"
              >
                {/* Ícono de pin de mapa (SVG dibujado a mano, no imagen) */}
                <svg
                  className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  {/* path d="..." → serie de comandos para dibujar la silueta del pin */}
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                {/* "truncate" → si el texto es muy largo, lo corta con "..." */}
                <span className="truncate">{p.description}</span>
              </button>
            </li>
          ))}
          {/* Pie del menú: logo de Google (requerido por los Términos de Servicio) */}
          <li className="px-3 py-1.5 border-t border-gray-100">
            <span className="text-[10px] text-gray-400">Powered by Google</span>
          </li>
        </ul>
      )}
    </div>
  );
}
