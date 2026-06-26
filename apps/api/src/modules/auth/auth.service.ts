// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// De NestJS: el decorador @Injectable y varios errores listos para usar que se
// traducen a códigos HTTP concretos:
//   - UnauthorizedException -> 401 (credenciales/sesión inválida).
//   - NotFoundException     -> 404 (no encontrado).
//   - BadRequestException   -> 400 (petición inválida).
//   - ConflictException     -> 409 (conflicto, p.ej. correo ya registrado).
import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';

// JwtService: servicio de NestJS para FIRMAR (crear) tokens JWT.
import { JwtService } from '@nestjs/jwt';

// bcrypt: librería para "hashear" (cifrar de forma irreversible) contraseñas.
// Un hash NO se puede revertir: guardamos el hash, no la contraseña real. Para
// comprobar el login se vuelve a hashear lo que escribe el usuario y se compara.
import * as bcrypt from 'bcrypt';

// uuid (v4): genera identificadores únicos aleatorios. Lo usamos como valor de
// los refresh tokens y de algunos secretos temporales. "as uuidv4" lo renombra.
import { v4 as uuidv4 } from 'uuid';

// EventEmitter2: bus de eventos en memoria. Permite "emitir" eventos de dominio
// (ej. "empleado se unió") que otros módulos escuchan (notificaciones en tiempo real).
import { EventEmitter2 } from '@nestjs/event-emitter';

// PrismaService: acceso a la base de datos.
import { PrismaService } from '../../prisma/prisma.service';
// RbacService: calcula los permisos efectivos de un usuario (roles -> permisos).
import { RbacService } from '../rbac/rbac.service';
// DTOs de entrada para registro y login social.
import { RegisterDto } from './dto/register.dto';
import { SocialLoginDto } from './dto/social-login.dto';
// EmailChannel: canal de envío de correos (recuperación de contraseña).
import { EmailChannel } from '../notifications/channels/email.channel';
// UploadsService: descarga/guarda imágenes (avatares de login social).
import { UploadsService } from '../uploads/uploads.service';
// Funciones que generan el HTML de los correos de contraseña.
import {
  renderPasswordResetEmail,
  renderPasswordSetOAuthEmail,
} from './email-templates/password-reset.template';

// @Injectable marca esta clase como servicio inyectable de NestJS.
@Injectable()
export class AuthService {
  // INYECCIÓN DE DEPENDENCIAS: NestJS provee cada servicio automáticamente. Todos
  // quedan como propiedades de solo lectura (this.prisma, this.jwtService, ...).
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly rbacService: RbacService,
    private readonly eventEmitter: EventEmitter2,
    private readonly emailChannel: EmailChannel,
    private readonly uploads: UploadsService,
  ) {}

  /** True si la URL ya es un path local de uploads (no hotlink externo). */
  // "private" = solo se usa dentro de esta clase. Recibe una URL (que puede ser
  // texto, null o undefined) y devuelve true/false.
  private isLocalUploadPath(url: string | null | undefined): boolean {
    // Si no hay URL (null/undefined/""), no es local -> false.
    if (!url) return false;
    // startsWith comprueba si el texto EMPIEZA por ese prefijo. El "||" devuelve
    // true si cumple CUALQUIERA de los dos prefijos de carpeta local.
    return url.startsWith('/api/uploads/') || url.startsWith('/uploads/');
  }

  // ───────────────────────────────────────────────────────────────────────────
  // login(): inicio de sesión unificado con email + contraseña. Un mismo usuario
  // puede tener perfil de NEGOCIO, perfil de CLIENTE (marketplace) o ambos; aquí
  // se generan los tokens que correspondan y se devuelven juntos.
  // ───────────────────────────────────────────────────────────────────────────
  async login(email: string, password: string) {
    // Buscamos UN usuario por su correo (findUnique = registro único).
    // "include" trae datos relacionados: su tenant (negocio), su ficha de empleado
    // (solo el id) y sus roles (solo el "slug" de cada rol).
    const matchedUser = await this.prisma.user.findUnique({
      where: { email },
      include: {
        tenant: true,
        employee: { select: { id: true } },
        userRoles: { select: { role: { select: { slug: true } } } },
      },
    });

    // Si no existe el usuario, o existe pero está inactivo -> 401.
    // Usamos el MISMO mensaje genérico para no revelar cuál de las dos cosas falló.
    if (!matchedUser || !matchedUser.isActive) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    // Si la cuenta no tiene contraseña (creada solo con login social), no puede
    // entrar por email/contraseña -> mismo 401 genérico.
    if (!matchedUser.passwordHash) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    // bcrypt.compare hashea la contraseña escrita y la compara con el hash guardado.
    // Devuelve true si coinciden. "await" porque es una operación que tarda.
    const valid = await bcrypt.compare(password, matchedUser.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // hasBusiness: ¿el usuario pertenece a un negocio? "!!" convierte cualquier
    // valor a booleano puro: !!"abc"=>true, !!null=>false. Aquí: ¿tiene tenantId?
    const hasBusiness = !!matchedUser.tenantId;
    // Cualquier usuario autenticado puede actuar como cliente del marketplace.
    // Activamos isClient en el primer login para que la marca quede persistente.
    // "let" (no const) porque el valor puede cambiar justo debajo.
    let hasClient = matchedUser.isClient;
    if (!hasClient) {
      // Si aún no era cliente, lo marcamos como cliente en la base de datos...
      await this.prisma.user.update({
        where: { id: matchedUser.id },
        data: { isClient: true },
      });
      hasClient = true; // ...y actualizamos la variable local en consecuencia.
    }

    // Si NO tiene negocio Y tampoco cliente, no hay ningún perfil al que entrar.
    // "&&" = ambas condiciones deben cumplirse.
    if (!hasBusiness && !hasClient) {
      throw new UnauthorizedException('Esta cuenta no tiene perfiles activos');
    }

    // Preparamos las "cajas" de respuesta. Empiezan vacías y se rellenan según el
    // tipo de perfil. "any" relaja el tipado porque la forma varía.
    let business: any = null;
    let client: any = null;
    // profiles: lista de etiquetas ('admin', 'professional', 'client') que indica
    // al frontend qué perfiles tiene este usuario.
    const profiles: string[] = [];

    // ── BLOQUE PERFIL NEGOCIO ──
    if (hasBusiness) {
      // "!" (non-null assertion) le dice a TypeScript "confía, aquí no es null"
      // (ya validamos hasBusiness arriba).
      const tenantId = matchedUser.tenantId!;

      // Caduca automáticamente el periodo de prueba si ya venció.
      const subscription = await this.prisma.subscription.findUnique({
        where: { tenantId },
        select: { status: true, trialEndsAt: true },
      });
      if (subscription) {
        const now = new Date(); // momento actual.
        // Si la suscripción está en TRIAL, tiene fecha de fin, y esa fecha ya pasó
        // (now > trialEndsAt), la suspendemos. "&&" encadena las tres condiciones.
        if (subscription.status === 'TRIAL' && subscription.trialEndsAt && now > subscription.trialEndsAt) {
          // Actualizamos tanto la suscripción como el tenant a SUSPENDED.
          await this.prisma.subscription.update({
            where: { tenantId },
            data: { status: 'SUSPENDED' },
          });
          await this.prisma.tenant.update({
            where: { id: tenantId },
            data: { subscriptionStatus: 'SUSPENDED' },
          });
        }
      }

      // Admin = el user tiene asignado un rol con acceso administrativo.
      // owner: dueño del negocio. admin: rol clásico admin. helper: empleado
      // promovido vía "Convertir en administrador" (UI de Permisos).
      const ADMIN_ROLE_SLUGS = ['owner', 'admin', 'helper'];
      // .some() recorre los roles del usuario y devuelve true en cuanto UNO de
      // ellos esté en la lista de roles admin (includes comprueba pertenencia).
      // "(matchedUser.userRoles || [])": si no hubiera roles, usar lista vacía.
      const hasAdminRole = (matchedUser.userRoles || []).some((ur) =>
        ADMIN_ROLE_SLUGS.includes(ur.role.slug),
      );

      // Generamos el par de tokens de NEGOCIO (access + refresh) para este usuario.
      const tokens = await this.generateTokens(matchedUser);
      // Armamos el objeto "business" con tokens + datos del usuario para el front.
      business = {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: {
          id: matchedUser.id,
          email: matchedUser.email,
          firstName: matchedUser.firstName,
          lastName: matchedUser.lastName,
          tenantId: matchedUser.tenantId,
          // "?." (optional chaining): si tenant fuera null, no rompe y da undefined.
          // "?? null": si lo anterior es null/undefined, usar null como respaldo.
          tenantName: matchedUser.tenant?.name ?? null,
          // tenantType permite al frontend redirigir freelancer a /employee
          // en lugar de /home sin necesidad de un fetch adicional a /me.
          tenantType: matchedUser.tenant?.tenantType ?? 'BUSINESS',
          employeeId: matchedUser.employee?.id ?? null,
          avatarUrl: matchedUser.avatarUrl,
          permissions: tokens.permissions,
          isAdmin: hasAdminRole,
        },
      };

      // Agregamos etiquetas de perfil según corresponda.
      if (hasAdminRole) profiles.push('admin');           // es administrador.
      if (matchedUser.employee) profiles.push('professional'); // tiene ficha de empleado.
    }

    // ── BLOQUE PERFIL CLIENTE (marketplace) ──
    if (hasClient) {
      // Generamos tokens de CLIENTE (distintos a los de negocio: otro issuer/scope).
      const tokens = await this.generateClientTokens(matchedUser);
      client = {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: {
          id: matchedUser.id,
          email: matchedUser.email,
          firstName: matchedUser.firstName,
          lastName: matchedUser.lastName,
          phone: matchedUser.phone,
          gender: matchedUser.gender,
          avatarUrl: matchedUser.avatarUrl,
          socialProvider: matchedUser.socialProvider,
        },
      };
      profiles.push('client');
    }

    // Respondemos con campos "planos" antiguos (compatibilidad con el frontend de
    // /login ya existente) MÁS los campos nuevos unificados (business/client/profiles).
    return {
      // Forma plana heredada (negocio). null si el usuario es solo cliente.
      accessToken: business?.accessToken ?? null,
      refreshToken: business?.refreshToken ?? null,
      user: business?.user ?? null,
      // Campos nuevos unificados.
      business,
      client,
      profiles,
    };
  }

  // register(): punto de entrada del registro. Según los datos del DTO, decide a
  // cuál de los tres flujos de alta delegar.
  async register(dto: RegisterDto) {
    // Si trae código de invitación -> alta como empleado afiliado a un negocio.
    if (dto.inviteCode) {
      return this.registerWithInviteCode(dto);
    }
    // type 'individual' -> alta de un negocio/particular (crea su propio tenant).
    if (dto.type === 'individual') {
      return this.registerIndividual(dto);
    }
    // type 'freelancer' -> alta de profesional independiente (tenant tipo FREELANCER).
    if (dto.type === 'freelancer') {
      return this.registerFreelancer(dto);
    }
    // Si no encaja en ninguno, faltan datos -> 400.
    throw new BadRequestException(
      'Debes proporcionar un código de invitación o registrarte como particular',
    );
  }

  // getInvitePreview(): dado un código de invitación, devuelve una vista previa
  // del negocio (nombre, logo, dueño, puesto y servicios) para que el profesional
  // sepa a dónde se uniría antes de completar su registro.
  async getInvitePreview(code: string) {
    // Buscamos la invitación por su código, incluyendo el negocio (nombre+logo) y
    // los servicios asociados a la invitación (con id+nombre de cada servicio).
    const invite = await this.prisma.tenantInviteCode.findUnique({
      where: { code },
      include: {
        tenant: { select: { name: true, logoUrl: true } },
        services: { include: { service: { select: { id: true, name: true } } } },
      },
    });

    // Si no existe o está desactivada -> 404.
    if (!invite || !invite.isActive) {
      throw new NotFoundException('Código de invitación inválido');
    }
    // Si tiene fecha de expiración y ya pasó (new Date() > expiresAt) -> 400.
    if (invite.expiresAt && new Date() > invite.expiresAt) {
      throw new BadRequestException('El código de invitación ha expirado');
    }
    // Si tiene tope de usos y ya se alcanzó (usedCount >= maxUses) -> 400.
    if (invite.maxUses && invite.usedCount >= invite.maxUses) {
      throw new BadRequestException('El código de invitación ha alcanzado el límite de usos');
    }

    // Buscamos al DUEÑO del negocio (usuario con rol 'owner') para mostrar su nombre.
    // "some" dentro del where: el usuario debe tener AL MENOS un rol con slug 'owner'.
    const owner = await this.prisma.user.findFirst({
      where: {
        tenantId: invite.tenantId,
        userRoles: { some: { role: { slug: 'owner' } } },
      },
      select: { firstName: true, lastName: true },
    });

    return {
      data: {
        businessName: invite.tenant.name,
        logoUrl: invite.tenant.logoUrl,
        // Ternario: si hay dueño, mostramos "Nombre Apellido"; si no, null.
        ownerName: owner ? `${owner.firstName} ${owner.lastName}` : null,
        // "|| null": si jobTitle viene vacío/undefined, usamos null.
        jobTitle: invite.jobTitle || null,
        // .map() transforma cada servicio de la invitación en { id, name }.
        services: invite.services.map((s) => ({ id: s.service.id, name: s.service.name })),
      },
    };
  }

  // registerWithInviteCode(): alta de un profesional que se UNE a un negocio
  // existente usando un código de invitación. Crea (o promueve) el usuario, su
  // ficha de empleado, su horario y le asigna el rol "staff".
  private async registerWithInviteCode(dto: RegisterDto) {
    // Buscamos la invitación por su código, trayendo el negocio completo y los
    // ids de servicios que esta invitación asigna al nuevo empleado.
    const invite = await this.prisma.tenantInviteCode.findUnique({
      where: { code: dto.inviteCode },
      include: {
        tenant: true,
        services: { select: { serviceId: true } },
      },
    });

    // Validaciones de la invitación (igual que en la vista previa):
    if (!invite || !invite.isActive) {
      throw new BadRequestException('Código de invitación inválido o inactivo');
    }

    if (invite.expiresAt && new Date() > invite.expiresAt) {
      throw new BadRequestException('El código de invitación ha expirado');
    }

    // maxUses > 0 significa "tiene límite"; si ya se alcanzó -> error.
    if (invite.maxUses > 0 && invite.usedCount >= invite.maxUses) {
      throw new BadRequestException(
        'El código de invitación ha alcanzado el límite de usos',
      );
    }

    // El correo ahora es único globalmente; comprobamos si ya existe.
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existingUser) {
      throw new ConflictException('Ya existe una cuenta con este correo');
    }

    // Hasheamos la contraseña con bcrypt y "coste" 12 (cuántas rondas de cálculo:
    // a mayor número, más lento y más seguro contra ataques de fuerza bruta).
    const passwordHash = await bcrypt.hash(dto.password, 12);

    // Tomamos la primera ubicación activa del negocio para anclar al empleado.
    const location = await this.prisma.location.findFirst({
      where: { tenantId: invite.tenantId, isActive: true },
    });
    if (!location) {
      throw new BadRequestException('El negocio no tiene ubicaciones activas');
    }

    // Obtenemos (o creamos si no existe) el rol "staff" del negocio.
    let staffRole = await this.prisma.role.findUnique({
      where: { tenantId_slug: { tenantId: invite.tenantId, slug: 'staff' } },
    });
    if (!staffRole) {
      // Permisos básicos para staff: solo los de acción 'read' (lectura).
      // "in: ['read']" = la acción está dentro de esa lista.
      const basicPerms = await this.prisma.permission.findMany({
        where: { action: { in: ['read'] } },
      });
      staffRole = await this.prisma.role.create({
        data: {
          tenantId: invite.tenantId,
          name: 'Staff',
          slug: 'staff',
          description: 'Staff member with basic access',
          isSystem: true,
        },
      });
      // Si hay permisos básicos, los enlazamos al rol staff recién creado.
      // .map() crea una fila { roleId, permissionId } por cada permiso. El "!"
      // en staffRole!.id asegura a TypeScript que staffRole ya no es null.
      if (basicPerms.length > 0) {
        await this.prisma.rolePermission.createMany({
          data: basicPerms.map((p) => ({
            roleId: staffRole!.id,
            permissionId: p.id,
          })),
        });
      }
    }

    // TRANSACCIÓN: $transaction agrupa varias operaciones en una sola unidad
    // "todo o nada". Si cualquiera falla, se DESHACEN todas (rollback). "tx" es el
    // cliente Prisma dentro de la transacción.
    // Si ya existe un User con ese email Y es solo cliente marketplace
    // (tenantId=null), lo "promovemos" agregando tenantId + datos del
    // negocio en vez de fallar por email unique. Si ya tiene tenantId,
    // significa que ya tiene cuenta business y rechazamos.
    const user = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({ where: { email: dto.email } });
      // Si ya tiene tenantId, ya es profesional -> conflicto.
      if (existing && existing.tenantId) {
        throw new ConflictException(
          'Ya tienes una cuenta profesional con este correo. Inicia sesión.',
        );
      }
      // Ternario: si "existing" hay (cliente sin negocio), lo ACTUALIZAMOS
      // (promover); si no, CREAMOS un usuario nuevo.
      const newUser = existing
        ? await tx.user.update({
            where: { id: existing.id },
            data: {
              tenantId: invite.tenantId,
              passwordHash, // Actualizamos al nuevo password tambien
              firstName: dto.firstName,
              lastName: dto.lastName,
              // "dto.phone || existing.phone || null": usa el primer valor que NO
              // sea vacío/null, en ese orden de preferencia.
              phone: dto.phone || existing.phone || null,
              address: dto.personalAddress || existing.address || null,
              isActive: true,
            },
          })
        : await tx.user.create({
        data: {
          tenantId: invite.tenantId,
          email: dto.email,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone || null,
          // Direccion PERSONAL del empleado afiliado (no la del negocio
          // donde trabaja, que ya esta en invite.tenant). El profesional
          // puede tener una direccion personal distinta a la del local.
          address: dto.personalAddress || null,
          isActive: true,
        },
      });

      // Creamos la ficha de empleado vinculada a este usuario y negocio.
      const newEmployee = await tx.employee.create({
        data: {
          tenantId: invite.tenantId,
          userId: newUser.id,
          locationId: location.id,
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email,
          phone: dto.phone || null,
          jobTitle: invite.jobTitle || null,
          isActive: true,
        },
      });

      // Horario por defecto: Lun-Sáb 09:00-18:00. El arreglo de días (as const)
      // se recorre con .map para crear una fila por día. isWorking = trabaja salvo
      // domingo (day !== 'SUNDAY').
      await tx.employeeSchedule.createMany({
        data: (['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'] as const).map((day) => ({
          employeeId: newEmployee.id,
          dayOfWeek: day,
          isWorking: day !== 'SUNDAY',
          startTime: '09:00',
          endTime: '18:00',
          effectiveFrom: new Date('2020-01-01'),
        })),
      });

      // Asignamos al empleado los servicios indicados en la invitación.
      // skipDuplicates evita error si alguna pareja ya existiera.
      if (invite.services && invite.services.length > 0) {
        await tx.employeeService.createMany({
          data: invite.services.map((s) => ({
            employeeId: newEmployee.id,
            serviceId: s.serviceId,
          })),
          skipDuplicates: true,
        });
      }

      // Asignamos el rol "staff" al usuario dentro de este negocio.
      await tx.userRole.create({
        data: {
          userId: newUser.id,
          roleId: staffRole.id,
          tenantId: invite.tenantId,
        },
      });

      // Sumamos 1 al contador de usos de la invitación. "increment: 1" es la
      // forma de Prisma de hacer "campo = campo + 1" de forma atómica.
      await tx.tenantInviteCode.update({
        where: { id: invite.id },
        data: { usedCount: { increment: 1 } },
      });

      // La transacción devuelve el usuario y empleado creados (para usarlos abajo).
      return { newUser, newEmployee };
    });

    // Emitimos un evento para notificar al admin EN TIEMPO REAL que un empleado
    // se unió (otro módulo escucha "employee.joined" y lo muestra en el dashboard).
    this.eventEmitter.emit('employee.joined', {
      tenantId: invite.tenantId,
      employee: {
        id: user.newEmployee.id,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        jobTitle: invite.jobTitle || null,
        // .map saca solo los ids de servicio. "(invite.services || [])" protege
        // por si fuera null.
        services: (invite.services || []).map((s) => s.serviceId),
      },
    });

    // Generamos tokens de negocio para que el nuevo empleado quede logueado.
    const tokens = await this.generateTokens(user.newUser);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.newUser.id,
        email: user.newUser.email,
        firstName: user.newUser.firstName,
        lastName: user.newUser.lastName,
        tenantId: user.newUser.tenantId,
        permissions: tokens.permissions,
      },
    };
  }

  // registerIndividual(): alta de un NEGOCIO/particular. Crea su propio tenant,
  // una suscripción de prueba de 30 días, su ubicación, su usuario, su ficha de
  // empleado y el rol "owner" (dueño) con TODOS los permisos.
  private async registerIndividual(dto: RegisterDto) {
    // El "slug" es el nombre del negocio en la URL (sin espacios ni símbolos).
    // Lo basamos en el nombre del negocio o, si no hay, en el nombre personal.
    const nameForSlug = dto.businessName || `${dto.firstName} ${dto.lastName}`;
    const baseSlug = nameForSlug
      .toLowerCase()                       // todo a minúsculas.
      .replace(/[^a-z0-9-\s]/g, '')        // quita lo que NO sea letra/dígito/-/espacio.
      .replace(/\s+/g, '-')                // reemplaza espacios por guiones.
      .substring(0, 30);                   // recorta a 30 caracteres.
    // Sufijo aleatorio para asegurar unicidad: toString(36) usa base 36
    // (0-9 + a-z); substring(2,6) toma 4 caracteres tras el "0.".
    const randomSuffix = Math.random().toString(36).substring(2, 6);
    const slug = `${baseSlug}-${randomSuffix}`;

    // Verificamos que el slug no exista ya (por si la lotería del random colisionó).
    const existingTenant = await this.prisma.tenant.findUnique({
      where: { slug },
    });
    if (existingTenant) {
      throw new ConflictException('Por favor intenta de nuevo');
    }

    // Hash de la contraseña (coste 12).
    const passwordHash = await bcrypt.hash(dto.password, 12);

    // Componemos la dirección uniendo los campos sueltos. filter(Boolean) elimina
    // los vacíos/null (Boolean('') es false, así que se descartan).
    const addressParts = [
      dto.businessStreet,
      dto.businessCity,
      dto.businessState,
      dto.businessPostalCode,
      dto.businessCountry,
    ].filter(Boolean);
    // Si hay partes, las unimos con ", "; si no, usamos la dirección única antigua.
    const composedAddress =
      addressParts.length > 0
        ? addressParts.join(', ')
        : dto.businessAddress || null;

    // Guardamos los tipos de negocio como texto separado por comas. Ternario:
    // si vino el arreglo nuevo, lo unimos; si no, usamos el tipo único antiguo.
    const businessTypeValue =
      dto.businessTypes && dto.businessTypes.length > 0
        ? dto.businessTypes.join(',')
        : dto.businessType || null;

    // Traemos TODOS los permisos del sistema (el dueño los tendrá todos).
    const ownerRolePermissions = await this.prisma.permission.findMany();

    // Todo el alta se hace en una transacción "todo o nada".
    const user = await this.prisma.$transaction(async (tx) => {
      const now = new Date(); // momento actual.
      // Periodo de prueba gratis de 30 días: copiamos "now" y le sumamos 30 días.
      const trialEndsAt = new Date(now);
      trialEndsAt.setDate(trialEndsAt.getDate() + 30);

      // Creamos el negocio (tenant) con su información.
      const tenant = await tx.tenant.create({
        data: {
          name: dto.businessName || `${dto.firstName} ${dto.lastName}`,
          slug,
          email: dto.email,
          phone: dto.phone || null,
          businessType: businessTypeValue,
          address: composedAddress,
          businessPhone: dto.businessPhone || null,
          contractAcceptedAt: dto.acceptContract ? now : null,
          isMarketplaceListed: true,
          timezone: 'America/Mexico_City',
          currency: 'MXN',
          subscriptionPlan: 'BASICO',
          subscriptionStatus: 'TRIAL',
          tenantType: 'BUSINESS',
        },
      });

      // Create trial subscription (no Stripe, no invoice)
      // Precio empresa: $500 MXN/mes flat (sin cobro adicional por empleado).
      // El campo se llama monthlyAmountUsd por legado pero ahora representa
      // MXN — V2 renombrara cuando se active facturacion multi-moneda.
      await tx.subscription.create({
        data: {
          tenantId: tenant.id,
          plan: 'BASICO',
          status: 'TRIAL',
          monthlyAmountUsd: 500,
          baseMonthlyUsd: 500,
          perEmployeeUsd: 0,
          billedEmployeeCount: 1, // owner counts as 1
          contractStartDate: now,
          contractEndDate: trialEndsAt,
          nextBillingDate: trialEndsAt,
          trialEndsAt,
        },
      });

      // Creamos la ubicación principal del negocio con la dirección compuesta.
      const location = await tx.location.create({
        data: {
          tenantId: tenant.id,
          name: 'Principal',
          address: composedAddress,
          phone: dto.businessPhone || null,
          isActive: true,
        },
      });

      // Create user. Mismo patron que registerWithInviteCode: si ya hay
      // user con ese email y es solo cliente (tenantId=null), promovemos.
      // Si ya tiene tenant, rechazamos con conflict claro.
      const existingUser = await tx.user.findUnique({ where: { email: dto.email } });
      if (existingUser && existingUser.tenantId) {
        throw new ConflictException(
          'Ya tienes una cuenta de negocio con este correo. Inicia sesión.',
        );
      }
      const newUser = existingUser
        ? await tx.user.update({
            where: { id: existingUser.id },
            data: {
              tenantId: tenant.id,
              passwordHash,
              firstName: dto.firstName,
              lastName: dto.lastName,
              phone: dto.phone || existingUser.phone || null,
              address: dto.personalAddress || existingUser.address || null,
              isActive: true,
            },
          })
        : await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: dto.email,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone || null,
          // Direccion personal del admin/dueño. Separada de Tenant.address
          // (la del negocio) — pueden ser distintas.
          address: dto.personalAddress || null,
          isActive: true,
        },
      });

      // Creamos la ficha de empleado del dueño, vinculada a su usuario.
      const ownerEmployee = await tx.employee.create({
        data: {
          tenantId: tenant.id,
          userId: newUser.id,
          locationId: location.id,
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email,
          phone: dto.phone || null,
          isActive: true,
        },
      });

      // Horario por defecto: Lun-Sáb 09:00-18:00 (mismo patrón con .map).
      await tx.employeeSchedule.createMany({
        data: (['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'] as const).map((day) => ({
          employeeId: ownerEmployee.id,
          dayOfWeek: day,
          isWorking: day !== 'SUNDAY',
          startTime: '09:00',
          endTime: '18:00',
          effectiveFrom: new Date('2020-01-01'),
        })),
      });

      // Creamos el rol "Owner" (dueño) de este negocio. isSystem = rol del sistema.
      const ownerRole = await tx.role.create({
        data: {
          tenantId: tenant.id,
          name: 'Owner',
          slug: 'owner',
          description: 'Full access to all features including billing',
          isSystem: true,
        },
      });

      // Le enlazamos TODOS los permisos (una fila por permiso, vía .map).
      if (ownerRolePermissions.length > 0) {
        await tx.rolePermission.createMany({
          data: ownerRolePermissions.map((p) => ({
            roleId: ownerRole.id,
            permissionId: p.id,
          })),
        });
      }

      // Asignamos el rol owner al usuario dentro de su negocio.
      await tx.userRole.create({
        data: {
          userId: newUser.id,
          roleId: ownerRole.id,
          tenantId: tenant.id,
        },
      });

      return newUser; // la transacción devuelve el usuario creado/promovido.
    });

    // Tokens de negocio para dejar logueado al dueño recién registrado.
    const tokens = await this.generateTokens(user);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        tenantId: user.tenantId,
        permissions: tokens.permissions,
      },
    };
  }

  // registerFreelancer(): casi idéntico a registerIndividual, pero crea un tenant
  // de tipo FREELANCER (profesional independiente) con precio distinto. El slug se
  // basa siempre en el nombre completo de la persona.
  private async registerFreelancer(dto: RegisterDto) {
    const fullName = `${dto.firstName} ${dto.lastName}`;
    // Mismo proceso de "slugify" que en registerIndividual.
    const baseSlug = fullName
      .toLowerCase()
      .replace(/[^a-z0-9-\s]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 30);
    const randomSuffix = Math.random().toString(36).substring(2, 6);
    const slug = `${baseSlug}-${randomSuffix}`;

    const existingTenant = await this.prisma.tenant.findUnique({ where: { slug } });
    if (existingTenant) throw new ConflictException('Por favor intenta de nuevo');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const ownerRolePermissions = await this.prisma.permission.findMany();

    const user = await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      // Periodo de prueba de 30 días (igual que en individual).
      const trialEndsAt = new Date(now);
      trialEndsAt.setDate(trialEndsAt.getDate() + 30);

      // Componer la direccion del local del freelancer desde los campos
      // businessXxx (si el form los envio). Mismo formato string que usa
      // registerIndividual.
      // Unimos los campos de dirección no vacíos con ", ". Si todo queda vacío,
      // join devuelve "" y "|| null" lo convierte en null.
      const composedLocalAddress = [
        dto.businessStreet,
        dto.businessCity,
        dto.businessState,
        dto.businessPostalCode,
        dto.businessCountry,
      ].filter(Boolean).join(', ') || null;

      // Creamos el tenant de tipo FREELANCER.
      const tenant = await tx.tenant.create({
        data: {
          name: fullName,
          slug,
          email: dto.email,
          phone: dto.phone || null,
          address: composedLocalAddress,
          contractAcceptedAt: dto.acceptContract ? now : null,
          isMarketplaceListed: true,
          timezone: 'America/Mexico_City',
          currency: 'MXN',
          subscriptionPlan: 'BASICO',
          subscriptionStatus: 'TRIAL',
          tenantType: 'FREELANCER',
        },
      });

      // Suscripción de prueba para el freelancer (sin Stripe ni factura).
      await tx.subscription.create({
        data: {
          tenantId: tenant.id,
          plan: 'BASICO',
          status: 'TRIAL',
          // Precio independiente: $300 MXN/mes flat. Ver nota en
          // registerIndividual sobre el rename pendiente del campo.
          monthlyAmountUsd: 300,
          baseMonthlyUsd: 300,
          perEmployeeUsd: 0,
          billedEmployeeCount: 1,
          contractStartDate: now,
          contractEndDate: trialEndsAt,
          nextBillingDate: trialEndsAt,
          trialEndsAt,
        },
      });

      // Ubicación principal del freelancer.
      const location = await tx.location.create({
        data: {
          tenantId: tenant.id,
          name: 'Principal',
          address: composedLocalAddress,
          isActive: true,
        },
      });

      // Promote cliente existente o crear nuevo. Mismo patron que los
      // otros 2 register flows.
      const existingUser = await tx.user.findUnique({ where: { email: dto.email } });
      if (existingUser && existingUser.tenantId) {
        throw new ConflictException(
          'Ya tienes una cuenta profesional con este correo. Inicia sesión.',
        );
      }
      const newUser = existingUser
        ? await tx.user.update({
            where: { id: existingUser.id },
            data: {
              tenantId: tenant.id,
              passwordHash,
              firstName: dto.firstName,
              lastName: dto.lastName,
              phone: dto.phone || existingUser.phone || null,
              address: dto.personalAddress || existingUser.address || null,
              isActive: true,
            },
          })
        : await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: dto.email,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone || null,
          // Direccion personal del freelancer. Separada de Tenant.address
          // (del local del negocio independiente) — pueden ser distintas.
          address: dto.personalAddress || null,
          isActive: true,
        },
      });

      // Ficha de empleado del freelancer.
      const socialEmployee = await tx.employee.create({
        data: {
          tenantId: tenant.id,
          userId: newUser.id,
          locationId: location.id,
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email,
          phone: dto.phone || null,
          isActive: true,
        },
      });

      // Horario por defecto Lun-Sáb 09:00-18:00.
      await tx.employeeSchedule.createMany({
        data: (['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'] as const).map((day) => ({
          employeeId: socialEmployee.id,
          dayOfWeek: day,
          isWorking: day !== 'SUNDAY',
          startTime: '09:00',
          endTime: '18:00',
          effectiveFrom: new Date('2020-01-01'),
        })),
      });

      // Rol Owner del freelancer (él es dueño de su propio "negocio").
      const ownerRole = await tx.role.create({
        data: {
          tenantId: tenant.id,
          name: 'Owner',
          slug: 'owner',
          description: 'Full access to all features including billing',
          isSystem: true,
        },
      });

      // Todos los permisos al rol owner.
      if (ownerRolePermissions.length > 0) {
        await tx.rolePermission.createMany({
          data: ownerRolePermissions.map((p) => ({
            roleId: ownerRole.id,
            permissionId: p.id,
          })),
        });
      }

      // Asignamos el rol owner al usuario.
      await tx.userRole.create({
        data: {
          userId: newUser.id,
          roleId: ownerRole.id,
          tenantId: tenant.id,
        },
      });

      return newUser;
    });

    // Tokens de negocio para dejar logueado al freelancer.
    const tokens = await this.generateTokens(user);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        tenantId: user.tenantId,
        permissions: tokens.permissions,
      },
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // socialLogin(): inicia sesión o registra con Google/Facebook. Primero verifica
  // el token contra el proveedor; luego, si el usuario ya existe, devuelve sus
  // tokens (igual que login); si es nuevo, pide completar perfil o lo registra
  // con un código de invitación.
  // ───────────────────────────────────────────────────────────────────────────
  async socialLogin(dto: SocialLoginDto) {
    // Verificamos el token con el proveedor correcto. Ternario según el provider.
    const profile = dto.provider === 'google'
      ? await this.verifyGoogleToken(dto.token)
      : await this.verifyFacebookToken(dto.token);

    // Buscamos usuarios activos con ese correo (findMany = puede traer varios).
    const existingUsers = await this.prisma.user.findMany({
      where: { email: profile.email, isActive: true },
      include: { tenant: true },
    });

    // Si existe al menos uno, es un INICIO DE SESIÓN (no un alta nueva).
    if (existingUsers.length > 0) {
      // Avatar: si el user no tiene avatar O tiene una URL externa (hotlink
      // de un login social previo), descargar a local. Evita que el <img>
      // falle por referer policy / formato no soportado / expiracion de URL.
      const first = existingUsers[0]; // primer usuario encontrado.
      // needsLocalAvatar = true si NO tiene avatar O si lo que tiene NO es local
      // ("||"). Si además el proveedor trae avatar, lo descargamos a nuestro server.
      const needsLocalAvatar = !first.avatarUrl || !this.isLocalUploadPath(first.avatarUrl);
      if (needsLocalAvatar && profile.avatarUrl) {
        const localPath = await this.uploads.downloadAndSaveExternalImage(profile.avatarUrl, 'avatars');
        if (localPath) {
          await this.prisma.user.update({
            where: { id: first.id },
            data: { avatarUrl: localPath },
          });
        }
      }

      // Volvemos a leer el usuario con las relaciones necesarias para la respuesta
      // unificada (es un espejo de lo que hace login()).
      const matchedUser = await this.prisma.user.findUnique({
        where: { id: first.id },
        include: {
          tenant: true,
          employee: { select: { id: true } },
          userRoles: { select: { role: { select: { slug: true } } } },
        },
      });
      if (!matchedUser || !matchedUser.isActive) {
        throw new UnauthorizedException('Credenciales invalidas');
      }

      // (Mismo razonamiento que en login(): detectar perfiles negocio/cliente.)
      const hasBusiness = !!matchedUser.tenantId; // "!!" -> booleano puro.
      let hasClient = matchedUser.isClient;
      if (!hasClient) {
        // Auto-activamos el perfil cliente en el primer acceso.
        await this.prisma.user.update({
          where: { id: matchedUser.id },
          data: { isClient: true },
        });
        hasClient = true;
      }

      if (!hasBusiness && !hasClient) {
        throw new UnauthorizedException('Esta cuenta no tiene perfiles activos');
      }

      let business: any = null;
      let client: any = null;
      const profiles: string[] = [];

      // Si tiene negocio, armamos tokens y datos de negocio (igual que login()).
      if (hasBusiness) {
        const ADMIN_ROLE_SLUGS = ['owner', 'admin', 'helper'];
        // .some + includes: ¿alguno de sus roles es admin?
        const hasAdminRole = (matchedUser.userRoles || []).some((ur) =>
          ADMIN_ROLE_SLUGS.includes(ur.role.slug),
        );
        const tokens = await this.generateTokens(matchedUser);
        business = {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          user: {
            id: matchedUser.id,
            email: matchedUser.email,
            firstName: matchedUser.firstName,
            lastName: matchedUser.lastName,
            tenantId: matchedUser.tenantId,
            tenantName: matchedUser.tenant?.name ?? null,
            employeeId: matchedUser.employee?.id ?? null,
            avatarUrl: matchedUser.avatarUrl,
            permissions: tokens.permissions,
            isAdmin: hasAdminRole,
          },
        };
        if (hasAdminRole) profiles.push('admin');
        if (matchedUser.employee) profiles.push('professional');
      }

      // Si tiene perfil cliente, armamos también sus tokens de marketplace.
      if (hasClient) {
        const tokens = await this.generateClientTokens(matchedUser);
        client = {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          user: {
            id: matchedUser.id,
            email: matchedUser.email,
            firstName: matchedUser.firstName,
            lastName: matchedUser.lastName,
            phone: matchedUser.phone,
            gender: matchedUser.gender,
            avatarUrl: matchedUser.avatarUrl,
            socialProvider: matchedUser.socialProvider,
          },
        };
        profiles.push('client');
      }

      return {
        // Campos planos heredados: tokens de negocio si los hay; si no, de cliente
        // ("??" en cadena toma el primer valor no null/undefined). Así el frontend
        // de login social siempre recibe un token usable.
        accessToken: business?.accessToken ?? client?.accessToken ?? null,
        refreshToken: business?.refreshToken ?? client?.refreshToken ?? null,
        user: business?.user ?? client?.user ?? null,
        isNewUser: false,   // no es usuario nuevo.
        needsProfile: false, // no necesita completar perfil.
        // Campos unificados de doble perfil.
        business,
        client,
        profiles,
      };
    }

    // ── USUARIO NUEVO (no existía con ese correo) ──
    // Sin código de invitación no podemos crear la cuenta todavía: devolvemos el
    // perfil social para que el frontend pida completar el registro.
    if (!dto.inviteCode) {
      return {
        isNewUser: true,
        needsProfile: true,
        socialProfile: {
          email: profile.email,
          firstName: profile.firstName,
          lastName: profile.lastName,
          avatarUrl: profile.avatarUrl,
          provider: dto.provider,
        },
      };
    }

    // Con código de invitación: registramos al nuevo usuario uniéndolo al negocio.
    const invite = await this.prisma.tenantInviteCode.findUnique({
      where: { code: dto.inviteCode },
      include: { tenant: true },
    });
    // Mismas validaciones de invitación que en los otros flujos.
    if (!invite || !invite.isActive) {
      throw new BadRequestException('Codigo de invitacion invalido o inactivo');
    }
    if (invite.expiresAt && new Date() > invite.expiresAt) {
      throw new BadRequestException('El codigo de invitacion ha expirado');
    }
    if (invite.maxUses > 0 && invite.usedCount >= invite.maxUses) {
      throw new BadRequestException('El codigo de invitacion ha alcanzado el limite de usos');
    }

    // Comprobamos que el correo no esté ya usado (es único globalmente).
    const existingInTenant = await this.prisma.user.findUnique({
      where: { email: profile.email },
    });
    if (existingInTenant) {
      throw new ConflictException('Ya existe una cuenta con este correo');
    }

    // Ubicación activa donde anclar al empleado.
    const location = await this.prisma.location.findFirst({
      where: { tenantId: invite.tenantId, isActive: true },
    });
    if (!location) throw new BadRequestException('El negocio no tiene ubicaciones activas');

    // El rol "staff" debe existir ya en el negocio.
    const staffRole = await this.prisma.role.findUnique({
      where: { tenantId_slug: { tenantId: invite.tenantId, slug: 'staff' } },
    });
    if (!staffRole) throw new BadRequestException('Configuracion de roles incompleta');

    // Como el login es social, igual debemos guardar un passwordHash (la columna lo
    // exige). Generamos una contraseña ALEATORIA (uuid) que el usuario nunca usará.
    const randomPassword = uuidv4();
    const passwordHash = await bcrypt.hash(randomPassword, 12);

    // Descargar avatar de Google a local antes de crear (evita hotlink).
    let localAvatar: string | null = null;
    if (profile.avatarUrl) {
      localAvatar = await this.uploads.downloadAndSaveExternalImage(profile.avatarUrl, 'avatars');
    }

    // Alta completa (usuario + empleado + horario + rol + uso de invitación) en
    // una transacción "todo o nada".
    const user = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          tenantId: invite.tenantId,
          email: profile.email,
          passwordHash,
          firstName: profile.firstName,
          lastName: profile.lastName,
          avatarUrl: localAvatar,
          isActive: true,
        },
      });

      // Ficha de empleado del nuevo profesional (con su avatar local).
      const socialInviteEmployee = await tx.employee.create({
        data: {
          tenantId: invite.tenantId,
          userId: newUser.id,
          locationId: location.id,
          firstName: profile.firstName,
          lastName: profile.lastName,
          email: profile.email,
          avatarUrl: localAvatar,
          isActive: true,
        },
      });

      // Horario por defecto Lun-Sáb 09:00-18:00.
      await tx.employeeSchedule.createMany({
        data: (['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'] as const).map((day) => ({
          employeeId: socialInviteEmployee.id,
          dayOfWeek: day,
          isWorking: day !== 'SUNDAY',
          startTime: '09:00',
          endTime: '18:00',
          effectiveFrom: new Date('2020-01-01'),
        })),
      });

      // Rol staff dentro del negocio.
      await tx.userRole.create({
        data: {
          userId: newUser.id,
          roleId: staffRole.id,
          tenantId: invite.tenantId,
        },
      });

      // Sumamos 1 al contador de usos de la invitación.
      await tx.tenantInviteCode.update({
        where: { id: invite.id },
        data: { usedCount: { increment: 1 } },
      });

      return newUser;
    });

    // Tokens de negocio para dejar logueado al nuevo empleado.
    const tokens = await this.generateTokens(user);
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      isNewUser: true,    // sí es usuario nuevo...
      needsProfile: false, // ...pero ya quedó registrado (no necesita más datos).
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        tenantId: user.tenantId,
        permissions: tokens.permissions,
      },
    };
  }

  // verifyGoogleToken(): valida el token de Google contra los servidores de Google
  // y devuelve los datos del perfil (email, nombre, foto, id social). "Promise<{...}>"
  // describe la FORMA del objeto que devolverá de manera asíncrona.
  private async verifyGoogleToken(token: string): Promise<{
    email: string; firstName: string; lastName: string; avatarUrl?: string; socialId: string;
  }> {
    // Intento 1: tratar el token como un "id_token" y pedir su info a Google.
    // fetch hace una petición HTTP a esa URL. "${token}" inserta el token en la URL.
    const idTokenRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`);
    // .ok es true si la respuesta fue exitosa (código 2xx).
    if (idTokenRes.ok) {
      const payload = await idTokenRes.json(); // convierte la respuesta a objeto JS.
      // Exigimos email presente y verificado. "=== 'false'" porque Google devuelve
      // este flag como TEXTO, no como booleano real.
      if (!payload.email || payload.email_verified === 'false') {
        throw new UnauthorizedException('El email de Google no esta verificado');
      }
      return {
        email: payload.email,
        // "||": si no viene el nombre, usamos la parte del email antes de la "@"
        // (split('@')[0] parte el correo por "@" y toma el primer trozo).
        firstName: payload.given_name || payload.email.split('@')[0],
        lastName: payload.family_name || '', // si no hay apellido, cadena vacía.
        avatarUrl: payload.picture || undefined, // foto o "sin valor".
        socialId: payload.sub, // id único del usuario en Google.
      };
    }
    // Intento 2 (si el primero falló): tratar el token como "access token" y pedir
    // el perfil enviándolo en la cabecera Authorization: Bearer.
    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!userInfoRes.ok) throw new UnauthorizedException('Token de Google invalido');
    const payload = await userInfoRes.json();
    // Aquí email_verified sí viene como booleano real, por eso "!payload.email_verified".
    if (!payload.email || !payload.email_verified) {
      throw new UnauthorizedException('El email de Google no esta verificado');
    }
    return {
      email: payload.email,
      firstName: payload.given_name || payload.email.split('@')[0],
      lastName: payload.family_name || '',
      avatarUrl: payload.picture || undefined,
      socialId: payload.sub,
    };
  }

  // verifyFacebookToken(): equivalente para Facebook. Pide a la Graph API los datos
  // del usuario usando el access token recibido.
  private async verifyFacebookToken(token: string): Promise<{
    email: string; firstName: string; lastName: string; avatarUrl?: string; socialId: string;
  }> {
    // Pedimos a la Graph API los campos del usuario; el token va en la URL.
    const res = await fetch(
      `https://graph.facebook.com/me?fields=id,email,first_name,last_name,picture.type(large)&access_token=${token}`,
    );
    if (!res.ok) throw new UnauthorizedException('Token de Facebook invalido');
    const payload = await res.json();
    // Facebook no siempre devuelve email (si el usuario no lo compartió).
    if (!payload.email) {
      throw new UnauthorizedException('No se pudo obtener el email de Facebook');
    }
    return {
      email: payload.email,
      firstName: payload.first_name || payload.email.split('@')[0],
      lastName: payload.last_name || '',
      // "?." encadenado: si picture, data o url faltaran, no rompe; da undefined.
      avatarUrl: payload.picture?.data?.url || undefined,
      socialId: payload.id,
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // refresh(): canjea un refresh token de NEGOCIO válido por un par de tokens
  // nuevos. Implementa "rotación": el viejo se revoca y se emite uno nuevo, de
  // forma que cada refresh token sirve UNA sola vez.
  // ───────────────────────────────────────────────────────────────────────────
  async refresh(refreshToken: string) {
    // Por seguridad NO guardamos el refresh token en claro, sino su hash. Para no
    // tener que comparar (bcrypt, lento) contra TODOS, guardamos también un "hint"
    // (los 8 primeros caracteres) que estrecha la búsqueda a unos pocos candidatos.
    const tokenHint = refreshToken.substring(0, 8);
    const candidates = await this.prisma.refreshToken.findMany({
      // revokedAt: null = aún válido; scope 'business' = token de negocio.
      where: { tokenHint, revokedAt: null, scope: 'business' },
      include: { user: true },
    });

    // matched guardará el candidato cuyo hash coincida (o null si ninguno).
    // "(typeof candidates)[0]" = el tipo de un elemento del arreglo candidates.
    let matched: (typeof candidates)[0] | null = null;
    // Recorremos los candidatos y comparamos el token recibido contra cada hash.
    for (const stored of candidates) {
      const isMatch = await bcrypt.compare(refreshToken, stored.tokenHash);
      if (isMatch) {
        matched = stored;
        break; // encontrado: salimos del bucle.
      }
    }

    // Si ninguno coincidió, el token es inválido.
    if (!matched) {
      throw new UnauthorizedException('Token de actualización inválido o expirado');
    }

    // Si el token ya caducó, lo revocamos y rechazamos.
    if (new Date() > matched.expiresAt) {
      await this.prisma.refreshToken.update({
        where: { id: matched.id },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Token de actualización expirado');
    }

    // ROTACIÓN: revocamos el token usado para que no pueda reutilizarse.
    await this.prisma.refreshToken.update({
      where: { id: matched.id },
      data: { revokedAt: new Date() },
    });

    // Limpieza "en segundo plano" de tokens de negocio ya caducados (lt = menor que
    // ahora). No usamos "await": no nos importa esperar; .catch(() => {}) ignora
    // cualquier error para que no afecte al flujo principal.
    this.prisma.refreshToken.deleteMany({
      where: { scope: 'business', expiresAt: { lt: new Date() } },
    }).catch(() => {});

    // Generamos y devolvemos el par de tokens nuevos.
    const tokens = await this.generateTokens(matched.user);
    return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
  }

  // logout(): revoca el refresh token recibido para cerrar la sesión. Mismo truco
  // del "hint" + bcrypt para localizar el token correcto sin guardar el original.
  async logout(refreshToken: string) {
    const tokenHint = refreshToken.substring(0, 8);
    const candidates = await this.prisma.refreshToken.findMany({
      where: { tokenHint, revokedAt: null },
    });

    // Recorremos candidatos; al primero que coincida, lo revocamos y salimos.
    for (const stored of candidates) {
      const isMatch = await bcrypt.compare(refreshToken, stored.tokenHash);
      if (isMatch) {
        await this.prisma.refreshToken.update({
          where: { id: stored.id },
          data: { revokedAt: new Date() },
        });
        break;
      }
    }
    // Nota: no lanza error si no encuentra el token (cerrar sesión es idempotente).
  }

  // getMe(): devuelve el perfil COMPLETO del usuario logueado (datos, permisos,
  // estado de empleado, suscripción del negocio, etc.) para que el frontend pinte
  // su sesión. Recibe userId y tenantId (sacados del JWT por el controlador).
  async getMe(userId: string, tenantId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        tenantId: true,
        isActive: true,
        createdAt: true,
        avatarUrl: true,
        userRoles: { select: { role: { select: { slug: true } } } },
      },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Permisos efectivos del usuario (calculados por RBAC a partir de sus roles).
    const permissions = await this.rbacService.getUserPermissions(
      userId,
      tenantId,
    );

    // Promise.all lanza las 3 consultas EN PARALELO (a la vez) y espera a que TODAS
    // terminen; es más rápido que hacerlas una tras otra. La desestructuración
    // [employee, subscription, tenant] asigna cada resultado en su variable.
    const [employee, subscription, tenant] = await Promise.all([
      this.prisma.employee.findFirst({
        where: { userId, tenantId },
        // Incluimos isActive para detectar si el empleado fue desactivado.
        // posEnabled: indica si tiene acceso al Punto de Venta (para el menú).
        select: {
          id: true,
          avatarUrl: true,
          isActive: true,
          jobTitle: true,
          posEnabled: true,
        },
      }),
      this.prisma.subscription.findUnique({
        where: { tenantId },
        select: { status: true, plan: true, trialEndsAt: true },
      }),
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true, currency: true, tenantType: true },
      }),
    ]);

    // ¿Es admin? (alguno de sus roles está en la lista de roles administrativos).
    const ADMIN_ROLE_SLUGS = ['owner', 'admin', 'helper'];
    const isAdmin = (user.userRoles || []).some((ur) =>
      ADMIN_ROLE_SLUGS.includes(ur.role.slug),
    );
    // Desestructuración con "rest": sacamos userRoles (renombrado _ur, no se usa) y
    // dejamos el RESTO de campos en userClean. Así no exponemos userRoles crudo.
    const { userRoles: _ur, ...userClean } = user;

    return {
      // "...userClean" copia todos los campos del usuario en la respuesta.
      ...userClean,
      // Preferimos el avatar del empleado; si no, el del usuario; si no, null.
      avatarUrl: employee?.avatarUrl || user.avatarUrl || null,
      permissions,
      isAdmin,
      employeeId: employee?.id || null,
      // Ternario: si hay empleado, su estado; si no hay ficha, lo damos por activo.
      isEmployeeActive: employee ? employee.isActive : true,
      jobTitle: employee?.jobTitle || null,
      // posEnabled: acceso al Punto de Venta (false si no es empleado con ficha).
      posEnabled: employee?.posEnabled ?? false,
      // Valores por defecto ("||") por si faltara el dato.
      tenantName: tenant?.name || '',
      tenantCurrency: tenant?.currency || 'MXN',
      tenantType: tenant?.tenantType || 'BUSINESS',
      subscriptionStatus: subscription?.status || 'ACTIVE',
      subscriptionPlan: subscription?.plan || 'BASICO',
      // toISOString() convierte la fecha a texto estándar; si no hay fecha, null.
      trialEndsAt: subscription?.trialEndsAt?.toISOString() || null,
    };
  }

  // changePassword(): cambia la contraseña de un usuario LOGUEADO. Exige conocer
  // la contraseña actual (verificación) antes de fijar la nueva.
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true },
    });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    // Si la cuenta no tiene contraseña (entró solo con red social), no hay
    // "actual" que verificar -> se debe usar el flujo de "establecer contraseña".
    if (!user.passwordHash) {
      throw new UnauthorizedException('Esta cuenta no tiene contraseña configurada (login social)');
    }

    // Verificamos que la contraseña actual escrita coincide con el hash guardado.
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Contraseña actual incorrecta');
    }

    // Hasheamos la nueva contraseña (coste 12) y la guardamos.
    const hash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hash },
    });
  }

  // generateTokens(): crea el par de tokens de NEGOCIO (access JWT + refresh) para
  // un usuario con tenant. El access lleva dentro los permisos; el refresh se
  // guarda HASHEADO en la base de datos. Recibe lo mínimo: id, tenantId y email.
  private async generateTokens(user: { id: string; tenantId: string | null; email: string }) {
    // Sin tenantId no se puede emitir token de negocio.
    if (!user.tenantId) {
      throw new UnauthorizedException('Esta cuenta no tiene un perfil de negocio asociado');
    }

    // Calculamos los permisos una sola vez y los incrustamos en el JWT (así los
    // guards pueden leerlos del token sin volver a consultar la base de datos).
    const permissions = await this.rbacService.getUserPermissions(user.id, user.tenantId);

    // payload = los datos que viajarán DENTRO del JWT. "sub" = id del usuario.
    const payload = {
      sub: user.id,
      tenantId: user.tenantId,
      email: user.email,
      permissions,
    };

    // Firmamos (creamos) el access token. Caduca en JWT_ACCESS_EXPIRY o 15 min.
    // "issuer" identifica quién emite el token (validable después).
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m',
      issuer: 'siliba-tenant',
    });

    // El refresh token es un UUID aleatorio. NO lo guardamos en claro: guardamos su
    // hash (coste 10) y un "hint" (8 primeros chars) para acelerar la búsqueda.
    const refreshToken = uuidv4();
    const tokenHash = await bcrypt.hash(refreshToken, 10);
    const tokenHint = refreshToken.substring(0, 8);
    // Caducidad del refresh: hoy + 7 días.
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 días

    // Guardamos el refresh token (su hash + hint) con scope 'business'.
    await this.prisma.refreshToken.create({
      data: {
        tokenHash,
        tokenHint,
        userId: user.id,
        scope: 'business',
        expiresAt,
      },
    });

    // Devolvemos ambos tokens y los permisos (útiles para el frontend).
    return { accessToken, refreshToken, permissions };
  }

  // generateClientTokens(): igual que generateTokens pero para el perfil CLIENTE
  // del marketplace. El JWT lleva type:'marketplace', otro issuer, y el refresh
  // dura 30 días en vez de 7. No incrusta permisos (el cliente no usa RBAC).
  private async generateClientTokens(user: { id: string; email: string }) {
    // "as const" fija el valor literal 'marketplace' como tipo (no string genérico).
    const payload = {
      sub: user.id,
      email: user.email,
      type: 'marketplace' as const,
    };

    // Access token de cliente, con su propio issuer y caducidad.
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: process.env.JWT_CLIENT_ACCESS_EXPIRY || '15m',
      issuer: 'siliba-marketplace',
    });

    // Refresh token de cliente: UUID, hasheado, con hint y caducidad a 30 días.
    const refreshToken = uuidv4();
    const tokenHash = await bcrypt.hash(refreshToken, 10);
    const tokenHint = refreshToken.substring(0, 8);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 días.

    // Lo guardamos con scope 'client' (distinto al 'business').
    await this.prisma.refreshToken.create({
      data: {
        tokenHash,
        tokenHint,
        userId: user.id,
        scope: 'client',
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }

  // ───────────────────────── Recuperación de contraseña ─────────────────────────

  // forgotPassword(): PASO 1. Envía por correo un código de 6 dígitos para
  // recuperar/establecer la contraseña. Por seguridad, NUNCA revela si el correo
  // existe (responde igual en todos los casos; el controlador da mensaje genérico).
  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        firstName: true,
        passwordHash: true,
        socialProvider: true,
        isActive: true,
      },
    });

    // Respuesta silenciosa si no existe / inactivo (no revelar). Las cuentas
    // sin passwordHash (creadas via OAuth) SI reciben el codigo: el reset
    // funciona como "establecer contrasena por primera vez", lo que les
    // permite tambien iniciar sesion con email/password ademas de Google.
    if (!user || !user.isActive) {
      return;
    }

    // Invalidamos códigos previos aún válidos (usedAt null y no caducados, gt =
    // mayor que ahora) marcándolos como usados. Así solo el más reciente funciona.
    await this.prisma.passwordResetToken.updateMany({
      where: {
        userId: user.id,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { usedAt: new Date() },
    });

    // Generamos un código de 6 dígitos: Math.random() da [0,1); multiplicado y
    // sumado a 100000 cae en [100000, 999999]; Math.floor lo deja entero; String
    // lo pasa a texto (para conservar ceros a la izquierda si los hubiera).
    const code = String(Math.floor(100000 + Math.random() * 900000));
    // Guardamos solo el HASH del código (coste 10), nunca el código en claro.
    const codeHash = await bcrypt.hash(code, 10);
    // Caduca en 15 minutos: ahora (ms) + 15*60*1000 ms.
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min

    // Creamos el registro del código de recuperación, método EMAIL.
    await this.prisma.passwordResetToken.create({
      data: { userId: user.id, codeHash, expiresAt, method: 'EMAIL' },
    });

    // ¿La cuenta SOLO tiene login social (sin contraseña)? Si es así, el correo
    // será de "establecer contraseña por primera vez"; si no, de "restablecer".
    const isOAuthOnly = !user.passwordHash;
    // Ternario para elegir el asunto del correo según el caso anterior.
    const subject = isOAuthOnly
      ? 'Establece tu contraseña - Siliba'
      : 'Restablece tu contraseña - Siliba';

    // Ternario para elegir qué plantilla HTML renderizar (cada una con su mensaje).
    const body = isOAuthOnly
      ? renderPasswordSetOAuthEmail({
          firstName: user.firstName,
          code,
          provider: user.socialProvider,
        })
      : renderPasswordResetEmail({
          firstName: user.firstName,
          code,
        });

    // Enviamos el correo con el código por el canal de email.
    await this.emailChannel.send({ to: user.email, subject, body });
  }

  // verifyResetCode(): PASO 2. Verifica el código de 6 dígitos. Si es correcto,
  // genera un "resetToken" temporal (id.secreto) que habilita el paso 3. Limita a
  // 5 intentos para frenar ataques de adivinanza por fuerza bruta.
  async verifyResetCode(email: string, code: string): Promise<{ resetToken: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    // Mensaje genérico (no revelar si el correo existe).
    if (!user) throw new BadRequestException('Codigo invalido o expirado');

    // Buscamos el código MÁS RECIENTE aún válido: no usado, no verificado y no
    // caducado. orderBy createdAt 'desc' = el último creado primero.
    const token = await this.prisma.passwordResetToken.findFirst({
      where: {
        userId: user.id,
        usedAt: null,
        verifiedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!token) throw new BadRequestException('Codigo invalido o expirado');

    // Si ya hubo 5 o más intentos fallidos, inutilizamos el código (usedAt) y
    // obligamos a pedir uno nuevo. ">=" = mayor o igual.
    if (token.attempts >= 5) {
      await this.prisma.passwordResetToken.update({
        where: { id: token.id },
        data: { usedAt: new Date() },
      });
      throw new BadRequestException('Demasiados intentos. Solicita un nuevo codigo.');
    }

    // Comparamos el código escrito contra el hash guardado.
    const ok = await bcrypt.compare(code, token.codeHash);
    if (!ok) {
      // Código incorrecto: sumamos 1 al contador de intentos y rechazamos.
      await this.prisma.passwordResetToken.update({
        where: { id: token.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException('Codigo invalido o expirado');
    }

    // Código correcto: creamos un "secreto" aleatorio, guardamos su hash, marcamos
    // el código como verificado y renovamos la caducidad a 15 min para el paso 3.
    const secret = uuidv4();
    const tokenHash = await bcrypt.hash(secret, 10);
    await this.prisma.passwordResetToken.update({
      where: { id: token.id },
      data: {
        verifiedAt: new Date(),
        tokenHash,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    // Devolvemos "id.secreto": el frontend lo reenviará tal cual en el paso 3.
    return { resetToken: `${token.id}.${secret}` };
  }

  // resetPassword(): PASO 3. Recibe el resetToken (id.secreto) y la nueva
  // contraseña. Valida el token, la fija y revoca todas las sesiones del usuario.
  async resetPassword(resetToken: string, newPassword: string): Promise<void> {
    // Partimos el token por el "." en sus dos trozos: id y secreto.
    // "(resetToken || '')" protege por si llegara null (split fallaría).
    const [id, secret] = (resetToken || '').split('.');
    // Si falta cualquiera de las dos partes, el token está mal formado.
    if (!id || !secret) {
      throw new BadRequestException('Sesion de recuperacion invalida o expirada');
    }

    // Buscamos el registro por id y validamos TODAS sus condiciones con "||":
    // si NO existe, O ya fue usado, O no fue verificado, O no tiene hash, O ya
    // caducó (< ahora) -> es inválido.
    const token = await this.prisma.passwordResetToken.findUnique({ where: { id } });
    if (
      !token ||
      token.usedAt ||
      !token.verifiedAt ||
      !token.tokenHash ||
      token.expiresAt < new Date()
    ) {
      throw new BadRequestException('Sesion de recuperacion invalida o expirada');
    }

    // Comprobamos que el secreto coincide con el hash guardado en el paso 2.
    const ok = await bcrypt.compare(secret, token.tokenHash);
    if (!ok) {
      throw new BadRequestException('Sesion de recuperacion invalida o expirada');
    }

    // Hasheamos la nueva contraseña y hacemos TRES cosas en una transacción
    // (todo o nada): fijar la contraseña, marcar el código como usado, y revocar
    // TODOS los refresh tokens activos del usuario (cierra otras sesiones por
    // seguridad: si alguien le robó la cuenta, queda fuera).
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: token.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: token.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: token.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }
}
