import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateServiceDto, UpdateServiceDto } from './dto/create-service.dto';
import { PaginationDto, buildPaginatedResponse } from '../../common/dto/pagination.dto';

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  // Map business types to professions
  private readonly TYPE_PROFESSIONS: Record<string, string[]> = {
    BARBERIA: ['Barbero/a'],
    SALON: ['Estilista', 'Colorista'],
    SPA: ['Masajista', 'Esteticista', 'Cosmetólogo/a', 'Terapeuta'],
    CLINICA: ['Cosmetólogo/a', 'Esteticista'],
    TATUAJES: ['Tatuador/a', 'Piercer'],
  };

  async autoPopulateFromCatalog(tenantId: string) {
    // Get tenant business type
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { businessType: true },
    });
    if (!tenant?.businessType) return { created: 0 };

    // Get professions for this business type
    const types = tenant.businessType.split(',').map((t) => t.trim());
    const professions = new Set<string>();
    for (const type of types) {
      const profs = this.TYPE_PROFESSIONS[type] || [];
      profs.forEach((p) => professions.add(p));
    }
    if (professions.size === 0) return { created: 0 };

    // Get catalog services for these professions
    const catalogServices = await this.prisma.serviceCatalog.findMany({
      where: { category: { in: Array.from(professions) }, isActive: true },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    });

    // Get existing service names for this tenant
    const existing = await this.prisma.service.findMany({
      where: { tenantId },
      select: { name: true },
    });
    const existingNames = new Set(existing.map((s) => s.name));

    // Create missing services
    const toCreate = catalogServices.filter((cs) => !existingNames.has(cs.name));
    if (toCreate.length === 0) return { created: 0 };

    await this.prisma.service.createMany({
      data: toCreate.map((cs) => ({
        tenantId,
        name: cs.name,
        durationMinutes: 30,
        price: 0,
        category: cs.category,
        subcategory: cs.category,
        isActive: true,
      })),
      skipDuplicates: true,
    });

    return { created: toCreate.length };
  }

  async findAll(tenantId: string, pagination: PaginationDto) {
    const page = pagination.page ?? 1;
    const perPage = pagination.perPage ?? 20;
    const skip = (page - 1) * perPage;

    const where = { tenantId, isActive: true };

    const [data, total] = await Promise.all([
      this.prisma.service.findMany({
        where,
        skip,
        take: perPage,
        orderBy: { name: 'asc' },
        include: {
          addons: true,
          serviceResources: { include: { resource: true } },
          _count: { select: { employeeServices: true } },
        },
      }),
      this.prisma.service.count({ where }),
    ]);

    return buildPaginatedResponse(data, total, pagination);
  }

  async findOne(id: string, tenantId: string) {
    const service = await this.prisma.service.findFirst({
      where: { id, tenantId },
      include: {
        addons: true,
        serviceResources: { include: { resource: true } },
        employeeServices: {
          include: {
            employee: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, color: true, jobTitle: true, isActive: true } },
          },
        },
      },
    });

    if (!service) throw new NotFoundException('Servicio no encontrado');
    return service;
  }

  async create(tenantId: string, dto: CreateServiceDto) {
    const service = await this.prisma.service.create({
      data: {
        ...dto,
        tenantId,
        isActive: dto.isActive ?? true,
      },
    });

    // Auto-asignacion para FREELANCER: el flujo de "asignar empleados"
    // no aplica cuando solo hay 1 persona (el dueno=empleado). El servicio
    // se asigna automaticamente al unico empleado activo del tenant para
    // que aparezca disponible para reservar de inmediato.
    //
    // Cuando el tenant migre a BUSINESS (upgrade Pro -> Plus) la
    // asignacion del freelancer se conserva: solo agrega a los empleados
    // nuevos al servicio, sin volver a marcarse a si mismo.
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { tenantType: true },
    });
    if (tenant?.tenantType === 'FREELANCER') {
      const employee = await this.prisma.employee.findFirst({
        where: { tenantId, isActive: true },
        select: { id: true },
      });
      if (employee) {
        await this.prisma.employeeService.create({
          data: { employeeId: employee.id, serviceId: service.id },
        });
      }
    }

    return service;
  }

  async update(id: string, tenantId: string, dto: UpdateServiceDto) {
    await this.findOne(id, tenantId);
    return this.prisma.service.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string, tenantId: string) {
    await this.findOne(id, tenantId);
    await this.prisma.service.update({
      where: { id },
      data: { isActive: false },
    });
    return { message: 'Servicio desactivado' };
  }
}
