// ─────────────────────────────────────────────────────────────────────────────
// MÓDULO RAÍZ (AppModule): es el "tablero central" de NestJS. Aquí se juntan
// TODOS los módulos de la aplicación, además de los guards/interceptors/filtros
// que se aplican de forma global a todas las peticiones. NestJS arranca leyendo
// este módulo y, a partir de él, descubre el resto del sistema.
// ─────────────────────────────────────────────────────────────────────────────

// Module: decorador para declarar una clase como módulo de NestJS.
import { Module } from '@nestjs/common';

// De @nestjs/core importamos tres "tokens" especiales. Un token es una etiqueta
// que NestJS reconoce para registrar algo de forma GLOBAL (en toda la app):
//   - APP_GUARD: registra un "guard" global (filtro de seguridad que decide si
//     una petición puede pasar; aquí lo usamos para el límite de peticiones).
//   - APP_INTERCEPTOR: registra un "interceptor" global (envuelve cada petición/
//     respuesta para añadir lógica: logs, id de petición, etc.).
//   - APP_FILTER: registra un "filtro de excepciones" global (atrapa los errores
//     y los transforma en una respuesta con formato uniforme).
import { APP_GUARD, APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';

// ThrottlerModule + ThrottlerGuard = sistema de "rate limiting" (límite de
// cuántas peticiones por minuto se permiten desde una misma IP). Protege contra
// abuso/spam. El módulo se configura abajo y el guard lo aplica.
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

// ── MÓDULOS DE INFRAESTRUCTURA ──────────────────────────────────────────────
// PrismaModule: acceso a la base de datos (global, lo importamos una vez aquí).
import { PrismaModule } from './prisma/prisma.module';
// RedisModule: caché en memoria estilo Redis (también global).
import { RedisModule } from './redis/redis.module';

// ── MÓDULOS DE NEGOCIO ──────────────────────────────────────────────────────
// A partir de aquí, cada import trae un módulo con una funcionalidad concreta
// del producto (autenticación, citas, clientes, marketplace, etc.). Todos se
// listan más abajo en "imports" para que NestJS los cargue.
import { AuthModule } from './modules/auth/auth.module'; // login/logout, tokens JWT
import { TenantsModule } from './modules/tenants/tenants.module'; // negocios (multi-tenant)
import { RbacModule } from './modules/rbac/rbac.module'; // roles y permisos
import { ClientsModule } from './modules/clients/clients.module'; // clientes del negocio
import { ServicesModule } from './modules/services/services.module'; // catálogo de servicios
import { EmployeesModule } from './modules/employees/employees.module'; // empleados/profesionales
import { ResourcesModule } from './modules/resources/resources.module'; // recursos (sillas, salas...)
import { AvailabilityModule } from './modules/availability/availability.module'; // cálculo de horarios libres
import { AppointmentsModule } from './modules/appointments/appointments.module'; // citas (núcleo del negocio)
import { PaymentsModule } from './modules/payments/payments.module'; // pagos de citas
import { AuditModule } from './modules/audit/audit.module'; // bitácora de auditoría (global)
import { EventsModule } from './modules/events/events.module'; // eventos de dominio internos
import { HealthModule } from './modules/health/health.module'; // endpoint de "salud"/estado del servidor
import { PublicBookingModule } from './modules/public-booking/public-booking.module'; // reserva pública (sin login)
import { ConfirmPaymentModule } from './modules/confirm-payment/confirm-payment.module'; // post-cita: cobrar y reseñar
import { AppointmentReminderModule } from './modules/appointment-reminder/appointment-reminder.module'; // recordatorio pre-cita (ver service de referencia)
import { UploadsModule } from './modules/uploads/uploads.module'; // subida de archivos (fotos, docs)
import { InviteCodesModule } from './modules/invite-codes/invite-codes.module'; // códigos de invitación de empleados
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module'; // suscripción de la plataforma
import { PlatformAuthModule } from './modules/platform-auth/platform-auth.module'; // auth del SuperAdmin
import { PlatformAdminModule } from './modules/platform-admin/platform-admin.module'; // panel SuperAdmin
import { CreatorCodesModule } from './modules/creator-codes/creator-codes.module'; // códigos de creadores/afiliados
import { CreatorPortalModule } from './modules/creator-portal/creator-portal.module'; // portal de creadores
import { NotificationsModule } from './modules/notifications/notifications.module'; // notificaciones a clientes
import { StaffNotificationsModule } from './modules/staff-notifications/staff-notifications.module'; // notificaciones a empleados
import { ClientPortalModule } from './modules/client-portal/client-portal.module'; // portal del cliente
import { MarketplaceModule } from './modules/marketplace/marketplace.module'; // marketplace público de negocios
import { RewardsModule } from './modules/rewards/rewards.module'; // recompensas y cupones
import { StripeModule } from './modules/stripe/stripe.module'; // pasarela de pago Stripe
import { ReportsModule } from './modules/reports/reports.module'; // reportes y estadísticas
import { ProductsModule } from './modules/products/products.module'; // inventario de productos
import { SuppliersModule } from './modules/suppliers/suppliers.module'; // proveedores del inventario
// PromotionsModule eliminado: la funcionalidad migró a RewardsModule
// (incluyendo el tipo TWO_FOR_ONE). Las tablas legacy `promotions` y
// `promotion_referrals` se conservan en BD como respaldo pero sin API.
import { AttendanceModule } from './modules/attendance/attendance.module'; // asistencia/fichaje de empleados
import { ServiceBundlesModule } from './modules/service-bundles/service-bundles.module'; // paquetes/combos de servicios
import { ShopModule } from './modules/shop/shop.module'; // tienda (venta de productos)
import { WebSocketModule } from './modules/websocket/websocket.module'; // tiempo real (sockets)
import { ExchangeRatesModule } from './modules/exchange-rates/exchange-rates.module'; // tasas de cambio de monedas

// ── ELEMENTOS GLOBALES (no son módulos, son clases sueltas que se registran
// abajo como guard/interceptors/filtro para que actúen en TODA la app) ──────
// RequestIdInterceptor: asigna un id único a cada petición (útil para rastrear
// una petición en los logs de principio a fin).
import { RequestIdInterceptor } from './common/interceptors/request-id.interceptor';
// LoggingInterceptor: registra en consola cada petición que entra y su resultado.
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
// SubscriptionStatusInterceptor: revisa el estado de la suscripción del negocio
// y puede bloquear/avisar si está vencida o suspendida.
import { SubscriptionStatusInterceptor } from './modules/subscriptions/subscription-status.interceptor';
// HttpExceptionFilter: atrapa los errores y los convierte en la respuesta de
// error con formato uniforme del proyecto ({ statusCode, error, message, ... }).
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

// @Module({...}) configura el módulo raíz con tres secciones: "imports" (otros
// módulos a cargar), "providers" (servicios/elementos globales) y, si hubiera,
// "controllers" (aquí no hay porque cada submódulo trae los suyos).
@Module({
  // "imports": todos los módulos que componen la aplicación. NestJS los inicializa
  // a todos. El orden no importa salvo para módulos globales que otros usan.
  imports: [
    // ThrottlerModule.forRoot([...]) configura el límite de peticiones por DEFECTO
    // para toda la app: máximo 100 peticiones (limit) cada 60000 ms (ttl = 60 s)
    // por IP. Cada endpoint puede sobrescribir esto con su propio @Throttle().
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // ventana de tiempo en milisegundos (60 segundos)
        limit: 100, // máximo de peticiones permitidas dentro de esa ventana
      },
    ]),
    // Infraestructura primero (BD y caché), luego los módulos de negocio:
    PrismaModule,
    RedisModule,
    AuthModule,
    TenantsModule,
    RbacModule,
    ClientsModule,
    ServicesModule,
    EmployeesModule,
    ResourcesModule,
    AvailabilityModule,
    AppointmentsModule,
    PaymentsModule,
    AuditModule,
    EventsModule,
    HealthModule,
    PublicBookingModule,
    ConfirmPaymentModule,
    AppointmentReminderModule,
    UploadsModule,
    InviteCodesModule,
    SubscriptionsModule,
    PlatformAuthModule,
    PlatformAdminModule,
    CreatorCodesModule,
    CreatorPortalModule,
    NotificationsModule,
    StaffNotificationsModule,
    ClientPortalModule,
    MarketplaceModule,
    RewardsModule,
    StripeModule,
    ReportsModule,
    ProductsModule,
    SuppliersModule,
    AttendanceModule,
    ServiceBundlesModule,
    ShopModule,
    WebSocketModule,
    ExchangeRatesModule,
  ],
  // "providers": aquí registramos los elementos GLOBALES de la app. Cada objeto
  // dice "provide: <token global>, useClass: <clase a usar>". Esto hace que la
  // clase indicada actúe sobre TODAS las peticiones, sin tener que ponerla
  // manualmente en cada controlador.
  providers: [
    {
      // Guard global de rate limiting: aplica los límites de ThrottlerModule a
      // todos los endpoints. Si se superan, responde HTTP 429 (demasiadas
      // peticiones).
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      // Interceptor global: añade un id único a cada petición.
      provide: APP_INTERCEPTOR,
      useClass: RequestIdInterceptor,
    },
    {
      // Interceptor global: registra (loguea) cada petición y su respuesta.
      // NOTA: el orden de los interceptores importa; se ejecutan en el orden en
      // que aparecen aquí.
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      // Interceptor global: comprueba el estado de la suscripción del negocio.
      provide: APP_INTERCEPTOR,
      useClass: SubscriptionStatusInterceptor,
    },
    {
      // Filtro global de excepciones: convierte cualquier error en la respuesta
      // de error con el formato estándar del proyecto.
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
// Clase del módulo raíz. Va vacía: toda la configuración vive en el decorador
// @Module de arriba. NestFactory.create(AppModule) (en main.ts) parte de aquí.
export class AppModule {}
