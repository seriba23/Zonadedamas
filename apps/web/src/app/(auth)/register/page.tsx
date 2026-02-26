'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/use-auth';

type RegisterMode = 'select' | 'business' | 'individual';

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
  businessType: string;
  businessAddress: string;
  businessPhone: string;
  // Step 3 - Plan (individual only)
  selectedPlan: string;
  acceptContract: boolean;
}

interface FormErrors {
  [key: string]: string | undefined;
}

const PLAN_OPTIONS = [
  {
    id: 'BASICO',
    name: 'Básico',
    price: 29.99,
    features: [
      'Hasta 3 empleados',
      'Hasta 150 citas/mes',
      '1 ubicación',
      'Calendario y agenda',
      'Gestión de clientes',
    ],
  },
  {
    id: 'PLUS',
    name: 'Plus',
    price: 49.99,
    popular: true,
    features: [
      'Hasta 8 empleados',
      'Hasta 500 citas/mes',
      'Hasta 3 ubicaciones',
      'Reportes completos',
      'Todo del plan Básico',
    ],
  },
  {
    id: 'PRO',
    name: 'Pro',
    price: 79.99,
    features: [
      'Hasta 20 empleados',
      'Citas ilimitadas',
      'Ubicaciones ilimitadas',
      'Exportar reportes',
      'Todo del plan Plus',
    ],
  },
];

const BUSINESS_TYPES = [
  { value: 'SALON', label: 'Salón de belleza' },
  { value: 'BARBERIA', label: 'Barbería' },
  { value: 'SPA', label: 'Spa' },
  { value: 'CLINICA', label: 'Clínica estética' },
];

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();

  const [mode, setMode] = useState<RegisterMode>('select');
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
    businessType: '',
    businessAddress: '',
    businessPhone: '',
    selectedPlan: 'BASICO',
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
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function validateStep2(): boolean {
    const newErrors: FormErrors = {};
    if (!form.businessName.trim()) newErrors.businessName = 'El nombre del negocio es requerido';
    if (!form.businessType) newErrors.businessType = 'Selecciona el tipo de negocio';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function validateStep3(): boolean {
    const newErrors: FormErrors = {};
    if (!form.selectedPlan) newErrors.selectedPlan = 'Selecciona un plan';
    if (!form.acceptContract) newErrors.acceptContract = 'Debes aceptar los términos';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
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
        businessType: form.businessType,
        businessAddress: form.businessAddress.trim() || undefined,
        businessPhone: form.businessPhone.trim() || undefined,
        selectedPlan: form.selectedPlan,
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

  function updateField(field: keyof FormState, value: string | boolean) {
    setForm((f) => ({ ...f, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  }

  // ─── SELECT MODE ──────────────────────────────────
  if (mode === 'select') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-primary-600">Zona de Damas</h1>
            <p className="mt-2 text-gray-500 text-sm">Crea tu cuenta</p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">
              ¿Cómo deseas registrarte?
            </h2>

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
                      Tengo un código de invitación de mi empresa
                    </p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setMode('individual')}
                className="w-full text-left p-4 rounded-xl border-2 border-gray-200 hover:border-primary-400 hover:bg-primary-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">👤</span>
                  <div>
                    <p className="font-semibold text-gray-900">Crear mi negocio</p>
                    <p className="text-sm text-gray-500">
                      Quiero registrar mi salón, barbería, spa o clínica
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
            <h1 className="text-3xl font-bold text-primary-600">Zona de Damas</h1>
            <p className="mt-2 text-gray-500 text-sm">Únete a tu equipo de trabajo</p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
            <div className="flex items-center gap-2 mb-6">
              <button onClick={() => setMode('select')} className="text-gray-400 hover:text-gray-600">
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
                  placeholder="XXXXXXXX" maxLength={8} />
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

  // ─── INDIVIDUAL (WIZARD) ─────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary-600">Zona de Damas</h1>
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
                else setMode('select');
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
              {step === 3 && 'Selecciona tu plan'}
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
                <label htmlFor="businessType" className="block text-sm font-medium text-gray-700 mb-1.5">Tipo de negocio</label>
                <select id="businessType" value={form.businessType}
                  onChange={(e) => updateField('businessType', e.target.value)}
                  className={`input-field ${errors.businessType ? 'border-red-400' : ''}`}>
                  <option value="">Selecciona...</option>
                  {BUSINESS_TYPES.map((bt) => (
                    <option key={bt.value} value={bt.value}>{bt.label}</option>
                  ))}
                </select>
                {errors.businessType && <p className="mt-1 text-xs text-red-600">{errors.businessType}</p>}
              </div>

              <div>
                <label htmlFor="businessAddress" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Dirección <span className="text-gray-400">(opcional)</span>
                </label>
                <input id="businessAddress" type="text" value={form.businessAddress}
                  onChange={(e) => updateField('businessAddress', e.target.value)}
                  className="input-field" placeholder="Calle, ciudad, código postal" />
              </div>

              <div>
                <label htmlFor="businessPhone" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Teléfono del negocio <span className="text-gray-400">(opcional)</span>
                </label>
                <input id="businessPhone" type="tel" value={form.businessPhone}
                  onChange={(e) => updateField('businessPhone', e.target.value)}
                  className="input-field" placeholder="+1-555-0000" />
              </div>

              <button type="button" onClick={handleNextStep}
                className="w-full btn-primary py-2.5">
                Siguiente
              </button>
            </div>
          )}

          {/* Step 3: Plan selection */}
          {step === 3 && (
            <form onSubmit={handleSubmitIndividual} className="space-y-4">
              <div className="space-y-3">
                {PLAN_OPTIONS.map((plan) => (
                  <button key={plan.id} type="button"
                    onClick={() => updateField('selectedPlan', plan.id)}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-colors relative ${
                      form.selectedPlan === plan.id
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}>
                    {plan.popular && (
                      <span className="absolute -top-2.5 right-3 bg-primary-600 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
                        Popular
                      </span>
                    )}
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-semibold text-gray-900">{plan.name}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-gray-900">${plan.price}</p>
                        <p className="text-xs text-gray-500">USD/mes</p>
                      </div>
                    </div>
                    <ul className="space-y-1">
                      {plan.features.map((f, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                          <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          {f}
                        </li>
                      ))}
                    </ul>
                  </button>
                ))}
              </div>
              {errors.selectedPlan && <p className="text-xs text-red-600">{errors.selectedPlan}</p>}

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
                {isLoading ? 'Creando negocio...' : 'Crear negocio'}
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
