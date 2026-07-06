// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// Errores listos para usar de NestJS. Cada uno produce un código HTTP:
//   - Injectable: decorador que marca la clase como servicio inyectable.
//   - UnauthorizedException -> 401 (no autenticado / credenciales inválidas).
//   - NotFoundException -> 404 (no encontrado).
//   - ConflictException -> 409 (conflicto, ej. email ya registrado).
//   - BadRequestException -> 400 (petición inválida).
//   - ForbiddenException -> 403 (autenticado pero sin permiso).
import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';

// JwtService: firma y verifica tokens JWT (para emitir el access token).
import { JwtService } from '@nestjs/jwt';

// bcrypt: librería para "hashear" (cifrar de forma irreversible) contraseñas y
// tokens. "* as bcrypt" importa TODO el módulo bajo el nombre bcrypt.
import * as bcrypt from 'bcrypt';

// uuid v4: genera identificadores únicos aleatorios. Aquí lo renombramos a
// "uuidv4" al importar.
import { v4 as uuidv4 } from 'uuid';

// PrismaService: puente hacia la base de datos.
import { PrismaService } from '../../prisma/prisma.service';

// Servicio de tenants (negocios), reutilizado para parte de la lógica.
import { TenantsService } from '../tenants/tenants.service';

// Todos los DTOs que validan las entradas (ya documentados en la carpeta dto/).
import { MarketplaceRegisterDto } from './dto/marketplace-register.dto';
import { MarketplaceLoginDto } from './dto/marketplace-login.dto';
import { MarketplaceDiscoverDto } from './dto/marketplace-discover.dto';
import { UpdateMarketplaceProfileDto, UpdateMarketplaceSettingsDto } from './dto/update-marketplace-profile.dto';
import { ChangeMarketplacePasswordDto } from './dto/change-marketplace-password.dto';
import { ChangeMarketplaceContactDto } from './dto/change-marketplace-contact.dto';
import { MarketplaceBookDto } from './dto/marketplace-book.dto';
import { MarketplaceSocialLoginDto } from './dto/marketplace-social-login.dto';
import { CreateTenantReviewDto } from './dto/tenant-review.dto';

// AppointmentsService: crea/gestiona citas (reutilizado al reservar).
import { AppointmentsService } from '../appointments/appointments.service';

// UploadsService: guarda/borra/descarga archivos (avatares, fotos).
import { UploadsService } from '../uploads/uploads.service';

// EventEmitter2: permite EMITIR "eventos de dominio" (avisos internos) a los
// que otras partes del sistema pueden reaccionar (ej. notificaciones).
import { EventEmitter2 } from '@nestjs/event-emitter';

/**
 * Servicio principal del marketplace. Concentra TODA la lógica del portal
 * cliente: autenticación (registro/login/social), perfil y ajustes, descubrir
 * negocios y profesionales, detalle de negocio con reseñas, favoritos,
 * reputación, citas del usuario, reseñas, reservas, pagos y recompensas.
 */
@Injectable()
export class MarketplaceService {
  // Almacén EN MEMORIA de códigos OTP enviados por SMS (al teléfono). Es un Map
  // (diccionario) cuya clave es el id del usuario y su valor el código + cuándo
  // expira. "private readonly" => propiedad interna que no se reasigna.
  // SMS OTP store (password recovery + email change verification)
  private readonly otpStore = new Map<string, { code: string; expiresAt: Date }>();
  // Lo mismo pero para los OTP enviados por CORREO (verificar cambio de teléfono).
  // Email OTP store (phone change verification)
  private readonly emailOtpStore = new Map<string, { code: string; expiresAt: Date }>();

  // INYECCIÓN DE DEPENDENCIAS: NestJS pasa estos servicios automáticamente y los
  // guardamos como propiedades (this.xxx) para usarlos en todos los métodos.
  constructor(
    private readonly prisma: PrismaService,             // base de datos
    private readonly jwtService: JwtService,            // firmar tokens
    private readonly tenantsService: TenantsService,    // lógica de negocios
    private readonly appointmentsService: AppointmentsService, // crear citas
    private readonly uploads: UploadsService,           // archivos
    private readonly eventEmitter: EventEmitter2,       // eventos de dominio
  ) {}

  /** True si la URL ya es un path local de uploads (no hotlink externo). */
  // Recibe una URL (que puede ser null/undefined) y devuelve true/false.
  private isLocalUploadPath(url: string | null | undefined): boolean {
    // Si no hay URL, no es local: devolvemos false directamente.
    if (!url) return false;
    // startsWith comprueba si el texto EMPIEZA por ese prefijo. Es local si
    // empieza por "/api/uploads/" O por "/uploads/". "||" = uno u otro.
    return url.startsWith('/api/uploads/') || url.startsWith('/uploads/');
  }

  // ─── OTP ─────────────────────────────────────────────

  // sendOtp(): genera y "envía" un código de verificación al TELÉFONO del usuario.
  // Recibe el id del usuario; devuelve un mensaje con el teléfono enmascarado.
  async sendOtp(marketplaceUserId: string) {
    // Buscamos al usuario por su id y traemos solo su teléfono (select).
    const user = await this.prisma.user.findUnique({
      where: { id: marketplaceUserId },
      select: { phone: true },
    });
    // Si no existe -> 404. Si existe pero no tiene teléfono -> 400.
    if (!user) throw new NotFoundException('Usuario no encontrado');
    if (!user.phone) throw new BadRequestException('No tienes un número de teléfono registrado. Agrega uno en tu perfil primero.');

    // Generamos un código de 6 dígitos. Math.random() da un decimal [0,1);
    // multiplicado por 900000 y sumado a 100000 cae en [100000, 999999];
    // Math.floor redondea hacia abajo y .toString() lo pasa a texto.
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    // Fecha de expiración = ahora + 5 minutos. Date.now() está en milisegundos:
    // 5 * 60 * 1000 = 300000 ms = 5 minutos.
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 min
    // Guardamos el código en el Map, asociado al id del usuario.
    this.otpStore.set(marketplaceUserId, { code, expiresAt });

    // De momento NO hay proveedor real de SMS: solo lo imprimimos en consola.
    // TODO: integrate with Twilio/SMS provider
    console.log(`[OTP] Código para ${user.phone}: ${code} (expira ${expiresAt.toISOString()})`);

    // Enmascaramos el teléfono para el mensaje: la regex deja los 2 primeros y
    // los 2 últimos dígitos, reemplazando el resto por "****". "$1" y "$2" son
    // los grupos capturados (los dos dígitos del inicio y del final).
    const masked = user.phone.replace(/(\d{2})\d+(\d{2})/, '$1****$2');
    return { message: `Código enviado al ${masked}` };
  }

  // verifyOtp(): comprueba que el código que escribió el usuario coincide con el
  // que guardamos para su teléfono y que no ha expirado.
  verifyOtp(marketplaceUserId: string, code: string) {
    // Recuperamos del Map la entrada (código + expiración) de este usuario.
    const entry = this.otpStore.get(marketplaceUserId);
    // Si no hay ninguna, no se ha pedido código (o ya se borró) -> 400.
    if (!entry) throw new BadRequestException('No hay código activo. Solicita uno nuevo.');
    // Si la fecha actual es POSTERIOR a la de expiración, el código caducó:
    // lo borramos y avisamos.
    if (new Date() > entry.expiresAt) {
      this.otpStore.delete(marketplaceUserId);
      throw new BadRequestException('El código ha expirado. Solicita uno nuevo.');
    }
    // "!==" = distinto. Si el código guardado no es igual al recibido -> 401.
    if (entry.code !== code) throw new UnauthorizedException('Código incorrecto.');
    // Todo correcto.
    return { verified: true };
  }

  // sendOtpEmail(): igual que sendOtp pero por CORREO (para verificar el cambio
  // de teléfono, por ejemplo).
  async sendOtpEmail(marketplaceUserId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: marketplaceUserId },
      select: { email: true },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    // Mismo generador de 6 dígitos y misma expiración de 5 min que arriba.
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    this.emailOtpStore.set(marketplaceUserId, { code, expiresAt });

    // TODO: integrate with Resend/email provider
    console.log(`[OTP-EMAIL] Código para ${user.email}: ${code} (expira ${expiresAt.toISOString()})`);

    // Enmascaramos el correo: deja los 2 primeros caracteres + "****" + el
    // dominio (la parte desde "@"). Los grupos $1 (inicio) y $3 (@dominio) se
    // conservan; el grupo central ($2) se oculta.
    const masked = user.email.replace(/^(.{2})(.*)(@.+)$/, '$1****$3');
    return { message: `Código enviado a ${masked}` };
  }

  // verifyOtpEmail(): comprueba el código OTP enviado por correo (mismo patrón).
  verifyOtpEmail(marketplaceUserId: string, code: string) {
    const entry = this.emailOtpStore.get(marketplaceUserId);
    if (!entry) throw new BadRequestException('No hay código activo. Solicita uno nuevo.');
    if (new Date() > entry.expiresAt) {
      this.emailOtpStore.delete(marketplaceUserId);
      throw new BadRequestException('El código ha expirado. Solicita uno nuevo.');
    }
    if (entry.code !== code) throw new UnauthorizedException('Código incorrecto.');
    return { verified: true };
  }

  // ─── AUTH ────────────────────────────────────────────

  // register(): crea una cuenta nueva de marketplace. Devuelve tokens + datos
  // básicos del usuario para iniciar sesión de inmediato.
  async register(dto: MarketplaceRegisterDto) {
    // Comprobamos si ya existe un usuario con ese email (findFirst = el primero).
    const existing = await this.prisma.user.findFirst({
      where: { email: dto.email },
    });

    // Si ya existía, no se re-registra. Como una cuenta de negocio/staff YA es
    // apta para el marketplace (el login activa isClient), lo guiamos a iniciar
    // sesión en vez de dar un error crudo.
    if (existing) {
      throw new ConflictException('Ya tienes una cuenta con este correo. Inicia sesión.');
    }

    // Ciframos la contraseña con bcrypt. El "12" es el "cost factor" (cuántas
    // rondas de cifrado): a mayor número, más seguro pero más lento.
    const passwordHash = await bcrypt.hash(dto.password, 12);

    // Creamos el usuario en la base de datos. isClient: true lo marca como
    // usuario del marketplace. "dto.phone || null" guarda el teléfono si vino,
    // o null si no.
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone || null,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
        gender: dto.gender || null,
        passwordHash,
        isClient: true,
      },
    });

    // Si este email ya tenía fichas de "Client" en algún negocio SIN dueño
    // (userId null), las vinculamos a esta cuenta. updateMany actualiza TODOS
    // los registros que cumplan el where de una sola vez.
    // Link any existing Client records with this email
    await this.prisma.client.updateMany({
      where: { email: dto.email, userId: null },
      data: { userId: user.id },
    });

    // Unificación por TELÉFONO: fichas walk-in con este teléfono y sin dueño
    // (el negocio suele dar de alta solo con teléfono; es lo que se usa para el
    // enlace de WhatsApp).
    if (user.phone) {
      await this.prisma.client.updateMany({
        where: { phone: user.phone, userId: null },
        data: { userId: user.id },
      });
    }

    // Si viene de una invitación (claim token), vinculamos ESA ficha concreta
    // aunque su teléfono/email difieran de los del registro, y consumimos el token.
    if (dto.claimToken) {
      await this.prisma.client.updateMany({
        where: { claimToken: dto.claimToken },
        data: { userId: user.id, claimToken: null, claimTokenAt: null },
      });
    }

    // Generamos el par de tokens (acceso + refresco).
    const tokens = await this.generateTokens(user);

    // Devolvemos los tokens y un subconjunto seguro de datos del usuario (NUNCA
    // el hash de la contraseña).
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        gender: user.gender,
      },
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // getClaimPreview(): datos para PRELLENAR la página pública de "reclamar
  // cuenta" (a partir del token que el negocio envió por WhatsApp). Indica si ya
  // existe una cuenta con ese teléfono/email (para ofrecer login en vez de crear).
  // ───────────────────────────────────────────────────────────────────────────
  async getClaimPreview(token: string) {
    const client = await this.prisma.client.findFirst({
      where: { claimToken: token },
      select: {
        firstName: true, lastName: true, phone: true, email: true, userId: true,
        tenant: { select: { name: true } },
      },
    });
    if (!client) throw new NotFoundException('Invitación no válida o ya utilizada.');
    const or: any[] = [];
    if (client.phone) or.push({ phone: client.phone });
    if (client.email) or.push({ email: client.email });
    const existing = or.length
      ? await this.prisma.user.findFirst({ where: { isClient: true, OR: or }, select: { id: true } })
      : null;
    return {
      firstName: client.firstName,
      lastName: client.lastName,
      phone: client.phone,
      email: client.email,
      businessName: client.tenant?.name || null,
      alreadyClaimed: !!client.userId,
      existingAccount: !!existing,
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // claimClient(): un usuario YA autenticado (que ya tenía cuenta) vincula la
  // ficha walk-in del negocio a su cuenta. Consume el token.
  // ───────────────────────────────────────────────────────────────────────────
  async claimClient(token: string, marketplaceUserId: string) {
    const client = await this.prisma.client.findFirst({ where: { claimToken: token } });
    if (!client) throw new NotFoundException('Invitación no válida o ya utilizada.');
    // Si ya está vinculada (doble clic), solo limpiamos el token y respondemos ok.
    await this.prisma.client.update({
      where: { id: client.id },
      data: {
        ...(client.userId ? {} : { userId: marketplaceUserId }),
        claimToken: null,
        claimTokenAt: null,
      },
    });
    return { linked: true, tenantId: client.tenantId };
  }

  // login(): inicia sesión con email O teléfono + contraseña. Si la cuenta estaba
  // suspendida voluntariamente, la reactiva. Devuelve tokens + datos del usuario.
  async login(dto: MarketplaceLoginDto) {
    // Detectamos si el "identifier" parece un teléfono: la regex acepta un "+"
    // opcional y entre 7 y 15 caracteres de dígitos/espacios/guiones/paréntesis.
    // Además exige que NO contenga "@" (para no confundir con un email).
    // Also find suspended users so we can reactivate on voluntary login
    // identifier can be email or phone number
    const isPhone = /^\+?[\d\s\-()]{7,15}$/.test(dto.identifier) && !dto.identifier.includes('@');
    // Buscamos por teléfono o por email según corresponda (ternario).
    const user = await this.prisma.user.findFirst({
      where: isPhone ? { phone: dto.identifier } : { email: dto.identifier },
    });

    // Sin usuario -> credenciales inválidas (mensaje genérico por seguridad).
    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Si la cuenta no tiene contraseña, se creó con login social: avisamos qué
    // método usar (Google o Facebook según socialProvider).
    if (!user.passwordHash) {
      throw new UnauthorizedException(
        `Esta cuenta fue creada con ${user.socialProvider === 'google' ? 'Google' : 'Facebook'}. Inicia sesión con ese método.`,
      );
    }

    // bcrypt.compare verifica que la contraseña escrita coincide con el hash
    // guardado (sin descifrar el hash). Devuelve true/false.
    const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Si el usuario está inactivo PERO tenía una suspensión temporal, asumimos
    // que vuelve por voluntad propia y reactivamos la cuenta.
    // If user is suspended, reactivate on voluntary login (they chose to come back)
    let reactivated = false;
    if (!user.isActive && user.suspendedUntil) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { isActive: true, suspendedAt: null, suspendedUntil: null },
      });
      user.isActive = true; // reflejamos el cambio en el objeto en memoria
      reactivated = true;
    }

    // Si aún así sigue inactivo (desactivación no temporal), rechazamos.
    if (!user.isActive) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Registramos la fecha del último inicio de sesión.
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = await this.generateTokens(user);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      reactivated, // informa al frontend si se reactivó la cuenta
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        gender: user.gender,
        socialProvider: user.socialProvider,
      },
    };
  }

  // socialLogin(): inicia sesión (o registra) usando Google/Facebook. Verifica el
  // token con el proveedor, busca o crea al usuario y devuelve tokens.
  async socialLogin(dto: MarketplaceSocialLoginDto) {
    // Verificamos el token con el proveedor correcto y obtenemos el perfil
    // (email, nombre, avatar...). Ternario: si es 'google' usa un verificador,
    // si no, el de Facebook.
    // Verify token with provider and extract profile
    const profile = dto.provider === 'google'
      ? await this.verifyGoogleToken(dto.token)
      : await this.verifyFacebookToken(dto.token);

    // Buscamos si ya hay un usuario con ese email. "let" porque puede cambiar.
    // Find existing user by email
    let user = await this.prisma.user.findFirst({
      where: { email: profile.email },
    });

    // Bandera: ¿hemos creado una cuenta nueva en este login?
    let isNewUser = false;

    // CASO A: el usuario YA existía.
    if (user) {
      // Si estaba suspendido temporalmente, lo reactivamos.
      // Reactivate if suspended
      if (!user.isActive && user.suspendedUntil) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { isActive: true, suspendedAt: null, suspendedUntil: null },
        });
        user.isActive = true;
      }
      // Si sigue inactivo (desactivación permanente), no dejamos entrar.
      if (!user.isActive) {
        throw new UnauthorizedException('Cuenta desactivada');
      }

      // Preparamos los cambios a guardar. ": any" por flexibilidad de tipos.
      // Siempre actualizamos la fecha de último login.
      // Update social info if not set yet
      const updateData: any = { lastLoginAt: new Date() };
      // Si la cuenta aún no tenía proveedor social, lo registramos ahora.
      if (!user.socialProvider) {
        updateData.socialProvider = dto.provider;
        updateData.socialId = profile.socialId;
      }
      // Avatar: si el user no tiene avatar O tiene una URL externa (de un
      // login social previo guardado como hotlink), descargar a local. Esto
      // evita que falle el <img> por referer policy, formato no soportado
      // (GIF animado de Google) o expiracion de la URL.
      // needsLocalAvatar es true si NO hay avatar, O si el avatar actual NO es
      // un archivo local nuestro.
      const needsLocalAvatar = !user.avatarUrl || !this.isLocalUploadPath(user.avatarUrl);
      // Si hace falta y el proveedor nos dio una foto, la descargamos a nuestro
      // servidor y guardamos su ruta local (si la descarga tuvo éxito).
      if (needsLocalAvatar && profile.avatarUrl) {
        const localPath = await this.uploads.downloadAndSaveExternalImage(profile.avatarUrl, 'avatars');
        if (localPath) updateData.avatarUrl = localPath;
      }
      // Guardamos todos los cambios y refrescamos la variable user.
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: updateData,
      });
    } else {
      // CASO B: el usuario NO existía -> lo creamos (sin contraseña).
      // Create new user (no password needed). Si Google devolvio avatarUrl,
      // intentamos descargarla al server; si falla, queda null y el cliente
      // verá las iniciales como fallback.
      let avatarPath: string | null = null;
      if (profile.avatarUrl) {
        avatarPath = await this.uploads.downloadAndSaveExternalImage(profile.avatarUrl, 'avatars');
      }
      user = await this.prisma.user.create({
        data: {
          email: profile.email,
          firstName: profile.firstName,
          lastName: profile.lastName,
          avatarUrl: avatarPath,
          socialProvider: dto.provider,
          socialId: profile.socialId,
          isClient: true,
        },
      });
      isNewUser = true; // marcamos que es una cuenta recién creada

      // Vinculamos fichas de Client previas con este email (igual que en register).
      // Link existing Client records
      await this.prisma.client.updateMany({
        where: { email: profile.email, userId: null },
        data: { userId: user.id },
      });
    }

    const tokens = await this.generateTokens(user);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      isNewUser, // el frontend puede mostrar un onboarding si es nuevo
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        gender: user.gender,
        avatarUrl: user.avatarUrl,
        socialProvider: user.socialProvider,
      },
    };
  }

  // verifyGoogleToken(): valida el token que mandó el navegador contra los
  // servidores de Google y devuelve el perfil. "private" = solo uso interno.
  // El Promise<{...}> describe la forma del objeto que devolverá.
  private async verifyGoogleToken(token: string): Promise<{
    email: string; firstName: string; lastName: string;
    avatarUrl?: string; socialId: string;
  }> {
    // Primero probamos a tratarlo como "id_token" (Google Sign-In / One Tap).
    // fetch hace una petición HTTP al endpoint de Google que valida el token.
    // Try as id_token first (from Google Sign-In / One Tap)
    const idTokenRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`);
    // .ok es true si la respuesta fue exitosa (código 2xx).
    if (idTokenRes.ok) {
      // .json() convierte la respuesta en un objeto JavaScript.
      const payload = await idTokenRes.json();
      // Exigimos email y que esté verificado. Google manda "email_verified"
      // como texto, por eso comparamos contra el texto 'false'.
      if (!payload.email || payload.email_verified === 'false') {
        throw new UnauthorizedException('El email de Google no está verificado');
      }
      return {
        email: payload.email,
        // Si no viene el nombre, usamos la parte del email antes de "@":
        // split('@')[0] parte "ana@x.com" en ["ana","x.com"] y toma "ana".
        firstName: payload.given_name || payload.email.split('@')[0],
        lastName: payload.family_name || '', // si falta, cadena vacía
        // "|| undefined" => si no hay foto, dejamos undefined (no la incluimos).
        avatarUrl: payload.picture || undefined,
        socialId: payload.sub, // id único del usuario en Google
      };
    }

    // Si lo anterior falló, probamos a tratarlo como "access_token" pidiendo
    // el perfil a otro endpoint, enviando el token en el header Authorization.
    // Fallback: try as access_token via userinfo
    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!userInfoRes.ok) {
      throw new UnauthorizedException('Token de Google inválido');
    }
    const payload = await userInfoRes.json();
    // Aquí email_verified suele venir como booleano de verdad.
    if (!payload.email || !payload.email_verified) {
      throw new UnauthorizedException('El email de Google no está verificado');
    }
    return {
      email: payload.email,
      firstName: payload.given_name || payload.email.split('@')[0],
      lastName: payload.family_name || '',
      avatarUrl: payload.picture || undefined,
      socialId: payload.sub,
    };
  }

  // verifyFacebookToken(): valida el token contra la Graph API de Facebook y
  // devuelve el perfil.
  private async verifyFacebookToken(token: string): Promise<{
    email: string; firstName: string; lastName: string;
    avatarUrl?: string; socialId: string;
  }> {
    // Pedimos los campos que necesitamos (id, email, nombres, foto grande)
    // pasando el access_token en la URL.
    // Verify with Facebook Graph API
    const res = await fetch(
      `https://graph.facebook.com/me?fields=id,email,first_name,last_name,picture.type(large)&access_token=${token}`,
    );
    if (!res.ok) {
      throw new UnauthorizedException('Token de Facebook inválido');
    }
    const payload = await res.json();

    // Facebook puede no dar email si el usuario no lo autorizó: lo exigimos.
    if (!payload.email) {
      throw new UnauthorizedException('No se pudo obtener el email de Facebook. Asegúrate de autorizar el acceso al email.');
    }

    return {
      email: payload.email,
      firstName: payload.first_name || payload.email.split('@')[0],
      lastName: payload.last_name || '',
      // La foto de Facebook viene anidada: picture.data.url. El "?." evita el
      // error si algún nivel intermedio no existe; "|| undefined" como respaldo.
      avatarUrl: payload.picture?.data?.url || undefined,
      socialId: payload.id,
    };
  }

  // refresh(): cambia un refresh token válido por un par de tokens NUEVOS
  // (rotación). El refresh token viejo se revoca para que no se reutilice.
  async refresh(refreshToken: string) {
    // En la BD guardamos el token hasheado, así que no podemos buscar por él
    // directamente. Usamos una "pista" = los primeros 8 caracteres del token
    // para reducir la lista de candidatos. substring(0, 8) toma esos caracteres.
    const tokenHint = refreshToken.substring(0, 8);
    // Buscamos todos los refresh tokens NO revocados, de ámbito 'client', con
    // esa misma pista. include: { user } trae también el usuario dueño.
    const candidates = await this.prisma.refreshToken.findMany({
      where: { tokenHint, revokedAt: null, scope: 'client' },
      include: { user: true },
    });

    // Recorremos los candidatos comparando el token recibido contra cada hash
    // guardado con bcrypt. matched guardará el que coincida (o queda null).
    // "(typeof candidates)[0]" = el tipo de un elemento de esa lista.
    let matched: (typeof candidates)[0] | null = null;
    for (const stored of candidates) {
      const isMatch = await bcrypt.compare(refreshToken, stored.tokenHash);
      if (isMatch) {
        matched = stored;
        break; // encontrado: salimos del bucle (no hace falta seguir)
      }
    }

    // Si ninguno coincidió, el token es inválido.
    if (!matched) {
      throw new UnauthorizedException('Token de actualización inválido');
    }

    // Si el token ya caducó, lo revocamos y avisamos.
    if (new Date() > matched.expiresAt) {
      await this.prisma.refreshToken.update({
        where: { id: matched.id },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Token de actualización expirado');
    }

    // ROTACIÓN: revocamos el token usado para que solo sirva una vez.
    // Revoke old (rotation)
    await this.prisma.refreshToken.update({
      where: { id: matched.id },
      data: { revokedAt: new Date() },
    });

    // Aprovechamos para borrar tokens de cliente ya expirados (limpieza). No
    // usamos await: lo dejamos correr en segundo plano y .catch(() => {})
    // ignora cualquier error para que no afecte la respuesta. "lt" = "menor que".
    // Cleanup expired client tokens
    this.prisma.refreshToken
      .deleteMany({ where: { scope: 'client', expiresAt: { lt: new Date() } } })
      .catch(() => {});

    // Generamos y devolvemos el nuevo par de tokens.
    const tokens = await this.generateTokens(matched.user);
    return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
  }

  // logout(): revoca el refresh token recibido para cerrar la sesión.
  async logout(refreshToken: string) {
    // Mismo truco de la "pista" de 8 caracteres que en refresh().
    const tokenHint = refreshToken.substring(0, 8);
    const candidates = await this.prisma.refreshToken.findMany({
      where: { tokenHint, revokedAt: null, scope: 'client' },
    });

    // Buscamos el token que coincida y, al encontrarlo, lo revocamos y paramos.
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
  }

  // getMe(): devuelve el perfil completo del usuario logueado (sin exponer el
  // hash de la contraseña). Además auto-reactiva la cuenta si la suspensión ya
  // terminó.
  async getMe(marketplaceUserId: string) {
    // Traemos el usuario seleccionando explícitamente los campos a devolver.
    const user = await this.prisma.user.findUnique({
      where: { id: marketplaceUserId },
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        birthDate: true,
        gender: true,
        allergies: true,
        emergencyContactName: true,
        emergencyContactLastName: true,
        emergencyContactPhone: true,
        emergencyContactRelation: true,
        address: true,
        country: true,
        language: true,
        currency: true,
        searchRadius: true,
        notifAppointments: true,
        notifPromotions: true,
        notifRewards: true,
        notifMessages: true,
        socialProvider: true,
        passwordHash: true, // lo traemos solo para calcular "hasPassword" abajo
        suspendedAt: true,
        suspendedUntil: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Si tenía una suspensión temporal y esa fecha ya llegó/pasó (">=" = mayor o
    // igual), reactivamos la cuenta automáticamente.
    // Auto-reactivate if suspension period ended
    if (user.suspendedUntil && new Date() >= user.suspendedUntil) {
      await this.prisma.user.update({
        where: { id: marketplaceUserId },
        data: { suspendedAt: null, suspendedUntil: null, isActive: true },
      });
      // Reflejamos el cambio en el objeto en memoria. "(user as any)" evita un
      // choque de tipos al asignar null a campos que TypeScript cree obligatorios.
      (user as any).suspendedAt = null;
      (user as any).suspendedUntil = null;
    }

    // Separamos el passwordHash del resto con "desestructuración + rest": el
    // hash queda en su propia variable (que NO devolvemos) y "rest" contiene
    // todo lo demás. "!!passwordHash" convierte el hash a booleano (true si hay
    // contraseña, false si no): así el frontend sabe si el usuario tiene clave.
    // Exponer "hasPassword" sin enviar el hash al cliente.
    const { passwordHash, ...rest } = user;
    return { ...rest, hasPassword: !!passwordHash };
  }

  // ─── DISCOVERY ───────────────────────────────────────

  // discover(): el buscador de negocios. Construye una consulta SQL "a mano"
  // (porque calcula distancias geográficas, que Prisma no hace fácil) y devuelve
  // la página de negocios que cumplen los filtros, ordenada según se pida.
  async discover(dto: MarketplaceDiscoverDto) {
    // Desestructuramos el DTO en variables sueltas. Los "= 10", "= 1", "= 20"
    // son valores por defecto si el campo no vino.
    const {
      lat, lng, radiusKm = 10, category, search,
      sortBy, availableToday, availableNow, shopOnly,
      page = 1, perPage = 20,
    } = dto;
    // offset = cuántos registros saltar para llegar a la página pedida.
    // Ej.: página 3 con 20 por página -> saltar (3-1)*20 = 40.
    const offset = (page - 1) * perPage;
    // ¿El usuario mandó coordenadas GPS? "!= null" es true si NO es null NI
    // undefined (cubre ambos casos a la vez).
    const hasGps = lat != null && lng != null;
    // applyRadius = ¿filtramos de verdad por distancia? Solo si hay GPS y el
    // radio es un número mayor que 0. "typeof radiusKm === 'number'" comprueba
    // que sea numérico.
    // Filtro real por distancia: solo aplica si hay GPS Y un radio
    // explicito mayor que cero. Hasta ahora el parametro se calculaba
    // pero NUNCA se usaba en el WHERE — los clientes veian negocios
    // de todo el pais sin importar el radio configurado.
    const applyRadius = hasGps && typeof radiusKm === 'number' && radiusKm > 0;

    // Trozo de SQL que calcula el nombre del día de HOY en mayúsculas/inglés:
    // DAYOFWEEK(CURDATE()) da 1..7 (1=domingo) y ELT elige el nombre por posición.
    // Lo usamos para comparar con la columna day_of_week (un enum de Prisma).
    // MySQL ELT maps DAYOFWEEK() (1=Sun..7=Sat) to Prisma DayOfWeek enum strings
    const dayOfWeekExpr = "ELT(DAYOFWEEK(CURDATE()), 'SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY')";

    // conditions = lista de trozos de WHERE que se unirán con "AND". Empezamos con
    // los fijos: listado en marketplace, suscripción activa/prueba, y NO freelancer.
    // Build WHERE conditions
    // Excluimos freelancers porque su perfil pertenece a la pestana
    // "Profesionales" (1 persona = 1 perfil de empleado), no a "Negocios"
    // (que muestra salones/empresas).
    const conditions: string[] = [
      't.is_marketplace_listed = true',
      "t.subscription_status IN ('active', 'ACTIVE', 'TRIAL')", // IN = uno de la lista
      "t.tenant_type != 'FREELANCER'", // != = distinto de
    ];
    // params = valores que sustituirán a los "?" del SQL (consultas parametrizadas:
    // evitan inyección SQL). Los iremos añadiendo en el MISMO orden que los "?".
    const params: any[] = [];

    // Filtro por categoría: FIND_IN_SET busca el valor dentro de una columna que
    // guarda varias categorías separadas por comas (>0 = encontrado).
    if (category) {
      conditions.push('FIND_IN_SET(?, t.business_type) > 0');
      params.push(category);
    }

    // Filtro por texto: busca en nombre, categoría, dirección o en los servicios.
    if (search) {
      // Busqueda multi-campo: nombre del negocio, categoria (business_type),
      // direccion, o nombre/subcategoria de cualquier servicio activo.
      // EXISTS(...) = true si la subconsulta devuelve al menos una fila.
      conditions.push(
        `(t.name LIKE ? OR t.business_type LIKE ? OR t.address LIKE ? ` +
        `OR EXISTS (SELECT 1 FROM services s WHERE s.tenant_id = t.id AND s.is_active = true AND (s.name LIKE ? OR s.subcategory LIKE ? OR s.category LIKE ?)))`,
      );
      // LIKE con "%texto%" = "que contenga ese texto en cualquier posición".
      const like = `%${search}%`;
      // Hay 6 "?" en la condición, así que empujamos el mismo valor 6 veces.
      params.push(like, like, like, like, like, like);
    }

    // Filtro "abierto hoy": existe un horario para el día de hoy marcado abierto.
    if (availableToday) {
      conditions.push(`EXISTS (SELECT 1 FROM business_hours bh WHERE bh.tenant_id = t.id AND bh.day_of_week = ${dayOfWeekExpr} AND bh.is_open = true)`);
    }

    // Filtro "solo tienda": la tienda está habilitada Y tiene al menos un
    // producto listado, activo y con stock > 0.
    if (shopOnly) {
      conditions.push('t.shop_enabled = true');
      conditions.push(`EXISTS (SELECT 1 FROM products p WHERE p.tenant_id = t.id AND p.is_shop_listed = true AND p.is_active = true AND p.stock > 0)`);
    }

    // Filtro "disponible ahora": abierto hoy + al menos un empleado activo.
    if (availableNow) {
      // Criterio mas permisivo (alineado con profesionales): el negocio
      // tiene horario para HOY con is_open=true Y al menos un empleado
      // activo. No exigimos que la hora actual caiga dentro del horario
      // (eso era demasiado estricto y dejaba "0 resultados" en escenarios
      // razonables, p.ej. justo antes de abrir o cerrando hoy temprano).
      conditions.push(`EXISTS (
        SELECT 1 FROM business_hours bh
        WHERE bh.tenant_id = t.id
          AND bh.day_of_week = ${dayOfWeekExpr}
          AND bh.is_open = true
      )`);
      conditions.push(`EXISTS (
        SELECT 1 FROM employees e
        WHERE e.tenant_id = t.id
          AND e.is_active = true
      )`);
    }

    // ── CONTAR EL TOTAL de negocios que cumplen los filtros (para la paginación).
    // Count total. Si aplicamos filtro de radio, el count debe usar la
    // misma subquery con distancia (sino el "total" no coincide con la
    // pagina real). Si no hay GPS o radio, count plano.
    let total = 0;
    if (applyRadius) {
      // Con radio: contamos sobre una subconsulta que calcula la distancia con
      // la fórmula de Haversine (distancia entre dos puntos de la Tierra).
      // 6371 = radio de la Tierra en km; ACOS/COS/SIN/RADIANS son trigonometría;
      // LEAST/GREATEST acotan el valor a [-1, 1] para evitar errores de redondeo.
      const countDistSql = `
        SELECT COUNT(*) as total FROM (
          SELECT t.id, MIN(
            6371 * ACOS(
              LEAST(1.0, GREATEST(-1.0,
                COS(RADIANS(?)) * COS(RADIANS(l.latitude)) *
                COS(RADIANS(l.longitude) - RADIANS(?)) +
                SIN(RADIANS(?)) * SIN(RADIANS(l.latitude))
              ))
            )
          ) as distance
          FROM tenants t
          LEFT JOIN locations l ON l.tenant_id = t.id AND l.latitude IS NOT NULL AND l.longitude IS NOT NULL AND l.is_active = true
          WHERE ${conditions.join(' AND ')}
          GROUP BY t.id
        ) sub
        WHERE distance IS NOT NULL AND distance <= ?
      `;
      // $queryRawUnsafe ejecuta SQL "crudo". Pasamos los valores de los "?" en
      // orden: lat,lng,lat (los de la fórmula), luego los filtros, y al final el
      // radio. "..." (spread) inserta cada elemento de "params" como argumento.
      const countResult: any[] = await this.prisma.$queryRawUnsafe(
        countDistSql,
        lat, lng, lat,
        ...params,
        radiusKm,
      );
      // El resultado es una lista con una fila { total }. "?." evita error si
      // está vacío; "|| 0" pone 0 si fuera null; Number(...) lo asegura numérico.
      total = Number(countResult[0]?.total || 0);
    } else {
      // Sin radio: conteo simple. COUNT(DISTINCT t.id) cuenta negocios únicos.
      // El JOIN a locations solo se añade si hay GPS (ternario dentro del SQL).
      const countSql = `
        SELECT COUNT(DISTINCT t.id) as total
        FROM tenants t
        ${hasGps ? 'LEFT JOIN locations l ON l.tenant_id = t.id AND l.latitude IS NOT NULL AND l.longitude IS NOT NULL AND l.is_active = true' : ''}
        WHERE ${conditions.join(' AND ')}
      `;
      const countResult: any[] = await this.prisma.$queryRawUnsafe(countSql, ...params);
      total = Number(countResult[0]?.total || 0);
    }

    // ── CONSULTA PRINCIPAL (la página de resultados, con distancia si hay GPS).
    // selectDistance arranca como "NULL as distance" (sin GPS no hay distancia).
    // Main query with distance
    let selectDistance = 'NULL as distance';
    let joinClause = '';        // el JOIN a locations (vacío si no hay GPS)
    const mainParams: any[] = []; // valores de los "?" de esta consulta

    if (hasGps) {
      // Con GPS sustituimos selectDistance por la fórmula de Haversine real.
      selectDistance = `MIN(
        6371 * ACOS(
          LEAST(1.0, GREATEST(-1.0,
            COS(RADIANS(?)) * COS(RADIANS(l.latitude)) *
            COS(RADIANS(l.longitude) - RADIANS(?)) +
            SIN(RADIANS(?)) * SIN(RADIANS(l.latitude))
          ))
        )
      ) as distance`;
      // Los 3 valores de la fórmula (lat, lng, lat) van primero en esta consulta.
      mainParams.push(lat, lng, lat);
      // LEFT JOIN: une cada negocio con sus sucursales que tengan coordenadas.
      joinClause = 'LEFT JOIN locations l ON l.tenant_id = t.id AND l.latitude IS NOT NULL AND l.longitude IS NOT NULL AND l.is_active = true';
    }

    // ── ORDENACIÓN: elegimos el ORDER BY según el sortBy pedido.
    // COALESCE(x, y) = usa x, o y si x es NULL. DESC = descendente, ASC = ascendente.
    // Determine ORDER BY based on sortBy
    let orderClause: string;
    if (sortBy === 'rating') {
      // Por mejor calificación, luego más citas completadas, luego nombre.
      orderClause = 'COALESCE(averageRating, 0) DESC, completedAppointments DESC, name ASC';
    } else if (sortBy === 'services') {
      // Por más citas completadas, luego mejor calificación, luego nombre.
      orderClause = 'completedAppointments DESC, COALESCE(averageRating, 0) DESC, name ASC';
    } else if (sortBy === 'distance' && hasGps) {
      // Por cercanía (los sin distancia van al final con 999999), luego nombre.
      orderClause = 'COALESCE(distance, 999999) ASC, name ASC';
    } else if (hasGps) {
      // Si hay GPS pero no se pidió orden concreto, también por cercanía.
      orderClause = 'COALESCE(distance, 999999) ASC, name ASC';
    } else {
      // Sin nada de lo anterior, por nombre alfabético.
      orderClause = 'name ASC';
    }

    // Tras los params del GPS, añadimos los params de los filtros (mismo orden).
    // Add filter params after GPS params
    mainParams.push(...params);

    // Subconsulta que calcula un "badge" (insignia) por negocio: ¿tiene
    // disponibilidad inmediata? = abierto hoy Y con algún empleado activo.
    // Subquery para badge hasImmediateAvailability en la lista. Misma logica
    // permisiva que el filtro: abierto hoy + al menos un empleado activo.
    const availableNowSelect = `(
      EXISTS (
        SELECT 1 FROM business_hours bh2
        WHERE bh2.tenant_id = t.id
          AND bh2.day_of_week = ${dayOfWeekExpr}
          AND bh2.is_open = true
      )
      AND EXISTS (
        SELECT 1 FROM employees e2
        WHERE e2.tenant_id = t.id
          AND e2.is_active = true
      )
    ) as hasImmediateAvailability`;

    // innerSql = la consulta interna: trae los datos del negocio + varias
    // subconsultas que calculan promedio de reseñas, total de reseñas, citas
    // completadas, dirección, precios mínimo/máximo y el badge de disponibilidad.
    // GROUP BY t.id agrupa por negocio (necesario por los MIN/AVG con el JOIN).
    const innerSql = `
      SELECT
        t.id, t.name, t.slug, t.logo_url as logoUrl,
        t.cover_image_url as coverImageUrl, t.card_color as cardColor,
        t.business_type as businessType,
        t.description, t.address,
        ${selectDistance},
        (SELECT AVG(er.rating) FROM employee_reviews er WHERE er.tenant_id = t.id AND er.is_visible = true) as averageRating,
        (SELECT COUNT(*) FROM employee_reviews er WHERE er.tenant_id = t.id AND er.is_visible = true) as totalReviews,
        (SELECT COUNT(*) FROM appointments a WHERE a.tenant_id = t.id AND a.status = 'COMPLETED') as completedAppointments,
        (SELECT MIN(l2.address) FROM locations l2 WHERE l2.tenant_id = t.id AND l2.is_active = true) as locationAddress,
        (SELECT MIN(s.price) FROM services s WHERE s.tenant_id = t.id AND s.is_active = true) as minServicePrice,
        (SELECT MAX(s.price) FROM services s WHERE s.tenant_id = t.id AND s.is_active = true) as maxServicePrice,
        ${availableNowSelect}
      FROM tenants t
      ${joinClause}
      WHERE ${conditions.join(' AND ')}
      GROUP BY t.id
    `;
    // Si aplicamos radio, filtramos por distancia en la consulta externa.
    // Filtro de radio en el outer: distance solo existe como alias del
    // SELECT cuando hasGps. NULL = negocio sin ubicacion (lo excluimos
    // cuando aplicamos radio, ya que no hay forma de saber su distancia).
    const radiusWhere = applyRadius ? 'WHERE distance IS NOT NULL AND distance <= ?' : '';
    // mainSql envuelve la innerSql, aplica el filtro de radio, la ordenación y
    // la paginación (LIMIT = cuántos traer; OFFSET = cuántos saltar).
    const mainSql = `
      SELECT * FROM (${innerSql}) sub
      ${radiusWhere}
      ORDER BY ${orderClause}
      LIMIT ? OFFSET ?
    `;

    // Añadimos los últimos "?": el radio (si aplica) y luego perPage y offset.
    if (applyRadius) mainParams.push(radiusKm);
    mainParams.push(perPage, offset);

    // Ejecutamos la consulta y obtenemos la lista de negocios crudos.
    const businesses: any[] = await this.prisma.$queryRawUnsafe(mainSql, ...mainParams);

    return {
      // .map() transforma CADA negocio crudo (b) en el objeto limpio que espera
      // el frontend. Recorre toda la lista y devuelve una lista nueva.
      data: businesses.map((b) => ({
        id: b.id,
        name: b.name,
        slug: b.slug,
        logoUrl: b.logoUrl,
        coverImageUrl: b.coverImageUrl,
        cardColor: b.cardColor || null, // si no hay color, null
        businessType: b.businessType,
        description: b.description,
        // Preferimos la dirección de la sucursal; si no, la del negocio.
        address: b.locationAddress || b.address,
        // Distancia redondeada a 1 decimal: (x*10) redondeado /10. Si no hay, null.
        distance: b.distance != null ? Math.round(Number(b.distance) * 10) / 10 : null,
        // Calificación media redondeada a 1 decimal, o null si no hay reseñas.
        averageRating: b.averageRating != null
          ? Math.round(Number(b.averageRating) * 10) / 10
          : null,
        totalReviews: Number(b.totalReviews || 0),
        completedAppointments: Number(b.completedAppointments || 0),
        // Rango de precios { min, max }, o null si el negocio no tiene servicios.
        priceRange: b.minServicePrice != null
          ? { min: Number(b.minServicePrice), max: Number(b.maxServicePrice) }
          : null,
        // "!!" convierte el 1/0 que devuelve SQL en true/false real.
        hasImmediateAvailability: !!b.hasImmediateAvailability,
      })),
      // meta = info de paginación. Math.ceil redondea HACIA ARRIBA el número de
      // páginas (ej. 21 resultados / 20 = 1.05 -> 2 páginas).
      meta: {
        total,
        page,
        perPage,
        totalPages: Math.ceil(total / perPage),
      },
    };
  }

  // ─── FAVORITES ──────────────────────────────────────

  // toggleFavorite(): marca/desmarca un negocio como favorito. Si ya era
  // favorito, lo quita (devuelve favorited:false); si no, lo agrega (true).
  async toggleFavorite(marketplaceUserId: string, tenantSlug: string, profileId?: string) {
    // Buscamos el negocio por su slug, trayendo solo id y si está listado.
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { id: true, isMarketplaceListed: true },
    });

    // Si no existe o no está publicado en el marketplace -> 404.
    // "No listado en marketplace" = no aparece en búsquedas/descubrimiento, PERO
    // sigue accesible por enlace directo (slug). Por eso aquí solo validamos que
    // exista; el filtro de listado vive en discover()/discoverProfessionals().
    if (!tenant) {
      throw new NotFoundException('Negocio no encontrado');
    }

    // El favorito pertenece al PERFIL activo (cada perfil tiene su propia lista).
    const activeProfileId = await this.resolveActiveProfileId(marketplaceUserId, profileId);

    // Buscamos si ya existe el favorito para (usuario, perfil, negocio).
    const existing = await this.prisma.marketplaceFavorite.findFirst({
      where: { userId: marketplaceUserId, profileId: activeProfileId, tenantId: tenant.id },
    });

    // Si ya existía, lo borramos -> deja de ser favorito.
    if (existing) {
      await this.prisma.marketplaceFavorite.delete({
        where: { id: existing.id },
      });
      return { favorited: false };
    }

    // Si no existía, lo creamos -> pasa a ser favorito.
    await this.prisma.marketplaceFavorite.create({
      data: {
        userId: marketplaceUserId,
        profileId: activeProfileId,
        tenantId: tenant.id,
      },
    });
    return { favorited: true };
  }

  // getMyFavorites(): devuelve los negocios favoritos del usuario, enriquecidos
  // con su calificación media y total de reseñas.
  async getMyFavorites(marketplaceUserId: string, profileId?: string) {
    // Solo los favoritos del PERFIL activo (cada perfil tiene su lista). El
    // titular (SELF) también ve los favoritos antiguos sin perfil.
    const profileWhere = await this.buildFavoriteProfileWhere(marketplaceUserId, profileId);
    // Traemos todos los favoritos del usuario, incluyendo datos del negocio,
    // ordenados del más reciente al más antiguo (createdAt desc).
    const favorites = await this.prisma.marketplaceFavorite.findMany({
      where: { userId: marketplaceUserId, ...profileWhere },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true,
            coverImageUrl: true,
            businessType: true,
            address: true,
            description: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Para cada favorito necesitamos calcular su rating. Como son varias
    // consultas, usamos Promise.all para lanzarlas TODAS a la vez y esperar a
    // que terminen (más rápido que una tras otra).
    // Enrich with rating data
    const enriched = await Promise.all(
      // .map convierte cada favorito en una promesa que resuelve al objeto final.
      favorites.map(async (fav) => {
        // aggregate calcula agregados: _avg (promedio) del rating y _count
        // (cantidad) de reseñas visibles de ese negocio.
        const ratingAgg = await this.prisma.employeeReview.aggregate({
          where: { tenantId: fav.tenantId, isVisible: true },
          _avg: { rating: true },
          _count: { id: true },
        });

        return {
          // "...fav.tenant" copia todos los campos del negocio en este objeto.
          ...fav.tenant,
          favoriteId: fav.id,
          favoritedAt: fav.createdAt,
          // Promedio redondeado a 1 decimal, o null si no hay reseñas.
          averageRating: ratingAgg._avg.rating
            ? Math.round(ratingAgg._avg.rating * 10) / 10
            : null,
          totalReviews: ratingAgg._count.id,
        };
      }),
    );

    return { data: enriched };
  }

  // getBusinessDetail(): devuelve TODO lo necesario para la página de detalle de
  // un negocio: datos, servicios, empleados, reseñas (combinadas y sin
  // duplicados) y si el usuario actual lo tiene en favoritos.
  // marketplaceUserId es opcional (el endpoint es público con guard opcional).
  async getBusinessDetail(tenantSlug: string, marketplaceUserId?: string, profileId?: string) {
    // Buscamos el negocio por slug con todos los campos de presentación.
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        coverImageUrl: true,
        businessType: true,
        tenantType: true,
        description: true,
        address: true,
        phone: true,
        businessPhone: true,
        timezone: true,
        currency: true,
        isMarketplaceListed: true,
        stripeOnboardingComplete: true,
        shopEnabled: true,
        confettiEnabled: true,
        confettiStyle: true,
        confettiStyles: true,
        confettiColors: true,
      },
    });

    // Si no existe o no está publicado -> 404.
    // "No listado en marketplace" = no aparece en búsquedas/descubrimiento, PERO
    // sigue accesible por enlace directo (slug). Por eso aquí solo validamos que
    // exista; el filtro de listado vive en discover()/discoverProfessionals().
    if (!tenant) {
      throw new NotFoundException('Negocio no encontrado');
    }

    // Servicios del negocio: solo activos y que tengan AL MENOS un empleado
    // activo asignado. "some" = "existe alguno que cumpla la condición".
    // Get services (only those with at least one active employee assigned)
    const services = await this.prisma.service.findMany({
      where: {
        tenantId: tenant.id,
        isActive: true,
        employeeServices: { some: { employee: { isActive: true } } },
      },
      select: {
        id: true,
        name: true,
        description: true,
        durationMinutes: true,
        price: true,
        currency: true,
        color: true,
        category: true,
        subcategory: true,
        pointsReward: true,
        redeemableWithPoints: true,
        pointsRequired: true,
      },
      orderBy: { sortOrder: 'asc' },
    });

    // Empleados activos del negocio, con la lista de servicios que hace cada uno.
    // Get employees
    const employees = await this.prisma.employee.findMany({
      where: { tenantId: tenant.id, isActive: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        color: true,
        bio: true,
        employeeServices: {
          select: { serviceId: true },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    // count = cuántas citas COMPLETED tiene el negocio (señal de actividad).
    // Get completed appointments count
    const completedAppointments = await this.prisma.appointment.count({
      where: { tenantId: tenant.id, status: 'COMPLETED' },
    });

    // Calificación COMBINADA del negocio: mezcla las reseñas directas del negocio
    // (TenantReview) con las del cierre de cita que calificaron al negocio
    // (EmployeeReview.businessRating). Lo calcula el helper de abajo.
    // Rating combinado (TenantReview + EmployeeReview.businessRating)
    const combined = await this.getCombinedTenantRating(tenant.id);

    // Reseñas directas del negocio (TenantReview). La reseña del usuario
    // actual va primero para resaltarla en el frontend.
    const tenantReviewsRaw = await this.prisma.tenantReview.findMany({
      where: { tenantId: tenant.id },
      include: { user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
      orderBy: [{ updatedAt: 'desc' }],
    });

    // Separamos la reseña del propio usuario para ponerla la primera.
    let myTenantReview: any = null;
    // .filter recorre todas las reseñas y deja solo las que devuelven true.
    // Cuando encuentra la del usuario actual, la guarda aparte y devuelve false
    // (para sacarla de "otras"). "&&" exige ambas: que haya usuario y que coincida.
    const otherTenantReviews = tenantReviewsRaw.filter((r) => {
      if (marketplaceUserId && r.userId === marketplaceUserId) {
        myTenantReview = r;
        return false; // no la incluimos en "otras"
      }
      return true; // las demás sí
    });
    // Si existe la del usuario, la ponemos al principio; si no, solo "las otras".
    // "[x, ...lista]" crea una lista nueva con x delante de todos los elementos.
    const tenantReviews = myTenantReview ? [myTenantReview, ...otherTenantReviews] : otherTenantReviews;

    // Reseñas DEL NEGOCIO que vienen del flujo de cierre de cita: solo las que
    // traen businessRating (el cliente además calificó al negocio). Las que solo
    // califican al empleado NO van aquí — esas se muestran en el perfil del
    // empleado. Sin este filtro, el perfil del negocio mezclaba reseñas de
    // empleados con la calificación del empleado, mostrando reseñas que no son
    // del negocio.
    // Reseñas del negocio que vienen del cierre de cita: solo las visibles que
    // ADEMÁS calificaron al negocio (businessRating distinto de null). take: 20
    // limita a 20 (las más recientes). "{ not: null }" = "que no sea null".
    const employeeReviewsRaw = await this.prisma.employeeReview.findMany({
      where: { tenantId: tenant.id, isVisible: true, businessRating: { not: null } },
      include: {
        client: { select: { userId: true, firstName: true, lastName: true, avatarUrl: true } },
        employee: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    // Una sola reseña por cliente (la más reciente). Unificamos las reseñas
    // directas del marketplace (identificadas por userId) con las del cierre de
    // cita (por el userId vinculado del cliente, o su clientId si no tiene
    // cuenta de marketplace) y nos quedamos con la más reciente de cada persona.
    //
    // Paso 1: normalizamos las reseñas DIRECTAS (TenantReview) a un formato común.
    // .map recorre cada reseña (r) y la convierte al objeto de abajo.
    const tenantReviewsMapped = tenantReviews.map((r) => ({
      id: r.id,
      source: 'tenant' as const, // marca de origen (literal fijo)
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      // ¿es del usuario actual? Solo si hay usuario y el userId coincide.
      isMine: marketplaceUserId ? r.userId === marketplaceUserId : false,
      // Nombre del cliente: nombre + inicial del apellido. "r.user.lastName?.[0]"
      // toma la primera letra del apellido; "|| ''" si no hay apellido.
      clientName: `${r.user.firstName} ${r.user.lastName?.[0] || ''}.`,
      clientAvatarUrl: r.user.avatarUrl || null,
      employeeName: null as string | null, // las directas no tienen empleado
      businessRating: r.rating,
      businessComment: r.comment,
      // _key = clave para deduplicar: por usuario ("u:id") si lo hay, o por id de
      // reseña ("t:id"). Así dos reseñas del mismo usuario comparten clave.
      _key: r.userId ? `u:${r.userId}` : `t:${r.id}`,
      // _ts = marca de tiempo en milisegundos para ordenar. "??" (nullish): usa
      // updatedAt salvo que sea null/undefined, en cuyo caso usa createdAt.
      _ts: new Date(r.updatedAt ?? r.createdAt).getTime(),
    }));
    // Paso 2: normalizamos las reseñas del CIERRE DE CITA (EmployeeReview) al
    // mismo formato, usando businessRating/businessComment (la parte del negocio).
    const employeeReviewsMapped = employeeReviewsRaw.map((r) => ({
      id: r.id,
      source: 'employee' as const,
      // Reseña DEL NEGOCIO: mostramos businessRating/businessComment.
      rating: r.businessRating,
      comment: r.businessComment,
      createdAt: r.createdAt,
      updatedAt: r.createdAt,
      isMine: false,
      clientName: `${r.client.firstName} ${r.client.lastName?.[0] || ''}.`,
      clientAvatarUrl: (r.client as any).avatarUrl || null,
      // Nombre del empleado que atendió (texto o null).
      employeeName: `${r.employee.firstName} ${r.employee.lastName}` as string | null,
      businessRating: r.businessRating,
      businessComment: r.businessComment,
      // Clave por usuario vinculado si lo hay ("u:id"); si no, por cliente ("c:id").
      _key: r.client.userId ? `u:${r.client.userId}` : `c:${r.clientId}`,
      _ts: new Date(r.createdAt).getTime(),
    }));
    // Paso 3: DEDUPLICAR. seenReviewKeys recuerda las claves ya vistas (un Set
    // no admite repetidos y consulta muy rápido).
    const seenReviewKeys = new Set<string>();
    const dedupedReviews = [...tenantReviewsMapped, ...employeeReviewsMapped]
      // Juntamos ambas listas y ordenamos de más nueva a más vieja:
      // .sort con (a,b)=> b._ts - a._ts -> si el resultado es positivo, b va antes.
      .sort((a, b) => b._ts - a._ts)
      // .filter conserva solo la PRIMERA aparición de cada clave (la más reciente,
      // porque ya está ordenado): si la clave ya se vio, la descarta (false).
      .filter((r) => {
        if (seenReviewKeys.has(r._key)) return false;
        seenReviewKeys.add(r._key);
        return true;
      })
      // Nos quedamos como mucho con 10 reseñas (slice toma del índice 0 al 10).
      .slice(0, 10)
      // Quitamos los campos internos _key y _ts con desestructuración + rest:
      // se descartan y "rest" lleva todo lo demás.
      .map(({ _key, _ts, ...rest }) => rest);

    // Horario de atención del negocio, ordenado por día de la semana.
    // Get business hours
    const businessHours = await this.prisma.businessHours.findMany({
      where: { tenantId: tenant.id },
      orderBy: { dayOfWeek: 'asc' },
    });

    // Sucursales activas (con coordenadas para el mapa).
    // Get locations
    const locations = await this.prisma.location.findMany({
      where: { tenantId: tenant.id, isActive: true },
      select: {
        id: true,
        name: true,
        address: true,
        phone: true,
        latitude: true,
        longitude: true,
      },
    });

    // Paquetes de servicios (varios servicios con precio combinado).
    // Get bundles
    const bundles = await this.prisma.serviceBundle.findMany({
      where: { tenantId: tenant.id, isActive: true },
      select: {
        id: true,
        name: true,
        description: true,
        bundlePrice: true,
        serviceIds: true,
        totalDuration: true,
        savingsPercent: true,
      },
      orderBy: { sortOrder: 'asc' },
    });

    // Get active rewards (DESCUENTO/TWO_FOR_ONE) — antes era prisma.promotion,
    // pero en Fase 1 unificamos los datos. Ahora leemos de rewards y mapeamos
    // al mismo shape que esperaba el frontend (type=PERCENTAGE/FIXED_AMOUNT/
    // TWO_FOR_ONE, value=discountAmount). Los rewards tipo SERVICIO (canje
    // por puntos) NO se incluyen aqui — esos van por otro flujo.
    const now = new Date(); // momento actual, para comparar vigencias
    const activeRewards = await this.prisma.reward.findMany({
      where: {
        tenantId: tenant.id,
        isActive: true,
        // "in" = el tipo es uno de esos dos.
        type: { in: ['DESCUENTO', 'TWO_FOR_ONE'] },
        // Filtros de vigencia (si tienen rango definido)
        // OR = se cumple si CUALQUIERA de estas dos situaciones es verdad:
        OR: [
          // 1) No tiene fechas (siempre vigente).
          { startDate: null, endDate: null },
          // 2) Tiene fechas y HOY cae dentro del rango. AND = ambas a la vez.
          {
            AND: [
              // Empezó ya: sin fecha de inicio O inicio <= ahora (lte = <=).
              { OR: [{ startDate: null }, { startDate: { lte: now } }] },
              // No ha terminado: sin fecha de fin O fin >= ahora (gte = >=).
              { OR: [{ endDate: null }, { endDate: { gte: now } }] },
            ],
          },
        ],
      },
      select: {
        id: true,
        name: true,
        description: true,
        type: true,
        discountAmount: true,
        discountMode: true,
        code: true,
        startDate: true,
        endDate: true,
        maxRedemptions: true,
        timesRedeemed: true,
        serviceIds: true,
        minAmount: true,
        allowPointPayment: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Mapear al shape que espera el frontend (compat con promotions):
    // - Reward DESCUENTO + PERCENTAGE -> { type: 'PERCENTAGE', value: discountAmount }
    // - Reward DESCUENTO + FLAT       -> { type: 'FIXED_AMOUNT', value: discountAmount }
    // - Reward TWO_FOR_ONE            -> { type: 'TWO_FOR_ONE', value: 0 }
    const availablePromotions = activeRewards
      // Descartamos las que ya agotaron sus canjes: dejamos pasar si NO hay tope
      // (maxRedemptions == null) O si aún quedan (canjeadas < tope).
      .filter((r) => r.maxRedemptions == null || r.timesRedeemed < r.maxRedemptions)
      // Convertimos cada reward al formato de "promoción" que espera el frontend.
      .map((r) => {
        let mappedType: string = r.type; // tipo traducido
        let value: number = 0;           // valor del descuento
        if (r.type === 'DESCUENTO') {
          // Porcentaje o monto fijo según discountMode (ternario).
          mappedType = r.discountMode === 'PERCENTAGE' ? 'PERCENTAGE' : 'FIXED_AMOUNT';
          value = Number(r.discountAmount || 0);
        } else if (r.type === 'TWO_FOR_ONE') {
          // 2x1: no lleva valor numérico.
          mappedType = 'TWO_FOR_ONE';
          value = 0;
        }
        return {
          id: r.id,
          name: r.name,
          description: r.description,
          type: mappedType,
          value,
          code: r.code,
          startDate: r.startDate,
          endDate: r.endDate,
          maxUses: r.maxRedemptions,
          usedCount: r.timesRedeemed,
          serviceIds: r.serviceIds,
          minAmount: r.minAmount,
          allowPointPayment: r.allowPointPayment,
        };
      });

    // Imágenes de la galería del negocio, ordenadas por orden manual y fecha.
    // Get gallery images
    const gallery = await this.prisma.tenantGalleryImage.findMany({
      where: { tenantId: tenant.id },
      select: { id: true, imageUrl: true, caption: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });

    // ¿El usuario actual tiene este negocio en favoritos? Solo lo comprobamos si
    // está logueado. "!!fav" = true si encontró un favorito, false si null.
    // Check if favorited
    let isFavorited = false;
    if (marketplaceUserId) {
      // Favorito del PERFIL activo (cada perfil tiene su propia lista).
      const profileWhere = await this.buildFavoriteProfileWhere(marketplaceUserId, profileId);
      const fav = await this.prisma.marketplaceFavorite.findFirst({
        where: { userId: marketplaceUserId, tenantId: tenant.id, ...profileWhere },
      });
      isFavorited = !!fav;
    }

    // Separamos dos campos internos del resto del negocio (no queremos exponerlos
    // crudos): los convertimos a banderas más claras abajo.
    const { stripeOnboardingComplete, shopEnabled, ...tenantData } = tenant;

    return {
      data: {
        ...tenantData, // resto de datos del negocio
        // ¿acepta pagos online? = ¿terminó el onboarding de Stripe? ("!!" -> bool)
        acceptsOnlinePayment: !!stripeOnboardingComplete,
        shopEnabled: !!shopEnabled,
        // Calificación combinada calculada por el helper (promedio y total).
        averageRating: combined.avg,
        averageBusinessRating: combined.avg,
        totalReviews: combined.total,
        // La reseña propia del usuario (si la dejó), para mostrarla destacada.
        myReview: myTenantReview
          ? {
              id: myTenantReview.id,
              rating: myTenantReview.rating,
              comment: myTenantReview.comment,
              createdAt: myTenantReview.createdAt,
              updatedAt: myTenantReview.updatedAt,
            }
          : null,
        completedAppointments,
        services,
        employees,
        reviews: dedupedReviews, // reseñas combinadas y sin duplicados
        businessHours,
        locations,
        bundles,
        promotions: availablePromotions,
        gallery,
        isFavorited,
      },
    };
  }

  // ─── TENANT REVIEWS ────────────────────────────────────

  /**
   * Promedio combinado del negocio = todas las TenantReview + los businessRating
   * no nulos de EmployeeReview. Una métrica que refleja tanto la reseña directa
   * del marketplace como las que vienen del flujo de cierre de cita.
   */
  private async getCombinedTenantRating(tenantId: string) {
    // Lanzamos las dos agregaciones EN PARALELO con Promise.all y guardamos los
    // dos resultados con desestructuración de array ([a, b] = ...).
    const [tenantAgg, employeeBusinessAgg] = await Promise.all([
      // Agregado de las reseñas directas: promedio, suma y cantidad del rating.
      this.prisma.tenantReview.aggregate({
        where: { tenantId },
        _avg: { rating: true },
        _sum: { rating: true },
        _count: { id: true },
      }),
      // Agregado de las reseñas de cita que calificaron al negocio: suma y
      // cantidad de businessRating (solo visibles y no nulos).
      this.prisma.employeeReview.aggregate({
        where: { tenantId, isVisible: true, businessRating: { not: null } },
        _sum: { businessRating: true },
        _count: { businessRating: true },
      }),
    ]);

    // Pasamos las sumas a número ("|| 0" por si vienen null) y leemos los conteos.
    const tenantSum = Number(tenantAgg._sum.rating || 0);
    const tenantCount = tenantAgg._count.id;
    const empBusinessSum = Number(employeeBusinessAgg._sum.businessRating || 0);
    const empBusinessCount = employeeBusinessAgg._count.businessRating;

    // El promedio combinado = (suma total) / (cantidad total). Si no hay reseñas
    // (totalCount 0) devolvemos null para no dividir entre cero.
    const totalCount = tenantCount + empBusinessCount;
    const totalSum = tenantSum + empBusinessSum;
    const avg = totalCount > 0 ? totalSum / totalCount : null;

    return {
      // Promedio redondeado a 1 decimal, o null. "!== null" = "es distinto de null".
      avg: avg !== null ? Math.round(avg * 10) / 10 : null,
      total: totalCount,
    };
  }

  /**
   * Rating del empleado = sus EmployeeReview.rating + TODAS las TenantReview
   * del negocio donde trabaja. Esto cumple la regla "la puntuación al negocio
   * influye en el puntaje de los empleados".
   */
  private async getCombinedEmployeeRating(employeeId: string, tenantId: string) {
    // En paralelo: las reseñas DEL EMPLEADO y las reseñas DEL NEGOCIO donde
    // trabaja (estas últimas también suman a su puntuación, según la regla).
    const [empAgg, tenantAgg] = await Promise.all([
      this.prisma.employeeReview.aggregate({
        where: { employeeId, isVisible: true },
        _sum: { rating: true },
        _count: { id: true },
      }),
      this.prisma.tenantReview.aggregate({
        where: { tenantId },
        _sum: { rating: true },
        _count: { id: true },
      }),
    ]);

    // Sumas y conteos de cada parte (mismo patrón que el helper anterior).
    const empSum = Number(empAgg._sum.rating || 0);
    const empCount = empAgg._count.id;
    const tnSum = Number(tenantAgg._sum.rating || 0);
    const tnCount = tenantAgg._count.id;

    // Promedio ponderado por cantidad: sumamos totales y dividimos.
    const totalCount = empCount + tnCount;
    const totalSum = empSum + tnSum;
    const avg = totalCount > 0 ? totalSum / totalCount : null;

    return {
      avg: avg !== null ? Math.round(avg * 10) / 10 : null,
      total: totalCount,
    };
  }

  // getTenantReviews(): devuelve la lista de reseñas directas de un negocio + su
  // resumen de calificación combinada. userId opcional para marcar "isMine".
  async getTenantReviews(tenantSlug: string, userId?: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { id: true, isMarketplaceListed: true },
    });
    // "No listado en marketplace" = no aparece en búsquedas/descubrimiento, PERO
    // sigue accesible por enlace directo (slug). Por eso aquí solo validamos que
    // exista; el filtro de listado vive en discover()/discoverProfessionals().
    if (!tenant) {
      throw new NotFoundException('Negocio no encontrado');
    }

    // Todas las reseñas directas, con datos del autor, más nuevas primero.
    const reviews = await this.prisma.tenantReview.findMany({
      where: { tenantId: tenant.id },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Resumen combinado (promedio + total) usando el helper.
    const summary = await this.getCombinedTenantRating(tenant.id);

    return {
      data: {
        averageRating: summary.avg,
        totalReviews: summary.total,
        // Mapeamos cada reseña al formato del frontend.
        reviews: reviews.map((r) => ({
          id: r.id,
          rating: r.rating,
          comment: r.comment,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
          userId: r.userId,
          // ¿es del usuario actual? solo si hay userId y coincide.
          isMine: userId ? r.userId === userId : false,
          // Nombre = nombre + inicial del apellido + ".".
          userName: `${r.user.firstName} ${r.user.lastName?.[0] || ''}.`,
          userAvatarUrl: r.user.avatarUrl || null,
        })),
      },
    };
  }

  // upsertTenantReview(): crea la reseña del usuario para un negocio, o la
  // actualiza si ya existía ("upsert" = update + insert). 1 reseña por usuario.
  async upsertTenantReview(
    tenantSlug: string,
    userId: string,
    dto: CreateTenantReviewDto,
  ) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { id: true, isMarketplaceListed: true },
    });
    // "No listado en marketplace" = no aparece en búsquedas/descubrimiento, PERO
    // sigue accesible por enlace directo (slug). Por eso aquí solo validamos que
    // exista; el filtro de listado vive en discover()/discoverProfessionals().
    if (!tenant) {
      throw new NotFoundException('Negocio no encontrado');
    }

    // upsert busca por la clave única (negocio + usuario). Si existe ejecuta
    // "update"; si no, "create". ".trim()" quita espacios sobrantes; "|| null"
    // guarda null si el comentario quedó vacío.
    const review = await this.prisma.tenantReview.upsert({
      where: { tenantId_userId: { tenantId: tenant.id, userId } },
      create: {
        tenantId: tenant.id,
        userId,
        rating: dto.rating,
        comment: dto.comment?.trim() || null,
      },
      update: {
        rating: dto.rating,
        comment: dto.comment?.trim() || null,
      },
    });

    return {
      data: {
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt,
        updatedAt: review.updatedAt,
        isMine: true,
      },
    };
  }

  // deleteTenantReview(): borra la reseña del usuario para ese negocio (si la hay).
  async deleteTenantReview(tenantSlug: string, userId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { id: true },
    });
    if (!tenant) throw new NotFoundException('Negocio no encontrado');

    // deleteMany no falla si no hay nada que borrar (a diferencia de delete).
    await this.prisma.tenantReview.deleteMany({
      where: { tenantId: tenant.id, userId },
    });

    return { data: { message: 'Reseña eliminada' } };
  }

  // ─── PROFESSIONAL PROFILE (public) ─────────────────────

  // getBusinessTypes(): catálogo de tipos de negocio activos (para filtros).
  async getBusinessTypes() {
    const types = await this.prisma.businessTypeCatalog.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { value: true, label: true },
    });
    return { data: types };
  }

  // getServiceCatalog(): catálogo de servicios estándar (nombre + categoría).
  async getServiceCatalog() {
    const services = await this.prisma.serviceCatalog.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { name: true, category: true, description: true },
    });
    return { data: services };
  }

  // getProfessions(): catálogo de profesiones. Devolvemos solo los nombres:
  // .map(p => p.name) convierte cada objeto { name } en su texto.
  async getProfessions() {
    const professions = await this.prisma.profession.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { name: true },
    });
    return { data: professions.map((p) => p.name) };
  }

  // toggleProfessionalFavorite(): marca/desmarca un profesional como favorito
  // (mismo patrón que toggleFavorite de negocios, pero con empleados).
  async toggleProfessionalFavorite(marketplaceUserId: string, employeeId: string, profileId?: string) {
    // El favorito pertenece al PERFIL activo (cada perfil tiene su propia lista).
    const activeProfileId = await this.resolveActiveProfileId(marketplaceUserId, profileId);

    const existing = await this.prisma.marketplaceProfessionalFavorite.findFirst({
      where: { userId: marketplaceUserId, profileId: activeProfileId, employeeId },
    });

    if (existing) {
      await this.prisma.marketplaceProfessionalFavorite.delete({ where: { id: existing.id } });
      return { data: { favorited: false } };
    }

    await this.prisma.marketplaceProfessionalFavorite.create({
      data: { userId: marketplaceUserId, profileId: activeProfileId, employeeId },
    });
    return { data: { favorited: true } };
  }

  // getMyProfessionalFavorites(): profesionales favoritos del usuario, con su
  // negocio y su calificación.
  async getMyProfessionalFavorites(marketplaceUserId: string, profileId?: string) {
    // Solo los profesionales favoritos del PERFIL activo (el titular hereda los
    // antiguos sin perfil).
    const profileWhere = await this.buildFavoriteProfileWhere(marketplaceUserId, profileId);
    const favorites = await this.prisma.marketplaceProfessionalFavorite.findMany({
      where: { userId: marketplaceUserId, ...profileWhere },
      include: {
        employee: {
          select: {
            id: true, firstName: true, lastName: true, avatarUrl: true,
            coverImageUrl: true, color: true, bio: true, jobTitle: true,
            tenant: { select: { name: true, slug: true, address: true } },
            // _count cuenta relaciones: nº de citas y de reseñas del empleado.
            _count: { select: { appointments: true, reviews: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Enriquecemos cada favorito con su rating (en paralelo con Promise.all).
    const enriched = await Promise.all(
      favorites.map(async (fav) => {
        const ratingAgg = await this.prisma.employeeReview.aggregate({
          where: { employeeId: fav.employeeId, isVisible: true },
          _avg: { rating: true },
          _count: { id: true },
        });
        return {
          ...fav.employee, // datos del empleado
          // "Aplanamos" el negocio en campos sueltos para el frontend.
          businessName: fav.employee.tenant.name,
          tenantSlug: fav.employee.tenant.slug,
          address: fav.employee.tenant.address,
          averageRating: ratingAgg._avg.rating ? Math.round(ratingAgg._avg.rating * 10) / 10 : null,
          totalReviews: ratingAgg._count.id,
        };
      }),
    );

    return { data: enriched };
  }

  // discoverProfessionals(): buscador de profesionales (la pestaña
  // "Profesionales"). Recibe filtros y devuelve una página con rating.
  async discoverProfessionals(dto: {
    search?: string;
    jobTitle?: string;
    lat?: number;
    lng?: number;
    perPage?: number;
    page?: number;
  }) {
    // Desestructuramos con valores por defecto (30 por página, página 1).
    const { search, jobTitle, perPage = 30, page = 1 } = dto;
    // skip = cuántos saltar para la paginación.
    const skip = (page - 1) * perPage;

    // Construimos el filtro "where" base: empleado activo, de un negocio listado
    // y con suscripción válida. ": any" porque iremos añadiendo claves abajo.
    const where: any = {
      isActive: true,
      tenant: {
        isMarketplaceListed: true,
        subscriptionStatus: { in: ['active', 'ACTIVE', 'TRIAL'] },
      },
    };

    if (search) {
      // Quitamos un "#" inicial (de hashtags) y espacios sobrantes.
      const cleanSearch = search.replace('#', '').trim();
      // Busqueda multi-campo: nombre, apellido, especialidad (jobTitle),
      // bio, servicios que realiza el profesional y categoria del negocio
      // donde trabaja. Permite encontrar profesionales por lo que ofrecen,
      // no solo por su nombre.
      // "contains" = "que contenga ese texto". "some" = "que exista alguno".
      where.OR = [
        { firstName: { contains: cleanSearch } },
        { lastName: { contains: cleanSearch } },
        { jobTitle: { contains: cleanSearch } },
        { bio: { contains: cleanSearch } },
        { employeeServices: { some: { service: { name: { contains: cleanSearch } } } } },
        { tenant: { businessType: { contains: cleanSearch } } },
      ];
    }

    // Filtro adicional por especialidad exacta (si vino jobTitle).
    if (jobTitle) {
      where.jobTitle = { contains: jobTitle };
    }

    // En paralelo: la página de empleados y el total que cumple el filtro.
    const [employees, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        skip,        // saltar
        take: perPage, // cuántos traer
        // Orden alfabetico por nombre + apellido (es-MX).
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
        select: {
          id: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          coverImageUrl: true,
          color: true,
          bio: true,
          jobTitle: true,
          tenant: {
            select: { name: true, slug: true, address: true },
          },
          _count: {
            select: { appointments: true, reviews: true },
          },
        },
      }),
      this.prisma.employee.count({ where }), // total para la paginación
    ]);

    // Añadimos a cada empleado su calificación (en paralelo).
    // Enrich with ratings
    const enriched = await Promise.all(
      employees.map(async (emp) => {
        const ratingAgg = await this.prisma.employeeReview.aggregate({
          where: { employeeId: emp.id, isVisible: true },
          _avg: { rating: true },
          _count: { id: true },
        });
        return {
          ...emp,
          businessName: emp.tenant.name,
          tenantSlug: emp.tenant.slug,
          address: emp.tenant.address,
          averageRating: ratingAgg._avg.rating
            ? Math.round(ratingAgg._avg.rating * 10) / 10
            : null,
          totalReviews: ratingAgg._count.id,
        };
      }),
    );

    return {
      data: enriched,
      meta: { total, page, perPage, totalPages: Math.ceil(total / perPage) },
    };
  }

  // getProfessionalProfile(): perfil público completo de un profesional:
  // datos, estadísticas, portafolio de fotos, servicios, top de servicios y
  // reseñas recientes.
  async getProfessionalProfile(tenantSlug: string, employeeId: string) {
    // Negocio dueño del profesional (debe estar listado).
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { id: true, name: true, slug: true, isMarketplaceListed: true, shopEnabled: true },
    });

    // "No listado en marketplace" = no aparece en búsquedas/descubrimiento, PERO
    // sigue accesible por enlace directo (slug). Por eso aquí solo validamos que
    // exista; el filtro de listado vive en discover()/discoverProfessionals().
    if (!tenant) {
      throw new NotFoundException('Negocio no encontrado');
    }

    // El empleado, que debe pertenecer a ese negocio y estar activo.
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, tenantId: tenant.id, isActive: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        coverImageUrl: true,
        color: true,
        bio: true,
      },
    });

    if (!employee) {
      throw new NotFoundException('Profesional no encontrado');
    }

    // Lanzamos 5 consultas a la vez (Promise.all) y repartimos los resultados:
    // citas completadas, agregado de rating, portafolio manual, fotos de
    // resultado de citas, y el "top" de servicios más realizados.
    // Stats, rating, dos fuentes de portfolio (manual + appointment photos)
    // y top services en paralelo.
    const [completedCount, ratingAgg, manualPortfolio, worksRaw, topServices] = await Promise.all([
      this.prisma.appointment.count({
        where: { employeeId, tenantId: tenant.id, status: 'COMPLETED' },
      }),
      this.prisma.employeeReview.aggregate({
        where: { employeeId, tenantId: tenant.id, isVisible: true },
        _avg: { rating: true },
        _count: { id: true },
      }),
      // Portfolio manual curado desde el dashboard (EmployeePortfolioImage).
      // Si tienen serviceId asignado, se incluye el service para categorizar.
      // Si no, aparecen solo en el tab "Todos".
      // Las fotos con isHidden=true no se muestran en el perfil publico —
      // siguen en el portafolio personal del empleado para que pueda
      // revertir cuando quiera.
      // Las isFeatured=true aparecen primero en el perfil publico.
      this.prisma.employeePortfolioImage.findMany({
        where: { employeeId, isHidden: false },
        include: {
          service: { select: { id: true, name: true } },
        },
        orderBy: [{ isFeatured: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }],
        take: 60,
      }),
      // Fotos de resultado subidas al cerrar las citas COMPLETED del empleado.
      // Si la foto tiene serviceId, ese es el servicio (1 foto = 1 servicio).
      // Si no tiene (legacy, antes del cambio), fallback a todos los items de
      // la cita filtrados a este empleado.
      this.prisma.appointmentPhoto.findMany({
        where: {
          tenantId: tenant.id,
          appointment: {
            employeeId,
            tenantId: tenant.id,
            status: 'COMPLETED',
          },
        },
        include: {
          service: { select: { id: true, name: true } },
          appointment: {
            select: {
              id: true,
              items: {
                where: { employeeId },
                select: {
                  serviceId: true,
                  serviceNameSnapshot: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 60,
      }),
      // groupBy agrupa los items de cita por nombre de servicio y cuenta cuántas
      // veces aparece cada uno; ordena de mayor a menor y se queda con los 5 top.
      this.prisma.appointmentItem.groupBy({
        by: ['serviceNameSnapshot'],
        where: {
          appointment: { employeeId, tenantId: tenant.id, status: 'COMPLETED' },
        },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      }),
    ]);

    // Merge de las dos fuentes en un solo array. Cada item tiene services[]
    // (vacio para fotos manuales). El frontend agrupa por nombre de servicio
    // y muestra las fotos manuales solo en el tab "Todos".
    //
    // Deduplicacion por imageUrl: una misma foto puede estar en ambas
    // tablas porque el wizard de cerrar cita crea AppointmentPhoto Y
    // auto-copia a EmployeePortfolioImage. Manual gana (tiene metadata
    // rica: isFeatured, isHidden, sortOrder).
    const seen = new Set<string>(); // URLs ya añadidas (para no repetir)
    const portfolio: any[] = [];    // resultado final del portafolio
    // Primero el portafolio MANUAL (tiene prioridad).
    for (const p of manualPortfolio) {
      // "continue" salta a la siguiente vuelta si esta URL ya se añadió.
      if (seen.has(p.imageUrl)) continue;
      seen.add(p.imageUrl);
      portfolio.push({
        id: p.id,
        imageUrl: p.imageUrl,
        caption: p.caption,
        createdAt: p.createdAt,
        // Si la foto tiene un servicio, lo ponemos en services[]; si no, vacío.
        services: p.service ? [{ id: p.service.id, name: p.service.name }] : [],
      });
    }
    // Luego las fotos de RESULTADO de citas (solo las que aún no estaban).
    for (const p of worksRaw) {
      if (seen.has(p.imageUrl)) continue;
      seen.add(p.imageUrl);
      portfolio.push({
        id: p.id,
        imageUrl: p.imageUrl,
        caption: p.caption,
        createdAt: p.createdAt,
        // Si la foto trae su propio servicio, lo usamos; si no (datos antiguos),
        // tomamos los items de la cita de este empleado. "(... || [])" evita
        // error si appointment/items fuera null, y .map los transforma.
        services: p.service
          ? [{ id: p.service.id, name: p.service.name }]
          : (p.appointment?.items || []).map((it) => ({
              id: it.serviceId,
              name: it.serviceNameSnapshot,
            })),
      });
    }

    // Top de servicios: si hay datos de citas completadas, los usamos. Si no
    // (profesional nuevo), mostramos sus servicios asignados con count 0.
    // If no completed work yet, fallback to assigned services
    let finalTopServices: { serviceName: string; count: number }[];
    if (topServices.length > 0) {
      finalTopServices = topServices.map((s) => ({
        serviceName: s.serviceNameSnapshot,
        count: s._count.id, // cuántas veces se hizo
      }));
    } else {
      const assignedServices = await this.prisma.employeeService.findMany({
        where: { employeeId },
        include: { service: { select: { name: true } } },
        take: 5,
      });
      finalTopServices = assignedServices.map((es) => ({
        serviceName: es.service.name,
        count: 0,
      }));
    }

    // Reseñas recientes del empleado (máximo 10, más nuevas primero).
    // Recent reviews for this employee
    const reviews = await this.prisma.employeeReview.findMany({
      where: { employeeId, tenantId: tenant.id, isVisible: true },
      include: {
        client: { select: { firstName: true, lastName: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // Lista completa de servicios que el profesional realiza, para mostrar
    // en una seccion dedicada del perfil. Incluye duracion y precio para
    // que el cliente pueda elegir.
    const allServices = await this.prisma.employeeService.findMany({
      where: { employeeId, service: { isActive: true } },
      include: {
        service: {
          select: {
            id: true,
            name: true,
            description: true,
            durationMinutes: true,
            price: true,
            currency: true,
            category: true,
            subcategory: true,
          },
        },
      },
    });
    const services = allServices
      .map((es) => es.service)        // sacamos el objeto "service" de cada fila
      .filter(Boolean)                // descartamos los nulos (filter(Boolean))
      // localeCompare ordena alfabéticamente respetando el español (tildes, ñ).
      .sort((a: any, b: any) => a.name.localeCompare(b.name, 'es'));

    // Rating combinado del empleado: incluye TenantReview del negocio.
    const combinedEmpRating = await this.getCombinedEmployeeRating(employeeId, tenant.id);

    // Horario de atención del PROFESIONAL: su propio horario de empleado
    // (employee_schedules), que es lo que realmente marca cuándo atiende. El
    // freelancer configura justo esto en "Mi horario". Tomamos el horario vigente
    // (por rango effectiveFrom/Until) y nos quedamos con una fila por día.
    const nowSchedule = new Date();
    const empSchedules = await this.prisma.employeeSchedule.findMany({
      where: {
        employeeId,
        effectiveFrom: { lte: nowSchedule },
        OR: [{ effectiveUntil: null }, { effectiveUntil: { gte: nowSchedule } }],
      },
      orderBy: [{ dayOfWeek: 'asc' }, { effectiveFrom: 'desc' }],
      select: { dayOfWeek: true, startTime: true, endTime: true, isWorking: true },
    });
    const seenDays = new Set<string>();
    let businessHours = empSchedules
      .filter((s) => (seenDays.has(s.dayOfWeek) ? false : (seenDays.add(s.dayOfWeek), true)))
      .map((s) => ({ dayOfWeek: s.dayOfWeek, openTime: s.startTime, closeTime: s.endTime, isOpen: s.isWorking }));
    // Fallback: si el profesional no tiene horario propio, usamos el del negocio.
    if (businessHours.length === 0) {
      businessHours = await this.prisma.businessHours.findMany({
        where: { tenantId: tenant.id },
        orderBy: { dayOfWeek: 'asc' },
        select: { dayOfWeek: true, openTime: true, closeTime: true, isOpen: true },
      });
    }

    return {
      data: {
        ...employee,
        businessName: tenant.name,
        tenantSlug: tenant.slug,
        shopEnabled: tenant.shopEnabled, // ¿el profesional tiene tienda activa?
        businessHours, // horario de atención (para freelancer, es el suyo)
        completedAppointments: completedCount,
        averageRating: combinedEmpRating.avg,
        totalReviews: combinedEmpRating.total,
        portfolio,
        services,
        topServices: finalTopServices,
        reviews: reviews.map((r) => ({
          id: r.id,
          rating: r.rating,
          comment: r.comment,
          createdAt: r.createdAt,
          clientName: `${r.client.firstName} ${r.client.lastName?.[0] || ''}.`,
          clientAvatarUrl: r.client.avatarUrl || null,
        })),
      },
    };
  }

  // ─── ENTER BUSINESS ──────────────────────────────────

  // enterBusiness(): "entrar" a un negocio desde el marketplace. Asegura que el
  // usuario tenga una ficha de Client en ese negocio y emite tokens del PORTAL
  // DEL CLIENTE (otro tipo de token, por-negocio) para que pueda usarlo.
  async enterBusiness(marketplaceUserId: string, tenantSlug: string, profileId?: string) {
    // Buscamos el negocio por slug (lanza error si no existe).
    const tenant = await this.tenantsService.findBySlug(tenantSlug);

    // Resolvemos el perfil activo (el que mandó el front, o el SELF por defecto)
    // y obtenemos/creamos su ficha de cliente en este negocio. Así, si el tutor
    // entra "como" un hijo, el portal del negocio opera dentro del perfil del hijo.
    const activeProfileId = await this.resolveActiveProfileId(marketplaceUserId, profileId);
    const client = await this.resolveClientForProfile(tenant.id, activeProfileId);

    // Firmamos un JWT de CLIENTE (distinto del de marketplace): lleva el id del
    // cliente, el negocio, type:'client' y un "issuer" que lo identifica.
    // Generate per-tenant client JWT (same format as client-portal)
    const clientAccessToken = this.jwtService.sign(
      {
        sub: client.id,
        tenantId: tenant.id,
        email: client.email || undefined,
        phone: client.phone || undefined,
        type: 'client' as const,
      },
      {
        expiresIn: process.env.JWT_CLIENT_ACCESS_EXPIRY || '15m',
        issuer: 'siliba-client',
      },
    );

    // Creamos también un refresh token de cliente (opaco). uuidv4() genera un id
    // aleatorio; lo hasheamos con bcrypt para guardarlo (nunca en claro); la
    // "pista" son sus 8 primeros caracteres (para buscarlo luego).
    // Generate client refresh token for seamless portal usage
    const refreshTokenValue = uuidv4();
    const tokenHash = await bcrypt.hash(refreshTokenValue, 10);
    const tokenHint = refreshTokenValue.substring(0, 8);
    // Expira en 30 días: tomamos la fecha de hoy y le sumamos 30 días.
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await this.prisma.clientRefreshToken.create({
      data: {
        tokenHash, // guardamos el hash, no el token en claro
        tokenHint,
        clientId: client.id,
        expiresAt,
      },
    });

    // Devolvemos los tokens de cliente y datos del cliente y del negocio para que
    // el frontend pueda abrir el portal de ese negocio sin pedir login otra vez.
    return {
      clientAccessToken,
      clientRefreshToken: refreshTokenValue,
      client: {
        id: client.id,
        firstName: client.firstName,
        lastName: client.lastName,
        email: client.email,
      },
      tenant: {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
      },
    };
  }

  // ─── QR ──────────────────────────────────────────────

  // getQrData(): arma los datos para generar el código QR de un negocio
  // (la URL pública + nombre/logo). Lo usa el STAFF desde su dashboard.
  async getQrData(tenantId: string, locationId?: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, slug: true, logoUrl: true },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant no encontrado');
    }

    // Si vino una sucursal, obtenemos su nombre (o null). "?." evita error si la
    // sucursal no existe; "|| null" deja null en ese caso.
    let locationName: string | null = null;
    if (locationId) {
      const location = await this.prisma.location.findFirst({
        where: { id: locationId, tenantId },
      });
      locationName = location?.name || null;
    }

    // Base URL para el QR del negocio: ordena de mas especifico a generico.
    // APP_BASE_URL es la variable canonica para el dominio publico del web;
    // FRONTEND_URL es la que ya existe en .env de produccion (la usa CORS,
    // emails, etc), asi cubre tenants ya desplegados sin tener que editar
    // .env. El localhost queda solo como fallback de desarrollo local.
    // Elegimos la URL base: primero la variable canónica, luego la de producción
    // existente, y por último localhost (desarrollo). "||" toma la primera con valor.
    const baseUrl =
      process.env.APP_BASE_URL ||
      process.env.FRONTEND_URL ||
      'http://localhost:3000';
    // Construimos la URL del QR: con sucursal añade ?location=..., si no, sin ella.
    const qrUrl = locationId
      ? `${baseUrl}/qr/${tenant.slug}?location=${locationId}`
      : `${baseUrl}/qr/${tenant.slug}`;

    return {
      data: {
        url: qrUrl,
        tenantName: tenant.name,
        tenantSlug: tenant.slug,
        logoUrl: tenant.logoUrl,
        locationName,
      },
    };
  }

  // ─── PERFILES (multi-perfil estilo Netflix) ─────────────
  // Un User (tutor) tiene varios Profile: el suyo (SELF) y los de sus hijos
  // (CHILD/OTHER). Cada Profile se materializa como un Client por tenant cuando
  // reserva, de modo que las citas de cada perfil quedan separadas.

  // Paleta de colores para los perfiles (misma que la de empleados). El SELF
  // arranca en teal (#008080, índice 0); los hijos rotan por la paleta.
  private readonly PROFILE_COLORS = [
    '#008080', '#6366f1', '#ec4899', '#f59e0b', '#10b981', '#ef4444',
    '#3b82f6', '#8b5cf6', '#14b8a6', '#f97316', '#84cc16', '#06b6d4',
  ];

  // Calcula si una fecha de nacimiento corresponde a un menor de edad (<18).
  private computeIsMinor(dateOfBirth?: Date | string | null): boolean {
    if (!dateOfBirth) return false;
    const d = new Date(dateOfBirth);
    if (isNaN(d.getTime())) return false;
    const now = new Date();
    let age = now.getFullYear() - d.getFullYear();
    const m = now.getMonth() - d.getMonth();
    // Si aún no ha cumplido años este año, restamos uno.
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
    return age < 18;
  }

  // Formato de salida de un perfil para el frontend.
  private mapProfile(p: any) {
    return {
      id: p.id,
      relationship: p.relationship,
      firstName: p.firstName,
      lastName: p.lastName,
      avatarUrl: p.avatarUrl,
      dateOfBirth: p.dateOfBirth,
      gender: p.gender,
      allergies: p.allergies,
      isMinor: p.isMinor,
      isDefault: p.isDefault,
      color: p.color ?? '#008080',
      guardianTermsAcceptedAt: p.guardianTermsAcceptedAt ?? null,
    };
  }

  // Garantiza que el User tenga su perfil SELF (lo crea si falta, p.ej. cuentas
  // creadas antes de la migración o por flujos que no lo generaron).
  private async ensureSelfProfile(userId: string) {
    let self = await this.prisma.profile.findFirst({
      where: { userId, relationship: 'SELF' },
    });
    if (!self) {
      const u = await this.prisma.user.findUnique({ where: { id: userId } });
      self = await this.prisma.profile.create({
        data: {
          userId,
          relationship: 'SELF',
          firstName: u?.firstName ?? '',
          lastName: u?.lastName ?? '',
          avatarUrl: u?.avatarUrl ?? null,
          dateOfBirth: u?.birthDate ?? null,
          gender: u?.gender ?? null,
          allergies: u?.allergies ?? null,
          isDefault: true,
          color: this.PROFILE_COLORS[0], // SELF = teal
        },
      });
    }
    return self;
  }

  // Devuelve el profileId activo: si el front mandó uno, valida que sea de este
  // usuario y no esté archivado; si no mandó, usa el perfil SELF (retrocompatible).
  private async resolveActiveProfileId(userId: string, profileId?: string): Promise<string> {
    if (profileId) {
      const p = await this.prisma.profile.findFirst({
        where: { id: profileId, userId, archivedAt: null },
      });
      if (!p) throw new ForbiddenException('Perfil no válido');
      return p.id;
    }
    const self = await this.ensureSelfProfile(userId);
    return self.id;
  }

  // Construye el filtro `where` por perfil para favoritos/cupones: si no llega
  // perfil, no filtra; si llega, solo ese perfil — salvo el TITULAR (SELF/
  // default), que además hereda los registros antiguos sin perfil (profileId
  // null) creados antes de este sistema.
  private async buildFavoriteProfileWhere(
    marketplaceUserId: string,
    profileId?: string,
  ): Promise<any> {
    if (!profileId) return {};
    const activeProfileId = await this.resolveActiveProfileId(marketplaceUserId, profileId);
    const prof = await this.prisma.profile.findUnique({
      where: { id: activeProfileId },
      select: { relationship: true, isDefault: true },
    });
    const isOwner = prof?.relationship === 'SELF' || prof?.isDefault;
    return isOwner
      ? { OR: [{ profileId: activeProfileId }, { profileId: null }] }
      : { profileId: activeProfileId };
  }

  // Busca o crea la ficha Client de un perfil en un negocio. Centraliza el
  // find-or-create que antes estaba duplicado en enterBusiness y bookAppointment.
  private async resolveClientForProfile(tenantId: string, profileId: string) {
    const profile = await this.prisma.profile.findUnique({ where: { id: profileId } });
    if (!profile) throw new NotFoundException('Perfil no encontrado');

    // 1) ¿Ya existe ficha para (negocio, perfil)?
    const existingByProfile = await this.prisma.client.findFirst({
      where: { tenantId, profileId },
    });
    if (existingByProfile) return existingByProfile;

    // Datos del tutor (dueño del perfil) para el contacto de la ficha.
    const owner = await this.prisma.user.findUnique({ where: { id: profile.userId } });

    // 2) Solo para el perfil SELF: intentar vincular una ficha walk-in previa que
    // tenga el email del tutor (era un cliente que ya había ido en persona).
    if (profile.relationship === 'SELF' && owner?.email) {
      const walkIn = await this.prisma.client.findFirst({
        where: { tenantId, email: owner.email, profileId: null },
      });
      if (walkIn) {
        return this.prisma.client.update({
          where: { id: walkIn.id },
          data: { profileId, userId: profile.userId },
        });
      }
    }

    // 3) Crear ficha nueva. El HIJO hereda el contacto (email/teléfono) del
    // tutor, pero su propio nombre, fecha de nacimiento y alergias (la cita
    // queda atribuida al hijo y el negocio contacta al tutor).
    return this.prisma.client.create({
      data: {
        tenantId,
        profileId,
        userId: profile.userId,
        firstName: profile.firstName,
        lastName: profile.lastName,
        email: owner?.email ?? null,
        phone: owner?.phone ?? null,
        dateOfBirth: profile.dateOfBirth,
        gender: profile.gender,
        avatarUrl: profile.avatarUrl,
        source: 'MARKETPLACE',
        portalRegisteredAt: new Date(),
      },
    });
  }

  // Lista los perfiles del usuario (SELF primero). Auto-crea el SELF si falta.
  async listProfiles(userId: string) {
    await this.ensureSelfProfile(userId);
    const profiles = await this.prisma.profile.findMany({
      where: { userId, archivedAt: null },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
    return { data: profiles.map((p) => this.mapProfile(p)) };
  }

  // Crea un perfil nuevo (hijo/familiar). No se permite crear un segundo SELF.
  async createProfile(
    userId: string,
    dto: { firstName: string; lastName: string; relationship?: string; dateOfBirth?: string; gender?: string; allergies?: string; guardianTermsAccepted?: boolean; color?: string },
  ) {
    const relationship = dto.relationship === 'OTHER' ? 'OTHER' : 'CHILD';
    const dateOfBirth = dto.dateOfBirth ? new Date(dto.dateOfBirth) : null;
    const isMinor = this.computeIsMinor(dateOfBirth);
    // Si el perfil es de un menor, el tutor DEBE aceptar el aviso/términos.
    if (isMinor && dto.guardianTermsAccepted !== true) {
      throw new BadRequestException('Debes aceptar el aviso para perfiles de menores');
    }
    // Color: el que mande el front, o uno de la paleta según cuántos perfiles
    // ya tiene (rota para que cada perfil nuevo tienda a un color distinto).
    let color = dto.color;
    if (!color) {
      const count = await this.prisma.profile.count({ where: { userId } });
      color = this.PROFILE_COLORS[count % this.PROFILE_COLORS.length];
    }
    const profile = await this.prisma.profile.create({
      data: {
        userId,
        relationship,
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        dateOfBirth,
        gender: dto.gender ?? null,
        allergies: dto.allergies ?? null,
        isMinor,
        isDefault: false,
        color,
        // Registro de la aceptación (solo aplica a menores).
        guardianTermsAcceptedAt: isMinor ? new Date() : null,
      },
    });
    return { data: this.mapProfile(profile) };
  }

  // Edita un perfil. Valida que sea del usuario. Propaga nombre/avatar/alergias
  // a las fichas Client ya materializadas de ese perfil.
  async updateProfileEntity(
    userId: string,
    profileId: string,
    dto: { firstName?: string; lastName?: string; dateOfBirth?: string | null; gender?: string; allergies?: string; avatarUrl?: string; guardianTermsAccepted?: boolean; color?: string },
  ) {
    const profile = await this.prisma.profile.findFirst({ where: { id: profileId, userId } });
    if (!profile) throw new NotFoundException('Perfil no encontrado');

    const dateOfBirth =
      dto.dateOfBirth === undefined
        ? profile.dateOfBirth
        : dto.dateOfBirth
          ? new Date(dto.dateOfBirth)
          : null;

    const isMinor = this.computeIsMinor(dateOfBirth);
    // Si el perfil (ahora) es de un menor y aún no se habían aceptado los
    // términos, exigimos la aceptación del tutor antes de guardar.
    if (isMinor && !profile.guardianTermsAcceptedAt && dto.guardianTermsAccepted !== true) {
      throw new BadRequestException('Debes aceptar el aviso para perfiles de menores');
    }

    const updated = await this.prisma.profile.update({
      where: { id: profileId },
      data: {
        firstName: dto.firstName?.trim() ?? profile.firstName,
        lastName: dto.lastName?.trim() ?? profile.lastName,
        dateOfBirth,
        gender: dto.gender ?? profile.gender,
        allergies: dto.allergies ?? profile.allergies,
        avatarUrl: dto.avatarUrl ?? profile.avatarUrl,
        color: dto.color ?? profile.color,
        isMinor,
        // Sellamos la aceptación si es menor y aún no estaba registrada.
        guardianTermsAcceptedAt:
          isMinor ? profile.guardianTermsAcceptedAt ?? new Date() : profile.guardianTermsAcceptedAt,
      },
    });

    // Reflejar nombre/avatar en las fichas Client de este perfil (el Client no
    // guarda alergias; esas viven en el Profile).
    await this.prisma.client.updateMany({
      where: { profileId },
      data: {
        firstName: updated.firstName,
        lastName: updated.lastName,
        avatarUrl: updated.avatarUrl,
      },
    });

    return { data: this.mapProfile(updated) };
  }

  // Elimina (archiva) un perfil. No se puede borrar el SELF. Si tiene citas
  // próximas, se bloquea; si solo tiene pasadas, se archiva (conserva historial).
  async deleteProfile(userId: string, profileId: string) {
    const profile = await this.prisma.profile.findFirst({ where: { id: profileId, userId } });
    if (!profile) throw new NotFoundException('Perfil no encontrado');
    if (profile.relationship === 'SELF') {
      throw new BadRequestException('No puedes eliminar tu propio perfil');
    }

    const clients = await this.prisma.client.findMany({ where: { profileId }, select: { id: true } });
    const clientIds = clients.map((c) => c.id);
    if (clientIds.length > 0) {
      const future = await this.prisma.appointment.count({
        where: { clientId: { in: clientIds }, status: { in: ['PENDING', 'CONFIRMED', 'RESCHEDULED'] } },
      });
      if (future > 0) {
        throw new BadRequestException('Este perfil tiene citas próximas. Cancélalas o reagéndalas antes de eliminarlo.');
      }
    }

    await this.prisma.profile.update({ where: { id: profileId }, data: { archivedAt: new Date() } });
    return { data: { deleted: true } };
  }

  // ─── PROFILE ────────────────────────────────────────

  // updateProfile(): actualiza el perfil del usuario y propaga los cambios a sus
  // fichas de Client en cada negocio (para que el POS muestre datos actuales).
  async updateProfile(marketplaceUserId: string, dto: UpdateMarketplaceProfileDto) {
    // Verificamos que el usuario exista.
    const current = await this.prisma.user.findUnique({
      where: { id: marketplaceUserId },
    });
    if (!current) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Construimos los cambios SOLO con los campos que vinieron (!== undefined =
    // "el cliente envió este campo, aunque sea vacío"). Así no borramos lo que
    // no se tocó. Para varios, "|| null" guarda null si llegó vacío; en fechas,
    // un ternario crea el Date o pone null.
    const updateData: any = {};
    if (dto.firstName !== undefined) updateData.firstName = dto.firstName;
    if (dto.lastName !== undefined) updateData.lastName = dto.lastName;
    if (dto.birthDate !== undefined) updateData.birthDate = dto.birthDate ? new Date(dto.birthDate) : null;
    if (dto.gender !== undefined) updateData.gender = dto.gender || null;
    if (dto.allergies !== undefined) updateData.allergies = dto.allergies || null;
    if (dto.emergencyContactName !== undefined) updateData.emergencyContactName = dto.emergencyContactName || null;
    if (dto.emergencyContactLastName !== undefined) updateData.emergencyContactLastName = dto.emergencyContactLastName || null;
    if (dto.emergencyContactPhone !== undefined) updateData.emergencyContactPhone = dto.emergencyContactPhone || null;
    if (dto.emergencyContactRelation !== undefined) updateData.emergencyContactRelation = dto.emergencyContactRelation || null;
    if (dto.address !== undefined) updateData.address = dto.address || null;
    if (dto.country !== undefined) updateData.country = dto.country || null;
    if (dto.phone !== undefined) updateData.phone = dto.phone || null;

    const user = await this.prisma.user.update({
      where: { id: marketplaceUserId },
      data: updateData,
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        birthDate: true,
        gender: true,
        allergies: true,
        emergencyContactName: true,
        emergencyContactLastName: true,
        emergencyContactPhone: true,
        emergencyContactRelation: true,
        address: true,
        createdAt: true,
      },
    });

    // Sync linked Client records. Cada tenant donde el marketplace user está
    // registrado tiene una fila en `clients` con userId apuntando al User.
    // Si solo propagamos firstName/lastName, el POS de cada negocio sigue
    // mostrando phone/email viejos cuando el usuario actualiza su perfil —
    // el cajero termina con teléfono incorrecto en el campo de WhatsApp.
    // Propagamos todos los campos espejados en la tabla clients.
    // Preparamos el espejo para las fichas Client (nombres de campo distintos:
    // p.ej. dateOfBirth en clients vs birthDate en user).
    const clientUpdate: any = {};
    if (dto.firstName !== undefined) clientUpdate.firstName = dto.firstName;
    if (dto.lastName !== undefined) clientUpdate.lastName = dto.lastName;
    if (dto.phone !== undefined) clientUpdate.phone = dto.phone || null;
    if (dto.gender !== undefined) clientUpdate.gender = dto.gender || null;
    if (dto.birthDate !== undefined) clientUpdate.dateOfBirth = dto.birthDate ? new Date(dto.birthDate) : null;

    // Object.keys(x).length = cuántas claves tiene el objeto. Si hay al menos una,
    // propagamos a TODAS las fichas Client vinculadas a este usuario.
    if (Object.keys(clientUpdate).length > 0) {
      await this.prisma.client.updateMany({
        where: { userId: marketplaceUserId },
        data: clientUpdate,
      });
    }

    return user;
  }

  // updateSettings(): guarda las preferencias del usuario (país, idioma, moneda,
  // radio de búsqueda y notificaciones).
  async updateSettings(marketplaceUserId: string, dto: UpdateMarketplaceSettingsDto) {
    const current = await this.prisma.user.findUnique({
      where: { id: marketplaceUserId },
    });
    if (!current) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Igual que en updateProfile: solo cambiamos los campos enviados.
    const updateData: any = {};
    if (dto.country !== undefined) updateData.country = dto.country || null;
    if (dto.language !== undefined) updateData.language = dto.language;
    if (dto.currency !== undefined) updateData.currency = dto.currency;
    if (dto.searchRadius !== undefined) updateData.searchRadius = dto.searchRadius;
    if (dto.notifAppointments !== undefined) updateData.notifAppointments = dto.notifAppointments;
    if (dto.notifPromotions !== undefined) updateData.notifPromotions = dto.notifPromotions;
    if (dto.notifRewards !== undefined) updateData.notifRewards = dto.notifRewards;
    if (dto.notifMessages !== undefined) updateData.notifMessages = dto.notifMessages;

    const user = await this.prisma.user.update({
      where: { id: marketplaceUserId },
      data: updateData,
      select: {
        country: true,
        language: true,
        currency: true,
        searchRadius: true,
        notifAppointments: true,
        notifPromotions: true,
        notifRewards: true,
        notifMessages: true,
      },
    });

    return user;
  }

  // suspendAccount(): suspende la cuenta temporalmente entre 1 y 90 días.
  async suspendAccount(marketplaceUserId: string, days: number) {
    // Validamos el rango. "||" = si CUALQUIERA de las dos condiciones es verdad.
    if (days < 1 || days > 90) {
      throw new BadRequestException('El periodo debe ser entre 1 y 90 días');
    }

    // Fecha hasta la que estará suspendida = hoy + N días.
    const suspendedUntil = new Date();
    suspendedUntil.setDate(suspendedUntil.getDate() + days);

    // Marcamos la cuenta como inactiva y guardamos las fechas de suspensión.
    await this.prisma.user.update({
      where: { id: marketplaceUserId },
      data: {
        isActive: false,
        suspendedAt: new Date(),
        suspendedUntil,
      },
    });

    return { suspendedUntil };
  }

  // deleteAccount(): elimina la cuenta de forma permanente. Pide la contraseña
  // como confirmación (salvo cuentas creadas solo con login social).
  async deleteAccount(marketplaceUserId: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: marketplaceUserId },
    });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Si la cuenta tiene contraseña, exigimos confirmarla. Las cuentas "solo
    // social" (sin passwordHash) se pueden borrar sin contraseña.
    // Social-only accounts can delete without password; password accounts require it
    if (user.passwordHash) {
      if (!password) {
        throw new BadRequestException('Debes confirmar tu contraseña');
      }
      // Comparamos la contraseña dada con el hash guardado.
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        throw new UnauthorizedException('Contraseña incorrecta');
      }
    }

    // Si tiene avatar guardado en disco, borramos el archivo físico. "import(...)"
    // carga los módulos de Node de forma dinámica (fs = sistema de archivos,
    // path = rutas). cwd() es la carpeta actual; replace quita el prefijo
    // "/uploads/" para componer la ruta real.
    // Delete avatar file if exists
    if (user.avatarUrl) {
      const fs = await import('fs');
      const path = await import('path');
      const filePath = path.join(process.cwd(), 'uploads', user.avatarUrl.replace(/^\/uploads\//, ''));
      // existsSync comprueba si el archivo existe; unlinkSync lo borra.
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    // Borramos el usuario. Las relaciones configuradas en cascada (tokens,
    // favoritos...) se eliminan solas; las fichas Client quedan con userId null.
    // Cascade: deletes refresh tokens + favorites. Clients get marketplaceUserId = null.
    await this.prisma.user.delete({
      where: { id: marketplaceUserId },
    });

    return { message: 'Cuenta eliminada' };
  }

  // reactivateAccount(): reactiva manualmente una cuenta suspendida.
  async reactivateAccount(marketplaceUserId: string) {
    await this.prisma.user.update({
      where: { id: marketplaceUserId },
      data: {
        isActive: true,
        suspendedAt: null,
        suspendedUntil: null,
      },
    });

    return { message: 'Cuenta reactivada' };
  }

  // updateContact(): cambia el email y/o teléfono. Cada cambio exige un OTP por
  // el OTRO canal (email -> OTP por SMS; teléfono -> OTP por correo). Verifica
  // también que el nuevo dato no esté ya en uso por otra cuenta.
  async updateContact(
    marketplaceUserId: string,
    dto: { email?: string; phone?: string; currentPassword?: string; otpCode?: string },
  ) {
    const current = await this.prisma.user.findUnique({
      where: { id: marketplaceUserId },
    });
    if (!current) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Cambio de EMAIL: solo si vino y es distinto al actual. Requiere OTP por SMS;
    // tras verificarlo, lo borramos del almacén (consumido).
    // Email change requires SMS OTP verification
    if (dto.email && dto.email !== current.email) {
      if (!dto.otpCode) throw new BadRequestException('Se requiere código de verificación por SMS para cambiar el email');
      this.verifyOtp(marketplaceUserId, dto.otpCode);
      this.otpStore.delete(marketplaceUserId);
    }

    // Cambio de TELÉFONO: si vino (aunque sea vacío) y cambia. Requiere OTP por
    // correo.
    // Phone change requires email OTP verification
    if (dto.phone !== undefined && dto.phone !== current.phone) {
      if (!dto.otpCode) throw new BadRequestException('Se requiere código de verificación por correo para cambiar el teléfono');
      this.verifyOtpEmail(marketplaceUserId, dto.otpCode);
      this.emailOtpStore.delete(marketplaceUserId);
    }

    // Debe venir al menos uno de los dos.
    if (!dto.email && !dto.phone) {
      throw new ConflictException('Debes proporcionar un email o teléfono nuevo');
    }

    const updateData: any = {};   // cambios para el User
    const clientUpdate: any = {}; // espejo para las fichas Client

    // Email único: que no exista OTRO usuario (id distinto) con ese email.
    // "{ not: marketplaceUserId }" excluye al propio usuario de la búsqueda.
    // Check email uniqueness
    if (dto.email && dto.email !== current.email) {
      const existing = await this.prisma.user.findFirst({
        where: { email: dto.email, id: { not: marketplaceUserId } },
      });
      if (existing) {
        throw new ConflictException('Ya existe una cuenta con este email');
      }
      updateData.email = dto.email;
      clientUpdate.email = dto.email;
    }

    // Teléfono único (solo comprobamos si el nuevo teléfono no es vacío).
    // Check phone uniqueness
    if (dto.phone !== undefined && dto.phone !== current.phone) {
      if (dto.phone) {
        const existing = await this.prisma.user.findFirst({
          where: { phone: dto.phone, id: { not: marketplaceUserId } },
        });
        if (existing) {
          throw new ConflictException('Ya existe una cuenta con este teléfono');
        }
      }
      updateData.phone = dto.phone || null;
      clientUpdate.phone = dto.phone || null;
    }

    // Si tras todo no hay nada que cambiar, avisamos.
    if (Object.keys(updateData).length === 0) {
      throw new ConflictException('No hay cambios que aplicar');
    }

    const user = await this.prisma.user.update({
      where: { id: marketplaceUserId },
      data: updateData,
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    // Propagamos el cambio de contacto a las fichas Client vinculadas.
    if (Object.keys(clientUpdate).length > 0) {
      await this.prisma.client.updateMany({
        where: { userId: marketplaceUserId },
        data: clientUpdate,
      });
    }

    return user;
  }

  // updateAvatar(): guarda la nueva URL de avatar y devuelve la URL ANTERIOR
  // (para que el controlador borre el archivo viejo). Propaga el avatar a las
  // fichas Client espejadas.
  async updateAvatar(marketplaceUserId: string, avatarUrl: string): Promise<string | null> {
    const current = await this.prisma.user.findUnique({
      where: { id: marketplaceUserId },
      select: { avatarUrl: true },
    });
    // URL previa (o null). "?." por si current fuera null; "|| null" como respaldo.
    const oldUrl = current?.avatarUrl || null;

    await this.prisma.user.update({
      where: { id: marketplaceUserId },
      data: { avatarUrl },
    });

    // Propagar avatar a los Client rows espejados en cada tenant — si no,
    // el avatar viejo persiste en el avatar mostrado por staff/POS.
    await this.prisma.client.updateMany({
      where: { userId: marketplaceUserId },
      data: { avatarUrl },
    });

    // Sincronizar el perfil SELF (el del titular), que alimenta el selector de
    // perfiles del marketplace. Sin esto, el selector seguía mostrando el avatar
    // viejo tras cambiar la foto.
    await this.prisma.profile.updateMany({
      where: { userId: marketplaceUserId, relationship: 'SELF' },
      data: { avatarUrl },
    });

    return oldUrl;
  }

  // changePassword(): cambia la contraseña. Si el usuario ya tenía una, debe
  // probar su identidad (contraseña actual O un código OTP). Las cuentas "solo
  // social" pueden establecer su PRIMERA contraseña sin verificación.
  async changePassword(marketplaceUserId: string, dto: ChangeMarketplacePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: marketplaceUserId },
    });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Solo verificamos si YA tenía contraseña.
    // Social-only users can set a password for the first time (no verification needed)
    if (user.passwordHash) {
      if (dto.otpCode) {
        // Vía OTP: lo verificamos y lo consumimos (borramos).
        // OTP bypass: verify code and consume it
        this.verifyOtp(marketplaceUserId, dto.otpCode);
        this.otpStore.delete(marketplaceUserId);
      } else {
        // Vía contraseña actual: debe venir y coincidir con el hash.
        if (!dto.currentPassword) {
          throw new BadRequestException('Debes ingresar tu contraseña actual o usar un código de recuperación');
        }
        const isMatch = await bcrypt.compare(dto.currentPassword, user.passwordHash);
        if (!isMatch) {
          throw new UnauthorizedException('Contraseña actual incorrecta');
        }
      }
    }

    // Hasheamos y guardamos la nueva contraseña (cost 12).
    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.user.update({
      where: { id: marketplaceUserId },
      data: { passwordHash },
    });

    return { message: 'Contraseña actualizada' };
  }

  /**
   * El cliente deja la reseña de SU cita ya completada desde el marketplace.
   * Valida pertenencia (clientId.userId === marketplaceUserId), estado
   * COMPLETED, y que no exista review previa. Idéntica forma a la creada por
   * el flujo confirm-payment.
   */
  async createReviewForMyAppointment(
    marketplaceUserId: string,
    appointmentId: string,
    dto: { rating: number; comment?: string; businessRating?: number; businessComment?: string },
  ) {
    // Validamos el rating principal: entero entre 1 y 5. Number.isInteger
    // comprueba que sea un entero; "||" rechaza si falla cualquier condición.
    if (!Number.isInteger(dto.rating) || dto.rating < 1 || dto.rating > 5) {
      throw new BadRequestException('La calificación principal debe ser un entero entre 1 y 5');
    }
    // Si vino la calificación del negocio (no undefined ni null), también 1..5.
    if (dto.businessRating !== undefined && dto.businessRating !== null) {
      if (!Number.isInteger(dto.businessRating) || dto.businessRating < 1 || dto.businessRating > 5) {
        throw new BadRequestException('La calificación secundaria debe ser un entero entre 1 y 5');
      }
    }
    // Traemos la cita con el userId del cliente (para verificar pertenencia).
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: {
        id: true,
        tenantId: true,
        employeeId: true,
        clientId: true,
        status: true,
        client: { select: { userId: true } },
      },
    });
    if (!appointment) throw new NotFoundException('Cita no encontrada');
    // El dueño de la cita debe ser el usuario actual. "?." por si client es null.
    if (appointment.client?.userId !== marketplaceUserId) {
      throw new ForbiddenException('No puedes reseñar una cita ajena');
    }
    // Solo se reseñan citas completadas.
    if (appointment.status !== 'COMPLETED') {
      throw new BadRequestException('Solo puedes reseñar citas completadas');
    }
    // Evitamos duplicados: una reseña por cita.
    const existing = await this.prisma.employeeReview.findUnique({
      where: { appointmentId: appointment.id },
    });
    if (existing) {
      throw new BadRequestException('Esta cita ya tiene una reseña');
    }
    // Creamos la reseña. "??" (nullish): usa businessRating salvo que sea
    // null/undefined, en cuyo caso null; "|| null" hace algo parecido con textos.
    const review = await this.prisma.employeeReview.create({
      data: {
        tenantId: appointment.tenantId,
        employeeId: appointment.employeeId,
        clientId: appointment.clientId,
        appointmentId: appointment.id,
        rating: dto.rating,
        comment: dto.comment || null,
        businessRating: dto.businessRating ?? null,
        businessComment: dto.businessComment || null,
        reviewedAt: new Date(),
      },
      select: { id: true, rating: true, businessRating: true, reviewedAt: true },
    });
    // Buscamos el nombre del cliente para incluirlo en el evento.
    const client = await this.prisma.client.findUnique({
      where: { id: appointment.clientId },
      select: { firstName: true, lastName: true },
    });
    // Emitimos un evento de dominio: otras partes (ej. notificaciones al negocio)
    // pueden reaccionar. El ternario arma el nombre o usa "Un cliente".
    this.eventEmitter.emit('review.created', {
      tenantId: appointment.tenantId,
      reviewId: review.id,
      employeeId: appointment.employeeId,
      rating: review.rating,
      clientName: client ? `${client.firstName} ${client.lastName}` : 'Un cliente',
    });
    return { data: review };
  }

  /**
   * El cliente omite dejar reseña de UNA cita. Permanente y por cita: marca
   * reviewDismissedAt para que el modal no vuelva a saltar para esa cita (no
   * afecta otras citas, ni futuras, del mismo negocio).
   */
  async dismissMyAppointmentReview(marketplaceUserId: string, appointmentId: string) {
    // Traemos la cita con el userId del cliente para verificar pertenencia.
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: { id: true, client: { select: { userId: true } } },
    });
    if (!appointment) throw new NotFoundException('Cita no encontrada');
    if (appointment.client?.userId !== marketplaceUserId) {
      throw new ForbiddenException('No puedes modificar una cita ajena');
    }
    // Marcamos la fecha en que se omitió la reseña: el modal no volverá a salir.
    await this.prisma.appointment.update({
      where: { id: appointmentId },
      data: { reviewDismissedAt: new Date() },
    });
    return { data: { dismissed: true } };
  }

  // getMyAppointments(): devuelve las citas del usuario, clasificadas en
  // próximas/pasadas/todas. Como las horas se guardan en "hora del negocio" sin
  // zona, el filtrado y orden se hacen EN MEMORIA usando la TZ de cada cita.
  async getMyAppointments(
    marketplaceUserId: string,
    filter: 'upcoming' | 'past' | 'all',
    page: number,
    perPage: number,
    profileId?: string,
  ) {
    // Un usuario puede tener varias fichas Client (una por negocio). Reunimos
    // todos sus clientIds. .map extrae solo el id de cada ficha. Si viene un
    // profileId, limitamos a las fichas de ese perfil (citas de ese perfil); si
    // no, traemos las de todos los perfiles del usuario (vista "familia").
    const clients = await this.prisma.client.findMany({
      where: { userId: marketplaceUserId, ...(profileId ? { profileId } : {}) },
      select: { id: true },
    });
    const clientIds = clients.map((c) => c.id);

    // Si no tiene ninguna ficha, no hay citas: devolvemos lista vacía.
    if (clientIds.length === 0) {
      return { data: [], meta: { total: 0, page, perPage, totalPages: 0 } };
    }

    // Las citas se guardan con startTime en "hora del negocio" raw, sin
    // offset real. Para clasificar upcoming/past necesitamos el "now en
    // hora del negocio" de cada sucursal (Location.timezone). Por eso
    // traemos todas las citas (filtradas solo por cliente + status), y
    // hacemos el upcoming/past en memoria con la TZ propia de cada cita.
    // Filtro base: citas de cualquiera de sus fichas ("in" = en esa lista).
    // Si pide "upcoming", restringimos a estados aún vigentes.
    const baseWhere: any = { clientId: { in: clientIds } };
    if (filter === 'upcoming') {
      baseWhere.status = { in: ['PENDING', 'CONFIRMED', 'RESCHEDULED'] };
    }

    const allAppts = await this.prisma.appointment.findMany({
      where: baseWhere,
      // Select explicito + relaciones minimas. La sucursal viene en
      // location (directa); no es necesario duplicar locations del tenant.
      select: {
        id: true,
        status: true,
        startTime: true,
        endTime: true,
        notes: true,
        discountAmount: true,
        depositPaid: true,
        paymentProofUrl: true,
        createdAt: true,
        tenant: {
          select: {
            id: true, name: true, slug: true, logoUrl: true,
            timezone: true, businessPhone: true, currency: true,
            tenantType: true,
          },
        },
        location: {
          select: { id: true, name: true, address: true, timezone: true },
        },
        employee: {
          select: { id: true, firstName: true, lastName: true, color: true, avatarUrl: true },
        },
        items: {
          select: {
            id: true, serviceNameSnapshot: true, priceSnapshot: true, durationSnapshot: true,
            // Empleado por item: para mostrar TODOS los profesionales cuando la
            // cita la atienden varios (cada servicio puede tener uno distinto).
            employee: { select: { id: true, firstName: true, lastName: true, color: true, avatarUrl: true } },
          },
        },
        // Productos apartados con la cita: el cliente los ve igual que el negocio.
        productReservations: {
          select: {
            id: true,
            quantity: true,
            unitPrice: true,
            status: true,
            product: { select: { name: true, imageUrl: true } },
          },
        },
        // Fotos del resultado subidas por el staff al cerrar la cita.
        photos: {
          select: { id: true, imageUrl: true, caption: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        },
        // Consentimiento de fotos (informativo para el cliente).
        photoConsent: true,
        payments: {
          select: { id: true, status: true, paymentMethod: true, totalAmount: true, amount: true, tipAmount: true, discountAmount: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        redemption: {
          select: {
            id: true,
            code: true,
            reward: { select: { name: true, type: true, discountAmount: true, discountMode: true } },
          },
        },
        // Para saber si la cita ya tiene reseña (oculta el modal en marketplace).
        review: { select: { id: true, rating: true, businessRating: true } },
        // Si el cliente ya omitió la reseña de esta cita, no volver a pedirla.
        reviewDismissedAt: true,
        // Datos del cliente/perfil de la cita: para que el tutor distinga en su
        // lista de qué perfil (hijo) es cada cita.
        client: { select: { firstName: true, lastName: true, profileId: true } },
      },
    });

    // Función auxiliar: ¿esta cita es FUTURA? Elige la zona horaria (de sucursal,
    // luego de negocio, o México por defecto), calcula el "ahora" en esa TZ y
    // compara textos de fecha ("YYYY-MM-DDTHH:mm:ss"). ">=" entre textos así
    // formateados equivale a comparar fechas (orden alfabético = cronológico).
    // Filtrado upcoming/past con TZ por sucursal.
    const apptIsUpcoming = (appt: any): boolean => {
      const tz =
        appt.location?.timezone ||
        appt.tenant?.timezone ||
        'America/Mexico_City';
      const nowStr = nowInTz(tz); // "YYYY-MM-DDTHH:mm:ss"
      const apptStr = toRawIso(appt.startTime);
      return apptStr >= nowStr;
    };

    // .filter aplica el criterio según el filtro pedido. isClosed = el estado es
    // uno de los cerrados (includes).
    const filtered = allAppts.filter((appt) => {
      const isUp = apptIsUpcoming(appt);
      const isClosed = ['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(appt.status as string);
      if (filter === 'upcoming') return isUp && !isClosed; // futura y no cerrada
      if (filter === 'past') return !isUp || isClosed;      // pasada o cerrada
      return true; // 'all': sin filtro
    });

    // Ordenamos por hora de inicio. localeCompare compara los textos de fecha.
    // upcoming: ascendente (la más próxima primero); past/all: descendente.
    filtered.sort((a, b) => {
      const aStr = toRawIso(a.startTime);
      const bStr = toRawIso(b.startTime);
      // upcoming asc; past/all desc (más reciente primero)
      return filter === 'upcoming'
        ? aStr.localeCompare(bStr)
        : bStr.localeCompare(aStr);
    });

    // Paginamos en memoria: slice toma el trozo de la página pedida.
    const total = filtered.length;
    const paged = filtered.slice((page - 1) * perPage, page * perPage);

    return {
      data: paged,
      meta: {
        total,
        page,
        perPage,
        totalPages: Math.ceil(total / perPage),
      },
    };
  }

  // ─── STATS & GALLERY ─────────────────────────────────

  // getMyPurchases(): historial paginado de reservas de productos del usuario.
  async getMyPurchases(marketplaceUserId: string, page: number, perPage: number) {
    const skip = (page - 1) * perPage; // cuántos saltar

    const where: any = { userId: marketplaceUserId };

    // En paralelo: la página de reservas y el total.
    const [data, total] = await Promise.all([
      this.prisma.productReservation.findMany({
        where,
        include: {
          product: {
            select: {
              id: true,
              name: true,
              imageUrl: true,
              currency: true,
            },
          },
          tenant: {
            select: {
              id: true,
              slug: true,
              name: true,
              logoUrl: true,
              businessPhone: true,
              currency: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: perPage,
      }),
      this.prisma.productReservation.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        perPage,
        totalPages: Math.ceil(total / perPage),
      },
    };
  }

  // getMyStats(): estadísticas personales del usuario: servicios completados,
  // puntos de fidelidad totales y por negocio, y fotos de resultados.
  async getMyStats(marketplaceUserId: string, profileId?: string) {
    // Fichas Client del usuario (o de un perfil concreto), con sus puntos y el
    // negocio asociado.
    const clients = await this.prisma.client.findMany({
      where: { userId: marketplaceUserId, ...(profileId ? { profileId } : {}) },
      select: { id: true, tenantId: true, loyaltyPoints: true, tenant: { select: { name: true, slug: true, logoUrl: true } } },
    });
    const clientIds = clients.map((c) => c.id);

    // Sin fichas -> todo en cero.
    if (clientIds.length === 0) {
      return { data: { totalServices: 0, totalPoints: 0, totalPhotos: 0, pointsByTenant: [] } };
    }

    // En paralelo: nº de citas completadas y nº de fotos de esas citas.
    const [totalServices, totalPhotos] = await Promise.all([
      this.prisma.appointment.count({
        where: { clientId: { in: clientIds }, status: 'COMPLETED' },
      }),
      this.prisma.appointmentPhoto.count({
        where: {
          appointment: {
            clientId: { in: clientIds },
            status: 'COMPLETED',
          },
        },
      }),
    ]);

    // Puntos totales: reduce suma los loyaltyPoints de todas las fichas (sum
    // empieza en 0 y va acumulando c.loyaltyPoints en cada vuelta).
    const totalPoints = clients.reduce((sum, c) => sum + c.loyaltyPoints, 0);
    // Puntos por negocio: nos quedamos solo con las fichas que tienen puntos
    // (filter > 0) y las transformamos al formato de salida (map).
    const pointsByTenant = clients
      .filter((c) => c.loyaltyPoints > 0)
      .map((c) => ({
        tenantId: c.tenantId,
        tenantName: c.tenant.name,
        tenantSlug: c.tenant.slug,
        tenantLogo: c.tenant.logoUrl,
        points: c.loyaltyPoints,
      }));

    return { data: { totalServices, totalPoints, totalPhotos, pointsByTenant } };
  }

  // getMyGallery(): galería con las fotos de resultados de las citas del usuario.
  // Si llega profileId, solo las fotos de ESE perfil (sus propias citas).
  async getMyGallery(marketplaceUserId: string, profileId?: string) {
    const clients = await this.prisma.client.findMany({
      where: { userId: marketplaceUserId, ...(profileId ? { profileId } : {}) },
      select: { id: true },
    });
    const clientIds = clients.map((c) => c.id);

    // Sin fichas -> galería vacía.
    if (clientIds.length === 0) {
      return { data: [] };
    }

    // Todas las fotos de resultados de las citas completadas del usuario.
    const photos = await this.prisma.appointmentPhoto.findMany({
      where: {
        appointment: {
          clientId: { in: clientIds },
          status: 'COMPLETED',
        },
      },
      include: {
        appointment: {
          select: {
            id: true,
            startTime: true,
            items: {
              select: {
                serviceNameSnapshot: true,
                service: { select: { category: true } },
              },
              take: 1, // solo el primer servicio (para categorizar la foto)
            },
            tenant: { select: { name: true, slug: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Agrupamos las fotos por categoría de servicio. "Record<string, [...]>" es
    // un diccionario: clave = categoría, valor = lista de fotos de esa categoría.
    // Group by service category
    const byCategory: Record<
      string,
      {
        id: string;
        imageUrl: string;
        serviceName: string;
        date: Date;
        tenantName: string;
        tenantSlug: string;
      }[]
    > = {};

    // Recorremos cada foto y la metemos en el grupo de su categoría.
    for (const photo of photos) {
      // Categoría del primer item, o "Otros" si no hay. "?." evita errores si
      // falta algún nivel; "|| 'Otros'" es el respaldo.
      const category =
        photo.appointment.items[0]?.service?.category || 'Otros';
      // Si aún no existe ese grupo, lo creamos vacío.
      if (!byCategory[category]) byCategory[category] = [];
      // Añadimos la foto al grupo.
      byCategory[category].push({
        id: photo.id,
        imageUrl: photo.imageUrl,
        serviceName:
          photo.appointment.items[0]?.serviceNameSnapshot || 'Servicio',
        date: photo.appointment.startTime,
        tenantName: photo.appointment.tenant.name,
        tenantSlug: photo.appointment.tenant.slug,
      });
    }

    // Object.entries convierte el diccionario en pares [clave, valor]; .map los
    // transforma en objetos { name, photos } que es lo que espera el frontend.
    return {
      data: Object.entries(byCategory).map(([name, items]) => ({
        name,
        photos: items,
      })),
    };
  }

  // deleteGalleryPhoto(): el cliente elimina una foto de SU galería. Verificamos
  // que la foto pertenezca a una cita de una ficha del usuario (no de otro), y
  // luego borramos el archivo del disco y el registro.
  async deleteGalleryPhoto(marketplaceUserId: string, photoId: string) {
    const photo = await this.prisma.appointmentPhoto.findFirst({
      where: { id: photoId, appointment: { client: { userId: marketplaceUserId } } },
      select: { id: true, imageUrl: true },
    });
    if (!photo) throw new NotFoundException('Foto no encontrada');

    // Borramos primero el archivo físico (si falla, no bloquea el borrado del
    // registro) y luego la fila.
    await this.uploads.deleteFile(photo.imageUrl).catch(() => {});
    await this.prisma.appointmentPhoto.delete({ where: { id: photo.id } });
    return { data: { deleted: true } };
  }

  // ─── PAYMENTS ──────────────────────────────────────────

  // getMyPayments(): historial paginado de pagos del usuario, con filtro opcional
  // por estado.
  async getMyPayments(
    marketplaceUserId: string,
    page: number,
    perPage: number,
    status?: 'COMPLETED' | 'PENDING' | 'REFUNDED',
  ) {
    const clients = await this.prisma.client.findMany({
      where: { userId: marketplaceUserId },
      select: { id: true },
    });
    const clientIds = clients.map((c) => c.id);

    if (clientIds.length === 0) {
      return { data: [], meta: { total: 0, page, perPage, totalPages: 0 } };
    }

    // Filtro base por las fichas del usuario.
    const where: any = {
      clientId: { in: clientIds },
    };

    // Si pidieron un estado concreto, lo añadimos al filtro.
    if (status) {
      where.status = status;
    }

    // En paralelo: la página de pagos y el total.
    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        select: {
          id: true,
          amount: true,
          totalAmount: true,
          currency: true,
          paymentMethod: true,
          status: true,
          createdAt: true,
          tenant: { select: { name: true, slug: true, logoUrl: true } },
          appointment: {
            select: {
              startTime: true,
              items: {
                select: { serviceNameSnapshot: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      this.prisma.payment.count({ where }),
    ]);

    return {
      data: payments,
      meta: {
        total,
        page,
        perPage,
        totalPages: Math.ceil(total / perPage),
      },
    };
  }

  /**
   * Actualiza el paymentProofUrl de una cita propia del cliente.
   * Devuelve la URL anterior (si existía) para que el caller la borre del disco.
   */
  async setAppointmentPaymentProof(
    marketplaceUserId: string,
    appointmentId: string,
    newUrl: string,
  ): Promise<string | null> {
    const clients = await this.prisma.client.findMany({
      where: { userId: marketplaceUserId },
      select: { id: true },
    });
    const clientIds = clients.map((c) => c.id);
    if (clientIds.length === 0) {
      throw new NotFoundException('No se encontró el cliente');
    }
    // La cita debe ser de alguna de las fichas del usuario (seguridad).
    const appt = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, clientId: { in: clientIds } },
      select: { id: true, status: true, paymentProofUrl: true },
    });
    if (!appt) throw new NotFoundException('Cita no encontrada');
    // No se sube comprobante a citas canceladas o sin asistencia.
    if (['CANCELLED', 'NO_SHOW'].includes(appt.status as string)) {
      throw new BadRequestException('Esta cita ya no admite subir comprobante');
    }
    const oldUrl = appt.paymentProofUrl; // guardamos la URL previa para devolverla
    await this.prisma.appointment.update({
      where: { id: appt.id },
      data: { paymentProofUrl: newUrl },
    });
    return oldUrl || null;
  }

  // ─── PRIVATE HELPERS ─────────────────────────────────

  // generateTokens(): crea el par de tokens (access JWT + refresh opaco) para un
  // usuario de marketplace y guarda el refresh hasheado en la base de datos.
  private async generateTokens(user: { id: string; email: string }) {
    // Contenido del JWT: id, email y el tipo fijo 'marketplace'.
    const payload = {
      sub: user.id,
      email: user.email,
      type: 'marketplace' as const,
    };

    // Firmamos el access token con expiración corta y un "issuer" identificador.
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: process.env.JWT_CLIENT_ACCESS_EXPIRY || '15m',
      issuer: 'siliba-marketplace',
    });

    // Refresh token: un UUID aleatorio. Guardamos su HASH (no el valor en claro),
    // su "pista" (8 primeros caracteres) y la expiración a 30 días.
    const refreshToken = uuidv4();
    const tokenHash = await bcrypt.hash(refreshToken, 10);
    const tokenHint = refreshToken.substring(0, 8);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await this.prisma.refreshToken.create({
      data: {
        tokenHash,
        tokenHint,
        userId: user.id,
        scope: 'client', // ámbito 'client' (marketplace/portal)
        expiresAt,
      },
    });

    // Devolvemos AMBOS tokens (el refresh en claro, una sola vez, para el cliente).
    return { accessToken, refreshToken };
  }

  // ─── REWARDS ────────────────────────────────────────

  // getBusinessRewards(): recompensas vigentes de un negocio que aún no agotaron
  // sus canjes.
  async getBusinessRewards(tenantSlug: string) {
    const tenant = await this.tenantsService.findBySlug(tenantSlug);

    const now = new Date();
    const rewards = await this.prisma.reward.findMany({
      where: {
        tenantId: tenant.id,
        isActive: true,
        // Vigente si no tiene fecha de fin O si su fin es >= ahora (gte).
        OR: [
          { validUntil: null },
          { validUntil: { gte: now } },
        ],
      },
      select: {
        id: true,
        name: true,
        description: true,
        type: true,
        pointsRequired: true,
        discountAmount: true,
        discountMode: true,
        serviceIds: true,
        code: true,
        maxRedemptions: true,
        timesRedeemed: true,
        validUntil: true,
        service: { select: { id: true, name: true } },
      },
      orderBy: { pointsRequired: 'asc' },
    });

    // Descartamos las que llegaron al tope de canjes. Pasa si NO hay tope
    // (!r.maxRedemptions) O si aún quedan (timesRedeemed < maxRedemptions).
    // Filter out rewards that reached max redemptions
    const available = rewards.filter(
      (r) => !r.maxRedemptions || r.timesRedeemed < r.maxRedemptions,
    );

    return { data: available };
  }

  // getMyRewards(): recompensas/cupones que el usuario ha canjeado.
  async getMyRewards(marketplaceUserId: string, profileId?: string) {
    const clients = await this.prisma.client.findMany({
      where: { userId: marketplaceUserId },
      select: { id: true },
    });
    const clientIds = clients.map((c) => c.id);

    if (clientIds.length === 0) {
      return { data: [] };
    }

    // Si llega un perfil activo, mostramos SOLO los cupones de ese perfil (no se
    // comparten entre el tutor y sus hijos). El titular hereda los antiguos.
    const profileWhere = await this.buildFavoriteProfileWhere(marketplaceUserId, profileId);

    const redemptions = await this.prisma.rewardRedemption.findMany({
      where: {
        clientId: { in: clientIds },
        ...profileWhere,
      },
      include: {
        reward: {
          select: {
            name: true,
            type: true,
            description: true,
            discountAmount: true,
            discountMode: true,
            serviceId: true,
            serviceIds: true,
            service: { select: { id: true, name: true, price: true } },
          },
        },
        tenant: { select: { name: true, slug: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return { data: redemptions };
  }

  // getReferralInfo(): info pública de un código de referido (para mostrar al
  // abrir el enlace de invitación). Devuelve null si el código no existe/activo.
  async getReferralInfo(code: string) {
    // Antes leiamos de promotionReferral; ahora de rewardReferral.
    const referral = await this.prisma.rewardReferral.findFirst({
      where: { code, status: 'ACTIVE' },
      include: {
        reward: { select: { name: true } },
        tenant: { select: { name: true, slug: true } },
      },
    });

    if (!referral) {
      return { data: null };
    }

    // Nombre de quién generó el referido (para "Te invitó X").
    // Get generator's name
    const client = await this.prisma.client.findFirst({
      where: { id: referral.generatedByClientId },
      select: { firstName: true, lastName: true },
    });

    // Los serviceIds pueden venir como JSON; Array.isArray comprueba que sea una
    // lista antes de usarlos; si no, lista vacía.
    const svcIds: string[] = Array.isArray(referral.serviceIds) ? referral.serviceIds as string[] : [];
    let serviceNames: string[] = [];
    // Si hay ids, buscamos los nombres de esos servicios. .map extrae el nombre.
    if (svcIds.length > 0) {
      const svcs = await this.prisma.service.findMany({
        where: { id: { in: svcIds } },
        select: { name: true },
      });
      serviceNames = svcs.map((s) => s.name);
    }

    return {
      data: {
        code: referral.code,
        status: referral.status,
        expiresAt: referral.expiresAt,
        promotionName: referral.reward.name, // mantengo el nombre del campo de respuesta por compat con frontend
        tenantName: referral.tenant.name,
        tenantSlug: referral.tenant.slug,
        // Nombre completo recortado (.trim quita espacios), o null si no hay cliente.
        generatedBy: client ? `${client.firstName} ${client.lastName || ''}`.trim() : null,
        serviceNames,
      },
    };
  }

  // getMyReferrals(): referidos generados por el usuario (sus invitaciones).
  async getMyReferrals(marketplaceUserId: string) {
    const clients = await this.prisma.client.findMany({
      where: { userId: marketplaceUserId },
      select: { id: true },
    });
    const clientIds = clients.map((c) => c.id);

    if (clientIds.length === 0) {
      return { data: [] };
    }

    // Antes leiamos promotionReferral; ahora rewardReferral.
    const referrals = await this.prisma.rewardReferral.findMany({
      where: { generatedByClientId: { in: clientIds } },
      include: {
        reward: { select: { name: true, type: true, description: true } },
        tenant: { select: { name: true, slug: true, logoUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Para cada referido, resolvemos los nombres de sus servicios (en paralelo).
    // Resolve service names for each referral. Renombramos reward -> promotion
    // en la respuesta para mantener compat con el frontend.
    const enriched = await Promise.all(
      referrals.map(async (ref) => {
        const svcIds: string[] = Array.isArray(ref.serviceIds) ? ref.serviceIds as string[] : [];
        let serviceNames: string[] = [];
        if (svcIds.length > 0) {
          const svcs = await this.prisma.service.findMany({
            where: { id: { in: svcIds } },
            select: { name: true },
          });
          serviceNames = svcs.map((s) => s.name);
        }
        // Copiamos el referido y añadimos "promotion" (alias de reward) + nombres.
        return { ...ref, promotion: ref.reward, serviceNames };
      }),
    );

    return { data: enriched };
  }

  // redeemReward(): canjea una recompensa por PUNTOS de fidelidad. Usa una
  // transacción Serializable para evitar el doble canje (anti-double-spend).
  async redeemReward(
    marketplaceUserId: string,
    tenantSlug: string,
    rewardId: string,
    profileId?: string,
  ) {
    const tenant = await this.tenantsService.findBySlug(tenantSlug);

    // El cupón pertenece al PERFIL activo (estilo Netflix), no a la cuenta. Los
    // puntos también son por perfil: cada perfil materializa su propio Client por
    // negocio. Resolvemos el client de ESE perfil (find-or-create; vincula la
    // ficha walk-in del SELF si existía).
    const activeProfileId = await this.resolveActiveProfileId(marketplaceUserId, profileId);
    const client = await this.resolveClientForProfile(tenant.id, activeProfileId);
    if (!client) {
      throw new BadRequestException(
        `No cuentas con puntos suficientes. Agenda servicios con ${tenant.name} para ganar puntos y canjearlos por recompensas.`,
      );
    }

    // La recompensa debe existir, ser de este negocio y estar activa.
    // Validate reward
    const reward = await this.prisma.reward.findFirst({
      where: { id: rewardId, tenantId: tenant.id, isActive: true },
    });
    if (!reward) {
      throw new NotFoundException('Recompensa no encontrada');
    }

    // No debe estar expirada ni haber agotado sus canjes.
    const now = new Date();
    if (reward.validUntil && reward.validUntil < now) {
      throw new BadRequestException('Esta recompensa ha expirado');
    }
    if (reward.maxRedemptions && reward.timesRedeemed >= reward.maxRedemptions) {
      throw new BadRequestException(
        'Esta recompensa ha alcanzado el máximo de canjes',
      );
    }
    // Guard: este endpoint solo canjea rewards basados en puntos. Despues
    // del cambio a Reward unificado, hay rewards sin pointsRequired (los
    // migrados desde Promotion). Esos no se canjean por aqui.
    const pointsRequired = reward.pointsRequired;
    // "== null" cubre null y undefined a la vez.
    if (pointsRequired == null) {
      throw new BadRequestException(
        'Esta recompensa no se canjea por puntos. Usá el flujo de cupones del booking.',
      );
    }
    // El cliente debe tener puntos suficientes.
    if (client.loyaltyPoints < pointsRequired) {
      throw new BadRequestException(
        `Necesitas ${pointsRequired} puntos. Tienes ${client.loyaltyPoints}.`,
      );
    }

    // TRANSACCIÓN: todas las operaciones de dentro se confirman juntas o se
    // deshacen juntas. isolationLevel 'Serializable' es el nivel más estricto:
    // impide que dos canjes simultáneos gasten los mismos puntos.
    // Execute in transaction
    const result = await this.prisma.$transaction(
      async (tx) => {
        // Releemos los puntos DENTRO de la transacción (pueden haber cambiado).
        // Re-check points inside transaction
        const freshClient = await tx.client.findUnique({
          where: { id: client.id },
          select: { loyaltyPoints: true },
        });
        if (
          !freshClient ||
          freshClient.loyaltyPoints < pointsRequired
        ) {
          throw new BadRequestException('Puntos insuficientes');
        }

        // Restamos los puntos. "decrement" baja el valor en esa cantidad.
        // Deduct points
        await tx.client.update({
          where: { id: client.id },
          data: {
            loyaltyPoints: { decrement: pointsRequired },
          },
        });

        // Subimos en 1 el contador de canjes de la recompensa ("increment").
        // Increment redemption count
        await tx.reward.update({
          where: { id: reward.id },
          data: { timesRedeemed: { increment: 1 } },
        });

        // Generamos el código de cupón único.
        // Generate unique coupon code
        const code = this.generateCouponCode();

        // El cupón caduca en 30 días.
        // Calculate expiry (30 days from now)
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);

        // Creamos el registro del canje (con su código y vigencia).
        // Create redemption
        const redemption = await tx.rewardRedemption.create({
          data: {
            tenantId: tenant.id,
            rewardId: reward.id,
            clientId: client.id,
            profileId: activeProfileId,
            pointsSpent: pointsRequired,
            code,
            expiresAt,
            status: 'ACTIVE',
          },
          include: {
            reward: {
              select: {
                name: true,
                type: true,
                discountAmount: true,
                discountMode: true,
              },
            },
          },
        });

        return redemption;
      },
      { isolationLevel: 'Serializable' },
    );

    return result;
  }

  // generateCouponCode(): genera un código de 8 caracteres aleatorios. Usa un
  // alfabeto SIN caracteres ambiguos (no 0/O, 1/I/L) para evitar confusiones.
  private generateCouponCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    // Bucle 8 veces: en cada vuelta elige un carácter al azar y lo concatena.
    // Math.random()*length da un índice aleatorio; Math.floor lo redondea;
    // charAt devuelve el carácter en esa posición.
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  // ─── BOOKING ──────────────────────────────────────────

  // bookAppointment(): reserva una cita desde el marketplace. Asegura la ficha
  // Client, valida cupón/promoción/puntos y delega la creación real de la cita
  // a AppointmentsService.
  async bookAppointment(
    marketplaceUserId: string,
    tenantSlug: string,
    dto: MarketplaceBookDto,
  ) {
    const tenant = await this.tenantsService.findBySlug(tenantSlug);

    // Resolvemos el perfil activo (el que mandó el front, o el SELF por defecto)
    // y obtenemos/creamos su ficha de cliente. La cita se atribuye al Client de
    // ese perfil, así las citas de un hijo no se mezclan con las del tutor.
    const activeProfileId = await this.resolveActiveProfileId(marketplaceUserId, dto.profileId);
    const client = await this.resolveClientForProfile(tenant.id, activeProfileId);

    // Obtenemos el empleado para saber su sucursal (locationId).
    // Resolve employee's locationId
    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, tenantId: tenant.id, isActive: true },
      select: { id: true, locationId: true },
    });

    if (!employee) {
      throw new NotFoundException('Profesional no encontrado');
    }

    // Variables del descuento: redemption (el cupón canjeado) y discountAmount
    // (el monto a descontar). Empiezan en null y se llenan según el caso.
    // Validate coupon if provided
    let redemption: any = null;
    let discountAmount: number | null = null;

    // ── CASO 1: viene un CUPÓN (recompensa ya canjeada por puntos).
    if (dto.couponCode) {
      // El cupón debe existir, ser de este negocio y cliente, y estar ACTIVE.
      redemption = await this.prisma.rewardRedemption.findFirst({
        where: { code: dto.couponCode, tenantId: tenant.id, clientId: client.id, status: 'ACTIVE' },
        include: { reward: { include: { service: { select: { id: true } } } } },
      });

      if (!redemption) {
        throw new BadRequestException('Cupón no válido o ya utilizado');
      }

      // No debe estar expirado.
      if (redemption.expiresAt && new Date(redemption.expiresAt) < new Date()) {
        throw new BadRequestException('Este cupón ha expirado');
      }

      const reward = redemption.reward;

      // Si el cupón es de un SERVICIO concreto, ese servicio debe estar entre los
      // reservados (includes comprueba que esté en la lista).
      // Validate coupon is compatible with selected services
      if (reward.type === 'SERVICIO' && reward.serviceId) {
        if (!dto.serviceIds.includes(reward.serviceId)) {
          throw new BadRequestException('Este cupón solo aplica para el servicio asociado a la recompensa');
        }
      }

      // Calculamos el descuento según el tipo de recompensa.
      // Calculate discount
      if (reward.type === 'DESCUENTO') {
        // Sumamos los precios de los servicios reservados (reduce acumula).
        const services = await this.prisma.service.findMany({
          where: { id: { in: dto.serviceIds }, tenantId: tenant.id },
          select: { price: true },
        });
        const subtotal = services.reduce((s, svc) => s + Number(svc.price), 0);
        if (reward.discountMode === 'PERCENTAGE') {
          // Porcentaje: subtotal * % / 100, redondeado a 2 decimales (*100/100).
          discountAmount = Math.round(subtotal * Number(reward.discountAmount) / 100 * 100) / 100;
        } else {
          // Monto fijo: el descuento no puede pasar del subtotal (Math.min).
          discountAmount = Math.min(Number(reward.discountAmount), subtotal);
        }
      } else if (reward.type === 'SERVICIO' && reward.serviceId) {
        // Servicio gratis: el descuento es el precio de ese servicio.
        // Free service: discount = price of that service
        const freeService = await this.prisma.service.findFirst({
          where: { id: reward.serviceId, tenantId: tenant.id },
          select: { price: true },
        });
        if (freeService) discountAmount = Number(freeService.price);
      }
    }

    // Validate reward (antes "promotion") if provided. Mutuamente excluyente
    // con coupon. dto.promotionId mantiene su nombre por compat de API; los IDs
    // de reward y promotion coinciden por la migracion (Fase 1).
    // ── CASO 2: viene una PROMOCIÓN (y NO un cupón: son excluyentes).
    let promotionRecord: any = null;
    if (dto.promotionId && !dto.couponCode) {
      // La promoción (reward de tipo descuento o 2x1) debe existir y estar activa.
      const rawReward = await this.prisma.reward.findFirst({
        where: {
          id: dto.promotionId,
          tenantId: tenant.id,
          isActive: true,
          type: { in: ['DESCUENTO', 'TWO_FOR_ONE'] },
        },
      });

      if (!rawReward) {
        throw new BadRequestException('Cupón no encontrado');
      }

      // Mapear al "type logico" que usaba la promotion: PERCENTAGE /
      // FIXED_AMOUNT / TWO_FOR_ONE. Mantiene la logica de calculo de
      // descuento intacta. (Ternario anidado.)
      const logicalType: string = rawReward.type === 'DESCUENTO'
        ? (rawReward.discountMode === 'PERCENTAGE' ? 'PERCENTAGE' : 'FIXED_AMOUNT')
        : rawReward.type; // TWO_FOR_ONE pasa tal cual

      // Objeto de promoción con campos normalizados (para uso posterior).
      promotionRecord = {
        ...rawReward,
        type: logicalType,
        value: Number(rawReward.discountAmount || 0),
        // Counter unificado: usar timesRedeemed/maxRedemptions de Reward
        usedCount: rawReward.timesRedeemed,
        maxUses: rawReward.maxRedemptions,
      };

      // Validaciones de vigencia y límite de usos.
      const now = new Date();
      if (rawReward.startDate && now < rawReward.startDate) {
        throw new BadRequestException('El cupón aún no ha comenzado');
      }
      if (rawReward.endDate && now > rawReward.endDate) {
        throw new BadRequestException('El cupón ha expirado');
      }
      // "!= null" cubre null y undefined. Si hay tope y ya se alcanzó, error.
      if (rawReward.maxRedemptions != null && rawReward.timesRedeemed >= rawReward.maxRedemptions) {
        throw new BadRequestException('El cupón ha alcanzado el límite de usos');
      }

      // Si la promoción aplica solo a ciertos servicios, alguno de los
      // reservados debe coincidir. "some" = "existe al menos uno".
      // Validate service compatibility
      const promoServiceIds: string[] = Array.isArray(rawReward.serviceIds) ? rawReward.serviceIds as string[] : [];
      if (promoServiceIds.length > 0) {
        const hasApplicable = dto.serviceIds.some((id) => promoServiceIds.includes(id));
        if (!hasApplicable) {
          throw new BadRequestException('El cupón no aplica a los servicios seleccionados');
        }
      }

      // applicableIds = los servicios sobre los que se calcula el descuento: si la
      // promo limita servicios, filtramos solo esos; si no, todos.
      // Calculate promotion discount
      const applicableIds = promoServiceIds.length > 0
        ? dto.serviceIds.filter((id) => promoServiceIds.includes(id))
        : dto.serviceIds;

      // Subtotal de los servicios aplicables.
      const promoServices = await this.prisma.service.findMany({
        where: { id: { in: applicableIds }, tenantId: tenant.id },
        select: { price: true },
      });
      const subtotal = promoServices.reduce((s, svc) => s + Number(svc.price), 0);

      // Monto mínimo exigido por la promoción.
      if (rawReward.minAmount && subtotal < Number(rawReward.minAmount)) {
        throw new BadRequestException(`Monto mínimo requerido: ${rawReward.minAmount}`);
      }

      // Cálculo del descuento según el tipo lógico.
      if (logicalType === 'PERCENTAGE') {
        discountAmount = Math.round(subtotal * Number(rawReward.discountAmount || 0) / 100 * 100) / 100;
      } else if (logicalType === 'FIXED_AMOUNT') {
        discountAmount = Math.min(Number(rawReward.discountAmount || 0), subtotal);
      } else if (logicalType === 'TWO_FOR_ONE') {
        // 2x1: No discount for the original booker — they pay full price.
        // A referral code will be generated post-booking for a friend.
        discountAmount = null;
      }
    }

    // Validate referral code (from 2x1 shared by a friend).
    // Antes leiamos de promotionReferral; ahora leemos de rewardReferral
    // (donde se generan los nuevos y donde la migration copio los viejos).
    // ── CASO 3: viene un CÓDIGO DE REFERIDO (2x1 compartido por un amigo).
    // Solo si no hay cupón ni promoción (los tres son excluyentes).
    let referralRecord: any = null;
    if (dto.referralCode && !dto.couponCode && !dto.promotionId) {
      const rawRef = await this.prisma.rewardReferral.findFirst({
        where: { code: dto.referralCode, tenantId: tenant.id, status: 'ACTIVE' },
        include: { reward: true },
      });
      if (rawRef) {
        referralRecord = { ...rawRef, promotion: rawRef.reward };
      }

      if (!referralRecord) {
        throw new BadRequestException('Código de referido no válido o ya utilizado');
      }

      // No expirado.
      if (referralRecord.expiresAt && new Date(referralRecord.expiresAt) < new Date()) {
        throw new BadRequestException('Este código de referido ha expirado');
      }

      // Al menos un servicio reservado debe coincidir con los del referido.
      // Validate that at least one of the booked services matches the referral
      const refServiceIds: string[] = Array.isArray(referralRecord.serviceIds) ? referralRecord.serviceIds : [];
      if (refServiceIds.length > 0) {
        const hasMatch = dto.serviceIds.some((id) => refServiceIds.includes(id));
        if (!hasMatch) {
          throw new BadRequestException('Este código solo es válido para los servicios de la promoción original');
        }
      }

      // No puedes usar tu PROPIO código de referido.
      // The friend who redeems cannot be the same person who generated it
      if (client.id === referralRecord.generatedByClientId) {
        throw new BadRequestException('No puedes usar tu propio código de referido');
      }

      // El referido da 100% de descuento sobre los servicios aplicables: el
      // descuento = la suma de sus precios (reduce).
      // Apply 100% discount on the applicable services
      const applicableIds = refServiceIds.length > 0
        ? dto.serviceIds.filter((id) => refServiceIds.includes(id))
        : dto.serviceIds;

      const refServices = await this.prisma.service.findMany({
        where: { id: { in: applicableIds }, tenantId: tenant.id },
        select: { price: true },
      });
      discountAmount = refServices.reduce((s, svc) => s + Number(svc.price), 0);
    }

    // ── PAGO CON PUNTOS: validamos y calculamos cuántos puntos cuesta la cita.
    // Pay with points: validate and calculate
    let pointsSpent = 0;
    if (dto.payWithPoints) {
      const services = await this.prisma.service.findMany({
        where: { id: { in: dto.serviceIds }, tenantId: tenant.id },
        select: { id: true, name: true, redeemableWithPoints: true, pointsRequired: true },
      });

      // TODOS los servicios deben ser canjeables con puntos. filter recoge los
      // que NO lo son; si hay alguno, error.
      const nonRedeemable = services.filter((s) => !s.redeemableWithPoints || !s.pointsRequired);
      if (nonRedeemable.length > 0) {
        throw new BadRequestException('No todos los servicios seleccionados son canjeables con puntos');
      }

      // Sumamos los puntos requeridos de cada servicio (reduce).
      pointsSpent = services.reduce((sum, s) => sum + (s.pointsRequired || 0), 0);
      if (pointsSpent <= 0) {
        throw new BadRequestException('No se puede calcular el costo en puntos');
      }

      // El cliente debe tener suficientes puntos.
      if (client.loyaltyPoints < pointsSpent) {
        throw new BadRequestException(
          `Puntos insuficientes. Necesitas ${pointsSpent} pts y tienes ${client.loyaltyPoints} pts`,
        );
      }
    }

    // Delegate to AppointmentsService.
    // Si vienen serviceAssignments (multi-empleado), las pasamos para que
    // cada servicio quede ligado a su profesional. employeeId queda como
    // "primario" (en general el primero del map).
    // Delegamos la CREACIÓN real de la cita al AppointmentsService (que aplica
    // el anti-doble-reserva). source 'ONLINE' marca que vino del marketplace.
    const appointment = await this.appointmentsService.create(
      {
        locationId: employee.locationId,
        clientId: client.id,
        employeeId: dto.employeeId,
        serviceIds: dto.serviceIds,
        startTime: dto.startTime,
        notes: dto.notes,
        source: 'ONLINE',
        serviceAssignments: dto.serviceAssignments,
      },
      tenant.id,
    );

    // postOps = lista de operaciones a ejecutar DESPUÉS de crear la cita
    // (descontar puntos, marcar cupón usado, etc.). Las juntamos y luego las
    // ejecutamos todas a la vez.
    // Post-booking transactions
    const postOps: any[] = [];

    // Si se pagó con puntos y la cita se creó (appointment?.data?.id existe),
    // descontamos los puntos y dejamos nota en la cita. "?." encadena con
    // seguridad por si algún nivel fuera null.
    // Deduct points if paying with points
    if (dto.payWithPoints && pointsSpent > 0 && appointment?.data?.id) {
      postOps.push(
        this.prisma.client.update({
          where: { id: client.id },
          data: { loyaltyPoints: { decrement: pointsSpent } },
        }),
        this.prisma.appointment.update({
          where: { id: appointment.data.id },
          data: {
            pointsSpent,
            // Añadimos una nota; "|| ''" evita "undefined" y .trim limpia espacios.
            notes: `${appointment.data.notes || ''}\n[Pagado con ${pointsSpent} puntos]`.trim(),
          },
        }),
      );
    }

    // Si se usó un cupón, lo marcamos como USED y lo enlazamos a la cita.
    // Mark coupon as used and link to appointment
    if (redemption && appointment?.data?.id) {
      postOps.push(
        this.prisma.rewardRedemption.update({
          where: { id: redemption.id },
          data: { status: 'USED', usedAt: new Date() },
        }),
        this.prisma.appointment.update({
          where: { id: appointment.data.id },
          data: { redemptionId: redemption.id, discountAmount },
        }),
      );
    }

    // Si se usó una promoción: subimos su contador de canjes y, si hubo
    // descuento, lo guardamos en la cita con una nota.
    // Increment reward counter (antes era promotion.usedCount) y guardar
    // descuento en la cita.
    if (promotionRecord && appointment?.data?.id) {
      postOps.push(
        this.prisma.reward.update({
          where: { id: promotionRecord.id },
          data: { timesRedeemed: { increment: 1 } },
        }),
      );
      if (discountAmount) {
        postOps.push(
          this.prisma.appointment.update({
            where: { id: appointment.data.id },
            data: {
              discountAmount,
              notes: `${appointment.data.notes || ''}\n[Cupón: ${promotionRecord.name}]`.trim(),
            },
          }),
        );
      }
    }

    // Si se usó un código de referido: lo marcamos USED, guardamos quién lo usó y
    // en qué cita, y aplicamos el descuento.
    // Mark referral code as used (rewardReferral, antes promotionReferral)
    if (referralRecord && appointment?.data?.id) {
      postOps.push(
        this.prisma.rewardReferral.update({
          where: { id: referralRecord.id },
          data: {
            status: 'USED',
            usedAt: new Date(),
            redeemedByClientId: client.id,
            redeemedAppointmentId: appointment.data.id,
          },
        }),
        this.prisma.appointment.update({
          where: { id: appointment.data.id },
          data: {
            discountAmount,
            notes: `${appointment.data.notes || ''}\n[Código 2x1: ${referralRecord.code} — Cupón: ${referralRecord.promotion.name}]`.trim(),
          },
        }),
      );
    }

    // Si la promoción aplicada es un 2x1, generamos un código de referido para
    // que el cliente pueda invitar a un amigo (la segunda unidad del 2x1).
    // Generate referral code for TWO_FOR_ONE rewards (post-booking).
    // Antes creaba promotionReferral; ahora rewardReferral.
    let referralCode: string | null = null;
    if (promotionRecord?.type === 'TWO_FOR_ONE' && appointment?.data?.id) {
      // Generamos un código de 8 caracteres (mismo alfabeto sin ambiguos).
      const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
      let code = '';
      for (let i = 0; i < 8; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
      }

      // Servicios del referido: los de la promo si los hay, si no, los reservados.
      const promoSvcIds = Array.isArray(promotionRecord.serviceIds) ? promotionRecord.serviceIds : dto.serviceIds;

      await this.prisma.rewardReferral.create({
        data: {
          tenantId: tenant.id,
          rewardId: promotionRecord.id,
          appointmentId: appointment.data.id,
          serviceIds: promoSvcIds,
          code,
          generatedByClientId: client.id,
          expiresAt: promotionRecord.endDate,
        },
      });

      referralCode = code; // lo devolveremos para que el cliente lo comparta
    }

    // Si hay operaciones pendientes, las ejecutamos TODAS dentro de una sola
    // transacción (o todas se aplican, o ninguna).
    if (postOps.length > 0) {
      await this.prisma.$transaction(postOps);
    }

    // Devolvemos la cita creada enriquecida con el resumen de descuentos/cupones.
    return {
      ...appointment,
      data: {
        ...appointment.data,
        discountAmount,
        // puntos gastados (o null si no se pagó con puntos).
        pointsSpent: pointsSpent > 0 ? pointsSpent : null,
        // Resumen de lo aplicado (cupón / promoción), o null si no hubo.
        couponApplied: redemption ? { code: redemption.code, reward: redemption.reward.name } : null,
        promotionApplied: promotionRecord ? { id: promotionRecord.id, name: promotionRecord.name } : null,
        referralCode,
      },
    };
  }

  // ─── CHECKOUT (Stripe) ─────────────────────────────────

  // createCheckoutSession(): crea una sesión de pago de Stripe para cobrar una
  // cita. Verifica que la cita pertenece al usuario y arma las líneas de cobro.
  async createCheckoutSession(
    marketplaceUserId: string,
    tenantSlug: string,
    appointmentId: string,
    stripeService: any,
    returnUrl?: string,
  ) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
    });
    if (!tenant) throw new NotFoundException('Negocio no encontrado');

    // La cita debe ser de este negocio y de este usuario (seguridad).
    // Verify appointment belongs to this tenant and user
    const appointment = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, tenantId: tenant.id },
      include: {
        client: { select: { userId: true, id: true } },
        items: true,
      },
    });

    if (!appointment || appointment.client?.userId !== marketplaceUserId) {
      throw new NotFoundException('Cita no encontrada');
    }

    // Construimos las líneas de cobro a partir de los items de la cita.
    // amount se pasa en CENTAVOS (por eso *100 y redondeo).
    // Build line items from appointment items
    const lineItems = appointment.items.map((item) => ({
      name: item.serviceNameSnapshot,
      amount: Math.round(Number(item.priceSnapshot) * 100), // cents
      quantity: 1,
    }));

    // URL base de retorno tras el pago.
    const baseUrl = returnUrl || process.env.FRONTEND_URL || 'http://localhost:3000';
    const bizUrl = `${baseUrl}/marketplace/${tenantSlug}`;

    // Delegamos a Stripe la creación de la sesión, pasándole las líneas, moneda
    // y las URLs de éxito/cancelación. {CHECKOUT_SESSION_ID} lo rellena Stripe.
    return stripeService.createCheckoutSession({
      tenantId: tenant.id,
      appointmentId,
      clientId: appointment.client.id,
      lineItems,
      currency: tenant.currency || 'MXN',
      successUrl: `${bizUrl}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${bizUrl}?payment=cancelled`,
    });
  }

  // ─── AVAILABLE REWARDS ───────────────────────────────
  // Returns active rewards from businesses the user has visited,
  // sorted by pointsRequired asc (cheapest first).

  // getAvailableRewards(): recompensas vigentes de los negocios donde el usuario
  // es cliente, indicando si puede canjearlas con sus puntos.
  async getAvailableRewards(marketplaceUserId: string) {
    // Todas las fichas Client del usuario (con sus puntos por negocio).
    // All client records for this marketplace user
    const clients = await this.prisma.client.findMany({
      where: { userId: marketplaceUserId },
      select: { id: true, tenantId: true, loyaltyPoints: true },
    });
    if (clients.length === 0) return { data: [] };

    // Map de tenantId -> ficha, para encontrar rápido los puntos del usuario en
    // cada negocio. tenantIds = lista de negocios donde es cliente.
    const clientByTenantId = new Map(clients.map((c) => [c.tenantId, c]));
    const tenantIds = clients.map((c) => c.tenantId);

    // Recompensas activas y vigentes de esos negocios, baratas primero.
    const rewards = await this.prisma.reward.findMany({
      where: {
        tenantId: { in: tenantIds },
        isActive: true,
        OR: [{ validUntil: null }, { validUntil: { gte: new Date() } }],
      },
      include: {
        tenant: { select: { name: true, slug: true, logoUrl: true } },
        service: { select: { name: true } },
      },
      orderBy: { pointsRequired: 'asc' },
    });

    // Transformamos cada recompensa añadiendo info personalizada del usuario.
    const data = rewards.map((r) => {
      // Ficha del usuario en ese negocio (puede no existir -> undefined).
      const client = clientByTenantId.get(r.tenantId);
      // Rewards migrados desde Promotion no tienen pointsRequired. Para esos
      // canRedeem es siempre true (se canjean en el booking, no por puntos).
      // "??" usa 0 si pointsRequired es null/undefined.
      const pr = r.pointsRequired ?? 0;
      return {
        id: r.id,
        name: r.name,
        description: r.description,
        type: r.type,
        pointsRequired: r.pointsRequired,
        discountAmount: r.discountAmount,
        discountMode: r.discountMode,
        serviceName: r.service?.name ?? null, // nombre del servicio o null
        tenant: r.tenant,
        myPoints: client?.loyaltyPoints ?? 0, // puntos del usuario aquí
        // ¿puede canjearla? sus puntos >= los requeridos.
        canRedeem: (client?.loyaltyPoints ?? 0) >= pr,
        // cuántos puntos le faltan (nunca negativo, por Math.max con 0).
        pointsNeeded: Math.max(0, pr - (client?.loyaltyPoints ?? 0)),
      };
    });

    return { data };
  }
}

// ─── TZ helpers (hora del negocio) ──────────────────────────────────
// Las citas se guardan con startTime en "hora del negocio" raw, sin
// offset. Para comparar contra "ahora" necesitamos el now expresado en
// la TZ de la sucursal en formato 'YYYY-MM-DDTHH:mm:ss', y luego una
// simple comparación de strings.

// nowInTz(): devuelve el "ahora" en una zona horaria concreta, como texto
// 'YYYY-MM-DDTHH:mm:ss'. Así podemos comparar contra las horas de las citas
// (guardadas sin offset) con una simple comparación de textos.
function nowInTz(timezone: string): string {
  try {
    // Intl.DateTimeFormat formatea la fecha actual en la zona pedida. en-CA da
    // el formato "YYYY-MM-DD"; hour12:false usa reloj de 24 horas.
    // formatToParts devuelve la fecha partida en piezas (año, mes, día...).
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    }).formatToParts(new Date());
    // get(t) busca la pieza del tipo "t" (ej. 'year') y devuelve su valor, o '00'
    // si no la encuentra. "?." evita error si find no halla nada.
    const get = (t: string) => parts.find((p) => p.type === t)?.value || '00';
    // Reensamblamos las piezas en el formato 'YYYY-MM-DDTHH:mm:ss'.
    return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`;
  } catch {
    // Si la zona fuera inválida, caemos a la hora UTC recortada a 19 caracteres
    // ("YYYY-MM-DDTHH:mm:ss"), para no romper.
    return new Date().toISOString().substring(0, 19);
  }
}

// toRawIso(): convierte una fecha (Date, texto o null) al mismo formato de 19
// caracteres 'YYYY-MM-DDTHH:mm:ss', para poder compararla con nowInTz().
function toRawIso(d: Date | string | null | undefined): string {
  if (!d) return ''; // si no hay fecha, texto vacío
  // Si ya es texto, recortamos a los primeros 19 caracteres.
  if (typeof d === 'string') return d.substring(0, 19);
  // Las citas se guardan en UTC raw (sin offset real). Las "leemos" como
  // si fueran TZ-naive: toISOString sin TZ shift es lo que queremos.
  return d.toISOString().substring(0, 19);
}
