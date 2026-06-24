// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// De NestJS importamos dos cosas:
//   - Injectable: decorador (etiqueta "@") que marca esta clase como un servicio
//     que NestJS puede crear e inyectar en otras clases.
//   - ForbiddenException: error listo para usar que, al lanzarse, hace que la API
//     responda con código HTTP 403 (prohibido / no autorizado). Lo usamos cuando
//     el negocio intenta superar el límite de su plan.
import { Injectable, ForbiddenException } from '@nestjs/common';

// SubscriptionPlan: el enum de planes ('BASICO' | 'PLUS' | 'PRO') generado por
// Prisma. Lo usamos como tipo para asegurar que solo manejamos planes válidos.
import { SubscriptionPlan } from '@prisma/client';

// PrismaService es nuestro "puente" hacia la base de datos. A través de
// this.prisma podremos contar empleados, citas, ubicaciones, etc.
import { PrismaService } from '../../prisma/prisma.service';

// De la configuración de planes importamos:
//   - PLAN_LIMITS: la tabla que asocia cada plan con sus límites.
//   - PlanLimits: la interfaz (molde) que describe la forma de esos límites.
import { PLAN_LIMITS, PlanLimits } from './plan-limits.config';

/**
 * Servicio que valida los LÍMITES del plan contratado por cada negocio (tenant).
 *
 * Antes de crear un empleado, una cita o una ubicación, otros módulos llaman a
 * estos métodos "check..." para verificar que el negocio no supere lo que su
 * plan permite. Si lo supera, se lanza un error 403 con un mensaje claro.
 * También expone getUsage() para mostrar al negocio cuánto lleva consumido.
 */
@Injectable() // <- Marca la clase como servicio inyectable de NestJS.
export class PlanLimitsService {
  // El constructor recibe el PrismaService que NestJS inyecta automáticamente.
  // "private readonly prisma" lo guarda como propiedad (this.prisma) de solo
  // lectura, para usarlo en todos los métodos de abajo.
  constructor(private readonly prisma: PrismaService) {}

  // ───────────────────────────────────────────────────────────────────────────
  // getLimitsForPlan(): dado un plan, devuelve su objeto de límites.
  // Recibe: el plan (BASICO/PLUS/PRO). Devuelve: el PlanLimits correspondiente.
  // No es async porque solo lee de una tabla en memoria (no toca la base de datos).
  // ───────────────────────────────────────────────────────────────────────────
  getLimitsForPlan(plan: SubscriptionPlan): PlanLimits {
    // PLAN_LIMITS[plan] usa el plan como clave para sacar sus límites del objeto.
    return PLAN_LIMITS[plan];
  }

  // ───────────────────────────────────────────────────────────────────────────
  // getTenantPlan(): averigua qué plan tiene contratado un negocio.
  // Recibe: el tenantId (id del negocio). Devuelve: una promesa con el plan.
  // ───────────────────────────────────────────────────────────────────────────
  async getTenantPlan(tenantId: string): Promise<SubscriptionPlan> {
    // findUnique = "encuentra UN registro único". Buscamos la suscripción cuyo
    // tenantId coincida. "await" espera a que la base de datos responda.
    const subscription = await this.prisma.subscription.findUnique({
      where: { tenantId },
    });
    // "subscription?.plan" => el "?." (optional chaining): si subscription es
    // null (no hay suscripción), no intenta leer .plan y devuelve undefined en
    // lugar de romper. El "?? 'BASICO'" (nullish coalescing): si lo de la
    // izquierda es null o undefined, usa 'BASICO' como valor por defecto. O sea:
    // "el plan de la suscripción, o BASICO si no hay suscripción".
    return subscription?.plan ?? 'BASICO';
  }

  // ───────────────────────────────────────────────────────────────────────────
  // checkEmployeeLimit(): lanza error si el negocio ya alcanzó el tope de
  // empleados activos de su plan. No devuelve nada (Promise<void>); solo valida.
  // ───────────────────────────────────────────────────────────────────────────
  async checkEmployeeLimit(tenantId: string): Promise<void> {
    // Averiguamos el plan del negocio y luego sacamos sus límites de la tabla.
    const plan = await this.getTenantPlan(tenantId);
    const limits = PLAN_LIMITS[plan];

    // count = "cuenta cuántos registros cumplen la condición". Aquí contamos los
    // empleados de ese negocio que están activos (isActive: true).
    const activeCount = await this.prisma.employee.count({
      where: { tenantId, isActive: true },
    });

    // ">=" significa "mayor o igual que". Si ya hay tantos (o más) empleados
    // como permite el plan, no se puede agregar otro -> lanzamos error 403.
    if (activeCount >= limits.maxEmployees) {
      throw new ForbiddenException(
        // El mensaje arma el texto interpolando el plan y el límite. El "+" une
        // dos trozos de texto en uno solo (concatenación de strings).
        `Tu plan ${plan} permite un máximo de ${limits.maxEmployees} empleados activos. ` +
          'Actualiza tu plan para agregar más.',
      );
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // checkAppointmentLimit(): lanza error si el negocio ya alcanzó el tope de
  // citas DE ESTE MES de su plan.
  // ───────────────────────────────────────────────────────────────────────────
  async checkAppointmentLimit(tenantId: string): Promise<void> {
    const plan = await this.getTenantPlan(tenantId);
    const limits = PLAN_LIMITS[plan];

    // "===" es comparación estricta (mismo valor Y mismo tipo). Si el límite es
    // -1, significa "ilimitado": salimos del método de inmediato (return) sin
    // validar nada, porque nunca se supera.
    if (limits.maxAppointmentsPerMonth === -1) return; // unlimited

    // Calculamos el rango "desde el inicio hasta el fin de ESTE mes".
    const now = new Date(); // el instante actual (fecha y hora de ahora).
    // new Date(año, mes, día): el día 1 del mes actual a las 00:00.
    // getMonth() devuelve el mes de 0 a 11 (0=enero ... 11=diciembre).
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    // Truco para el ÚLTIMO día del mes: pedimos el día 0 del MES SIGUIENTE
    // (getMonth() + 1), que JavaScript interpreta como "el último día del mes
    // actual", a las 23:59:59.
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Contamos las citas del negocio creadas dentro de este mes.
    const monthlyCount = await this.prisma.appointment.count({
      where: {
        tenantId,
        // createdAt entre inicio y fin del mes. gte = ">=" (mayor o igual),
        // lte = "<=" (menor o igual). Son operadores de filtro de Prisma.
        createdAt: { gte: startOfMonth, lte: endOfMonth },
        // notIn = "que NO esté en esta lista": no contamos las canceladas.
        status: { notIn: ['CANCELLED'] },
      },
    });

    // Si ya hay tantas citas (o más) como permite el plan -> error 403.
    if (monthlyCount >= limits.maxAppointmentsPerMonth) {
      throw new ForbiddenException(
        `Tu plan ${plan} permite un máximo de ${limits.maxAppointmentsPerMonth} citas por mes. ` +
          'Actualiza tu plan para crear más.',
      );
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // checkLocationLimit(): lanza error si el negocio ya alcanzó el tope de
  // ubicaciones activas de su plan.
  // ───────────────────────────────────────────────────────────────────────────
  async checkLocationLimit(tenantId: string): Promise<void> {
    const plan = await this.getTenantPlan(tenantId);
    const limits = PLAN_LIMITS[plan];

    // -1 = ilimitado: si es así, no hay nada que validar; salimos.
    if (limits.maxLocations === -1) return; // unlimited

    // Contamos las ubicaciones activas del negocio.
    const activeCount = await this.prisma.location.count({
      where: { tenantId, isActive: true },
    });

    // Si ya hay tantas (o más) como permite el plan -> error 403.
    if (activeCount >= limits.maxLocations) {
      throw new ForbiddenException(
        `Tu plan ${plan} permite un máximo de ${limits.maxLocations} ubicaciones. ` +
          'Actualiza tu plan para agregar más.',
      );
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // getUsage(): devuelve un resumen de "cuánto lleva consumido" el negocio
  // frente a los límites de su plan (para mostrarlo en el dashboard).
  // ───────────────────────────────────────────────────────────────────────────
  async getUsage(tenantId: string) {
    const plan = await this.getTenantPlan(tenantId);
    const limits = PLAN_LIMITS[plan];

    // Rango de "este mes", igual que en checkAppointmentLimit().
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Promise.all([...]) lanza las 3 consultas EN PARALELO y espera a que TODAS
    // terminen. Es más rápido que hacerlas una tras otra. El resultado es un
    // arreglo con las 3 respuestas en el mismo orden; con la desestructuración
    // "[a, b, c] = ..." guardamos cada una en su propia variable.
    const [employeeCount, appointmentCount, locationCount] = await Promise.all([
      // 1) Cantidad de empleados activos.
      this.prisma.employee.count({ where: { tenantId, isActive: true } }),
      // 2) Cantidad de citas de este mes (sin contar las canceladas).
      this.prisma.appointment.count({
        where: {
          tenantId,
          createdAt: { gte: startOfMonth, lte: endOfMonth },
          status: { notIn: ['CANCELLED'] },
        },
      }),
      // 3) Cantidad de ubicaciones activas.
      this.prisma.location.count({ where: { tenantId, isActive: true } }),
    ]);

    // Devolvemos un objeto resumen. Para cada recurso indicamos:
    //   - current: cuánto se usa ahora.
    //   - limit: el tope del plan.
    //   - unlimited: si ese tope es -1 (ilimitado) -> true; si no -> false.
    return {
      plan, // qué plan tiene el negocio.
      employees: {
        current: employeeCount,
        limit: limits.maxEmployees,
        unlimited: false, // empleados nunca es ilimitado en ningún plan.
      },
      appointmentsThisMonth: {
        current: appointmentCount,
        limit: limits.maxAppointmentsPerMonth,
        // "=== -1" da true cuando el límite es ilimitado.
        unlimited: limits.maxAppointmentsPerMonth === -1,
      },
      locations: {
        current: locationCount,
        limit: limits.maxLocations,
        unlimited: limits.maxLocations === -1,
      },
      // features: qué funcionalidades extra incluye el plan (booleanos).
      features: {
        fullReports: limits.fullReports,
        exportReports: limits.exportReports,
      },
    };
  }
}
