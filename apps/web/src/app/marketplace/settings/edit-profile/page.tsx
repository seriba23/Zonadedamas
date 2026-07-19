'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { useMarketplaceAuth } from '@/lib/hooks/use-marketplace-auth';
import { marketplaceApi } from '@/lib/marketplace-api';
import { resolveImageUrl } from '@/lib/utils';
import { SuccessPopup } from '@/components/ui/success-popup';
import { AvatarCropModal } from '@/components/ui/avatar-crop-modal';
import { DatePicker } from '@/components/ui/date-picker';
import { AllergiesSelector } from '@/components/ui/allergies-selector';
import { PasswordRules } from '@/components/ui/password-rules';
import { PasswordMatch } from '@/components/ui/password-match';
import { validatePassword } from '@/lib/password-validation';
import { AddressFields, emptyAddress, parseAddress, serializeAddress, type AddressValue } from '@/components/ui/address-fields';
import { loadCountries } from '@/lib/geo-data';

const TEAL = '#008080';
const TEAL_DARK = '#006666';
const TEAL_LIGHT = '#e0f2f1';

// Tipos de relación más comunes para el contacto de emergencia (droplist).
// "Otro" muestra un campo de texto libre para especificar.
const RELATION_OPTIONS = ['Madre', 'Padre', 'Cónyuge', 'Hijo(a)', 'Hermano(a)', 'Abuelo(a)', 'Amigo(a)', 'Tutor'];

// ─── Modal Base ───────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-white sm:rounded-2xl rounded-t-2xl shadow-xl overflow-hidden">
        {/* Handle bar (mobile) */}
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
            <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-5 py-5 space-y-4">{children}</div>
      </div>
    </div>
  );
}

// ─── OTP Step ─────────────────────────────────────────
function OtpStep({
  value, onChange, onVerify, isPending, error, onResend, resendPending,
}: {
  value: string; onChange: (v: string) => void;
  onVerify: () => void; isPending: boolean; error: string;
  onResend?: () => void; resendPending?: boolean;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">Ingresa el código de 6 dígitos que te enviamos.</p>
      <input
        type="text"
        inputMode="numeric"
        maxLength={6}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
        placeholder="000000"
        className="w-full px-4 py-3 border border-gray-300 rounded-xl text-lg text-center tracking-[0.5em] font-mono focus:ring-2 focus:outline-none"
        style={{ '--tw-ring-color': TEAL } as any}
        autoFocus
      />
      {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
      {onResend && (
        <button type="button" onClick={onResend} disabled={resendPending}
          className="text-xs text-gray-400 hover:text-gray-600 disabled:opacity-50">
          {resendPending ? 'Enviando...' : 'Reenviar código'}
        </button>
      )}
      <button
        type="button"
        onClick={onVerify}
        disabled={value.length !== 6 || isPending}
        className="w-full py-3 text-white rounded-xl font-medium disabled:opacity-50 transition-colors"
        style={{ backgroundColor: TEAL }}
      >
        {isPending ? 'Verificando...' : 'Verificar código'}
      </button>
    </div>
  );
}

// ─── Verified Badge ───────────────────────────────────
function VerifiedBadge({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm" style={{ backgroundColor: TEAL_LIGHT, color: TEAL }}>
      <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span className="font-medium">{label}</span>
    </div>
  );
}

// ─── Edit Profile Page ────────────────────────────────
export default function EditProfilePage() {
  const router = useRouter();
  const { user, isLoading: authLoading, isAuthenticated, refreshUser } = useMarketplaceAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    firstName: '', lastName: '', birthDate: '', gender: '', allergies: '',
    emergencyContactName: '', emergencyContactLastName: '', emergencyContactPhone: '', emergencyContactRelation: '',
  });
  const [address, setAddress] = useState<AddressValue>(emptyAddress());
  // ¿La relación del contacto de emergencia es "Otro" (texto libre)?
  const [otherRelation, setOtherRelation] = useState(false);
  const [formReady, setFormReady] = useState(false);
  const [formError, setFormError] = useState('');
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [successPopup, setSuccessPopup] = useState<{ title: string; message?: string } | null>(null);

  // Modal control
  const [activeModal, setActiveModal] = useState<'email' | 'phone' | 'password' | null>(null);
  const closeModal = () => {
    setActiveModal(null);
    resetEmailModal();
    resetPhoneModal();
    resetPasswordModal();
  };

  // ── Email modal state ──
  const [emailStep, setEmailStep] = useState<'input' | 'otp' | 'verified'>('input');
  const [newEmail, setNewEmail] = useState('');
  const [emailOtp, setEmailOtp] = useState('');
  const [emailError, setEmailError] = useState('');
  const resetEmailModal = () => { setEmailStep('input'); setNewEmail(''); setEmailOtp(''); setEmailError(''); };

  // ── Phone modal state ──
  const [phoneStep, setPhoneStep] = useState<'input' | 'otp' | 'verified'>('input');
  const [newPhone, setNewPhone] = useState('');
  const [phoneOtp, setPhoneOtp] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const resetPhoneModal = () => { setPhoneStep('input'); setNewPhone(''); setPhoneOtp(''); setPhoneError(''); };

  // ── Password modal state ──
  const [pwdStep, setPwdStep] = useState<'form' | 'otp' | 'verified'>('form');
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordError, setPasswordError] = useState('');
  const [pwdOtp, setPwdOtp] = useState('');
  const [pwdOtpError, setPwdOtpError] = useState('');
  const resetPasswordModal = () => {
    setPwdStep('form'); setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setPasswordError(''); setPwdOtp(''); setPwdOtpError('');
  };

  // Populate form once user loads. Cargamos countries en paralelo para
  // que parseAddress pueda resolver countryCode desde el nombre del pais
  // guardado en el string. Sin esto, el dropdown queda vacio al
  // re-entrar y el usuario veria sus datos "perdidos".
  useEffect(() => {
    if (formReady || !user) return;
    setForm({
      firstName: (user as any).firstName || '',
      lastName: (user as any).lastName || '',
      birthDate: (user as any).birthDate ? (user as any).birthDate.split('T')[0] : '',
      gender: (user as any).gender || '',
      allergies: (user as any).allergies || '',
      emergencyContactName: (user as any).emergencyContactName || '',
      emergencyContactLastName: (user as any).emergencyContactLastName || '',
      emergencyContactPhone: (user as any).emergencyContactPhone || '',
      emergencyContactRelation: (user as any).emergencyContactRelation || '',
    });
    // Si la relación guardada no está entre las comunes, es "Otro" (texto libre).
    const rel = (user as any).emergencyContactRelation || '';
    if (rel && !RELATION_OPTIONS.includes(rel)) setOtherRelation(true);
    const rawAddress = (user as any).address || '';
    loadCountries().then((countries) => {
      setAddress(parseAddress(rawAddress, countries));
      setFormReady(true);
    }).catch(() => {
      setAddress(parseAddress(rawAddress));
      setFormReady(true);
    });
  }, [user, formReady]);

  // ── Mutations ──
  const profileMutation = useMutation({
    mutationFn: () => {
      const addressStr = serializeAddress(address);
      // Derivamos country (alpha2 uppercase) desde el countryCode de la
      // direccion. El selector de pais de "General" en settings se
      // elimino — la unica fuente de verdad ahora es el pais de la
      // direccion. Esto evita inconsistencias entre 2 selectores.
      const country = address.countryCode ? address.countryCode.toUpperCase() : undefined;
      return marketplaceApi.put('/auth/profile', {
        firstName: form.firstName, lastName: form.lastName,
        birthDate: form.birthDate || undefined, gender: form.gender || undefined, allergies: form.allergies || undefined,
        emergencyContactName: form.emergencyContactName || undefined,
        emergencyContactLastName: form.emergencyContactLastName || undefined,
        emergencyContactPhone: form.emergencyContactPhone || undefined,
        emergencyContactRelation: form.emergencyContactRelation || undefined,
        address: addressStr || undefined,
        country,
      });
    },
    onSuccess: () => { refreshUser(); setFormError(''); setSuccessPopup({ title: 'Perfil actualizado' }); },
    onError: (err: any) => setFormError(err.message || 'Error al guardar'),
  });

  const avatarMutation = useMutation({
    mutationFn: (file: File) => marketplaceApi.uploadFile('/auth/avatar', file),
    onSuccess: () => { refreshUser(); setCropFile(null); },
  });

  // Email OTP
  const emailOtpSendMutation = useMutation({
    mutationFn: () => marketplaceApi.post('/auth/otp/send', {}),
    onSuccess: () => { setEmailStep('otp'); setEmailError(''); },
    onError: (err: any) => setEmailError(err.message || 'Error al enviar código'),
  });
  const emailOtpVerifyMutation = useMutation({
    mutationFn: () => marketplaceApi.post('/auth/otp/verify', { code: emailOtp }),
    onSuccess: () => { setEmailStep('verified'); setEmailError(''); },
    onError: (err: any) => setEmailError(err.message || 'Código incorrecto'),
  });
  const emailSaveMutation = useMutation({
    mutationFn: () => marketplaceApi.put('/auth/profile/contact', { email: newEmail, otpCode: emailOtp }),
    onSuccess: () => {
      refreshUser(); closeModal();
      setSuccessPopup({ title: 'Correo actualizado', message: `Tu nuevo correo es ${newEmail}` });
    },
    onError: (err: any) => setEmailError(err.message || 'Error al actualizar correo'),
  });

  // Phone OTP
  const phoneOtpSendMutation = useMutation({
    mutationFn: () => marketplaceApi.post('/auth/otp/send-email', {}),
    onSuccess: () => { setPhoneStep('otp'); setPhoneError(''); },
    onError: (err: any) => setPhoneError(err.message || 'Error al enviar código'),
  });
  const phoneOtpVerifyMutation = useMutation({
    mutationFn: () => marketplaceApi.post('/auth/otp/verify-email', { code: phoneOtp }),
    onSuccess: () => { setPhoneStep('verified'); setPhoneError(''); },
    onError: (err: any) => setPhoneError(err.message || 'Código incorrecto'),
  });
  const phoneSaveMutation = useMutation({
    mutationFn: () => marketplaceApi.put('/auth/profile/contact', { phone: newPhone, otpCode: phoneOtp }),
    onSuccess: () => {
      refreshUser(); closeModal();
      setSuccessPopup({ title: 'Teléfono actualizado' });
    },
    onError: (err: any) => setPhoneError(err.message || 'Error al actualizar teléfono'),
  });

  // Password OTP recovery
  const pwdOtpSendMutation = useMutation({
    mutationFn: () => marketplaceApi.post('/auth/otp/send', {}),
    onSuccess: () => { setPwdStep('otp'); setPwdOtpError(''); },
    onError: (err: any) => setPwdOtpError(err.message || 'Error al enviar código'),
  });
  const pwdOtpVerifyMutation = useMutation({
    mutationFn: () => marketplaceApi.post('/auth/otp/verify', { code: pwdOtp }),
    onSuccess: () => { setPwdStep('verified'); setPwdOtpError(''); },
    onError: (err: any) => setPwdOtpError(err.message || 'Código incorrecto'),
  });
  const passwordMutation = useMutation({
    mutationFn: () => {
      const hasPassword = !!(user as any)?.hasPassword;
      const body: Record<string, string> =
        pwdStep === 'verified'
          ? { otpCode: pwdOtp }
          : hasPassword
            ? { currentPassword: passwordForm.currentPassword }
            : {}; // set-first-password: no se requiere prueba previa
      body.newPassword = passwordForm.newPassword;
      return marketplaceApi.put('/auth/profile/password', body);
    },
    onSuccess: () => {
      refreshUser();
      closeModal();
      setSuccessPopup({
        title: (user as any)?.hasPassword ? 'Contraseña actualizada' : 'Contraseña establecida',
      });
    },
    onError: (err: any) => setPasswordError(err.message || 'Error al cambiar contraseña'),
  });

  function handlePasswordSubmit() {
    setPasswordError('');
    if (passwordForm.newPassword !== passwordForm.confirmPassword) { setPasswordError('Las contraseñas no coinciden'); return; }
    const pwdErr = validatePassword(passwordForm.newPassword);
    if (pwdErr) { setPasswordError(pwdErr); return; }
    passwordMutation.mutate();
  }

  if (authLoading) {
    return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: TEAL }} /></div>;
  }
  if (!isAuthenticated || !user) return null;

  const initials = `${((user as any).firstName || '')[0] || ''}${((user as any).lastName || '')[0] || ''}`.toUpperCase();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Sticky header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.push('/marketplace/settings')}
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors">
            <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <h1 className="text-base font-bold text-gray-900">Editar perfil</h1>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 max-w-2xl w-full mx-auto px-4 py-5 space-y-4">

        {/* Avatar */}
        <div
          className="bg-white rounded-2xl border border-gray-200 p-5 flex flex-col items-center gap-3 cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <div
            className="w-24 h-24 rounded-full flex items-center justify-center overflow-hidden relative group"
            style={{ backgroundColor: TEAL_LIGHT }}
          >
            {(user as any).avatarUrl ? (
              <img src={resolveImageUrl((user as any).avatarUrl) || ''} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-3xl font-bold" style={{ color: TEAL }}>{initials}</span>
            )}
            <div className="absolute inset-0 bg-black/30 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
              </svg>
            </div>
          </div>
          <p className="text-xs text-gray-400">{avatarMutation.isPending ? 'Subiendo...' : 'Toca para cambiar foto'}</p>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) { setCropFile(f); e.target.value = ''; } }}
          />
        </div>

        {/* Info personal */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-800">Información personal</h2>
          </div>
          <div className="px-4 py-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Nombre</label>
                <input type="text" value={form.firstName}
                  onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:outline-none"
                  style={{ '--tw-ring-color': TEAL } as any} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Apellido</label>
                <input type="text" value={form.lastName}
                  onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:outline-none"
                  style={{ '--tw-ring-color': TEAL } as any} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Fecha de nacimiento</label>
              <DatePicker value={form.birthDate} onChange={(v) => setForm((f) => ({ ...f, birthDate: v }))} placeholder="DD/MM/AAAA" />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Género</label>
              <select
                value={form.gender}
                onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:outline-none bg-white"
                style={{ '--tw-ring-color': TEAL } as any}
              >
                <option value="">Selecciona una opción</option>
                <option value="FEMALE">Femenino</option>
                <option value="MALE">Masculino</option>
                <option value="NON_BINARY">No binario</option>
                <option value="PREFER_NOT_SAY">Prefiero no decir</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Alergias <span className="text-gray-400">(opcional)</span></label>
              <p className="text-xs text-gray-400 mb-1.5 leading-relaxed">
                Esta información nos ayuda a evitar ofrecerte servicios que puedan causarte una reacción alérgica. Los especialistas podrán verla cuando seas atendid@ para garantizar tu seguridad y la mejor experiencia posible.
              </p>
              <AllergiesSelector value={form.allergies} onChange={(v) => setForm((f) => ({ ...f, allergies: v }))} />
            </div>

          </div>
        </div>

        {/* Contacto de emergencia — SECCIÓN PROPIA, separada del resto de la
            información personal para que destaque. */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-800">
              Contacto de emergencia <span className="text-xs font-normal text-gray-400">(opcional)</span>
            </h2>
          </div>
          <div className="px-4 py-4 space-y-3">
            <p className="text-xs text-gray-400 leading-relaxed">
              A quién avisar en caso de una emergencia durante un servicio. Los negocios donde valides tu cuenta podrán verlo por tu seguridad.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <input value={form.emergencyContactName} onChange={(e) => setForm((f) => ({ ...f, emergencyContactName: e.target.value }))} placeholder="Nombre" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[#008080]" />
              <input value={form.emergencyContactLastName} onChange={(e) => setForm((f) => ({ ...f, emergencyContactLastName: e.target.value }))} placeholder="Apellido" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[#008080]" />
            </div>
            <input value={form.emergencyContactPhone} onChange={(e) => setForm((f) => ({ ...f, emergencyContactPhone: e.target.value.replace(/\D/g, '').slice(0, 10) }))} placeholder="10 dígitos" inputMode="numeric" maxLength={10} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[#008080]" />
            {/* Relación: droplist con los tipos más comunes (igual que en la
                creación de cuenta) + "Otro…" que revela un campo de texto libre. */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Relación</label>
              <select
                value={otherRelation ? 'Otro' : form.emergencyContactRelation}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === 'Otro') {
                    setOtherRelation(true);
                    setForm((f) => ({ ...f, emergencyContactRelation: '' }));
                  } else {
                    setOtherRelation(false);
                    setForm((f) => ({ ...f, emergencyContactRelation: v }));
                  }
                }}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#008080]"
              >
                <option value="">Selecciona una opción</option>
                {RELATION_OPTIONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
                <option value="Otro">Otro…</option>
              </select>
              {otherRelation && (
                <input
                  value={form.emergencyContactRelation}
                  onChange={(e) => setForm((f) => ({ ...f, emergencyContactRelation: e.target.value }))}
                  placeholder="Especifica la relación"
                  className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[#008080]"
                />
              )}
            </div>
          </div>
        </div>

        {/* Dirección — SECCIÓN PROPIA. */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-800">
              Dirección <span className="text-xs font-normal text-gray-400">(opcional)</span>
            </h2>
          </div>
          <div className="px-4 py-4">
            <p className="text-xs text-gray-400 mb-3 leading-relaxed">
              Tu dirección se usará como sugerencia al solicitar envíos de productos a domicilio.
            </p>
            <AddressFields value={address} onChange={setAddress} />
          </div>
        </div>

        {/* Contact info — read-only with "Cambiar" buttons */}
        <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
          {/* Email row */}
          <div className="px-4 py-4 flex items-center justify-between">
            <div className="min-w-0 flex-1 mr-3">
              <p className="text-xs font-medium text-gray-500 mb-0.5">Correo electrónico</p>
              <p className="text-sm text-gray-800 truncate">{(user as any).email}</p>
            </div>
            <button
              onClick={() => { resetEmailModal(); setActiveModal('email'); }}
              className="flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors"
              style={{ color: TEAL, backgroundColor: TEAL_LIGHT }}
            >
              Cambiar
            </button>
          </div>

          {/* Phone row */}
          <div className="px-4 py-4 flex items-center justify-between">
            <div className="min-w-0 flex-1 mr-3">
              <p className="text-xs font-medium text-gray-500 mb-0.5">Teléfono</p>
              <p className="text-sm text-gray-800">{(user as any).phone || <span className="text-gray-400 italic">No registrado</span>}</p>
            </div>
            <button
              onClick={() => { resetPhoneModal(); setActiveModal('phone'); }}
              className="flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors"
              style={{ color: TEAL, backgroundColor: TEAL_LIGHT }}
            >
              Cambiar
            </button>
          </div>

          {/* Password row */}
          <div className="px-4 py-4 flex items-center justify-between">
            <div className="min-w-0 flex-1 mr-3">
              <p className="text-xs font-medium text-gray-500 mb-0.5">Contraseña</p>
              {(user as any).hasPassword ? (
                <p className="text-sm text-gray-400">••••••••</p>
              ) : (
                <p className="text-xs text-gray-500 leading-snug">
                  Aún no tienes contraseña. Añade una para iniciar sesión también con tu correo
                  {(user as any).socialProvider
                    ? ` (sigues pudiendo entrar con ${
                        (user as any).socialProvider === 'google' ? 'Google' :
                        (user as any).socialProvider === 'facebook' ? 'Facebook' : 'tu red social'
                      }).`
                    : '.'}
                </p>
              )}
            </div>
            <button
              onClick={() => { resetPasswordModal(); setActiveModal('password'); }}
              className="flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors"
              style={{ color: TEAL, backgroundColor: TEAL_LIGHT }}
            >
              {(user as any).hasPassword ? 'Cambiar' : 'Establecer'}
            </button>
          </div>
        </div>

        {formError && <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">{formError}</p>}
      </div>

      {/* Sticky save button */}
      <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 py-4 max-w-2xl w-full mx-auto">
        <button
          onClick={() => profileMutation.mutate()}
          disabled={profileMutation.isPending}
          className="w-full py-3 text-white rounded-xl font-semibold text-sm disabled:opacity-50 transition-colors"
          style={{ backgroundColor: TEAL }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = TEAL_DARK)}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = TEAL)}
        >
          {profileMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>

      {/* ── Modal: Cambiar correo ── */}
      {activeModal === 'email' && (
        <Modal title="Cambiar correo electrónico" onClose={closeModal}>
          {emailStep === 'input' && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Correo actual</label>
                <p className="text-sm text-gray-700 px-3 py-2 bg-gray-50 rounded-xl">{(user as any).email}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Nuevo correo</label>
                <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="nuevo@correo.com" autoFocus
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:outline-none"
                  style={{ '--tw-ring-color': TEAL } as any} />
              </div>
              <p className="text-xs text-gray-400">Se enviará un código de verificación por SMS a tu teléfono registrado.</p>
              {emailError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{emailError}</p>}
              <button
                onClick={() => { if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) { setEmailError('Ingresa un correo válido'); return; } emailOtpSendMutation.mutate(); }}
                disabled={emailOtpSendMutation.isPending}
                className="w-full py-3 text-white rounded-xl font-medium disabled:opacity-50"
                style={{ backgroundColor: TEAL }}
              >
                {emailOtpSendMutation.isPending ? 'Enviando...' : 'Enviar código por SMS'}
              </button>
            </>
          )}

          {emailStep === 'otp' && (
            <OtpStep
              value={emailOtp} onChange={setEmailOtp}
              onVerify={() => emailOtpVerifyMutation.mutate()}
              isPending={emailOtpVerifyMutation.isPending}
              error={emailError}
              onResend={() => emailOtpSendMutation.mutate()}
              resendPending={emailOtpSendMutation.isPending}
            />
          )}

          {emailStep === 'verified' && (
            <>
              <VerifiedBadge label="Identidad verificada por SMS" />
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1.5">Nuevo correo a confirmar</p>
                <p className="text-sm text-gray-800 px-3 py-2 bg-gray-50 rounded-xl">{newEmail}</p>
              </div>
              {emailError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{emailError}</p>}
              <button
                onClick={() => emailSaveMutation.mutate()}
                disabled={emailSaveMutation.isPending}
                className="w-full py-3 text-white rounded-xl font-medium disabled:opacity-50"
                style={{ backgroundColor: TEAL }}
              >
                {emailSaveMutation.isPending ? 'Guardando...' : 'Confirmar nuevo correo'}
              </button>
            </>
          )}
        </Modal>
      )}

      {/* ── Modal: Cambiar teléfono ── */}
      {activeModal === 'phone' && (
        <Modal title="Cambiar teléfono" onClose={closeModal}>
          {phoneStep === 'input' && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Teléfono actual</label>
                <p className="text-sm text-gray-700 px-3 py-2 bg-gray-50 rounded-xl">{(user as any).phone || 'No registrado'}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Nuevo teléfono</label>
                <input type="text" inputMode="numeric" maxLength={10} value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="10 dígitos" autoFocus
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:outline-none"
                  style={{ '--tw-ring-color': TEAL } as any} />
              </div>
              <p className="text-xs text-gray-400">Se enviará un código de verificación a tu correo registrado.</p>
              {phoneError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{phoneError}</p>}
              <button
                onClick={() => { if (!newPhone || newPhone.length < 8) { setPhoneError('Ingresa un número válido'); return; } phoneOtpSendMutation.mutate(); }}
                disabled={phoneOtpSendMutation.isPending}
                className="w-full py-3 text-white rounded-xl font-medium disabled:opacity-50"
                style={{ backgroundColor: TEAL }}
              >
                {phoneOtpSendMutation.isPending ? 'Enviando...' : 'Enviar código por correo'}
              </button>
            </>
          )}

          {phoneStep === 'otp' && (
            <OtpStep
              value={phoneOtp} onChange={setPhoneOtp}
              onVerify={() => phoneOtpVerifyMutation.mutate()}
              isPending={phoneOtpVerifyMutation.isPending}
              error={phoneError}
              onResend={() => phoneOtpSendMutation.mutate()}
              resendPending={phoneOtpSendMutation.isPending}
            />
          )}

          {phoneStep === 'verified' && (
            <>
              <VerifiedBadge label="Identidad verificada por correo" />
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1.5">Nuevo teléfono a confirmar</p>
                <p className="text-sm text-gray-800 px-3 py-2 bg-gray-50 rounded-xl">{newPhone}</p>
              </div>
              {phoneError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{phoneError}</p>}
              <button
                onClick={() => phoneSaveMutation.mutate()}
                disabled={phoneSaveMutation.isPending}
                className="w-full py-3 text-white rounded-xl font-medium disabled:opacity-50"
                style={{ backgroundColor: TEAL }}
              >
                {phoneSaveMutation.isPending ? 'Guardando...' : 'Confirmar nuevo teléfono'}
              </button>
            </>
          )}
        </Modal>
      )}

      {/* ── Modal: Cambiar/Establecer contraseña ── */}
      {activeModal === 'password' && (
        <Modal title={(user as any).hasPassword ? 'Cambiar contraseña' : 'Establecer contraseña'} onClose={closeModal}>
          {pwdStep === 'form' && (
            <>
              {(user as any).hasPassword ? (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Contraseña actual</label>
                  <input type="password" value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm((p) => ({ ...p, currentPassword: e.target.value }))}
                    autoFocus
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:outline-none"
                    style={{ '--tw-ring-color': TEAL } as any} />
                  <button type="button"
                    onClick={() => { setPwdOtpError(''); pwdOtpSendMutation.mutate(); }}
                    disabled={pwdOtpSendMutation.isPending}
                    className="mt-2 text-xs font-medium disabled:opacity-50"
                    style={{ color: TEAL }}
                  >
                    {pwdOtpSendMutation.isPending ? 'Enviando...' : '¿Olvidaste tu contraseña? Recuperar por SMS'}
                  </button>
                  {pwdOtpError && <p className="mt-1 text-xs text-red-600">{pwdOtpError}</p>}
                </div>
              ) : (
                <p className="text-xs text-gray-500 leading-relaxed bg-gray-50 px-3 py-2.5 rounded-xl">
                  Tu cuenta fue creada con {(user as any).socialProvider === 'google' ? 'Google' : (user as any).socialProvider === 'facebook' ? 'Facebook' : 'una red social'}. Define una contraseña para poder iniciar sesión también con tu correo. Seguirás pudiendo entrar con {(user as any).socialProvider === 'google' ? 'Google' : (user as any).socialProvider === 'facebook' ? 'Facebook' : 'tu red social'} normalmente.
                </p>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Nueva contraseña</label>
                <input type="password" value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm((p) => ({ ...p, newPassword: e.target.value }))}
                  placeholder="Min. 6 caracteres, 1 número, 1 símbolo"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:outline-none"
                  style={{ '--tw-ring-color': TEAL } as any} />
                <PasswordRules password={passwordForm.newPassword} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Confirmar contraseña</label>
                <input type="password" value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm((p) => ({ ...p, confirmPassword: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:outline-none"
                  style={{ '--tw-ring-color': TEAL } as any} />
                <PasswordMatch password={passwordForm.newPassword} confirmPassword={passwordForm.confirmPassword} />
              </div>
              {passwordError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{passwordError}</p>}
              <button onClick={handlePasswordSubmit} disabled={passwordMutation.isPending}
                className="w-full py-3 text-white rounded-xl font-medium disabled:opacity-50 transition-colors"
                style={{ backgroundColor: TEAL }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = TEAL_DARK)}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = TEAL)}>
                {passwordMutation.isPending
                  ? 'Guardando...'
                  : (user as any).hasPassword ? 'Cambiar contraseña' : 'Establecer contraseña'}
              </button>
            </>
          )}

          {pwdStep === 'otp' && (
            <>
              <p className="text-sm text-gray-500">Ingresa el código de recuperación que enviamos a tu teléfono.</p>
              <OtpStep
                value={pwdOtp} onChange={setPwdOtp}
                onVerify={() => pwdOtpVerifyMutation.mutate()}
                isPending={pwdOtpVerifyMutation.isPending}
                error={pwdOtpError}
                onResend={() => pwdOtpSendMutation.mutate()}
                resendPending={pwdOtpSendMutation.isPending}
              />
            </>
          )}

          {pwdStep === 'verified' && (
            <>
              <VerifiedBadge label="Identidad verificada por SMS" />
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Nueva contraseña</label>
                <input type="password" value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm((p) => ({ ...p, newPassword: e.target.value }))}
                  placeholder="Min. 6 caracteres, 1 número, 1 símbolo" autoFocus
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:outline-none"
                  style={{ '--tw-ring-color': TEAL } as any} />
                <PasswordRules password={passwordForm.newPassword} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Confirmar contraseña</label>
                <input type="password" value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm((p) => ({ ...p, confirmPassword: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:outline-none"
                  style={{ '--tw-ring-color': TEAL } as any} />
                <PasswordMatch password={passwordForm.newPassword} confirmPassword={passwordForm.confirmPassword} />
              </div>
              {passwordError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{passwordError}</p>}
              <button onClick={handlePasswordSubmit} disabled={passwordMutation.isPending}
                className="w-full py-3 text-white rounded-xl font-medium disabled:opacity-50"
                style={{ backgroundColor: TEAL }}>
                {passwordMutation.isPending ? 'Guardando...' : 'Establecer nueva contraseña'}
              </button>
            </>
          )}
        </Modal>
      )}

      {cropFile && (
        <AvatarCropModal
          imageFile={cropFile}
          onAccept={(f) => { avatarMutation.mutate(f); setCropFile(null); }}
          onCancel={() => setCropFile(null)}
          onChooseAnother={() => { setCropFile(null); fileInputRef.current?.click(); }}
        />
      )}

      {/* Al cerrar el popup de "Perfil actualizado" salimos de la edición
          (volvemos a Ajustes), como pidió el usuario. */}
      <SuccessPopup show={!!successPopup} title={successPopup?.title || ''} message={successPopup?.message} onClose={() => { setSuccessPopup(null); router.push('/marketplace/settings'); }} />
    </div>
  );
}
