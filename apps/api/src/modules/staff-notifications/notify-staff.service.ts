import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WebPushService } from './web-push.service';

export interface NotifyStaffInput {
  tenantId: string;
  type: string;
  section: string;
  title: string;
  body: string;
  link?: string;       // link por defecto (vista empleado)
  adminLink?: string;  // si esta presente, los admins usan este link en lugar de `link`
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, any>;
  audience: NotifyAudience;
}

export type NotifyAudience =
  | { kind: 'employee_and_admins'; employeeId: string }
  | { kind: 'admins' }
  | { kind: 'users'; userIds: string[] };

// Permiso que identifica a un "admin" del negocio (mismo discriminador
// que usa el sidebar). Module = 'employees', action = 'create'.
const ADMIN_PERMISSION_MODULE = 'employees';
const ADMIN_PERMISSION_ACTION = 'create';

@Injectable()
export class NotifyStaffService {
  private readonly logger = new Logger(NotifyStaffService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly webPush: WebPushService,
  ) {}

  async notify(input: NotifyStaffInput): Promise<void> {
    const recipientIds = await this.resolveAudience(
      input.tenantId,
      input.audience,
    );
    if (recipientIds.length === 0) return;

    // Para resolver el link correcto por destinatario: si es admin
    // (tiene permiso employees.create) y hay adminLink, usa adminLink;
    // si no, usa link.
    const adminIdSet = input.adminLink
      ? new Set(await this.getAdminUserIds(input.tenantId))
      : new Set<string>();

    const now = new Date();
    const records = recipientIds.map((userId) => ({
      tenantId: input.tenantId,
      userId,
      type: input.type,
      section: input.section,
      title: input.title,
      body: input.body,
      link: (adminIdSet.has(userId) ? input.adminLink : input.link) ?? null,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      metadata: input.metadata ?? undefined,
      createdAt: now,
    }));

    // createMany no devuelve los ids; los necesitamos para que el push
    // referencie la notificacion exacta. Iteramos uno a uno.
    const created = await Promise.all(
      records.map((r) => this.prisma.staffNotification.create({ data: r })),
    );

    // Disparar push en paralelo (no esperamos a que termine para no
    // bloquear el evento de dominio que nos llamo).
    void Promise.all(
      created.map((notif) =>
        this.webPush.sendToUser(notif.userId, {
          title: notif.title,
          body: notif.body,
          link: notif.link ?? undefined,
          tag: `${notif.section}:${notif.entityId ?? notif.id}`,
          notificationId: notif.id,
        }),
      ),
    ).catch((err) =>
      this.logger.warn(`Push batch failed: ${err?.message ?? err}`),
    );
  }

  private async resolveAudience(
    tenantId: string,
    audience: NotifyAudience,
  ): Promise<string[]> {
    if (audience.kind === 'users') {
      return audience.userIds;
    }

    if (audience.kind === 'admins') {
      return this.getAdminUserIds(tenantId);
    }

    // employee_and_admins
    const [employeeUserId, adminIds] = await Promise.all([
      this.getEmployeeUserId(tenantId, audience.employeeId),
      this.getAdminUserIds(tenantId),
    ]);

    const set = new Set<string>(adminIds);
    if (employeeUserId) set.add(employeeUserId);
    return Array.from(set);
  }

  private async getEmployeeUserId(
    tenantId: string,
    employeeId: string,
  ): Promise<string | null> {
    const emp = await this.prisma.employee.findFirst({
      where: { id: employeeId, tenantId },
      select: { userId: true },
    });
    return emp?.userId ?? null;
  }

  private async getAdminUserIds(tenantId: string): Promise<string[]> {
    const userRoles = await this.prisma.userRole.findMany({
      where: {
        tenantId,
        role: {
          rolePermissions: {
            some: {
              permission: {
                module: ADMIN_PERMISSION_MODULE,
                action: ADMIN_PERMISSION_ACTION,
              },
            },
          },
        },
        user: { isActive: true },
      },
      select: { userId: true },
      distinct: ['userId'],
    });
    return userRoles.map((ur) => ur.userId);
  }
}
