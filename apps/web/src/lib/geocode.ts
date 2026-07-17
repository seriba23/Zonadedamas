// ============================================================
// forwardGeocode — geocodificación de una dirección estructurada vía el
// proxy backend /api/geocode (Nominatim con User-Agent identificable).
//
// Se extrajo aquí (antes vivía duplicado en el editor de sucursales del
// admin) para que el editor de sucursales Y la pantalla de "servicio a
// domicilio" del freelancer usen exactamente la misma lógica.
//
// Nominatim es mucho más preciso con parámetros estructurados (calle,
// ciudad, estado, CP, país) que con la dirección concatenada en un string.
// ============================================================

import { api } from '@/lib/api';
import type { AddressValue } from '@/components/ui/address-fields';

export type GeocodeHit = {
  lat: number;
  lng: number;
  precision: 'address' | 'city' | 'unknown';
};

// Nombre del país en español a partir del código ISO. Sin país, Nominatim
// devuelve coincidencias de cualquier sitio, así que si falta no lo mandamos.
const COUNTRY_NAMES: Record<string, string> = {
  mx: 'México', us: 'Estados Unidos', es: 'España', ar: 'Argentina',
  co: 'Colombia', cl: 'Chile', pe: 'Perú', ve: 'Venezuela', ec: 'Ecuador',
  gt: 'Guatemala', cr: 'Costa Rica', pa: 'Panamá', do: 'República Dominicana',
  uy: 'Uruguay', py: 'Paraguay', bo: 'Bolivia', sv: 'El Salvador',
  hn: 'Honduras', ni: 'Nicaragua', cu: 'Cuba', pr: 'Puerto Rico',
};

export async function forwardGeocode(addr: AddressValue): Promise<GeocodeHit | null> {
  const street = [addr.street, addr.number].filter(Boolean).join(' ').trim();
  const city = addr.city.trim();
  const state = addr.region.trim();
  const postalcode = addr.postalCode.trim();
  const countryName = COUNTRY_NAMES[addr.countryCode.toLowerCase()] || '';
  if (!city && !street) return null;
  const qs = new URLSearchParams();
  if (street) qs.set('street', street);
  if (city) qs.set('city', city);
  if (state) qs.set('state', state);
  if (postalcode) qs.set('postalcode', postalcode);
  if (countryName) qs.set('country', countryName);
  try {
    const res = await api.get<{ data: (GeocodeHit & { displayName: string }) | null }>(
      `/api/geocode?${qs.toString()}`,
    );
    if (!res?.data) return null;
    return { lat: res.data.lat, lng: res.data.lng, precision: res.data.precision };
  } catch {
    return null;
  }
}
