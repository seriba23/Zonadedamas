// ============================================================
// ARCHIVO: use-websocket.ts
// PROPÓSITO: Establece una conexión WebSocket en tiempo real con el backend
//            para recibir notificaciones instantáneas de eventos importantes:
//            - Cuando un nuevo empleado se une al negocio
//            - Cuando se crea una nueva compra en el marketplace
//
// ¿QUÉ ES UN WEBSOCKET?
//   HTTP normal: el navegador pregunta → el servidor responde → fin.
//   WebSocket: el navegador y el servidor establecen una conexión PERMANENTE
//   y pueden enviarse mensajes en CUALQUIER momento (bidireccional).
//   Es como la diferencia entre enviar cartas (HTTP) y hablar por teléfono (WebSocket).
//
//   Aquí usamos Socket.IO, una librería que simplifica los WebSockets y
//   añade reconexión automática, fallback a polling HTTP si WebSocket falla, etc.
//
// ¿QUÉ ES useRef?
//   Guarda un valor que PERSISTE entre renders pero que NO provoca un re-render
//   cuando cambia. Se accede con .current.
//   Aquí lo usamos para guardar la instancia del socket, que no necesita
//   desencadenar renders directamente (los renders los provocan las notificaciones).
//
// EVENTOS QUE ESCUCHA:
//   - 'employee:joined': un empleado nuevo se unió al tenant
//   - 'purchase:created': una compra fue creada en el marketplace
//
// PATRÓN DE DISMISS (descartar):
//   Las notificaciones se acumulan en arrays de estado.
//   Cada una tiene un botón "descartar" que llama a dismissNotification/dismissPurchase
//   para quitarla del array.
// ============================================================

'use client';
// Solo corre en el navegador (WebSockets no existen en el servidor)

import { useEffect, useRef, useState, useCallback } from 'react';
// useEffect: para abrir/cerrar la conexión WebSocket al montar/desmontar
// useRef: guarda la instancia del socket sin provocar re-renders
// useState: guarda las notificaciones/compras recibidas (SÍ provocan re-renders)
// useCallback: memoriza funciones de dismiss para evitar recreaciones

import { io, Socket } from 'socket.io-client';
// io: función de Socket.IO para crear una conexión WebSocket
// Socket: tipo TypeScript para la instancia de la conexión

import { useAuth } from './use-auth';
// useAuth: necesitamos el tenantId del usuario para conectarnos
// al canal correcto (cada negocio tiene su propio canal WebSocket)

// URL del servidor WebSocket (la misma que el backend de la API)
// NEXT_PUBLIC_: variables de entorno públicas de Next.js (disponibles en el cliente)
const WS_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// ============================================================
// INTERFAZ: EmployeeJoinedEvent
// Forma del evento que llega cuando un empleado nuevo se une al negocio.
// ============================================================
export interface EmployeeJoinedEvent {
  id: string;           // ID del nuevo empleado
  firstName: string;    // Nombre
  lastName: string;     // Apellido
  email: string;        // Email
  jobTitle: string | null; // Cargo/título (puede ser null si no se especificó)
  services: string[];   // Array de IDs de servicios que puede realizar
}

// ============================================================
// INTERFAZ: PurchaseCreatedEvent
// Forma del evento que llega cuando se crea una nueva compra.
// ============================================================
export interface PurchaseCreatedEvent {
  id: string;               // ID de la compra
  customerName: string;     // Nombre del cliente
  customerEmail?: string | null; // Email (? = puede no estar en el evento)
  customerPhone: string;    // Teléfono del cliente
  fulfillmentType: string;  // Tipo: 'PICKUP', 'DELIVERY', 'DIGITAL', etc.
  paymentMethod: string;    // Método de pago: 'CASH', 'CARD', 'STRIPE', etc.
  items: Array<{            // Array de productos comprados
    productId: string;      // ID del producto
    productName: string;    // Nombre del producto
    productImage: string | null; // URL de la imagen (o null)
    quantity: number;       // Cantidad comprada
    unitPrice: number;      // Precio unitario
  }>;
  total: number;            // Total de la compra
  createdAt: string;        // Fecha/hora de la compra (ISO string)
}

// ============================================================
// HOOK: useWebSocket
// Establece la conexión WebSocket y gestiona las notificaciones en tiempo real.
//
// No recibe parámetros.
// Devuelve: { notifications, dismissNotification, purchases, dismissPurchase }
// ============================================================
export function useWebSocket() {
  const { user, isAuthenticated } = useAuth();
  // user: necesitamos user.tenantId para conectarnos al canal correcto
  // isAuthenticated: solo conectamos si hay sesión activa

  // useRef<Socket | null>(null): guarda la instancia del socket.
  // null = sin conexión activa todavía.
  // .current accede al valor actual del ref.
  // Los refs NO provocan re-renders al cambiar (a diferencia de useState).
  const socketRef = useRef<Socket | null>(null);

  // notifications: array de eventos de empleado nuevo.
  // Empieza vacío. Se va llenando con eventos en tiempo real.
  const [notifications, setNotifications] = useState<EmployeeJoinedEvent[]>([]);

  // purchases: array de eventos de compra creada.
  const [purchases, setPurchases] = useState<PurchaseCreatedEvent[]>([]);

  // ============================================================
  // dismissNotification: quita una notificación específica de la lista.
  //
  // Recibe: employeeId (el ID del empleado cuya notificación descartar)
  //
  // .filter((n) => n.id !== employeeId):
  //   Crea un nuevo array con todos los elementos EXCEPTO el que tiene
  //   el ID especificado. "n" = cada notificación en el array.
  //   !== es "diferente de" (comparación estricta)
  //
  // setNotifications(prev => ...):
  //   Forma funcional de setNotifications. "prev" = el valor actual del estado.
  //   React garantiza que "prev" es el valor más reciente (evita bugs de stale closures).
  // ============================================================
  const dismissNotification = useCallback((employeeId: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== employeeId));
    // prev: array actual de notificaciones
    // .filter(...): crea nuevo array sin la notificación del empleado especificado
    // "n" es la variable iteradora: cada notificación en el array prev
  }, []); // [] = sin dependencias, la función nunca se recrea

  // dismissPurchase: quita una compra específica de la lista.
  // Mismo patrón que dismissNotification pero para purchases.
  const dismissPurchase = useCallback((purchaseId: string) => {
    setPurchases((prev) => prev.filter((p) => p.id !== purchaseId));
    // "p" es la variable iteradora: cada compra en el array prev
  }, []);

  // ============================================================
  // useEffect: abre la conexión WebSocket al montar el componente
  // y la cierra al desmontarlo (limpieza).
  //
  // Dependencias: [isAuthenticated, user?.tenantId]
  //   Se re-ejecuta cuando cambia isAuthenticated o el tenantId.
  //   Así, si el usuario inicia sesión, abre la conexión.
  //   Si cierra sesión, la cierra.
  // ============================================================
  useEffect(() => {
    // Solo conectamos si el usuario está logueado y tiene un tenantId
    if (!isAuthenticated || !user?.tenantId) return;
    // user?.tenantId: operador ?. (optional chaining) — si user es null, no lanza error,
    // devuelve undefined, y la condición !undefined = true → no conectamos

    // Creamos la conexión WebSocket con Socket.IO
    const socket = io(WS_URL, {
      query: { tenantId: user.tenantId },
      // query: parámetros que se envían al servidor al conectar.
      // El backend usa tenantId para colocar este socket en el "room" correcto,
      // así que solo recibirá eventos de su propio negocio.

      transports: ['websocket', 'polling'],
      // transports: protocolos de conexión a intentar, en orden de preferencia.
      // 1. 'websocket': conexión WebSocket nativa (más eficiente)
      // 2. 'polling': fallback HTTP si WebSocket no está disponible
      //    (ej: en algunos proxies o NGINX sin configuración WebSocket)

      // Si el WS falla (p.ej. NGINX sin upgrade headers), no spam la consola
      // intentando reconectar cada segundo. 3 intentos con backoff, luego deja
      // de intentar hasta el proximo mount. Las notificaciones en tiempo real
      // (employee.joined, purchase.created) son nice-to-have, no criticas.
      reconnection: true,           // Intentar reconectar si se pierde la conexión
      reconnectionAttempts: 3,      // Máximo 3 intentos de reconexión
      reconnectionDelay: 5000,      // Esperar 5 segundos antes del primer reintento
      reconnectionDelayMax: 30000,  // Máximo 30 segundos entre reintentos (backoff exponencial)
      timeout: 8000,                // Tiempo máximo (8 seg) para establecer la conexión inicial
    });

    // 'connect_error': evento que dispara Socket.IO cuando no puede conectar.
    // Callback vacío = silenciamos el error de la consola.
    // Sin esto, Socket.IO mostraría un error en la consola de cada reintento fallido,
    // lo que sería confuso para el desarrollador.
    socket.on('connect_error', () => {
      // Silenciar logs. Socket.io ya intenta reconectar segun config.
    });

    // ============================================================
    // EVENTO: 'employee:joined'
    // El servidor emite este evento cuando un empleado nuevo se une al negocio.
    // Nosotros lo escuchamos y agregamos la notificación al array de estado.
    //
    // socket.on(evento, callback): registra un listener para un evento.
    // data: el objeto EmployeeJoinedEvent que envió el servidor.
    // ============================================================
    socket.on('employee:joined', (data: EmployeeJoinedEvent) => {
      // setNotifications(prev => [...prev, data]):
      //   Agrega la nueva notificación al final del array.
      //   [...prev] = copia del array anterior (spread operator)
      //   , data = el nuevo elemento al final
      //   React requiere arrays NUEVOS (no mutar el existente) para detectar cambios.
      setNotifications((prev) => [...prev, data]);
    });

    // ============================================================
    // EVENTO: 'purchase:created'
    // El servidor emite este evento cuando alguien hace una compra.
    // ============================================================
    socket.on('purchase:created', (data: PurchaseCreatedEvent) => {
      setPurchases((prev) => [...prev, data]); // Agrega la compra al array
    });

    // Guardamos la instancia del socket en el ref para poder acceder a ella
    // desde otras partes del hook si fuera necesario.
    socketRef.current = socket;

    // ============================================================
    // FUNCIÓN DE LIMPIEZA (cleanup):
    // React llama esta función cuando:
    //   1. El componente se desmonta (el usuario navega a otra página)
    //   2. Antes de re-ejecutar el efecto (si cambian las dependencias)
    //
    // Desconectamos el socket para liberar recursos y no dejar conexiones "zombie".
    // ============================================================
    return () => {
      socket.disconnect(); // Cierra la conexión WebSocket limpiamente
      socketRef.current = null; // Limpiamos la referencia
    };
  }, [isAuthenticated, user?.tenantId]);
  // Dependencias del efecto:
  // - isAuthenticated: si cambia (login/logout), re-ejecuta el efecto
  // - user?.tenantId: si el usuario cambia de tenant, reconecta al nuevo canal

  // Lo que devuelve el hook a quien lo use
  return {
    notifications,         // Array de eventos EmployeeJoinedEvent pendientes de descartar
    dismissNotification,   // Función para quitar una notificación de empleado
    purchases,             // Array de eventos PurchaseCreatedEvent pendientes de descartar
    dismissPurchase,       // Función para quitar una notificación de compra
  };
}
