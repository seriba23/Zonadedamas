'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { AvatarCropModal } from '@/components/ui/avatar-crop-modal';
import { CoverCropModal } from '@/components/ui/cover-crop-modal';
import { AddressAutocomplete } from '@/components/ui/address-autocomplete';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const BUSINESS_TYPES = [
  { value: 'SALON', label: 'Salón' },
  { value: 'BARBERIA', label: 'Barbería' },
  { value: 'SPA', label: 'SPA' },
  { value: 'CLINICA', label: 'Clínica' },
];

function parseTypes(csv: string): string[] {
  return csv ? csv.split(',').filter(Boolean) : [];
}

function formatTypes(types: string[]): string {
  return types.join(',');
}

function getTypeLabel(value: string): string {
  return BUSINESS_TYPES.find((t) => t.value === value)?.label || value;
}

export default function BusinessSettingsPage() {
  const queryClient = useQueryClient();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: '',
    description: '',
    businessType: '',
    address: '',
    businessPhone: '',
    isMarketplaceListed: false,
  });
  const [initialized, setInitialized] = useState(false);

  // Crop modal states
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null);
  const [pendingCoverFile, setPendingCoverFile] = useState<File | null>(null);

  const { data: tenantData, isLoading } = useQuery({
    queryKey: ['tenant-current'],
    queryFn: () => api.get<any>('/api/tenants/current'),
  });

  const tenant = (tenantData as any)?.data;

  // Initialize form when tenant loads
  useEffect(() => {
    if (tenant && !initialized) {
      setForm({
        name: tenant.name || '',
        description: tenant.description || '',
        businessType: tenant.businessType || '',
        address: tenant.address || '',
        businessPhone: tenant.businessPhone || '',
        isMarketplaceListed: tenant.isMarketplaceListed || false,
      });
      setInitialized(true);
    }
  }, [tenant, initialized]);

  const profileMutation = useMutation({
    mutationFn: (data: typeof form) => api.put('/api/tenants/profile', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-current'] });
    },
  });

  const logoMutation = useMutation({
    mutationFn: (file: File) => api.upload<any>('/api/tenants/logo', file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-current'] });
    },
  });

  const coverMutation = useMutation({
    mutationFn: (file: File) => api.upload<any>('/api/tenants/cover', file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-current'] });
    },
  });

  // Gallery
  const { data: galleryData } = useQuery({
    queryKey: ['tenant-gallery'],
    queryFn: () => api.get<any>('/api/tenants/gallery'),
  });
  const galleryImages: { id: string; imageUrl: string; caption?: string }[] = (galleryData as any)?.data || [];

  const galleryUploadMutation = useMutation({
    mutationFn: (file: File) => api.upload<any>('/api/tenants/gallery', file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-gallery'] });
    },
  });

  const galleryDeleteMutation = useMutation({
    mutationFn: (imageId: string) => api.delete(`/api/tenants/gallery/${imageId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-gallery'] });
      setLightboxImage(null);
    },
  });

  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [lightboxImage, setLightboxImage] = useState<{ id: string; imageUrl: string; caption?: string } | null>(null);

  function handleGalleryFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      alert('Solo se permiten archivos JPEG, PNG o WebP');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('El archivo no puede superar 5MB');
      return;
    }
    galleryUploadMutation.mutate(file);
    e.target.value = '';
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    profileMutation.mutate(form);
  };

  // Logo: open crop modal instead of uploading directly
  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setPendingLogoFile(file);
    // Reset input so same file can be selected again
    if (e.target) e.target.value = '';
  };

  // Cover: open crop modal instead of uploading directly
  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setPendingCoverFile(file);
    if (e.target) e.target.value = '';
  };

  // Business type multi-select toggle
  const selectedTypes = parseTypes(form.businessType);
  function toggleType(value: string) {
    const current = parseTypes(form.businessType);
    const next = current.includes(value)
      ? current.filter((t) => t !== value)
      : [...current, value];
    setForm((f) => ({ ...f, businessType: formatTypes(next) }));
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!tenant) return null;

  const typeLabels = parseTypes(tenant.businessType || '').map(getTypeLabel);

  return (
    <div className="max-w-3xl mx-auto py-6 px-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Mi Negocio</h1>

      {/* Cover image */}
      <div className="relative rounded-xl overflow-hidden mb-6 border border-gray-200">
        <div
          className="h-48 bg-gradient-to-r from-primary-600 to-primary-700 flex items-center justify-center"
        >
          {tenant.coverImageUrl ? (
            <img
              src={`${API_URL}${tenant.coverImageUrl}`}
              alt="Portada"
              className="w-full h-full object-cover"
            />
          ) : (
            <p className="text-white/60 text-sm">Sin imagen de portada</p>
          )}
        </div>
        <button
          onClick={() => coverInputRef.current?.click()}
          disabled={coverMutation.isPending}
          className="absolute bottom-3 right-3 px-3 py-1.5 bg-white/90 backdrop-blur rounded-lg text-sm font-medium text-gray-700 hover:bg-white transition-colors shadow-sm"
        >
          {coverMutation.isPending ? 'Subiendo...' : tenant.coverImageUrl ? 'Cambiar portada' : 'Subir portada'}
        </button>
        <input
          ref={coverInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleCoverChange}
        />
      </div>

      {/* Logo + name header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="relative group">
          <div className="w-20 h-20 rounded-full bg-gray-100 border-2 border-white shadow flex items-center justify-center overflow-hidden">
            {tenant.logoUrl ? (
              <img
                src={`${API_URL}${tenant.logoUrl}`}
                alt="Logo"
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-3xl font-bold text-gray-300">
                {tenant.name?.[0] || '?'}
              </span>
            )}
          </div>
          <button
            onClick={() => logoInputRef.current?.click()}
            disabled={logoMutation.isPending}
            className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
          >
            <span className="text-white text-xs font-medium">
              {logoMutation.isPending ? '...' : 'Cambiar'}
            </span>
          </button>
          <input
            ref={logoInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleLogoChange}
          />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900">{tenant.name}</h2>
          {typeLabels.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {typeLabels.map((label) => (
                <span key={label} className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-primary-50 text-primary-700">
                  {label}
                </span>
              ))}
            </div>
          )}
          {tenant.slug && (
            <p className="text-xs text-gray-400 mt-1">zonadedamas.com/marketplace/{tenant.slug}</p>
          )}
        </div>
      </div>

      {/* Profile form */}
      <form onSubmit={handleSave} className="space-y-5">
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">Información del negocio</h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre del negocio
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="input-field"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descripción
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="input-field resize-none"
              rows={3}
              placeholder="Describe tu negocio para los clientes del marketplace..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Tipo de negocio
              </label>
              <div className="flex flex-wrap gap-2">
                {BUSINESS_TYPES.map((t) => {
                  const isSelected = selectedTypes.includes(t.value);
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => toggleType(t.value)}
                      className={`px-3 py-1.5 text-sm font-medium rounded-full border transition-colors ${
                        isSelected
                          ? 'bg-primary-50 border-primary-300 text-primary-700'
                          : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {isSelected && (
                        <svg className="w-3.5 h-3.5 inline mr-1 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Teléfono de contacto
              </label>
              <input
                type="tel"
                value={form.businessPhone}
                onChange={(e) => setForm((f) => ({ ...f, businessPhone: e.target.value }))}
                className="input-field"
                placeholder="+1 555 0100"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Dirección
            </label>
            <AddressAutocomplete
              value={form.address}
              onChange={(addr) => setForm((f) => ({ ...f, address: addr }))}
              placeholder="Buscar dirección..."
            />
          </div>
        </div>

        {/* Marketplace toggle */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <p className="text-sm font-semibold text-gray-900">Visible en el marketplace</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Los clientes podrán encontrar y reservar en tu negocio desde el marketplace
              </p>
            </div>
            <div className="relative">
              <input
                type="checkbox"
                checked={form.isMarketplaceListed}
                onChange={(e) => setForm((f) => ({ ...f, isMarketplaceListed: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 rounded-full peer-checked:bg-primary-600 peer-focus:ring-2 peer-focus:ring-primary-300 transition-colors" />
              <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow peer-checked:translate-x-5 transition-transform" />
            </div>
          </label>
        </div>

        {/* Gallery */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Fotos del establecimiento</h3>
              <p className="text-xs text-gray-500 mt-0.5">{galleryImages.length}/10 fotos</p>
            </div>
          </div>

          {galleryImages.length < 3 && (
            <div className="mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-xs text-amber-700">
                Agrega al menos 3 fotos para que se muestren en el marketplace ({3 - galleryImages.length} más)
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {galleryImages.length < 10 && (
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                disabled={galleryUploadMutation.isPending}
                className="aspect-square rounded-lg border-2 border-dashed border-gray-300 hover:border-primary-400 flex flex-col items-center justify-center gap-2 text-gray-400 hover:text-primary-500 transition-colors"
              >
                {galleryUploadMutation.isPending ? (
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
                ) : (
                  <>
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span className="text-xs">Agregar foto</span>
                  </>
                )}
                <input
                  ref={galleryInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleGalleryFileSelect}
                  className="hidden"
                />
              </button>
            )}

            {galleryImages.map((img) => (
              <div
                key={img.id}
                className="relative aspect-square rounded-lg overflow-hidden group cursor-pointer"
                onClick={() => setLightboxImage(img)}
              >
                <img
                  src={`${API_URL}${img.imageUrl}`}
                  alt={img.caption || 'Galería'}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
              </div>
            ))}
          </div>
        </div>

        {/* Save button */}
        <button
          type="submit"
          disabled={profileMutation.isPending}
          className="w-full btn-primary flex items-center justify-center gap-2"
        >
          {profileMutation.isPending && (
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          {profileMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
        </button>

        {profileMutation.isSuccess && (
          <p className="text-sm text-green-600 text-center">Cambios guardados correctamente</p>
        )}
        {profileMutation.isError && (
          <p className="text-sm text-red-600 text-center">
            {(profileMutation.error as any)?.message || 'Error al guardar los cambios'}
          </p>
        )}
      </form>

      {/* Marketplace preview */}
      <div className="mt-8">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Vista previa en el marketplace</h3>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden pointer-events-none">
          <div className="h-32 relative bg-gradient-to-r from-primary-600 to-primary-700">
            {tenant.coverImageUrl && (
              <img
                src={`${API_URL}${tenant.coverImageUrl}`}
                alt=""
                className="w-full h-full object-cover"
              />
            )}
          </div>
          <div className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0 -mt-12 border-4 border-white shadow-md z-10 relative">
                {tenant.logoUrl ? (
                  <img
                    src={`${API_URL}${tenant.logoUrl}`}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-2xl font-bold text-gray-400">
                    {(form.name || tenant.name)?.[0]}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-semibold text-gray-900 truncate">
                    {form.name || tenant.name}
                  </h3>
                  {parseTypes(form.businessType).map((type) => (
                    <span key={type} className="px-2 py-0.5 text-xs font-medium rounded-full bg-primary-50 text-primary-700 flex-shrink-0">
                      {getTypeLabel(type)}
                    </span>
                  ))}
                </div>
                {form.address && (
                  <p className="text-xs text-gray-500 mt-1 truncate">{form.address}</p>
                )}
              </div>
            </div>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-2 text-center">
          Así se verá tu negocio en el marketplace para los clientes
        </p>
      </div>

      {/* Logo crop modal */}
      {pendingLogoFile && (
        <AvatarCropModal
          imageFile={pendingLogoFile}
          onAccept={(croppedFile) => {
            setPendingLogoFile(null);
            logoMutation.mutate(croppedFile);
          }}
          onCancel={() => setPendingLogoFile(null)}
          onChooseAnother={() => {
            setPendingLogoFile(null);
            logoInputRef.current?.click();
          }}
        />
      )}

      {/* Cover crop modal */}
      {pendingCoverFile && (
        <CoverCropModal
          imageFile={pendingCoverFile}
          onAccept={(croppedFile) => {
            setPendingCoverFile(null);
            coverMutation.mutate(croppedFile);
          }}
          onCancel={() => setPendingCoverFile(null)}
          onChooseAnother={() => {
            setPendingCoverFile(null);
            coverInputRef.current?.click();
          }}
        />
      )}

      {/* Gallery lightbox */}
      {lightboxImage && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="relative max-w-3xl max-h-[85vh] w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={`${API_URL}${lightboxImage.imageUrl}`}
              alt={lightboxImage.caption || 'Galería'}
              className="w-full h-full object-contain rounded-lg"
            />
            <div className="absolute top-2 right-2 flex gap-2">
              <button
                type="button"
                onClick={() => galleryDeleteMutation.mutate(lightboxImage.id)}
                disabled={galleryDeleteMutation.isPending}
                className="p-2 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors"
                title="Eliminar"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                className="p-2 bg-white/20 text-white rounded-full hover:bg-white/30 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
