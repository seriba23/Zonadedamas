'use client';
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ address-fields.tsx                                                      │
// │                                                                         │
// │ ¿QUÉ HACE ESTE COMPONENTE?                                              │
// │ Muestra un formulario completo de dirección postal con campos           │
// │ inteligentes que se adaptan al país elegido:                            │
// │  - País: siempre un dropdown (~250 opciones del JSON de geo-data)       │
// │  - Región (estado/provincia): dropdown si el dataset tiene subdivisiones│
// │    para ese país; si no, un input de texto libre                        │
// │  - Ciudad: dropdown solo para México; para el resto, input libre        │
// │  - Código postal, calle, número y colonia                               │
// │                                                                         │
// │ El componente es CONTROLADO: no guarda su propio estado principal,      │
// │ sino que recibe "value" del padre y llama "onChange" con cada cambio.  │
// │                                                                         │
// │ Además exporta funciones utilitarias:                                   │
// │  emptyAddress()    → valor vacío para inicializar formularios           │
// │  validateAddress() → valida y devuelve errores                          │
// │  serializeAddress()→ convierte AddressValue a string para el backend    │
// │  parseAddress()    → convierte el string del backend a AddressValue     │
// │  resolveRegionCode() → encuentra el código ISO de una región por nombre │
// └─────────────────────────────────────────────────────────────────────────┘

// useEffect: ejecutar código tras el render (cargar datos, etc.)
// useState: guardar estado local del componente
import { useEffect, useState } from 'react';

// Importamos funciones y tipos del módulo de datos geográficos del proyecto
import {
  loadCountries,           // Carga la lista de ~250 países desde /data/countries-es.json
  getSubdivisionsOfCountry,// Carga estados/provincias de un país dado
  getMxCitiesOfState,      // Carga ciudades mexicanas de un estado
  regionLabelFromSubdivisions, // Devuelve la etiqueta correcta ("Estado", "Provincia", etc.)
  getCountrySync,          // Versión sincrónica de buscar un país (para la serialización)
  countryHasCityDropdown,  // Devuelve true si ese país tiene dropdown de ciudades (por ahora solo MX)
  type Country,            // Tipo TypeScript: { alpha2: string; name: string }
  type Subdivision,        // Tipo TypeScript: { code: string; name: string }
} from '@/lib/geo-data';

// ─── INTERFAZ PÚBLICA: AddressValue ──────────────────────────────────────────
// Este es el "contrato" de cómo se ve una dirección en este sistema.
// El padre del componente debe usar este tipo para el estado de la dirección.
export interface AddressValue {
  street: string;       // Nombre de la calle
  number: string;       // Número exterior
  colonia: string;      // Colonia o fraccionamiento (opcional)
  city: string;         // Ciudad
  region: string;       // Nombre del estado/provincia como texto libre
  regionCode: string;   // Codigo ISO de la subdivision (ej. "MX-JAL"); vacio si region es libre
  postalCode: string;   // Código postal
  countryCode: string;  // ISO alpha2 lowercase (ej. "mx"); coincide con el dataset
}

// ─── INTERFAZ DE PROPS ───────────────────────────────────────────────────────
interface Props {
  value: AddressValue;                                        // Dirección actual (del padre)
  onChange: (next: AddressValue) => void;                    // Callback para notificar cambios
  showOptional?: boolean;                                     // ¿Mostrar el campo "Colonia"? (default true)
  required?: boolean;                                         // ¿Mostrar asterisco rojo en campos?
  errors?: Partial<Record<keyof AddressValue, string>>;      // Mensajes de error por campo
  className?: string;                                         // Clases CSS adicionales para el wrapper
}
// Nota: Partial<Record<...>> significa que no todos los campos son obligatorios;
// pueden venir solo los campos que tienen error.

// Color teal (verde-azulado) de la identidad visual de la plataforma
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
  showOptional = true,   // Por defecto muestra el campo "Colonia"
  required = false,
  errors = {},           // Por defecto sin errores
  className = '',
}: Props) {

  // ─── ESTADO LOCAL ─────────────────────────────────────────────────────────

  // Lista de países para el dropdown (cargada desde JSON la primera vez)
  const [countries, setCountries] = useState<Country[]>([]);

  // Lista de subdivisiones (estados, provincias, etc.) del país seleccionado
  const [subdivisions, setSubdivisions] = useState<Subdivision[]>([]);

  // Lista de ciudades de México para el estado seleccionado (vacío si no es MX)
  const [mxCities, setMxCities] = useState<string[]>([]);

  // true mientras las subdivisiones se están cargando (para mostrar "Cargando…")
  const [loadingSubs, setLoadingSubs] = useState(false);

  // ─── EFECTO 1: Cargar la lista de países al montar ─────────────────────────
  // [] → se ejecuta solo una vez cuando el componente aparece en pantalla.
  // .then(setCountries) → cuando la promesa resuelve, guarda el array en el estado.
  // .catch(() => setCountries([])) → si hay error, dejamos la lista vacía.
  useEffect(() => {
    loadCountries().then(setCountries).catch(() => setCountries([]));
  }, []);

  // ─── EFECTO 2: Cargar subdivisiones cuando el usuario cambia de país ───────
  // [value.countryCode] → se ejecuta cada vez que cambia el código del país.
  useEffect(() => {
    // Si no hay país seleccionado, limpiamos las subdivisiones
    if (!value.countryCode) {
      setSubdivisions([]);
      return;
    }
    setLoadingSubs(true); // Mostramos estado de carga
    getSubdivisionsOfCountry(value.countryCode)
      .then((subs) => {
        setSubdivisions(subs); // Guardamos las subdivisiones del nuevo país
        setLoadingSubs(false); // Ya no estamos cargando
      })
      .catch(() => {
        setSubdivisions([]); // Si falla la carga, dejamos vacío
        setLoadingSubs(false);
      });
  }, [value.countryCode]); // Solo reacciona al cambio de país

  // ─── EFECTO 3: Auto-resolver regionCode ────────────────────────────────────
  // Caso de uso: si el padre precarga una dirección que tiene "region" (nombre
  // en texto) pero no "regionCode" (código ISO), y las subdivisiones ya se
  // cargaron, buscamos el código correspondiente al nombre.
  // Ejemplo: region="Jalisco" → regionCode="MX-JAL"
  // Auto-resolver regionCode cuando se cumplen las 3 condiciones:
  //  - el value tiene region (nombre) pero NO regionCode
  //  - las subdivisions ya estan cargadas
  // Este useEffect reacciona tanto al cambio de value.region (caso
  // pre-fill diferido, ej. parseAddress del cliente que llega despues
  // de cargar el country) como al cambio de subdivisions (caso pre-fill
  // inicial, ej. al montar con value ya seteado pero subs cargando).
  useEffect(() => {
    // Si falta alguna de las tres condiciones, no hacemos nada
    if (!value.region || value.regionCode || subdivisions.length === 0) return;

    // Buscamos en las subdivisiones una que coincida con el nombre (sin importar mayúsculas)
    const match = subdivisions.find(
      (s) => s.name.toLowerCase() === value.region.toLowerCase(),
    );

    // Si encontramos coincidencia, actualizamos el regionCode en el padre
    if (match) onChange({ ...value, regionCode: match.code });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.region, value.regionCode, subdivisions]);

  // ─── EFECTO 4: Cargar ciudades de México según el estado elegido ───────────
  // Solo se activa si el país tiene dropdown de ciudades (actualmente solo MX)
  // y si hay un estado seleccionado (regionCode no vacío).
  useEffect(() => {
    if (!countryHasCityDropdown(value.countryCode) || !value.regionCode) {
      setMxCities([]); // Si no aplica, lista vacía
      return;
    }
    // Cargamos las ciudades del estado seleccionado
    getMxCitiesOfState(value.regionCode).then(setMxCities).catch(() => setMxCities([]));
  }, [value.countryCode, value.regionCode]); // Reacciona al país Y al estado

  // ─── CÁLCULOS DERIVADOS ───────────────────────────────────────────────────
  // Estos valores se calculan a partir del estado, no son estado propio.

  // Etiqueta dinámica para el campo de región: "Estado", "Provincia", "Departamento", etc.
  const regionLabel = regionLabelFromSubdivisions(subdivisions);

  // ¿Tenemos subdivisiones para mostrar un dropdown de región?
  const hasRegionDropdown = subdivisions.length > 0;

  // ¿El país seleccionado tiene dropdown de ciudades Y ya se cargaron ciudades?
  const hasCityDropdown = countryHasCityDropdown(value.countryCode) && mxCities.length > 0;

  // reqMark: asterisco rojo (*) para campos obligatorios, o null si no aplica.
  // Uso de ternario: condición ? valorSiTrue : valorSiFalse
  const reqMark = required ? <span className="text-red-500"> *</span> : null;

  // ─── FUNCIÓN AUXILIAR: update ─────────────────────────────────────────────
  // Crea una copia del objeto value con solo algunos campos cambiados.
  // patch: Partial<AddressValue> → objeto con SOLO los campos que cambiaron
  // { ...value, ...patch } → spread: copia todos los campos de value y sobreescribe los de patch
  const update = (patch: Partial<AddressValue>) => onChange({ ...value, ...patch });

  // ─── MANEJADOR: cambio de país ────────────────────────────────────────────
  // Al cambiar el país, reseteamos región y ciudad porque dependen del país.
  const onCountryChange = (code: string) => {
    // Al cambiar pais, reseteamos region y ciudad porque las subdivisiones
    // y ciudades dependen del pais. Mantenemos los demas campos.
    onChange({ ...value, countryCode: code.toLowerCase(), region: '', regionCode: '', city: '' });
  };

  // ─── MANEJADOR: cambio de región por dropdown ────────────────────────────
  // Cuando el usuario elige un estado/provincia del dropdown:
  const onRegionDropdownChange = (code: string) => {
    // Buscamos el nombre completo que corresponde al código elegido
    const sub = subdivisions.find((s) => s.code === code);
    // sub?.name → si sub existe, tomamos su name; si no, undefined
    // || '' → si es undefined, usamos cadena vacía
    onChange({ ...value, regionCode: code, region: sub?.name || '', city: '' });
  };

  // ─── ESTILOS REUTILIZABLES ────────────────────────────────────────────────
  // Clase base compartida por todos los inputs y selects del componente
  const baseInput = 'w-full px-3 py-2.5 border rounded-xl text-sm focus:ring-2 focus:outline-none focus:border-transparent';

  // Función que devuelve las clases del input según si tiene error o no
  // err?: string → el parámetro es opcional
  const inputClass = (err?: string) =>
    `${baseInput} ${err ? 'border-red-400' : 'border-gray-200'}`;

  // Estilo CSS para el color del ring de foco (usando variable CSS de Tailwind)
  const ringStyle = { '--tw-ring-color': TEAL } as React.CSSProperties;

  // ─── JSX PRINCIPAL ────────────────────────────────────────────────────────
  return (
    <div className={`space-y-3 ${className}`}>
      {/* ── CAMPO: PAÍS ─────────────────────────────────────────── */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">
          País{reqMark}
          {/* reqMark es null o <span>*</span> — React ignora null */}
        </label>
        <select
          value={value.countryCode}
          onChange={(e) => onCountryChange(e.target.value)}
          className={`${inputClass(errors.countryCode)} bg-white`}
          style={ringStyle}
        >
          {/* Opción por defecto (vacía): cambia texto según si países ya cargaron */}
          <option value="">
            {countries.length === 0 ? 'Cargando países…' : 'Selecciona un país'}
          </option>
          {/* .map() genera una <option> por cada país del JSON */}
          {countries.map((c) => (
            // key={c.alpha2} → clave única requerida por React en listas
            <option key={c.alpha2} value={c.alpha2}>{c.name}</option>
          ))}
        </select>
        {/* Renderizado condicional con &&: solo muestra si hay error en ese campo */}
        {errors.countryCode && <p className="mt-1 text-xs text-red-600">{errors.countryCode}</p>}
      </div>

      {/* ── CAMPO: REGIÓN (Estado/Provincia/etc.) ──────────────────────────── */}
      {/* La región puede renderizarse de 3 formas distintas: */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">
          {regionLabel}{reqMark}
          {/* regionLabel cambia según el país: "Estado", "Provincia", etc. */}
        </label>
        {/* Región: dropdown si hay subdivisiones, sino input libre */}
        {!value.countryCode ? (
          // CASO 1: Sin país seleccionado → input deshabilitado con mensaje
          <input
            type="text"
            disabled
            placeholder="Selecciona un país primero"
            className={`${inputClass()} bg-gray-100 cursor-not-allowed`}
          />
        ) : loadingSubs ? (
          // CASO 2: Cargando subdivisiones → input deshabilitado con "Cargando…"
          <input
            type="text"
            disabled
            placeholder="Cargando…"
            className={`${inputClass()} bg-gray-100 cursor-not-allowed`}
          />
        ) : hasRegionDropdown ? (
          // CASO 3: Hay subdivisiones → dropdown con las opciones
          <select
            value={value.regionCode}
            onChange={(e) => onRegionDropdownChange(e.target.value)}
            className={`${inputClass(errors.region)} bg-white`}
            style={ringStyle}
          >
            {/* Opción vacía: "Selecciona estado" (usando .toLowerCase() para coherencia) */}
            <option value="">{`Selecciona ${regionLabel.toLowerCase()}`}</option>
            {/* Una <option> por cada subdivisión del país */}
            {subdivisions.map((s) => (
              <option key={s.code} value={s.code}>{s.name}</option>
            ))}
          </select>
        ) : (
          // CASO 4: Sin subdivisiones → texto libre
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

      {/* ── CAMPOS: CIUDAD + CÓDIGO POSTAL ─────────────────────────────────── */}
      {/* grid grid-cols-2 gap-3 → dos columnas de igual ancho con espacio entre ellas */}
      <div className="grid grid-cols-2 gap-3">
        {/* Ciudad */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">Ciudad{reqMark}</label>
          {hasCityDropdown ? (
            // Dropdown de ciudades (solo México con estado seleccionado)
            <select
              value={value.city}
              onChange={(e) => update({ city: e.target.value })}
              className={`${inputClass(errors.city)} bg-white`}
              style={ringStyle}
            >
              <option value="">Selecciona ciudad</option>
              {/* mxCities es string[], por lo que c es directamente el nombre de la ciudad */}
              {mxCities.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          ) : (
            // Input libre para países sin lista de ciudades
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

        {/* Código postal */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">Código postal{reqMark}</label>
          <input
            type="text"
            inputMode="numeric" // En móvil muestra teclado numérico
            value={value.postalCode}
            onChange={(e) => update({ postalCode: e.target.value.replace(/\D/g, '').slice(0, 10) })}
            // .replace(/\D/g, '') → elimina todo lo que NO sea dígito
            // .slice(0, 10) → máximo 10 caracteres
            placeholder="CP"
            className={inputClass(errors.postalCode)}
            style={ringStyle}
          />
          {errors.postalCode && <p className="mt-1 text-xs text-red-600">{errors.postalCode}</p>}
        </div>
      </div>

      {/* ── CAMPOS: CALLE + NÚMERO ──────────────────────────────────────────── */}
      {/* grid grid-cols-3: 3 columnas. col-span-2: "Calle" ocupa 2, "Número" ocupa 1 */}
      <div className="grid grid-cols-3 gap-3">
        {/* Calle: ocupa 2 de las 3 columnas */}
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

        {/* Número: ocupa 1 de las 3 columnas */}
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

      {/* ── CAMPO: COLONIA ──────────────────────────────────────────────────── */}
      {/* showOptional && (...): solo renderiza este bloque si showOptional es true */}
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

// ─── FUNCIONES UTILITARIAS EXPORTADAS ────────────────────────────────────────
// Estas funciones no son componentes React, son helpers puros que los formularios
// que usan AddressFields pueden importar para trabajar con AddressValue.

/** Devuelve un AddressValue vacio para inicializar formularios. */
export function emptyAddress(countryCode = ''): AddressValue {
  // Retorna un objeto con todos los campos de dirección vacíos
  return {
    street: '',
    number: '',
    colonia: '',
    city: '',
    region: '',
    regionCode: '',
    postalCode: '',
    countryCode: countryCode.toLowerCase(), // Normalizamos a minúsculas
  };
}

// Valida que los campos obligatorios de una dirección estén llenos.
// Devuelve un objeto con los mensajes de error (vacío si no hay errores).
export function validateAddress(value: AddressValue): Partial<Record<keyof AddressValue, string>> {
  // Creamos el objeto de errores, inicialmente vacío
  const errors: Partial<Record<keyof AddressValue, string>> = {};

  // Verificamos cada campo obligatorio
  if (!value.countryCode) errors.countryCode = 'Selecciona un país';
  // .trim() elimina espacios al inicio y al final antes de verificar si está vacío
  if (!value.region.trim()) errors.region = 'Selecciona / escribe una opción';
  if (!value.city.trim()) errors.city = 'La ciudad es requerida';
  if (!value.postalCode.trim()) errors.postalCode = 'El código postal es requerido';
  if (!value.street.trim()) errors.street = 'La calle es requerida';
  if (!value.number.trim()) errors.number = 'El número es requerido';

  return errors; // {} si todo está bien, o con los mensajes de error
}

/**
 * Serializa al formato string del backend:
 * "Calle Numero, Colonia, Ciudad, Region, CP, Pais"
 */
export function serializeAddress(v: AddressValue): string {
  // Buscamos el nombre del país por su código ISO
  const country = getCountrySync(v.countryCode)?.name || v.countryCode || '';

  // Construimos el array de partes de la dirección
  return [
    // "Calle" + " " + "Número" → unimos con espacio si ambos existen
    [v.street, v.number].filter(Boolean).join(' '),
    // filter(Boolean) elimina elementos falsy (strings vacíos)
    v.colonia,
    v.city,
    v.region,
    v.postalCode,
    country,
  ].filter(Boolean).join(', '); // Unimos todas las partes con ", "
  // El resultado final: "Av. Insurgentes 123, Roma Norte, CDMX, CDMX, 06700, México"
}

/**
 * Best-effort parse del formato string del backend "Calle Num, Colonia,
 * Ciudad, Region, CP, Pais". Si se pasa la lista de countries, resuelve
 * countryCode haciendo lookup case-insensitive por nombre.
 */
export function parseAddress(
  address: string,
  countries?: { alpha2: string; name: string }[], // Lista de países (opcional)
): AddressValue {
  // Si no hay dirección, devolvemos una vacía
  if (!address) return emptyAddress();

  // Separamos la cadena por comas y limpiamos espacios de cada parte
  const parts = address.split(',').map((s) => s.trim());

  // parts[0] debería ser "Calle Número" (ej. "Av. Insurgentes 123")
  const streetFull = parts[0] || '';

  // Intentamos separar calle de número con regex:
  // ^ = inicio, (.+?) = cualquier texto (lazy), \s+ = espacio(s), (\d+\S*) = número + posibles letras
  const streetMatch = streetFull.match(/^(.+?)\s+(\d+\S*)$/);
  const street = streetMatch ? streetMatch[1] : streetFull; // Grupo 1: la calle
  const number = streetMatch ? streetMatch[2] : '';         // Grupo 2: el número

  // Extraemos las demás partes por posición
  const colonia = parts[1] || '';
  const city = parts[2] || '';
  const region = parts[3] || '';
  const postalCode = parts[4] || '';
  const countryName = parts[5] || '';

  // Buscamos el código ISO del país por su nombre
  let countryCode = '';
  if (countryName && countries) {
    const match = countries.find(
      (c) => c.name.toLowerCase() === countryName.toLowerCase(),
    );
    if (match) countryCode = match.alpha2; // alpha2 = "mx", "us", "es", etc.
  }

  return {
    street,
    number,
    colonia,
    city,
    region,
    regionCode: '', // No podemos resolverlo sin cargar las subdivisiones
    postalCode,
    countryCode,
  };
}

/**
 * Despues de parseAddress, una vez cargadas las subdivisiones del pais,
 * resuelve el regionCode buscando el name exact (case-insensitive).
 * Devuelve el codigo ISO si encuentra, o '' si no matchea (region queda
 * como string libre).
 */
export function resolveRegionCode(
  regionName: string,
  subdivisions: { code: string; name: string }[], // Lista de subdivisiones ya cargadas
): string {
  if (!regionName) return ''; // Sin nombre, sin código

  // Buscamos una subdivisión cuyo nombre coincida exactamente (ignorando mayúsculas)
  const match = subdivisions.find(
    (s) => s.name.toLowerCase() === regionName.toLowerCase(),
  );

  // match?.code → si match existe, devuelve su code; si no, undefined
  // || '' → si es undefined, devuelve cadena vacía
  return match?.code || '';
}
