// ─────────────────────────────────────────────────────────────────────────────
// DECORADOR DE PARÁMETRO @CurrentTenant() — "dame el id del negocio (tenant)"
// ─────────────────────────────────────────────────────────────────────────────
//
// IDEA GENERAL: igual que @CurrentUser(), es un decorador de parámetro hecho a
// medida. Pero en vez de devolver TODO el usuario, devuelve solo su tenantId
// (el identificador del negocio). Esto es MUY usado en este proyecto porque es
// multi-tenant: casi toda consulta a la base de datos debe filtrar por tenantId
// para que un negocio no vea los datos de otro. Tenerlo en un decorador corto
// hace que escribir esas consultas sea cómodo:
//     async listar(@CurrentTenant() tenantId: string) { ... }

// createParamDecorator: fábrica de decoradores de parámetro.
// ExecutionContext: el contexto de la petición actual (request, response, etc.).
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

// CurrentTenant: el decorador que extrae únicamente el tenantId del usuario.
//   - "_data: unknown": argumento extra no usado (el "_" indica que se ignora).
//   - "ctx: ExecutionContext": contexto de la petición.
//   - ": string": devolvemos un texto (el id del tenant).
export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    // Obtenemos la petición HTTP cruda (igual que en current-user).
    const request = ctx.switchToHttp().getRequest();
    // "request.user?.tenantId" usa el OPTIONAL CHAINING "?.":
    //   - Si request.user EXISTE, devuelve su tenantId.
    //   - Si request.user es null/undefined (p.ej. en una ruta pública sin
    //     usuario), NO intenta leer .tenantId (lo que daría error) y devuelve
    //     undefined de forma segura.
    return request.user?.tenantId;
  },
);
