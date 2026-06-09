'use client';

import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

/**
 * Mapa con pin arrastrable para fijar las coordenadas exactas de una
 * sucursal. La geocodificación automática vía Nominatim (en el form padre)
 * solo da una sugerencia — el dueño puede arrastrar el pin al lugar real.
 *
 * SSR: leaflet usa `window`. Importar este componente con `next/dynamic`
 * y `{ ssr: false }` en el padre.
 */

interface LatLng {
  lat: number;
  lng: number;
}

interface Props {
  value: LatLng | null;
  onChange: (coords: LatLng) => void;
  /** Centro inicial si value es null. Default: centro geográfico de México. */
  defaultCenter?: LatLng;
  /** Altura del mapa en px. Default 280. */
  height?: number;
}

const DEFAULT_CENTER: LatLng = { lat: 23.6345, lng: -102.5528 }; // Centro de MX

// Iconos default de leaflet rompen con webpack — los reemplazamos con un
// pin SVG custom embebido (teal del proyecto). Asi evitamos depender de
// que /public tenga los iconos de leaflet.
const PIN_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 42" width="32" height="42">
  <path d="M16 0C7.16 0 0 7.16 0 16c0 11.2 16 26 16 26s16-14.8 16-26C32 7.16 24.84 0 16 0z" fill="#008080"/>
  <circle cx="16" cy="16" r="6" fill="#fff"/>
</svg>`;

const pinIcon = L.divIcon({
  html: PIN_SVG,
  className: 'siliba-map-pin',
  iconSize: [32, 42],
  iconAnchor: [16, 42],
});

// Re-centra el mapa cuando cambia value externamente (ej. autocomplete
// del padre cambió la dirección y geocodificó). Sin esto el pin se mueve
// pero el viewport se queda donde estaba.
function RecenterOnChange({ position }: { position: LatLng | null }) {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.setView([position.lat, position.lng], Math.max(map.getZoom(), 15), {
        animate: true,
      });
    }
  }, [position?.lat, position?.lng, map]);
  return null;
}

export default function LocationMapPicker({
  value,
  onChange,
  defaultCenter = DEFAULT_CENTER,
  height = 280,
}: Props) {
  const markerRef = useRef<L.Marker>(null);

  const center: LatLng = value || defaultCenter;
  const initialZoom = value ? 16 : 5;

  // Handlers del marker — drag para reposicionar, click en el mapa también
  // reposiciona el pin a donde el usuario tocó.
  const markerEventHandlers = useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current;
        if (marker) {
          const { lat, lng } = marker.getLatLng();
          onChange({ lat, lng });
        }
      },
    }),
    [onChange],
  );

  return (
    <div
      className="rounded-xl overflow-hidden border border-gray-200"
      style={{ height }}
    >
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={initialZoom}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {value && (
          <Marker
            position={[value.lat, value.lng]}
            draggable
            icon={pinIcon}
            eventHandlers={markerEventHandlers}
            ref={markerRef}
          />
        )}
        <RecenterOnChange position={value} />
      </MapContainer>
    </div>
  );
}
