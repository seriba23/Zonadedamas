'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { AvatarCropModal } from '@/components/ui/avatar-crop-modal';
import { CoverCropModal } from '@/components/ui/cover-crop-modal';
import { AddressAutocomplete } from '@/components/ui/address-autocomplete';
import { ConfettiCelebration } from '@/components/ui/confetti-celebration';
import { MarketplaceBusinessCard } from '@/components/marketplace/business-card';
import {
  SHAPES,
  SHAPE_NAMES,
  DEFAULT_CONFETTI_COLORS,
  type ConfettiShape,
} from '@/lib/confetti-shapes';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const FALLBACK_BIZ_TYPES = [
  { value: 'SALON', label: 'Salón' },
  { value: 'BARBERIA', label: 'Barbería' },
  { value: 'SPA', label: 'SPA' },
  { value: 'CLINICA', label: 'Clínica' },
  { value: 'TATUAJES', label: 'Tatuajes' },
];

function parseTypes(csv: string): string[] {
  return csv ? csv.split(',').filter(Boolean) : [];
}

function formatTypes(types: string[]): string {
  return types.join(',');
}

export default function BusinessSettingsPage() {
  const queryClient = useQueryClient();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const { data: bizTypesData } = useQuery({
    queryKey: ['business-types-catalog'],
    queryFn: () => api.get<{ data: { value: string; label: string }[] }>('/api/marketplace/business-types'),
  });
  const BUSINESS_TYPES = (bizTypesData as any)?.data || FALLBACK_BIZ_TYPES;
  const getTypeLabel = (value: string) => BUSINESS_TYPES.find((t: any) => t.value === value)?.label || value;

  const [form, setForm] = useState({
    name: '',
    description: '',
    businessType: '',
    address: '',
    businessPhone: '',
    isMarketplaceListed: false,
    cardColor: '#008080',
    confettiEnabled: true,
    confettiStyles: [] as ConfettiShape[],
    confettiColors: DEFAULT_CONFETTI_COLORS.slice(),
  });
  const [initialized, setInitialized] = useState(false);
  const [confettiPreviewKey, setConfettiPreviewKey] = useState(0);

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
      // Preferimos el array nuevo `confettiStyles`. Si esta vacio o no
      // existe, caemos al legacy singular `confettiStyle`. Si tampoco hay
      // nada, el array queda vacio — el ConfettiCelebration interpreta
      // eso como "cuadrado clasico" por fallback.
      const stylesRaw: string[] = Array.isArray(tenant.confettiStyles) && tenant.confettiStyles.length > 0
        ? tenant.confettiStyles
        : tenant.confettiStyle
          ? [tenant.confettiStyle]
          : [];
      const validStyles = stylesRaw
        .filter((s): s is ConfettiShape => SHAPE_NAMES.includes(s as ConfettiShape))
        .slice(0, 3);
      const storedColors = Array.isArray(tenant.confettiColors) && tenant.confettiColors.length > 0
        ? tenant.confettiColors.slice(0, 4)
        : DEFAULT_CONFETTI_COLORS.slice();
      setForm({
        name: tenant.name || '',
        description: tenant.description || '',
        businessType: tenant.businessType || '',
        address: tenant.address || '',
        businessPhone: tenant.businessPhone || '',
        isMarketplaceListed: tenant.isMarketplaceListed || false,
        cardColor: tenant.cardColor || '#008080',
        confettiEnabled: tenant.confettiEnabled !== false,
        confettiStyles: validStyles,
        confettiColors: storedColors,
      });
      setInitialized(true);
    }
  }, [tenant, initialized]);

  const profileMutation = useMutation({
    mutationFn: (data: typeof form) => api.put('/api/tenants/profile', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-current'] });
      queryClient.invalidateQueries({ queryKey: ['tenant-setup-check'] });
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

  const galleryDeleteMutation = useMutation({
    mutationFn: (imageId: string) => api.delete(`/api/tenants/gallery/${imageId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-gallery'] });
      setLightboxImage(null);
    },
  });

  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [lightboxImage, setLightboxImage] = useState<{ id: string; imageUrl: string; caption?: string } | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleGalleryFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const allFiles = Array.from(e.target.files || []);
    e.target.value = '';
    if (allFiles.length === 0) return;

    setUploadError(null);
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    const remaining = Math.max(0, 10 - galleryImages.length);
    if (remaining === 0) {
      setUploadError('Ya tienes el máximo de 10 fotos');
      return;
    }

    const accepted: File[] = [];
    const rejected: string[] = [];
    for (const file of allFiles) {
      if (!allowed.includes(file.type)) {
        rejected.push(`${file.name}: formato no permitido`);
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        rejected.push(`${file.name}: supera 5MB`);
        continue;
      }
      accepted.push(file);
    }

    const toUpload = accepted.slice(0, remaining);
    const skippedByLimit = accepted.length - toUpload.length;
    if (toUpload.length === 0) {
      setUploadError(rejected.join(' · ') || 'No se pudo procesar ninguna foto');
      return;
    }

    setUploadProgress({ current: 0, total: toUpload.length });
    let uploaded = 0;
    for (const file of toUpload) {
      try {
        await api.upload<any>('/api/tenants/gallery', file);
        uploaded += 1;
        setUploadProgress({ current: uploaded, total: toUpload.length });
      } catch (err) {
        rejected.push(`${file.name}: ${(err as any)?.message || 'error al subir'}`);
      }
    }
    setUploadProgress(null);
    queryClient.invalidateQueries({ queryKey: ['tenant-gallery'] });

    const notes: string[] = [];
    if (skippedByLimit > 0) notes.push(`${skippedByLimit} omitidas por límite de 10`);
    if (rejected.length > 0) notes.push(...rejected);
    if (notes.length > 0) setUploadError(notes.join(' · '));
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
          className="absolute bottom-3 right-3 px-3 py-1.5 backdrop-blur rounded-lg text-sm font-medium transition-colors shadow-sm hover:opacity-90"
          style={{ backgroundColor: 'rgba(255,255,255,0.92)', color: '#374151' }}
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
            <p className="text-xs text-gray-400 mt-1">siliba.com/marketplace/{tenant.slug}</p>
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
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
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

          <div className="pt-4 border-t border-gray-100">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-sm font-semibold text-gray-900">Confeti al confirmar reserva</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Animación celebratoria que ven los clientes al terminar de reservar
                </p>
              </div>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={form.confettiEnabled}
                  onChange={(e) => setForm((f) => ({ ...f, confettiEnabled: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 rounded-full peer-checked:bg-primary-600 peer-focus:ring-2 peer-focus:ring-primary-300 transition-colors" />
                <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow peer-checked:translate-x-5 transition-transform" />
              </div>
            </label>

            {form.confettiEnabled && (
              <div className="mt-5 space-y-4">
                {/* Selector de figuras (multi-select hasta 3) */}
                <div>
                  <div className="flex items-center justify-between mb-2 gap-2">
                    <p className="text-xs font-semibold text-gray-700">
                      Figuras ({form.confettiStyles.length}/3)
                    </p>
                    <p className="text-[10px] text-gray-400">
                      {form.confettiStyles.length === 0
                        ? 'Sin selección — se usará el cuadrado clásico'
                        : 'Selecciona hasta 3'}
                    </p>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {SHAPE_NAMES.map((name) => {
                      const isActive = form.confettiStyles.includes(name);
                      const reachedMax = form.confettiStyles.length >= 3 && !isActive;
                      return (
                        <button
                          key={name}
                          type="button"
                          disabled={reachedMax}
                          onClick={() =>
                            setForm((f) => {
                              if (f.confettiStyles.includes(name)) {
                                // Toggle off — se permite quedar vacio; el
                                // ConfettiCelebration usa el cuadrado por
                                // defecto si no hay ninguna seleccionada.
                                return { ...f, confettiStyles: f.confettiStyles.filter((s) => s !== name) };
                              }
                              if (f.confettiStyles.length >= 3) return f;
                              return { ...f, confettiStyles: [...f.confettiStyles, name] };
                            })
                          }
                          className={`relative flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-colors ${
                            isActive
                              ? 'border-[#008080] bg-teal-50'
                              : reachedMax
                                ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
                                : 'border-gray-200 bg-white hover:border-gray-300'
                          }`}
                        >
                          {isActive && (
                            <span
                              className="absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center text-white"
                              style={{ backgroundColor: '#008080' }}
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            </span>
                          )}
                          <ShapePreview shape={name} colors={form.confettiColors} />
                          <span className="text-[10px] font-medium text-gray-700">
                            {SHAPES[name].label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Selector de colores */}
                <div>
                  <div className="flex items-center justify-between mb-2 gap-2">
                    <p className="text-xs font-semibold text-gray-700">
                      Colores ({form.confettiColors.length}/4)
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          confettiColors: DEFAULT_CONFETTI_COLORS.slice(),
                        }))
                      }
                      className="px-3 py-1 rounded-full bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 text-[11px] font-medium transition-colors inline-flex items-center gap-1"
                      title="Restaurar la paleta predeterminada (teal)"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                      </svg>
                      Predeterminados
                    </button>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    {form.confettiColors.map((color, idx) => (
                      <div key={idx} className="flex items-center gap-1">
                        <input
                          type="color"
                          value={color}
                          onChange={(e) =>
                            setForm((f) => {
                              const next = [...f.confettiColors];
                              next[idx] = e.target.value;
                              return { ...f, confettiColors: next };
                            })
                          }
                          className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer p-0.5"
                        />
                        {form.confettiColors.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              setForm((f) => ({
                                ...f,
                                confettiColors: f.confettiColors.filter((_, i) => i !== idx),
                              }))
                            }
                            className="text-gray-400 hover:text-red-500 text-xs px-1"
                            title="Quitar color"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                    {form.confettiColors.length < 4 && (
                      <div
                        className="relative w-10 h-10 rounded-lg border-2 border-dashed border-gray-300 hover:border-[#008080] transition-colors flex items-center justify-center"
                        title="Agregar color"
                      >
                        <span className="text-gray-400 text-lg pointer-events-none select-none">+</span>
                        <input
                          // `key` fuerza el remount del input al agregar uno
                          // nuevo, asi el picker siempre abre con el default
                          // y no con el ultimo color elegido.
                          //
                          // defaultValue = #ff0000 (rojo puro, HSV 0/100/100).
                          // El picker nativo del SO arranca sus sliders en la
                          // posicion del color recibido — con S=100 y V=100
                          // ambos quedan al extremo derecho, asi el cuadro 2D
                          // muestra colores saturados y vibrantes en lugar de
                          // negros/grises. Tono al extremo izquierdo (0°),
                          // listo para que el usuario lo deslice al matiz que
                          // quiera sin perder visibilidad.
                          key={`add-color-${form.confettiColors.length}`}
                          type="color"
                          defaultValue="#ff0000"
                          onChange={(e) => {
                            const picked = e.target.value;
                            setForm((f) => ({
                              ...f,
                              confettiColors: [...f.confettiColors, picked].slice(0, 4),
                            }));
                          }}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          aria-label="Elegir color nuevo"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Vista previa */}
                <button
                  type="button"
                  onClick={() => setConfettiPreviewKey((k) => k + 1)}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold border-2 border-dashed transition-colors hover:bg-teal-50"
                  style={{ borderColor: '#008080', color: '#008080' }}
                >
                  Ver vista previa
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Card color */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Color de tarjeta</h3>
          <p className="text-xs text-gray-500 mb-3">
            Se usa como fondo de tu tarjeta en el marketplace cuando no tienes imagen de portada.
          </p>
          <div className="flex items-center gap-4">
            <input
              type="color"
              value={form.cardColor}
              onChange={(e) => setForm((f) => ({ ...f, cardColor: e.target.value }))}
              className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer p-0.5"
            />
            <div className="flex gap-2 flex-wrap">
              {['#008080','#1a56db','#e74694','#ff5a1f','#0e9f6e','#6875f5','#1c64f2','#9061f9','#374151','#b45309'].map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, cardColor: color }))}
                  className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
                  style={{
                    backgroundColor: color,
                    borderColor: form.cardColor === color ? 'white' : color,
                    boxShadow: form.cardColor === color ? `0 0 0 2px ${color}` : 'none',
                  }}
                />
              ))}
            </div>
          </div>
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
            <div className="mb-3 px-3 py-2 bg-teal-50 border border-teal-200 rounded-lg">
              <p className="text-xs text-teal-700">
                Agrega al menos 3 fotos para que se muestren en el marketplace ({3 - galleryImages.length} más)
              </p>
            </div>
          )}

          {uploadError && (
            <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-xs text-red-700 break-words">{uploadError}</p>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {galleryImages.length < 10 && (
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                disabled={uploadProgress !== null}
                className="aspect-square rounded-lg border-2 border-dashed border-gray-300 hover:border-primary-400 flex flex-col items-center justify-center gap-2 text-gray-400 hover:text-primary-500 transition-colors disabled:opacity-60"
              >
                {uploadProgress ? (
                  <>
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
                    <span className="text-xs text-gray-500">
                      Subiendo {uploadProgress.current}/{uploadProgress.total}
                    </span>
                  </>
                ) : (
                  <>
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span className="text-xs">Agregar fotos</span>
                    <span className="text-[10px] text-gray-400 px-2 text-center leading-tight">
                      Puedes seleccionar varias
                    </span>
                  </>
                )}
                <input
                  ref={galleryInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
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

      {/* Marketplace preview — usa el mismo componente que el cliente ve.
          Mezclamos los valores del form (edicion en vivo) con los datos
          reales del tenant para que el preview refleje exactamente lo que
          el cliente vera al guardar. Clickeable: abre el marketplace real
          en una pestaña nueva. */}
      <div className="mt-8">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Vista previa en el marketplace</h3>
        <MarketplaceBusinessCard
          biz={{
            id: tenant.id,
            name: form.name || tenant.name,
            slug: tenant.slug,
            logoUrl: tenant.logoUrl,
            coverImageUrl: tenant.coverImageUrl,
            cardColor: form.cardColor || tenant.cardColor,
            businessType: form.businessType || tenant.businessType,
            averageRating: tenant.averageRating ?? null,
            totalReviews: tenant.totalReviews ?? 0,
            completedAppointments: tenant.completedAppointments ?? 0,
          }}
          onClick={() => {
            if (tenant.slug) {
              // ?fromAdmin=1 hace que el marketplace muestre un banner sticky
              // con "Volver al panel" para que el admin no se pierda en el portal cliente.
              window.open(`/marketplace/${tenant.slug}?fromAdmin=1`, '_blank', 'noopener,noreferrer');
            }
          }}
        />
        <p className="text-xs text-gray-400 mt-2">
          {form.isMarketplaceListed
            ? 'Así se ve tu negocio en el marketplace · click para abrirlo'
            : 'Activa "Mostrar en el marketplace" para que los clientes lo vean'}
          {' · '}
          {tenant.coverImageUrl ? 'Usando imagen de portada' : `Fondo color ${form.cardColor}`}
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
          aspect="landscape"
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

      {/* Confeti vista previa: cada click al botón "Ver vista previa"
          incrementa la key y monta una instancia nueva del componente,
          disparando la animación. */}
      {confettiPreviewKey > 0 && (
        <ConfettiCelebration
          key={confettiPreviewKey}
          show
          duration={4000}
          particlesPerBurst={18}
          shapes={form.confettiStyles}
          colors={form.confettiColors}
        />
      )}
    </div>
  );
}

// Distribuciones (x, y, size) en un canvas de 40x40 px según cuántos
// colores hay que pintar. Permiten ver simultáneamente todos los tonos
// elegidos en una sola miniatura.
const PREVIEW_LAYOUTS: Record<number, Array<[number, number, number]>> = {
  1: [[20, 20, 28]],
  2: [
    [11, 20, 18],
    [29, 20, 18],
  ],
  3: [
    [11, 13, 16],
    [29, 13, 16],
    [20, 28, 16],
  ],
  4: [
    [11, 11, 15],
    [29, 11, 15],
    [11, 29, 15],
    [29, 29, 15],
  ],
};

/**
 * Render mini del shape para los botones del selector. Dibuja una instancia
 * por cada color de la paleta para que el usuario vea cómo se ve la figura
 * con cada color que está editando.
 */
function ShapePreview({ shape, colors }: { shape: ConfettiShape; colors: string[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const display = 40;
    canvas.width = display * dpr;
    canvas.height = display * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, display, display);
    const n = Math.max(1, Math.min(4, colors.length));
    const layout = PREVIEW_LAYOUTS[n];
    for (let i = 0; i < n; i++) {
      const [x, y, size] = layout[i];
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = colors[i];
      ctx.strokeStyle = colors[i];
      SHAPES[shape].draw(ctx, size);
      ctx.restore();
    }
  }, [shape, colors]);
  return <canvas ref={ref} style={{ width: 40, height: 40 }} />;
}
