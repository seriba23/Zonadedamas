// Datos geograficos cargados desde JSON publico (apps/web/public/data/).
// Patron tomado del proyecto zonadecaballeros donde ya estaba probado:
//
//   1) Pais: dropdown SIEMPRE (countries-es.json)
//   2) Estado/Provincia/etc: dropdown si subdivisions.json tiene datos
//      para ese pais, sino fallback a input libre.
//   3) Ciudad: dropdown si MX + estado tiene mapeo, sino input libre.
//
// Los 3 JSON se cachean en memoria despues del primer fetch.

export interface Country {
  id?: number;
  alpha2: string; // ISO 3166-1 alpha-2 lowercase (ej. "mx")
  alpha3?: string;
  name: string;   // Nombre en español (ej. "México")
}

export interface SubdivisionRaw {
  country?: string;
  country_code?: string;
  countryCode?: string;
  iso2?: string;
  code?: string;
  isoCode?: string;
  state_code?: string;
  name: string;
  name_en?: string;
  type?: string;  // state, province, department, region, parish, etc.
  parent?: string;
}

export interface Subdivision {
  country: string; // upper-case
  code: string;
  name: string;
  type: string;
}

// Mapeo de "type" del dataset → label en español.
const TYPE_LABEL_MAP: Record<string, string> = {
  state: 'Estado',
  province: 'Provincia',
  department: 'Departamento',
  region: 'Región',
  district: 'Distrito',
  parish: 'Parroquia',
  emirate: 'Emirato',
  municipality: 'Municipalidad',
  division: 'División',
  city: 'Ciudad',
  county: 'Condado',
  prefecture: 'Prefectura',
  autonomous_community: 'Comunidad autónoma',
  governorate: 'Gobernación',
  republic: 'República',
  territory: 'Territorio',
};

// Cache en memoria — se llena en el primer fetch y se reusa.
let countriesCache: Country[] | null = null;
let subdivisionsCache: Subdivision[] | null = null;
let mxCitiesCache: Record<string, string[]> | null = null;

// Cargas paralelizables: pueden iniciarse al mismo tiempo si se llaman
// individualmente. Cada loader devuelve la misma promesa si ya esta en curso.
let countriesPromise: Promise<Country[]> | null = null;
let subdivisionsPromise: Promise<Subdivision[]> | null = null;
let mxCitiesPromise: Promise<Record<string, string[]>> | null = null;

function normalizeSubdivision(s: SubdivisionRaw): Subdivision {
  const country = (s.country_code ?? s.countryCode ?? s.country ?? s.iso2 ?? '').toString().toUpperCase();
  const code = (s.code ?? s.isoCode ?? s.state_code ?? '').toString();
  const name = (s.name ?? '').toString();
  const type = (s.type ?? '').toString().toLowerCase();
  return { country, code, name, type };
}

export async function loadCountries(): Promise<Country[]> {
  if (countriesCache) return countriesCache;
  if (countriesPromise) return countriesPromise;
  countriesPromise = fetch('/data/countries-es.json')
    .then((r) => r.json())
    .then((data: Country[]) => {
      countriesCache = data.sort((a, b) =>
        a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }),
      );
      return countriesCache;
    });
  return countriesPromise;
}

export async function loadSubdivisions(): Promise<Subdivision[]> {
  if (subdivisionsCache) return subdivisionsCache;
  if (subdivisionsPromise) return subdivisionsPromise;
  subdivisionsPromise = fetch('/data/subdivisions.json')
    .then((r) => r.json())
    .then((data: SubdivisionRaw[]) => {
      subdivisionsCache = data.map(normalizeSubdivision);
      return subdivisionsCache;
    });
  return subdivisionsPromise;
}

export async function loadMxCities(): Promise<Record<string, string[]>> {
  if (mxCitiesCache) return mxCitiesCache;
  if (mxCitiesPromise) return mxCitiesPromise;
  mxCitiesPromise = fetch('/data/mx_cities_by_state.json')
    .then((r) => r.json())
    .then((data: Record<string, string[]>) => {
      mxCitiesCache = data;
      return mxCitiesCache;
    });
  return mxCitiesPromise;
}

/**
 * Retorna las subdivisiones de un pais ordenadas alfabeticamente.
 * Vacio si el pais no tiene subdivisiones en el dataset.
 */
export async function getSubdivisionsOfCountry(countryCode: string): Promise<Subdivision[]> {
  if (!countryCode) return [];
  const cc = countryCode.toUpperCase();
  const subs = await loadSubdivisions();
  return subs
    .filter((s) => s.country === cc && s.code && s.name)
    .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
}

/**
 * Para México: devuelve las ciudades de un estado dado el codigo ISO de la
 * subdivision (ej. "MX-AGU" o "AGU"). Vacio si no hay mapeo.
 */
export async function getMxCitiesOfState(stateCode: string): Promise<string[]> {
  if (!stateCode) return [];
  const cities = await loadMxCities();
  // Acepta tanto "MX-AGU" como solo "AGU".
  const part = stateCode.includes('-') ? stateCode.split('-')[1] : stateCode;
  const list = cities[part] || cities[stateCode] || [];
  return [...new Set(list.map((c) => c.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'es', { sensitivity: 'base' }),
  );
}

/**
 * Devuelve el label del nivel administrativo segun el "type" mas comun
 * entre las subdivisiones del pais. Default "Estado / Provincia" cuando
 * no se puede determinar.
 */
export function regionLabelFromSubdivisions(subs: Subdivision[]): string {
  if (subs.length === 0) return 'Estado / Provincia';
  // Tomar el type mas frecuente
  const counts: Record<string, number> = {};
  for (const s of subs) {
    if (!s.type) continue;
    counts[s.type] = (counts[s.type] || 0) + 1;
  }
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  if (!top) return 'Estado / Provincia';
  return TYPE_LABEL_MAP[top[0]] || 'Estado / Provincia';
}

/** Lookup sincrono usando el cache (si esta cargado). */
export function getCountrySync(alpha2: string | null | undefined): Country | undefined {
  if (!alpha2 || !countriesCache) return undefined;
  const code = alpha2.toLowerCase();
  return countriesCache.find((c) => c.alpha2 === code);
}

/** Mexico = caso especial con ciudades dropdown. Resto: ciudad libre. */
export function countryHasCityDropdown(alpha2: string | null | undefined): boolean {
  return (alpha2 || '').toUpperCase() === 'MX';
}
