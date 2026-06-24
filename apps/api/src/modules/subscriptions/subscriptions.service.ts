// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// De NestJS importamos:
//   - Injectable: decorador que marca esta clase como servicio inyectable.
//   - NotFoundException: error que hace responder a la API con HTTP 404 (no
//     encontrado), que usamos cuando el negocio no tiene suscripción.
import { Injectable, NotFoundException } from '@nestjs/common';

// PrismaService: el puente hacia la base de datos para leer suscripciones y
// facturas.
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Servicio que consulta la SUSCRIPCIÓN del negocio (su plan, estado, etc.) y su
 * historial de FACTURAS. Es de solo lectura: no crea ni modifica suscripciones
 * aquí (eso lo gestiona el módulo de pagos/Stripe).
 */
@Injectable() // <- Marca la clase como servicio inyectable de NestJS.
export class SubscriptionsService {
  // El constructor recibe el PrismaService inyectado por NestJS y lo guarda como
  // propiedad de solo lectura (this.prisma) para usarlo en los métodos.
  constructor(private readonly prisma: PrismaService) {}

  // ───────────────────────────────────────────────────────────────────────────
  // getSubscription(): devuelve la suscripción de un negocio.
  // Recibe: el tenantId (id del negocio). Devuelve: el registro de suscripción.
  // Lanza 404 si el negocio no tiene ninguna suscripción registrada.
  // ───────────────────────────────────────────────────────────────────────────
  async getSubscription(tenantId: string) {
    // findUnique = "encuentra UN registro único": la suscripción de ese negocio.
    const subscription = await this.prisma.subscription.findUnique({
      where: { tenantId },
    });
    // "!subscription" se lee como "si NO hay suscripción" (es null). En ese caso
    // lanzamos un error 404 con un mensaje para el usuario.
    if (!subscription) {
      throw new NotFoundException('No se encontró suscripción para este negocio');
    }
    // Si existe, la devolvemos tal cual.
    return subscription;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // getInvoices(): devuelve TODAS las facturas del negocio, de la más reciente
  // a la más antigua. Recibe: el tenantId. Devuelve: una lista (array) de facturas.
  // ───────────────────────────────────────────────────────────────────────────
  async getInvoices(tenantId: string) {
    // findMany = "encuentra VARIOS registros". Traemos todas las facturas de ese
    // negocio. "orderBy createdAt: 'desc'" las ordena por fecha de creación de
    // forma descendente ('desc' = de la más nueva a la más vieja).
    return this.prisma.invoice.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
