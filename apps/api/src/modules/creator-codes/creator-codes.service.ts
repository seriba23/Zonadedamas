import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { StripeService } from '../stripe/stripe.service';
import { CreateInfluencerDto, UpdateInfluencerDto } from './dto/influencer.dto';
import { referralState, monthsBetween } from './creator-codes.config';

@Injectable()
export class CreatorCodesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
  ) {}

  // ─── LISTADO ──────────────────────────────────────

  async listInfluencers(filters: {
    page?: number;
    perPage?: number;
    status?: string;
    search?: string;
  }) {
    const page = filters.page || 1;
    const perPage = Math.min(filters.perPage || 20, 100);
    const skip = (page - 1) * perPage;

    const where: any = {};
    if (
      filters.status === 'PENDING' ||
      filters.status === 'APPROVED' ||
      filters.status === 'SUSPENDED'
    ) {
      where.status = filters.status;
    }
    if (filters.search) {
      where.OR = [
        { firstName: { contains: filters.search } },
        { lastName: { contains: filters.search } },
        { email: { contains: filters.search } },
        { codes: { some: { code: { contains: filters.search } } } },
      ];
    }

    const [influencers, total] = await Promise.all([
      this.prisma.influencer.findMany({
        where,
        skip,
        take: perPage,
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        include: {
          codes: {
            where: { isActive: true },
            select: { id: true, code: true, createdAt: true },
          },
          _count: { select: { codes: true, payouts: true } },
        },
      }),
      this.prisma.influencer.count({ where }),
    ]);

    return {
      data: influencers.map((inf) => ({
        id: inf.id,
        email: inf.email,
        firstName: inf.firstName,
        lastName: inf.lastName,
        phone: inf.phone,
        status: inf.status,
        approvedAt: inf.approvedAt,
        stripeOnboardingComplete: inf.stripeOnboardingComplete,
        notes: inf.notes,
        createdAt: inf.createdAt,
        activeCode: inf.codes[0]?.code ?? null,
        codesCount: inf._count.codes,
        payoutsCount: inf._count.payouts,
      })),
      meta: { total, page, perPage, totalPages: Math.ceil(total / perPage) },
    };
  }

  async getInfluencerDetail(id: string) {
    const influencer = await this.prisma.influencer.findUnique({
      where: { id },
      include: {
        codes: {
          orderBy: { createdAt: 'desc' },
          include: { usages: true },
        },
      },
    });
    if (!influencer) throw new NotFoundException('Influencer no encontrado');

    const now = new Date();

    // Todos los usos de todos los códigos del influencer
    const usages = influencer.codes.flatMap((c) =>
      c.usages.map((u) => ({ ...u, code: c.code })),
    );
    const tenantIds = usages.map((u) => u.tenantId);

    // Tenants referidos (no hay relación FK directa → lookup por ids)
    const tenants = tenantIds.length
      ? await this.prisma.tenant.findMany({
          where: { id: { in: tenantIds } },
          select: {
            id: true,
            name: true,
            slug: true,
            tenantType: true,
            subscription: { select: { status: true, cancelledAt: true } },
          },
        })
      : [];
    const tenantMap = new Map(tenants.map((t) => [t.id, t]));

    // Comisiones agrupadas por uso
    const payouts = await this.prisma.creatorPayout.findMany({
      where: { influencerId: id },
      orderBy: { forMonth: 'desc' },
    });
    const paidByUsage = new Map<string, { count: number; sum: number }>();
    let totalAccrued = 0;
    let totalPaid = 0;
    let totalPending = 0;
    for (const p of payouts) {
      const amount = Number(p.amount);
      totalAccrued += amount;
      if (p.transferredAt) totalPaid += amount;
      else totalPending += amount;
      const cur = paidByUsage.get(p.usageId) || { count: 0, sum: 0 };
      cur.count += 1;
      cur.sum += amount;
      paidByUsage.set(p.usageId, cur);
    }

    // Clientes referidos con estado calculado
    const clients = usages.map((u) => {
      const tenant = tenantMap.get(u.tenantId);
      const sub = tenant?.subscription ?? null;
      const state = referralState(u, sub, now);
      const commissions = paidByUsage.get(u.id) || { count: 0, sum: 0 };
      return {
        usageId: u.id,
        tenantId: u.tenantId,
        tenantName: tenant?.name ?? '(negocio eliminado)',
        tenantSlug: tenant?.slug ?? null,
        code: u.code,
        appliedAt: u.appliedAt,
        monthsActive: monthsBetween(u.appliedAt, now),
        subscriptionStatus: sub?.status ?? null,
        state,
        commissionsCount: commissions.count,
        commissionsSum: commissions.sum,
      };
    });

    const stateCounts = clients.reduce(
      (acc, c) => {
        acc[c.state] = (acc[c.state] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      data: {
        influencer: {
          id: influencer.id,
          email: influencer.email,
          firstName: influencer.firstName,
          lastName: influencer.lastName,
          phone: influencer.phone,
          status: influencer.status,
          notes: influencer.notes,
          stripeOnboardingComplete: influencer.stripeOnboardingComplete,
          createdAt: influencer.createdAt,
          approvedAt: influencer.approvedAt,
        },
        codes: influencer.codes.map((c) => ({
          id: c.id,
          code: c.code,
          isActive: c.isActive,
          usagesCount: c.usages.length,
        })),
        clients,
        stateCounts: {
          ACTIVO: stateCounts.ACTIVO || 0,
          PAGANDO: stateCounts.PAGANDO || 0,
          EN_RIESGO: stateCounts.EN_RIESGO || 0,
          PERDIDO: stateCounts.PERDIDO || 0,
        },
        totals: {
          referredClients: clients.length,
          accrued: totalAccrued,
          paid: totalPaid,
          pending: totalPending,
        },
        payouts: payouts.map((p) => ({
          id: p.id,
          usageId: p.usageId,
          amount: Number(p.amount),
          forMonth: p.forMonth,
          transferred: !!p.transferredAt,
          transferredAt: p.transferredAt,
          stripeTransferId: p.stripeTransferId,
        })),
      },
    };
  }

  // ─── ALTA / EDICIÓN ───────────────────────────────

  async createInfluencer(dto: CreateInfluencerDto, adminId: string) {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.prisma.influencer.findUnique({
      where: { email },
    });
    if (existing) {
      throw new ConflictException('Ya existe un influencer con ese email');
    }

    const influencer = await this.prisma.influencer.create({
      data: {
        email,
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        phone: dto.phone?.trim() || null,
        notes: dto.notes?.trim() || null,
        status: 'PENDING',
      },
    });

    return { data: influencer };
  }

  async updateInfluencer(id: string, dto: UpdateInfluencerDto) {
    const influencer = await this.prisma.influencer.findUnique({ where: { id } });
    if (!influencer) throw new NotFoundException('Influencer no encontrado');

    const updated = await this.prisma.influencer.update({
      where: { id },
      data: {
        ...(dto.firstName !== undefined && { firstName: dto.firstName.trim() }),
        ...(dto.lastName !== undefined && { lastName: dto.lastName.trim() }),
        ...(dto.phone !== undefined && { phone: dto.phone?.trim() || null }),
        ...(dto.notes !== undefined && { notes: dto.notes?.trim() || null }),
      },
    });

    return { data: updated };
  }

  // ─── APROBACIÓN (genera código automático) ────────

  async approveInfluencer(id: string, adminId: string) {
    const influencer = await this.prisma.influencer.findUnique({
      where: { id },
      include: { codes: { where: { isActive: true } } },
    });
    if (!influencer) throw new NotFoundException('Influencer no encontrado');

    if (influencer.status === 'APPROVED' && influencer.codes.length > 0) {
      throw new BadRequestException('El influencer ya está aprobado y tiene un código activo');
    }

    // Aprobar + generar código en una transacción
    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.influencer.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approvedAt: new Date(),
          approvedBy: adminId,
        },
      });

      // Si ya tiene un código activo (caso reactivación), no generar otro
      let code = influencer.codes[0] ?? null;
      if (!code) {
        const generated = await this.generateUniqueCode(tx, influencer.firstName);
        code = await tx.creatorCode.create({
          data: { code: generated, influencerId: id },
        });
      }

      return { influencer: updated, code };
    });

    return { data: result };
  }

  async suspendInfluencer(id: string) {
    const influencer = await this.prisma.influencer.findUnique({ where: { id } });
    if (!influencer) throw new NotFoundException('Influencer no encontrado');
    if (influencer.status === 'SUSPENDED') {
      throw new BadRequestException('El influencer ya está suspendido');
    }

    const updated = await this.prisma.influencer.update({
      where: { id },
      data: { status: 'SUSPENDED' },
    });

    return { data: updated };
  }

  async reactivateInfluencer(id: string) {
    const influencer = await this.prisma.influencer.findUnique({ where: { id } });
    if (!influencer) throw new NotFoundException('Influencer no encontrado');
    if (influencer.status !== 'SUSPENDED') {
      throw new BadRequestException('Solo se puede reactivar un influencer suspendido');
    }

    const updated = await this.prisma.influencer.update({
      where: { id },
      data: { status: 'APPROVED' },
    });

    return { data: updated };
  }

  async deleteInfluencer(id: string) {
    const influencer = await this.prisma.influencer.findUnique({
      where: { id },
      include: { _count: { select: { payouts: true } } },
    });
    if (!influencer) throw new NotFoundException('Influencer no encontrado');

    // No permitir borrar si ya generó comisiones (historial financiero)
    if (influencer._count.payouts > 0) {
      throw new BadRequestException(
        'No se puede eliminar: el influencer ya tiene comisiones registradas. Suspéndelo en su lugar.',
      );
    }

    await this.prisma.influencer.delete({ where: { id } });
    return { data: { message: 'Influencer eliminado' } };
  }

  // ─── ACCESO AL PANEL (contraseña) ─────────────────

  /** Método 1: el super-admin genera una contraseña temporal y la comparte. */
  async generatePassword(id: string) {
    const influencer = await this.prisma.influencer.findUnique({ where: { id } });
    if (!influencer) throw new NotFoundException('Influencer no encontrado');

    // Contraseña legible: 3 bloques tipo "k7Pm-9QnX-2Rdy" (cumple regla 8+/núm/símbolo)
    const raw = randomBytes(9).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 9);
    const tempPassword = `${raw.slice(0, 4)}-${raw.slice(4, 8)}#${raw.slice(8) || '7'}`;
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    await this.prisma.influencer.update({
      where: { id },
      data: { passwordHash, inviteToken: null, inviteTokenExpiresAt: null },
    });

    return { data: { tempPassword, email: influencer.email } };
  }

  /** Método 2: genera un link de invitación para que el influencer fije su contraseña. */
  async createInviteLink(id: string) {
    const influencer = await this.prisma.influencer.findUnique({ where: { id } });
    if (!influencer) throw new NotFoundException('Influencer no encontrado');

    const token = randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 días

    await this.prisma.influencer.update({
      where: { id },
      data: { inviteToken: token, inviteTokenExpiresAt: expiresAt },
    });

    const base = process.env.WEB_URL || 'http://localhost:3000';
    const url = `${base}/creator/set-password?token=${token}`;
    return { data: { url, email: influencer.email, expiresAt } };
  }

  // ─── STRIPE CONNECT (cobro de comisiones) ─────────

  async createStripeOnboardingLink(id: string, returnUrl: string) {
    const influencer = await this.prisma.influencer.findUnique({ where: { id } });
    if (!influencer) throw new NotFoundException('Influencer no encontrado');
    if (influencer.status !== 'APPROVED') {
      throw new BadRequestException(
        'El influencer debe estar aprobado antes de configurar sus cobros',
      );
    }

    const result = await this.stripe.createInfluencerConnectLink(id, returnUrl);
    return { data: result };
  }

  async getStripeStatus(id: string) {
    const result = await this.stripe.getInfluencerConnectStatus(id);
    return { data: result };
  }

  // ─── GENERACIÓN DE CÓDIGO ─────────────────────────

  /**
   * Genera un código único tipo "LUNA8X3K": hasta 4 letras del nombre +
   * 4 caracteres aleatorios. Sin caracteres ambiguos (0/O, 1/I/L).
   */
  private async generateUniqueCode(
    tx: any,
    firstName: string,
  ): Promise<string> {
    const alpha = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const alphanum = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

    // Prefijo: hasta 4 letras del nombre (sin ambiguas), completado al azar
    let base = firstName
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .replace(/[OIL]/g, '')
      .slice(0, 4);
    while (base.length < 4) {
      base += alpha[Math.floor(Math.random() * alpha.length)];
    }

    for (let attempt = 0; attempt < 10; attempt++) {
      let suffix = '';
      for (let i = 0; i < 4; i++) {
        suffix += alphanum[Math.floor(Math.random() * alphanum.length)];
      }
      const candidate = base + suffix;
      const exists = await tx.creatorCode.findUnique({
        where: { code: candidate },
      });
      if (!exists) return candidate;
    }

    throw new ConflictException(
      'No se pudo generar un código único, intenta de nuevo',
    );
  }
}
