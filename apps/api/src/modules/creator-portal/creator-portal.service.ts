// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// De NestJS, varios errores listos para usar (cada uno responde con un código
// HTTP concreto):
//   - Injectable: marca esta clase como servicio inyectable.
//   - UnauthorizedException: HTTP 401 (no autorizado / credenciales inválidas).
//   - ConflictException: HTTP 409 (conflicto, p.ej. email ya registrado).
//   - BadRequestException: HTTP 400 (petición inválida, p.ej. token expirado).
import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';

// JwtService: servicio para FIRMAR (crear) tokens JWT. Lo configuró el módulo
// con el secreto y la expiración.
import { JwtService } from '@nestjs/jwt';

// bcrypt: librería para "hashear" contraseñas. Un hash es una huella
// irreversible de la contraseña: en la base de datos nunca guardamos la
// contraseña en claro, solo su hash. "* as bcrypt" importa todo el módulo.
import * as bcrypt from 'bcrypt';

// PrismaService: puente hacia la base de datos (consultas a la tabla influencer).
import { PrismaService } from '../../prisma/prisma.service';

// CreatorCodesService: servicio de otro módulo que ya sabe armar el detalle del
// creador y gestionar Stripe Connect. Lo reutilizamos para no duplicar lógica.
import { CreatorCodesService } from '../creator-codes/creator-codes.service';

// Los DTOs que describen y validan los datos de entrada de cada operación.
import {
  CreatorLoginDto,
  CreatorRegisterDto,
  CreatorSetPasswordDto,
  CreatorChangePasswordDto,
} from './dto/creator-auth.dto';

// @Injectable() marca la clase como servicio que NestJS puede inyectar.
@Injectable()
export class CreatorPortalService {
  // Inyección de dependencias por constructor: NestJS provee estas tres clases
  // y las guarda como propiedades de solo lectura (this.prisma, etc.).
  constructor(
    private readonly prisma: PrismaService,        // acceso a la base de datos
    private readonly jwtService: JwtService,        // firma de tokens JWT
    private readonly creatorCodes: CreatorCodesService, // dashboard + Stripe
  ) {}

  // ── signToken(): crea (firma) un token JWT para un creador ──
  // "private" => solo se usa dentro de esta clase, no es un endpoint.
  // Recibe un objeto con el id y el email del creador.
  private signToken(influencer: { id: string; email: string }) {
    // jwtService.sign(...) construye el token con este "payload" (contenido):
    return this.jwtService.sign({
      sub: influencer.id,   // "subject": el id del creador (convención JWT)
      email: influencer.email,
      type: 'creator',      // marca de portal, validada luego por la estrategia
    });
    // La expiración (7d por defecto) y el secreto los aporta la config del módulo.
  }

  // ── publicProfile(): filtra los campos del creador que SÍ se pueden mostrar ──
  // Recibe el registro completo del influencer (tipo "any" = cualquier forma) y
  // devuelve solo los campos seguros, escondiendo datos sensibles como el
  // passwordHash, el inviteToken o las notas internas del admin.
  private publicProfile(inf: any) {
    return {
      id: inf.id,
      email: inf.email,
      firstName: inf.firstName,
      lastName: inf.lastName,
      phone: inf.phone,
      status: inf.status,
      stripeOnboardingComplete: inf.stripeOnboardingComplete,
    };
  }

  // ── login(): inicia sesión y devuelve un token de acceso ──
  async login(dto: CreatorLoginDto) {
    // Normalizamos el email: a minúsculas y sin espacios al inicio/fin, para que
    // "  Ana@Mail.com " y "ana@mail.com" se traten igual.
    const email = dto.email.toLowerCase().trim();
    // Buscamos UN creador único por ese email. findUnique exige un campo único.
    const influencer = await this.prisma.influencer.findUnique({ where: { email } });

    // Si no existe el creador O no tiene contraseña configurada todavía, no se
    // puede entrar. El "!" significa "no/ausente". Damos un mensaje genérico a
    // propósito (no revelamos si el email existe o no) por seguridad.
    if (!influencer || !influencer.passwordHash) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    // Una cuenta suspendida no puede iniciar sesión.
    if (influencer.status === 'SUSPENDED') {
      throw new UnauthorizedException('Tu cuenta está suspendida. Contacta al administrador.');
    }

    // bcrypt.compare compara la contraseña escrita con el hash guardado. Devuelve
    // true si coinciden. No "des-hashea" nada: re-hashea y compara internamente.
    const ok = await bcrypt.compare(dto.password, influencer.passwordHash);
    // Si no coinciden, mismo error genérico (sin pistas para un atacante).
    if (!ok) throw new UnauthorizedException('Credenciales inválidas');

    // Registramos la fecha/hora del último login (new Date() = ahora mismo).
    await this.prisma.influencer.update({
      where: { id: influencer.id },
      data: { lastLoginAt: new Date() },
    });

    // Devolvemos el token de acceso recién firmado + el perfil público (sin
    // datos sensibles). El frontend guardará el token y lo enviará en cada
    // petición protegida.
    return {
      accessToken: this.signToken(influencer),
      influencer: this.publicProfile(influencer),
    };
  }

  // ── register(): auto-registro de un creador nuevo (queda pendiente) ──
  async register(dto: CreatorRegisterDto) {
    // Normalizamos el email igual que en login.
    const email = dto.email.toLowerCase().trim();
    // Comprobamos que no exista ya una cuenta con ese email.
    const existing = await this.prisma.influencer.findUnique({ where: { email } });
    if (existing) {
      // Si ya existe, error 409 (conflicto).
      throw new ConflictException('Ya existe una cuenta con ese email');
    }

    // Hasheamos la contraseña antes de guardarla. El "12" es el "cost factor":
    // cuántas rondas de cálculo aplica bcrypt. A mayor número, más seguro pero
    // más lento; 12 es un valor robusto y habitual.
    const passwordHash = await bcrypt.hash(dto.password, 12);
    // Creamos el registro del creador en la base de datos.
    const influencer = await this.prisma.influencer.create({
      data: {
        email,
        firstName: dto.firstName.trim(), // sin espacios sobrantes
        lastName: dto.lastName.trim(),
        // phone es opcional. "dto.phone?.trim()" usa "?." (optional chaining):
        // si phone es null/undefined no intenta .trim() (evita un error). El
        // "|| null" convierte un teléfono vacío ("") en null para la BD.
        phone: dto.phone?.trim() || null,
        passwordHash,
        status: 'PENDING', // queda pendiente de aprobación del super-admin
      },
    });

    // No emitimos token: debe esperar aprobación para acceder al panel con datos.
    return {
      registered: true,
      influencer: this.publicProfile(influencer),
      message: 'Cuenta creada. Un administrador la revisará y aprobará pronto.',
    };
  }

  // ── setPasswordFromToken(): fija la contraseña desde el enlace de invitación ──
  // Flujo: el admin invita a un creador y le envía un enlace con un "inviteToken".
  // Aquí ese token sirve de prueba de identidad para establecer la contraseña.
  async setPasswordFromToken(dto: CreatorSetPasswordDto) {
    // Buscamos al creador por su inviteToken (que es un campo único).
    const influencer = await this.prisma.influencer.findUnique({
      where: { inviteToken: dto.token },
    });
    // El enlace es inválido si: no hay creador con ese token, O el token no tiene
    // fecha de expiración, O esa fecha ya pasó (es anterior a "ahora").
    // Cada "||" hace que con que UNA condición sea verdadera, se rechace.
    if (
      !influencer ||
      !influencer.inviteTokenExpiresAt ||
      influencer.inviteTokenExpiresAt < new Date()
    ) {
      throw new BadRequestException('El enlace es inválido o expiró');
    }

    // Hasheamos la nueva contraseña (mismo cost factor 12).
    const passwordHash = await bcrypt.hash(dto.password, 12);
    // Guardamos el hash y ANULAMOS el token de invitación (lo ponemos a null)
    // para que el enlace no se pueda volver a usar (es de un solo uso).
    await this.prisma.influencer.update({
      where: { id: influencer.id },
      data: { passwordHash, inviteToken: null, inviteTokenExpiresAt: null },
    });

    // Devolvemos un token de acceso SOLO si la cuenta no está suspendida.
    // Operador ternario: condición ? valorSiSí : valorSiNo.
    // Si está suspendida, accessToken es null (no puede entrar al panel aún).
    return {
      accessToken: influencer.status !== 'SUSPENDED' ? this.signToken(influencer) : null,
      influencer: this.publicProfile(influencer),
    };
  }

  // ── changePassword(): cambia la contraseña estando ya autenticado ──
  // influencerId viene de req.user (lo puso la estrategia JWT al validar el token).
  async changePassword(influencerId: string, dto: CreatorChangePasswordDto) {
    // Buscamos al creador por su id.
    const influencer = await this.prisma.influencer.findUnique({
      where: { id: influencerId },
    });
    // "influencer?.passwordHash" usa "?." para no romper si influencer es null.
    // Si no hay creador o no tiene hash configurado, no se puede cambiar nada.
    if (!influencer?.passwordHash) {
      throw new UnauthorizedException('Cuenta sin contraseña configurada');
    }
    // Verificamos que la contraseña ACTUAL aportada sea correcta antes de cambiar.
    const ok = await bcrypt.compare(dto.currentPassword, influencer.passwordHash);
    if (!ok) throw new UnauthorizedException('La contraseña actual es incorrecta');

    // Hasheamos y guardamos la nueva contraseña.
    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.influencer.update({
      where: { id: influencerId },
      data: { passwordHash },
    });
    // Respondemos confirmando el cambio.
    return { data: { changed: true } };
  }

  // ── me(): devuelve el perfil del creador autenticado ──
  async me(influencerId: string) {
    const influencer = await this.prisma.influencer.findUnique({
      where: { id: influencerId },
    });
    // Si no existe (caso raro: el token apunta a una cuenta borrada), 401.
    if (!influencer) throw new UnauthorizedException('Creador no encontrado');
    // Solo devolvemos los campos públicos (sin datos sensibles).
    return { data: this.publicProfile(influencer) };
  }

  /** Dashboard del creador: reutiliza la agregación del panel admin, sin notas internas. */
  async dashboard(influencerId: string) {
    // Reutilizamos el servicio de creator-codes para obtener el detalle completo
    // (estadísticas, códigos, etc.) sin reescribir esa lógica aquí.
    const detail = await this.creatorCodes.getInfluencerDetail(influencerId);
    // "d: any" => tratamos el resultado como objeto libre para poder modificarlo.
    const d: any = detail.data;
    // "d?.influencer" usa "?." para no romper si d o d.influencer no existen.
    // Si existe, borramos "notes" (notas internas privadas del admin) para que el
    // creador NO las vea en su propio dashboard.
    if (d?.influencer) delete d.influencer.notes;
    return { data: d };
  }

  // ─── Cobros self-service (Stripe Connect) ─────────

  // ── stripeOnboardingLink(): genera el enlace de alta en Stripe Connect ──
  async stripeOnboardingLink(influencerId: string) {
    // URL base del frontend. "|| 'http://localhost:3000'" da un valor por defecto
    // para desarrollo si la variable de entorno WEB_URL no está definida.
    let base = process.env.WEB_URL || 'http://localhost:3000';
    // Stripe en modo LIVE exige que las URLs de retorno sean HTTPS. Si WEB_URL
    // quedó como http:// para un dominio real (no localhost), la forzamos a
    // https para no romper el onboarding ("Livemode requests must always be
    // redirected via HTTPS"). El arreglo definitivo es poner WEB_URL correcta.
    if (base.startsWith('http://') && !/localhost|127\.0\.0\.1/.test(base)) {
      base = base.replace(/^http:\/\//, 'https://');
    }
    // Delegamos en creator-codes la creación del enlace, indicándole a qué página
    // (de retorno) debe volver el creador tras terminar el alta en Stripe.
    // "`${base}/creator/dashboard`" es una plantilla de texto que inserta "base".
    return this.creatorCodes.createStripeOnboardingLink(
      influencerId,
      `${base}/creator/dashboard`,
    );
  }

  // ── stripeStatus(): consulta el estado de la conexión del creador con Stripe ──
  async stripeStatus(influencerId: string) {
    // También se delega a creator-codes (ya tiene la integración con Stripe).
    return this.creatorCodes.getStripeStatus(influencerId);
  }
}
