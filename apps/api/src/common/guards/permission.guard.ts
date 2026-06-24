// ─────────────────────────────────────────────────────────────────────────────
// GUARD PermissionGuard — "el portero que revisa los permisos del usuario"
// ─────────────────────────────────────────────────────────────────────────────
//
// IDEA GENERAL: el JwtAuthGuard comprueba QUIÉN eres (token válido). Este guard
// va un paso más allá: comprueba QUÉ PUEDES HACER. Lee la lista de permisos que
// la ruta exige (puesta con @RequirePermissions(...)) y la compara con los
// permisos que tiene el usuario. Si le falta aunque sea uno, devuelve error 403
// (prohibido). Suele usarse junto al JwtAuthGuard:
//     @UseGuards(JwtAuthGuard, PermissionGuard)

// De NestJS:
//   - CanActivate: la "interface" (contrato) que todo guard debe cumplir;
//     obliga a tener un método canActivate.
//   - ExecutionContext: contexto de la petición actual.
//   - ForbiddenException: error listo que responde con HTTP 403.
//   - Injectable: marca la clase como inyectable.
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
// Reflector: para LEER la metadata de permisos pegada por @RequirePermissions.
import { Reflector } from '@nestjs/core';
// La clave bajo la que se guardaron los permisos requeridos. La compartimos con
// el decorador para leer exactamente lo que él escribió.
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

// @Injectable(): permite usar esta clase como guard en el sistema.
@Injectable()
// "implements CanActivate": prometemos cumplir el contrato de guard (tener
// canActivate). A diferencia del JwtAuthGuard, aquí NO heredamos de nadie:
// escribimos toda la lógica nosotros.
export class PermissionGuard implements CanActivate {
  // Inyectamos un Reflector para leer la metadata de la ruta.
  // "private readonly" lo guarda como propiedad de solo lectura (this.reflector).
  constructor(private readonly reflector: Reflector) {}

  // canActivate: decide si la petición pasa. Devuelve true (pasa) o lanza un
  // error (no pasa). El tipo de retorno es boolean.
  canActivate(context: ExecutionContext): boolean {
    // Leemos los permisos requeridos por la ruta. getAllAndOverride busca la
    // nota PERMISSIONS_KEY en el método y en la clase (el método tiene
    // prioridad). El <string[]> indica que esperamos un arreglo de textos.
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Si la ruta NO pide permisos (no hay nota, o la lista está vacía), no hay
    // nada que comprobar y dejamos pasar.
    //   - "!requiredPermissions": verdadero si es null/undefined.
    //   - "|| requiredPermissions.length === 0": o si la lista está vacía.
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    // Obtenemos la petición HTTP y de ahí el usuario que el JwtAuthGuard dejó
    // en request.user tras validar el token.
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Si no hay usuario (la ruta exige permisos pero nadie se autenticó),
    // prohibimos el acceso con un 403.
    if (!user) {
      throw new ForbiddenException('Usuario no autenticado');
    }

    // Tomamos la lista de permisos del usuario. "user.permissions || []" usa el
    // operador OR "||": si el usuario no tuviera permisos definidos
    // (null/undefined), usamos un arreglo vacío para evitar errores al recorrer.
    const userPermissions: string[] = user.permissions || [];

    // ¿Tiene el usuario TODOS los permisos requeridos?
    //   - every() recorre requiredPermissions y devuelve true SOLO si la
    //     condición se cumple para CADA elemento.
    //   - Para cada "perm" requerido, comprobamos con includes() si está dentro
    //     de userPermissions (es decir, si el usuario lo posee).
    const hasAll = requiredPermissions.every((perm) =>
      userPermissions.includes(perm),
    );

    // Si le falta al menos uno, hasAll será false: prohibimos el acceso y, de
    // paso, en el mensaje listamos qué permisos hacían falta. join(', ') une la
    // lista de permisos en un solo texto separado por comas.
    if (!hasAll) {
      throw new ForbiddenException(
        `Permisos insuficientes. Requeridos: ${requiredPermissions.join(', ')}`,
      );
    }

    // Tiene todos los permisos: dejamos pasar.
    return true;
  }
}
