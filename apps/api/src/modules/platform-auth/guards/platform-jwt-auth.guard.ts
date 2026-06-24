// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// De NestJS importamos "Injectable": el decorador (etiqueta "@") que marca esta
// clase como algo que NestJS puede crear e inyectar donde se necesite. Aquí lo
// usamos porque un "guard" (guardián) también es un proveedor inyectable.
import { Injectable } from '@nestjs/common';

// De @nestjs/passport importamos "AuthGuard". Passport es la librería de
// autenticación; AuthGuard es una "fábrica de guardianes" que, dado el nombre de
// una estrategia, devuelve una clase guard ya preparada para proteger rutas.
import { AuthGuard } from '@nestjs/passport';

// @Injectable() registra esta clase en el sistema de inyección de NestJS.
@Injectable()
// Definimos el guard que protege las rutas del super-admin de la plataforma.
//   - "extends AuthGuard('platform-jwt')": heredamos toda la lógica de un guard
//     de Passport, indicándole que use la estrategia registrada con el nombre
//     'platform-jwt' (ver platform-jwt.strategy.ts).
//   - El cuerpo "{}" está vacío a propósito: no añadimos nada, solo le ponemos
//     un nombre propio (PlatformJwtAuthGuard) para usarlo cómodo en @UseGuards.
//   - Al colocar este guard sobre una ruta, antes de ejecutar el método se
//     valida el token JWT; si es inválido, NestJS responde 401 (no autorizado).
export class PlatformJwtAuthGuard extends AuthGuard('platform-jwt') {}
