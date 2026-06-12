import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ListNotificationsDto } from './dto/list-notifications.dto';
import { SubscribePushDto } from './dto/subscribe-push.dto';

@Injectable()
export class StaffNotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, filters: ListNotificationsDto) {
    const page = filters.page ?? 1;
    const perPage = filters.perPage ?? 20;
    const skip = (page - 1) * perPage;

    const where: any = { userId };
    if (filters.section) where.section = filters.section;
    if (filters.unreadOnly === 'true') where.readAt = null;

    const [items, total] = await Promise.all([
      this.prisma.staffNotification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: perPage,
      }),
      this.prisma.staffNotification.count({ where }),
    ]);

    return {
      data: items,
      meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
    };
  }

  async unreadCounts(userId: string) {
    const grouped = await this.prisma.staffNotification.groupBy({
      by: ['section'],
      where: { userId, readAt: null },
      _count: { _all: true },
    });

    const counts: Record<string, number> = {};
    let total = 0;
    for (const row of grouped) {
      counts[row.section] = row._count._all;
      total += row._count._all;
    }
    return { data: { counts, total } };
  }

  async markRead(userId: string, id: string) {
    await this.prisma.staffNotification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { data: { ok: true } };
  }

  async markAllRead(userId: string, section?: string) {
    const where: any = { userId, readAt: null };
    if (section) where.section = section;
    const result = await this.prisma.staffNotification.updateMany({
      where,
      data: { readAt: new Date() },
    });
    return { data: { count: result.count } };
  }

  async subscribePush(userId: string, dto: SubscribePushDto) {
    // Upsert por endpoint (un endpoint = un device). Si el mismo endpoint
    // pertenecia a otro user, se reasigna.
    const sub = await this.prisma.pushSubscription.upsert({
      where: { endpoint: dto.endpoint },
      create: {
        userId,
        endpoint: dto.endpoint,
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
        userAgent: dto.userAgent ?? null,
      },
      update: {
        userId,
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
        userAgent: dto.userAgent ?? null,
        lastUsedAt: new Date(),
      },
    });
    return { data: { id: sub.id } };
  }

  async unsubscribePush(userId: string, endpoint: string) {
    await this.prisma.pushSubscription.deleteMany({
      where: { userId, endpoint },
    });
    return { data: { ok: true } };
  }
}
