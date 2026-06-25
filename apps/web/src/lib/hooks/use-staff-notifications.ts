// ============================================================
// ARCHIVO: use-staff-notifications.ts
// PROPÓSITO: Gestiona las notificaciones del personal (empleados y dueños
//            del negocio) dentro del dashboard.
//
//            Exporta CINCO hooks especializados:
//            1. useUnreadCounts()           → Badge con conteo de no leídos
//            2. useNotificationsList()      → Lista paginada de notificaciones
//            3. useMarkRead()               → Marcar una notificación como leída
//            4. useMarkAllRead()            → Marcar todas como leídas
//            5. useEnsurePushSubscription() → Registrar notificaciones push del SO
//
// ¿QUÉ SON LAS NOTIFICACIONES PUSH?
//   Son alertas que llegan al dispositivo del usuario aunque no tenga el
//   navegador abierto, como las notificaciones de WhatsApp en el teléfono.
//   Requieren un "service worker" (script que corre en segundo plano).
//
// ¿QUÉ ES useMutation (react-query)?
//   Similar a useQuery pero para operaciones que MODIFICAN datos (POST, PUT, DELETE).
//   useQuery = leer datos (GET)
//   useMutation = escribir/modificar datos (POST, PUT, PATCH, DELETE)
//   Tiene: mutationFn (la operación) + onSuccess (qué hacer si funciona)
//
// ¿QUÉ ES useQueryClient?
//   Es el "administrador de caché" de react-query. Con él podemos:
//   - invalidateQueries: marcar caché como desactualizado para que se recargue
//   - setQueryData: actualizar el caché manualmente sin ir al servidor
// ============================================================

'use client';
// Solo corre en el navegador

import { useEffect } from 'react';
// useEffect: para efectos secundarios (aquí para registrar el push en el montaje)

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
// useQuery: consultas que leen datos (con caché)
// useMutation: operaciones que modifican datos (POST/PUT)
// useQueryClient: accede al gestor de caché de react-query

import { api } from '../api';
// api: cliente HTTP para el backend (rutas del dashboard)

import { useAuth } from './use-auth';
// useAuth: necesitamos saber si el usuario está autenticado para
// no hacer consultas cuando no hay sesión activa

import {
  pushSupported,        // Verifica si el navegador soporta notificaciones push
  pushPermission,       // Devuelve el estado del permiso: 'granted', 'denied', 'default'
  registerServiceWorker,  // Registra el Service Worker en el navegador
  subscribePushOnServer,  // Envía la suscripción push al servidor backend
} from '../push';
// Funciones del módulo de notificaciones push

// ============================================================
// INTERFAZ: StaffNotification
// Describe la forma de un objeto notificación del personal.
// Los campos con | null pueden ser null si no aplican al tipo de notificación.
// ============================================================
export interface StaffNotification {
  id: string;               // ID único de la notificación (UUID)
  tenantId: string;         // ID del negocio al que pertenece la notificación
  userId: string;           // ID del usuario al que va dirigida
  type: string;             // Tipo: 'appointment.new', 'payment.received', etc.
  section: string;          // Sección del dashboard: 'appointments', 'staff', etc.
  title: string;            // Título de la notificación (se muestra en el badge)
  body: string;             // Mensaje completo de la notificación
  link: string | null;      // URL a la que navegar al hacer clic (o null si no hay)
  entityType: string | null; // Tipo de entidad relacionada: 'appointment', 'employee', etc.
  entityId: string | null;  // ID de la entidad relacionada (para navegar al detalle)
  readAt: string | null;    // Fecha de lectura (null = no leída todavía)
  createdAt: string;        // Fecha de creación de la notificación
}

// ============================================================
// INTERFAZ: UnreadCounts
// Describe la respuesta del endpoint de conteo de no leídos.
// ============================================================
export interface UnreadCounts {
  counts: Record<string, number>; // Conteo por sección: { "appointments": 3, "staff": 1 }
                                  // Record<string, number> = objeto clave(string)->valor(número)
  total: number;                  // Total de notificaciones no leídas (para el badge del topbar)
}

// ============================================================
// HOOK: useUnreadCounts
// Consulta cuántas notificaciones no leídas tiene el usuario,
// y lo actualiza automáticamente cada 30 segundos (polling).
//
// No recibe parámetros.
// Devuelve: lo que devuelve useQuery con datos de tipo UnreadCounts
//           (data, isLoading, error, etc.)
//
// POLLING: en lugar de WebSockets para los conteos, usamos polling
// simple: cada 30 segundos preguntamos al servidor cuántas hay.
// ============================================================

/**
 * Polea los counts no leidos cada 30 segundos. Sirve de fuente unica de
 * verdad para los badges del sidebar y el bell del topbar.
 */
export function useUnreadCounts() {
  const { isAuthenticated } = useAuth();
  // isAuthenticated: solo hacemos consultas si el usuario está logueado

  return useQuery<UnreadCounts>({
    queryKey: ['staff-notifications', 'unread-counts'],
    // Array como clave: react-query la serializa para identificar la caché.
    // ['staff-notifications', 'unread-counts'] es único para este endpoint.

    queryFn: async () => {
      // Llamamos al endpoint que devuelve los conteos de no leídos
      const res = await api.get<{ data: UnreadCounts }>(
        '/api/staff-notifications/unread-counts',
      );
      return res.data; // Extraemos el objeto UnreadCounts de la envoltura { data: ... }
    },
    enabled: isAuthenticated,
    // enabled: false = no hace la consulta. Si el usuario no está logueado,
    // no tiene sentido pedir notificaciones.

    refetchInterval: 30_000,
    // refetchInterval: vuelve a consultar automáticamente cada 30.000 ms (30 seg).
    // 30_000: el guión bajo es un separador visual en números grandes de JavaScript.
    // Es lo mismo que escribir 30000, pero más legible.

    staleTime: 15_000,
    // staleTime: considera los datos "frescos" por 15 segundos.
    // Si otro componente solicita esta query en ese tiempo, usa el caché.
  });
}

// ============================================================
// HOOK: useNotificationsList
// Obtiene la lista paginada de notificaciones del usuario,
// con filtros opcionales.
//
// Recibe: filters (objeto opcional) con:
//   - page: número de página (paginación)
//   - perPage: notificaciones por página
//   - section: filtrar por sección ('appointments', 'staff', etc.)
//   - unreadOnly: si true, solo devuelve las no leídas
//
// Devuelve: lo que devuelve useQuery con la lista de notificaciones y paginación
// ============================================================
export function useNotificationsList(filters?: {
  page?: number;        // ? = todos los filtros son opcionales
  perPage?: number;
  section?: string;
  unreadOnly?: boolean;
}) {
  const { isAuthenticated } = useAuth();

  // URLSearchParams: utilidad del navegador para construir query strings.
  // Transforma { page: 2, perPage: 10 } → "page=2&perPage=10"
  const params = new URLSearchParams();
  // Solo agregamos cada parámetro al query string si existe (no undefined/null)
  if (filters?.page) params.set('page', String(filters.page));
  // String(): convierte número a string (URLSearchParams solo acepta strings)
  if (filters?.perPage) params.set('perPage', String(filters.perPage));
  if (filters?.section) params.set('section', filters.section);
  if (filters?.unreadOnly) params.set('unreadOnly', 'true');
  // params.toString(): "page=1&perPage=20&section=appointments"
  const qs = params.toString(); // "qs" = query string

  return useQuery<{
    data: StaffNotification[];  // Array de notificaciones
    meta: { page: number; perPage: number; total: number; totalPages: number };
    // meta: información de paginación (página actual, total de registros, etc.)
  }>({
    queryKey: ['staff-notifications', 'list', filters],
    // La clave incluye "filters" para que react-query tenga caché separada
    // por cada combinación de filtros. Si cambia page o section, refetch.

    queryFn: async () => {
      const res = await api.get<{
        data: StaffNotification[];
        meta: { page: number; perPage: number; total: number; totalPages: number };
      }>(`/api/staff-notifications${qs ? `?${qs}` : ''}`);
      // Template literal: construye la URL.
      // qs ? `?${qs}` : '': si hay filtros, los agrega como ?page=1&...
      // Si no hay filtros, no agrega nada (string vacío).
      return res; // La respuesta ya tiene la forma correcta
    },
    enabled: isAuthenticated, // Solo consulta si el usuario está logueado
  });
}

// ============================================================
// HOOK: useMarkRead
// Marca una notificación específica como leída.
//
// No recibe parámetros al usarse, pero la función mutation
// recibe el ID de la notificación.
//
// Devuelve: objeto de useMutation con:
//   - mutate(id): llama la mutación (versión no-async)
//   - mutateAsync(id): versión async que puedes await
//   - isLoading, isError, etc.
// ============================================================
export function useMarkRead() {
  // useQueryClient: accede al gestor de caché de react-query
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // POST /api/staff-notifications/:id/read → marca como leída
      await api.post(`/api/staff-notifications/${id}/read`, {});
      // El cuerpo {} está vacío; el ID va en la URL
    },
    onSuccess: () => {
      // onSuccess: se ejecuta cuando la mutación funciona correctamente.
      // Invalidamos la caché de todas las queries con key 'staff-notifications'.
      // Esto hace que react-query vuelva a consultar los datos actualizados:
      // tanto la lista como los conteos de no leídos se recargarán.
      qc.invalidateQueries({ queryKey: ['staff-notifications'] });
    },
  });
}

// ============================================================
// HOOK: useMarkAllRead
// Marca TODAS las notificaciones como leídas (opcionalmente solo de una sección).
//
// No recibe parámetros al usarse.
// La función mutation recibe section? (opcional): si se pasa, solo marca
// las de esa sección; si no se pasa, marca todas.
//
// Devuelve: objeto de useMutation
// ============================================================
export function useMarkAllRead() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (section?: string) => {
      // POST /api/staff-notifications/read-all
      // Si se pasa section, enviamos { section } en el body.
      // Si no se pasa, enviamos {} (body vacío = marcar todo).
      await api.post(`/api/staff-notifications/read-all`, section ? { section } : {});
      // Operador ternario: condición ? valor_si_true : valor_si_false
      // section ? { section } : {} → si section existe, manda el objeto; si no, manda vacío
    },
    onSuccess: () => {
      // Al igual que en useMarkRead, invalidamos la caché de notificaciones
      // para que los badges y la lista se actualicen automáticamente.
      qc.invalidateQueries({ queryKey: ['staff-notifications'] });
    },
  });
}

// ============================================================
// HOOK: useEnsurePushSubscription
// Registra el Service Worker y suscribe al usuario a notificaciones
// push del sistema operativo (las que aparecen aunque el navegador
// esté cerrado).
//
// Es IDEMPOTENTE: se puede llamar múltiples veces sin problema.
// Si ya está suscrito, no hace nada extra.
//
// No recibe parámetros. No devuelve nada (es un efecto puro).
//
// Se llama UNA VEZ en el "shell" (layout principal) del dashboard.
// ============================================================

/**
 * Registra el service worker y suscribe al push si el usuario ya
 * concedio permiso. Idempotente. Para llamar una vez en el shell del
 * portal del empleado / dashboard.
 */
export function useEnsurePushSubscription() {
  const { isAuthenticated } = useAuth();

  // useEffect: corre cuando isAuthenticated cambia.
  // Si el usuario se loguea, intenta registrar el push.
  // Si el usuario cierra sesión, el efecto limpia con "cancelled = true".
  useEffect(() => {
    if (!isAuthenticated) return; // Sin sesión → no hacer nada
    if (!pushSupported()) return; // El navegador no soporta push → salir

    // "cancelled": variable de control para evitar actualizar estado
    // en un componente que ya se desmontó (evita memory leaks y warnings).
    let cancelled = false;

    // Función async inmediatamente invocada (IIFE async):
    // Es una forma de usar async/await dentro de un useEffect.
    // useEffect no puede ser async directamente, así que usamos este patrón.
    (async () => {
      // Paso 1: registrar el Service Worker en el navegador.
      // El Service Worker es un script que corre en segundo plano
      // y puede recibir notificaciones push incluso con el tab cerrado.
      await registerServiceWorker();

      // Si el componente se desmontó mientras esperábamos, abortamos.
      if (cancelled) return;

      // Paso 2: solo suscribir si el usuario ya dió permiso de notificaciones.
      // pushPermission() devuelve: 'granted', 'denied', o 'default'
      // No pedimos permiso aquí: eso debe hacerse con un botón explícito
      // para no interrumpir al usuario de forma invasiva.
      if (pushPermission() === 'granted') {
        // Enviamos la suscripción (endpoint, claves) al servidor backend
        // para que pueda enviar notificaciones push a este dispositivo.
        await subscribePushOnServer();
      }
    })();

    // FUNCIÓN DE LIMPIEZA del useEffect:
    // React llama esta función cuando el componente se desmonta
    // o antes de volver a correr el efecto (si cambian las dependencias).
    // Aquí ponemos cancelled = true para abortar la operación async si ya no necesitamos el resultado.
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);
  // [isAuthenticated]: el efecto vuelve a correr cuando cambia isAuthenticated.
  // Así: si el usuario inicia sesión, intentamos registrar el push.
  // Si cierra sesión y vuelve a iniciarla, vuelve a intentar.
}
