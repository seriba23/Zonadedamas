// ─── close-wizard.tsx — Asistente de Cierre de Cita ─────────────────────
//
// Este componente implementa un "wizard" (asistente paso a paso) para cerrar
// una cita completada. Es un modal de pantalla completa con una barra de
// progreso en la parte superior que avanza conforme el empleado completa pasos.
//
// ¿QUÉ ES UN WIZARD?
// Un wizard es una secuencia de pasos donde el usuario avanza de uno en uno.
// Aquí se usa un estado local 'step' que controla qué pantalla mostrar.
//
// PASOS DEL WIZARD:
//   Paso 1 (consent)  → ¿El cliente acepta que se tomen fotos del resultado?
//   Paso 2 (photos)   → Subir hasta 3 fotos POR SERVICIO (si aceptó).
//   Paso 3 (payment)  → Seleccionar propina y método de pago. Ver desglose.
//   Paso 4 (qr)       → Mostrar QR al cliente para que confirme el pago.
//   Paso 5 (done)     → Botón final: marcar cita como COMPLETADA.
//
// PASO ALTERNATIVO:
//   deferred → Si el empleado eligió "Pagar en recepción" (POS), el pago
//              se delega al cajero y el wizard muestra pantalla de confirmación.
//
// CÁLCULO DE TOTALES:
//   total = servicios + productos − descuento(cupón) + propina
//
// FOTOS POR SERVICIO:
//   Si la cita tiene 1 servicio: grid simple de 3 celdas.
//   Si tiene 2+ servicios: una sección por servicio con su propio grid de 3.
//   Máximo MAX_PHOTOS_PER_SERVICE (3) fotos por servicio.
//
// ELECCIÓN DE FUENTE DE FOTO (móvil):
//   Al tocar "Añadir", aparece un "bottom sheet" (panel que sube desde abajo)
//   con dos opciones: "Tomar foto" (abre la cámara) o "Elegir de la galería".
//   En escritorio ambas opciones abren el selector de archivos del sistema.
//   Se usan DOS inputs <input type="file"> ocultos: uno con capture="environment"
//   (fuerza la cámara en móvil) y otro sin capture (abre la galería).

'use client';
// 'use client' → obligatorio porque usamos hooks y accedemos al DOM (refs, etc.)

import { useState, useRef, useMemo } from 'react';
// useState → estado local: paso actual, fotos subidas, método de pago, propina...
// useRef   → referencia directa a elementos del DOM sin causar re-render.
//            Lo usamos para los <input type="file"> ocultos (triggers de la cámara).
// useMemo  → memoriza el cálculo de los servicios únicos para no repetirlo.

import { useMutation } from '@tanstack/react-query';
// useMutation → para peticiones que modifican datos (consent, upload, pago, etc.)

import { QRCodeSVG } from 'qrcode.react';
// QRCodeSVG → componente que genera un código QR como SVG a partir de una URL.
// Lo mostramos en el paso 4 para que el cliente escanee y confirme el pago.

import { api } from '@/lib/api';
// api → cliente HTTP con JWT automático.

import { formatCurrency as rawFormatCurrency } from '@/lib/utils';
// rawFormatCurrency → formatea montos como "$150.00" (fallback sin moneda del usuario).

import { useCurrency } from '@/lib/hooks/use-currency';
// useCurrency → hook con la moneda preferida del usuario.

import { RebookPromptModal } from '@/components/ui/rebook-prompt-modal';
// RebookPromptModal → modal que aparece al FINAL del wizard (paso 5) preguntando
// si el empleado quiere agendar otra cita al mismo cliente de inmediato.

// CONSTANTES del módulo (definidas fuera del componente, no cambian)
const TEAL = '#008080';                                        // color principal
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'; // URL del backend
const MAX_PHOTOS_PER_SERVICE = 3;                              // máximo de fotos por servicio

// ─── INTERFACES DE TIPOS ──────────────────────────────────────────────────

interface AppointmentItem {
  serviceId: string;              // UUID del servicio
  serviceNameSnapshot: string;    // nombre del servicio al momento de la reserva
  priceSnapshot: string | number; // precio (puede venir como string de la BD)
  durationSnapshot: number;       // duración en minutos
}

interface ProductReservation {
  id?: string;                              // puede no tener id en algunos contextos
  quantity: number;
  unitPrice: string | number;
  product?: { name?: string | null } | null; // datos mínimos del producto
}

interface Appointment {
  id: string;
  client: { id: string; firstName: string; lastName: string };
  items: AppointmentItem[];
  // El total real de la cita = servicios + productos − descuento del cupón.
  // Sin estos campos el cobro tomaba solo los servicios.
  productReservations?: ProductReservation[];   // productos físicos reservados
  discountAmount?: string | number | null;      // descuento de cupón
}

// UploadedPhoto: representa una foto ya subida al servidor.
// Guardamos el serviceId para saber a qué servicio pertenece cada foto
// (para mostrarlas en la sección correcta del grid).
interface UploadedPhoto {
  serviceId: string; // a qué servicio pertenece esta foto
  imageUrl: string;  // URL relativa en el servidor (ej: "/uploads/results/xyz.jpg")
}

// Step: tipo de unión que define los pasos posibles del wizard.
// Solo puede tener exactamente uno de estos valores en cada momento.
//   'consent'  → Paso 1: ¿acepta fotos?
//   'photos'   → Paso 2: subir fotos (solo si consent=true)
//   'payment'  → Paso 3: propina y método de pago
//   'qr'       → Paso 4: QR para que el cliente confirme
//   'done'     → Paso 5: marcar como completada
//   'deferred' → Paso alternativo: cita enviada a recepción para cobro
type Step = 'consent' | 'photos' | 'payment' | 'qr' | 'done' | 'deferred';

// SVG paths heroicons outline — sin emojis para mantener look profesional.
const PAYMENT_METHODS: Array<{ key: string; label: string; icon: React.ReactNode }> = [
  {
    key: 'CASH',
    label: 'Efectivo',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
      </svg>
    ),
  },
  {
    key: 'CARD',
    label: 'Tarjeta',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
      </svg>
    ),
  },
  {
    key: 'TRANSFER',
    label: 'Transferencia',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
      </svg>
    ),
  },
  {
    key: 'POS',
    label: 'Pagar en recepción',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 2.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 0 0 3.75.614m-16.5 0a3.004 3.004 0 0 1-.621-4.72l1.189-1.19A1.5 1.5 0 0 1 5.378 3h13.243a1.5 1.5 0 0 1 1.06.44l1.19 1.189a3 3 0 0 1-.621 4.72M6.75 18h3.75a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-.75-.75H6.75a.75.75 0 0 0-.75.75v3.75c0 .414.336.75.75.75Z" />
      </svg>
    ),
  },
];

// ─── COMPONENTE PRINCIPAL DEL WIZARD ──────────────────────────────────────
// export function (sin "default") → exportación nombrada. Se importa así:
// import { CloseAppointmentWizard } from './close-wizard'
//
// PROPS:
//   appointment → la cita que se va a cerrar (con sus servicios y cliente)
//   onDone      → función del padre a llamar cuando el wizard termina
//   onClose     → función del padre a llamar cuando el usuario cancela (X)
export function CloseAppointmentWizard({
  appointment,
  onDone,
  onClose,
}: {
  appointment: Appointment;
  /** Llamado cuando el wizard termina. Si la cita quedo enviada a
   * recepcion (deferred), `awaitingReception=true` para que el padre
   * cierre el detalle Y deshabilite el boton "Cerrar cita". */
  onDone: (opts?: { awaitingReception?: boolean }) => void;
  onClose: () => void;
}) {
  // Obtenemos la función de formato de moneda del usuario.
  const currencyHook = useCurrency();
  const formatCurrency = currencyHook?.format ?? rawFormatCurrency;

  // ─── ESTADOS DEL WIZARD ───────────────────────────────────────────────
  // step: paso actual del wizard. Empieza en 'consent' (primer paso).
  const [step, setStep] = useState<Step>('consent');

  // photoConsent: respuesta del cliente sobre las fotos.
  //   null    → aún no ha respondido (en el paso 'consent')
  //   true    → sí acepta fotos → ir al paso 'photos'
  //   false   → no acepta fotos → saltar directo a 'payment'
  const [photoConsent, setPhotoConsent] = useState<boolean | null>(null);

  // uploadedPhotos: arreglo de fotos ya subidas al servidor exitosamente.
  // Cada foto tiene serviceId (a qué servicio pertenece) e imageUrl (URL en el server).
  const [uploadedPhotos, setUploadedPhotos] = useState<UploadedPhoto[]>([]);

  // paymentMethod: método de pago seleccionado en el paso 'payment'.
  // Valores posibles: 'CASH', 'CARD', 'TRANSFER', 'POS'.
  const [paymentMethod, setPaymentMethod] = useState<string>('CASH');

  // tip: monto de propina en pesos. 0 = sin propina.
  // Se selecciona con botones de 0%, 10%, 15%, 20%.
  const [tip, setTip] = useState<number>(0);

  // uploadingFor: serviceId del servicio para el cual se está subiendo
  // una foto en este momento. null = no hay upload en progreso.
  // Se usa para mostrar el spinner de carga en la celda correcta.
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);

  // uploadError: mensaje de error si falla la subida de una foto.
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Servicio activo para el file picker. Usamos useRef en vez de useState
  // porque setState no se aplica antes de fileInputRef.click(), y cuando
  // el onChange del input se dispara, el closure leeria el valor viejo
  // (null). Con ref el valor esta disponible sincrono.
  //
  // ¿POR QUÉ useRef y no useState?
  // Cuando llamamos a input.click() para abrir el selector de archivos,
  // React aún no ha procesado el setState (es asíncrono). Entonces cuando
  // el onChange del input se dispara, el state sigue siendo el valor viejo.
  // Con useRef el valor se actualiza de forma SÍNCRONA y está disponible
  // inmediatamente cuando el onChange se ejecuta.
  const pendingServiceIdRef = useRef<string | null>(null);

  // cameraInputRef: referencia al <input type="file" capture="environment">
  // oculto. Al llamar .click() en él, abre la cámara del dispositivo.
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // galleryInputRef: referencia al <input type="file"> normal oculto.
  // Al llamar .click() en él, abre el selector de archivos/galería.
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // photoSourceFor: serviceId para el cual se está mostrando el "bottom sheet"
  // de elección de fuente (cámara o galería). null = sheet cerrado.
  // Servicio para el cual se esta eligiendo origen de la foto. Si no es
  // null se muestra el bottom sheet con opciones "Camara" / "Galeria".
  const [photoSourceFor, setPhotoSourceFor] = useState<string | null>(null);

  // ─── CÁLCULO DE TOTALES ───────────────────────────────────────────────
  // ?? es "nullish coalescing": si el valor es null o undefined, usa []
  const products = appointment.productReservations ?? [];

  // Suma de todos los precios de los servicios.
  // .reduce(acumulador, valorInicial): recorre el arreglo acumulando valores.
  const servicesSubtotal = appointment.items.reduce((s, i) => s + Number(i.priceSnapshot), 0);

  // Suma de todos los productos × cantidad.
  // Number(p.quantity ?? 1) → si quantity es null/undefined, usamos 1.
  const productsSubtotal = products.reduce(
    (s, p) => s + Number(p.unitPrice) * Number(p.quantity ?? 1),
    0,
  );

  // Descuento del cupón (si hay uno aplicado a la cita).
  const discount = Number(appointment.discountAmount ?? 0);

  // subtotal: servicios + productos (sin descuento ni propina).
  const subtotal = servicesSubtotal + productsSubtotal;

  // total: lo que el cliente paga en realidad.
  // Math.max(0, ...) evita que el total sea negativo (si el descuento > subtotal).
  // + tip añade la propina al final.
  const total = Math.max(0, subtotal - discount) + tip;

  // Servicios unicos de la cita (dedup por serviceId, si el mismo servicio
  // aparece 2 veces solo lo contamos una vez para el grid de fotos).
  //
  // useMemo: solo recalcula si appointment.items cambia.
  // Map: estructura clave→valor. Usamos serviceId como clave para deduplicar.
  // Si ya existe el serviceId en el Map, simplemente lo ignoramos (no lo añade
  // porque las claves del Map son únicas).
  const uniqueServices = useMemo(() => {
    const map = new Map<string, AppointmentItem>();
    for (const item of appointment.items) {
      if (!map.has(item.serviceId)) map.set(item.serviceId, item);
    }
    // Array.from(map.values()) → convierte los VALORES del Map en un arreglo.
    return Array.from(map.values());
  }, [appointment.items]);

  // isSingleService: true si la cita solo tiene 1 servicio único.
  // Cambia el modo de visualización del grid de fotos.
  const isSingleService = uniqueServices.length === 1;

  // totalPhotos: número total de fotos subidas (de todos los servicios).
  const totalPhotos = uploadedPhotos.length;

  // ─── MUTACIONES (peticiones que modifican datos) ─────────────────────────

  // consentMutation: Paso 1 → registra si el cliente acepta las fotos.
  // mutationFn recibe un booleano (true/false).
  // onSuccess: el segundo argumento de la función callback es el PARÁMETRO
  // original que se pasó a mutate() (en este caso, el booleano consent).
  //   - Si consent=true → vamos al paso 'photos'
  //   - Si consent=false → saltamos al paso 'payment' (sin fotos)
  const consentMutation = useMutation({
    mutationFn: (consent: boolean) =>
      api.post(`/api/appointments/${appointment.id}/photo-consent`, { consent }),
    onSuccess: (_, consent) => {
      setPhotoConsent(consent); // guardamos la respuesta para usarla en el total de pasos
      setStep(consent ? 'photos' : 'payment'); // ternario: decide el siguiente paso
    },
  });

  // handleUploadPhoto: función asíncrona que sube una foto al servidor.
  // PARÁMETROS:
  //   file      → el File seleccionado por el usuario (del <input type="file">)
  //   serviceId → a qué servicio pertenece esta foto
  const handleUploadPhoto = async (file: File, serviceId: string) => {
    // .filter() cuenta cuántas fotos ya subimos para ESTE servicio.
    const photosForService = uploadedPhotos.filter((p) => p.serviceId === serviceId);
    // Si ya alcanzamos el máximo, no hacemos nada.
    if (photosForService.length >= MAX_PHOTOS_PER_SERVICE) return;

    setUploadingFor(serviceId); // muestra el spinner en la celda de este servicio
    setUploadError(null);       // limpia errores anteriores
    try {
      // api.upload() hace un POST con multipart/form-data (para archivos).
      // Le pasa también el serviceId como campo adicional del formulario.
      const res = await api.upload<{ data: { imageUrl: string } }>(
        `/api/appointments/${appointment.id}/photos`,
        file,
        { serviceId },
      );
      // Si subió bien, añadimos la nueva foto al arreglo de fotos.
      // prev → el estado anterior. [...prev, nuevaFoto] crea un NUEVO arreglo
      // con todos los elementos anteriores más el nuevo al final.
      // (Nunca modificamos el arreglo directamente, siempre creamos uno nuevo.)
      setUploadedPhotos((prev) => [...prev, { serviceId, imageUrl: res.data.imageUrl }]);
    } catch (err: any) {
      console.error('Error uploading photo:', err);
      // ?. es optional chaining: accede a statusCode solo si err no es null/undefined
      const code = err?.statusCode ? ` [${err.statusCode}]` : '';
      const msg = err?.message || 'No se pudo subir la foto. Verifica el archivo e intenta de nuevo.';
      setUploadError(`${msg}${code}`); // Template literal que combina mensaje + código
    } finally {
      setUploadingFor(null); // siempre apagamos el spinner al terminar
    }
  };

  // openFilePicker: muestra el bottom sheet para elegir fuente de la foto.
  // Solo guarda el serviceId para el cual se quiere añadir la foto.
  function openFilePicker(serviceId: string) {
    setPhotoSourceFor(serviceId);
  }

  // pickFromCamera: el usuario eligió "Tomar foto" en el bottom sheet.
  // 1. Guardamos el serviceId en el ref (sincrónico, disponible al instante).
  // 2. Cerramos el bottom sheet (setPhotoSourceFor(null)).
  // 3. Disparamos el click en el input oculto con capture="environment"
  //    (en móvil, esto abre la cámara; en desktop, el explorador de archivos).
  function pickFromCamera() {
    const sid = photoSourceFor; // capturamos el valor antes de resetearlo
    setPhotoSourceFor(null);    // cerramos el bottom sheet
    if (!sid) return;
    pendingServiceIdRef.current = sid;     // guardamos en ref (sincrónico)
    cameraInputRef.current?.click();       // disparamos el input de cámara
    // ?.click() → solo llama a click() si cameraInputRef.current no es null
  }

  // pickFromGallery: el usuario eligió "Elegir de la galería".
  // Misma lógica que pickFromCamera pero con el input sin capture.
  function pickFromGallery() {
    const sid = photoSourceFor;
    setPhotoSourceFor(null);
    if (!sid) return;
    pendingServiceIdRef.current = sid;
    galleryInputRef.current?.click();
  }

  // confirmationToken: token único generado por el backend para el QR.
  // null = aún no se ha generado (antes del paso 'qr').
  // Una vez generado, se usa para construir la URL del QR.
  const [confirmationToken, setConfirmationToken] = useState<string | null>(null);

  // recordPaymentMutation: Paso 3 → registra el pago en el backend.
  // Envía: método de pago, monto de servicios+productos, propina y descuento.
  // onSuccess: si el registro fue bien → generamos el token del QR.
  // onError: si el error es 409 (ya fue registrado), también generamos el QR
  //          (el empleado puede haber hecho doble clic o vuelto atrás).
  const recordPaymentMutation = useMutation({
    mutationFn: () =>
      api.post(`/api/appointments/${appointment.id}/record-payment`, {
        paymentMethod,
        amount: subtotal,     // subtotal sin descuento (el backend lo recalcula)
        tipAmount: tip,       // propina
        discountAmount: discount, // descuento del cupón
      }),
    onSuccess: () => generateTokenMutation.mutate(), // encadenamos con el siguiente paso
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
    onSuccess: () => setStep('deferred'), // pasamos al paso alternativo de confirmación
  });

  // handleSubmitPayment: decide qué mutación ejecutar según el método de pago.
  // Si el empleado eligió "Pagar en recepción" (POS) → delegamos.
  // Si eligió otro método → registramos el pago directamente.
  function handleSubmitPayment() {
    if (paymentMethod === 'POS') {
      deferToPosMutation.mutate();
    } else {
      recordPaymentMutation.mutate();
    }
  }

  // generateTokenMutation: genera el token único para el QR de confirmación.
  // El cliente puede escanear este QR para ver el desglose y dejar reseña.
  // onSuccess: guardamos el token y avanzamos al paso 'qr'.
  // onError: si falla (ej: la BD no tiene la columna aún), saltamos al paso
  //          'done' directamente para no bloquear al empleado.
  const generateTokenMutation = useMutation({
    mutationFn: () =>
      api.post<{ data: { token: string; alreadyConfirmed: boolean } }>(
        `/api/appointments/${appointment.id}/generate-confirmation-token`,
        {},
      ),
    onSuccess: (res) => {
      setConfirmationToken(res.data.token); // guardamos el token para el QR
      setStep('qr');                        // avanzamos al paso del QR
    },
    onError: () => {
      // Si falla la generacion (BD aun sin la columna, p.ej.), saltamos al
      // step done con el flujo viejo sin QR para no bloquear al empleado.
      setStep('done');
    },
  });

  // showRebook: controla si se muestra el modal de "¿Agendar otra cita?"
  // Se activa al completar exitosamente la cita (paso final del wizard).
  const [showRebook, setShowRebook] = useState(false);

  // completeMutation: Paso 5 → marca la cita como COMPLETADA en el backend.
  // En vez de cerrar al instante, ofrecemos al empleado agendar otra cita
  // al mismo cliente (rebook). El modal lo decide.
  const completeMutation = useMutation({
    mutationFn: () =>
      api.post(`/api/appointments/${appointment.id}/complete`, {}),
    onSuccess: () => setShowRebook(true), // abre el modal de rebook en lugar de cerrar
  });

  // ─── CÁLCULO DE NAVEGACIÓN DEL WIZARD ────────────────────────────────
  // stepNumber: número del paso actual (1-5) para la barra de progreso.
  // Es un objeto literal donde la clave es el nombre del step y el valor
  // es su número. [step] al final accede al número usando el step actual.
  const stepNumber = { consent: 1, photos: 2, payment: 3, qr: 4, done: 5, deferred: 4 }[step];

  // totalSteps: si el cliente NO acepta fotos (consent=false), el paso 'photos'
  // se salta, así que el total de pasos visible es 4 en lugar de 5.
  const totalSteps = photoConsent === false ? 4 : 5;

  // URL que el cliente abre en su movil (QR + link copiable).
  // typeof window !== 'undefined' → verifica que estamos en el navegador
  // (no en el servidor durante SSR) antes de acceder a window.location.
  const confirmationUrl = confirmationToken
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/confirm-payment/${confirmationToken}`
    : '';

  // ─── JSX: INTERFAZ DEL WIZARD ────────────────────────────────────────────
  // El wizard es un modal (ventana flotante) que se superpone al contenido.
  return (
    // Fondo oscuro semitransparente que cubre toda la pantalla.
    // onClick={onClose} → si el usuario hace clic FUERA del modal, lo cierra.
    // fixed inset-0 → posición fija, cubre todo el viewport.
    // z-50 → nivel de apilamiento alto para que quede encima de todo.
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4"
      onClick={onClose}
    >
      {/* Modal blanco: contenedor del wizard.
          onClick={(e) => e.stopPropagation()} → EVITA que el clic dentro del
          modal se propague al div padre (que cerraría el modal). Sin esto,
          cualquier clic dentro del modal lo cerraría. */}
      <div
        className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ─── BARRA DE PROGRESO ─────────────────────────────────────────── */}
        {/* Fondo gris claro con la barra teal encima que crece conforme
            avanza el wizard. La anchura se calcula como porcentaje:
            (paso actual / total de pasos) * 100 = % completado. */}
        <div className="h-1 bg-gray-100">
          <div
            className="h-1 transition-all duration-300"
            // transition-all duration-300 → animación suave de 300ms al cambiar el ancho
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
                {/* Ternario: el mensaje cambia según si hay 1 o varios servicios.
                    Template literal con `...` permite insertar la constante directamente. */}
                {isSingleService
                  ? `Sube hasta ${MAX_PHOTOS_PER_SERVICE} fotos del resultado`
                  : `Sube hasta ${MAX_PHOTOS_PER_SERVICE} fotos por cada servicio`}
              </p>

              {/* Error de upload: solo se muestra si uploadError no es null */}
              {uploadError && (
                <div className="mb-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                  {uploadError}
                </div>
              )}

              {/* max-h-[50vh] + overflow-y-auto → si hay muchos servicios con fotos,
                  el área hace scroll internamente sin que el modal crezca de más. */}
              <div className="space-y-4 mb-4 max-h-[50vh] overflow-y-auto pr-1">
                {/* Iteramos sobre los servicios únicos de la cita.
                    svc → objeto del servicio actual.
                    svcIdx → índice del servicio en el arreglo (0, 1, 2...). */}
                {uniqueServices.map((svc, svcIdx) => {
                  // Fotos de ESTE servicio específico (filtramos por serviceId).
                  const photosForService = uploadedPhotos.filter((p) => p.serviceId === svc.serviceId);
                  // ¿Estamos subiendo una foto para ESTE servicio ahora mismo?
                  const isUploadingHere = uploadingFor === svc.serviceId;
                  return (
                    // key: si serviceId existe lo usamos, si no usamos el índice como fallback.
                    <div key={svc.serviceId || `svc-${svcIdx}`}>
                      {/* Encabezado de servicio (solo si hay 2 o más servicios).
                          !isSingleService → el operador ! niega el valor. */}
                      {!isSingleService && (
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-semibold text-gray-700 truncate">
                            {svc.serviceNameSnapshot}
                          </p>
                          {/* Contador de fotos: "2/3" */}
                          <span className="text-[10px] text-gray-400 flex-shrink-0">
                            {photosForService.length}/{MAX_PHOTOS_PER_SERVICE}
                          </span>
                        </div>
                      )}

                      {/* Grid de 3 columnas: las fotos ya subidas + el botón de añadir */}
                      <div className="grid grid-cols-3 gap-2">
                        {/* Iteramos sobre las fotos ya subidas de este servicio */}
                        {photosForService.map((photo, photoIdx) => (
                          <div key={photo.imageUrl || `photo-${svc.serviceId}-${photoIdx}`} className="aspect-square rounded-xl overflow-hidden bg-gray-100 relative">
                            {/* La imagen: API_URL + imageUrl relativa = URL completa */}
                            <img src={`${API_URL}${photo.imageUrl}`} alt="" className="w-full h-full object-cover" />
                            {/* Botón X para ELIMINAR esta foto del estado local.
                                prev.filter(...) crea un nuevo arreglo SIN la foto eliminada.
                                Nota: esto solo la elimina del estado, no del servidor. */}
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
                        {/* Celda de "Añadir foto": solo aparece si no se llegó al máximo.
                            photosForService.length < MAX_PHOTOS_PER_SERVICE → hay espacio. */}
                        {photosForService.length < MAX_PHOTOS_PER_SERVICE && (
                          <button
                            onClick={() => openFilePicker(svc.serviceId)}
                            disabled={isUploadingHere} // desactiva si ya estamos subiendo
                            className="aspect-square rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-1 hover:border-teal-400 transition-colors"
                          >
                            {/* Ternario: si está subiendo, muestra spinner; si no, muestra + */}
                            {isUploadingHere ? (
                              // Spinner de carga: círculo que gira (animate-spin).
                              // borderTopColor: 'transparent' → hace que gire visualmente.
                              <div className="w-5 h-5 rounded-full border-2 animate-spin" style={{ borderColor: TEAL, borderTopColor: 'transparent' }} />
                            ) : (
                              <>
                                {/* Ícono + (más) */}
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

              {/* ─── INPUTS DE ARCHIVO OCULTOS ──────────────────────────────
                  Dos inputs ocultos: uno fuerza la camara (capture), otro
                  permite elegir de la galeria. Mostramos un sheet antes para
                  que el usuario escoja la fuente. En desktop ambos abren el
                  dialogo del file system normal.
                  Son "ocultos" (className="hidden") porque se activan
                  programáticamente con .click() en pickFromCamera/pickFromGallery.
                  El usuario nunca los ve directamente. */}

              {/* Input de CÁMARA: capture="environment" → usa la cámara trasera en móvil */}
              <input
                ref={cameraInputRef}   // ref para poder llamar .click() programáticamente
                type="file"
                accept="image/*"       // solo acepta imágenes
                capture="environment"  // en móvil: abre la cámara en lugar del explorador
                className="hidden"
                onChange={(e) => {
                  // e.target.files?.[0] → el primer archivo seleccionado (o undefined)
                  const file = e.target.files?.[0];
                  // Leemos el serviceId del ref (está disponible sincrónicamente)
                  const sid = pendingServiceIdRef.current;
                  // Si tenemos archivo y serviceId, iniciamos la subida
                  if (file && sid) handleUploadPhoto(file, sid);
                  pendingServiceIdRef.current = null; // limpiamos el ref
                  e.target.value = ''; // reseteamos el input para poder seleccionar el mismo archivo otra vez
                }}
              />

              {/* Input de GALERÍA: sin capture → abre el explorador de archivos */}
              <input
                ref={galleryInputRef}
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

              {/* ── Desglose de cobro ── */}
              <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-2">
                {/* Línea por cada SERVICIO de la cita */}
                {appointment.items.map((item, i) => (
                  // key={`s-${i}`} → prefijo 's-' para distinguir de productos ('p-')
                  <div key={`s-${i}`} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">{item.serviceNameSnapshot}</span>
                    <span className="font-medium text-gray-900">{formatCurrency(Number(item.priceSnapshot))}</span>
                  </div>
                ))}
                {/* Línea por cada PRODUCTO reservado */}
                {products.map((p, i) => (
                  <div key={`p-${i}`} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">
                      {/* ?? → si el producto no tiene nombre, muestra "Producto" */}
                      {p.product?.name ?? 'Producto'}
                      {/* Solo muestra la cantidad si es más de 1 */}
                      {Number(p.quantity) > 1 ? ` ×${p.quantity}` : ''}
                    </span>
                    <span className="font-medium text-gray-900">
                      {formatCurrency(Number(p.unitPrice) * Number(p.quantity ?? 1))}
                    </span>
                  </div>
                ))}
                {/* Línea de descuento: solo si hay descuento > 0 */}
                {discount > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Descuento</span>
                    <span className="font-medium text-gray-700">−{formatCurrency(discount)}</span>
                  </div>
                )}
                {/* Línea de propina: solo si se seleccionó propina > 0 */}
                {tip > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Propina</span>
                    <span className="font-medium text-gray-700">+{formatCurrency(tip)}</span>
                  </div>
                )}
                {/* Total final con todo incluido */}
                <div className="border-t border-gray-200 pt-2 mt-2 flex items-center justify-between">
                  <span className="text-sm font-bold text-gray-900">Total</span>
                  <span className="text-base font-black" style={{ color: TEAL }}>{formatCurrency(total)}</span>
                </div>
              </div>

              {/* ── Selector de propina ─────────────────────────────────── */}
              {/* Propina (opcional) — calculada sobre el servicio */}
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Propina (opcional)</p>
              {/* 4 botones: Sin propina, 10%, 15%, 20% */}
              <div className="grid grid-cols-4 gap-2 mb-5">
                {/* Iteramos sobre los porcentajes disponibles */}
                {[0, 0.10, 0.15, 0.20].map((pct) => {
                  // Calculamos el monto en pesos de la propina.
                  // Math.round() redondea al entero más cercano.
                  // La propina se calcula sobre los SERVICIOS únicamente (no productos).
                  const amt = pct === 0 ? 0 : Math.round(servicesSubtotal * pct);
                  // active: true si este botón es el actualmente seleccionado.
                  const active = tip === amt;
                  return (
                    <button
                      key={pct}
                      // Al hacer clic, actualizamos el estado 'tip' con el monto calculado.
                      onClick={() => setTip(amt)}
                      className="py-2 rounded-xl border text-xs font-semibold transition-all"
                      // El estilo del botón cambia si está activo (seleccionado) o no.
                      // Usamos style en lugar de className porque los valores son dinámicos.
                      style={active
                        ? { borderColor: TEAL, backgroundColor: '#e0f2f1', color: TEAL }
                        : { borderColor: '#e5e7eb', color: '#6b7280' }
                      }
                    >
                      {/* pct === 0 muestra "Sin", los demás muestran "10%", "15%", "20%"
                          pct * 100 convierte 0.10 → 10 (para mostrar como porcentaje) */}
                      {pct === 0 ? 'Sin' : `${pct * 100}%`}
                    </button>
                  );
                })}
              </div>

              {/* ── Selector de método de pago ──────────────────────────── */}
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Método de pago</p>
              <div className="grid grid-cols-2 gap-2 mb-5">
                {/* PAYMENT_METHODS es el arreglo de métodos definido arriba del archivo.
                    m.key → identificador ('CASH', 'CARD', etc.)
                    m.label → texto visible ('Efectivo', 'Tarjeta', etc.)
                    m.icon → componente SVG del ícono */}
                {PAYMENT_METHODS.map((m) => (
                  <button
                    key={m.key}
                    onClick={() => setPaymentMethod(m.key)} // actualiza el método seleccionado
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all"
                    // Estilo activo/inactivo según si este método está seleccionado
                    style={paymentMethod === m.key
                      ? { borderColor: TEAL, backgroundColor: '#e0f2f1', color: TEAL }
                      : { borderColor: '#e5e7eb', color: '#6b7280' }
                    }
                  >
                    {m.icon}   {/* ícono SVG del método */}
                    {m.label}  {/* texto del método */}
                  </button>
                ))}
              </div>

              {/* ── Botón de confirmar pago ─────────────────────────────── */}
              {/* disabled cuando cualquiera de las dos mutaciones está en progreso */}
              <button
                onClick={handleSubmitPayment}
                disabled={recordPaymentMutation.isPending || deferToPosMutation.isPending}
                className="w-full py-3 rounded-xl text-sm font-bold text-white transition-colors disabled:opacity-50"
                style={{ backgroundColor: TEAL }}
              >
                {/* El texto del botón cambia según el método elegido y si está cargando:
                    POS + cargando → "Enviando..."
                    POS + listo   → "Enviar a recepción →"
                    Otro + cargando → "Registrando..."
                    Otro + listo  → "Pago realizado ✓" */}
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
                <svg className="w-8 h-8" style={{ color: TEAL }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">Enviado a recepción</h2>
              <p className="text-sm text-gray-500 mb-2">
                <span className="font-semibold">{appointment.client.firstName}</span> debe pasar a recepción a pagar.
              </p>
              <p className="text-xs text-gray-400 mb-6">
                La cita aparecerá en el punto de venta con la etiqueta <span className="font-semibold text-[#008080]">Por cobrar</span>. El cajero registrará el pago, mostrará la reseña y podrá agendar la siguiente cita.
              </p>
              <button
                onClick={() => {
                  // Notificar al padre que la cita quedo enviada a recepcion
                  // para que cierre el detalle Y deshabilite el boton "Cerrar
                  // cita". onDone se reusa pero con el flag awaitingReception.
                  onDone({ awaitingReception: true });
                }}
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

      {/* Bottom sheet: elegir origen de la foto (camara o galeria).
          Se muestra por encima del wizard pero por debajo del RebookModal. */}
      {photoSourceFor && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40"
          onClick={(e) => { e.stopPropagation(); setPhotoSourceFor(null); }}
        >
          <div
            className="bg-white w-full max-w-sm rounded-t-2xl p-4 pb-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
            <h3 className="text-sm font-semibold text-gray-900 text-center mb-3">
              Agregar foto
            </h3>
            <div className="space-y-2">
              <button
                onClick={pickFromCamera}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors text-left"
              >
                <span className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: '#e0f2f1', color: TEAL }}>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
                  </svg>
                </span>
                <span className="text-sm font-medium text-gray-900">Tomar foto</span>
              </button>
              <button
                onClick={pickFromGallery}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors text-left"
              >
                <span className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: '#e0f2f1', color: TEAL }}>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                  </svg>
                </span>
                <span className="text-sm font-medium text-gray-900">Elegir de la galería</span>
              </button>
              <button
                onClick={() => setPhotoSourceFor(null)}
                className="w-full py-3 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <RebookPromptModal
        show={showRebook}
        clientId={appointment.client.id}
        clientFirstName={appointment.client.firstName}
        onDismiss={() => { setShowRebook(false); onDone(); }}
      />
    </div>
  );
}
