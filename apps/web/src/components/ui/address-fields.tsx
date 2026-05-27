'use client';

import { COUNTRIES_GEO, getCountry, getRegionLabel, getRegions } from '@/lib/geo-data';

export interface AddressValue {
  street: string;
  number: string;
  colonia: string;
  city: string;
  region: string;       // estado/provincia/departamento
  postalCode: string;
  countryCode: string;  // ISO 2 letras
}

interface Props {
  value: AddressValue;
  onChange: (next: AddressValue) => void;
  /** Mostrar campos opcionales (colonia, numero) en columnas. Default true. */
  showOptional?: boolean;
  /** Marca todos los campos requeridos visualmente. Default false (opcional). */
  required?: boolean;
  /** Errores por campo para resaltar bordes en rojo. */
  errors?: Partial<Record<keyof AddressValue, string>>;
  /** Clase extra para el contenedor. */
  className?: string;
}

const TEAL = '#008080';

/**
 * Bloque reutilizable de direccion con droplists de pais y region
 * (estado/provincia/departamento segun pais). Calle, numero, colonia,
 * ciudad y CP son texto libre — agregar dropdown de ciudades requeriria
 * dataset mucho mas grande (ver project_v2_geo_data.md).
 *
 * El label de region cambia segun el pais (Mexico="Estado",
 * Argentina="Provincia", Colombia="Departamento", Chile="Region", etc.).
 */
export function AddressFields({
  value,
  onChange,
  showOptional = true,
  required = false,
  errors = {},
  className = '',
}: Props) {
  const country = getCountry(value.countryCode);
  const regionLabel = getRegionLabel(value.countryCode);
  const regions = getRegions(value.countryCode);
  const reqMark = required ? <span className="text-red-500"> *</span> : null;

  const update = (key: keyof AddressValue, v: string) => {
    onChange({ ...value, [key]: v });
  };

  const onCountryChange = (code: string) => {
    // Al cambiar pais, reseteamos region si no existe en la nueva lista.
    const newRegions = getRegions(code);
    const nextRegion = newRegions.includes(value.region) ? value.region : '';
    onChange({ ...value, countryCode: code, region: nextRegion });
  };

  const baseInput = 'w-full px-3 py-2.5 border rounded-xl text-sm focus:ring-2 focus:outline-none focus:border-transparent';
  const inputClass = (err?: string) => `${baseInput} ${err ? 'border-red-400' : 'border-gray-200'}`;
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
          <option value="">Selecciona un país</option>
          {COUNTRIES_GEO.map((c) => (
            <option key={c.code} value={c.code}>{c.name}</option>
          ))}
        </select>
        {errors.countryCode && <p className="mt-1 text-xs text-red-600">{errors.countryCode}</p>}
      </div>

      {/* Region (etiqueta dinamica) */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">
          {regionLabel}{reqMark}
        </label>
        <select
          value={value.region}
          onChange={(e) => update('region', e.target.value)}
          disabled={!country || regions.length === 0}
          className={`${inputClass(errors.region)} bg-white disabled:bg-gray-100 disabled:cursor-not-allowed`}
          style={ringStyle}
        >
          <option value="">
            {country ? `Selecciona ${regionLabel.toLowerCase()}` : 'Selecciona un país primero'}
          </option>
          {regions.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        {errors.region && <p className="mt-1 text-xs text-red-600">{errors.region}</p>}
      </div>

      {/* Ciudad + CP */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">Ciudad{reqMark}</label>
          <input
            type="text"
            value={value.city}
            onChange={(e) => update('city', e.target.value)}
            placeholder="Ciudad"
            className={inputClass(errors.city)}
            style={ringStyle}
          />
          {errors.city && <p className="mt-1 text-xs text-red-600">{errors.city}</p>}
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">Código postal{reqMark}</label>
          <input
            type="text"
            inputMode="numeric"
            value={value.postalCode}
            onChange={(e) => update('postalCode', e.target.value.replace(/\D/g, '').slice(0, 10))}
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
            onChange={(e) => update('street', e.target.value)}
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
            onChange={(e) => update('number', e.target.value)}
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
            onChange={(e) => update('colonia', e.target.value)}
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
    postalCode: '',
    countryCode,
  };
}

/**
 * Valida que los campos obligatorios esten llenos. Retorna un objeto de
 * errores (vacio si todo OK). Pensado para usar en submit del form.
 */
export function validateAddress(value: AddressValue): Partial<Record<keyof AddressValue, string>> {
  const errors: Partial<Record<keyof AddressValue, string>> = {};
  if (!value.countryCode) errors.countryCode = 'Selecciona un país';
  if (!value.region) errors.region = 'Selecciona una opción';
  if (!value.city.trim()) errors.city = 'La ciudad es requerida';
  if (!value.postalCode.trim()) errors.postalCode = 'El código postal es requerido';
  if (!value.street.trim()) errors.street = 'La calle es requerida';
  if (!value.number.trim()) errors.number = 'El número es requerido';
  return errors;
}

/**
 * Serializa la direccion al formato string que usa el backend para
 * `User.address` y similares ("Calle 123, Colonia, Ciudad, Estado, CP, Pais").
 * Coincide con buildAddress() del edit-profile actual.
 */
export function serializeAddress(v: AddressValue): string {
  const country = getCountry(v.countryCode)?.name || v.countryCode || '';
  return [
    [v.street, v.number].filter(Boolean).join(' '),
    v.colonia,
    v.city,
    v.region,
    v.postalCode,
    country,
  ].filter(Boolean).join(', ');
}

/** Best-effort parse del formato string del backend. */
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
  const country = COUNTRIES_GEO.find((c) => c.name === countryName);
  return {
    street,
    number,
    colonia,
    city,
    region,
    postalCode,
    countryCode: country?.code || '',
  };
}
