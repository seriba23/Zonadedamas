# Zona de Damas - Documento de Contexto del Proyecto

> **Ultima actualizacion:** 2026-03-01
> **Version:** 1.0
> **Competencia directa:** Fresha (fresha.com)

---

## 1. VISION DEL PROYECTO

Zona de Damas es una plataforma SaaS de reservas para negocios de belleza y bienestar (salones, barberias, spas, clinicas). La vision es competir directamente con Fresha ofreciendo:

- **Marketplace** publico con todos los negocios afiliados
- **4 portales de acceso** diferenciados por tipo de usuario
- **App movil** para Android e iOS + version web
- **Sistema de puntos y fidelizacion** cross-negocio
- **Galeria de resultados** como diferenciador clave

---

## 2. ARQUITECTURA TECNICA

### Stack actual
| Capa | Tecnologia |
|------|-----------|
| Monorepo | Turborepo + npm workspaces |
| Backend | NestJS 10 + TypeScript + Prisma 5 + MySQL (MariaDB) |
| Frontend | Next.js 14 + TypeScript + Tailwind CSS |
| Shared | @zonadedamas/shared (types + Zod schemas) |
| Cache | In-memory (Map-based) |
| Eventos | @nestjs/event-emitter (in-process) |
| Auth | JWT access (15min) + refresh tokens (rotacion) |
| Uploads | Disco local (uploads/) con UploadsService |

### Estructura del monorepo
```
apps/api/          -> NestJS backend (port 3001, prefix /api)
apps/web/          -> Next.js frontend (port 3000)
packages/shared/   -> Tipos compartidos + Zod schemas
docs/              -> 11 documentos de diseno + este archivo
uploads/           -> Archivos subidos (avatars, portfolio, results, documents)
```

### Base de datos
- **Motor:** MySQL/MariaDB via XAMPP (local dev)
- **ORM:** Prisma (40+ modelos)
- **Patron:** Multi-tenant con tenant_id en cada query
- **Anti-doble-reserva:** Transaccion Serializable
- **Snapshot:** appointment_items guarda precio/duracion al momento de reservar

---

## 3. LOS 4 PORTALES

### 3.1 SUPER ADMIN (Plataforma)
**Ruta:** `/platform/*`
**Auth:** PlatformJwtAuthGuard (estrategia separada)

#### Estado actual - CONSTRUIDO:
- [x] Login super admin
- [x] Dashboard con estadisticas globales (total negocios, ingresos, suscripciones activas)
- [x] Lista de negocios/tenants con filtros
- [x] Detalle de cada negocio (info, plan, empleados, metricas)
- [x] Cambiar plan de negocio (BASICO/PLUS/PRO)
- [x] Cambiar estatus de suscripcion (ACTIVE/SUSPENDED/CANCELLED)
- [x] Lista de facturas con filtros
- [x] Marcar facturas como pagadas/vencidas
- [x] Desactivar empleados de cualquier negocio

#### Faltante:
- [ ] Sistema de tickets de soporte tecnico
- [ ] Chat/mensajeria con negocios
- [ ] Notificaciones push a negocios
- [ ] Metricas avanzadas (MRR, churn rate, LTV)
- [ ] Gestion de categorias del marketplace
- [ ] Panel de moderacion de resenas
- [ ] Configuracion de planes y precios
- [ ] Logs de actividad de la plataforma
- [ ] Exportar datos (CSV/Excel)

**Progreso estimado: 55%**

---

### 3.2 GERENTE/DUEÑO DE NEGOCIO (Dashboard)
**Ruta:** `/(dashboard)/*`
**Auth:** JwtAuthGuard + PermissionGuard

#### Estado actual - CONSTRUIDO:
- [x] Login/registro de negocio
- [x] Calendario de citas (dia/semana) con drag & overlap
- [x] CRUD completo de citas (crear, editar, reagendar, cancelar, completar, no-show)
- [x] CRUD de clientes con busqueda y tags
- [x] CRUD de servicios (nombre, precio, duracion, buffers, categoria, color, pointsReward)
- [x] CRUD de empleados (info personal, horarios, servicios, comisiones, portfolio, documentos, capacitaciones)
- [x] Desactivacion inteligente de empleados (KEEP/CANCEL/SMART_RESCHEDULE)
- [x] CRUD de recursos (salas, equipos)
- [x] Sistema de permisos y roles (53 permisos, 7 roles default)
- [x] Matriz visual de permisos por rol
- [x] Horarios del negocio + cierres temporales
- [x] Horarios individuales de empleados
- [x] Motor de disponibilidad (considera horarios, time-offs, citas, buffers)
- [x] POS / Punto de venta
- [x] Pagina de reportes
- [x] Plantillas de notificaciones (Email/SMS/WhatsApp/Push)
- [x] Codigos de invitacion
- [x] Generacion de codigo QR para reservas
- [x] Fotos de resultado en citas (obligatorias para completar)
- [x] Sistema de suscripciones (BASICO/PLUS/PRO con limites)
- [x] Auditoria completa de acciones
- [x] Eventos de dominio

#### Faltante:
- [ ] **Inventario** - Gestion de productos (stock, alertas de bajo inventario)
- [ ] **Proveedores** - CRUD de proveedores con ordenes de compra
- [ ] **Promociones/Cupones** - Crear descuentos, codigos promo, ofertas temporales
- [ ] **Programa de fidelizacion (admin)** - Configurar cuantos puntos = que recompensa
- [ ] **Reportes avanzados** - P&L, ingresos por servicio, productividad por empleado, retencion de clientes
- [ ] **Calendario mensual** - Vista de mes completo
- [ ] **Lista de espera** - Cuando no hay disponibilidad
- [ ] **Paquetes de servicios** - Combos/bundles
- [ ] **Depositos/anticipos** - Cobro parcial al reservar
- [ ] **Integracion de pagos** - Stripe/MercadoPago para cobros online
- [ ] **Formularios de consentimiento** - Antes de ciertos servicios
- [ ] **Segmentacion de clientes** - Marketing automatizado
- [ ] **Multi-idioma** - i18n (actualmente solo espanol)
- [ ] **Importar/Exportar datos** - CSV de clientes, servicios, etc.

**Progreso estimado: 65%**

---

### 3.3 EMPLEADO
**Ruta:** `/employee/*`
**Auth:** JwtAuthGuard (mismo JWT, permisos limitados por rol)

#### Estado actual - CONSTRUIDO:
- [x] Dashboard de empleado
- [x] Lista de citas del empleado
- [x] Vista de horario/disponibilidad
- [x] Perfil del empleado (editar info personal)
- [x] Seccion de capacitaciones
- [x] Portfolio de trabajos (backend completo con CRUD de imagenes)
- [x] Resenas de clientes (backend completo)
- [x] Documentos personales (backend: contratos, identificacion)
- [x] Info personal (tipo de sangre, contacto de emergencia, alergias)
- [x] Permisos/vacaciones (backend: time-off CRUD)

#### Faltante:
- [ ] **Comisiones** - Vista de comisiones ganadas por periodo (los datos existen en EmployeeService.commission)
- [ ] **Galeria de trabajos (frontend)** - Mostrar fotos de servicios completados como galeria
- [ ] **Estadisticas detalladas** - Total servicios, calificacion promedio, ingresos generados
- [ ] **Solicitud de permisos con aprobacion** - Workflow: empleado solicita -> gerente aprueba/rechaza
- [ ] **Feed de comentarios** - Seccion dedicada a leer reviews de clientes
- [ ] **Metas/objetivos** - Metas de servicios/ingresos por periodo
- [ ] **Chat con gerente** - Comunicacion interna
- [ ] **Horario personalizado** - Que el empleado pueda proponer cambios de horario

**Progreso estimado: 50%**

---

### 3.4 CLIENTE / CONSUMIDOR (Marketplace)
**Ruta:** `/marketplace/*` + `/portal/[tenantSlug]/*`
**Auth:** MarketplaceJwtGuard (identidad global) + ClientJwtGuard (por negocio)

#### Estado actual - CONSTRUIDO:
- [x] Registro/login en marketplace (identidad global cross-negocio)
- [x] Discover: buscar negocios (por ubicacion, tipo, rating, nombre)
- [x] Detalle de negocio (servicios, empleados, resenas)
- [x] Entrar a negocio (link MarketplaceUser -> Client per tenant)
- [x] Perfil con avatar, nombre, email, stats
- [x] Editar perfil (nombre editable directo, email/telefono con verificacion por contrasena)
- [x] Subir foto de perfil
- [x] Estadisticas cross-tenant (puntos, servicios)
- [x] Citas proximas y pasadas (cross-tenant)
- [x] Galeria de fotos por categoria de servicio (cross-tenant)
- [x] Sistema de puntos de fidelizacion (auto-award al completar cita)
- [x] Portal por negocio: login, registro, reservar, ver citas, cancelar, reagendar
- [x] Resenas por negocio
- [x] Historial de servicios con fotos
- [x] Reserva publica sin cuenta (guest booking via /book/[slug])
- [x] QR code para acceso rapido al booking
- [x] Color primario teal #008080

#### Faltante:
- [ ] **Cupones/Recompensas** - Canjear puntos por servicios/productos
- [ ] **Tienda de recompensas** - Admin configura que se puede canjear
- [ ] **Favoritos** - Guardar negocios favoritos
- [ ] **Notificaciones push** - Recordatorios de citas, ofertas
- [ ] **Compartir galeria** - Compartir fotos en redes sociales
- [ ] **Invitar amigos** - Referidos con puntos bonus
- [ ] **Busqueda por servicio** - "Buscar manicure cerca de mi"
- [ ] **Filtros avanzados** - Precio, disponibilidad hoy, ofertas
- [ ] **Reservar desde marketplace** - Sin tener que entrar al portal del negocio
- [ ] **Chat con negocio** - Preguntas pre-reserva
- [ ] **Historial de pagos** - Recibos y facturas del cliente
- [ ] **Metodos de pago guardados** - Tarjeta almacenada para pago rapido

**Progreso estimado: 55%**

---

## 4. PROGRESO GLOBAL

| Area | Progreso | Notas |
|------|----------|-------|
| Super Admin | 55% | Funcional pero basico. Falta soporte y metricas avanzadas |
| Dashboard Negocio | 65% | Core robusto. Falta inventario, proveedores, promociones |
| Portal Empleado | 50% | Backend fuerte, frontend necesita mas features |
| Portal Cliente/Marketplace | 55% | Flujo principal completo. Falta cupones, favoritos, push |
| Infraestructura Backend | 85% | Multi-tenant, RBAC, audit, eventos, notificaciones - solido |
| Infraestructura Frontend | 70% | 4 auth systems, layouts, API clients - bien estructurado |
| Shared Package | 60% | Tipos basicos cubiertos, falta actualizar con nuevos modulos |
| Documentacion | 80% | 11 docs de diseno completos |
| Tests | 15% | Muy pocos tests automatizados |
| **TOTAL ESTIMADO** | **~58%** | |

---

## 5. CAMINO A APP MOVIL (Android + iOS)

### Opciones evaluadas

| Opcion | Pros | Contras | Recomendacion |
|--------|------|---------|---------------|
| **React Native (Expo)** | Codigo nativo real, rendimiento optimo, enorme ecosistema | Reescribir todo el frontend, doble mantenimiento web+mobile | Para V2 a largo plazo |
| **PWA (Progressive Web App)** | Cero reescritura, funciona ya en web, instalable | Sin acceso a Play/App Store, limitaciones en iOS (push, background) | Rapido pero limitado |
| **Capacitor (Ionic)** | Envuelve la web actual en shell nativo, acceso a Play/App Store, push nativo, camara nativa | Performance no es 100% nativa, necesita ajustes de UX | **RECOMENDADO para V1 mobile** |

### Plan recomendado: Capacitor + Next.js

**Fase 1 - PWA inmediata (1-2 semanas)**
1. Agregar manifest.json y service worker a Next.js
2. Iconos y splash screens
3. Meta tags para instalacion
4. Resultado: app instalable desde el navegador

**Fase 2 - Capacitor wrapper (3-4 semanas)**
1. `npm install @capacitor/core @capacitor/cli`
2. Configurar Capacitor para Android + iOS
3. Agregar plugins nativos:
   - `@capacitor/push-notifications` - Notificaciones push
   - `@capacitor/camera` - Camara nativa para fotos
   - `@capacitor/geolocation` - Ubicacion para discover
   - `@capacitor/share` - Compartir galeria
4. Ajustar UI para mobile-first (ya es responsive pero necesita pulir)
5. Build: `npx cap build android` / `npx cap build ios`
6. Publicar en Play Store + App Store

**Fase 3 - Optimizaciones mobile (ongoing)**
1. Gestos nativos (swipe para navegar)
2. Animaciones fluidas
3. Offline mode (cache de datos)
4. Deep links (compartir links que abran la app)
5. Widget de proxima cita

### Prerequisitos antes de ir a mobile:
- [ ] Notificaciones push funcionales (backend listo, falta integracion con FCM/APNs)
- [ ] Responsive design pulido en TODOS los portales
- [ ] Performance optimizada (lazy loading, image optimization)
- [ ] API estable (no breaking changes frecuentes)

---

## 6. PLAN DE EJECUCION - PASO A PASO

> Cada fase debe completarse antes de pasar a la siguiente.
> Al terminar una fase, marcar todos los items como [x] y actualizar la fecha.
> La siguiente sesion de trabajo debe comenzar en la primera fase incompleta.

---

### FASE 1: Completar flujo del cliente (marketplace)
**Objetivo:** Que un cliente pueda descubrir, reservar, pagar y ser fidelizado sin fricciones.
**Depende de:** Nada (es lo que sigue ahora)

- [ ] **1.1 Reservar desde marketplace** - Flujo de booking integrado en `/marketplace/[tenantSlug]` sin redirigir al portal separado. Seleccionar servicio -> empleado -> horario -> confirmar, todo dentro del marketplace.
- [ ] **1.2 Cupones y canje de puntos** - Backend: modelo `Reward` (nombre, puntosRequeridos, tipo: SERVICIO|PRODUCTO, serviceId?, isActive). Endpoints CRUD para que el gerente configure recompensas. Endpoint `POST /marketplace/rewards/redeem` para que el cliente canjee. Frontend: seccion "Cupones disponibles" en perfil muestra recompensas alcanzables.
- [ ] **1.3 Favoritos** - Backend: tabla `MarketplaceFavorite` (marketplaceUserId, tenantId). Endpoints toggle + list. Frontend: corazon en cards de negocios, seccion "Mis favoritos" en perfil.
- [ ] **1.4 Busqueda avanzada en marketplace** - Filtros: por servicio ("buscar manicure"), rango de precio, disponibilidad hoy, rating minimo. Mejorar el discover con estos filtros.

**Resultado:** El marketplace es funcional end-to-end para el usuario final.
**Fecha completado:** ____

---

### FASE 2: Integracion de pagos
**Objetivo:** Monetizar la plataforma y permitir cobros online.
**Depende de:** Fase 1 (el flujo de booking debe funcionar primero)

- [ ] **2.1 Elegir pasarela** - Stripe (internacional) o MercadoPago (LATAM) segun mercado objetivo. Crear cuenta y obtener API keys.
- [ ] **2.2 Backend: modulo de pagos online** - Integracion con la pasarela elegida. Endpoints: crear intent de pago, webhook para confirmacion, refunds. Vincular con modelo Payment existente.
- [ ] **2.3 Cobro al reservar (deposito o total)** - El gerente configura por servicio: sin cobro / deposito % / cobro completo. Al reservar, el cliente paga antes de confirmar.
- [ ] **2.4 Cobro de suscripciones** - Auto-cobro mensual a los negocios segun su plan (BASICO/PLUS/PRO). Webhook para actualizar status de suscripcion automaticamente.
- [ ] **2.5 Historial de pagos del cliente** - Frontend: seccion en perfil marketplace con recibos y facturas.

**Resultado:** Dinero fluye: clientes pagan servicios, negocios pagan suscripcion.
**Fecha completado:** ____

---

### FASE 3: Notificaciones push + recordatorios
**Objetivo:** Mantener al usuario enganchado y reducir no-shows.
**Depende de:** Fase 1 (necesitamos citas reservadas para enviar recordatorios)

- [ ] **3.1 Firebase Cloud Messaging (FCM)** - Configurar proyecto Firebase, obtener server key. Backend: servicio para enviar push via FCM API.
- [ ] **3.2 Registro de dispositivos** - Backend: modelo `PushDevice` (userId/marketplaceUserId, fcmToken, platform). Endpoint para registrar/eliminar token. Frontend: pedir permiso de notificaciones y registrar token.
- [ ] **3.3 Notificaciones automaticas** - Integrar con NotificationListenerService existente. Triggers: cita confirmada, recordatorio 24h antes, recordatorio 1h antes, cita completada (invitar a dejar resena), puntos ganados.
- [ ] **3.4 Notificaciones del negocio** - Push al staff cuando: nueva cita, cita cancelada, nueva resena recibida.

**Resultado:** Usuarios reciben push en tiempo real, tasa de no-show baja.
**Fecha completado:** ____

---

### FASE 4: Portal del empleado completo
**Objetivo:** Que el empleado tenga una experiencia rica y util.
**Depende de:** Nada (puede hacerse en paralelo con Fase 2-3)

- [ ] **4.1 Dashboard de comisiones** - Frontend: vista de comisiones ganadas por semana/mes. Los datos ya existen en EmployeeService.commission, solo falta calcular y mostrar.
- [ ] **4.2 Galeria de trabajos del empleado** - Frontend: mostrar fotos de AppointmentPhoto de sus citas completadas, agrupadas por categoria. Similar a la galeria del cliente pero desde perspectiva del profesional.
- [ ] **4.3 Feed de resenas** - Frontend: seccion dedicada con todas las EmployeeReview del empleado, rating promedio, tendencia.
- [ ] **4.4 Solicitud de permisos con aprobacion** - Backend: agregar campo `status` a EmployeeTimeOff (PENDING/APPROVED/REJECTED) + `approvedBy`. El empleado crea con status PENDING, el gerente aprueba/rechaza. Frontend: formulario de solicitud + lista con estados.
- [ ] **4.5 Estadisticas detalladas** - Total servicios completados, rating promedio, cliente mas frecuente, servicio mas realizado, ingresos generados por periodo.

**Resultado:** Los empleados usan la app activamente y tienen incentivos claros.
**Fecha completado:** ____

---

### FASE 5: Herramientas avanzadas para el gerente
**Objetivo:** Que el gerente gestione TODO su negocio desde la plataforma.
**Depende de:** Fase 2 (necesita pagos para reportes financieros)

- [ ] **5.1 Inventario basico** - Backend: modelo `Product` (nombre, sku, precio, stock, alertaMinima, categoria, tenantId). CRUD endpoints. Frontend: pagina de inventario con lista, crear/editar, alertas de stock bajo.
- [ ] **5.2 Proveedores** - Backend: modelo `Supplier` (nombre, contacto, email, telefono, notas, tenantId). CRUD endpoints. Relacion con productos (que proveedor surte que producto).
- [ ] **5.3 Promociones y descuentos** - Backend: modelo `Promotion` (nombre, tipo: PORCENTAJE|MONTO_FIJO|2x1, valor, fechaInicio, fechaFin, servicios[], codigoPromo, usosMaximos, tenantId). Aplicar descuentos al reservar/pagar.
- [ ] **5.4 Reportes financieros** - Dashboard: ingresos por periodo, por servicio, por empleado. Gastos (si se integra inventario). Comisiones pagadas. Grafica de tendencia. Exportar a CSV.
- [ ] **5.5 Calendario mensual** - Vista de mes completo adicional a dia/semana. Overview de dias ocupados vs disponibles.
- [ ] **5.6 Paquetes de servicios** - Backend: modelo `ServiceBundle` (nombre, servicios[], precioBundle, duracionTotal). Reservar como paquete con precio especial.

**Resultado:** El gerente no necesita otra herramienta para gestionar su negocio.
**Fecha completado:** ____

---

### FASE 6: Super admin robusto
**Objetivo:** Control total de la plataforma para el operador.
**Depende de:** Fase 2 (necesita pagos/suscripciones funcionando)

- [ ] **6.1 Soporte tecnico** - Backend: modelo `SupportTicket` (tenantId, asunto, descripcion, status: OPEN|IN_PROGRESS|RESOLVED|CLOSED, prioridad, mensajes[]). CRUD + asignar agente. Frontend: vista de tickets en super admin + formulario de contacto para gerentes.
- [ ] **6.2 Metricas avanzadas** - MRR (Monthly Recurring Revenue), churn rate, LTV (Lifetime Value), tenants activos vs inactivos, crecimiento mes a mes. Graficas con tendencias.
- [ ] **6.3 Moderacion de contenido** - Panel para revisar resenas reportadas, fotos inapropiadas. Acciones: aprobar, ocultar, eliminar.
- [ ] **6.4 Gestion de categorias del marketplace** - CRUD de tipos de negocio (Salon, Barberia, SPA, Clinica, etc.) desde el admin en vez de hardcoded.
- [ ] **6.5 Configuracion de planes** - Editar precios y limites de BASICO/PLUS/PRO desde el admin sin tocar codigo.
- [ ] **6.6 Exportar datos** - Exportar listas de tenants, facturas, metricas a CSV/Excel.

**Resultado:** La plataforma se puede operar profesionalmente a escala.
**Fecha completado:** ____

---

### FASE 7: App movil V1
**Objetivo:** Presencia en Play Store y App Store.
**Depende de:** Fases 1-3 completadas (el core debe estar solido)

- [ ] **7.1 PWA** - manifest.json, service worker, iconos, splash screens. App instalable desde navegador como paso intermedio.
- [ ] **7.2 Capacitor setup** - Instalar @capacitor/core + cli. Configurar para Android + iOS. Primer build de prueba.
- [ ] **7.3 Plugins nativos** - push-notifications (FCM), camera (para fotos), geolocation (discover), share (galeria).
- [ ] **7.4 Ajustes UI mobile** - Revisar TODOS los portales en mobile. Safe areas, scroll, teclado, gestos. Bottom navigation en marketplace.
- [ ] **7.5 Build y publicacion Android** - APK firmado, ficha en Play Store, screenshots, descripcion.
- [ ] **7.6 Build y publicacion iOS** - Xcode build, certificados Apple, ficha en App Store, review de Apple.

**Resultado:** App disponible para descargar en las 2 tiendas principales.
**Fecha completado:** ____

---

### FASE 8: Diferenciadores y crecimiento
**Objetivo:** Features que nos separan de la competencia.
**Depende de:** Fases 1-6 completadas

- [ ] **8.1 Referidos** - Invitar amigos con link personalizado. Ambos ganan puntos bonus. Tracking de referidos por usuario.
- [ ] **8.2 Lista de espera** - Cuando no hay disponibilidad, el cliente se anota. Si se cancela una cita, se notifica al primero en la lista.
- [ ] **8.3 Chat negocio-cliente** - Mensajeria directa pre-reserva. Backend: modelo `ChatMessage`. Real-time con WebSockets o polling.
- [ ] **8.4 Formularios de consentimiento** - Antes de ciertos servicios (quimicos, agujas). Template editable por el gerente. Firma digital del cliente.
- [ ] **8.5 Depositos/anticipos** - Cobro parcial al reservar para reducir no-shows. Configurable por servicio.

**Resultado:** La plataforma tiene features unicos que retienen usuarios.
**Fecha completado:** ____

---

### FASE 9: Escalabilidad tecnica
**Objetivo:** Preparar la infraestructura para miles de negocios.
**Depende de:** Fases 1-7 completadas (no optimizar prematuramente)

- [ ] **9.1 Tests automatizados** - Unit tests para servicios criticos (booking, payments, availability). Integration tests para flujos E2E. Coverage minimo 60%.
- [ ] **9.2 Redis cache** - Reemplazar Map in-memory por Redis. Cache de disponibilidad, sesiones, rate limiting.
- [ ] **9.3 CDN para uploads** - Migrar de disco local a S3/CloudFront o similar. URLs firmadas para documentos privados.
- [ ] **9.4 Deploy a produccion** - VPS o cloud (AWS/DigitalOcean/Railway). CI/CD con GitHub Actions. SSL, dominio, DNS.
- [ ] **9.5 Multi-idioma (i18n)** - next-intl o similar. Espanol (default), Ingles, Portugues.
- [ ] **9.6 Monitoreo** - Logging centralizado, alertas de errores, metricas de performance (Sentry, Datadog o similar).

**Resultado:** La plataforma esta lista para produccion a escala.
**Fecha completado:** ____

---

### FASE 10: App nativa V2 (largo plazo)
**Objetivo:** Experiencia mobile premium.
**Depende de:** Todo lo anterior + validacion de mercado

- [ ] **10.1 React Native (Expo)** - Reescribir el frontend mobile en React Native para performance nativa.
- [ ] **10.2 Animaciones y gestos nativos** - Transiciones fluidas, swipe, haptic feedback.
- [ ] **10.3 Offline mode** - Cache local con sincronizacion. Ver citas sin conexion.
- [ ] **10.4 Deep links y widgets** - Links que abren secciones especificas de la app. Widget de proxima cita en home screen.
- [ ] **10.5 Apple Watch / Wear OS** - Notificacion de proxima cita en smartwatch.

**Resultado:** App de calidad premium comparable con Fresha.
**Fecha completado:** ____

---

### RESUMEN DEL CAMINO

```
FASE 1  ->  FASE 2  ->  FASE 3  ->  FASE 7
(Cliente)   (Pagos)    (Push)      (Mobile V1)
                                       |
FASE 4  (puede ir en paralelo) --------+
(Empleado)                             |
                                       v
FASE 5  ->  FASE 6  ->  FASE 8  ->  FASE 9  ->  FASE 10
(Gerente)   (Admin)    (Growth)    (Scale)     (Native V2)
```

**Regla de oro:** Al iniciar una sesion de trabajo, buscar la primera fase incompleta y continuar desde ahi. No saltar fases a menos que sea un bugfix urgente.

---

## 7. INVENTARIO TECNICO ACTUAL

### Backend: 23 modulos NestJS
| Modulo | Endpoints | Estado |
|--------|-----------|--------|
| Auth | 5 | Completo |
| Appointments | 12 | Completo |
| Clients | 9 | Completo |
| Employees | 25+ | Completo |
| Services | 5 | Completo |
| Resources | 5 | Completo |
| Availability | 3 | Completo |
| Payments | 3 | Basico (falta integracion pasarela) |
| Tenants | 10 | Completo |
| RBAC | 7 | Completo |
| Audit | 1 | Completo |
| Events | - | Completo (listener) |
| Public Booking | 5 | Completo |
| Client Portal | 16 | Completo |
| Marketplace | 14 | Completo |
| Subscriptions | 3 | Completo |
| Notifications | 5 | Completo (templates, falta push real) |
| Uploads | 2 | Completo |
| Platform Auth | 4 | Completo |
| Platform Admin | 8 | Completo |
| Invite Codes | 3 | Completo |
| Health | 1 | Completo |

### Frontend: 35 paginas, 32 componentes
| Area | Paginas | Estado |
|------|---------|--------|
| Dashboard (negocio) | 14 | Funcional |
| Employee | 5 | Basico |
| Platform (admin) | 6 | Funcional |
| Marketplace | 5 | Funcional |
| Client Portal | 7 | Funcional |
| Public (booking/QR) | 2 | Completo |
| Auth | 2 | Completo |

### Sistemas de autenticacion: 4
1. **Staff/Admin** - JwtAuthGuard (email + password -> JWT)
2. **Client Portal** - ClientJwtGuard (por negocio, scoped a tenantSlug)
3. **Marketplace** - MarketplaceJwtGuard (global cross-tenant)
4. **Super Admin** - PlatformJwtAuthGuard (plataforma)

### Modelos de base de datos: 40+
Organizados en: Platform, Multi-Tenant Core, RBAC, Clients, Services, Employees, Appointments, Payments, Business Ops, Audit/Events

---

## 8. CONVENCIONES DE DISENO

- **Color primario:** `#008080` (teal), hover: `#006666`, light: `#e0f2f1`
- **Botones capsula (pills):** `rounded-full px-3 py-1.5 text-xs font-medium` - blanco con borde gris inactivo, teal solido activo
- **Fuente:** System font stack via Tailwind
- **Responsive:** Mobile-first
- **Iconos:** Heroicons (via SVG inline)
- **Componentes UI:** Button, Input, Modal, Drawer, Select, Badge, Table, Pagination, ImageUpload, AvatarCropModal, ConfettiCelebration

---

## 9. CREDENCIALES DE DESARROLLO

| Portal | Email | Password |
|--------|-------|----------|
| Super Admin | admin@zonadedamas.com | Admin123! |
| Dashboard | admin@zonadedamas.com | Admin123! |
| Marketplace | (registrar nuevo) | - |
| Client Portal | (registrar nuevo) | - |

### Entorno local
- XAMPP: Apache + MySQL (port 3306, user root, sin password)
- Database: zonadedamas
- API: http://localhost:3001
- Web: http://localhost:3000
- Platform: http://localhost:3000/platform
- Marketplace: http://localhost:3000/marketplace

---

## 10. HISTORIAL DE FEATURES PRINCIPALES

| Fecha | Feature |
|-------|---------|
| - | Fundacion: NestJS + Next.js + Prisma + multi-tenant |
| - | RBAC: 53 permisos, 7 roles, matriz visual |
| - | Calendario: CSS Grid, drag-and-drop, filtros, overlap detection |
| - | Suscripciones: 3 planes, limites, interceptor de status |
| - | Portal de clientes: auth, citas, resenas, historial |
| - | Booking publico: guest booking + QR codes |
| - | Marketplace: discover, auth global, enter business |
| - | Notificaciones: Email + WhatsApp (templates, event-driven) |
| - | Empleados: desactivacion inteligente con reagendado |
| 2026-03-01 | Perfil marketplace: avatar, galeria por categoria, puntos, foto obligatoria al completar |
| 2026-03-01 | Color teal #008080 en todo el marketplace |
| 2026-03-01 | Cambio seguro de email/telefono con verificacion por contrasena |
