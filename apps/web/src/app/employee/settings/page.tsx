'use client';

import { useState, useRef } from 'react';
import { useAuth } from '@/lib/hooks/use-auth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { AvatarCropModal } from '@/components/ui/avatar-crop-modal';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const BLOOD_TYPES = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];
const RELATIONS = ['Padre/Madre', 'Hermano/a', 'Esposo/a', 'Pareja', 'Hijo/a', 'Tío/a', 'Amigo/a', 'Otro'];

// ─── Profile Editor (used embedded in Mi Perfil → Info Personal) ───
export function EmployeeSettingsContent({ embedded }: { embedded?: boolean } = {}) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [isEditing, setIsEditing] = useState(searchParams.get('edit') === 'true');
  const [editForm, setEditForm] = useState({ firstName: '', lastName: '', email: '', phone: '', bio: '' });
  const [personalForm, setPersonalForm] = useState({ bloodType: '', allergies: '', emergencyContactName: '', emergencyContactLastName: '', emergencyContactPhone: '', emergencyContactRelation: '' });
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const { data: empData } = useQuery({
    queryKey: ['employee-settings', user?.employeeId],
    queryFn: () => api.get<{ data: any }>(`/api/employees/${user!.employeeId}`).then((r) => r.data),
    enabled: !!user?.employeeId,
    onSuccess: (data: any) => {
      if (!isEditing) return;
      setEditForm({ firstName: data.firstName, lastName: data.lastName, email: data.email || '', phone: data.phone || '', bio: data.bio || '' });
      setPersonalForm({ bloodType: data.bloodType || '', allergies: data.allergies || '', emergencyContactName: data.emergencyContactName || '', emergencyContactLastName: data.emergencyContactLastName || '', emergencyContactPhone: data.emergencyContactPhone || '', emergencyContactRelation: data.emergencyContactRelation || '' });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      await api.put('/api/employees/me', editForm);
      await api.put('/api/employees/me/personal-info', personalForm);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['employee-settings'] }); queryClient.invalidateQueries({ queryKey: ['employee-profile'] }); setIsEditing(false); },
  });

  const avatarMutation = useMutation({
    mutationFn: (file: File) => api.upload('/api/employees/me/avatar', file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employee-settings'] }),
  });

  const passwordMutation = useMutation({
    mutationFn: () => api.put('/api/auth/change-password', { currentPassword: passwordForm.current, newPassword: passwordForm.new }),
    onSuccess: () => { setPasswordSuccess(true); setPasswordForm({ current: '', new: '', confirm: '' }); setTimeout(() => setPasswordSuccess(false), 3000); },
    onError: (err: any) => setPasswordError(err.message || 'Error al cambiar contraseña'),
  });

  function startEdit() {
    if (empData) {
      setEditForm({ firstName: empData.firstName, lastName: empData.lastName, email: empData.email || '', phone: empData.phone || '', bio: empData.bio || '' });
      setPersonalForm({ bloodType: empData.bloodType || '', allergies: empData.allergies || '', emergencyContactName: empData.emergencyContactName || '', emergencyContactLastName: empData.emergencyContactLastName || '', emergencyContactPhone: empData.emergencyContactPhone || '', emergencyContactRelation: empData.emergencyContactRelation || '' });
    }
    setIsEditing(true);
  }

  if (!user?.employeeId) return <div className="p-6 text-sm text-gray-400">Sin perfil de empleado</div>;

  return (
    <div className={embedded ? 'max-w-2xl mx-auto' : 'p-6 max-w-2xl mx-auto pb-24 lg:pb-6'}>
      {!embedded && (
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.push('/employee')} className="w-9 h-9 rounded-full flex items-center justify-center bg-white border border-gray-200 hover:bg-gray-50">
            <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
          </button>
          <h1 className="text-lg font-bold text-gray-900">Mi Perfil</h1>
        </div>
      )}

      <div className="space-y-4">
        {/* Avatar + Name card */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-4 mb-4">
            <div className="relative group cursor-pointer flex-shrink-0" onClick={() => fileInputRef.current?.click()}>
              <div className="w-16 h-16 rounded-full overflow-hidden flex items-center justify-center text-xl font-bold text-white" style={{ backgroundColor: empData?.color || '#008080' }}>
                {empData?.avatarUrl ? <img src={`${API_URL}${empData.avatarUrl}`} alt="" className="w-full h-full object-cover" /> : <>{empData?.firstName?.[0]}{empData?.lastName?.[0]}</>}
              </div>
              <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" /><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" /></svg>
              </div>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setCropFile(f); e.target.value = ''; }} />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-gray-900">{empData?.firstName} {empData?.lastName}</p>
              <p className="text-xs text-gray-500">{empData?.email}</p>
            </div>
            {!isEditing && (
              <button onClick={startEdit} className="text-xs text-[#008080] font-medium hover:underline">Editar perfil</button>
            )}
          </div>

          {isEditing && (
            <div className="space-y-3 pt-3 border-t border-gray-100">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Nombre</label><input type="text" value={editForm.firstName} onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))} className="input-field" /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Apellido</label><input type="text" value={editForm.lastName} onChange={(e) => setEditForm((f) => ({ ...f, lastName: e.target.value }))} className="input-field" /></div>
              </div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Email</label><input type="email" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} className="input-field" /></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Teléfono</label><input type="tel" value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} className="input-field" /></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Bio</label><textarea value={editForm.bio} onChange={(e) => setEditForm((f) => ({ ...f, bio: e.target.value }))} className="input-field resize-none" rows={3} /></div>

              <h4 className="text-xs font-semibold text-gray-500 uppercase pt-2">Información médica</h4>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Tipo de sangre</label><select value={personalForm.bloodType} onChange={(e) => setPersonalForm((f) => ({ ...f, bloodType: e.target.value }))} className="input-field"><option value="">—</option>{BLOOD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Alergias</label><input type="text" value={personalForm.allergies} onChange={(e) => setPersonalForm((f) => ({ ...f, allergies: e.target.value }))} className="input-field" /></div>
              </div>

              <h4 className="text-xs font-semibold text-gray-500 uppercase pt-2">Contacto de emergencia</h4>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Nombre</label><input type="text" value={personalForm.emergencyContactName} onChange={(e) => setPersonalForm((f) => ({ ...f, emergencyContactName: e.target.value }))} className="input-field" /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Apellido</label><input type="text" value={personalForm.emergencyContactLastName} onChange={(e) => setPersonalForm((f) => ({ ...f, emergencyContactLastName: e.target.value }))} className="input-field" /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Teléfono</label><input type="tel" value={personalForm.emergencyContactPhone} onChange={(e) => setPersonalForm((f) => ({ ...f, emergencyContactPhone: e.target.value }))} className="input-field" /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Relación</label><select value={personalForm.emergencyContactRelation} onChange={(e) => setPersonalForm((f) => ({ ...f, emergencyContactRelation: e.target.value }))} className="input-field"><option value="">—</option>{RELATIONS.map((r) => <option key={r} value={r}>{r}</option>)}</select></div>
              </div>

              <div className="flex gap-2 pt-2">
                <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: '#008080' }}>{saveMutation.isPending ? 'Guardando...' : 'Guardar'}</button>
                <button onClick={() => setIsEditing(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50">Cancelar</button>
              </div>
            </div>
          )}
        </div>

        {/* Password */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Cambiar contraseña</h3>
          <div className="space-y-3">
            <input type="password" value={passwordForm.current} onChange={(e) => setPasswordForm((f) => ({ ...f, current: e.target.value }))} className="input-field" placeholder="Contraseña actual" />
            <input type="password" value={passwordForm.new} onChange={(e) => setPasswordForm((f) => ({ ...f, new: e.target.value }))} className="input-field" placeholder="Nueva contraseña" />
            <input type="password" value={passwordForm.confirm} onChange={(e) => setPasswordForm((f) => ({ ...f, confirm: e.target.value }))} className="input-field" placeholder="Confirmar contraseña" />
            {passwordError && <p className="text-xs text-red-600">{passwordError}</p>}
            {passwordSuccess && <p className="text-xs text-green-600">Contraseña actualizada</p>}
            <button onClick={() => { if (passwordForm.new !== passwordForm.confirm) { setPasswordError('Las contraseñas no coinciden'); return; } setPasswordError(null); passwordMutation.mutate(); }} disabled={!passwordForm.current || !passwordForm.new} className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50" style={{ backgroundColor: '#008080' }}>Cambiar</button>
          </div>
        </div>

        {/* Logout */}
        <button onClick={() => logout()} className="w-full py-3 rounded-xl text-sm font-medium text-red-600 bg-white border border-gray-200 hover:bg-red-50 transition-colors">Cerrar sesión</button>
      </div>

      {cropFile && (
        <AvatarCropModal imageFile={cropFile} onCancel={() => setCropFile(null)} onChooseAnother={() => { setCropFile(null); fileInputRef.current?.click(); }} onAccept={(f) => { avatarMutation.mutate(f); setCropFile(null); }} />
      )}
    </div>
  );
}

// ─── Settings Page (client-like config) ───
export default function EmployeeSettingsPage() {
  const { logout } = useAuth();
  const searchParams = useSearchParams();
  const [language, setLanguage] = useState('es');
  const [currency, setCurrency] = useState('MXN');
  const [country, setCountry] = useState('MX');

  if (searchParams.get('section') === 'profile') {
    return <EmployeeSettingsContent />;
  }

  const COUNTRIES = [
    { code: 'MX', name: 'México', currency: 'MXN' },
    { code: 'US', name: 'Estados Unidos', currency: 'USD' },
    { code: 'DO', name: 'República Dominicana', currency: 'DOP' },
    { code: 'CO', name: 'Colombia', currency: 'COP' },
    { code: 'AR', name: 'Argentina', currency: 'ARS' },
    { code: 'CL', name: 'Chile', currency: 'CLP' },
    { code: 'PE', name: 'Perú', currency: 'PEN' },
    { code: 'ES', name: 'España', currency: 'EUR' },
    { code: 'BR', name: 'Brasil', currency: 'BRL' },
  ];

  return (
    <div className="p-6 max-w-lg mx-auto pb-24 lg:pb-6">
      <h1 className="text-lg font-semibold text-gray-900 mb-6">Configuración</h1>

      <div className="space-y-6">
        {/* General */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">General</p>
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            <div className="px-4 py-3">
              <p className="text-sm text-gray-900 mb-0.5">País</p>
              <p className="text-xs text-gray-400 mb-2">Afecta moneda y formato</p>
              <select value={country} onChange={(e) => { setCountry(e.target.value); const c = COUNTRIES.find((c) => c.code === e.target.value); if (c) setCurrency(c.currency); }} className="input-field">
                {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
              </select>
            </div>
            <div className="px-4 py-3">
              <p className="text-sm text-gray-900 mb-0.5">Idioma</p>
              <p className="text-xs text-gray-400 mb-2">Idioma de la aplicación</p>
              <div className="flex gap-2">
                {[{ key: 'es', label: 'Español' }, { key: 'en', label: 'English' }, { key: 'pt', label: 'Português' }].map((l) => (
                  <button key={l.key} onClick={() => setLanguage(l.key)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${language === l.key ? 'bg-[#008080] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="px-4 py-3">
              <p className="text-sm text-gray-900 mb-0.5">Moneda</p>
              <p className="text-xs text-gray-400 mb-2">Cómo ver los precios</p>
              <div className="flex gap-2">
                {[
                  { key: COUNTRIES.find((c) => c.code === country)?.currency || 'MXN', label: COUNTRIES.find((c) => c.code === country)?.currency || 'MXN' },
                  { key: 'USD', label: 'USD' },
                ].map((m) => (
                  <button key={m.key} onClick={() => setCurrency(m.key)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${currency === m.key ? 'bg-[#008080] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Notificaciones</p>
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {[
              { label: 'Recordatorios de citas', desc: 'Antes y después de tus citas' },
              { label: 'Ofertas y promociones', desc: 'Descuentos de negocios que visitas' },
              { label: 'Puntos y recompensas', desc: 'Cuando ganas o puedes canjear puntos' },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm text-gray-900">{item.label}</p>
                  <p className="text-xs text-gray-400">{item.desc}</p>
                </div>
                <div className="relative">
                  <input type="checkbox" defaultChecked className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-200 rounded-full peer-checked:bg-[#008080] transition-colors cursor-pointer" onClick={(e) => { const input = (e.target as HTMLElement).previousElementSibling as HTMLInputElement; input.checked = !input.checked; }} />
                  <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5 pointer-events-none" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Account */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Cuenta</p>
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            <Link href="/employee/settings?section=profile" className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
              <div>
                <p className="text-sm text-gray-900">Editar perfil</p>
                <p className="text-xs text-gray-400">Nombre, foto, contacto, contraseña</p>
              </div>
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
            </Link>
          </div>
        </div>

        {/* Help & Legal */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Ayuda y Legal</p>
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            <Link href="/help" target="_blank" className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
              <p className="text-sm text-gray-900">Centro de Ayuda</p>
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
            </Link>
            <Link href="/legal/privacy" target="_blank" className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
              <p className="text-sm text-gray-900">Aviso de Privacidad</p>
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
            </Link>
            <Link href="/legal/terms" target="_blank" className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
              <p className="text-sm text-gray-900">Términos y Condiciones</p>
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
            </Link>
          </div>
        </div>

        {/* Logout */}
        <button onClick={() => logout()} className="w-full py-3 rounded-xl text-sm font-medium text-red-600 bg-white border border-gray-200 hover:bg-red-50 transition-colors">
          Cerrar sesión
        </button>

        <p className="text-center text-[10px] text-gray-300">Siliba v1.0</p>
      </div>
    </div>
  );
}
