// ─────────────────────────────────────────────────────────────────────────────
// SERVICIO del portal del cliente: aquí vive TODA la lógica de negocio.
// El controlador solo recibe las peticiones; este servicio es quien consulta la
// base de datos, valida reglas, crea tokens, cifra contraseñas, etc.
// ─────────────────────────────────────────────────────────────────────────────

// De NestJS, varios tipos de error HTTP listos para lanzar:
//   - Injectable: marca la clase como inyectable.
//   - UnauthorizedException: HTTP 401 (no autenticado / credenciales malas).
//   - NotFoundException: HTTP 404 (no encontrado).
//   - BadRequestException: HTTP 400 (petición inválida).
//   - ConflictException: HTTP 409 (conflicto, p. ej. algo que ya existe).
import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';

// JwtService: para FIRMAR (crear) los access tokens JWT del cliente.
import { JwtService } from '@nestjs/jwt';

// bcrypt: librería para CIFRAR (hash) contraseñas y refresh tokens, y para
// COMPARARLOS de forma segura. "* as bcrypt" importa todo el módulo bajo el
// nombre "bcrypt".
import * as bcrypt from 'bcrypt';

// uuid v4: genera identificadores aleatorios únicos. Lo usamos como valor del
// refresh token (un texto imposible de adivinar).
import { v4 as uuidv4 } from 'uuid';

// PrismaService: puente a la base de datos.
import { PrismaService } from '../../prisma/prisma.service';

// Servicios de otros módulos que reutilizamos para no duplicar lógica:
import { TenantsService } from '../tenants/tenants.service';            // resolver negocio por slug
import { AppointmentsService } from '../appointments/appointments.service'; // crear/cancelar/reagendar citas
import { AvailabilityService } from '../availability/availability.service'; // calcular horarios libres

// Los DTOs (formas de los datos de entrada).
import { ClientRegisterDto } from './dto/client-register.dto';
import { ClientLoginDto } from './dto/client-login.dto';
import { ClientUpdateProfileDto, ClientChangePasswordDto } from './dto/client-update-profile.dto';
import { CreateReviewDto } from './dto/create-review.dto';

// EventEmitter2: para emitir "eventos" internos (ej. "se creó una reseña") que
// otros módulos pueden escuchar y reaccionar (notificaciones, estadísticas...).
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable() // <- Servicio inyectable de NestJS.
export class ClientPortalService {
  // El constructor recibe (inyectadas por NestJS) todas las herramientas que el
  // servicio necesita. Cada "private readonly X" queda como propiedad this.X.
  constructor(
    private readonly prisma: PrismaService,                   // base de datos
    private readonly jwtService: JwtService,                  // firmar tokens
    private readonly tenantsService: TenantsService,          // negocios
    private readonly appointmentsService: AppointmentsService, // citas
    private readonly availabilityService: AvailabilityService, // disponibilidad
    private readonly eventEmitter: EventEmitter2,             // eventos internos
  ) {}

  // ─── RESOLUCIÓN DEL NEGOCIO (TENANT) ────────────────

  // resolveTenant: a partir del "slug" (nombre del negocio en la URL) devuelve
  // el negocio completo (con su id). Si no existe, el servicio de tenants lanza
  // el error correspondiente.
  async resolveTenant(slug: string) {
    return this.tenantsService.findBySlug(slug);
  }

  // ─── AUTENTICACIÓN (AUTH) ────────────────────────────

  // register: crea (o "activa") la cuenta de un cliente y le devuelve tokens.
  // Recibe el DTO validado y el id del negocio. Devuelve accessToken,
  // refreshToken y los datos básicos del cliente.
  async register(dto: ClientRegisterDto, tenantId: string) {
    // ¿El identificador es un correo? Lo decidimos por si CONTIENE "@".
    // includes('@') devuelve true si la cadena tiene ese carácter.
    const isEmail = dto.identifier.includes('@');
    // Si es correo, el email es el identificador; si no, intentamos usar dto.email
    // y, si tampoco hay, null. El operador "?" es un ternario:
    //   condición ? valorSiVerdadero : valorSiFalso
    // y "||" devuelve el lado derecho cuando el izquierdo es vacío/undefined.
    const email = isEmail ? dto.identifier : (dto.email || null);
    // Caso simétrico para el teléfono: si NO es correo, el identificador es el
    // teléfono; si sí era correo, usamos dto.phone o null.
    const phone = !isEmail ? dto.identifier : (dto.phone || null);

    // Comprobamos si ya existe un cliente con ese identificador en este negocio.
    // (Puede existir sin contraseña si fue creado por una reserva pública.)
    let existingClient = await this.findClientByIdentifier(dto.identifier, tenantId);

    // "existingClient && existingClient.passwordHash" => si existe Y ya tiene
    // contraseña, es que la cuenta ya está activa: no se puede registrar de nuevo.
    if (existingClient && existingClient.passwordHash) {
      throw new ConflictException('Ya existe una cuenta con este correo o teléfono');
    }

    // CIFRAR la contraseña: bcrypt.hash(textoPlano, costo). El "12" es el "coste"
    // (rondas de cifrado): a mayor número, más seguro pero más lento. Nunca se
    // guarda la contraseña en texto plano, solo este hash irreversible.
    const passwordHash = await bcrypt.hash(dto.password, 12);
    // Momento actual, para marcar cuándo se registró en el portal.
    const now = new Date();

    // Variable donde quedará el cliente final (creado o actualizado).
    // "any" porque puede venir de un update o un create.
    let client: any;

    if (existingClient) {
      // Caso A: el cliente ya existía sin contraseña → lo "activamos" añadiéndole
      // la contraseña y completando datos que falten.
      client = await this.prisma.client.update({
        where: { id: existingClient.id }, // qué cliente actualizar
        data: {
          passwordHash,
          portalRegisteredAt: now,
          // "dto.firstName || existingClient.firstName" => si el DTO trae nombre,
          // lo usamos; si no, conservamos el que ya tenía. Igual con los demás.
          firstName: dto.firstName || existingClient.firstName,
          lastName: dto.lastName || existingClient.lastName,
          email: email || existingClient.email,
          phone: phone || existingClient.phone,
        },
      });
    } else {
      // Caso B: cliente nuevo → lo creamos desde cero.
      client = await this.prisma.client.create({
        data: {
          tenantId,
          firstName: dto.firstName,
          lastName: dto.lastName,
          email,
          phone,
          passwordHash,
          portalRegisteredAt: now,
          source: 'ONLINE', // marca que la cuenta nació en línea (no en mostrador).
        },
      });
    }

    // Generamos el par de tokens (access + refresh) para que quede con sesión
    // iniciada inmediatamente tras registrarse.
    const tokens = await this.generateClientTokens(client);

    // Devolvemos los tokens y un resumen del cliente (sin datos sensibles).
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      client: {
        id: client.id,
        email: client.email,
        phone: client.phone,
        firstName: client.firstName,
        lastName: client.lastName,
        tenantId,
      },
    };
  }

  // login: verifica credenciales y, si son correctas, devuelve tokens nuevos.
  async login(dto: ClientLoginDto, tenantId: string) {
    // Buscamos al cliente por su identificador (correo o teléfono) en el negocio.
    const client = await this.findClientByIdentifier(dto.identifier, tenantId);

    // "!client || !client.passwordHash" => si NO existe el cliente O NO tiene
    // contraseña (cuenta sin activar), las credenciales no son válidas.
    // Damos el MISMO mensaje genérico para no revelar si el usuario existe.
    if (!client || !client.passwordHash) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // bcrypt.compare(textoPlano, hash) compara de forma segura la contraseña
    // tecleada con el hash guardado. Devuelve true si coinciden.
    const isMatch = await bcrypt.compare(dto.password, client.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Guardamos la fecha del último inicio de sesión.
    await this.prisma.client.update({
      where: { id: client.id },
      data: { lastLoginAt: new Date() },
    });

    // Emitimos tokens nuevos.
    const tokens = await this.generateClientTokens(client);

    // Devolvemos lo mismo que en register: tokens + resumen del cliente.
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      client: {
        id: client.id,
        email: client.email,
        phone: client.phone,
        firstName: client.firstName,
        lastName: client.lastName,
        tenantId,
      },
    };
  }

  // refresh: canjea un refresh token válido por un par de tokens NUEVO.
  // Implementa "rotación": el refresh token usado se revoca y se emite otro.
  async refresh(refreshToken: string) {
    // No guardamos el refresh token en claro, sino su hash. Para poder buscarlo
    // sin comparar contra TODA la tabla, guardamos también una "pista" (hint):
    // los primeros 8 caracteres. substring(0, 8) toma desde la posición 0 hasta
    // la 8 (sin incluirla).
    const tokenHint = refreshToken.substring(0, 8);
    // Buscamos los posibles candidatos: tokens con esa misma pista y que NO estén
    // revocados (revokedAt: null). Incluimos el cliente dueño de cada token.
    const candidates = await this.prisma.clientRefreshToken.findMany({
      where: { tokenHint, revokedAt: null },
      include: { client: true },
    });

    // Variable para guardar el token que realmente coincida. "(typeof candidates)[0]"
    // significa "el tipo de UN elemento del array candidates". Empieza en null.
    let matched: (typeof candidates)[0] | null = null;
    // Recorremos los candidatos (pueden ser varios con la misma pista) y
    // comparamos el token recibido contra el hash de cada uno con bcrypt.
    for (const stored of candidates) {
      const isMatch = await bcrypt.compare(refreshToken, stored.tokenHash);
      if (isMatch) {
        matched = stored; // encontramos el correcto
        break;            // salimos del bucle: no hace falta seguir buscando
      }
    }

    // Si ninguno coincidió, el token es inválido (o ya fue revocado).
    if (!matched) {
      throw new UnauthorizedException('Token de actualización inválido o expirado');
    }

    // "new Date() > matched.expiresAt" => si el momento actual es POSTERIOR a la
    // fecha de expiración, el token ya venció. Lo revocamos y rechazamos.
    if (new Date() > matched.expiresAt) {
      await this.prisma.clientRefreshToken.update({
        where: { id: matched.id },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Token de actualización expirado');
    }

    // ROTACIÓN: revocamos el token actual (marcando revokedAt = ahora) para que
    // no se pueda volver a usar. Si alguien robara un token ya usado, no serviría.
    await this.prisma.clientRefreshToken.update({
      where: { id: matched.id },
      data: { revokedAt: new Date() },
    });

    // Limpieza en segundo plano: borramos tokens ya expirados (expiresAt menor que
    // ahora; "lt" = less than). No usamos "await" a propósito (no queremos que el
    // usuario espere por esta limpieza). El ".catch(() => {})" se traga cualquier
    // error silenciosamente: si la limpieza falla, no debe romper el refresh.
    this.prisma.clientRefreshToken
      .deleteMany({ where: { expiresAt: { lt: new Date() } } })
      .catch(() => {});

    // Generamos un par de tokens nuevo para el cliente dueño del token usado.
    const tokens = await this.generateClientTokens(matched.client);
    return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
  }

  // logout: revoca el refresh token recibido para cerrar la sesión.
  async logout(refreshToken: string) {
    // Mismo truco de la "pista" para acotar la búsqueda.
    const tokenHint = refreshToken.substring(0, 8);
    const candidates = await this.prisma.clientRefreshToken.findMany({
      where: { tokenHint, revokedAt: null },
    });

    // Recorremos los candidatos hasta encontrar el que coincida y lo revocamos.
    for (const stored of candidates) {
      const isMatch = await bcrypt.compare(refreshToken, stored.tokenHash);
      if (isMatch) {
        await this.prisma.clientRefreshToken.update({
          where: { id: stored.id },
          data: { revokedAt: new Date() },
        });
        break; // ya lo encontramos: salimos del bucle.
      }
    }
    // (Si no se encuentra, no pasa nada: cerrar sesión es idempotente.)
  }

  // getMe: devuelve los datos públicos del cliente autenticado.
  async getMe(clientId: string, tenantId: string) {
    // findFirst busca el primer cliente que cumpla: ese id, ese negocio y activo.
    // Filtrar por tenantId es la regla multi-tenant (no mezclar datos entre negocios).
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, tenantId, isActive: true },
      // "select" elige SOLO estos campos (no devolvemos passwordHash, etc.).
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        gender: true,
        dateOfBirth: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    // Si no existe, 404.
    if (!client) {
      throw new NotFoundException('Cliente no encontrado');
    }

    return client;
  }

  // ─── CITAS (APPOINTMENTS) ────────────────────────────

  // getAppointments: lista las citas del cliente según el filtro pedido.
  // filter por defecto es 'all'. Devuelve { data: [...] }.
  async getAppointments(clientId: string, tenantId: string, filter: 'upcoming' | 'past' | 'all' = 'all') {
    // Las citas se guardan con startTime en "hora del negocio" interpretada
    // como UTC raw. Ajustamos now al mismo sistema restando el offset del
    // tenant (CDMX UTC-6). TODO: usar Tenant.timezone para multi-region.
    const TENANT_OFFSET_HOURS = -6;
    // Date.now() = milisegundos actuales. Le sumamos el offset convertido a ms
    // (horas * 60 min * 60 s * 1000 ms) para alinear "ahora" con la hora del negocio.
    const now = new Date(Date.now() + TENANT_OFFSET_HOURS * 60 * 60 * 1000);
    // "where" es el filtro de la consulta. Empieza filtrando por cliente y negocio
    // (siempre). Es "any" porque le iremos añadiendo condiciones según el filtro.
    const where: any = { clientId, tenantId };

    // "filter === 'upcoming'" => "===" es comparación estricta (mismo valor y tipo).
    if (filter === 'upcoming') {
      // Próximas: que empiecen de ahora en adelante (gte = mayor o igual) y...
      where.startTime = { gte: now };
      // ...que no estén canceladas ni sin asistencia (notIn = "no esté en la lista").
      where.status = { notIn: ['CANCELLED', 'NO_SHOW'] };
    } else if (filter === 'past') {
      // Pasadas: OR = se cumple si CUALQUIERA de estas condiciones es verdadera:
      where.OR = [
        // que ya hayan empezado (lt = menor que ahora), o...
        { startTime: { lt: now } },
        // ...que su estado sea uno de estos finales (in = "está en la lista").
        { status: { in: ['CANCELLED', 'COMPLETED', 'NO_SHOW'] } },
      ];
    }
    // (Si filter === 'all' no añadimos nada extra: trae todas las del cliente.)

    // Buscamos las citas que cumplan el filtro, trayendo datos relacionados.
    const appointments = await this.prisma.appointment.findMany({
      where,
      include: {
        // items = servicios de la cita, con sus datos "snapshot" (copia del
        // nombre/precio/duración tal como estaban al reservar).
        items: {
          select: {
            id: true,
            serviceNameSnapshot: true,
            priceSnapshot: true,
            durationSnapshot: true,
          },
        },
        // employee = el profesional que atiende (con color para pintar su avatar).
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            color: true,
          },
        },
        // review = si la cita ya tiene reseña (solo id y nota), para saber si
        // mostrar o no el botón de "calificar".
        review: {
          select: { id: true, rating: true },
        },
        // photos = fotos de resultado asociadas a la cita.
        photos: {
          select: { id: true, imageUrl: true, caption: true },
        },
      },
      // Orden: si son pasadas, de la más reciente a la más antigua ('desc');
      // en otro caso (próximas/todas), de la más cercana en adelante ('asc').
      // Es un ternario dentro del propio objeto de ordenación.
      orderBy: { startTime: filter === 'past' ? 'desc' : 'asc' },
    });

    // Respondemos en el formato estándar { data }.
    return { data: appointments };
  }

  // getAppointmentDetail: trae UNA cita con todo su detalle (servicios, empleado,
  // sucursal, reseña, fotos, pagos y cupón canjeado).
  async getAppointmentDetail(appointmentId: string, clientId: string, tenantId: string) {
    // findFirst con filtro por id + cliente + negocio: así un cliente solo puede
    // ver SUS propias citas (no las de otros).
    const appointment = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, clientId, tenantId },
      include: {
        items: {
          select: {
            id: true,
            serviceNameSnapshot: true,
            priceSnapshot: true,
            durationSnapshot: true,
          },
        },
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            color: true,
          },
        },
        // location = la sucursal donde se atiende.
        location: {
          select: { id: true, name: true, address: true },
        },
        // review: true => trae la reseña completa (todos sus campos).
        review: true,
        // photos = fotos de resultado, con su fecha de creación.
        photos: {
          select: { id: true, imageUrl: true, caption: true, createdAt: true },
        },
        // Pagos reales (propina, descuento, total cobrado) para que el detalle
        // coincida con lo que se cobró, no solo la suma de precios de items.
        payments: {
          select: {
            id: true,
            amount: true,
            tipAmount: true,
            discountAmount: true,
            taxAmount: true,
            totalAmount: true,
            currency: true,
            paymentMethod: true,
            status: true,
            createdAt: true,
          },
          // Los pagos, del más reciente al más antiguo.
          orderBy: { createdAt: 'desc' },
        },
        // Cupón/recompensa canjeada en esta cita (para mostrarlo visualmente).
        // include anidado: trae el "redemption" y, dentro, su "reward" (premio).
        redemption: {
          include: {
            reward: {
              select: { id: true, name: true, type: true, discountAmount: true, discountMode: true },
            },
          },
        },
      },
    });

    // Si no hay cita (no existe o no es de este cliente), 404.
    if (!appointment) {
      throw new NotFoundException('Cita no encontrada');
    }

    return { data: appointment };
  }

  // cancelAppointment: cancela una cita del cliente. reason es opcional.
  async cancelAppointment(appointmentId: string, clientId: string, tenantId: string, reason?: string) {
    // Primero verificamos que la cita EXISTE y PERTENECE a este cliente.
    const appointment = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, clientId, tenantId },
    });

    if (!appointment) {
      throw new NotFoundException('Cita no encontrada');
    }

    // Delegamos la cancelación real al servicio de citas (que ya tiene toda la
    // lógica: historial, validaciones de estado, etc.).
    return this.appointmentsService.cancel(
      appointmentId,
      // "reason || '...'" => si el cliente no dio motivo, usamos uno por defecto.
      { reason: reason || 'Cancelada por el cliente' },
      tenantId,
      // El último argumento identifica QUIÉN hace la acción, para el historial.
      // `client:${clientId}` arma un texto tipo "client:abc123".
      `client:${clientId}`,
    );
  }

  // rescheduleAppointment: mueve una cita a otra hora (y opcionalmente otro empleado).
  async rescheduleAppointment(
    appointmentId: string,
    clientId: string,
    tenantId: string,
    startTime: string,
    employeeId?: string,
  ) {
    // Verificamos propiedad de la cita (igual que en cancel).
    const appointment = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, clientId, tenantId },
    });

    if (!appointment) {
      throw new NotFoundException('Cita no encontrada');
    }

    // Delegamos el reagendado al servicio de citas, que valida conflictos, etc.
    return this.appointmentsService.reschedule(
      appointmentId,
      { startTime, employeeId },
      tenantId,
      `client:${clientId}`,
    );
  }

  // ─── RESERVAR (BOOKING) ──────────────────────────────

  // getServices: devuelve los servicios activos del negocio que tengan al menos
  // un empleado activo capaz de hacerlos (si no, no se podrían reservar).
  async getServices(tenantId: string) {
    return this.prisma.service.findMany({
      where: {
        tenantId,
        isActive: true,
        // employeeServices es la relación servicio<->empleado. "some" significa
        // "existe AL MENOS UNO" que cumpla: que el empleado esté activo.
        employeeServices: { some: { employee: { isActive: true } } },
      },
      select: {
        id: true,
        name: true,
        description: true,
        durationMinutes: true,
        price: true,
        color: true,
        category: true,
      },
      // Orden por el campo de ordenación manual definido en el negocio.
      orderBy: { sortOrder: 'asc' },
    });
  }

  // getEmployees: devuelve los profesionales activos y qué servicios hace cada uno.
  async getEmployees(tenantId: string) {
    return this.prisma.employee.findMany({
      where: { tenantId, isActive: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        color: true,
        bio: true,
        // employeeServices: solo los ids de servicio que sabe hacer (para que el
        // frontend filtre qué empleados pueden atender los servicios elegidos).
        employeeServices: {
          select: { serviceId: true },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  // getAvailability: calcula los horarios libres. Es un simple "envoltorio" que
  // reúne los parámetros y delega en el servicio de disponibilidad.
  async getAvailability(
    serviceIds: string[],   // servicios a reservar
    startDate: string,      // inicio del rango de fechas
    endDate: string,        // fin del rango
    tenantId: string,       // negocio
    employeeId?: string,    // empleado preferido (opcional)
    locationId?: string,    // sucursal (opcional)
  ) {
    return this.availabilityService.getAvailableSlots(
      { serviceIds, startDate, endDate, employeeId, locationId },
      tenantId,
      { applyLeadTime: true }, // flujo de cliente: oculta slots bajo la antelación mínima.
    );
  }

  // book: crea una cita nueva para el cliente.
  // "data" agrupa los datos de la reserva. notes es opcional.
  async book(
    clientId: string,
    tenantId: string,
    data: {
      employeeId: string;
      serviceIds: string[];
      startTime: string;
      notes?: string;
    },
  ) {
    // Buscamos al empleado elegido (activo, del negocio) y, sobre todo, su
    // locationId (sucursal), que necesitamos para crear la cita.
    const employee = await this.prisma.employee.findFirst({
      where: { id: data.employeeId, tenantId, isActive: true },
      select: { id: true, locationId: true },
    });

    // Si el empleado no existe o está inactivo, no se puede reservar.
    if (!employee) {
      throw new NotFoundException('Profesional no encontrado');
    }

    // Delegamos la creación al servicio de citas, que aplica el anti-doble-reserva
    // (transacción serializable) y guarda los snapshots de precio/duración.
    return this.appointmentsService.create(
      {
        locationId: employee.locationId, // sucursal del empleado
        clientId,
        employeeId: data.employeeId,
        serviceIds: data.serviceIds,
        startTime: data.startTime,
        notes: data.notes,
        source: 'ONLINE', // la cita se originó en línea.
      },
      tenantId,
      undefined, // sin userId de staff: la reserva la hace el propio cliente.
      { enforceLeadTime: true }, // es reserva de cliente: exige antelación mínima.
    );
  }

  // ─── PERFIL (PROFILE) ────────────────────────────────

  // updateProfile: actualiza los datos del cliente con lo que venga en el DTO.
  async updateProfile(clientId: string, tenantId: string, dto: ClientUpdateProfileDto) {
    // Comprobamos que el cliente existe en este negocio.
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, tenantId },
    });

    if (!client) {
      throw new NotFoundException('Cliente no encontrado');
    }

    // Actualizamos. Como los campos del DTO son opcionales, si alguno viene
    // undefined, Prisma simplemente NO lo cambia.
    const updated = await this.prisma.client.update({
      where: { id: clientId },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone,
        // La fecha llega como texto; si existe la convertimos a Date, si no,
        // dejamos undefined (no tocar el campo). Ternario:
        //   dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        gender: dto.gender,
      },
    });

    // Devolvemos un resumen del cliente ya actualizado.
    return {
      id: updated.id,
      firstName: updated.firstName,
      lastName: updated.lastName,
      email: updated.email,
      phone: updated.phone,
      gender: updated.gender,
      dateOfBirth: updated.dateOfBirth,
    };
  }

  // changePassword: cambia la contraseña tras verificar la actual.
  async changePassword(clientId: string, tenantId: string, dto: ClientChangePasswordDto) {
    // Buscamos al cliente.
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, tenantId },
    });

    // Si no existe o no tiene contraseña previa, no podemos cambiarla.
    if (!client || !client.passwordHash) {
      throw new NotFoundException('Cliente no encontrado');
    }

    // Verificamos que la contraseña ACTUAL que tecleó coincide con el hash guardado.
    const isMatch = await bcrypt.compare(dto.currentPassword, client.passwordHash);
    if (!isMatch) {
      throw new BadRequestException('La contraseña actual es incorrecta');
    }

    // Ciframos la NUEVA contraseña (coste 12) y la guardamos.
    const newHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.client.update({
      where: { id: clientId },
      data: { passwordHash: newHash },
    });

    // Por seguridad, al cambiar la contraseña revocamos TODOS los refresh tokens
    // activos del cliente (updateMany afecta a varios a la vez). Así, cualquier
    // sesión abierta en otro dispositivo queda invalidada.
    await this.prisma.clientRefreshToken.updateMany({
      where: { clientId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return { message: 'Contraseña actualizada exitosamente' };
  }

  // ─── RESEÑAS (REVIEWS) ───────────────────────────────

  // createReview: el cliente deja una reseña de una cita COMPLETADA.
  async createReview(
    appointmentId: string,
    clientId: string,
    tenantId: string,
    dto: CreateReviewDto,
  ) {
    // Traemos la cita (verificando que es del cliente) e incluimos su reseña
    // existente, si la hubiera, para no permitir duplicados.
    const appointment = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, clientId, tenantId },
      include: { review: true },
    });

    // La cita debe existir.
    if (!appointment) {
      throw new NotFoundException('Cita no encontrada');
    }

    // Solo se puede reseñar una cita COMPLETED. "!==" rechaza cualquier otro estado.
    if (appointment.status !== 'COMPLETED') {
      throw new BadRequestException('Solo puedes dejar reseña en citas completadas');
    }

    // Si ya tenía reseña, no se puede crear otra (1 reseña por cita).
    if (appointment.review) {
      throw new ConflictException('Ya existe una reseña para esta cita');
    }

    // Creamos la reseña. Incluye la calificación del empleado (obligatoria) y,
    // opcionalmente, la del negocio (dual review).
    const review = await this.prisma.employeeReview.create({
      data: {
        tenantId,
        employeeId: appointment.employeeId,
        clientId,
        appointmentId,
        rating: dto.rating,
        comment: dto.comment,
        businessRating: dto.businessRating,
        businessComment: dto.businessComment,
        reviewedAt: new Date(),
      },
    });

    // Buscamos el nombre del cliente para incluirlo en el evento (p. ej. para
    // notificar al empleado "X te calificó").
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      select: { firstName: true, lastName: true },
    });
    // Emitimos un evento interno "review.created". Otros módulos pueden escucharlo
    // (notificaciones, estadísticas) sin que este servicio sepa nada de ellos.
    this.eventEmitter.emit('review.created', {
      tenantId,
      reviewId: review.id,
      employeeId: appointment.employeeId,
      rating: review.rating,
      // Si encontramos al cliente, armamos "Nombre Apellido"; si no, un genérico.
      // `${...}` es interpolación: inserta valores dentro del texto.
      clientName: client ? `${client.firstName} ${client.lastName}` : 'Un cliente',
    });

    return { data: review };
  }

  // getMyReviews: lista las reseñas que ha dejado el cliente, con el empleado y
  // la cita asociada (incluyendo el nombre del servicio).
  async getMyReviews(clientId: string, tenantId: string) {
    const reviews = await this.prisma.employeeReview.findMany({
      where: { clientId, tenantId },
      include: {
        // Datos del empleado reseñado.
        employee: {
          select: { id: true, firstName: true, lastName: true, avatarUrl: true },
        },
        // Datos de la cita reseñada (con los nombres de servicio "snapshot").
        appointment: {
          select: {
            id: true,
            startTime: true,
            items: {
              select: { serviceNameSnapshot: true },
            },
          },
        },
      },
      // De la más reciente a la más antigua.
      orderBy: { createdAt: 'desc' },
    });

    return { data: reviews };
  }

  // ─── FOTOS E HISTORIAL DE SERVICIOS ──────────────────

  // getAppointmentPhotos: devuelve las fotos de resultado de una cita del cliente.
  async getAppointmentPhotos(appointmentId: string, clientId: string, tenantId: string) {
    // Verificamos que la cita es del cliente (seguridad).
    const appointment = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, clientId, tenantId },
    });

    if (!appointment) {
      throw new NotFoundException('Cita no encontrada');
    }

    // Traemos las fotos de esa cita, de la más antigua a la más reciente.
    const photos = await this.prisma.appointmentPhoto.findMany({
      where: { appointmentId, tenantId },
      orderBy: { createdAt: 'asc' },
    });

    return { data: photos };
  }

  // getServiceHistory: arma el historial del cliente AGRUPADO por servicio.
  // Para cada servicio: cuántas citas, cuántas fotos y la lista de citas.
  async getServiceHistory(clientId: string, tenantId: string) {
    // 1) Traemos TODAS las citas COMPLETADAS del cliente, con sus servicios,
    //    fotos, empleado y reseña.
    const appointments = await this.prisma.appointment.findMany({
      where: {
        clientId,
        tenantId,
        status: 'COMPLETED',
      },
      include: {
        items: {
          select: {
            serviceNameSnapshot: true,
            serviceId: true,
          },
        },
        photos: {
          select: { id: true, imageUrl: true, caption: true, createdAt: true },
        },
        employee: {
          select: { id: true, firstName: true, lastName: true },
        },
        review: {
          select: { id: true, rating: true, comment: true },
        },
      },
      orderBy: { startTime: 'desc' }, // de la más reciente a la más antigua.
    });

    // 2) Preparamos un Map (diccionario) para agrupar por NOMBRE de servicio.
    //    La clave es el nombre del servicio (string) y el valor, un objeto con
    //    el nombre, el id y la lista de citas de ese servicio.
    //    "typeof appointments" reutiliza el tipo de la lista de arriba.
    const serviceMap = new Map<
      string,
      {
        serviceName: string;
        serviceId: string;
        appointments: typeof appointments;
      }
    >();

    // Recorremos cada cita...
    for (const appt of appointments) {
      // ...y dentro de cada cita, cada servicio (item) que incluía.
      for (const item of appt.items) {
        // La clave del grupo es el nombre "snapshot" del servicio.
        const key = item.serviceNameSnapshot;
        // serviceMap.has(key) => ¿ya existe un grupo para este servicio?
        // Si NO existe todavía, lo creamos vacío.
        if (!serviceMap.has(key)) {
          serviceMap.set(key, {
            serviceName: item.serviceNameSnapshot,
            serviceId: item.serviceId,
            appointments: [],
          });
        }
        // Añadimos la cita al grupo. El "!" después de get(key) le dice a
        // TypeScript "confía, aquí seguro NO es undefined" (porque acabamos de
        // garantizar que existe).
        serviceMap.get(key)!.appointments.push(appt);
      }
    }

    // 3) Convertimos los grupos a la lista final y eliminamos citas duplicadas
    //    (una misma cita con 2 servicios aparecería 2 veces en su grupo... no,
    //    aquí el riesgo es que una cita con 2 servicios del MISMO nombre se
    //    repita; deduplicamos por id para estar seguros).
    // Array.from(serviceMap.values()) saca los valores del Map como array y
    // .map(...) transforma cada grupo.
    const history = Array.from(serviceMap.values()).map((group) => {
      // Deduplicado por id: creamos un nuevo Map cuyas claves son los ids de las
      // citas (group.appointments.map(a => [a.id, a]) genera pares [id, cita]).
      // Como un Map no admite claves repetidas, los duplicados se descartan; luego
      // .values() devuelve las citas únicas y "[...]" las vuelve a poner en array.
      const uniqueAppts = [...new Map(group.appointments.map((a) => [a.id, a])).values()];
      return {
        serviceName: group.serviceName,
        serviceId: group.serviceId,
        totalAppointments: uniqueAppts.length, // cuántas citas únicas
        // Total de fotos: reduce() suma la cantidad de fotos de cada cita.
        //   - "sum" es el acumulador (empieza en 0).
        //   - "a" es cada cita; a.photos.length es cuántas fotos tiene.
        totalPhotos: uniqueAppts.reduce((sum, a) => sum + a.photos.length, 0),
        appointments: uniqueAppts,
      };
    });

    return { data: history };
  }

  // ─── REPUTACIÓN (PÚBLICA) ────────────────────────────

  // getReputation: calcula la calificación promedio del negocio y de cada
  // empleado, a partir de las reseñas visibles. Sirve para mostrar reputación
  // públicamente (sin necesidad de iniciar sesión).
  async getReputation(tenantId: string) {
    // Datos básicos del negocio.
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, logoUrl: true },
    });

    if (!tenant) {
      throw new NotFoundException('Negocio no encontrado');
    }

    // PROMEDIO GLOBAL del negocio. aggregate() calcula valores agregados:
    //   - _avg.rating: promedio de la calificación.
    //   - _count.id: cuántas reseñas hay.
    // Solo contamos reseñas visibles (isVisible: true).
    const overallAgg = await this.prisma.employeeReview.aggregate({
      where: { tenantId, isVisible: true },
      _avg: { rating: true },
      _count: { id: true },
    });

    // PROMEDIO POR EMPLEADO. groupBy agrupa las reseñas por employeeId y calcula
    // el promedio y el conteo dentro de cada grupo (como un "GROUP BY" de SQL).
    const employeeRatings = await this.prisma.employeeReview.groupBy({
      by: ['employeeId'],
      where: { tenantId, isVisible: true },
      _avg: { rating: true },
      _count: { id: true },
    });

    // Sacamos la lista de ids de empleados que tienen reseñas. map() recorre cada
    // grupo "r" y devuelve solo su employeeId.
    const employeeIds = employeeRatings.map((r) => r.employeeId);
    // Traemos los datos (nombre, foto) de esos empleados. "in" = "que esté en
    // esta lista de ids".
    const employees = await this.prisma.employee.findMany({
      where: { id: { in: employeeIds } },
      select: { id: true, firstName: true, lastName: true, avatarUrl: true },
    });

    // Creamos un Map id->empleado para poder buscar cada empleado rápido por su id.
    // employees.map(e => [e.id, e]) genera pares [id, empleado].
    const employeeMap = new Map(employees.map((e) => [e.id, e]));

    return {
      data: {
        // Bloque del NEGOCIO.
        business: {
          id: tenant.id,
          name: tenant.name,
          logoUrl: tenant.logoUrl,
          // Promedio redondeado a 1 decimal: (avg * 10) redondeado y /10.
          // Si no hay promedio (null/0), devolvemos null. Es un ternario:
          //   condición ? valorSiVerdadero : null
          averageRating: overallAgg._avg.rating
            ? Math.round(overallAgg._avg.rating * 10) / 10
            : null,
          totalReviews: overallAgg._count.id,
        },
        // Bloque de EMPLEADOS: transformamos cada grupo en un objeto presentable.
        employees: employeeRatings.map((r) => {
          // Buscamos los datos del empleado por su id en el Map.
          const emp = employeeMap.get(r.employeeId);
          return {
            id: r.employeeId,
            // "emp?.firstName" => "?." (optional chaining) evita un error si emp
            // fuera undefined; "|| ''" pone un texto vacío como respaldo.
            firstName: emp?.firstName || '',
            lastName: emp?.lastName || '',
            avatarUrl: emp?.avatarUrl || null,
            // Promedio del empleado, redondeado a 1 decimal (o null si no hay).
            averageRating: r._avg.rating
              ? Math.round(r._avg.rating * 10) / 10
              : null,
            totalReviews: r._count.id,
          };
        }),
      },
    };
  }

  // ─── AYUDANTES PRIVADOS (PRIVATE HELPERS) ────────────
  // "private" = solo se pueden usar dentro de esta misma clase.

  // findClientByIdentifier: busca un cliente por correo O por teléfono.
  private async findClientByIdentifier(identifier: string, tenantId: string) {
    // Si el identificador contiene "@", lo tratamos como correo.
    const isEmail = identifier.includes('@');

    if (isEmail) {
      // Búsqueda por email dentro del negocio, solo clientes activos.
      return this.prisma.client.findFirst({
        where: { tenantId, email: identifier, isActive: true },
      });
    }

    // En caso contrario, búsqueda por teléfono.
    return this.prisma.client.findFirst({
      where: { tenantId, phone: identifier, isActive: true },
    });
  }

  // generateClientTokens: crea el par de tokens (access + refresh) para un cliente
  // y guarda el refresh token (cifrado) en la base de datos.
  private async generateClientTokens(client: {
    id: string;
    tenantId: string;
    email?: string | null;
    phone?: string | null;
  }) {
    // Contenido (payload) que irá DENTRO del access token JWT.
    const payload = {
      sub: client.id,          // "subject": el id del cliente.
      tenantId: client.tenantId,
      // "client.email || undefined" => si no hay email, guardamos undefined (que
      // simplemente no aparece en el token) en vez de null.
      email: client.email || undefined,
      phone: client.phone || undefined,
      // "as const" fija el valor exacto 'client' como tipo (no string genérico).
      type: 'client' as const,
    };

    // FIRMAMOS el access token con el payload. Caduca a los 15m por defecto.
    // "issuer: 'siliba-client'" marca quién emitió el token (el portal de clientes).
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: process.env.JWT_CLIENT_ACCESS_EXPIRY || '15m',
      issuer: 'siliba-client',
    });

    // El refresh token es un UUID aleatorio (texto imposible de adivinar).
    const refreshToken = uuidv4();
    // Guardamos su HASH (no el valor en claro), con coste 10. Así, si alguien lee
    // la base de datos, no obtiene el token real.
    const tokenHash = await bcrypt.hash(refreshToken, 10);
    // La "pista": primeros 8 caracteres, para acelerar la búsqueda al refrescar.
    const tokenHint = refreshToken.substring(0, 8);
    // Fecha de expiración: ahora + 30 días.
    const expiresAt = new Date();
    // setDate(getDate() + 30) avanza la fecha 30 días.
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days for clients

    // Guardamos el refresh token (hash + pista + dueño + expiración) en la BD.
    await this.prisma.clientRefreshToken.create({
      data: {
        tokenHash,
        tokenHint,
        clientId: client.id,
        expiresAt,
      },
    });

    // Devolvemos AMBOS tokens en claro (el refresh solo se ve aquí, una vez;
    // luego en la BD solo queda su hash).
    return { accessToken, refreshToken };
  }
}
