'use client';

import { useState, useRef } from 'react';
import { useAuth } from '@/lib/hooks/use-auth';
import { signOutAll } from '@/lib/sign-out-all';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { AvatarCropModal } from '@/components/ui/avatar-crop-modal';
import { AllergiesSelector } from '@/components/ui/allergies-selector';
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
  const coverFileInputRef = useRef<HTMLInputElement>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [isEditing, setIsEditing] = useState(searchParams.get('edit') === 'true' || searchParams.get('section') === 'profile' || embedded === true);
  const [editForm, setEditForm] = useState({ firstName: '', lastName: '', email: '', phone: '', bio: '' });
  const [personalForm, setPersonalForm] = useState({ bloodType: '', allergies: '', emergencyContactName: '', emergencyContactLastName: '', emergencyContactPhone: '', emergencyContactRelation: '' });
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const { data: empData } = useQuery({
    queryKey: ['employee-settings', user?.employeeId],
    queryFn: () => api.get<{ data: any }>(`/api/employees/${user!.employeeId}`).then((r) => r.data),
    enabled: !!user?.employeeId,
  });

  // Fill form when data loads
  const [formInitialized, setFormInitialized] = useState(false);
  if (empData && !formInitialized) {
    setEditForm({ firstName: empData.firstName, lastName: empData.lastName, email: empData.email || '', phone: empData.phone || '', bio: empData.bio || '' });
    setPersonalForm({ bloodType: empData.bloodType || '', allergies: empData.allergies || '', emergencyContactName: empData.emergencyContactName || '', emergencyContactLastName: empData.emergencyContactLastName || '', emergencyContactPhone: empData.emergencyContactPhone || '', emergencyContactRelation: empData.emergencyContactRelation || '' });
    setFormInitialized(true);
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      await api.put('/api/employees/me', editForm);
      await api.put('/api/employees/me/personal-info', personalForm);
    },
    // Recarga la pagina post-guardado: garantiza que el banner "Completa
    // tu perfil" del layout reevalue el progreso desde cero (la query de
    // empData solo invalida los hooks del componente, no el layout padre).
    onSuccess: () => { window.location.reload(); },
  });

  const avatarMutation = useMutation({
    mutationFn: (file: File) => api.upload('/api/employees/me/avatar', file),
    // Mismo motivo que saveMutation: el banner vive en employee/layout.tsx
    // y solo refresca su estado cuando la pagina se vuelve a montar.
    onSuccess: () => { window.location.reload(); },
  });

  const coverMutation = useMutation({
    mutationFn: (file: File) => api.upload('/api/employees/me/cover', file),
    // Mismo motivo que saveMutation: el banner vive en employee/layout.tsx
    // y solo refresca su estado cuando la pagina se vuelve a montar.
    onSuccess: () => { window.location.reload(); },
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
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Foto de portada — banner editable. Click para cambiarla; si no
              hay foto, fondo teal con icono camara. */}
          <div
            className="relative h-28 cursor-pointer group"
            onClick={() => coverFileInputRef.current?.click()}
            style={{
              backgroundImage: empData?.coverImageUrl ? `url(${API_URL}${empData.coverImageUrl})` : undefined,
              backgroundColor: empData?.coverImageUrl ? undefined : (empData?.color || '#008080'),
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center">
              {coverMutation.isPending ? (
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent" />
              ) : (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 text-gray-700 text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M9 2L7.17 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V6a2 2 0 00-2-2h-3.17L15 2H9zm3 15a5 5 0 110-10 5 5 0 010 10zm0-2a3 3 0 100-6 3 3 0 000 6z"/>
                  </svg>
                  {empData?.coverImageUrl ? 'Cambiar portada' : 'Agregar portada'}
                </div>
              )}
            </div>
            <input
              ref={coverFileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) coverMutation.mutate(f);
                e.target.value = '';
              }}
            />
          </div>

          <div className="p-5">
          <div className="flex items-center gap-4 mb-4">
            <div
              className="relative group cursor-pointer flex-shrink-0"
              onClick={() => fileInputRef.current?.click()}
              title={empData?.avatarUrl ? 'Cambiar foto de perfil' : 'Agregar foto de perfil'}
            >
              <div className="w-16 h-16 rounded-full overflow-hidden flex items-center justify-center text-xl font-bold text-white" style={{ backgroundColor: empData?.color || '#008080' }}>
                {empData?.avatarUrl ? <img src={`${API_URL}${empData.avatarUrl}`} alt="" className="w-full h-full object-cover" /> : <>{empData?.firstName?.[0]}{empData?.lastName?.[0]}</>}
              </div>
              {/* Overlay completo en hover (desktop) */}
              <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" /><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" /></svg>
              </div>
              {/* Badge camara permanente — visible siempre (mobile + desktop) */}
              <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-[#008080] border-2 border-white flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M9 2L7.17 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V6a2 2 0 00-2-2h-3.17L15 2H9zm3 15a5 5 0 110-10 5 5 0 010 10zm0-2a3 3 0 100-6 3 3 0 000 6z"/>
                </svg>
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
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Presentación</label>
                <p className="text-[11px] text-gray-400 mb-1.5 leading-relaxed">
                  Cuéntale a tus clientes quién eres, tu experiencia y especialidades. Este texto aparece en tu perfil público del marketplace.
                </p>
                <textarea
                  value={editForm.bio}
                  onChange={(e) => setEditForm((f) => ({ ...f, bio: e.target.value }))}
                  className="input-field resize-none"
                  rows={4}
                  placeholder="Ej: Estilista con 8 años de experiencia, especializada en colorimetría y cortes modernos…"
                />
              </div>

              <h4 className="text-xs font-semibold text-gray-500 uppercase pt-2">Información médica</h4>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Tipo de sangre <span className="text-[10px] text-gray-400 font-normal">(opcional)</span>
                </label>
                <select value={personalForm.bloodType} onChange={(e) => setPersonalForm((f) => ({ ...f, bloodType: e.target.value }))} className="input-field">
                  <option value="">—</option>
                  {BLOOD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Alergias <span className="text-[10px] text-gray-400 font-normal">(opcional)</span>
                </label>
                <AllergiesSelector value={personalForm.allergies} onChange={(v) => setPersonalForm((f) => ({ ...f, allergies: v }))} />
              </div>

              <h4 className="text-xs font-semibold text-gray-500 uppercase pt-2">Contacto de emergencia</h4>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Nombre</label><input type="text" autoComplete="off" name="emergencyName" value={personalForm.emergencyContactName} onChange={(e) => setPersonalForm((f) => ({ ...f, emergencyContactName: e.target.value }))} className="input-field" /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Apellido</label><input type="text" autoComplete="off" name="emergencyLastName" value={personalForm.emergencyContactLastName} onChange={(e) => setPersonalForm((f) => ({ ...f, emergencyContactLastName: e.target.value }))} className="input-field" /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Teléfono</label><input type="tel" autoComplete="off" inputMode="numeric" name="emergencyPhone" maxLength={10} placeholder="10 dígitos" value={personalForm.emergencyContactPhone} onChange={(e) => setPersonalForm((f) => ({ ...f, emergencyContactPhone: e.target.value.replace(/\D/g, '').slice(0, 10) }))} className="input-field" /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Relación</label><select value={personalForm.emergencyContactRelation} onChange={(e) => setPersonalForm((f) => ({ ...f, emergencyContactRelation: e.target.value }))} className="input-field"><option value="">—</option>{RELATIONS.map((r) => <option key={r} value={r}>{r}</option>)}</select></div>
              </div>

              <div className="flex gap-2 pt-2">
                <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: '#008080' }}>{saveMutation.isPending ? 'Guardando...' : 'Guardar'}</button>
                <button onClick={() => setIsEditing(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50">Cancelar</button>
              </div>
            </div>
          )}
          </div>
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

        {/* Cambiar perfil + Logout */}
        <button
          onClick={() => router.push('/login')}
          className="w-full py-3 rounded-xl text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 transition-colors mb-2"
        >
          Cambiar perfil
        </button>
        <button
          onClick={async () => {
            await signOutAll();
            router.push('/login');
          }}
          className="w-full py-3 rounded-xl text-sm font-medium text-red-600 bg-white border border-gray-200 hover:bg-red-50 transition-colors"
        >
          Cerrar sesión
        </button>
      </div>

      {cropFile && (
        <AvatarCropModal imageFile={cropFile} onCancel={() => setCropFile(null)} onChooseAnother={() => { setCropFile(null); fileInputRef.current?.click(); }} onAccept={(f) => { avatarMutation.mutate(f); setCropFile(null); }} />
      )}
    </div>
  );
}
