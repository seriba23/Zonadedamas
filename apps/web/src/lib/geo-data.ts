// ─────────────────────────────────────────────────────────────────────────────
// MÓDULO: geo-data.ts
// ─────────────────────────────────────────────────────────────────────────────
// Carga y expone datos geográficos (países, estados/provincias, ciudades)
// desde archivos JSON públicos ubicados en apps/web/public/data/.
//
// Patrón de uso:
//   1) País: siempre un dropdown (countries-es.json)
//   2) Estado/Provincia/etc: dropdown si subdivisions.json tiene datos
//      para ese país; si no, se muestra un input de texto libre.
//   3) Ciudad: dropdown solo para México (mx_cities_by_state.json);
//      para el resto del mundo, input libre.
//
// Los 3 JSON se cachean en memoria después del primer fetch para no
// repetir la descarga cada vez que el componente se re-renderiza.
// Datos geograficos cargados desde JSON publico (apps/web/public/data/).
// Patron tomado del proyecto zonadecaballeros donde ya estaba probado:
//
//   1) Pais: dropdown SIEMPRE (countries-es.json)
//   2) Estado/Provincia/etc: dropdown si subdivisions.json tiene datos
//      para ese pais, sino fallback a input libre.
//   3) Ciudad: dropdown si MX + estado tiene mapeo, sino input libre.
//
// Los 3 JSON se cachean en memoria despues del primer fetch.

// ─────────────────────────────────────────────────────────────────────────────
// INTERFAZ: Country
// ─────────────────────────────────────────────────────────────────────────────
// Representa un país tal como viene en countries-es.json.
//
// Campos con `?` son opcionales (pueden no estar en el JSON):
//   id     → número de orden en el archivo (no siempre presente)
//   alpha2 → código de 2 letras minúsculas ISO 3166-1 (obligatorio), ej. "mx"
//   alpha3 → código de 3 letras (opcional), ej. "mex"
//   name   → nombre en español (obligatorio), ej. "México"
export interface Country {
  id?: number;
  alpha2: string; // ISO 3166-1 alpha-2 lowercase (ej. "mx")
  alpha3?: string;
  name: string;   // Nombre en español (ej. "México")
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERFAZ: SubdivisionRaw
// ─────────────────────────────────────────────────────────────────────────────
// Representa una entrada CRUDA del JSON subdivisions.json, que proviene de
// diversas fuentes con distintos nombres de campo. Por eso hay múltiples campos
// opcionales alternativos para los mismos datos (p.ej. el código del país puede
// llamarse "country", "country_code", "countryCode" o "iso2").
// La función normalizeSubdivision() unifica esto en el tipo Subdivision.
export interface SubdivisionRaw {
  country?: string;        // nombre del país (variante 1)
  country_code?: string;   // código del país estilo snake_case (variante 2)
  countryCode?: string;    // código del país estilo camelCase (variante 3)
  iso2?: string;           // código ISO 2 letras del país (variante 4)
  code?: string;           // código de la subdivisión (variante 1)
  isoCode?: string;        // código ISO de la subdivisión (variante 2)
  state_code?: string;     // código estilo snake_case (variante 3)
  name: string;            // nombre de la subdivisión (siempre presente)
  name_en?: string;        // nombre en inglés (opcional)
  type?: string;           // tipo: state, province, department, region, parish, etc.
  parent?: string;         // código del padre (para subdivisiones anidadas)
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERFAZ: Subdivision
// ─────────────────────────────────────────────────────────────────────────────
// Versión NORMALIZADA de una subdivisión (estado, provincia, departamento, etc.)
// después de pasar por normalizeSubdivision(). Todos los campos son obligatorios
// y tienen nombres uniformes, sin importar cómo vinieron en el JSON original.
export interface Subdivision {
  country: string; // código del país en MAYÚSCULAS, ej. "MX"
  code: string;    // código de la subdivisión, ej. "MX-AGU"
  name: string;    // nombre, ej. "Aguascalientes"
  type: string;    // tipo normalizado a minúsculas, ej. "state"
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTE: TYPE_LABEL_MAP
// ─────────────────────────────────────────────────────────────────────────────
// Diccionario que traduce el nombre técnico del tipo de subdivisión (en inglés,
// como viene en el dataset) a su etiqueta en español para mostrar al usuario.
// Por ejemplo: si el campo `type` es "state", el label del select será "Estado".
//
// Record<string, string> significa: un objeto donde las llaves son strings
// y los valores también son strings (un diccionario de string→string).
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

// ─────────────────────────────────────────────────────────────────────────────
// VARIABLES DE CACHÉ EN MEMORIA
// ─────────────────────────────────────────────────────────────────────────────
// Estas variables viven en el módulo (fuera de cualquier componente o función)
// y se mantienen mientras la página esté abierta. La primera vez que se llama
// a loadCountries() etc., el valor es null y se hace el fetch. En llamadas
// posteriores ya tiene datos y se devuelven directamente sin red.
//
// `Country[] | null` → puede ser un array de Country o null (si aún no cargó).
// Cache en memoria — se llena en el primer fetch y se reusa.
let countriesCache: Country[] | null = null;
let subdivisionsCache: Subdivision[] | null = null;
// Record<string, string[]> → cada llave es el código de estado (ej. "AGU"),
// su valor es la lista de ciudades de ese estado.
let mxCitiesCache: Record<string, string[]> | null = null;

// ─────────────────────────────────────────────────────────────────────────────
// VARIABLES DE PROMESA EN VUELO
// ─────────────────────────────────────────────────────────────────────────────
// Si dos componentes llaman a loadCountries() al mismo tiempo antes de que el
// fetch termine, sin estas variables se harían DOS peticiones de red.
// Con ellas, el segundo llamador recibe la MISMA promesa que ya está en curso.
// Se anulan a null una vez que el fetch termina (ver dentro de cada loader).
// Cargas paralelizables: pueden iniciarse al mismo tiempo si se llaman
// individualmente. Cada loader devuelve la misma promesa si ya esta en curso.
let countriesPromise: Promise<Country[]> | null = null;
let subdivisionsPromise: Promise<Subdivision[]> | null = null;
let mxCitiesPromise: Promise<Record<string, string[]>> | null = null;

// ─────────────────────────────────────────────────────────────────────────────
// FUNCIÓN INTERNA: normalizeSubdivision
// ─────────────────────────────────────────────────────────────────────────────
// Convierte una subdivisión cruda (SubdivisionRaw) a una subdivisión
// normalizada (Subdivision) con campos uniformes y valores limpios.
//
// Parámetros:
//   s → un objeto SubdivisionRaw tal como viene del JSON
//
// Devuelve: un objeto Subdivision con los 4 campos obligatorios.
//
// Operador ?? (nullish coalescing / "nulo o indefinido"):
//   a ?? b → si `a` es null o undefined, usa `b`; si tiene cualquier otro
//   valor (incluso 0 o ""), usa `a`.
//   Se diferencia de || en que || también trata "" y 0 como falsy.
//   Aquí encadenamos múltiples ?? para probar varios nombres de campo
//   alternativos hasta encontrar el primero que tenga valor.
function normalizeSubdivision(s: SubdivisionRaw): Subdivision {
  // Intentamos obtener el código del país desde 4 nombres de campo posibles.
  // .toString() garantiza que sea string aunque venga como número.
  // .toUpperCase() normaliza a mayúsculas (ej. "mx" → "MX").
  const country = (s.country_code ?? s.countryCode ?? s.country ?? s.iso2 ?? '').toString().toUpperCase();

  // Código de la subdivisión: probamos 3 nombres de campo posibles.
  const code = (s.code ?? s.isoCode ?? s.state_code ?? '').toString();

  // Nombre: siempre existe (campo obligatorio en SubdivisionRaw), pero
  // el ?? '' es un seguro extra contra valores inesperados.
  const name = (s.name ?? '').toString();

  // Tipo: lo pasamos a minúsculas para que coincida con TYPE_LABEL_MAP.
  const type = (s.type ?? '').toString().toLowerCase();

  return { country, code, name, type };
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNCIÓN: loadCountries
// ─────────────────────────────────────────────────────────────────────────────
// Carga la lista de países desde /data/countries-es.json y la devuelve
// ordenada alfabéticamente en español.
//
// Devuelve: Promise<Country[]> → una promesa que resuelve con el array de países.
//
// Patrón de caché:
//   1. Si ya tenemos datos en `countriesCache`, los devolvemos al instante.
//   2. Si hay una petición en curso (`countriesPromise`), devolvemos ESA misma
//      promesa para que múltiples llamadores esperen el mismo fetch.
//   3. Si no hay nada, iniciamos el fetch y guardamos la promesa.
//
// .then() encadena operaciones sobre la promesa:
//   fetch() → promesa de respuesta HTTP
//   .then(r => r.json()) → parsea el cuerpo como JSON
//   .then(data => ...) → recibimos el array y lo ordenamos
//
// a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }) →
//   compara dos strings en español ignorando mayúsculas y tildes
//   para que el sort sea correcto en castellano.
export async function loadCountries(): Promise<Country[]> {
  if (countriesCache) return countriesCache;     // ya cargado: devolver caché
  if (countriesPromise) return countriesPromise; // carga en curso: compartir promesa
  countriesPromise = fetch('/data/countries-es.json')
    .then((r) => r.json())
    .then((data: Country[]) => {
      // sort((a, b) => ...) ordena el array in-place usando el comparador.
      // localeCompare devuelve negativo, 0 o positivo según el orden de a vs b.
      countriesCache = data.sort((a, b) =>
        a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }),
      );
      return countriesCache;
    });
  return countriesPromise;
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNCIÓN: loadSubdivisions
// ─────────────────────────────────────────────────────────────────────────────
// Carga todas las subdivisiones del mundo desde /data/subdivisions.json y
// las normaliza con normalizeSubdivision() para que tengan campos uniformes.
//
// Devuelve: Promise<Subdivision[]>
//
// .map(normalizeSubdivision) → aplica normalizeSubdivision a CADA elemento
// del array `data`, creando un nuevo array con los resultados normalizados.
// Es equivalente a recorrer el array con un for y transformar cada elemento.
export async function loadSubdivisions(): Promise<Subdivision[]> {
  if (subdivisionsCache) return subdivisionsCache;
  if (subdivisionsPromise) return subdivisionsPromise;
  subdivisionsPromise = fetch('/data/subdivisions.json')
    .then((r) => r.json())
    .then((data: SubdivisionRaw[]) => {
      subdivisionsCache = data.map(normalizeSubdivision); // normaliza cada entrada del array
      return subdivisionsCache;
    });
  return subdivisionsPromise;
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNCIÓN: loadMxCities
// ─────────────────────────────────────────────────────────────────────────────
// Carga el mapa de ciudades mexicanas por estado desde mx_cities_by_state.json.
// El JSON tiene la forma: { "AGU": ["Aguascalientes", "Calvillo", ...], ... }
//
// Devuelve: Promise<Record<string, string[]>>
// El objeto devuelto tiene como llaves el código de estado (ej. "AGU") y como
// valores el array de ciudades de ese estado.
export async function loadMxCities(): Promise<Record<string, string[]>> {
  if (mxCitiesCache) return mxCitiesCache;
  if (mxCitiesPromise) return mxCitiesPromise;
  mxCitiesPromise = fetch('/data/mx_cities_by_state.json')
    .then((r) => r.json())
    .then((data: Record<string, string[]>) => {
      mxCitiesCache = data; // el JSON ya tiene el formato correcto, no hay que transformarlo
      return mxCitiesCache;
    });
  return mxCitiesPromise;
}

/**
 * Retorna las subdivisiones de un pais ordenadas alfabeticamente.
 * Vacio si el pais no tiene subdivisiones en el dataset.
 */
// ─────────────────────────────────────────────────────────────────────────────
// FUNCIÓN: getSubdivisionsOfCountry
// ─────────────────────────────────────────────────────────────────────────────
// Obtiene las subdivisiones (estados, provincias, etc.) de un país concreto.
//
// Parámetros:
//   countryCode → código ISO 2 letras del país (ej. "MX", "ES", "CO")
//                 puede venir en minúsculas, lo convertimos internamente.
//
// Devuelve: Promise<Subdivision[]> → lista ordenada de subdivisiones del país.
//           Array vacío si el país no tiene datos o el código es vacío.
//
// .filter((s) => ...) → crea un nuevo array con SOLO los elementos que
//   cumplan la condición. Aquí filtramos por:
//   s.country === cc → que pertenezca al país pedido
//   s.code          → que tenga un código (no vacío/undefined)
//   s.name          → que tenga un nombre (no vacío/undefined)
//   Todas las condiciones se combinan con && (AND lógico).
export async function getSubdivisionsOfCountry(countryCode: string): Promise<Subdivision[]> {
  if (!countryCode) return [];               // guarda ante código vacío
  const cc = countryCode.toUpperCase();      // normalizamos a mayúsculas para comparar
  const subs = await loadSubdivisions();     // obtenemos (o esperamos) todas las subdivisiones
  return subs
    .filter((s) => s.country === cc && s.code && s.name) // solo las del país con código y nombre
    .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })); // alfabético español
}

/**
 * Para México: devuelve las ciudades de un estado dado el codigo ISO de la
 * subdivision (ej. "MX-AGU" o "AGU"). Vacio si no hay mapeo.
 */
// ─────────────────────────────────────────────────────────────────────────────
// FUNCIÓN: getMxCitiesOfState
// ─────────────────────────────────────────────────────────────────────────────
// Devuelve la lista de ciudades de un estado de México, dado el código del
// estado en cualquiera de sus dos formatos posibles: "MX-AGU" o "AGU".
//
// Parámetros:
//   stateCode → código del estado, p.ej. "MX-AGU" (formato ISO completo) o
//               simplemente "AGU" (parte después del guion).
//
// Devuelve: Promise<string[]> → lista de ciudades ordenada y sin duplicados.
//           Array vacío si no hay datos para ese estado.
export async function getMxCitiesOfState(stateCode: string): Promise<string[]> {
  if (!stateCode) return []; // guarda ante código vacío
  const cities = await loadMxCities(); // obtenemos el mapa de ciudades

  // Acepta tanto "MX-AGU" como solo "AGU".
  // .includes('-') → comprueba si el string contiene un guion.
  // .split('-')[1] → divide el string por '-' y toma el segundo elemento:
  //   "MX-AGU".split('-') → ["MX", "AGU"] → [1] = "AGU"
  // Operador ternario: condición ? valorSiTrue : valorSiFalse
  const part = stateCode.includes('-') ? stateCode.split('-')[1] : stateCode;

  // Buscamos por el código corto primero, luego por el código original completo.
  // || [] → si ninguno de los dos encuentra datos, usamos array vacío.
  const list = cities[part] || cities[stateCode] || [];

  // Procesamos la lista para limpiarla y eliminar duplicados:
  // list.map((c) => c.trim())  → recorre cada ciudad y elimina espacios extra
  // .filter(Boolean)           → elimina strings vacíos (falsy)
  // new Set(...)               → elimina duplicados (Set solo guarda valores únicos)
  // [...new Set(...)]          → el spread (...) convierte el Set de vuelta a array
  // .sort(...)                 → ordena alfabéticamente en español
  return [...new Set(list.map((c) => c.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'es', { sensitivity: 'base' }),
  );
}

/**
 * Devuelve el label del nivel administrativo segun el "type" mas comun
 * entre las subdivisiones del pais. Default "Estado / Provincia" cuando
 * no se puede determinar.
 */
// ─────────────────────────────────────────────────────────────────────────────
// FUNCIÓN: regionLabelFromSubdivisions
// ─────────────────────────────────────────────────────────────────────────────
// Determina cómo se llama el nivel administrativo en el país elegido y
// devuelve la etiqueta en español para el campo del formulario.
// Por ejemplo: España → "Comunidad autónoma", Colombia → "Departamento".
//
// Parámetros:
//   subs → array de subdivisiones YA FILTRADAS por país (el resultado de
//           getSubdivisionsOfCountry).
//
// Devuelve: string con el label, p.ej. "Estado", "Provincia", "Departamento".
//           Si no puede determinarlo, devuelve "Estado / Provincia" como default.
//
// Algoritmo:
//   1. Contamos cuántas veces aparece cada "type" en el array.
//   2. Encontramos el type más frecuente.
//   3. Lo mapeamos a español con TYPE_LABEL_MAP.
export function regionLabelFromSubdivisions(subs: Subdivision[]): string {
  if (subs.length === 0) return 'Estado / Provincia'; // sin datos: valor por defecto

  // Diccionario vacío donde acumulamos el conteo de cada tipo.
  // Por ejemplo: { "state": 32, "department": 2 }
  // Tomar el type mas frecuente
  const counts: Record<string, number> = {};

  // for...of recorre cada elemento del array (aquí cada subdivisión s).
  for (const s of subs) {
    if (!s.type) continue; // `continue` salta al siguiente elemento si no hay tipo
    // Si el type ya existe en counts, sumamos 1; si no, empezamos en 1.
    // (counts[s.type] || 0) → si undefined, usa 0
    counts[s.type] = (counts[s.type] || 0) + 1;
  }

  // Object.entries(counts) → convierte el objeto en un array de pares [llave, valor],
  //   p.ej. [["state", 32], ["department", 2]]
  // .sort((a, b) => b[1] - a[1]) → ordena de MAYOR a menor por el conteo (índice 1)
  // [0] → tomamos el primer elemento (el más frecuente)
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];

  if (!top) return 'Estado / Provincia'; // sin tipos: valor por defecto

  // top[0] es la llave (el nombre del tipo), p.ej. "state".
  // TYPE_LABEL_MAP[top[0]] busca su traducción. Si no está en el mapa, usamos default.
  return TYPE_LABEL_MAP[top[0]] || 'Estado / Provincia';
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNCIÓN: getCountrySync
// ─────────────────────────────────────────────────────────────────────────────
// Busca un país por su código alpha2 de forma SÍNCRONA (sin await/promesas).
// Solo funciona si loadCountries() ya fue llamado antes y el caché está lleno.
//
// Parámetros:
//   alpha2 → código ISO de 2 letras del país (ej. "mx", "es"). Puede ser
//            null o undefined (por eso el tipo es string | null | undefined).
//
// Devuelve: el objeto Country si lo encuentra, undefined si no.
//           El tipo de retorno "Country | undefined" indica ambas posibilidades.
//
// Uso típico: para mostrar el nombre del país en la UI sin tener que cargar
// el JSON de nuevo si ya se cargó previamente.
/** Lookup sincrono usando el cache (si esta cargado). */
export function getCountrySync(alpha2: string | null | undefined): Country | undefined {
  if (!alpha2 || !countriesCache) return undefined; // sin código o sin caché: imposible buscar
  const code = alpha2.toLowerCase(); // normalizamos a minúsculas para comparar con los datos
  // .find() recorre el array y devuelve el PRIMER elemento que cumple la condición.
  // Si ninguno la cumple, devuelve undefined.
  return countriesCache.find((c) => c.alpha2 === code);
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNCIÓN: countryHasCityDropdown
// ─────────────────────────────────────────────────────────────────────────────
// Indica si el país seleccionado tiene un dropdown de ciudades disponible.
// Por ahora solo México (MX) tiene ese tratamiento especial; todos los demás
// países usan un campo de texto libre para la ciudad.
//
// Parámetros:
//   alpha2 → código del país (puede ser null/undefined si no hay selección)
//
// Devuelve: boolean → true si es México, false para cualquier otro país.
//
// (alpha2 || '') → si alpha2 es null o undefined, usa string vacío.
// .toUpperCase() → normalizamos para comparar, sin importar si vino en minúsculas.
/** Mexico = caso especial con ciudades dropdown. Resto: ciudad libre. */
export function countryHasCityDropdown(alpha2: string | null | undefined): boolean {
  return (alpha2 || '').toUpperCase() === 'MX';
}
