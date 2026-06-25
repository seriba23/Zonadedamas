// Este componente SOLO funciona en el navegador (cliente), nunca en el servidor.
// Motivo: la librería Leaflet usa "window" y "document" que no existen en Node.js.
// El padre debe importar este componente con next/dynamic + { ssr: false }.
'use client';

// Importamos tres hooks de React:
// - useEffect: ejecuta código después de que React renderiza (ej. efectos secundarios).
// - useMemo: memoriza un valor calculado para no recalcularlo en cada render.
// - useRef: referencia a un objeto persistente (aquí, el marcador de Leaflet).
import { useEffect, useMemo, useRef } from 'react';

// "L" es la librería Leaflet: permite crear mapas interactivos en el navegador.
import L from 'leaflet';

// Componentes de react-leaflet: wrappers de React sobre la API de Leaflet.
// - MapContainer: el contenedor principal del mapa.
// - TileLayer: carga las imágenes (tiles) del mapa desde OpenStreetMap.
// - Marker: el pin que se coloca en el mapa.
// - useMap: hook especial que da acceso al objeto mapa de Leaflet desde
//   un componente hijo (solo funciona dentro de <MapContainer>).
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';

// Estilos CSS de Leaflet (necesarios para que el mapa se vea correctamente).
import 'leaflet/dist/leaflet.css';

/**
 * Mapa con pin arrastrable para fijar las coordenadas exactas de una
 * sucursal. La geocodificación automática vía Nominatim (en el form padre)
 * solo da una sugerencia — el dueño puede arrastrar el pin al lugar real.
 *
 * SSR: leaflet usa `window`. Importar este componente con `next/dynamic`
 * y `{ ssr: false }` en el padre.
 */

// ─── Tipos de datos ──────────────────────────────────────────────────────────
// LatLng representa un punto geográfico con latitud y longitud.
// Usamos una interface en lugar de un array [number, number] para que el
// código sea más legible: { lat: 23.6, lng: -102.5 } en lugar de [23.6, -102.5].
interface LatLng {
  lat: number;
  lng: number;
}

// Props del componente principal.
interface Props {
  // Coordenadas actuales del pin. Si es null, no se muestra pin en el mapa.
  value: LatLng | null;

  // Función del padre que se llama cuando el usuario mueve el pin.
  // Recibe las nuevas coordenadas.
  onChange: (coords: LatLng) => void;

  /** Centro inicial si value es null. Default: centro geográfico de México. */
  defaultCenter?: LatLng;

  /** Altura del mapa en px. Default 280. */
  height?: number;
}

// Coordenadas del centro geográfico aproximado de México.
// Se usan como vista inicial cuando aún no hay ubicación seleccionada.
const DEFAULT_CENTER: LatLng = { lat: 23.6345, lng: -102.5528 }; // Centro de MX

// Iconos default de leaflet rompen con webpack — los reemplazamos con un
// pin SVG custom embebido (teal del proyecto). Asi evitamos depender de
// que /public tenga los iconos de leaflet.
// PIN_SVG es un string con el código SVG del icono de pin.
// SVG (Scalable Vector Graphics) es un formato de imagen vectorial que se
// describe con código XML/HTML, no con píxeles.
const PIN_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 42" width="32" height="42">
  <path d="M16 0C7.16 0 0 7.16 0 16c0 11.2 16 26 16 26s16-14.8 16-26C32 7.16 24.84 0 16 0z" fill="#008080"/>
  <circle cx="16" cy="16" r="6" fill="#fff"/>
</svg>`;

// L.divIcon crea un icono de Leaflet a partir de HTML (nuestro SVG).
// - html: el contenido HTML del icono.
// - className: clase CSS del div contenedor (para posibles estilos adicionales).
// - iconSize: tamaño en píxeles [ancho, alto] del icono.
// - iconAnchor: el punto del icono que se "clava" en la coordenada del mapa.
//   [16, 42] significa: el punto de anclaje está a 16px del borde izquierdo
//   y 42px del borde superior, es decir, la punta inferior del pin.
const pinIcon = L.divIcon({
  html: PIN_SVG,
  className: 'siliba-map-pin',
  iconSize: [32, 42],
  iconAnchor: [16, 42],
});

// Re-centra el mapa cuando cambia value externamente (ej. autocomplete
// del padre cambió la dirección y geocodificó). Sin esto el pin se mueve
// pero el viewport se queda donde estaba.
// Este es un componente auxiliar INTERNO que vive DENTRO de <MapContainer>.
// Solo puede existir dentro de <MapContainer> porque usa el hook useMap().
function RecenterOnChange({ position }: { position: LatLng | null }) {
  // useMap() devuelve la instancia del mapa de Leaflet.
  // Solo funciona dentro de <MapContainer>.
  const map = useMap();

  // useEffect se ejecuta después de cada render en que cambie alguna de las
  // dependencias del array [ position?.lat, position?.lng, map ].
  // position?.lat usa optional chaining: si position es null, devuelve undefined
  // (no lanza error), y el efecto no hace nada.
  useEffect(() => {
    if (position) {
      // map.setView centra el mapa en las nuevas coordenadas.
      // Math.max(map.getZoom(), 15) garantiza que el zoom sea al menos 15
      // (vista de calle), sin alejar si ya estaba más cerca.
      // { animate: true } hace que el movimiento sea suave (animado).
      map.setView([position.lat, position.lng], Math.max(map.getZoom(), 15), {
        animate: true,
      });
    }
  }, [position?.lat, position?.lng, map]);

  // Este componente no renderiza nada visible, solo produce el efecto lateral
  // de re-centrar el mapa. Por eso devuelve null.
  return null;
}

// ─── Componente principal exportado ─────────────────────────────────────────
// "export default" exporta este componente como exportación por defecto del
// archivo, lo que permite importarlo así: import LocationMapPicker from '...'.
export default function LocationMapPicker({
  value,
  onChange,
  defaultCenter = DEFAULT_CENTER,  // si no se pasa, usa el centro de México
  height = 280,                     // si no se pasa, 280px de alto
}: Props) {
  // Referencia al objeto Marker de Leaflet. Necesitamos acceder a él en el
  // evento "dragend" para leer la posición final del pin tras arrastrarlo.
  const markerRef = useRef<L.Marker>(null);

  // Si tenemos coordenadas, centramos el mapa ahí; si no, en el centro por defecto.
  // El operador "||" devuelve el valor de la derecha si el de la izquierda es falsy.
  // value=null es falsy, así que: null || defaultCenter → defaultCenter.
  const center: LatLng = value || defaultCenter;

  // Zoom inicial: 16 (vista de calle) si ya hay pin, 5 (vista de país) si no.
  // El operador ternario "condición ? valorSiTrue : valorSiFalse".
  const initialZoom = value ? 16 : 5;

  // Handlers del marker — drag para reposicionar, click en el mapa también
  // reposiciona el pin a donde el usuario tocó.
  // useMemo memoriza el objeto de handlers para evitar que Leaflet reconfigure
  // el marker en cada render. Solo recrea el objeto si onChange cambia.
  // El segundo argumento [onChange] es el "array de dependencias".
  const markerEventHandlers = useMemo(
    () => ({
      // "dragend" se llama cuando el usuario suelta el pin tras arrastrarlo.
      dragend() {
        // Leemos el marcador actual desde la referencia.
        const marker = markerRef.current;
        if (marker) {
          // getLatLng() devuelve un objeto { lat, lng } con la nueva posición.
          // Desestructuración: extraemos lat y lng en variables separadas.
          const { lat, lng } = marker.getLatLng();

          // Notificamos al padre con las nuevas coordenadas.
          onChange({ lat, lng });
        }
      },
    }),
    // Array de dependencias: solo recalcula si onChange cambia de referencia.
    [onChange],
  );

  // ── JSX retornado ────────────────────────────────────────────────────────
  return (
    // Contenedor con bordes redondeados y alto dinámico (viene de la prop height).
    // style={{ height }}: shorthand de ES6, equivale a style={{ height: height }}.
    <div
      className="rounded-xl overflow-hidden border border-gray-200"
      style={{ height }}
    >
      {/* MapContainer: el mapa de Leaflet.
          - center: coordenadas del centro inicial (array [lat, lng] que Leaflet espera).
          - zoom: nivel de zoom inicial.
          - style: hace que el mapa ocupe todo el contenedor.
          - scrollWheelZoom={false}: desactiva el zoom con la rueda del ratón
            (evita que el usuario haga zoom accidentalmente al desplazar la página). */}
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={initialZoom}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={false}
      >
        {/* TileLayer: carga y muestra las imágenes del mapa desde OpenStreetMap.
            - attribution: texto de crédito requerido por la licencia de OSM.
            - url: patrón de URL donde {s} = subdominio, {z} = zoom, {x}/{y} = tile. */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Solo mostramos el pin (Marker) si value no es null.
            El operador && hace renderizado condicional:
            si value es null (falsy), no renderiza nada. */}
        {value && (
          <Marker
            // position: coordenadas del pin en formato array que Leaflet espera.
            position={[value.lat, value.lng]}
            // draggable: permite al usuario arrastrar el pin.
            draggable
            // icon: usamos nuestro pin SVG teal personalizado.
            icon={pinIcon}
            // eventHandlers: objeto con las funciones de eventos (dragend, etc.).
            eventHandlers={markerEventHandlers}
            // ref: conectamos la referencia para acceder al objeto Marker.
            ref={markerRef}
          />
        )}

        {/* Componente auxiliar que re-centra el mapa cuando value cambia. */}
        <RecenterOnChange position={value} />
      </MapContainer>
    </div>
  );
}
