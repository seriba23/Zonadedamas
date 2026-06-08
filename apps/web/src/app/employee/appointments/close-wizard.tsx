'use client';

import { useState, useRef, useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '@/lib/api';
import { formatCurrency as rawFormatCurrency } from '@/lib/utils';
import { useCurrency } from '@/lib/hooks/use-currency';
import { RebookPromptModal } from '@/components/ui/rebook-prompt-modal';

const TEAL = '#008080';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const MAX_PHOTOS_PER_SERVICE = 3;

interface AppointmentItem {
  serviceId: string;
  serviceNameSnapshot: string;
  priceSnapshot: string | number;
  durationSnapshot: number;
}

interface Appointment {
  id: string;
  client: { id: string; firstName: string; lastName: string };
  items: AppointmentItem[];
}

interface UploadedPhoto {
  serviceId: string;
  imageUrl: string;
}

type Step = 'consent' | 'photos' | 'payment' | 'qr' | 'done' | 'deferred';

const PAYMENT_METHODS = [
  { key: 'CASH', label: 'Efectivo', icon: '💵' },
  { key: 'CARD', label: 'Tarjeta', icon: '💳' },
  { key: 'TRANSFER', label: 'Transferencia', icon: '🏦' },
  { key: 'POS', label: 'Pagar en recepción', icon: '🛎️' },
];

export function CloseAppointmentWizard({
  appointment,
  onDone,
  onClose,
}: {
  appointment: Appointment;
  onDone: () => void;
  onClose: () => void;
}) {
  const currencyHook = useCurrency();
  const formatCurrency = currencyHook?.format ?? rawFormatCurrency;
  const [step, setStep] = useState<Step>('consent');
  const [photoConsent, setPhotoConsent] = useState<boolean | null>(null);
  const [uploadedPhotos, setUploadedPhotos] = useState<UploadedPhoto[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<string>('CASH');
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  // Servicio activo para el file picker. Usamos useRef en vez de useState
  // porque setState no se aplica antes de fileInputRef.click(), y cuando
  // el onChange del input se dispara, el closure leeria el valor viejo
  // (null). Con ref el valor esta disponible sincrono.
  const pendingServiceIdRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const total = appointment.items.reduce((s, i) => s + Number(i.priceSnapshot), 0);

  // Servicios unicos de la cita (dedup por serviceId, si el mismo servicio
  // aparece 2 veces solo lo contamos una vez para el grid de fotos).
  const uniqueServices = useMemo(() => {
    const map = new Map<string, AppointmentItem>();
    for (const item of appointment.items) {
      if (!map.has(item.serviceId)) map.set(item.serviceId, item);
    }
    return Array.from(map.values());
  }, [appointment.items]);

  const isSingleService = uniqueServices.length === 1;
  const totalPhotos = uploadedPhotos.length;

  const consentMutation = useMutation({
    mutationFn: (consent: boolean) =>
      api.post(`/api/appointments/${appointment.id}/photo-consent`, { consent }),
    onSuccess: (_, consent) => {
      setPhotoConsent(consent);
      setStep(consent ? 'photos' : 'payment');
    },
  });

  const handleUploadPhoto = async (file: File, serviceId: string) => {
    const photosForService = uploadedPhotos.filter((p) => p.serviceId === serviceId);
    if (photosForService.length >= MAX_PHOTOS_PER_SERVICE) return;
    setUploadingFor(serviceId);
    setUploadError(null);
    try {
      const res = await api.upload<{ data: { imageUrl: string } }>(
        `/api/appointments/${appointment.id}/photos`,
        file,
        { serviceId },
      );
      setUploadedPhotos((prev) => [...prev, { serviceId, imageUrl: res.data.imageUrl }]);
    } catch (err: any) {
      console.error('Error uploading photo:', err);
      const code = err?.statusCode ? ` [${err.statusCode}]` : '';
      const msg = err?.message || 'No se pudo subir la foto. Verifica el archivo e intenta de nuevo.';
      setUploadError(`${msg}${code}`);
    } finally {
      setUploadingFor(null);
    }
  };

  function openFilePicker(serviceId: string) {
    pendingServiceIdRef.current = serviceId;
    fileInputRef.current?.click();
  }

  const [confirmationToken, setConfirmationToken] = useState<string | null>(null);

  const recordPaymentMutation = useMutation({
    mutationFn: () =>
      api.post(`/api/appointments/${appointment.id}/record-payment`, {
        paymentMethod,
        amount: total,
      }),
    onSuccess: () => generateTokenMutation.mutate(),
    onError: (err: any) => {
      // 409 = payment already recorded, salta al QR igualmente
      if (err?.statusCode === 409) generateTokenMutation.mutate();
    },
  });

  // Delega el cobro al POS de recepción. El empleado ya terminó (consent +
  // fotos), pero el pago lo registra el cajero desde /pos. La cita queda
  // IN_PROGRESS con pendingPosPayment=true y aparece con badge "Por cobrar".
  const deferToPosMutation = useMutation({
    mutationFn: () => api.post(`/api/appointments/${appointment.id}/defer-to-pos`, {}),
    onSuccess: () => setStep('deferred'),
  });

  function handleSubmitPayment() {
    if (paymentMethod === 'POS') {
      deferToPosMutation.mutate();
    } else {
      recordPaymentMutation.mutate();
    }
  }

  const generateTokenMutation = useMutation({
    mutationFn: () =>
      api.post<{ data: { token: string; alreadyConfirmed: boolean } }>(
        `/api/appointments/${appointment.id}/generate-confirmation-token`,
        {},
      ),
    onSuccess: (res) => {
      setConfirmationToken(res.data.token);
      setStep('qr');
    },
    onError: () => {
      // Si falla la generacion (BD aun sin la columna, p.ej.), saltamos al
      // step done con el flujo viejo sin QR para no bloquear al empleado.
      setStep('done');
    },
  });

  const [showRebook, setShowRebook] = useState(false);

  const completeMutation = useMutation({
    mutationFn: () =>
      api.post(`/api/appointments/${appointment.id}/complete`, {}),
    // En vez de cerrar al instante, ofrecemos al empleado agendar otra cita
    // al mismo cliente (rebook). El modal lo decide.
    onSuccess: () => setShowRebook(true),
  });

  const stepNumber = { consent: 1, photos: 2, payment: 3, qr: 4, done: 5, deferred: 4 }[step];
  const totalSteps = photoConsent === false ? 4 : 5;

  // URL que el cliente abre en su movil (QR + link copiable).
  const confirmationUrl = confirmationToken
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/confirm-payment/${confirmationToken}`
    : '';

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Progress bar */}
        <div className="h-1 bg-gray-100">
          <div
            className="h-1 transition-all duration-300"
            style={{ width: `${(stepNumber / totalSteps) * 100}%`, backgroundColor: TEAL }}
          />
        </div>

        <div className="p-6">
          {/* ─── Step 1: Consent ─────────────────────────── */}
          {step === 'consent' && (
            <div>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 mx-auto" style={{ backgroundColor: '#e0f2f1' }}>
                <svg className="w-7 h-7" style={{ color: TEAL }} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-gray-900 text-center mb-1">Fotos del resultado</h2>
              <p className="text-sm text-gray-500 text-center mb-6">
                ¿<span className="font-semibold">{appointment.client.firstName}</span> acepta que se tomen fotos del servicio realizado?
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => consentMutation.mutate(false)}
                  disabled={consentMutation.isPending}
                  className="py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  No, omitir
                </button>
                <button
                  onClick={() => consentMutation.mutate(true)}
                  disabled={consentMutation.isPending}
                  className="py-3 rounded-xl text-sm font-semibold text-white transition-colors"
                  style={{ backgroundColor: TEAL }}
                >
                  {consentMutation.isPending ? '...' : 'Sí, acepta'}
                </button>
              </div>
            </div>
          )}

          {/* ─── Step 2: Upload Photos ─────────────────────
              Si la cita tiene 1 servicio: grid simple de 3 fotos.
              Si tiene 2+: una seccion por servicio con su propio grid. */}
          {step === 'photos' && (
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">Fotos del servicio</h2>
              <p className="text-sm text-gray-500 mb-4">
                {isSingleService
                  ? `Sube hasta ${MAX_PHOTOS_PER_SERVICE} fotos del resultado`
                  : `Sube hasta ${MAX_PHOTOS_PER_SERVICE} fotos por cada servicio`}
              </p>

              {uploadError && (
                <div className="mb-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                  {uploadError}
                </div>
              )}

              <div className="space-y-4 mb-4 max-h-[50vh] overflow-y-auto pr-1">
                {uniqueServices.map((svc, svcIdx) => {
                  const photosForService = uploadedPhotos.filter((p) => p.serviceId === svc.serviceId);
                  const isUploadingHere = uploadingFor === svc.serviceId;
                  return (
                    <div key={svc.serviceId || `svc-${svcIdx}`}>
                      {/* Encabezado de servicio (solo si hay 2+) */}
                      {!isSingleService && (
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-semibold text-gray-700 truncate">
                            {svc.serviceNameSnapshot}
                          </p>
                          <span className="text-[10px] text-gray-400 flex-shrink-0">
                            {photosForService.length}/{MAX_PHOTOS_PER_SERVICE}
                          </span>
                        </div>
                      )}

                      {/* Grid de 3 columnas */}
                      <div className="grid grid-cols-3 gap-2">
                        {photosForService.map((photo, photoIdx) => (
                          <div key={photo.imageUrl || `photo-${svc.serviceId}-${photoIdx}`} className="aspect-square rounded-xl overflow-hidden bg-gray-100 relative">
                            <img src={`${API_URL}${photo.imageUrl}`} alt="" className="w-full h-full object-cover" />
                            <button
                              onClick={() => setUploadedPhotos((prev) => prev.filter((p) => p.imageUrl !== photo.imageUrl))}
                              className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center"
                            >
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ))}
                        {photosForService.length < MAX_PHOTOS_PER_SERVICE && (
                          <button
                            onClick={() => openFilePicker(svc.serviceId)}
                            disabled={isUploadingHere}
                            className="aspect-square rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-1 hover:border-teal-400 transition-colors"
                          >
                            {isUploadingHere ? (
                              <div className="w-5 h-5 rounded-full border-2 animate-spin" style={{ borderColor: TEAL, borderTopColor: 'transparent' }} />
                            ) : (
                              <>
                                <svg className="w-6 h-6 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                </svg>
                                <span className="text-[10px] text-gray-400">Añadir</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  const sid = pendingServiceIdRef.current;
                  if (file && sid) handleUploadPhoto(file, sid);
                  pendingServiceIdRef.current = null;
                  e.target.value = '';
                }}
              />

              <div className="flex gap-2">
                <button
                  onClick={() => setStep('payment')}
                  className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors"
                >
                  {totalPhotos === 0 ? 'Omitir' : 'Continuar'}
                </button>
                {totalPhotos > 0 && (
                  <button
                    onClick={() => setStep('payment')}
                    className="flex-1 py-3 rounded-xl text-sm font-semibold text-white"
                    style={{ backgroundColor: TEAL }}
                  >
                    Continuar ({totalPhotos})
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ─── Step 3: Payment ─────────────────────────── */}
          {step === 'payment' && (
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-4">Proceder al pago</h2>

              {/* Desglose */}
              <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-2">
                {appointment.items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">{item.serviceNameSnapshot}</span>
                    <span className="font-medium text-gray-900">{formatCurrency(Number(item.priceSnapshot))}</span>
                  </div>
                ))}
                <div className="border-t border-gray-200 pt-2 mt-2 flex items-center justify-between">
                  <span className="text-sm font-bold text-gray-900">Total</span>
                  <span className="text-base font-black" style={{ color: TEAL }}>{formatCurrency(total)}</span>
                </div>
              </div>

              {/* Método de pago */}
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Método de pago</p>
              <div className="grid grid-cols-2 gap-2 mb-5">
                {PAYMENT_METHODS.map((m) => (
                  <button
                    key={m.key}
                    onClick={() => setPaymentMethod(m.key)}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all"
                    style={paymentMethod === m.key
                      ? { borderColor: TEAL, backgroundColor: '#e0f2f1', color: TEAL }
                      : { borderColor: '#e5e7eb', color: '#6b7280' }
                    }
                  >
                    <span>{m.icon}</span>
                    {m.label}
                  </button>
                ))}
              </div>

              <button
                onClick={handleSubmitPayment}
                disabled={recordPaymentMutation.isPending || deferToPosMutation.isPending}
                className="w-full py-3 rounded-xl text-sm font-bold text-white transition-colors disabled:opacity-50"
                style={{ backgroundColor: TEAL }}
              >
                {paymentMethod === 'POS'
                  ? (deferToPosMutation.isPending ? 'Enviando...' : 'Enviar a recepción →')
                  : (recordPaymentMutation.isPending ? 'Registrando...' : 'Pago realizado ✓')}
              </button>
            </div>
          )}

          {/* ─── Step 4: QR de confirmacion al cliente ───── */}
          {step === 'qr' && confirmationToken && (
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-1 text-center">Confirmación del cliente</h2>
              <p className="text-sm text-gray-500 text-center mb-4">
                Pide a <span className="font-semibold">{appointment.client.firstName}</span> que escanee el QR para
                ver el desglose, confirmar el cobro y dejar su reseña.
              </p>

              <div className="bg-gray-50 rounded-2xl p-4 mb-4 flex items-center justify-center">
                <div className="bg-white p-3 rounded-xl">
                  <QRCodeSVG value={confirmationUrl} size={180} level="M" />
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-3 mb-4 flex items-center gap-2">
                <p className="text-[11px] text-gray-600 flex-1 min-w-0 truncate font-mono">
                  {confirmationUrl}
                </p>
                <button
                  onClick={() => {
                    if (typeof navigator !== 'undefined' && navigator.clipboard) {
                      navigator.clipboard.writeText(confirmationUrl).catch(() => {});
                    }
                  }}
                  className="text-[11px] font-semibold text-white px-2.5 py-1 rounded-lg flex-shrink-0"
                  style={{ backgroundColor: TEAL }}
                >
                  Copiar
                </button>
              </div>

              <button
                onClick={() => setStep('done')}
                className="w-full py-3 rounded-xl text-sm font-bold text-white"
                style={{ backgroundColor: TEAL }}
              >
                Continuar
              </button>
            </div>
          )}

          {/* ─── Step alternativo: Enviado al POS ────────── */}
          {step === 'deferred' && (
            <div className="text-center py-2">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4 mx-auto" style={{ backgroundColor: '#e0f2f1' }}>
                <span className="text-3xl">🛎️</span>
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">Enviado a recepción</h2>
              <p className="text-sm text-gray-500 mb-2">
                <span className="font-semibold">{appointment.client.firstName}</span> debe pasar a recepción a pagar.
              </p>
              <p className="text-xs text-gray-400 mb-6">
                La cita aparecerá en el punto de venta con la etiqueta <span className="font-semibold text-orange-600">Por cobrar</span>. El cajero registrará el pago y le mostrará la pantalla de reseña.
              </p>
              <button
                onClick={() => setShowRebook(true)}
                className="w-full py-3 rounded-xl text-sm font-bold text-white"
                style={{ backgroundColor: TEAL }}
              >
                Cerrar
              </button>
            </div>
          )}

          {/* ─── Step 5: Done ────────────────────────────── */}
          {step === 'done' && (
            <div className="text-center py-2">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4 mx-auto" style={{ backgroundColor: '#e0f2f1' }}>
                <svg className="w-8 h-8" style={{ color: TEAL }} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">Pago registrado</h2>
              <p className="text-sm text-gray-500 mb-6">
                Pulsa el botón para marcar la cita como completada y notificar al cliente
              </p>
              <button
                onClick={() => completeMutation.mutate()}
                disabled={completeMutation.isPending}
                className="w-full py-3 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                style={{ backgroundColor: TEAL }}
              >
                {completeMutation.isPending ? 'Completando...' : 'Completar cita'}
              </button>
            </div>
          )}
        </div>
      </div>

      <RebookPromptModal
        show={showRebook}
        clientId={appointment.client.id}
        clientFirstName={appointment.client.firstName}
        onDismiss={() => { setShowRebook(false); onDone(); }}
      />
    </div>
  );
}
