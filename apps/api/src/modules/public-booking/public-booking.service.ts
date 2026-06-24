// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// De NestJS:
//   - Injectable: decorador que marca esta clase como servicio inyectable.
//   - NotFoundException: error listo para usar que responde con HTTP 404.
import { Injectable, NotFoundException } from '@nestjs/common';

// PrismaService: el "puente" hacia la base de datos (lee/escribe tablas).
import { PrismaService } from '../../prisma/prisma.service';

// TenantsService: lógica para encontrar el negocio (tenant) por su slug.
import { TenantsService } from '../tenants/tenants.service';

// AvailabilityService: calcula los horarios libres respetando horarios y citas.
import { AvailabilityService } from '../availability/availability.service';

// AppointmentsService: crea la cita real con su transacción anti-doble-reserva.
import { AppointmentsService } from '../appointments/appointments.service';

// Los DTO con la forma/validación de los datos de entrada (definidos en /dto).
import { PublicAvailabilityQueryDto, PublicBookDto } from './dto/public-booking.dto';

// @Injectable() marca la clase como servicio que NestJS puede crear e inyectar.
@Injectable()
export class PublicBookingService {
  // CONSTRUCTOR + INYECCIÓN: NestJS pasa automáticamente cada dependencia.
  // "private readonly" las guarda como propiedades de solo lectura (this.xxx).
  constructor(
    private readonly prisma: PrismaService,                 // base de datos
    private readonly tenantsService: TenantsService,        // resolver negocio
    private readonly availabilityService: AvailabilityService, // calcular slots
    private readonly appointmentsService: AppointmentsService, // crear la cita
  ) {}

  // ───────────────────────────────────────────────────────────────────────────
  // resolveTenant(): recibe el "slug" del negocio (su nombre en la URL) y
  // devuelve el negocio completo. Toda ruta pública empieza resolviendo esto,
  // porque sin auth, el slug es lo único que identifica de qué negocio hablamos.
  // ───────────────────────────────────────────────────────────────────────────
  async resolveTenant(slug: string) {
    // Delegamos en TenantsService.findBySlug, que lanza 404 si no existe.
    return this.tenantsService.findBySlug(slug);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // getServices(): lista los servicios "reservables" del negocio para mostrarlos
  // en la página pública. Recibe el id del negocio y devuelve un arreglo.
  // ───────────────────────────────────────────────────────────────────────────
  async getServices(tenantId: string) {
    // findMany = "encuentra TODOS los registros que cumplan la condición".
    return this.prisma.service.findMany({
      where: {
        tenantId,            // SIEMPRE filtramos por negocio (multi-tenant).
        isActive: true,      // solo servicios activos (no archivados).
        // employeeServices.some(...) => "que tenga AL MENOS UN" empleado activo
        // capaz de hacerlo. Sin profesional activo, no tiene sentido ofrecerlo.
        employeeServices: { some: { employee: { isActive: true } } },
      },
      // select: elegimos solo los campos que el frontend necesita mostrar.
      select: {
        id: true,
        name: true,
        description: true,
        durationMinutes: true,
        price: true,
        color: true,
        category: true,
        subcategory: true,
      },
      // orderBy: ordenamos por "sortOrder" ascendente (asc = de menor a mayor),
      // que es el orden manual que el negocio definió para sus servicios.
      orderBy: { sortOrder: 'asc' },
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // getEmployees(): lista los profesionales activos del negocio (para que el
  // cliente elija con quién reservar). Recibe el id del negocio.
  // ───────────────────────────────────────────────────────────────────────────
  async getEmployees(tenantId: string) {
    return this.prisma.employee.findMany({
      where: { tenantId, isActive: true }, // del negocio y activos.
      select: {
        id: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        color: true,
        bio: true,
        // employeeServices: traemos qué servicios sabe hacer cada empleado,
        // pero solo el serviceId (basta para que el frontend cruce datos).
        employeeServices: {
          select: { serviceId: true },
        },
      },
      orderBy: { sortOrder: 'asc' }, // mismo orden manual definido por el negocio.
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // getAvailability(): traduce la consulta pública al formato que entiende el
  // AvailabilityService y delega en él el cálculo de horarios libres.
  // Recibe el DTO de consulta y el id del negocio.
  // ───────────────────────────────────────────────────────────────────────────
  async getAvailability(query: PublicAvailabilityQueryDto, tenantId: string) {
    // Llamamos al servicio de disponibilidad pasándole los datos uno por uno.
    return this.availabilityService.getAvailableSlots(
      {
        serviceIds: query.serviceIds,   // servicios a encajar
        startDate: query.startDate,     // desde qué día
        endDate: query.endDate,         // hasta qué día
        employeeId: query.employeeId,   // (opcional) profesional concreto
        locationId: query.locationId,   // (opcional) sucursal concreta
      },
      tenantId, // siempre acotado al negocio.
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // book(): el corazón del módulo. Crea la reserva. Recibe el DTO de reserva y
  // el id del negocio. Pasos: 1) cliente find-or-create, 2) validar empleado,
  // 3) delegar la creación de la cita (con su transacción anti-doble-reserva).
  // ───────────────────────────────────────────────────────────────────────────
  async book(dto: PublicBookDto, tenantId: string) {
    // 1. Find-or-create client by email within tenant
    // ── BUSCAR el cliente por email DENTRO de este negocio ──
    // "let" (no "const") porque puede REASIGNARSE más abajo si hay que crearlo.
    // findFirst = la PRIMERA coincidencia. Buscamos por negocio + email para no
    // crear clientes duplicados: si ese correo ya reservó antes, lo reutilizamos.
    let client = await this.prisma.client.findFirst({
      where: {
        tenantId,
        email: dto.client.email,
      },
    });

    // "!client" se lee "si NO encontramos cliente". En ese caso, lo CREAMOS.
    // Esta es la parte "or-create" del patrón find-or-create.
    if (!client) {
      client = await this.prisma.client.create({
        data: {
          tenantId,                       // siempre asociado al negocio
          firstName: dto.client.firstName,
          lastName: dto.client.lastName,
          email: dto.client.email,
          phone: dto.client.phone,
          source: 'ONLINE',              // marca que vino del flujo público web
        },
      });
    }

    // 2. Resolve employee's locationId
    // ── Validar el profesional y averiguar su sucursal (locationId) ──
    // findFirst con id + negocio + activo: confirma que el empleado existe,
    // pertenece a ESTE negocio y está activo (no se reserva con uno dado de baja).
    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, tenantId, isActive: true },
      select: { id: true, locationId: true }, // solo necesitamos su sucursal.
    });

    // Si no existe (o no cumple las condiciones), abortamos con un 404.
    if (!employee) {
      throw new NotFoundException('Profesional no encontrado');
    }

    // 3. Delegate to AppointmentsService.create
    // ── Delegar la creación real de la cita ──
    // AppointmentsService.create hace el trabajo pesado: dentro de una
    // TRANSACCIÓN con aislamiento Serializable comprueba que el horario siga
    // libre y crea la cita, evitando la "doble reserva" (que dos clientes
    // tomen el mismo hueco a la vez). Aquí solo le pasamos los datos ya resueltos.
    return this.appointmentsService.create(
      {
        locationId: employee.locationId,        // sucursal del profesional
        clientId: client.id,                    // cliente (hallado o creado)
        employeeId: dto.employeeId,             // profesional elegido
        serviceIds: dto.serviceIds,             // servicios a reservar
        startTime: dto.startTime,               // hora de inicio elegida
        notes: dto.notes,                       // notas opcionales
        source: 'ONLINE',                       // origen: reserva pública web
        serviceAssignments: dto.serviceAssignments, // asignación por servicio
      },
      tenantId, // siempre acotado al negocio.
    );
  }
}
