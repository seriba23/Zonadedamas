'use client';
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ complete-profile-modal.tsx                                              │
// │                                                                         │
// │ ¿QUÉ HACE ESTE COMPONENTE?                                              │
// │ Modal de 3 pasos que se muestra al usuario del marketplace cuando su    │
// │ perfil está incompleto (sin teléfono, fecha de nacimiento, género, etc.)│
// │                                                                         │
// │ Paso 1 (welcome): Bienvenida con botón "Continuar" o "Ahora no"        │
// │ Paso 2 (form):    Formulario con teléfono, fecha, género, alergias y   │
// │                   dirección. Botones "Guardar" y "Después"             │
// │ Paso 3 (thanks):  Confirmación de éxito (ya no se usa: se recarga la   │
// │                   página al guardar, pero el paso sigue en el código)  │
// │                                                                         │
// │ Al guardar, hace PUT /api/marketplace/auth/profile y recarga la página. │
// └─────────────────────────────────────────────────────────────────────────┘

// useState: estado local (step, form, saving, error, etc.)
// useEffect: efectos secundarios (re-parsear dirección con países)
import { useState, useEffect } from 'react';

// marketplaceApi: cliente HTTP preconfigurado para el portal de marketplace
import { marketplaceApi } from '@/lib/marketplace-api';

// resolveImageUrl: convierte rutas relativas a URLs absolutas del servidor
import { resolveImageUrl } from '@/lib/utils';

// Componentes reutilizables que se muestran en el paso 2 (formulario)
import { DatePicker } from './date-picker';
import { AllergiesSelector } from './allergies-selector';
import { AddressFields, emptyAddress, parseAddress, serializeAddress, type AddressValue } from './address-fields';

// Función para cargar la lista de países (necesaria para re-parsear la dirección)
import { loadCountries } from '@/lib/geo-data';

// ─── COLORES DE LA IDENTIDAD VISUAL ──────────────────────────────────────────
const TEAL = '#008080';       // Color principal de la plataforma
const TEAL_DARK = '#006666';  // Versión oscura para hover
const TEAL_LIGHT = '#e0f2f1'; // Versión clara para fondos y avatares

// ─── LISTA DE PREFIJOS TELEFÓNICOS ───────────────────────────────────────────
// Cada objeto contiene: code (prefijo internacional), flag (emoji bandera), name (país)
const COUNTRY_CODES = [
  { code: '+52', flag: '🇲🇽', name: 'México' },
  { code: '+1', flag: '🇺🇸', name: 'EE.UU. / Canadá' },
  { code: '+34', flag: '🇪🇸', name: 'España' },
  { code: '+54', flag: '🇦🇷', name: 'Argentina' },
  { code: '+57', flag: '🇨🇴', name: 'Colombia' },
  { code: '+56', flag: '🇨🇱', name: 'Chile' },
  { code: '+51', flag: '🇵🇪', name: 'Perú' },
  { code: '+58', flag: '🇻🇪', name: 'Venezuela' },
  { code: '+593', flag: '🇪🇨', name: 'Ecuador' },
  { code: '+502', flag: '🇬🇹', name: 'Guatemala' },
  { code: '+503', flag: '🇸🇻', name: 'El Salvador' },
  { code: '+504', flag: '🇭🇳', name: 'Honduras' },
  { code: '+505', flag: '🇳🇮', name: 'Nicaragua' },
  { code: '+506', flag: '🇨🇷', name: 'Costa Rica' },
  { code: '+507', flag: '🇵🇦', name: 'Panamá' },
  { code: '+53', flag: '🇨🇺', name: 'Cuba' },
  { code: '+1-809', flag: '🇩🇴', name: 'Rep. Dominicana' },
  { code: '+591', flag: '🇧🇴', name: 'Bolivia' },
  { code: '+595', flag: '🇵🇾', name: 'Paraguay' },
  { code: '+598', flag: '🇺🇾', name: 'Uruguay' },
  { code: '+55', flag: '🇧🇷', name: 'Brasil' },
];

// ─── OPCIONES DE GÉNERO ───────────────────────────────────────────────────────
// Cada opción tiene un value (enviado al backend) y un label (visible al usuario)
const GENDER_OPTIONS = [
  { value: '', label: 'Selecciona una opción' },       // Opción vacía por defecto
  { value: 'FEMALE', label: 'Femenino' },
  { value: 'MALE', label: 'Masculino' },
  { value: 'NON_BINARY', label: 'No binario' },
  { value: 'PREFER_NOT_SAY', label: 'Prefiero no decir' },
];

// ─── INTERFAZ DE PROPS ───────────────────────────────────────────────────────
interface CompleteProfileModalProps {
  user: {
    firstName?: string | null;    // Nombre del usuario (para el saludo). null si no tiene.
    phone: string | null;         // Teléfono ya guardado. Si no es null, no mostramos el campo.
    birthDate?: string | null;    // Fecha de nacimiento (ISO string o null)
    gender?: string | null;       // Género ('FEMALE', 'MALE', etc. o null)
    allergies?: string | null;    // String de alergias separadas por coma o null
    address?: string | null;      // Dirección serializada como string o null
    avatarUrl?: string | null;    // URL de la foto de perfil o null
  };
  onComplete: () => void;   // Se llama cuando el usuario hace click en "¡Empezar!" (paso thanks)
  onSkip: () => void;       // Se llama cuando el usuario omite completar el perfil
}

// ─── COMPONENTE PRINCIPAL ────────────────────────────────────────────────────
export function CompleteProfileModal({ user, onComplete, onSkip }: CompleteProfileModalProps) {

  // ─── ESTADO LOCAL ─────────────────────────────────────────────────────────

  // step: controla cuál de los 3 pasos del modal se muestra en pantalla
  // 'welcome' → saludo inicial | 'form' → formulario | 'thanks' → confirmación
  const [step, setStep] = useState<'welcome' | 'form' | 'thanks'>('welcome');

  // countryCode: prefijo telefónico seleccionado (default México +52)
  const [countryCode, setCountryCode] = useState('+52');

  // phoneNumber: solo los dígitos del teléfono (sin el prefijo)
  const [phoneNumber, setPhoneNumber] = useState('');

  // form: objeto con los campos simples del formulario
  const [form, setForm] = useState({
    // .split('T')[0]: si birthDate es "1990-01-15T00:00:00Z", tomamos solo "1990-01-15"
    birthDate: user.birthDate ? user.birthDate.split('T')[0] : '',
    // || '' → si user.gender es null o undefined, usamos cadena vacía
    gender: user.gender || '',
    allergies: user.allergies || '',
  });

  // address: objeto estructurado de la dirección (usando el tipo AddressValue)
  const [address, setAddress] = useState<AddressValue>(
    // Si el usuario ya tiene dirección guardada, la parseamos; si no, creamos vacía con país México
    user.address ? parseAddress(user.address) : emptyAddress('mx'),
  );

  // ─── EFECTO: Re-parsear dirección con la lista de países cargada ──────────
  // Problema: parseAddress(user.address) en el useState inicial NO tiene la lista
  // de países disponible, así que el countryCode puede quedar vacío aunque la
  // dirección guardada incluya el nombre del país (ej. "México").
  // Este efecto espera a que loadCountries() termine y re-parsea si es necesario.
  // Re-parsear address con countries cargados para resolver countryCode
  // (sino el dropdown queda vacio aunque el cliente tenga direccion guardada).
  useEffect(() => {
    if (!user.address) return; // Sin dirección guardada, no hay nada que hacer

    loadCountries().then((countries) => {
      setAddress((prev) => {
        // Solo re-parsear si todavia no resolvimos countryCode
        // Si ya tiene countryCode resuelto, no hacemos nada
        if (prev.countryCode) return prev;
        // ! después de user.address → le decimos a TypeScript "sé que no es null"
        return parseAddress(user.address!, countries);
      });
    }).catch(() => {}); // Si falla la carga de países, simplemente no actualizamos
  }, [user.address]); // Se ejecuta si cambia user.address

  // saving: true mientras se está enviando el formulario al servidor
  const [saving, setSaving] = useState(false);

  // error: mensaje de error para mostrar al usuario si algo falla
  const [error, setError] = useState('');

  // ─── VALORES DERIVADOS ────────────────────────────────────────────────────
  // initials: primera letra del nombre del usuario en mayúscula (para el avatar de letras)
  // [0] → primer caracter del string; || '' → si no hay nombre, cadena vacía
  const initials = `${(user.firstName || '')[0] || ''}`.toUpperCase();

  // avatarUrl: URL completa de la foto de perfil, o null si no tiene
  const avatarUrl = user.avatarUrl ? resolveImageUrl(user.avatarUrl) : null;

  // ─── MANEJADOR: handleSubmit ──────────────────────────────────────────────
  // Se llama cuando el usuario presiona "Guardar" en el paso del formulario.
  const handleSubmit = async () => {
    // Validación del teléfono: solo si el usuario escribió algo Y es incompleto
    if (!user.phone && phoneNumber && phoneNumber.length !== 10) {
      setError('El teléfono debe tener exactamente 10 dígitos.');
      return; // Detenemos la ejecución
    }

    setSaving(true);  // Mostramos "Guardando..."
    setError('');     // Limpiamos errores anteriores

    try {
      // Combinamos prefijo + número. Si no escribió nada, no enviamos teléfono.
      const fullPhone = phoneNumber ? `${countryCode}${phoneNumber}` : undefined;

      // Convertimos el objeto AddressValue al string del backend
      const addressStr = serializeAddress(address);

      // PUT al endpoint de perfil del marketplace
      // undefined → no se envía ese campo al servidor (el backend lo ignora)
      await marketplaceApi.put('/auth/profile', {
        phone: fullPhone,
        birthDate: form.birthDate || undefined,
        gender: form.gender || undefined,
        allergies: form.allergies || undefined,
        address: addressStr || undefined,
      });

      // Recargar la pagina para que el modal desaparezca al instante.
      // Antes mostrabamos step 'thanks' y dependiamos de que el user
      // hiciera click en "¡Empezar!" para cerrar; varios usuarios lo
      // dejaban abierto creyendo que ya guardo.
      if (typeof window !== 'undefined') {
        // typeof window !== 'undefined': verificamos que estamos en el navegador
        // (no en el servidor de Next.js donde window no existe)
        window.location.reload(); // Recarga completa de la página
      }
    } catch (err: any) {
      // err: any → TypeScript no sabe el tipo exacto del error, usamos any
      // err.message → mensaje del error si tiene uno
      setError(err.message || 'Error al guardar');
    } finally {
      // finally: se ejecuta SIEMPRE, haya error o no
      setSaving(false); // Quitamos el estado de cargando
    }
  };

  // ══════════════════════════════════════════════════════════════════════════
  // RENDERIZADO CONDICIONAL: según el "step" actual, mostramos una pantalla u otra
  // ══════════════════════════════════════════════════════════════════════════

  // ── Step 1: Welcome ──────────────────────────────────
  if (step === 'welcome') {
    return (
      // Overlay oscuro a pantalla completa (fixed inset-0)
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
        <div className="bg-white rounded-2xl max-w-md w-full p-7 text-center" onClick={(e) => e.stopPropagation()}>

          {/* Logo: círculo teal con la letra "S" de Siliba */}
          <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-5" style={{ backgroundColor: TEAL }}>
            <span className="text-white text-2xl font-bold">S</span>
          </div>

          {/* Saludo personalizado: si tiene nombre lo incluimos, si no solo "¡Hola!" */}
          <h1 className="text-xl font-bold text-gray-900 mb-3">
            ¡Hola{user.firstName ? `, ${user.firstName}` : ''}! Bienvenido a Siliba
          </h1>

          <p className="text-sm text-gray-500 leading-relaxed mb-8">
            Aquí encontrarás servicios de todo tipo con profesionales de verdad que te brindarán la mejor experiencia.
          </p>

          {/* Botón "Continuar" → avanza al paso del formulario */}
          <button
            onClick={() => setStep('form')} // Cambia el estado de paso
            className="w-full text-white py-3 rounded-xl font-semibold text-sm transition-colors"
            style={{ backgroundColor: TEAL }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = TEAL_DARK)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = TEAL)}
          >
            Continuar
          </button>

          {/* Botón "Ahora no" → llama al callback onSkip del padre */}
          <button
            onClick={onSkip}
            className="w-full mt-2 py-2.5 text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            Ahora no
          </button>
        </div>
      </div>
    );
  }

  // ── Step 3: Thanks ──────────────────────────────────
  // (Nota: está antes del step 2 para que los "return early" sean correctos)
  if (step === 'thanks') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
        <div className="bg-white rounded-2xl max-w-md w-full p-7 text-center" onClick={(e) => e.stopPropagation()}>
          {/* Ícono de check verde (palomita) */}
          <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-5" style={{ backgroundColor: TEAL_LIGHT }}>
            <svg className="w-8 h-8" style={{ color: TEAL }} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              {/* path d="..." → el trazado SVG de la palomita de verificación */}
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-3">¡Perfil completado!</h2>
          <p className="text-sm text-gray-500 leading-relaxed mb-8">
            Gracias por completar tu perfil. Ahora podemos ofrecerte una experiencia personalizada y asegurarnos de que cada servicio sea perfecto para ti.
          </p>
          {/* Botón "¡Empezar!" → llama al callback onComplete del padre */}
          <button
            onClick={onComplete}
            className="w-full text-white py-3 rounded-xl font-semibold text-sm transition-colors"
            style={{ backgroundColor: TEAL }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = TEAL_DARK)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = TEAL)}
          >
            ¡Empezar!
          </button>
        </div>
      </div>
    );
  }

  // ── Step 2: Form ─────────────────────────────────────
  // Si ninguno de los "return early" anteriores se ejecutó, llegamos al formulario.
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      {/* max-h-[90vh] overflow-y-auto: el panel no excede el 90% de la pantalla y tiene scroll */}
      <div className="bg-white rounded-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>

        {/* Avatar del usuario (foto o iniciales) + título */}
        <div className="flex flex-col items-center mb-5">
          <div className="w-16 h-16 rounded-full overflow-hidden flex items-center justify-center mb-2"
            style={{ backgroundColor: TEAL_LIGHT }}>
            {/* Renderizado condicional: si hay foto, la mostramos; si no, mostramos iniciales */}
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              // || '?' → si no hay iniciales, mostramos un signo de interrogación
              <span className="text-2xl font-bold" style={{ color: TEAL }}>{initials || '?'}</span>
            )}
          </div>
          <h2 className="text-lg font-bold text-gray-900">Completa tu perfil</h2>
          <p className="text-xs text-gray-400 mt-0.5">Estos datos nos ayudan a darte una mejor experiencia</p>
        </div>

        {/* Campos del formulario */}
        <div className="space-y-4">

          {/* Phone — only if not already provided.
              min-w-0 en el wrapper + flex-shrink en el select para evitar
              que el bloque se desborde del modal en pantallas estrechas.
              El input acepta solo 10 digitos (validacion local MX). */}
          {/* !user.phone → si el usuario YA tiene teléfono, ocultamos este campo */}
          {!user.phone && (
            <div className="min-w-0">
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Teléfono</label>
              {/* flex gap-2 → prefijo y número lado a lado */}
              <div className="flex gap-2 min-w-0">
                {/* Selector de prefijo internacional */}
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="px-2 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:outline-none bg-white flex-shrink-0"
                  style={{ '--tw-ring-color': TEAL, maxWidth: 110 } as any}
                >
                  {/* Una <option> por cada país de la lista COUNTRY_CODES */}
                  {COUNTRY_CODES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.code}
                      {/* Muestra: 🇲🇽 +52 */}
                    </option>
                  ))}
                </select>

                {/* Campo de dígitos del teléfono */}
                <input
                  type="tel"
                  inputMode="numeric" // Teclado numérico en móvil
                  maxLength={10}      // Máximo 10 caracteres (aunque el replace también limita)
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  // .replace(/\D/g, '') → elimina todo lo que no sea dígito (letras, guiones, etc.)
                  // .slice(0, 10) → máximo 10 dígitos
                  placeholder="10 dígitos"
                  className="flex-1 min-w-0 px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:outline-none"
                  style={{ '--tw-ring-color': TEAL } as any}
                />
              </div>
              {/* Aviso de longitud: solo si el usuario escribió algo pero no completó 10 dígitos */}
              {phoneNumber.length > 0 && phoneNumber.length < 10 && (
                <p className="text-[11px] text-amber-700 mt-1">
                  El teléfono debe tener 10 dígitos.
                </p>
              )}
            </div>
          )}

          {/* Birth date: componente DatePicker reutilizable */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Fecha de nacimiento</label>
            <DatePicker
              value={form.birthDate}
              // Actualiza solo el campo birthDate del objeto form
              // (f) => ({ ...f, birthDate: v }) → crea nuevo objeto copiando f y sobreescribiendo birthDate
              onChange={(v) => setForm((f) => ({ ...f, birthDate: v }))}
            />
          </div>

          {/* Gender: selector desplegable */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Género</label>
            <select
              value={form.gender}
              onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:outline-none bg-white"
              style={{ '--tw-ring-color': TEAL } as any}
            >
              {/* .map() genera una <option> por cada opción de género */}
              {GENDER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Allergies: componente AllergiesSelector reutilizable */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Alergias <span className="text-gray-400">(opcional)</span>
            </label>
            <p className="text-xs text-gray-400 mb-1.5 leading-relaxed">
              Esta información nos ayuda a evitar ofrecerte servicios que puedan causarte una reacción alérgica. Los especialistas podrán verla cuando seas atendid@ para garantizar tu seguridad y la mejor experiencia posible.
            </p>
            <AllergiesSelector value={form.allergies} onChange={(v) => setForm((f) => ({ ...f, allergies: v }))} />
          </div>

          {/* Direccion (opcional) — para envios a domicilio de productos */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Dirección <span className="text-gray-400">(opcional)</span>
            </label>
            <p className="text-xs text-gray-400 mb-2 leading-relaxed">
              Para sugerirte negocios cercanos y facilitar envíos a domicilio.
            </p>
            {/* AddressFields: componente completo de dirección estructurada */}
            {/* setAddress: directamente la función setState (sin wrapper) porque AddressValue es el objeto completo */}
            <AddressFields value={address} onChange={setAddress} />
          </div>
        </div>

        {/* Mensaje de error (solo se muestra si error es truthy, es decir, no vacío) */}
        {error && (
          <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg mt-3">{error}</p>
        )}

        {/* Botones de acción */}
        <div className="mt-5 space-y-2">
          {/* Botón "Guardar": deshabilitado mientras se guarda */}
          <button
            onClick={handleSubmit}
            disabled={saving} // disabled=true → botón no clickeable, se ve opaco
            className="w-full text-white py-2.5 rounded-xl font-medium text-sm disabled:opacity-50 transition-colors"
            style={{ backgroundColor: TEAL }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = TEAL_DARK)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = TEAL)}
          >
            {/* Ternario: muestra texto diferente según si está guardando */}
            {saving ? 'Guardando...' : 'Guardar'}
          </button>

          {/* Botón "Después": cierra el modal sin guardar */}
          <button
            onClick={onSkip}
            className="w-full py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            Después
          </button>
        </div>
      </div>
    </div>
  );
}
