'use client';

import { useEffect, useState } from 'react';
import {
  loadCountries,
  getSubdivisionsOfCountry,
  getMxCitiesOfState,
  regionLabelFromSubdivisions,
  getCountrySync,
  countryHasCityDropdown,
  type Country,
  type Subdivision,
} from '@/lib/geo-data';

export interface AddressValue {
  street: string;
  number: string;
  colonia: string;
  city: string;
  region: string;       // Nombre del estado/provincia (string libre porque el dataset puede no tener)
  regionCode: string;   // Codigo ISO de la subdivision (ej. "MX-JAL"); vacio si region es libre
  postalCode: string;
  countryCode: string;  // ISO alpha2 lowercase (ej. "mx"); coincide con el dataset
}

interface Props {
  value: AddressValue;
  onChange: (next: AddressValue) => void;
  showOptional?: boolean;
  required?: boolean;
  errors?: Partial<Record<keyof AddressValue, string>>;
  className?: string;
}

const TEAL = '#008080';

/**
 * Bloque reutilizable de direccion. Patron de fallback:
 *
 *   - Pais: dropdown SIEMPRE (countries-es.json, ~250 paises).
 *   - Region: dropdown si el dataset tiene subdivisions para el pais
 *     elegido. Sino → input libre. El label cambia segun el "type" mas
 *     comun (Estado / Provincia / Departamento / Region / etc.).
 *   - Ciudad: dropdown solo para Mexico (con mx_cities_by_state.json y
 *     estado elegido). Sino → input libre.
 *
 * Datos cargados lazy desde /data/*.json. Primer mount fetch ~520KB
 * (subdivisions), despues queda en cache.
 */
export function AddressFields({
  value,
  onChange,
  showOptional = true,
  required = false,
  errors = {},
  className = '',
}: Props) {
  const [countries, setCountries] = useState<Country[]>([]);
  const [subdivisions, setSubdivisions] = useState<Subdivision[]>([]);
  const [mxCities, setMxCities] = useState<string[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(false);

  // Cargar paises al montar (rapido, ~12KB)
  useEffect(() => {
    loadCountries().then(setCountries).catch(() => setCountries([]));
  }, []);

  // Cargar subdivisiones cuando cambia el pais
  useEffect(() => {
    if (!value.countryCode) {
      setSubdivisions([]);
      return;
    }
    setLoadingSubs(true);
    getSubdivisionsOfCountry(value.countryCode)
      .then((subs) => {
        setSubdivisions(subs);
        setLoadingSubs(false);
      })
      .catch(() => {
        setSubdivisions([]);
        setLoadingSubs(false);
      });
  }, [value.countryCode]);

  // Cargar ciudades cuando cambia el estado (solo MX por ahora)
  useEffect(() => {
    if (!countryHasCityDropdown(value.countryCode) || !value.regionCode) {
      setMxCities([]);
      return;
    }
    getMxCitiesOfState(value.regionCode).then(setMxCities).catch(() => setMxCities([]));
  }, [value.countryCode, value.regionCode]);

  const regionLabel = regionLabelFromSubdivisions(subdivisions);
  const hasRegionDropdown = subdivisions.length > 0;
  const hasCityDropdown = countryHasCityDropdown(value.countryCode) && mxCities.length > 0;
  const reqMark = required ? <span className="text-red-500"> *</span> : null;

  const update = (patch: Partial<AddressValue>) => onChange({ ...value, ...patch });

  const onCountryChange = (code: string) => {
    // Al cambiar pais, reseteamos region y ciudad porque las subdivisiones
    // y ciudades dependen del pais. Mantenemos los demas campos.
    onChange({ ...value, countryCode: code.toLowerCase(), region: '', regionCode: '', city: '' });
  };

  const onRegionDropdownChange = (code: string) => {
    const sub = subdivisions.find((s) => s.code === code);
    onChange({ ...value, regionCode: code, region: sub?.name || '', city: '' });
  };

  const baseInput = 'w-full px-3 py-2.5 border rounded-xl text-sm focus:ring-2 focus:outline-none focus:border-transparent';
  const inputClass = (err?: string) =>
    `${baseInput} ${err ? 'border-red-400' : 'border-gray-200'}`;
  const ringStyle = { '--tw-ring-color': TEAL } as React.CSSProperties;

  return (
    <div className={`space-y-3 ${className}`}>
      {/* País */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">
          País{reqMark}
        </label>
        <select
          value={value.countryCode}
          onChange={(e) => onCountryChange(e.target.value)}
          className={`${inputClass(errors.countryCode)} bg-white`}
          style={ringStyle}
        >
          <option value="">
            {countries.length === 0 ? 'Cargando países…' : 'Selecciona un país'}
          </option>
          {countries.map((c) => (
            <option key={c.alpha2} value={c.alpha2}>{c.name}</option>
          ))}
        </select>
        {errors.countryCode && <p className="mt-1 text-xs text-red-600">{errors.countryCode}</p>}
      </div>

      {/* Región: dropdown si hay subdivisiones, sino input libre */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">
          {regionLabel}{reqMark}
        </label>
        {!value.countryCode ? (
          <input
            type="text"
            disabled
            placeholder="Selecciona un país primero"
            className={`${inputClass()} bg-gray-100 cursor-not-allowed`}
          />
        ) : loadingSubs ? (
          <input
            type="text"
            disabled
            placeholder="Cargando…"
            className={`${inputClass()} bg-gray-100 cursor-not-allowed`}
          />
        ) : hasRegionDropdown ? (
          <select
            value={value.regionCode}
            onChange={(e) => onRegionDropdownChange(e.target.value)}
            className={`${inputClass(errors.region)} bg-white`}
            style={ringStyle}
          >
            <option value="">{`Selecciona ${regionLabel.toLowerCase()}`}</option>
            {subdivisions.map((s) => (
              <option key={s.code} value={s.code}>{s.name}</option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            value={value.region}
            onChange={(e) => update({ region: e.target.value, regionCode: '' })}
            placeholder={`Escribe tu ${regionLabel.toLowerCase()}`}
            className={inputClass(errors.region)}
            style={ringStyle}
          />
        )}
        {errors.region && <p className="mt-1 text-xs text-red-600">{errors.region}</p>}
      </div>

      {/* Ciudad + CP */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">Ciudad{reqMark}</label>
          {hasCityDropdown ? (
            <select
              value={value.city}
              onChange={(e) => update({ city: e.target.value })}
              className={`${inputClass(errors.city)} bg-white`}
              style={ringStyle}
            >
              <option value="">Selecciona ciudad</option>
              {mxCities.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={value.city}
              onChange={(e) => update({ city: e.target.value })}
              placeholder="Ciudad"
              className={inputClass(errors.city)}
              style={ringStyle}
            />
          )}
          {errors.city && <p className="mt-1 text-xs text-red-600">{errors.city}</p>}
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">Código postal{reqMark}</label>
          <input
            type="text"
            inputMode="numeric"
            value={value.postalCode}
            onChange={(e) => update({ postalCode: e.target.value.replace(/\D/g, '').slice(0, 10) })}
            placeholder="CP"
            className={inputClass(errors.postalCode)}
            style={ringStyle}
          />
          {errors.postalCode && <p className="mt-1 text-xs text-red-600">{errors.postalCode}</p>}
        </div>
      </div>

      {/* Calle + Numero */}
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-700 mb-1.5">Calle{reqMark}</label>
          <input
            type="text"
            value={value.street}
            onChange={(e) => update({ street: e.target.value })}
            placeholder="Nombre de la calle"
            className={inputClass(errors.street)}
            style={ringStyle}
          />
          {errors.street && <p className="mt-1 text-xs text-red-600">{errors.street}</p>}
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">Número{reqMark}</label>
          <input
            type="text"
            value={value.number}
            onChange={(e) => update({ number: e.target.value })}
            placeholder="Ej. 123"
            className={inputClass(errors.number)}
            style={ringStyle}
          />
          {errors.number && <p className="mt-1 text-xs text-red-600">{errors.number}</p>}
        </div>
      </div>

      {/* Colonia (opcional siempre) */}
      {showOptional && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">
            Colonia / Fraccionamiento <span className="text-gray-400 font-normal">(opcional)</span>
          </label>
          <input
            type="text"
            value={value.colonia}
            onChange={(e) => update({ colonia: e.target.value })}
            placeholder="Colonia"
            className={inputClass(errors.colonia)}
            style={ringStyle}
          />
        </div>
      )}
    </div>
  );
}

/** Devuelve un AddressValue vacio para inicializar formularios. */
export function emptyAddress(countryCode = ''): AddressValue {
  return {
    street: '',
    number: '',
    colonia: '',
    city: '',
    region: '',
    regionCode: '',
    postalCode: '',
    countryCode: countryCode.toLowerCase(),
  };
}

export function validateAddress(value: AddressValue): Partial<Record<keyof AddressValue, string>> {
  const errors: Partial<Record<keyof AddressValue, string>> = {};
  if (!value.countryCode) errors.countryCode = 'Selecciona un país';
  if (!value.region.trim()) errors.region = 'Selecciona / escribe una opción';
  if (!value.city.trim()) errors.city = 'La ciudad es requerida';
  if (!value.postalCode.trim()) errors.postalCode = 'El código postal es requerido';
  if (!value.street.trim()) errors.street = 'La calle es requerida';
  if (!value.number.trim()) errors.number = 'El número es requerido';
  return errors;
}

/**
 * Serializa al formato string del backend:
 * "Calle Numero, Colonia, Ciudad, Region, CP, Pais"
 */
export function serializeAddress(v: AddressValue): string {
  const country = getCountrySync(v.countryCode)?.name || v.countryCode || '';
  return [
    [v.street, v.number].filter(Boolean).join(' '),
    v.colonia,
    v.city,
    v.region,
    v.postalCode,
    country,
  ].filter(Boolean).join(', ');
}

/**
 * Best-effort parse del formato string del backend. countryCode queda
 * vacio porque solo se puede resolver al alpha2 una vez cargado el
 * cache de paises (matching por nombre). El componente AddressFields
 * carga countries al montar y permite al usuario seleccionar el correcto.
 */
export function parseAddress(address: string): AddressValue {
  if (!address) return emptyAddress();
  const parts = address.split(',').map((s) => s.trim());
  const streetFull = parts[0] || '';
  const streetMatch = streetFull.match(/^(.+?)\s+(\d+\S*)$/);
  const street = streetMatch ? streetMatch[1] : streetFull;
  const number = streetMatch ? streetMatch[2] : '';
  const colonia = parts[1] || '';
  const city = parts[2] || '';
  const region = parts[3] || '';
  const postalCode = parts[4] || '';
  const countryName = parts[5] || '';
  // countryCode queda vacio: el componente cargara la lista y el user
  // puede re-seleccionar si es necesario. Best-effort: lookup sincrono
  // en el cache si ya esta cargado.
  const country = countryName
    ? // Lookup case-insensitive por nombre
      (typeof window !== 'undefined' ? (window as any).__countriesCacheByName?.[countryName.toLowerCase()] : '')
    : '';
  return {
    street,
    number,
    colonia,
    city,
    region,
    regionCode: '',
    postalCode,
    countryCode: country || '',
  };
}
