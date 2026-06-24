// ─────────────────────────────────────────────────────────────────────────────
// DECORADOR DE PARÁMETRO @CurrentUser() — "dame el usuario logueado"
// ─────────────────────────────────────────────────────────────────────────────
//
// IDEA GENERAL: este es un "decorador de PARÁMETRO". Se pone delante de un
// argumento de un método del controlador, así:
//     async miRuta(@CurrentUser() user: JwtPayload) { ... }
// y hace que, en lugar de escribir tú el valor, NestJS lo CALCULE y te lo
// entregue ya listo. Aquí calculamos "el usuario que hizo la petición".

// De NestJS importamos dos piezas:
//   - createParamDecorator: la "fábrica" para construir nuestro propio
//     decorador de parámetro. Le pasamos una función y nos devuelve el
//     decorador listo para usar (@CurrentUser()).
//   - ExecutionContext: un objeto que NestJS nos da y que envuelve TODO el
//     contexto de la petición actual (la request HTTP, la respuesta, etc.).
//     A través de él accedemos a los datos crudos de la petición.
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

// JwtPayload describe la "forma" (qué campos tiene) del usuario que viaja
// dentro del token JWT una vez verificado. Una "interface" en TypeScript es
// solo un contrato de tipos: dice qué propiedades existen y de qué tipo son,
// pero no genera código en tiempo de ejecución.
export interface JwtPayload {
  userId: string;  // id único del usuario
  tenantId: string; // id del negocio (tenant) al que pertenece — clave multi-tenant
  email: string;   // correo del usuario
}

// CurrentUser es el decorador resultante. createParamDecorator recibe una
// función que NestJS ejecutará en cada petición para producir el valor.
//   - "_data: unknown": datos extra que se podrían pasar al decorador
//     (ej. @CurrentUser('email')). Aquí NO lo usamos; el guion bajo "_" al
//     inicio es una convención que avisa "este parámetro existe pero se ignora".
//   - "ctx: ExecutionContext": el contexto de la petición (ver arriba).
//   - ": JwtPayload": el tipo de lo que devolvemos (el usuario).
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload => {
    // ctx.switchToHttp() dice "interpreta este contexto como HTTP" y
    // .getRequest() saca el objeto Request de Express (la petición entrante).
    const request = ctx.switchToHttp().getRequest();
    // El JwtAuthGuard, al validar el token, deja el usuario en request.user.
    // Aquí simplemente lo devolvemos para inyectarlo en el parámetro.
    return request.user;
  },
);
