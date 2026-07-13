// Mapa de ÁREAS DE COBERTURA (servicio a domicilio): dibuja círculos
// concéntricos de colores centrados en la sucursal, uno por área. Reutiliza el
// mismo stack Leaflet/OSM que location-map-picker (sin costo por consulta).
//
// SSR: Leaflet usa `window`; el padre debe importarlo con next/dynamic + { ssr:false }.
'use client';

import { useEffect } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Circle, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

interface LatLng {
  lat: number;
  lng: number;
}

// Un área a dibujar: radio (km), color y nombre opcional (tooltip).
export interface CoverageRing {
  radiusKm: number;
  color: string;
  name?: string;
}

interface Props {
  center: LatLng;
  areas: CoverageRing[];
  height?: number;
  // Punto opcional del cliente (ej. su dirección) — se marca en rojo y se
  // incluye en el encuadre, útil para mostrar por qué queda fuera de rango.
  point?: LatLng | null;
}

// Pin del negocio (mismo SVG teal que el picker de sucursales).
const PIN_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 42" width="28" height="37">
  <path d="M16 0C7.16 0 0 7.16 0 16c0 11.2 16 26 16 26s16-14.8 16-26C32 7.16 24.84 0 16 0z" fill="#008080"/>
  <circle cx="16" cy="16" r="6" fill="#fff"/>
</svg>`;
const pinIcon = L.divIcon({
  html: PIN_SVG,
  className: 'siliba-map-pin',
  iconSize: [28, 37],
  iconAnchor: [14, 37],
});

// Pin rojo para el punto del cliente (dirección).
const POINT_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 42" width="28" height="37">
  <path d="M16 0C7.16 0 0 7.16 0 16c0 11.2 16 26 16 26s16-14.8 16-26C32 7.16 24.84 0 16 0z" fill="#dc2626"/>
  <circle cx="16" cy="16" r="6" fill="#fff"/>
</svg>`;
const pointIcon = L.divIcon({
  html: POINT_SVG,
  className: 'siliba-map-point',
  iconSize: [28, 37],
  iconAnchor: [14, 37],
});

// Ajusta el zoom para que quepa el anillo más grande (y el punto del cliente si
// existe), con un pequeño margen.
function FitToAreas({ center, maxRadiusKm, point }: { center: LatLng; maxRadiusKm: number; point?: LatLng | null }) {
  const map = useMap();
  useEffect(() => {
    if (maxRadiusKm > 0) {
      // toBounds(sizeEnMetros) calcula un recuadro alrededor del punto SIN
      // necesitar el mapa (a diferencia de circle().getBounds(), que requiere
      // que el círculo esté añadido al mapa y por eso crasheaba). El tamaño es
      // el diámetro del anillo mayor.
      const bounds = L.latLng(center.lat, center.lng).toBounds(maxRadiusKm * 2 * 1000);
      if (point) bounds.extend([point.lat, point.lng]);
      map.fitBounds(bounds, { padding: [24, 24] });
    } else if (point) {
      map.fitBounds(L.latLngBounds([[center.lat, center.lng], [point.lat, point.lng]]), { padding: [40, 40] });
    } else {
      map.setView([center.lat, center.lng], 13);
    }
  }, [center.lat, center.lng, maxRadiusKm, point?.lat, point?.lng, map]);
  return null;
}

export default function CoverageAreaMap({ center, areas, height = 320, point }: Props) {
  const maxRadiusKm = areas.reduce((m, a) => Math.max(m, a.radiusKm || 0), 0);
  // Dibujamos de mayor a menor para que los anillos pequeños queden ENCIMA y se
  // vea el borde de cada zona.
  const sorted = [...areas].sort((a, b) => (b.radiusKm || 0) - (a.radiusKm || 0));

  return (
    <div className="rounded-xl overflow-hidden border border-gray-200" style={{ height }}>
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {sorted.map((a, i) => (
          <Circle
            key={i}
            center={[center.lat, center.lng]}
            radius={(a.radiusKm || 0) * 1000}
            pathOptions={{ color: a.color, fillColor: a.color, fillOpacity: 0.12, weight: 2 }}
          />
        ))}

        <Marker position={[center.lat, center.lng]} icon={pinIcon} />
        {point && <Marker position={[point.lat, point.lng]} icon={pointIcon} />}

        <FitToAreas center={center} maxRadiusKm={maxRadiusKm} point={point} />
      </MapContainer>
    </div>
  );
}
