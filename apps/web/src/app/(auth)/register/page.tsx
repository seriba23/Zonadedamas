'use client';

import { Suspense, useState, useEffect, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/use-auth';
import { marketplaceApi } from '@/lib/marketplace-api';
import { SocialLoginButtons } from '@/components/ui/social-login-buttons';
import { PasswordRules } from '@/components/ui/password-rules';
import { PasswordMatch } from '@/components/ui/password-match';
import { validatePassword } from '@/lib/password-validation';
import { AddressFields, emptyAddress, parseAddress, serializeAddress, type AddressValue } from '@/components/ui/address-fields';
import { getCountrySync, loadCountries } from '@/lib/geo-data';

// Helper local: solo serializa si tiene al menos algo escrito.
function serializeAddressForBackend(a: AddressValue): string {
  const filled = !!(a.street || a.city || a.region || a.postalCode || a.countryCode);
  return filled ? serializeAddress(a) : '';
}

// Country phone codes
const COUNTRY_CODES = [
  { code: '+52', flag: '🇲🇽', name: 'México' },
  { code: '+1', flag: '🇺🇸', name: 'EE.UU.' },
  { code: '+1', flag: '🇨🇦', name: 'Canadá' },
  { code: '+34', flag: '🇪🇸', name: 'España' },
  { code: '+57', flag: '🇨🇴', name: 'Colombia' },
  { code: '+54', flag: '🇦🇷', name: 'Argentina' },
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
  { code: '+591', flag: '🇧🇴', name: 'Bolivia' },
  { code: '+595', flag: '🇵🇾', name: 'Paraguay' },
  { code: '+598', flag: '🇺🇾', name: 'Uruguay' },
  { code: '+55', flag: '🇧🇷', name: 'Brasil' },
];

function PhoneInput({
  value,
  onChange,
  error,
  id,
}: {
  value: string;
  onChange: (full: string) => void;
  error?: string;
  id?: string;
}) {
  const [countryCode, setCountryCode] = useState('+52');
  const [local, setLocal] = useState('');

  // Sincroniza con el value externo. Antes era "only on mount" pero eso
  // ignoraba pre-fills que llegan DESPUES (ej. cuando /auth/me responde
  // y el padre setea phone via prefilledFromClient). Ahora reacciona a
  // cualquier cambio de value pero solo actualiza el estado interno si
  // difiere, para evitar loops infinitos.
  useEffect(() => {
    if (!value) return;
    const matched = COUNTRY_CODES.find((c) => value.startsWith(c.code));
    const targetCode = matched?.code ?? countryCode;
    const targetLocal = matched
      ? value.slice(matched.code.length).replace(/\D/g, '').slice(0, 10)
      : value.replace(/\D/g, '').slice(0, 10);
    if (targetCode !== countryCode) setCountryCode(targetCode);
    if (targetLocal !== local) setLocal(targetLocal);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function handleLocalChange(e: React.ChangeEvent<HTMLInputElement>) {
    // Solo digitos (sin espacios, guiones ni parentesis) y limite de 10.
    // Validacion estricta de 10 digitos exactos en el submit.
    const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
    setLocal(digits);
    onChange(`${countryCode} ${digits}`.trim());
  }

  function handleCodeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setCountryCode(e.target.value);
    onChange(`${e.target.value} ${local}`.trim());
  }

  return (
    <div>
      <div className={`flex rounded-lg border bg-white overflow-hidden focus-within:ring-2 focus-within:ring-[#008080] focus-within:border-[#008080] ${error ? 'border-red-400' : 'border-gray-300'}`}>
        <select
          value={countryCode}
          onChange={handleCodeChange}
          className="border-r border-gray-200 bg-gray-50 text-sm text-gray-700 px-2 py-2.5 focus:outline-none cursor-pointer"
          style={{ minWidth: 72 }}
        >
          {COUNTRY_CODES.map((c, i) => (
            <option key={i} value={c.code}>
              {c.flag} {c.code}
            </option>
          ))}
        </select>
        <input
          id={id}
          type="tel"
          inputMode="numeric"
          maxLength={10}
          value={local}
          onChange={handleLocalChange}
          className="flex-1 px-3 py-2.5 text-sm focus:outline-none bg-transparent"
          placeholder="10 dígitos"
        />
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

type RegisterMode = 'select' | 'professional' | 'business' | 'individual' | 'client';

interface FormState {
  // Step 1 - Owner
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  phone: string;
  // Business invite
  inviteCode: string;
  // Step 2 - Business info (individual only)
  businessName: string;
  businessTypes: string[];
  businessPostalCode: string;
  businessCity: string;
  businessState: string;
  businessCountry: string;
  businessStreetName: string;
  businessStreetNumber: string;
  businessPhone: string;
  // Step 3 - Trial welcome (individual only)
  acceptContract: boolean;
  acceptPrivacy: boolean;
}

interface FormErrors {
  [key: string]: string | undefined;
}

// Business types loaded from API, fallback for SSR
const FALLBACK_BUSINESS_TYPES = [
  { value: 'SALON', label: 'Salón' },
  { value: 'BARBERIA', label: 'Barbería' },
  { value: 'SPA', label: 'SPA' },
  { value: 'CLINICA', label: 'Clínica' },
  { value: 'TATUAJES', label: 'Tatuajes' },
];

const BUSINESS_FEATURES = [
  'Calendario y agenda de citas',
  'Gestión de empleados y horarios',
  'Portal de clientes y marketplace',
  'Inventario y proveedores',
  'Reportes y estadísticas',
  'Cupones y programa de fidelidad',
  'Múltiples sucursales',
  'Galería y fotos de resultados',
];

function RegisterPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { register } = useAuth();
  const [businessTypesFromApi, setBusinessTypesFromApi] = useState<{ value: string; label: string }[]>([]);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/marketplace/business-types`)
      .then((r) => r.json())
      .then((json) => { if (json.data) setBusinessTypesFromApi(json.data); })
      .catch(() => {});
  }, []);

  const BUSINESS_TYPES = businessTypesFromApi.length > 0 ? businessTypesFromApi : FALLBACK_BUSINESS_TYPES;

  // Read ?type=individual|client|business from URL and skip the select screen
  const typeParam = searchParams.get('type') as RegisterMode | null;
  const initialMode: RegisterMode =
    typeParam === 'individual' || typeParam === 'business' || typeParam === 'client'
      ? typeParam
      : 'select';

  const [mode, setMode] = useState<RegisterMode>(initialMode);
  const [step, setStep] = useState(1);
  // Modal de aviso de privacidad / términos: legal obliga a mostrar el
  // contenido sin perder el progreso del registro. Lo abrimos en overlay
  // y el usuario puede cerrarlo y volver al form intacto.
  const [legalModal, setLegalModal] = useState<null | { url: string; title: string }>(null);
  const [form, setForm] = useState<FormState>({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    inviteCode: '',
    businessName: '',
    businessTypes: [],
    businessPostalCode: '',
    businessCity: '',
    businessState: '',
    businessCountry: 'México',
    businessStreetName: '',
    businessStreetNumber: '',
    businessPhone: '',
    acceptContract: false,
    acceptPrivacy: false,
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [professionalType, setProfessionalType] = useState<'affiliated' | 'freelancer'>('affiliated');
  // Direccion del negocio (mode='individual' admin step 2). Reemplaza los
  // 6 inputs de texto libre por <AddressFields> con droplists de pais y
  // estado/provincia. Default MX para usuarios mexicanos (LATAM-first).
  const [businessAddress, setBusinessAddress] = useState<AddressValue>(emptyAddress('mx'));
  // Para mode='business' (Profesional):
  //  - Afiliado → personalAddress: la direccion personal del empleado
  //    (a donde vive). Se guarda en User.address.
  //  - Freelancer → localAddress: la direccion del local del negocio
  //    independiente. Se guarda en Tenant.address (via businessXxx).
  // Las 3 direcciones posibles del flow auth son: personal del cliente,
  // personal del empleado afiliado, y local del profesional independiente.
  const [personalAddress, setPersonalAddress] = useState<AddressValue>(emptyAddress('mx'));
  const [localAddress, setLocalAddress] = useState<AddressValue>(emptyAddress('mx'));
  const [invitePreview, setInvitePreview] = useState<{
    businessName: string;
    logoUrl?: string | null;
    ownerName: string | null;
    jobTitle: string | null;
    services: { id: string; name: string }[];
  } | null>(null);
  const [showPreviewPopup, setShowPreviewPopup] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Pre-fill desde sesion marketplace del cliente: si el usuario ya esta
  // logueado como cliente y ahora quiere crear cuenta admin/profesional,
  // traemos sus datos para no pedir capturar de nuevo. La password sigue
  // siendo obligatoria (cuenta nueva = password nueva).
  const [prefilledFromClient, setPrefilledFromClient] = useState(false);
  // Cuando el usuario clickea "Editar" en la vista compacta, queremos
  // mostrar el form completo aunque tengamos los datos pre-rellenados.
  // No podemos solo apagar prefilledFromClient porque el useEffect lo
  // volveria a setear a true (re-fetch).
  const [editingPersonalData, setEditingPersonalData] = useState(false);

  useEffect(() => {
    if (!marketplaceApi.isLoggedIn()) return;
    if (prefilledFromClient) return;
    if (mode === 'select' || mode === 'client') return;
    // Fetch en paralelo: el user y los countries (para resolver alpha2 de
    // la direccion guardada como string con nombre de pais).
    Promise.all([
      marketplaceApi.get<{ data: any }>('/auth/me'),
      loadCountries(),
    ])
      .then(([res, countries]) => {
        const u = res?.data;
        if (!u) return;
        setForm((f) => ({
          ...f,
          firstName: f.firstName || u.firstName || '',
          lastName: f.lastName || u.lastName || '',
          email: f.email || u.email || '',
          phone: f.phone || u.phone || '',
          // Si el cliente tiene phone, lo usamos como default del telefono
          // del negocio. El user puede sobrescribir si su negocio tiene
          // numero distinto.
          businessPhone: f.businessPhone || u.phone || '',
        }));
        // Pre-fill direcciones con la del cliente. Pre-llenamos las 3
        // porque es comun que el local profesional/del negocio coincida
        // con la direccion personal del cliente (al menos como punto de
        // partida). El user puede editar cualquiera si difiere.
        if (u.address) {
          const isEmpty = (a: AddressValue) => !a.street && !a.city && !a.region && !a.postalCode;
          setBusinessAddress((prev) => (isEmpty(prev) ? parseAddress(u.address, countries) : prev));
          setPersonalAddress((prev) => (isEmpty(prev) ? parseAddress(u.address, countries) : prev));
          setLocalAddress((prev) => (isEmpty(prev) ? parseAddress(u.address, countries) : prev));
        }
        setPrefilledFromClient(true);
      })
      .catch(() => {});
  }, [mode, prefilledFromClient]);

  function validateStep1(): boolean {
    const newErrors: FormErrors = {};
    if (!form.firstName.trim()) newErrors.firstName = 'El nombre es requerido';
    if (!form.lastName.trim()) newErrors.lastName = 'El apellido es requerido';
    if (!form.email) {
      newErrors.email = 'El correo es requerido';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = 'Ingresa un correo válido';
    }
    if (!form.phone.trim()) {
      newErrors.phone = 'El teléfono es requerido';
    } else {
      // Exigimos 10 digitos exactos (sin contar el codigo de pais).
      // form.phone viene como "+52 5512345678" — limpiamos y quitamos el
      // codigo si esta presente.
      const matched = COUNTRY_CODES.find((c) => form.phone.startsWith(c.code));
      const rest = matched ? form.phone.slice(matched.code.length) : form.phone;
      const digits = rest.replace(/\D/g, '');
      if (digits.length !== 10) newErrors.phone = 'El teléfono debe tener 10 dígitos';
    }
    if (!form.password) {
      newErrors.password = 'La contraseña es requerida';
    } else {
      const pwdErr = validatePassword(form.password);
      if (pwdErr) newErrors.password = pwdErr;
    }
    if (!form.confirmPassword) {
      newErrors.confirmPassword = 'Confirma tu contraseña';
    } else if (form.password !== form.confirmPassword) {
      newErrors.confirmPassword = 'Las contraseñas no coinciden';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function validateStep2(): boolean {
    const newErrors: FormErrors = {};
    if (!form.businessName.trim()) newErrors.businessName = 'El nombre del negocio es requerido';
    if (form.businessTypes.length === 0) newErrors.businessTypes = 'Selecciona al menos un tipo de negocio';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function validateStep3(): boolean {
    const newErrors: FormErrors = {};
    if (!form.acceptContract) newErrors.acceptContract = 'Debes aceptar los términos y condiciones';
    if (!form.acceptPrivacy) newErrors.acceptPrivacy = 'Debes aceptar el aviso de privacidad';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function toggleBusinessType(value: string) {
    setForm((f) => {
      const already = f.businessTypes.includes(value);
      return {
        ...f,
        businessTypes: already
          ? f.businessTypes.filter((t) => t !== value)
          : [...f.businessTypes, value],
      };
    });
    if (errors.businessTypes) setErrors((e) => ({ ...e, businessTypes: undefined }));
  }

  function validateBusiness(): boolean {
    const newErrors: FormErrors = {};
    if (!form.firstName.trim()) newErrors.firstName = 'El nombre es requerido';
    if (!form.lastName.trim()) newErrors.lastName = 'El apellido es requerido';
    if (!form.email) {
      newErrors.email = 'El correo es requerido';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = 'Ingresa un correo válido';
    }
    if (!form.phone.trim()) {
      newErrors.phone = 'El teléfono es requerido';
    } else {
      // Exigimos 10 digitos exactos (sin contar el codigo de pais).
      // form.phone viene como "+52 5512345678" — limpiamos y quitamos el
      // codigo si esta presente.
      const matched = COUNTRY_CODES.find((c) => form.phone.startsWith(c.code));
      const rest = matched ? form.phone.slice(matched.code.length) : form.phone;
      const digits = rest.replace(/\D/g, '');
      if (digits.length !== 10) newErrors.phone = 'El teléfono debe tener 10 dígitos';
    }
    if (!form.password) {
      newErrors.password = 'La contraseña es requerida';
    } else {
      const pwdErr = validatePassword(form.password);
      if (pwdErr) newErrors.password = pwdErr;
    }
    if (!form.confirmPassword) {
      newErrors.confirmPassword = 'Confirma tu contraseña';
    } else if (form.password !== form.confirmPassword) {
      newErrors.confirmPassword = 'Las contraseñas no coinciden';
    }
    if (!form.inviteCode.trim()) newErrors.inviteCode = 'El código de invitación es requerido';
    // T&C + privacidad obligatorios en afiliado tambien (no solo freelancer).
    if (!form.acceptContract) newErrors.acceptContract = 'Debes aceptar los términos y condiciones';
    if (!form.acceptPrivacy) newErrors.acceptPrivacy = 'Debes aceptar el aviso de privacidad';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function validateFreelancer(): boolean {
    const newErrors: FormErrors = {};
    if (!form.firstName.trim()) newErrors.firstName = 'El nombre es requerido';
    if (!form.lastName.trim()) newErrors.lastName = 'El apellido es requerido';
    if (!form.email) {
      newErrors.email = 'El correo es requerido';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = 'Ingresa un correo válido';
    }
    if (!form.phone.trim()) {
      newErrors.phone = 'El teléfono es requerido';
    } else {
      // Exigimos 10 digitos exactos (sin contar el codigo de pais).
      // form.phone viene como "+52 5512345678" — limpiamos y quitamos el
      // codigo si esta presente.
      const matched = COUNTRY_CODES.find((c) => form.phone.startsWith(c.code));
      const rest = matched ? form.phone.slice(matched.code.length) : form.phone;
      const digits = rest.replace(/\D/g, '');
      if (digits.length !== 10) newErrors.phone = 'El teléfono debe tener 10 dígitos';
    }
    if (!form.password) {
      newErrors.password = 'La contraseña es requerida';
    } else {
      const pwdErr = validatePassword(form.password);
      if (pwdErr) newErrors.password = pwdErr;
    }
    if (!form.confirmPassword) {
      newErrors.confirmPassword = 'Confirma tu contraseña';
    } else if (form.password !== form.confirmPassword) {
      newErrors.confirmPassword = 'Las contraseñas no coinciden';
    }
    if (!form.acceptContract) newErrors.acceptContract = 'Debes aceptar los términos y condiciones';
    if (!form.acceptPrivacy) newErrors.acceptPrivacy = 'Debes aceptar el aviso de privacidad';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleNextStep() {
    setApiError(null);
    if (step === 1 && validateStep1()) {
      // Prefill del teléfono del negocio con el teléfono personal capturado
      // en el paso 1, si el campo aún está vacío. El usuario puede editarlo
      // después si su negocio tiene un número distinto.
      if (!form.businessPhone && form.phone) {
        setForm((f) => ({ ...f, businessPhone: f.phone }));
      }
      setStep(2);
    }
  }

  async function handleSubmitIndividual(e: FormEvent) {
    e.preventDefault();
    setApiError(null);
    if (!validateStep2()) return;
    if (!form.acceptContract) { setErrors({ acceptContract: 'Debes aceptar los términos y condiciones' }); return; }
    if (!form.acceptPrivacy) { setErrors({ acceptPrivacy: 'Debes aceptar el aviso de privacidad' }); return; }

    setIsLoading(true);
    try {
      await register({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email,
        password: form.password,
        phone: form.phone.trim(),
        type: 'individual',
        businessName: form.businessName.trim(),
        businessTypes: form.businessTypes,
        businessStreet: [businessAddress.street.trim(), businessAddress.number.trim()].filter(Boolean).join(' ') || undefined,
        businessCity: businessAddress.city.trim() || undefined,
        businessState: businessAddress.region.trim() || undefined,
        businessPostalCode: businessAddress.postalCode.trim() || undefined,
        businessCountry: getCountrySync(businessAddress.countryCode)?.name || undefined,
        businessPhone: form.businessPhone.trim() || undefined,
        acceptContract: form.acceptContract,
      });
      router.push('/home');
    } catch (err: unknown) {
      const error = err as { message?: string };
      setApiError(error?.message || 'Error al crear la cuenta. Intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmitFreelancer(e: FormEvent) {
    e.preventDefault();
    setApiError(null);
    if (!validateFreelancer()) return;
    setIsLoading(true);
    try {
      await register({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email,
        password: form.password,
        phone: form.phone.trim(),
        type: 'freelancer',
        // Direccion del LOCAL profesional → guarda en Tenant.address
        businessStreet: [localAddress.street.trim(), localAddress.number.trim()].filter(Boolean).join(' ') || undefined,
        businessCity: localAddress.city.trim() || undefined,
        businessState: localAddress.region.trim() || undefined,
        businessPostalCode: localAddress.postalCode.trim() || undefined,
        businessCountry: getCountrySync(localAddress.countryCode)?.name || undefined,
        acceptContract: form.acceptContract,
        acceptPrivacy: form.acceptPrivacy,
      });
      router.push('/employee');
    } catch (err: unknown) {
      const error = err as { message?: string };
      setApiError(error?.message || 'Error al crear la cuenta. Intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmitBusiness(e: FormEvent) {
    e.preventDefault();
    setApiError(null);
    if (!validateBusiness()) return;

    setIsLoading(true);
    try {
      // Re-verify invite code right before submit so límite de usos / expiración / desactivación
      // se detecten ANTES de procesar el formulario completo.
      const code = form.inviteCode.trim();
      const previewRes = await fetch(`${API_URL_REG}/api/auth/invite-preview/${code}`, { cache: 'no-store' });
      if (!previewRes.ok) {
        const errJson = await previewRes.json().catch(() => ({}));
        const msg = (Array.isArray(errJson?.message) ? errJson.message[0] : errJson?.message) || 'Código inválido o expirado';
        setErrors((e2) => ({ ...e2, inviteCode: msg }));
        setInvitePreview(null);
        setIsLoading(false);
        return;
      }

      // Direccion PERSONAL del empleado afiliado → guarda en User.address.
      // Serializamos al mismo formato string del backend para reutilizar
      // el handler del backend que ya espera ese formato.
      const personalAddrStr = serializeAddressForBackend(personalAddress);

      await register({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email,
        password: form.password,
        phone: form.phone.trim(),
        inviteCode: code,
        personalAddress: personalAddrStr || undefined,
      });
      router.push('/employee');
    } catch (err: unknown) {
      const error = err as { message?: string };
      setApiError(error?.message || 'Error al crear la cuenta. Intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  }

  function validateClient(): boolean {
    const newErrors: FormErrors = {};
    if (!form.firstName.trim()) newErrors.firstName = 'El nombre es requerido';
    if (!form.lastName.trim()) newErrors.lastName = 'El apellido es requerido';
    if (!form.email) {
      newErrors.email = 'El correo es requerido';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = 'Ingresa un correo válido';
    }
    if (!form.password) {
      newErrors.password = 'La contraseña es requerida';
    } else {
      const pwdErr = validatePassword(form.password);
      if (pwdErr) newErrors.password = pwdErr;
    }
    if (!form.confirmPassword) {
      newErrors.confirmPassword = 'Confirma tu contraseña';
    } else if (form.password !== form.confirmPassword) {
      newErrors.confirmPassword = 'Las contraseñas no coinciden';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmitClient(e: FormEvent) {
    e.preventDefault();
    setApiError(null);
    if (!validateClient()) return;

    setIsLoading(true);
    try {
      await marketplaceApi.registerAndStore({
        email: form.email,
        password: form.password,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone.trim() || undefined,
      });
      // Limpiar dismissed key del CompleteProfileGate. Sin esto, si el usuario
      // ya habia cerrado el modal en una sesion previa de esta pestaña, no lo
      // veria al registrarse de nuevo y faltaria captura de phone/birthDate/
      // gender/allergies que ahora ya no se piden en el form de registro.
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('marketplace_profile_dismissed');
      }
      router.push('/marketplace');
    } catch (err: unknown) {
      const error = err as { message?: string };
      setApiError(error?.message || 'Error al crear la cuenta. Intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  }

  function updateField(field: keyof FormState, value: string | boolean | string[]) {
    setForm((f) => ({ ...f, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  }

  const API_URL_REG = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  async function verifyInviteCode() {
    const code = form.inviteCode.trim();
    if (code.length < 6) return;
    setPreviewLoading(true);
    try {
      const res = await fetch(`${API_URL_REG}/api/auth/invite-preview/${code}`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const msg = (Array.isArray(errJson?.message) ? errJson.message[0] : errJson?.message) || 'Código inválido o expirado';
        setErrors((e) => ({ ...e, inviteCode: msg }));
        setInvitePreview(null);
        return;
      }
      const json = await res.json();
      setInvitePreview(json.data);
      setShowPreviewPopup(true);
      setErrors((e) => ({ ...e, inviteCode: undefined }));
    } catch {
      setErrors((e) => ({ ...e, inviteCode: 'Error al verificar el código' }));
    } finally {
      setPreviewLoading(false);
    }
  }

  // ─── SELECT MODE ──────────────────────────────────
  if (mode === 'select') {
    return (
      <div className="min-h-[100dvh] bg-gray-50 flex items-center justify-center px-4 py-3">
        <div className="w-full max-w-md">
          <div className="text-center mb-4">
            <h1 className="text-2xl font-bold text-[#008080]">Siliba</h1>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
            <h2 className="text-base font-semibold text-gray-900 mb-1">¿Qué tipo de cuenta deseas crear?</h2>
            <p className="text-xs text-gray-500 mb-4">Cada tipo es para un perfil distinto. Elige el que mejor se adapte a ti.</p>

            <div className="space-y-2">
              {/* Cliente */}
              <button
                onClick={() => setMode('client')}
                className="w-full text-left p-4 rounded-xl border-2 border-gray-200 hover:border-[#008080] hover:bg-teal-50 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 bg-[#e0f2f1] rounded-xl flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-[#008080]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900">Cliente</p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-snug">
                      Para reservar servicios en negocios de belleza, bienestar y cuidado personal. Explora el marketplace, agenda citas, compra productos y acumula puntos.
                    </p>
                  </div>
                </div>
              </button>

              {/* Profesional */}
              <button
                onClick={() => setMode('business')}
                className="w-full text-left p-4 rounded-xl border-2 border-gray-200 hover:border-[#008080] hover:bg-teal-50 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 bg-[#e0f2f1] rounded-xl flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-[#008080]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900">Profesional</p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-snug">
                      Para estilistas, terapeutas, barberos o cualquier especialista que trabaje de manera independiente o dentro de un negocio existente. Gestiona tu agenda, perfil y citas.
                    </p>
                  </div>
                </div>
              </button>

              {/* Administrador */}
              <button
                onClick={() => setMode('individual')}
                className="w-full text-left p-4 rounded-xl border-2 border-gray-200 hover:border-[#008080] hover:bg-teal-50 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 bg-[#e0f2f1] rounded-xl flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-[#008080]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900">Administrador</p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-snug">
                      Para dueños de negocios (salones, barberías, spas, clínicas) que gestionan un equipo. Administra empleados, sucursales, citas, inventario y reportes desde el panel administrativo.
                    </p>
                  </div>
                </div>
              </button>
            </div>

            {/* FAQ */}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <details className="group">
                <summary className="cursor-pointer text-xs text-gray-600 font-medium flex items-center justify-between list-none">
                  <span>¿Puedo cambiar el tipo de cuenta después?</span>
                  <svg className="w-4 h-4 text-gray-400 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <p className="text-xs text-gray-500 mt-2 leading-snug">
                  Sí. Puedes tener varios tipos de cuenta con el mismo correo y alternar entre ellos desde el selector de perfil al iniciar sesión. Por ejemplo: usar el sistema como Administrador de tu negocio y a la vez reservar citas como Cliente en otros negocios.
                </p>
              </details>
            </div>
          </div>

          <p className="text-center mt-6 text-sm text-gray-500">
            ¿Ya tienes cuenta?{' '}
            <Link href="/login" className="text-primary-600 hover:text-primary-700 font-medium">
              Iniciar sesión
            </Link>
          </p>
        </div>
      </div>
    );
  }

  // El menu intermedio "¿Cómo trabajas?" (Unirme/Independiente) se elimino:
  // el mode='business' ya tiene esas dos opciones como pestañas arriba del
  // form (Afiliarme a un negocio | Trabajar como independiente).

  // ─── BUSINESS / FREELANCER ───────────────────────
  if (mode === 'business') {
    const isFreelancer = professionalType === 'freelancer';

    // Habilitar el submit solo cuando todos los campos requeridos estan
    // llenos y validos (heuristica rapida que coincide con validateBusiness/
    // validateFreelancer pero sin tocar el state de errores).
    const phoneDigits = form.phone.replace(/^[+\d\s\-()]*?(\d{10})$/, '$1').replace(/\D/g, '');
    const phoneOk = phoneDigits.length === 10;
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);
    const pwdOk = !validatePassword(form.password) && form.password === form.confirmPassword;
    const baseOk =
      !!form.firstName.trim() &&
      !!form.lastName.trim() &&
      emailOk &&
      phoneOk &&
      pwdOk &&
      form.acceptContract &&
      form.acceptPrivacy;
    const canSubmit = isFreelancer
      ? baseOk
      : baseOk && !!form.inviteCode.trim();

    return (
      <div className="h-[100dvh] bg-gray-50 flex flex-col">
        {/* Header sticky con logo + back */}
        <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-3 safe-top">
          <div className="max-w-md mx-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (typeParam === 'business') router.push('/login');
                else setMode('select');
              }}
              className="text-gray-400 hover:text-gray-600 flex-shrink-0"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-xl font-bold tracking-tight" style={{ color: '#008080' }}>Siliba</h1>
            <span className="text-sm text-gray-400 ml-1">· Registro profesional</span>
          </div>
        </div>

        {/* Contenido scrolleable */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="w-full max-w-md mx-auto">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Crear cuenta profesional</h2>

            {/* Tipo de profesional — segmented estilo "Cupones | Mis puntos"
                (rounded-lg border border-gray-300 + activo teal solido). */}
            <div className="flex rounded-lg border border-gray-300 overflow-hidden mb-6">
              <button
                type="button"
                onClick={() => { setProfessionalType('affiliated'); setErrors({}); setApiError(null); }}
                className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                  !isFreelancer ? 'bg-[#008080] text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                Afiliarme a un negocio
              </button>
              <button
                type="button"
                onClick={() => { setProfessionalType('freelancer'); setErrors({}); setApiError(null); }}
                className={`flex-1 px-4 py-2 text-sm font-medium transition-colors border-l border-gray-300 ${
                  isFreelancer ? 'bg-[#008080] text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                Trabajar como independiente
              </button>
            </div>

            {apiError && (
              <div className="mb-4 p-4 rounded-lg bg-red-50 border border-red-200 flex items-start gap-3">
                <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <p className="text-sm text-red-700">{apiError}</p>
              </div>
            )}

            <form id="business-form" onSubmit={isFreelancer ? handleSubmitFreelancer : handleSubmitBusiness} className="space-y-4">
              {/* Código de invitación — solo para afiliados */}
              {!isFreelancer && (
                <div>
                  <label htmlFor="inviteCode" className="block text-sm font-medium text-gray-700 mb-1.5">Código de invitación</label>
                  <div className="flex gap-2">
                    <input id="inviteCode" type="text" value={form.inviteCode}
                      onChange={(e) => { updateField('inviteCode', e.target.value.toUpperCase()); setInvitePreview(null); }}
                      className={`flex-1 input-field uppercase tracking-widest text-center font-mono ${errors.inviteCode ? 'border-red-400' : ''}`}
                      placeholder="Ej: DEMOSALON" maxLength={20} />
                    <button
                      type="button"
                      onClick={verifyInviteCode}
                      disabled={previewLoading || form.inviteCode.length < 6}
                      className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40 transition-colors flex-shrink-0"
                      style={{ backgroundColor: '#008080' }}
                    >
                      {previewLoading ? '...' : 'Verificar'}
                    </button>
                  </div>
                  {errors.inviteCode && <p className="mt-1 text-xs text-red-600">{errors.inviteCode}</p>}
                  {invitePreview && !showPreviewPopup && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-[#008080] bg-teal-50 border border-teal-100 rounded-lg px-3 py-2">
                      <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Código verificado: <strong>{invitePreview.businessName}</strong> · {invitePreview.jobTitle || 'Sin puesto especificado'}</span>
                    </div>
                  )}
                </div>
              )}

              {isFreelancer && (
                <p className="text-xs text-gray-500 bg-teal-50 border border-teal-100 rounded-lg px-3 py-2">
                  Crearás tu propio espacio en Siliba. <span className="font-semibold text-[#008080]">$300 MXN/mes</span> tras el período de prueba de 30 días.
                </p>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1.5">Nombre</label>
                  <input id="firstName" type="text" value={form.firstName}
                    onChange={(e) => updateField('firstName', e.target.value)}
                    className={`input-field ${errors.firstName ? 'border-red-400' : ''}`} placeholder="Tu nombre" />
                  {errors.firstName && <p className="mt-1 text-xs text-red-600">{errors.firstName}</p>}
                </div>
                <div>
                  <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1.5">Apellido</label>
                  <input id="lastName" type="text" value={form.lastName}
                    onChange={(e) => updateField('lastName', e.target.value)}
                    className={`input-field ${errors.lastName ? 'border-red-400' : ''}`} placeholder="Tu apellido" />
                  {errors.lastName && <p className="mt-1 text-xs text-red-600">{errors.lastName}</p>}
                </div>
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">Correo electrónico</label>
                <input id="email" type="email" autoComplete="email" value={form.email}
                  onChange={(e) => updateField('email', e.target.value)}
                  className={`input-field ${errors.email ? 'border-red-400' : ''}`} placeholder="correo@ejemplo.com" />
                {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Teléfono</label>
                <PhoneInput
                  value={form.phone}
                  onChange={(v) => updateField('phone', v)}
                  error={errors.phone}
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">Contraseña</label>
                <div className="relative">
                  <input id="password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={form.password}
                    onChange={(e) => updateField('password', e.target.value)}
                    className={`input-field pr-10 ${errors.password ? 'border-red-400' : ''}`} placeholder="Mínimo 6 caracteres" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" /></svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    )}
                  </button>
                </div>
                {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password}</p>}
                <PasswordRules password={form.password} />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1.5">Confirmar contraseña</label>
                <div className="relative">
                  <input id="confirmPassword" type={showConfirmPassword ? 'text' : 'password'} autoComplete="new-password" value={form.confirmPassword}
                    onChange={(e) => updateField('confirmPassword', e.target.value)}
                    className={`input-field pr-10 ${errors.confirmPassword ? 'border-red-400' : ''}`} placeholder="Repite tu contraseña" />
                  <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showConfirmPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" /></svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    )}
                  </button>
                </div>
                {errors.confirmPassword && <p className="mt-1 text-xs text-red-600">{errors.confirmPassword}</p>}
                <PasswordMatch password={form.password} confirmPassword={form.confirmPassword} />
              </div>

              {/* Direccion — cambia segun pestaña:
                  - Afiliado: pide direccion PERSONAL del empleado (User.address)
                  - Freelancer: pide direccion del LOCAL profesional (Tenant.address)
                  Las 2 son distintas porque el empleado vive en un lugar y el
                  local de un freelancer puede estar en otro. */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">
                  {isFreelancer ? 'Dirección de tu local' : 'Dirección personal'}
                  <span className="text-gray-400 font-normal"> (opcional)</span>
                </p>
                <p className="text-xs text-gray-500 mb-3 leading-relaxed">
                  {isFreelancer
                    ? 'Donde atiendes a tus clientes. Aparece en tu perfil del marketplace.'
                    : 'Tu dirección personal. La empresa la usa para nómina y contacto.'}
                </p>
                <AddressFields
                  value={isFreelancer ? localAddress : personalAddress}
                  onChange={isFreelancer ? setLocalAddress : setPersonalAddress}
                />
              </div>

              {/* T&C + privacidad — obligatorios en ambos casos.
                  Antes solo aparecian en freelancer; en afiliado tambien
                  son legalmente necesarios. */}
              <div className="space-y-2 pt-1">
                <div className="flex items-start gap-2">
                  <input type="checkbox" checked={form.acceptContract}
                    onChange={(e) => updateField('acceptContract', e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#008080] focus:ring-[#008080]" />
                  <span className="text-xs text-gray-600">
                    Acepto los{' '}
                    <button type="button" onClick={() => setLegalModal({ url: '/legal/terms', title: 'Términos y condiciones' })} className="text-[#008080] underline font-medium">
                      términos y condiciones
                    </button>
                  </span>
                </div>
                {errors.acceptContract && <p className="text-xs text-red-600 ml-6">{errors.acceptContract}</p>}
                <div className="flex items-start gap-2">
                  <input type="checkbox" checked={form.acceptPrivacy}
                    onChange={(e) => updateField('acceptPrivacy', e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#008080] focus:ring-[#008080]" />
                  <span className="text-xs text-gray-600">
                    Acepto el{' '}
                    <button type="button" onClick={() => setLegalModal({ url: '/legal/privacy', title: 'Aviso de privacidad' })} className="text-[#008080] underline font-medium">
                      aviso de privacidad
                    </button>
                  </span>
                </div>
                {errors.acceptPrivacy && <p className="text-xs text-red-600 ml-6">{errors.acceptPrivacy}</p>}
              </div>
            </form>

            <p className="text-center mt-6 text-sm text-gray-500">
              ¿Ya tienes cuenta?{' '}
              <Link href="/login" className="text-primary-600 hover:text-primary-700 font-medium">Iniciar sesión</Link>
            </p>
          </div>
          </div>
        </div>

        {/* Footer sticky con submit. El boton hace submit del form via
            atributo form="business-form" (HTML5). Disabled hasta que
            todos los campos requeridos esten validos. */}
        <div
          className="flex-shrink-0 bg-white border-t border-gray-200 px-4 py-3"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
        >
          <div className="max-w-md mx-auto">
            <button
              type="submit"
              form="business-form"
              disabled={isLoading || !canSubmit}
              className="w-full btn-primary flex items-center justify-center gap-2 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading && (
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {isLoading ? 'Creando cuenta...' : isFreelancer ? 'Comenzar período de prueba' : 'Crear cuenta'}
            </button>
          </div>
        </div>

        {/* Preview popup */}
        {showPreviewPopup && invitePreview && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center">
              {invitePreview.logoUrl ? (
                <img
                  src={`${API_URL_REG}${invitePreview.logoUrl}`}
                  alt={invitePreview.businessName}
                  className="w-16 h-16 rounded-full object-cover mx-auto mb-3 border border-gray-200"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-[#e0f2f1] flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl font-bold text-[#008080]">
                    {invitePreview.businessName[0]}
                  </span>
                </div>
              )}
              <h2 className="text-xl font-bold text-gray-900 mb-1">{invitePreview.businessName}</h2>
              {invitePreview.ownerName && (
                <p className="text-sm text-gray-500 mb-1">Propietario: <span className="font-medium text-gray-700">{invitePreview.ownerName}</span></p>
              )}
              {invitePreview.jobTitle && (
                <p className="text-sm text-gray-500 mb-3">Puesto: <span className="font-semibold text-[#008080]">{invitePreview.jobTitle}</span></p>
              )}
              {invitePreview.services && invitePreview.services.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs text-gray-400 mb-2">Servicios asignados</p>
                  {/* Lista vertical con check teal por servicio. Más
                      legible cuando hay varios servicios; las cápsulas en
                      una sola fila quedaban apretadas. */}
                  <ul className="text-left rounded-xl border border-gray-100 bg-gray-50 max-h-40 overflow-y-auto divide-y divide-gray-100">
                    {invitePreview.services.map((s) => (
                      <li key={s.id} className="flex items-center gap-2 px-3 py-2">
                        <svg className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#008080' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-sm text-gray-700">{s.name}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="text-sm text-gray-600 mb-5">
                ¿Confirmas que quieres unirte a este negocio?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowPreviewPopup(false); setInvitePreview(null); updateField('inviteCode', ''); }}
                  className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => setShowPreviewPopup(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white"
                  style={{ backgroundColor: '#008080' }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#006666')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#008080')}
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de T&C / Aviso de privacidad. Vive en esta rama porque
            el return de abajo nunca llega hasta el modal global del
            individual/admin. Sin esto los links no abrían nada. */}
        {legalModal && (
          <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-3" onClick={() => setLegalModal(null)}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl h-[85vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between p-4 border-b border-gray-100 flex-shrink-0">
                <h3 className="text-base font-semibold text-gray-900">{legalModal.title}</h3>
                <button onClick={() => setLegalModal(null)} className="p-1.5 rounded-lg hover:bg-gray-100" aria-label="Cerrar">
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <iframe src={legalModal.url} className="flex-1 w-full border-0" title={legalModal.title} />
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── CLIENT (MARKETPLACE) ───────────────────────
  if (mode === 'client') {
    return (
      <div className="h-[100dvh] overflow-hidden bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-md my-3">
          <div className="text-center mb-3">
            <h1 className="text-2xl font-bold text-[#008080]">Siliba</h1>
          </div>

          <div className="bg-white rounded-xl md:rounded-2xl shadow-sm border border-gray-200 p-3 md:p-6">
            <div className="flex items-center gap-2 mb-3">
              <button onClick={() => setMode('select')} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h2 className="text-base font-semibold text-gray-900">Crear cuenta de cliente</h2>
            </div>

            <SocialLoginButtons
              onSocialLogin={async (provider, token) => {
                setApiError(null);
                setIsLoading(true);
                try {
                  await marketplaceApi.socialLoginAndStore(provider, token);
                  if (typeof window !== 'undefined') {
                    sessionStorage.removeItem('marketplace_profile_dismissed');
                  }
                  router.push('/marketplace');
                } catch (err: unknown) {
                  const error = err as { message?: string };
                  setApiError(error?.message || 'Error al crear la cuenta. Intenta de nuevo.');
                } finally {
                  setIsLoading(false);
                }
              }}
              disabled={isLoading}
            />

            {apiError && (
              <div className="mb-3 p-2.5 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2">
                <svg className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <p className="text-xs text-red-700">{apiError}</p>
              </div>
            )}

            <form onSubmit={handleSubmitClient} className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="clientFirstName" className="block text-xs font-medium text-gray-700 mb-0.5">Nombre</label>
                  <input id="clientFirstName" type="text" value={form.firstName}
                    onChange={(e) => updateField('firstName', e.target.value)}
                    className={`input-field py-1.5 text-sm ${errors.firstName ? 'border-red-400' : ''}`} placeholder="Tu nombre" />
                  {errors.firstName && <p className="mt-0.5 text-[10px] text-red-600">{errors.firstName}</p>}
                </div>
                <div>
                  <label htmlFor="clientLastName" className="block text-xs font-medium text-gray-700 mb-0.5">Apellido</label>
                  <input id="clientLastName" type="text" value={form.lastName}
                    onChange={(e) => updateField('lastName', e.target.value)}
                    className={`input-field py-1.5 text-sm ${errors.lastName ? 'border-red-400' : ''}`} placeholder="Tu apellido" />
                  {errors.lastName && <p className="mt-0.5 text-[10px] text-red-600">{errors.lastName}</p>}
                </div>
              </div>

              <div>
                <label htmlFor="clientEmail" className="block text-xs font-medium text-gray-700 mb-0.5">Correo electrónico</label>
                <input id="clientEmail" type="email" autoComplete="email" value={form.email}
                  onChange={(e) => updateField('email', e.target.value)}
                  className={`input-field py-1.5 text-sm ${errors.email ? 'border-red-400' : ''}`} placeholder="correo@ejemplo.com" />
                {errors.email && <p className="mt-0.5 text-[10px] text-red-600">{errors.email}</p>}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="clientPassword" className="block text-xs font-medium text-gray-700 mb-0.5">Contraseña</label>
                  <input id="clientPassword" type="password" autoComplete="new-password" value={form.password}
                    onChange={(e) => updateField('password', e.target.value)}
                    className={`input-field py-1.5 text-sm ${errors.password ? 'border-red-400' : ''}`} placeholder="Mín. 6 caracteres" />
                  {errors.password && <p className="mt-0.5 text-[10px] text-red-600">{errors.password}</p>}
                </div>
                <div>
                  <label htmlFor="clientConfirmPassword" className="block text-xs font-medium text-gray-700 mb-0.5">Confirmar</label>
                  <input id="clientConfirmPassword" type="password" autoComplete="new-password" value={form.confirmPassword}
                    onChange={(e) => updateField('confirmPassword', e.target.value)}
                    className={`input-field py-1.5 text-sm ${errors.confirmPassword ? 'border-red-400' : ''}`} placeholder="Repite" />
                  {errors.confirmPassword && <p className="mt-0.5 text-[10px] text-red-600">{errors.confirmPassword}</p>}
                </div>
              </div>
              <PasswordRules password={form.password} />
              <PasswordMatch password={form.password} confirmPassword={form.confirmPassword} />

              <button type="submit" disabled={isLoading}
                className="w-full btn-primary flex items-center justify-center gap-2 py-2 text-sm">
                {isLoading && (
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {isLoading ? 'Creando cuenta...' : 'Crear cuenta'}
              </button>
            </form>

          </div>

          <p className="text-center mt-3 text-xs text-gray-500">
            ¿Ya tienes cuenta?{' '}
            <Link href="/login" className="text-primary-600 hover:text-primary-700 font-medium">Iniciar sesión</Link>
          </p>
        </div>
      </div>
    );
  }

  // ─── INDIVIDUAL (WIZARD) ─────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary-600">Siliba</h1>
          <p className="mt-2 text-gray-500 text-sm">Crea tu negocio en minutos</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {[1, 2].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                s <= step ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-500'
              }`}>
                {s < step ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : s}
              </div>
              {s < 2 && <div className={`w-12 h-0.5 ${s < step ? 'bg-primary-600' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <div className="flex items-center gap-2 mb-6">
            <button
              onClick={() => {
                setApiError(null);
                if (step > 1) setStep(step - 1);
                else if (typeParam === 'individual') {
                  // Vino del selector del login (Admin). Volver al selector
                  // que se restaura desde sessionStorage en /login.
                  router.push('/login');
                } else {
                  // Entro a /register manualmente y eligio "Administrador"
                  // en el selector inicial. Vuelve al selector de tipo.
                  setMode('select');
                }
              }}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 className="text-xl font-semibold text-gray-900">
              {step === 1 && 'Tus datos personales'}
              {step === 2 && 'Datos del negocio'}
            </h2>
          </div>

          {apiError && (
            <div className="mb-4 p-4 rounded-lg bg-red-50 border border-red-200 flex items-start gap-3">
              <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <p className="text-sm text-red-700">{apiError}</p>
            </div>
          )}

          {/* Step 1: Personal data */}
          {/* Si el usuario ya esta logueado como cliente y tenemos sus datos
              (firstName, lastName, email, phone), mostramos solo la captura
              de password. El cliente confirma con "Continuar". Si falta algun
              dato, mostramos el form completo. */}
          {step === 1 && (() => {
            const hasAllData = prefilledFromClient
              && !editingPersonalData
              && form.firstName.trim()
              && form.lastName.trim()
              && form.email.trim()
              && form.phone.trim();

            if (hasAllData) {
              return (
                <div className="space-y-4">
                  {/* Resumen de datos del cliente, read-only con opcion editar */}
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{form.firstName} {form.lastName}</p>
                        <p className="text-xs text-gray-500 truncate">{form.email}</p>
                        <p className="text-xs text-gray-500 truncate">{form.phone}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditingPersonalData(true)}
                        className="text-xs font-medium text-[#008080] hover:underline flex-shrink-0"
                      >
                        Editar
                      </button>
                    </div>
                    <p className="mt-2 text-[11px] text-gray-400">Usaremos los datos de tu cuenta de cliente.</p>
                  </div>

                  <p className="text-xs text-gray-500">Crea una contraseña para tu cuenta de administrador.</p>

                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">Contraseña</label>
                    <input id="password" type="password" autoComplete="new-password" value={form.password}
                      onChange={(e) => updateField('password', e.target.value)}
                      className={`input-field ${errors.password ? 'border-red-400' : ''}`} placeholder="Mínimo 6 caracteres" />
                    {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password}</p>}
                    <PasswordRules password={form.password} />
                  </div>

                  <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1.5">Confirmar contraseña</label>
                    <input id="confirmPassword" type="password" autoComplete="new-password" value={form.confirmPassword}
                      onChange={(e) => updateField('confirmPassword', e.target.value)}
                      className={`input-field ${errors.confirmPassword ? 'border-red-400' : ''}`} placeholder="Repite tu contraseña" />
                    {errors.confirmPassword && <p className="mt-1 text-xs text-red-600">{errors.confirmPassword}</p>}
                    <PasswordMatch password={form.password} confirmPassword={form.confirmPassword} />
                  </div>

                  <button type="button" onClick={handleNextStep}
                    className="w-full btn-primary py-2.5">
                    Continuar
                  </button>
                </div>
              );
            }

            return (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1.5">Nombre</label>
                  <input id="firstName" type="text" value={form.firstName}
                    onChange={(e) => updateField('firstName', e.target.value)}
                    className={`input-field ${errors.firstName ? 'border-red-400' : ''}`} placeholder="Tu nombre" />
                  {errors.firstName && <p className="mt-1 text-xs text-red-600">{errors.firstName}</p>}
                </div>
                <div>
                  <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1.5">Apellido</label>
                  <input id="lastName" type="text" value={form.lastName}
                    onChange={(e) => updateField('lastName', e.target.value)}
                    className={`input-field ${errors.lastName ? 'border-red-400' : ''}`} placeholder="Tu apellido" />
                  {errors.lastName && <p className="mt-1 text-xs text-red-600">{errors.lastName}</p>}
                </div>
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">Correo electrónico</label>
                <input id="email" type="email" autoComplete="email" value={form.email}
                  onChange={(e) => updateField('email', e.target.value)}
                  className={`input-field ${errors.email ? 'border-red-400' : ''}`} placeholder="correo@ejemplo.com" />
                {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Teléfono personal</label>
                <PhoneInput
                  id="phone"
                  value={form.phone}
                  onChange={(v) => updateField('phone', v)}
                  error={errors.phone}
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">Contraseña</label>
                <input id="password" type="password" autoComplete="new-password" value={form.password}
                  onChange={(e) => updateField('password', e.target.value)}
                  className={`input-field ${errors.password ? 'border-red-400' : ''}`} placeholder="Mínimo 6 caracteres" />
                {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password}</p>}
                <PasswordRules password={form.password} />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1.5">Confirmar contraseña</label>
                <input id="confirmPassword" type="password" autoComplete="new-password" value={form.confirmPassword}
                  onChange={(e) => updateField('confirmPassword', e.target.value)}
                  className={`input-field ${errors.confirmPassword ? 'border-red-400' : ''}`} placeholder="Repite tu contraseña" />
                {errors.confirmPassword && <p className="mt-1 text-xs text-red-600">{errors.confirmPassword}</p>}
                <PasswordMatch password={form.password} confirmPassword={form.confirmPassword} />
              </div>

              <button type="button" onClick={handleNextStep}
                className="w-full btn-primary py-2.5">
                Siguiente
              </button>
            </div>
            );
          })()}

          {/* Step 2: Business info */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label htmlFor="businessName" className="block text-sm font-medium text-gray-700 mb-1.5">Nombre del negocio</label>
                <input id="businessName" type="text" value={form.businessName}
                  onChange={(e) => updateField('businessName', e.target.value)}
                  className={`input-field ${errors.businessName ? 'border-red-400' : ''}`} placeholder="Mi Salón de Belleza" />
                {errors.businessName && <p className="mt-1 text-xs text-red-600">{errors.businessName}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de negocio <span className="text-gray-400 font-normal">(puedes seleccionar varios)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {BUSINESS_TYPES.map((bt) => {
                    const selected = form.businessTypes.includes(bt.value);
                    return (
                      <button
                        key={bt.value}
                        type="button"
                        onClick={() => toggleBusinessType(bt.value)}
                        className="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors"
                        style={selected
                          ? { backgroundColor: '#008080', color: 'white', border: '1.5px solid #008080' }
                          : { backgroundColor: 'white', color: '#6b7280', border: '1.5px solid #e5e7eb' }
                        }
                      >
                        {bt.label}
                      </button>
                    );
                  })}
                </div>
                {errors.businessTypes && <p className="mt-1 text-xs text-red-600">{errors.businessTypes}</p>}
              </div>

              {/* Address — droplists de pais y estado/provincia/departamento */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-3">
                  Dirección principal <span className="text-gray-400 font-normal">(opcional)</span>
                </p>
                <AddressFields value={businessAddress} onChange={setBusinessAddress} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Teléfono del negocio
                </label>
                <PhoneInput
                  value={form.businessPhone}
                  onChange={(v) => updateField('businessPhone', v)}
                />
              </div>

              {/* T&C checkboxes */}
              <div className="space-y-3 pt-2">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.acceptContract}
                    onChange={(e) => updateField('acceptContract', e.target.checked)}
                    className="mt-1 rounded border-gray-300 text-[#008080] focus:ring-[#008080]" />
                  <span className="text-sm text-gray-600">
                    Acepto los{' '}
                    <button type="button" onClick={(e) => { e.preventDefault(); setLegalModal({ url: '/legal/terms', title: 'Términos y condiciones' }); }}
                      className="text-[#008080] font-medium hover:underline">
                      términos y condiciones
                    </button>
                  </span>
                </label>
                {errors.acceptContract && <p className="text-xs text-red-600 ml-6">{errors.acceptContract}</p>}

                <label className="flex items-start gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.acceptPrivacy}
                    onChange={(e) => updateField('acceptPrivacy', e.target.checked)}
                    className="mt-1 rounded border-gray-300 text-[#008080] focus:ring-[#008080]" />
                  <span className="text-sm text-gray-600">
                    Acepto el{' '}
                    <button type="button" onClick={(e) => { e.preventDefault(); setLegalModal({ url: '/legal/privacy', title: 'Aviso de privacidad' }); }}
                      className="text-[#008080] font-medium hover:underline">
                      aviso de privacidad
                    </button>
                  </span>
                </label>
                {errors.acceptPrivacy && <p className="text-xs text-red-600 ml-6">{errors.acceptPrivacy}</p>}
              </div>

              <button type="button" onClick={(e) => handleSubmitIndividual(e as any)} disabled={isLoading}
                className="w-full btn-primary flex items-center justify-center gap-2 py-2.5">
                {isLoading && (
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {isLoading ? 'Creando cuenta...' : 'Crear cuenta'}
              </button>
            </div>
          )}
        </div>

        <p className="text-center mt-6 text-sm text-gray-500">
          ¿Ya tienes cuenta?{' '}
          <Link href="/" className="text-primary-600 hover:text-primary-700 font-medium">Iniciar sesión</Link>
        </p>
      </div>

      {/* Modal flotante con T&C o aviso de privacidad. Carga la página
          pública en un iframe para no duplicar contenido. */}
      {legalModal && (
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-3" onClick={() => setLegalModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl h-[85vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-100 flex-shrink-0">
              <h3 className="text-base font-semibold text-gray-900">{legalModal.title}</h3>
              <button onClick={() => setLegalModal(null)} className="p-1.5 rounded-lg hover:bg-gray-100" aria-label="Cerrar">
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <iframe src={legalModal.url} className="flex-1 w-full border-0" title={legalModal.title} />
          </div>
        </div>
      )}
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterPageInner />
    </Suspense>
  );
}
