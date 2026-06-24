// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// De NestJS:
//   - Injectable: decorador que marca esta clase como servicio inyectable.
//   - UnauthorizedException: error listo para usar que responde con HTTP 401.
import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

// JwtService: servicio de NestJS que sabe FIRMAR (crear) tokens JWT.
import { JwtService } from '@nestjs/jwt';

// bcrypt: librería para "hashear" contraseñas/tokens (guardarlos cifrados de forma
// irreversible) y compararlos sin guardar el texto original. "* as bcrypt" importa
// todo el módulo bajo el nombre bcrypt.
import * as bcrypt from 'bcrypt';

// uuid v4: genera identificadores únicos y aleatorios. Lo usamos para crear el
// valor del refresh token. Renombramos "v4" a "uuidv4" para que se lea mejor.
import { v4 as uuidv4 } from 'uuid';

// PrismaService: nuestro puente hacia la base de datos.
import { PrismaService } from '../../prisma/prisma.service';

// @Injectable() registra esta clase como servicio en NestJS.
@Injectable()
export class PlatformAuthService {
  // El constructor recibe (inyectados por NestJS) Prisma (BD) y JwtService (firma
  // de tokens), y los guarda como propiedades de solo lectura para usarlos abajo.
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  // ───────────────────────────────────────────────────────────────────────────
  // login(): valida correo + contraseña y, si todo está bien, devuelve tokens.
  // ───────────────────────────────────────────────────────────────────────────
  async login(email: string, password: string) {
    // findUnique busca UN usuario de plataforma cuyo email coincida exactamente.
    const user = await this.prisma.platformUser.findUnique({
      where: { email },
    });

    // "!user || !user.isActive" se lee: "si NO existe el usuario, O existe pero
    // NO está activo". El "||" es un O lógico (basta con que una sea verdadera).
    // En cualquiera de esos casos lanzamos 401 con un mensaje genérico (no
    // revelamos si el fallo fue el correo o la contraseña, por seguridad).
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // bcrypt.compare(textoPlano, hashGuardado) devuelve true si la contraseña
    // escrita coincide con el hash almacenado. NUNCA guardamos la contraseña real.
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    // Si no coincide, mismo error genérico.
    if (!isMatch) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Login correcto: registramos la fecha/hora de este acceso (new Date() = ahora).
    await this.prisma.platformUser.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Generamos el par de tokens (access + refresh) para esta sesión.
    const tokens = await this.generateTokens(user);

    // Devolvemos los tokens y un resumen del usuario (sin datos sensibles como el
    // hash de la contraseña). El rol va fijo como 'platform_admin'.
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: 'platform_admin',
      },
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // refresh(): canjea un refresh token válido por un nuevo par de tokens.
  // ───────────────────────────────────────────────────────────────────────────
  async refresh(refreshToken: string) {
    // En la BD NO guardamos el refresh token completo (solo su hash). Para poder
    // buscarlo guardamos también una "pista" (tokenHint): los primeros 8
    // caracteres. substring(0, 8) toma del carácter 0 hasta el 8 (sin incluirlo).
    const tokenHint = refreshToken.substring(0, 8);
    // Traemos TODOS los tokens NO revocados (revokedAt === null) cuya pista
    // coincida. Pueden ser varios (la pista no es única), por eso es una lista.
    // include: { user: true } trae además el usuario dueño de cada token.
    const candidates = await this.prisma.platformRefreshToken.findMany({
      where: { tokenHint, revokedAt: null },
      include: { user: true },
    });

    // "matched" guardará el token que realmente coincida. Empieza en null.
    // "(typeof candidates)[0]" = "el tipo de un elemento del array candidates".
    let matched: (typeof candidates)[0] | null = null;
    // Recorremos cada candidato (stored) para encontrar cuál corresponde de verdad.
    for (const stored of candidates) {
      // Comparamos el token recibido con el hash guardado de este candidato.
      const isMatch = await bcrypt.compare(refreshToken, stored.tokenHash);
      if (isMatch) {
        matched = stored; // lo encontramos
        break;            // dejamos de buscar (ya no hace falta seguir el bucle)
      }
    }

    // Si ningún candidato coincidió, el token no es válido => 401.
    if (!matched) {
      throw new UnauthorizedException('Token de actualización inválido');
    }

    // ¿El token ya expiró? "new Date() > matched.expiresAt" compara fechas:
    // si "ahora" es POSTERIOR a su fecha de expiración, está caducado.
    if (new Date() > matched.expiresAt) {
      // Lo marcamos como revocado (revokedAt = ahora) para limpiarlo.
      await this.prisma.platformRefreshToken.update({
        where: { id: matched.id },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Token de actualización expirado');
    }

    // ROTACIÓN: revocamos el token usado para que NO pueda reutilizarse. Cada
    // refresh genera un token nuevo y anula el anterior (más seguro).
    await this.prisma.platformRefreshToken.update({
      where: { id: matched.id },
      data: { revokedAt: new Date() },
    });

    // Generamos un par de tokens nuevo para el dueño del token (matched.user).
    const tokens = await this.generateTokens(matched.user);
    return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // logout(): revoca el refresh token recibido para cerrar la sesión.
  // ───────────────────────────────────────────────────────────────────────────
  async logout(refreshToken: string) {
    // Misma técnica que en refresh: buscamos por la "pista" de 8 caracteres.
    const tokenHint = refreshToken.substring(0, 8);
    const candidates = await this.prisma.platformRefreshToken.findMany({
      where: { tokenHint, revokedAt: null },
    });

    // Recorremos los candidatos buscando el que coincida realmente por hash.
    for (const stored of candidates) {
      const isMatch = await bcrypt.compare(refreshToken, stored.tokenHash);
      if (isMatch) {
        // Lo revocamos (revokedAt = ahora) y salimos del bucle.
        await this.prisma.platformRefreshToken.update({
          where: { id: stored.id },
          data: { revokedAt: new Date() },
        });
        break;
      }
    }
    // Nota: si no se encuentra, no lanzamos error (logout siempre "tiene éxito").
  }

  // ───────────────────────────────────────────────────────────────────────────
  // getMe(): devuelve la ficha del super-admin a partir de su id.
  // ───────────────────────────────────────────────────────────────────────────
  async getMe(userId: string) {
    // Buscamos el primer usuario con ese id que además esté activo. "select"
    // elige solo los campos seguros que queremos exponer (sin passwordHash).
    const user = await this.prisma.platformUser.findFirst({
      where: { id: userId, isActive: true },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    // Si no existe o está inactivo, devolvemos 401.
    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    // "{ ...user, role: ... }" usa el "spread" (...) para COPIAR todos los campos
    // de user y, además, añadir el campo role. Así devolvemos la ficha + el rol.
    return { ...user, role: 'platform_admin' };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // generateTokens(): método PRIVADO (solo se usa dentro de esta clase) que crea
  // el access token (JWT firmado) y el refresh token (uuid hasheado en BD).
  // Recibe un objeto con al menos id y email del usuario.
  // ───────────────────────────────────────────────────────────────────────────
  private async generateTokens(user: { id: string; email: string }) {
    // "payload" = el contenido que irá DENTRO del access token (no es secreto:
    // cualquiera puede leerlo, pero NO falsificarlo sin el secreto de firma).
    const payload = {
      sub: user.id,             // "subject": el id del usuario.
      email: user.email,        // su correo.
      role: 'platform_admin',   // su rol fijo.
    };

    // Firmamos el JWT con el payload y opciones:
    //   - expiresIn: usa JWT_ACCESS_EXPIRY si existe, si no "|| '15m'" (15 minutos).
    //   - issuer: 'siliba-platform' (debe coincidir con lo que valida la estrategia).
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m',
      issuer: 'siliba-platform',
    });

    // El refresh token es un UUID aleatorio (no un JWT). Es el valor que se le da
    // al cliente; en la BD solo guardamos su hash, nunca el valor en claro.
    const refreshToken = uuidv4();
    // bcrypt.hash(valor, 10): cifra el token. El "10" son las "rondas de sal"
    // (cuánto trabajo cuesta calcular el hash; más alto = más seguro y más lento).
    const tokenHash = await bcrypt.hash(refreshToken, 10);
    // Guardamos también la pista (primeros 8 chars) para poder localizarlo después.
    const tokenHint = refreshToken.substring(0, 8);
    // Calculamos la fecha de expiración: ahora + 7 días.
    const expiresAt = new Date();
    // setDate(día actual + 7) avanza la fecha 7 días (gestiona cambios de mes solo).
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Guardamos el refresh token (hash + pista + dueño + expiración) en la BD.
    await this.prisma.platformRefreshToken.create({
      data: {
        tokenHash,
        tokenHint,
        userId: user.id,
        expiresAt,
      },
    });

    // Devolvemos ambos tokens a quien llamó (login o refresh).
    return { accessToken, refreshToken };
  }
}
