// ─────────────────────────────────────────────────────────────────────────────
// ClientDrawer — panel lateral (drawer) para ver/crear/editar un cliente.
//
// CONCEPTOS DE REACT QUE USA ESTE ARCHIVO:
// - useState  → memoria local (pestaña activa, modo edición, formulario...).
// - useEffect → ejecuta código como reacción a cambios (aquí: rellenar el
//               formulario cuando llegan los datos del cliente).
// - react-query (useQuery / useMutation / useQueryClient):
//     * useQuery       = LEER datos del servidor (GET). Devuelve { data, isLoading... }.
//     * useMutation    = ESCRIBIR datos (POST/PUT/DELETE). Devuelve .mutate() y .isPending.
//     * useQueryClient = controlador del cache; sirve para "invalidar" (refrescar)
//       consultas tras guardar, para que la UI muestre datos nuevos.
// - `enabled` en useQuery: la consulta solo se lanza cuando esa condición es true
//   (así no pedimos las citas hasta que el usuario abra esa pestaña).
// ─────────────────────────────────────────────────────────────────────────────

'use client';

// useState (memoria) y useEffect (efectos secundarios) de React.
import { useState, useEffect } from 'react';
// Hooks de react-query para leer/escribir datos del servidor y manejar el cache.
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
// `api`: cliente HTTP propio (api.get, api.post, api.put...).
import { api } from '@/lib/api';
// Modal estándar de "guardado" (un único modal centrado para toda la app).
import { showSaveSuccess } from '@/lib/save-toast';
// Drawer: el contenedor visual del panel lateral.
import { Drawer } from '@/components/ui/drawer';
// Insignia de color según el estado de la cita (pendiente, confirmada...).
import { AppointmentStatusBadge } from '@/components/ui/badge';
// Funciones utilitarias de formato (fecha, dinero, hora).
import { formatDate, formatCurrency, formatTime } from '@/lib/utils';
// Convierte el "tiempo de reserva" guardado al formato de hora que mostramos.
import { formatBookingTime } from '@/lib/booking-time';
import { buildClaimMessage, buildWhatsAppUrl } from '@/lib/whatsapp';
import { useAuth } from '@/lib/hooks/use-auth';

// URL base de la API (o localhost si no está definida la variable de entorno).
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Forma de los datos de un cliente que devuelve la API.
interface Client {
  id: string;                 // Id único del cliente.
  firstName: string;          // Nombre.
  lastName: string;           // Apellido.
  email?: string;             // Correo (opcional).
  phone?: string;             // Teléfono (opcional).
  notes?: string;             // Notas libres (opcional).
  allergies?: string | null;  // Alergias / notas médicas (se ven en sus citas).
  emergencyContactName?: string | null;
  emergencyContactLastName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelation?: string | null;
  avatarUrl?: string | null;  // Ruta de su foto (puede no tener: null/undefined).
  userId?: string | null;     // Cuenta real de la plataforma vinculada (null = walk-in).
  // tags = etiquetas de colores. Array<{...}> describe una lista de objetos.
  tags?: Array<{ id: string; name: string; color: string }>;
  createdAt: string;          // Fecha de alta del cliente.
}

// Forma de una cita en la pestaña "Citas".
interface Appointment {
  id: string;
  startTime: string;          // Fecha/hora de inicio.
  status: string;             // Estado (pending, confirmed, completed...).
  // items = servicios de la cita con datos "congelados" (snapshot) al reservar.
  items?: Array<{ serviceNameSnapshot: string; priceSnapshot: number; durationSnapshot: number }>;
}

// Forma de un pago en la pestaña "Pagos".
interface Payment {
  id: string;
  amount: number;    // Importe.
  method: string;    // Método (efectivo, tarjeta...).
  createdAt: string; // Fecha del pago.
  status: string;    // Estado del pago.
}

// `type Tab` limita los valores posibles de la pestaña activa a estos 3 textos.
type Tab = 'details' | 'appointments' | 'payments';

// Props del drawer: qué cliente abrir (o null para "nuevo") y cómo cerrarlo.
interface ClientDrawerProps {
  clientId: string | null; // null = estamos creando un cliente nuevo.
  onClose: () => void;     // Función para cerrar el panel (la da el padre).
}

export function ClientDrawer({ clientId, onClose }: ClientDrawerProps) {
  // Controlador del cache de react-query (para refrescar listas tras guardar).
  const queryClient = useQueryClient();
  const { user } = useAuth();
  // inviting: mientras se genera el token y se abre WhatsApp para invitar.
  const [inviting, setInviting] = useState(false);
  // Pestaña activa. Empieza en 'details'. <Tab> tipa el estado a los 3 valores.
  const [activeTab, setActiveTab] = useState<Tab>('details');
  // ¿Modo edición? Si NO hay clientId (creando uno nuevo) arranca en edición.
  // El `!clientId` convierte "null/'' " en true y un id real en false.
  const [isEditing, setIsEditing] = useState(!clientId);
  // Estado del formulario: un objeto con todos los campos editables a la vez.
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    notes: '',
    allergies: '',
    emergencyContactName: '',
    emergencyContactLastName: '',
    emergencyContactPhone: '',
    emergencyContactRelation: '',
  });
  // Mensaje de error al guardar (null = sin error).
  const [saveError, setSaveError] = useState<string | null>(null);

  // useQuery #1: trae los datos del cliente seleccionado.
  // - queryKey: identificador del cache; si cambia clientId, react-query
  //   considera que es OTRA consulta y vuelve a pedir.
  // - queryFn: la función que realmente llama a la API.
  // - enabled: solo se ejecuta si hay clientId (!! convierte a booleano).
  const { data: clientData, isLoading } = useQuery({
    queryKey: ['client', clientId],
    queryFn: () => api.get<{ data: Client }>(`/api/clients/${clientId}`),
    enabled: !!clientId,
  });

  // useEffect: se ejecuta cada vez que cambia `clientData`. Cuando llegan los
  // datos del cliente, copiamos sus campos al formulario para poder editarlos.
  // Los `|| ''` evitan poner `undefined` en inputs (React se queja de eso).
  useEffect(() => {
    if (clientData?.data) {
      const c = clientData.data; // alias corto para escribir menos.
      setForm({
        firstName: c.firstName,
        lastName: c.lastName,
        email: c.email || '',
        phone: c.phone || '',
        notes: c.notes || '',
        allergies: c.allergies || '',
        emergencyContactName: c.emergencyContactName || '',
        emergencyContactLastName: c.emergencyContactLastName || '',
        emergencyContactPhone: c.emergencyContactPhone || '',
        emergencyContactRelation: c.emergencyContactRelation || '',
      });
    }
  }, [clientData]); // <- "lista de dependencias": re-ejecuta si esto cambia.

  // useQuery #2: citas del cliente. Solo se pide si hay clientId Y la pestaña
  // activa es 'appointments' (así no malgastamos peticiones).
  const { data: appointmentsData } = useQuery({
    queryKey: ['client-appointments', clientId],
    queryFn: () =>
      api.get<{ data: Appointment[] }>(
        `/api/appointments?clientId=${clientId}&perPage=20`,
      ),
    enabled: !!clientId && activeTab === 'appointments',
  });

  // useQuery #3: pagos del cliente. Igual que el anterior pero para 'payments'.
  const { data: paymentsData } = useQuery({
    queryKey: ['client-payments', clientId],
    queryFn: () =>
      api.get<{ data: Payment[] }>(`/api/payments?clientId=${clientId}`),
    enabled: !!clientId && activeTab === 'payments',
  });

  // useMutation: GUARDAR el cliente (crear o actualizar).
  const saveMutation = useMutation({
    // mutationFn decide el método según haya o no clientId:
    //   - con id  → api.put  (editar uno existente).
    //   - sin id  → api.post (crear uno nuevo).
    // `typeof form` significa "el mismo tipo que el objeto form".
    mutationFn: (payload: typeof form) => {
      if (clientId) {
        return api.put(`/api/clients/${clientId}`, payload);
      }
      return api.post('/api/clients', payload);
    },
    // onSuccess corre si el guardado salió bien:
    onSuccess: () => {
      // Invalidamos las consultas afectadas para que se vuelvan a pedir frescas.
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['client', clientId] });
      setIsEditing(false); // Salimos del modo edición.
      setSaveError(null);  // Limpiamos cualquier error previo.
      showSaveSuccess();   // Modal estándar de confirmación de guardado.
      if (!clientId) onClose(); // Si era un cliente nuevo, cerramos el drawer.
    },
    // onError corre si la API devolvió error: mostramos su mensaje.
    onError: (err: { message?: string }) => {
      setSaveError(err.message || 'Error al guardar el cliente');
    },
  });

  // Atajos de lectura. El `?.` (optional chaining) evita romper si data es
  // undefined; el `|| []` deja una lista vacía como respaldo si no hay datos.
  const client = clientData?.data;
  const appointments = appointmentsData?.data || [];
  const payments = paymentsData?.data || [];

  // handleInvite: genera el token de reclamo y abre WhatsApp con el enlace para
  // que el cliente active/vincule su cuenta real de la plataforma.
  async function handleInvite() {
    if (!client?.id || !client.phone || inviting) return;
    setInviting(true);
    try {
      const res = await api.post<{ data: { token: string } }>(`/api/clients/${client.id}/claim-token`, {});
      const msg = buildClaimMessage({
        clientFirstName: client.firstName,
        tenantName: (user as any)?.tenantName || 'nuestro negocio',
        token: res.data.token,
      });
      const url = buildWhatsAppUrl(client.phone, msg);
      if (url) window.open(url, '_blank');
      else alert('El teléfono del cliente no es válido para WhatsApp.');
    } catch (err: any) {
      alert(err?.response?.data?.message || err?.message || 'No se pudo generar la invitación.');
    } finally {
      setInviting(false);
    }
  }

  // Título del drawer con ternarios anidados:
  //   - Si hay clientId:
  //       - y ya cargó el cliente → su nombre completo.
  //       - si no → 'Cargando...'.
  //   - Si no hay clientId → 'Nuevo Cliente'.
  const title = clientId
    ? client
      ? `${client.firstName} ${client.lastName}`
      : 'Cargando...'
    : 'Nuevo Cliente';

  // Pestañas a mostrar: con clientId hay 3 (detalles/citas/pagos); sin él
  // (cliente nuevo) solo tiene sentido la de detalles.
  const tabs: { id: Tab; label: string }[] = clientId
    ? [
        { id: 'details', label: 'Detalles' },
        { id: 'appointments', label: 'Citas' },
        { id: 'payments', label: 'Pagos' },
      ]
    : [{ id: 'details', label: 'Detalles' }];

  return (
    // Drawer es el contenedor lateral; le pasamos el título, el cierre y ancho.
    <Drawer title={title} onClose={onClose} width="md">
      {/* Pestañas: solo se muestran al ver un cliente existente (clientId &&). */}
      {clientId && (
        <div className="flex border-b border-gray-200 px-6">
          {/* .map recorre el array `tabs` y por cada una genera un <button>.
              `key={tab.id}` es OBLIGATORIO en listas: ayuda a React a saber qué
              elemento es cuál cuando la lista cambia. */}
          {tabs.map((tab) => (
            <button
              key={tab.id}
              // Al hacer clic, cambiamos la pestaña activa a la de este botón.
              onClick={() => setActiveTab(tab.id)}
              // className dinámico: la pestaña activa se subraya en teal; las
              // demás quedan grises. El ternario elige el bloque de clases.
              className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === tab.id
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      <div className="p-6">
        {/* PESTAÑA DETALLES — solo si activeTab es 'details'. */}
        {activeTab === 'details' && (
          <div>
            {/* Tres casos encadenados con ternarios:
                1) isLoading → mostrar "esqueletos" (cajas grises animadas).
                2) isEditing o cliente nuevo → mostrar el formulario.
                3) si no → mostrar la ficha de solo lectura. */}
            {isLoading ? (
              <div className="space-y-4">
                {/* Array.from({length:4}) crea un array de 4 huecos; lo recorremos
                    con .map para pintar 4 placeholders. `_` = elemento ignorado,
                    `i` = índice usado como key. */}
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : isEditing || !clientId ? (
              // FORMULARIO de creación/edición.
              <form
                onSubmit={(e) => {
                  // e.preventDefault() evita que el navegador recargue la página
                  // al enviar el formulario (comportamiento HTML por defecto).
                  e.preventDefault();
                  // Lanzamos la mutación de guardado con los datos del formulario.
                  saveMutation.mutate(form);
                }}
                className="space-y-4"
              >
                {/* Banner de error: solo aparece si saveError tiene texto. */}
                {saveError && (
                  <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">
                    {saveError}
                  </div>
                )}
                {/* Nombre y apellido en dos columnas (grid grid-cols-2). */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nombre *
                    </label>
                    {/* Input "controlado": su `value` viene del estado y su
                        onChange actualiza el estado. Así React es la única
                        fuente de verdad del texto escrito.
                        setForm((f) => ({ ...f, firstName: ... })) copia TODO el
                        objeto previo (...f) y solo cambia el campo firstName. */}
                    <input
                      type="text"
                      value={form.firstName}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, firstName: e.target.value }))
                      }
                      className="input-field"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Apellido *
                    </label>
                    <input
                      type="text"
                      value={form.lastName}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, lastName: e.target.value }))
                      }
                      className="input-field"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, email: e.target.value }))
                    }
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, phone: e.target.value }))
                    }
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notas
                  </label>
                  <textarea
                    value={form.notes}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, notes: e.target.value }))
                    }
                    className="input-field resize-none"
                    rows={3}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Alergias <span className="text-[10px] text-gray-400 font-normal">(se muestran en sus citas)</span>
                  </label>
                  <textarea
                    value={form.allergies}
                    onChange={(e) => setForm((f) => ({ ...f, allergies: e.target.value }))}
                    className="input-field resize-none"
                    rows={2}
                    placeholder="Ej: Penicilina, látex…"
                  />
                </div>
                {/* Contacto de emergencia */}
                <div className="pt-1 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-3 mb-2">Contacto de emergencia</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                      <input type="text" value={form.emergencyContactName} onChange={(e) => setForm((f) => ({ ...f, emergencyContactName: e.target.value }))} className="input-field" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Apellido</label>
                      <input type="text" value={form.emergencyContactLastName} onChange={(e) => setForm((f) => ({ ...f, emergencyContactLastName: e.target.value }))} className="input-field" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                      <input type="tel" value={form.emergencyContactPhone} onChange={(e) => setForm((f) => ({ ...f, emergencyContactPhone: e.target.value }))} className="input-field" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Relación</label>
                      <input type="text" value={form.emergencyContactRelation} onChange={(e) => setForm((f) => ({ ...f, emergencyContactRelation: e.target.value }))} className="input-field" placeholder="Ej: Madre, Esposo/a" />
                    </div>
                  </div>
                </div>
                <div className="flex gap-3">
                  {/* Botón "Cancelar" solo al EDITAR uno existente (no al crear). */}
                  {clientId && (
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="btn-secondary flex-1"
                    >
                      Cancelar
                    </button>
                  )}
                  {/* type="submit" dispara el onSubmit del <form> de arriba.
                      Se deshabilita mientras la mutación está en curso
                      (isPending) para evitar doble envío. El texto cambia a
                      "Guardando..." durante ese tiempo. */}
                  <button
                    type="submit"
                    disabled={saveMutation.isPending}
                    className="btn-primary flex-1"
                  >
                    {saveMutation.isPending ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </form>
            ) : (
              // FICHA DE SOLO LECTURA (cuando no estamos editando).
              // `client && (...)` evita pintar nada si client aún no llegó.
              client && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {/* Avatar: si el cliente tiene foto (avatarUrl) se muestra
                          la imagen; si no, se muestran sus iniciales como
                          respaldo. charAt(0) toma la primera letra de cada nombre. */}
                      <div className="w-16 h-16 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xl font-bold overflow-hidden">
                        {client.avatarUrl ? (
                          <img src={`${API_URL}${client.avatarUrl}`} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <>{client.firstName.charAt(0)}{client.lastName.charAt(0)}</>
                        )}
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {client.firstName} {client.lastName}
                        </h3>
                        <p className="text-sm text-gray-500">
                          Cliente desde {formatDate(client.createdAt)}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setIsEditing(true)}
                      className="btn-secondary text-sm"
                    >
                      Editar
                    </button>
                  </div>

                  <div className="space-y-3 pt-2">
                    {client.email && (
                      <div className="flex items-center gap-3">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        <span className="text-sm text-gray-700">{client.email}</span>
                      </div>
                    )}
                    {client.phone && (
                      <div className="flex items-center gap-3">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        <span className="text-sm text-gray-700">{client.phone}</span>
                      </div>
                    )}

                    {/* Vinculación con la cuenta real de la plataforma. */}
                    {client.userId ? (
                      <div className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: '#e4f5ee', color: '#0a7d54' }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#12a86e' }} />
                        Cuenta de la plataforma vinculada
                      </div>
                    ) : client.phone ? (
                      <button
                        onClick={handleInvite}
                        disabled={inviting}
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-opacity"
                        style={{ backgroundColor: '#25D366' }}
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" /></svg>
                        {inviting ? 'Generando…' : 'Invitar por WhatsApp'}
                      </button>
                    ) : null}
                  </div>

                  {/* Etiquetas (tags): solo si la lista existe y tiene elementos. */}
                  {client.tags && client.tags.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                        Tags
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {/* Una "pastilla" coloreada por cada tag. tag.color + '20'
                            añade '20' al hex = ~12% de opacidad para el fondo,
                            dejando el texto en el color pleno. */}
                        {client.tags.map((tag) => (
                          <span
                            key={tag.id}
                            className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
                            style={{
                              backgroundColor: tag.color + '20',
                              color: tag.color,
                            }}
                          >
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {client.notes && (
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                        Notas
                      </p>
                      <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
                        {client.notes}
                      </p>
                    </div>
                  )}

                  {client.allergies && (
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                        Alergias
                      </p>
                      <p className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg p-3">
                        {client.allergies}
                      </p>
                    </div>
                  )}

                  {(client.emergencyContactName || client.emergencyContactPhone) && (
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                        Contacto de emergencia
                      </p>
                      <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 space-y-0.5">
                        {(client.emergencyContactName || client.emergencyContactLastName) && (
                          <p className="font-medium text-gray-900">{[client.emergencyContactName, client.emergencyContactLastName].filter(Boolean).join(' ')}</p>
                        )}
                        {client.emergencyContactRelation && <p className="text-xs text-gray-500">{client.emergencyContactRelation}</p>}
                        {client.emergencyContactPhone && <p>{client.emergencyContactPhone}</p>}
                      </div>
                    </div>
                  )}
                </div>
              )
            )}
          </div>
        )}

        {/* PESTAÑA CITAS */}
        {activeTab === 'appointments' && (
          <div className="space-y-3">
            {/* Si la lista está vacía → mensaje; si no → recorremos las citas. */}
            {appointments.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">
                No hay citas registradas
              </p>
            ) : (
              // .map crea una tarjeta por cita (apt = cada cita del array).
              appointments.map((apt) => (
                <div
                  key={apt.id}
                  className="p-4 bg-gray-50 rounded-xl border border-gray-100"
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-gray-900">
                      {formatDate(apt.startTime)},{' '}
                      {formatTime(formatBookingTime(apt.startTime))}
                    </p>
                    <AppointmentStatusBadge status={apt.status.toLowerCase()} />
                  </div>
                  {/* Lista de servicios de la cita, separados por coma:
                      - .map saca el nombre de cada item.
                      - .filter(Boolean) descarta nombres vacíos/undefined
                        (Boolean como función convierte cada valor a true/false).
                      - .join(', ') los une en un solo texto. */}
                  {apt.items && apt.items.length > 0 && (
                    <p className="text-xs text-gray-500">
                      {apt.items
                        .map((i) => i.serviceNameSnapshot)
                        .filter(Boolean)
                        .join(', ')}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* PESTAÑA PAGOS */}
        {activeTab === 'payments' && (
          <div className="space-y-3">
            {/* Vacío → mensaje; si no → una tarjeta por pago. */}
            {payments.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">
                No hay pagos registrados
              </p>
            ) : (
              payments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {formatCurrency(payment.amount)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {payment.method} · {formatDate(payment.createdAt)}
                    </p>
                  </div>
                  {/* Insignia de estado: verde si el pago está COMPLETADO,
                      gris en cualquier otro caso. El texto muestra "Pagado"
                      cuando está completado, o el estado crudo si no. */}
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded-full ${
                      payment.status === 'COMPLETED'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {payment.status === 'COMPLETED' ? 'Pagado' : payment.status}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </Drawer>
  );
}
