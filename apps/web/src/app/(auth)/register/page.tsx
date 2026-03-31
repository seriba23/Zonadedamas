'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/use-auth';
import { marketplaceApi } from '@/lib/marketplace-api';
import { SocialLoginButtons } from '@/components/ui/social-login-buttons';

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

  // Parse incoming value if it starts with a known code
  useEffect(() => {
    if (!value) return;
    const matched = COUNTRY_CODES.find((c) => value.startsWith(c.code));
    if (matched) {
      setCountryCode(matched.code);
      setLocal(value.slice(matched.code.length).trim());
    } else {
      setLocal(value);
    }
  // Only on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleLocalChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/[^\d\s\-()]/g, '');
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
          value={local}
          onChange={handleLocalChange}
          className="flex-1 px-3 py-2.5 text-sm focus:outline-none bg-transparent"
          placeholder="55 1234 5678"
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
  businessStreet: string;
  businessCity: string;
  businessState: string;
  businessPostalCode: string;
  businessCountry: string;
  businessPhone: string;
  // Step 3 - Trial welcome (individual only)
  acceptContract: boolean;
}

interface FormErrors {
  [key: string]: string | undefined;
}

const BUSINESS_TYPES = [
  { value: 'SALON', label: 'Salón de belleza', icon: '💇' },
  { value: 'BARBERIA', label: 'Barbería', icon: '✂️' },
  { value: 'SPA', label: 'Spa', icon: '🧖' },
  { value: 'CLINICA', label: 'Clínica estética', icon: '🏥' },
  { value: 'TATUAJES', label: 'Tatuajes & Piercing', icon: '🎨' },
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

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { register } = useAuth();

  // Read ?type=individual|client|business from URL and skip the select screen
  const typeParam = searchParams.get('type') as RegisterMode | null;
  const initialMode: RegisterMode =
    typeParam === 'individual' || typeParam === 'business' || typeParam === 'client'
      ? typeParam
      : 'select';

  const [mode, setMode] = useState<RegisterMode>(initialMode);
  const [step, setStep] = useState(1);
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
    businessStreet: '',
    businessCity: '',
    businessState: '',
    businessPostalCode: '',
    businessCountry: '',
    businessPhone: '',
    acceptContract: false,
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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
      const digits = form.phone.replace(/\D/g, '');
      if (digits.length < 7) newErrors.phone = 'Ingresa un número de teléfono válido';
    }
    if (!form.password) {
      newErrors.password = 'La contraseña es requerida';
    } else if (form.password.length < 6) {
      newErrors.password = 'Mínimo 6 caracteres';
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
    if (!form.acceptContract) newErrors.acceptContract = 'Debes aceptar los términos';
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
    if (!form.phone.trim()) newErrors.phone = 'El teléfono es requerido';
    if (!form.password) {
      newErrors.password = 'La contraseña es requerida';
    } else if (form.password.length < 6) {
      newErrors.password = 'Mínimo 6 caracteres';
    }
    if (!form.confirmPassword) {
      newErrors.confirmPassword = 'Confirma tu contraseña';
    } else if (form.password !== form.confirmPassword) {
      newErrors.confirmPassword = 'Las contraseñas no coinciden';
    }
    if (!form.inviteCode.trim()) newErrors.inviteCode = 'El código de invitación es requerido';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleNextStep() {
    setApiError(null);
    if (step === 1 && validateStep1()) setStep(2);
    if (step === 2 && validateStep2()) setStep(3);
  }

  async function handleSubmitIndividual(e: FormEvent) {
    e.preventDefault();
    setApiError(null);
    if (!validateStep3()) return;

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
        businessStreet: form.businessStreet.trim() || undefined,
        businessCity: form.businessCity.trim() || undefined,
        businessState: form.businessState.trim() || undefined,
        businessPostalCode: form.businessPostalCode.trim() || undefined,
        businessCountry: form.businessCountry.trim() || undefined,
        businessPhone: form.businessPhone.trim() || undefined,
        acceptContract: form.acceptContract,
      });
      router.push('/calendar');
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
      await register({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email,
        password: form.password,
        phone: form.phone.trim(),
        inviteCode: form.inviteCode.trim(),
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
    } else if (form.password.length < 8) {
      newErrors.password = 'Mínimo 8 caracteres';
    } else if (!/[0-9]/.test(form.password)) {
      newErrors.password = 'Debe contener al menos un número';
    } else if (!/[!@#$%^&*()_+\-=[\]{}|;:'",.<>?/~`]/.test(form.password)) {
      newErrors.password = 'Debe contener al menos un símbolo';
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

  // ─── SELECT MODE ──────────────────────────────────
  if (mode === 'select') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-primary-600">Siliba</h1>
            <p className="mt-2 text-gray-500 text-sm">Crea tu cuenta</p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">
              ¿Cómo deseas registrarte?
            </h2>

            <div className="space-y-4">
              <button
                onClick={() => setMode('client')}
                className="w-full text-left p-4 rounded-xl border-2 border-gray-200 hover:border-primary-400 hover:bg-primary-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">💆</span>
                  <div>
                    <p className="font-semibold text-gray-900">Soy cliente</p>
                    <p className="text-sm text-gray-500">
                      Quiero reservar citas y descubrir negocios
                    </p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setMode('professional')}
                className="w-full text-left p-4 rounded-xl border-2 border-gray-200 hover:border-primary-400 hover:bg-primary-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">✂️</span>
                  <div>
                    <p className="font-semibold text-gray-900">Soy profesionista</p>
                    <p className="text-sm text-gray-500">
                      Trabajo para un negocio o soy independiente
                    </p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setMode('individual')}
                className="w-full text-left p-4 rounded-xl border-2 border-gray-200 hover:border-primary-400 hover:bg-primary-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🏢</span>
                  <div>
                    <p className="font-semibold text-gray-900">Soy empresario</p>
                    <p className="text-sm text-gray-500">
                      Quiero registrar mi negocio para ofrecer servicios
                    </p>
                  </div>
                </div>
              </button>
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

  // ─── PROFESSIONAL SUB-SELECTION ─────────────────
  if (mode === 'professional') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-primary-600">Siliba</h1>
            <p className="mt-2 text-gray-500 text-sm">Registro profesional</p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
            <div className="flex items-center gap-2 mb-6">
              <button onClick={() => setMode('select')} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h2 className="text-xl font-semibold text-gray-900">¿Cómo trabajas?</h2>
            </div>

            <div className="space-y-4">
              <button
                onClick={() => setMode('business')}
                className="w-full text-left p-4 rounded-xl border-2 border-gray-200 hover:border-primary-400 hover:bg-primary-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🏢</span>
                  <div>
                    <p className="font-semibold text-gray-900">Unirme a un negocio</p>
                    <p className="text-sm text-gray-500">
                      Tengo un código de invitación para unirme a un equipo
                    </p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setMode('individual')}
                className="w-full text-left p-4 rounded-xl border-2 border-gray-200 hover:border-primary-400 hover:bg-primary-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">💼</span>
                  <div>
                    <p className="font-semibold text-gray-900">Soy independiente</p>
                    <p className="text-sm text-gray-500">
                      Trabajo por mi cuenta y quiero gestionar mis citas
                    </p>
                  </div>
                </div>
              </button>
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

  // ─── BUSINESS (INVITE CODE) ──────────────────────
  if (mode === 'business') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-primary-600">Siliba</h1>
            <p className="mt-2 text-gray-500 text-sm">Únete a tu equipo de trabajo</p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
            <div className="flex items-center gap-2 mb-6">
              <button onClick={() => setMode('professional')} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h2 className="text-xl font-semibold text-gray-900">Unirme a un negocio</h2>
            </div>

            {apiError && (
              <div className="mb-4 p-4 rounded-lg bg-red-50 border border-red-200 flex items-start gap-3">
                <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <p className="text-sm text-red-700">{apiError}</p>
              </div>
            )}

            <form onSubmit={handleSubmitBusiness} className="space-y-4">
              <div>
                <label htmlFor="inviteCode" className="block text-sm font-medium text-gray-700 mb-1.5">Código de invitación</label>
                <input id="inviteCode" type="text" value={form.inviteCode}
                  onChange={(e) => updateField('inviteCode', e.target.value.toUpperCase())}
                  className={`input-field uppercase tracking-widest text-center font-mono ${errors.inviteCode ? 'border-red-400' : ''}`}
                  placeholder="Ej: DEMOSALON" maxLength={20} />
                {errors.inviteCode && <p className="mt-1 text-xs text-red-600">{errors.inviteCode}</p>}
              </div>

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
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1.5">Teléfono</label>
                <input id="phone" type="tel" value={form.phone}
                  onChange={(e) => updateField('phone', e.target.value)}
                  className={`input-field ${errors.phone ? 'border-red-400' : ''}`} placeholder="+1-555-0000" />
                {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone}</p>}
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">Contraseña</label>
                <input id="password" type="password" autoComplete="new-password" value={form.password}
                  onChange={(e) => updateField('password', e.target.value)}
                  className={`input-field ${errors.password ? 'border-red-400' : ''}`} placeholder="Mínimo 6 caracteres" />
                {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password}</p>}
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1.5">Confirmar contraseña</label>
                <input id="confirmPassword" type="password" autoComplete="new-password" value={form.confirmPassword}
                  onChange={(e) => updateField('confirmPassword', e.target.value)}
                  className={`input-field ${errors.confirmPassword ? 'border-red-400' : ''}`} placeholder="Repite tu contraseña" />
                {errors.confirmPassword && <p className="mt-1 text-xs text-red-600">{errors.confirmPassword}</p>}
              </div>

              <button type="submit" disabled={isLoading}
                className="w-full btn-primary flex items-center justify-center gap-2 py-2.5">
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

          <p className="text-center mt-6 text-sm text-gray-500">
            ¿Ya tienes cuenta?{' '}
            <Link href="/login" className="text-primary-600 hover:text-primary-700 font-medium">Iniciar sesión</Link>
          </p>
        </div>
      </div>
    );
  }

  // ─── CLIENT (MARKETPLACE) ───────────────────────
  if (mode === 'client') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-primary-600">Siliba</h1>
            <p className="mt-2 text-gray-500 text-sm">Descubre y reserva en los mejores negocios</p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
            <div className="flex items-center gap-2 mb-6">
              <button onClick={() => setMode('select')} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h2 className="text-xl font-semibold text-gray-900">Crear cuenta de cliente</h2>
            </div>

            <SocialLoginButtons
              onSocialLogin={async (provider, token) => {
                setApiError(null);
                setIsLoading(true);
                try {
                  await marketplaceApi.socialLoginAndStore(provider, token);
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
              <div className="mb-4 p-4 rounded-lg bg-red-50 border border-red-200 flex items-start gap-3">
                <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <p className="text-sm text-red-700">{apiError}</p>
              </div>
            )}

            <form onSubmit={handleSubmitClient} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="clientFirstName" className="block text-sm font-medium text-gray-700 mb-1.5">Nombre</label>
                  <input id="clientFirstName" type="text" value={form.firstName}
                    onChange={(e) => updateField('firstName', e.target.value)}
                    className={`input-field ${errors.firstName ? 'border-red-400' : ''}`} placeholder="Tu nombre" />
                  {errors.firstName && <p className="mt-1 text-xs text-red-600">{errors.firstName}</p>}
                </div>
                <div>
                  <label htmlFor="clientLastName" className="block text-sm font-medium text-gray-700 mb-1.5">Apellido</label>
                  <input id="clientLastName" type="text" value={form.lastName}
                    onChange={(e) => updateField('lastName', e.target.value)}
                    className={`input-field ${errors.lastName ? 'border-red-400' : ''}`} placeholder="Tu apellido" />
                  {errors.lastName && <p className="mt-1 text-xs text-red-600">{errors.lastName}</p>}
                </div>
              </div>

              <div>
                <label htmlFor="clientEmail" className="block text-sm font-medium text-gray-700 mb-1.5">Correo electrónico</label>
                <input id="clientEmail" type="email" autoComplete="email" value={form.email}
                  onChange={(e) => updateField('email', e.target.value)}
                  className={`input-field ${errors.email ? 'border-red-400' : ''}`} placeholder="correo@ejemplo.com" />
                {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
              </div>

              <div>
                <label htmlFor="clientPhone" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Teléfono <span className="text-gray-400">(opcional)</span>
                </label>
                <input id="clientPhone" type="tel" value={form.phone}
                  onChange={(e) => updateField('phone', e.target.value)}
                  className="input-field" placeholder="+1-555-0000" />
              </div>

              <div>
                <label htmlFor="clientPassword" className="block text-sm font-medium text-gray-700 mb-1.5">Contraseña</label>
                <input id="clientPassword" type="password" autoComplete="new-password" value={form.password}
                  onChange={(e) => updateField('password', e.target.value)}
                  className={`input-field ${errors.password ? 'border-red-400' : ''}`} placeholder="Mínimo 8 caracteres" />
                {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password}</p>}
              </div>

              <div>
                <label htmlFor="clientConfirmPassword" className="block text-sm font-medium text-gray-700 mb-1.5">Confirmar contraseña</label>
                <input id="clientConfirmPassword" type="password" autoComplete="new-password" value={form.confirmPassword}
                  onChange={(e) => updateField('confirmPassword', e.target.value)}
                  className={`input-field ${errors.confirmPassword ? 'border-red-400' : ''}`} placeholder="Repite tu contraseña" />
                {errors.confirmPassword && <p className="mt-1 text-xs text-red-600">{errors.confirmPassword}</p>}
              </div>

              <button type="submit" disabled={isLoading}
                className="w-full btn-primary flex items-center justify-center gap-2 py-2.5">
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

          <p className="text-center mt-6 text-sm text-gray-500">
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
          {[1, 2, 3].map((s) => (
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
              {s < 3 && <div className={`w-12 h-0.5 ${s < step ? 'bg-primary-600' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <div className="flex items-center gap-2 mb-6">
            <button
              onClick={() => {
                setApiError(null);
                if (step > 1) setStep(step - 1);
                else if (typeParam === 'individual') router.push('/');
                else setMode('professional');
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
              {step === 3 && '¡Bienvenido a Siliba Business!'}
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
          {step === 1 && (
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
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1.5">Confirmar contraseña</label>
                <input id="confirmPassword" type="password" autoComplete="new-password" value={form.confirmPassword}
                  onChange={(e) => updateField('confirmPassword', e.target.value)}
                  className={`input-field ${errors.confirmPassword ? 'border-red-400' : ''}`} placeholder="Repite tu contraseña" />
                {errors.confirmPassword && <p className="mt-1 text-xs text-red-600">{errors.confirmPassword}</p>}
              </div>

              <button type="button" onClick={handleNextStep}
                className="w-full btn-primary py-2.5">
                Siguiente
              </button>
            </div>
          )}

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
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium border transition-all ${
                          selected
                            ? 'bg-[#008080] text-white border-[#008080]'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-[#008080] hover:text-[#008080]'
                        }`}
                      >
                        <span>{bt.icon}</span>
                        {bt.label}
                      </button>
                    );
                  })}
                </div>
                {errors.businessTypes && <p className="mt-1 text-xs text-red-600">{errors.businessTypes}</p>}
              </div>

              {/* Address section */}
              <div className="space-y-3">
                <p className="text-sm font-medium text-gray-700">
                  Dirección principal <span className="text-gray-400 font-normal">(opcional)</span>
                </p>
                <div>
                  <input type="text" value={form.businessStreet}
                    onChange={(e) => updateField('businessStreet', e.target.value)}
                    className="input-field" placeholder="Calle y número" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input type="text" value={form.businessCity}
                    onChange={(e) => updateField('businessCity', e.target.value)}
                    className="input-field" placeholder="Ciudad" />
                  <input type="text" value={form.businessState}
                    onChange={(e) => updateField('businessState', e.target.value)}
                    className="input-field" placeholder="Estado / Provincia" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input type="text" value={form.businessPostalCode}
                    onChange={(e) => updateField('businessPostalCode', e.target.value)}
                    className="input-field" placeholder="Código postal" />
                  <input type="text" value={form.businessCountry}
                    onChange={(e) => updateField('businessCountry', e.target.value)}
                    className="input-field" placeholder="País" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Teléfono del negocio <span className="text-gray-400">(opcional)</span>
                </label>
                <PhoneInput
                  value={form.businessPhone}
                  onChange={(v) => updateField('businessPhone', v)}
                />
              </div>

              <button type="button" onClick={handleNextStep}
                className="w-full btn-primary py-2.5">
                Siguiente
              </button>
            </div>
          )}

          {/* Step 3: Trial welcome */}
          {step === 3 && (
            <form onSubmit={handleSubmitIndividual} className="space-y-5">
              {/* Trial badge */}
              <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 text-center">
                <div className="inline-flex items-center gap-2 bg-[#008080] text-white text-xs font-bold px-3 py-1 rounded-full mb-2">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  30 días de prueba gratuita
                </div>
                <p className="text-sm text-teal-800 font-medium">
                  Acceso completo a <span className="font-bold">Siliba Business</span> sin pagar nada hoy
                </p>
                <p className="text-xs text-teal-600 mt-1">
                  $10 USD/mes por empleado al terminar el período de prueba
                </p>
              </div>

              {/* What's included */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2.5">Incluye en tu consola de administrador:</p>
                <div className="grid grid-cols-1 gap-1.5">
                  {BUSINESS_FEATURES.map((feature, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-[#008080] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-sm text-gray-700">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Warning */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
                <svg className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
                <p className="text-xs text-amber-700">
                  Si no activas una suscripción al término del período de prueba, tu cuenta será <strong>suspendida</strong> y no aparecerás en el marketplace ni podrás recibir citas.
                </p>
              </div>

              <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" checked={form.acceptContract}
                  onChange={(e) => updateField('acceptContract', e.target.checked)}
                  className="mt-1 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                <span className="text-sm text-gray-600">
                  Acepto los{' '}
                  <span className="text-primary-600 font-medium">términos y condiciones</span>{' '}
                  del servicio y la política de privacidad.
                </span>
              </label>
              {errors.acceptContract && <p className="text-xs text-red-600">{errors.acceptContract}</p>}

              <button type="submit" disabled={isLoading}
                className="w-full btn-primary flex items-center justify-center gap-2 py-2.5">
                {isLoading && (
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {isLoading ? 'Creando negocio...' : 'Comenzar período de prueba'}
              </button>
            </form>
          )}
        </div>

        <p className="text-center mt-6 text-sm text-gray-500">
          ¿Ya tienes cuenta?{' '}
          <Link href="/login" className="text-primary-600 hover:text-primary-700 font-medium">Iniciar sesión</Link>
        </p>
      </div>
    </div>
  );
}
