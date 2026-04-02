'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/hooks/use-auth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { SuccessPopup } from '@/components/ui/success-popup';
import { AvatarCropModal } from '@/components/ui/avatar-crop-modal';
import { CoverCropModal } from '@/components/ui/cover-crop-modal';
import { AllergiesSelector } from '@/components/ui/allergies-selector';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const TEAL = '#008080';
const TEAL_LIGHT = '#e0f2f1';

const BLOOD_TYPES = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];
const RELATION_OPTIONS = ['Padre/Madre', 'Hermano/a', 'Esposo/a', 'Pareja', 'Hijo/a', 'Tío/a', 'Amigo/a', 'Otro'];
interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  color: string;
  bio: string;
  avatarUrl: string | null;
  coverImageUrl: string | null;
  bloodType: string | null;
  emergencyContactName: string | null;
  emergencyContactLastName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelation: string | null;
  allergies: string | null;
}

export default function EmployeeSettingsPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  // Edit profile state — auto-open from ?edit=true
  const [showEditProfile, setShowEditProfile] = useState(searchParams.get('edit') === 'true');
  const [editForm, setEditForm] = useState({
    firstName: '', lastName: '', email: '', phone: '', color: '#008080', bio: '',
  });
  const [personalForm, setPersonalForm] = useState({
    bloodType: '', allergies: '',
    emergencyContactName: '', emergencyContactLastName: '',
    emergencyContactPhone: '', emergencyContactRelation: '',
  });

  // Password change
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Success
  const [successPopup, setSuccessPopup] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [coverCropFile, setCoverCropFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // Avatar
  const avatarMutation = useMutation({
    mutationFn: async (file: File) => {
      return api.upload(`/api/employees/me/avatar`, file);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-settings'] });
      queryClient.invalidateQueries({ queryKey: ['employee-profile'] });
      queryClient.invalidateQueries({ queryKey: ['employee-profile-check'] });
      setSuccessMsg('Foto de perfil actualizada');
      setSuccessPopup(true);
    },
  });

  // Cover image
  const coverMutation = useMutation({
    mutationFn: async (file: File) => {
      return api.upload(`/api/employees/me/cover`, file);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-settings'] });
      queryClient.invalidateQueries({ queryKey: ['employee-profile'] });
      queryClient.invalidateQueries({ queryKey: ['employee-profile-check'] });
      setSuccessMsg('Foto de portada actualizada');
      setSuccessPopup(true);
    },
  });

  const { data: employee, isLoading } = useQuery({
    queryKey: ['employee-settings', user?.employeeId],
    queryFn: async () => {
      const res = await api.get<{ data: Employee }>(`/api/employees/${user!.employeeId}`);
      return res.data;
    },
    enabled: !!user?.employeeId,
  });

  useEffect(() => {
    if (employee) {
      setEditForm({
        firstName: employee.firstName, lastName: employee.lastName,
        email: employee.email || '', phone: employee.phone || '',
        color: employee.color || '#008080', bio: employee.bio || '',
      });
      setPersonalForm({
        bloodType: employee.bloodType || '', allergies: employee.allergies || '',
        emergencyContactName: employee.emergencyContactName || '',
        emergencyContactLastName: employee.emergencyContactLastName || '',
        emergencyContactPhone: employee.emergencyContactPhone || '',
        emergencyContactRelation: employee.emergencyContactRelation || '',
      });
    }
  }, [employee]);

  const saveProfileMutation = useMutation({
    mutationFn: async () => {
      await Promise.all([
        api.put('/api/employees/me', editForm),
        api.put('/api/employees/me/personal-info', personalForm),
      ]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-settings'] });
      queryClient.invalidateQueries({ queryKey: ['employee-profile'] });
      setShowEditProfile(false);
      setSuccessMsg('Perfil actualizado');
      setSuccessPopup(true);
    },
  });

  const passwordMutation = useMutation({
    mutationFn: () =>
      api.put('/api/auth/change-password', {
        currentPassword,
        newPassword,
      }),
    onSuccess: () => {
      setShowPasswordChange(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordError('');
      setSuccessMsg('Contraseña actualizada');
      setSuccessPopup(true);
    },
    onError: (err: any) => {
      setPasswordError(err.message || 'Error al cambiar contraseña');
    },
  });

  function handlePasswordSubmit() {
    setPasswordError('');
    if (newPassword.length < 8) {
      setPasswordError('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Las contraseñas no coinciden');
      return;
    }
    passwordMutation.mutate();
  }

  if (isLoading || !user?.employeeId) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin h-8 w-8 border-4 border-primary-200 border-t-primary-600 rounded-full" />
      </div>
    );
  }

  const avatarBg = employee?.color
    ? { backgroundColor: employee.color + '22', color: employee.color }
    : { backgroundColor: TEAL_LIGHT, color: TEAL };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push('/employee')}
          className="w-9 h-9 rounded-full flex items-center justify-center bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <h1 className="text-lg font-bold text-gray-900">Configuración</h1>
      </div>

      <div className="space-y-4">
        {/* ─── Profile Card ────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-5 flex items-center gap-4">
            {/* Avatar with crop modal */}
            <div
              className="relative group cursor-pointer flex-shrink-0"
              onClick={() => fileInputRef.current?.click()}
            >
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold overflow-hidden"
                style={avatarBg}
              >
                {employee?.avatarUrl ? (
                  <img src={`${API_URL}${employee.avatarUrl}`} alt="" className="w-full h-full object-cover" />
                ) : (
                  <>{employee?.firstName?.[0]}{employee?.lastName?.[0]}</>
                )}
              </div>
              <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                {avatarMutation.isPending ? (
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                ) : (
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
                  </svg>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setCropFile(file);
                  e.target.value = '';
                }}
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold text-gray-900">{employee?.firstName} {employee?.lastName}</p>
              <p className="text-sm text-gray-500 truncate">{employee?.email}</p>
              {employee?.bio && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{employee.bio}</p>}
            </div>
          </div>

          {/* Cover image */}
          <div className="border-t border-gray-100 px-5 py-4">
            <p className="text-xs font-medium text-gray-500 mb-2">Foto de portada</p>
            <div
              className="relative group cursor-pointer rounded-xl overflow-hidden"
              style={{ height: 200, maxWidth: 140 }}
              onClick={() => coverInputRef.current?.click()}
            >
              {employee?.coverImageUrl ? (
                <img src={`${API_URL}${employee.coverImageUrl}`} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: (employee?.color || '#008080') + '22' }}>
                  <p className="text-xs text-gray-400">Haz clic para agregar foto de portada</p>
                </div>
              )}
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                {coverMutation.isPending ? (
                  <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                ) : (
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
                  </svg>
                )}
              </div>
              <input
                ref={coverInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setCoverCropFile(file);
                  e.target.value = '';
                }}
              />
            </div>
            <p className="text-[11px] text-gray-400 mt-1">Esta imagen aparece de fondo en tu perfil público</p>
          </div>

          <div className="border-t border-gray-100">
            <button
              onClick={() => setShowEditProfile(!showEditProfile)}
              className="w-full px-5 py-3 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: TEAL_LIGHT }}>
                  <svg className="w-4 h-4" style={{ color: TEAL }} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-gray-700">Editar perfil</p>
                  <p className="text-xs text-gray-400">Nombre, contacto, bio, info personal</p>
                </div>
              </div>
              <svg className={`w-4 h-4 text-gray-400 transition-transform ${showEditProfile ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>
        </div>

        {/* ─── Edit Profile Panel ────────────── */}
        {showEditProfile && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-5">
            {/* Basic Info */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Datos básicos</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Nombre</label>
                  <input
                    type="text"
                    value={editForm.firstName}
                    onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#008080] focus:ring-1 focus:ring-[#008080]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Apellido</label>
                  <input
                    type="text"
                    value={editForm.lastName}
                    onChange={(e) => setEditForm((f) => ({ ...f, lastName: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#008080] focus:ring-1 focus:ring-[#008080]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#008080] focus:ring-1 focus:ring-[#008080]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Teléfono</label>
                  <input
                    type="tel"
                    value={editForm.phone}
                    onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#008080] focus:ring-1 focus:ring-[#008080]"
                    placeholder="+52 55 1234 5678"
                  />
                </div>
              </div>
              <div className="mt-3">
                <label className="block text-xs font-medium text-gray-500 mb-1">Bio</label>
                <textarea
                  value={editForm.bio}
                  onChange={(e) => e.target.value.length <= 500 && setEditForm((f) => ({ ...f, bio: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none h-16 focus:outline-none focus:border-[#008080] focus:ring-1 focus:ring-[#008080]"
                  placeholder="Descripción breve..."
                />
                <p className="text-xs text-gray-400 text-right">{editForm.bio.length}/500</p>
              </div>
            </div>

            {/* Personal / Medical */}
            <div className="border-t border-gray-100 pt-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Información personal</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Tipo de sangre</label>
                  <select
                    value={personalForm.bloodType}
                    onChange={(e) => setPersonalForm((f) => ({ ...f, bloodType: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#008080] focus:ring-1 focus:ring-[#008080] bg-white"
                  >
                    <option value="">Sin especificar</option>
                    {BLOOD_TYPES.map((bt) => <option key={bt} value={bt}>{bt}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Alergias <span className="text-gray-400">(opcional)</span></label>
                  <p className="text-xs text-gray-400 mb-1.5 leading-relaxed">
                    Esta información ayuda a los especialistas a garantizar tu seguridad durante los servicios.
                  </p>
                  <AllergiesSelector value={personalForm.allergies} onChange={(v) => setPersonalForm((f) => ({ ...f, allergies: v }))} />
                </div>
              </div>
            </div>

            {/* Emergency Contact */}
            <div className="border-t border-gray-100 pt-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Contacto de emergencia</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Nombre</label>
                  <input
                    type="text"
                    value={personalForm.emergencyContactName}
                    onChange={(e) => setPersonalForm((f) => ({ ...f, emergencyContactName: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#008080] focus:ring-1 focus:ring-[#008080]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Apellido</label>
                  <input
                    type="text"
                    value={personalForm.emergencyContactLastName}
                    onChange={(e) => setPersonalForm((f) => ({ ...f, emergencyContactLastName: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#008080] focus:ring-1 focus:ring-[#008080]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Teléfono</label>
                  <input
                    type="tel"
                    value={personalForm.emergencyContactPhone}
                    onChange={(e) => setPersonalForm((f) => ({ ...f, emergencyContactPhone: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#008080] focus:ring-1 focus:ring-[#008080]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Relación</label>
                  <select
                    value={personalForm.emergencyContactRelation}
                    onChange={(e) => setPersonalForm((f) => ({ ...f, emergencyContactRelation: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#008080] focus:ring-1 focus:ring-[#008080] bg-white"
                  >
                    <option value="">Seleccionar...</option>
                    {RELATION_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Save/Cancel */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowEditProfile(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => saveProfileMutation.mutate()}
                disabled={saveProfileMutation.isPending}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-50"
                style={{ backgroundColor: TEAL }}
              >
                {saveProfileMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        )}

        {/* ─── Security ──────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
              </svg>
              Seguridad
            </h2>
          </div>

          <div className="divide-y divide-gray-100">
            <button
              onClick={() => setShowPasswordChange(!showPasswordChange)}
              className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
            >
              <div>
                <p className="text-sm text-gray-700">Cambiar contraseña</p>
                <p className="text-xs text-gray-400">Actualiza tu contraseña de acceso</p>
              </div>
              <svg className={`w-4 h-4 text-gray-400 transition-transform ${showPasswordChange ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>

            {showPasswordChange && (
              <div className="px-4 py-4 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Contraseña actual</label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => { setCurrentPassword(e.target.value); setPasswordError(''); }}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#008080] focus:ring-1 focus:ring-[#008080]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Nueva contraseña</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => { setNewPassword(e.target.value); setPasswordError(''); }}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#008080] focus:ring-1 focus:ring-[#008080]"
                    placeholder="Mínimo 8 caracteres"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Confirmar contraseña</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setPasswordError(''); }}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#008080] focus:ring-1 focus:ring-[#008080]"
                  />
                </div>
                {passwordError && (
                  <p className="text-xs text-red-600">{passwordError}</p>
                )}
                <button
                  onClick={handlePasswordSubmit}
                  disabled={!currentPassword || !newPassword || !confirmPassword || passwordMutation.isPending}
                  className="w-full py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-50 transition-colors"
                  style={{ backgroundColor: TEAL }}
                >
                  {passwordMutation.isPending ? 'Actualizando...' : 'Actualizar contraseña'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ─── Session ───────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
              </svg>
              Sesión
            </h2>
          </div>

          <button
            onClick={() => { logout(); router.push('/'); }}
            className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-red-50 transition-colors"
          >
            <div>
              <p className="text-sm text-red-600">Cerrar sesión</p>
              <p className="text-xs text-gray-400">Salir de tu cuenta en este dispositivo</p>
            </div>
            <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
            </svg>
          </button>
        </div>
      </div>

      {/* Success Popup */}
      {successPopup && (
        <SuccessPopup
          show={successPopup}
          title={successMsg}
          onClose={() => setSuccessPopup(false)}
        />
      )}

      {/* Avatar Crop Modal */}
      {cropFile && (
        <AvatarCropModal
          imageFile={cropFile}
          onCancel={() => setCropFile(null)}
          onChooseAnother={() => {
            setCropFile(null);
            fileInputRef.current?.click();
          }}
          onAccept={(croppedFile) => {
            avatarMutation.mutate(croppedFile);
            setCropFile(null);
          }}
        />
      )}

      {/* Cover Crop Modal */}
      {coverCropFile && (
        <CoverCropModal
          imageFile={coverCropFile}
          onCancel={() => setCoverCropFile(null)}
          onChooseAnother={() => {
            setCoverCropFile(null);
            coverInputRef.current?.click();
          }}
          onAccept={(croppedFile) => {
            coverMutation.mutate(croppedFile);
            setCoverCropFile(null);
          }}
        />
      )}
    </div>
  );
}
