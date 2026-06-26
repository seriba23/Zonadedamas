// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// De NestJS importamos:
//   - BadRequestException: error que hace responder con HTTP 400 (petición inválida).
//   - Injectable: decorador que marca esta clase como "servicio" inyectable.
//   - NotFoundException: error que hace responder con HTTP 404 (no encontrado).
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

// PrismaService = nuestro "puente" hacia la base de datos. A través de
// this.prisma leeremos/escribiremos las tablas de RBAC: role, permission,
// rolePermission, userRole, user, etc.
import { PrismaService } from '../../prisma/prisma.service';

// DTOs que describen los datos de entrada para crear/actualizar/asignar roles.
import { CreateRoleDto, UpdateRoleDto } from './dto/create-role.dto';
import { AssignRoleDto } from './dto/assign-role.dto';

// ── MODELO MENTAL DE RBAC (control de acceso basado en roles) ──
// Un PERMISO es una acción concreta (ej. módulo "roles" + acción "read" = "roles.read").
// Un ROL agrupa varios permisos (tabla intermedia rolePermission une role<->permission).
// Un USUARIO recibe uno o más roles (tabla intermedia userRole une user<->role).
// => Los permisos EFECTIVOS de un usuario = la suma de los permisos de sus roles.

@Injectable() // <- marca la clase como servicio inyectable de NestJS.
export class RbacService {
  // El constructor recibe el PrismaService que NestJS inyecta automáticamente y
  // lo guarda como propiedad de solo lectura (this.prisma).
  constructor(private readonly prisma: PrismaService) {}

  // ───────────────────────────────────────────────────────────────────────────
  // getUserPermissions(): calcula la lista de permisos EFECTIVOS de un usuario
  // dentro de un negocio. Recibe userId y tenantId; devuelve un arreglo de textos
  // como ["roles.read", "appointments.create", ...] (Promise<string[]> = promesa
  // que resolverá en un arreglo de strings).
  // ───────────────────────────────────────────────────────────────────────────
  async getUserPermissions(
    userId: string,
    tenantId: string,
  ): Promise<string[]> {
    // Buscamos TODAS las asignaciones de rol (userRole) de este usuario en este
    // negocio. findMany = "encuentra varios registros".
    const userRoles = await this.prisma.userRole.findMany({
      // where = condición: del usuario indicado Y del negocio indicado.
      where: { userId, tenantId },
      // include = trae datos relacionados anidados. Aquí "bajamos" tres niveles:
      //   userRole -> role -> rolePermissions -> permission
      // para tener, junto a cada rol del usuario, sus permisos completos.
      include: {
        role: {
          include: {
            rolePermissions: {
              include: { permission: true }, // el permiso real (module + action)
            },
          },
        },
      },
    });

    // Usamos un Set (conjunto) en vez de un arreglo: un Set NO admite duplicados.
    // Como un usuario puede tener varios roles que comparten un mismo permiso, el
    // Set evita que ese permiso aparezca repetido. Guarda valores de tipo string.
    const permissionsSet = new Set<string>();
    // for...of recorre CADA asignación de rol del usuario. "ur" = userRole actual.
    for (const ur of userRoles) {
      // for...of anidado: por cada rol, recorremos sus permisos. "rp" = rolePermission.
      for (const rp of ur.role.rolePermissions) {
        // Construimos el texto del permiso en formato "modulo.accion" usando una
        // plantilla `${...}.${...}`. Ej.: module="roles" + action="read" => "roles.read".
        // .add() lo mete en el Set (si ya estaba, no se duplica).
        permissionsSet.add(`${rp.permission.module}.${rp.permission.action}`);
      }
    }

    // ── Capacidad POS por empleado ──────────────────────────────────────────
    // Además de los permisos heredados de sus roles, un empleado puede tener el
    // flag `posEnabled` (lo activa el admin desde la consola). Cuando está
    // activo le inyectamos los permisos mínimos para operar el Punto de Venta,
    // SIN tener que crearle un rol especial. Como getUserPermissions es el
    // único origen de verdad de los permisos efectivos (lo usan el
    // PermissionGuard de cada request y getMe), basta inyectarlos aquí para que
    // backend y frontend queden coherentes. Para Owner/freelancer es no-op
    // (ya tienen estos permisos vía su rol).
    const employee = await this.prisma.employee.findFirst({
      where: { userId, tenantId },
      select: { posEnabled: true },
    });
    if (employee?.posEnabled) {
      for (const p of [
        'payments.create',
        'payments.read',
        'inventory.read',
        'promotions.read',
      ]) {
        permissionsSet.add(p);
      }
    }

    // Array.from(set) convierte el Set en un arreglo normal de strings, que es lo
    // que esperan quienes llaman a esta función (ej. el PermissionGuard).
    return Array.from(permissionsSet);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // hasPermission(): pregunta sí/no => ¿el usuario tiene UN permiso concreto?
  // Recibe userId, tenantId y el permiso buscado (ej. "roles.delete").
  // Devuelve Promise<boolean> (true = lo tiene, false = no).
  // ───────────────────────────────────────────────────────────────────────────
  async hasPermission(
    userId: string,
    tenantId: string,
    permission: string,
  ): Promise<boolean> {
    // Primero obtenemos TODOS los permisos efectivos del usuario (función de arriba).
    const permissions = await this.getUserPermissions(userId, tenantId);
    // includes(x) devuelve true si "x" está dentro del arreglo. Aquí: ¿la lista de
    // permisos del usuario contiene exactamente el permiso pedido?
    return permissions.includes(permission);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // findAllRoles(): lista todos los roles de un negocio, cada uno con sus permisos
  // y con un CONTEO de cuántos usuarios lo tienen asignado.
  // ───────────────────────────────────────────────────────────────────────────
  async findAllRoles(tenantId: string) {
    // findMany de roles, filtrado por negocio (multi-tenant).
    return this.prisma.role.findMany({
      where: { tenantId },
      include: {
        // Trae los permisos de cada rol (rolePermissions -> permission).
        rolePermissions: {
          include: { permission: true },
        },
        // _count = atajo de Prisma para contar registros relacionados sin traerlos
        // todos. Aquí cuenta cuántos userRoles (asignaciones) tiene el rol, es
        // decir, a cuántos usuarios se les asignó. Útil para mostrar "N usuarios".
        _count: { select: { userRoles: true } },
      },
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // findAllPermissions(): devuelve TODOS los permisos del sistema, pero AGRUPADOS
  // por módulo, en un objeto tipo { "roles": [...], "appointments": [...], ... }.
  // Más cómodo para pintar la UI (una sección por módulo).
  // ───────────────────────────────────────────────────────────────────────────
  async findAllPermissions() {
    // Traemos todos los permisos ordenados primero por módulo y luego por acción,
    // ambos de forma ascendente ('asc' = de la A a la Z). Así salen ordenaditos.
    const permissions = await this.prisma.permission.findMany({
      orderBy: [{ module: 'asc' }, { action: 'asc' }],
    });

    // Agrupar por módulo (Group by module).
    // reduce() recorre la lista y la "reduce" a un solo valor: aquí, un objeto
    // donde cada clave es un módulo y su valor es la lista de permisos de ese módulo.
    //   - "acc" = acumulador (el objeto que vamos construyendo, empieza vacío {}).
    //   - "perm" = cada permiso de la lista en cada vuelta.
    const grouped = permissions.reduce(
      (acc, perm) => {
        // Si en el acumulador todavía NO existe una entrada para este módulo
        // (!acc[perm.module] => "si no hay nada ahí"), creamos un arreglo vacío
        // para ese módulo, listo para ir metiendo sus permisos.
        if (!acc[perm.module]) {
          acc[perm.module] = [];
        }
        // Metemos (push) este permiso dentro del arreglo de su módulo.
        acc[perm.module].push(perm);
        // Devolvemos el acumulador para la siguiente vuelta del reduce.
        return acc;
      },
      // Valor inicial del acumulador: un objeto vacío.
      // "{} as Record<string, typeof permissions>" le dice a TypeScript que ese
      // objeto tendrá claves string y, por valor, listas del mismo tipo que
      // "permissions" (un mapa módulo -> lista de permisos).
      {} as Record<string, typeof permissions>,
    );

    // Devolvemos el objeto agrupado.
    return grouped;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // createRole(): crea un rol nuevo en un negocio, con sus permisos iniciales.
  // Recibe el tenantId (negocio) y el dto con los datos validados.
  // ───────────────────────────────────────────────────────────────────────────
  async createRole(tenantId: string, dto: CreateRoleDto) {
    // Generamos un "slug": una versión del nombre apta para URLs/identificadores.
    //   - toLowerCase() => todo a minúsculas ("Mi Rol" -> "mi rol").
    //   - replace(/\s+/g, '-') => sustituye espacios por guiones. La expresión
    //     regular /\s+/g: "\s" = cualquier espacio en blanco, "+" = uno o más
    //     seguidos, "g" (global) = reemplazar TODAS las apariciones, no solo la 1ª.
    //   Resultado: "Mi Rol" -> "mi-rol".
    const slug = dto.name.toLowerCase().replace(/\s+/g, '-');
    // Creamos el rol en la base de datos.
    const role = await this.prisma.role.create({
      data: {
        name: dto.name,
        slug,
        description: dto.description,
        tenantId,
        // isSystem: false => es un rol creado por el usuario, NO uno del sistema.
        // Los roles del sistema (isSystem: true) no se pueden editar ni borrar.
        isSystem: false,
        // Permisos iniciales del rol. Aquí hay un OPERADOR TERNARIO (cond ? A : B):
        //   - "dto.permissionIds?.length": el "?." (optional chaining) evita un
        //     error si permissionIds es undefined; ".length" es la cantidad. Un
        //     número distinto de 0 se considera "verdadero", y 0/undefined "falso".
        //   - Si HAY permisos => creamos las filas intermedias rolePermission.
        //     ".map(...)" recorre cada id de permiso y lo transforma en un objeto
        //     { permissionId: permId } que Prisma usará para crear la relación.
        //   - Si NO hay permisos => "undefined": no creamos ninguna relación.
        rolePermissions: dto.permissionIds?.length
          ? {
              create: dto.permissionIds.map((permId) => ({
                permissionId: permId,
              })),
            }
          : undefined,
      },
      // Tras crear, devolvemos el rol con sus permisos ya incluidos (para que el
      // frontend reciba el rol completo sin pedir otra consulta).
      include: {
        rolePermissions: { include: { permission: true } },
      },
    });
    return role;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // updateRole(): actualiza nombre/descripción y (opcionalmente) los permisos de
  // un rol. Recibe el id del rol, el negocio y los campos a cambiar.
  // ───────────────────────────────────────────────────────────────────────────
  async updateRole(id: string, tenantId: string, dto: UpdateRoleDto) {
    // findFirst = "encuentra el primer registro que cumpla". Buscamos el rol por
    // su id PERO también filtrando por tenantId: así un negocio no puede tocar
    // roles de otro negocio (seguridad multi-tenant).
    const role = await this.prisma.role.findFirst({
      where: { id, tenantId },
    });

    // Si no se encontró (role es null) => "!role" es verdadero => error 404.
    if (!role) {
      throw new NotFoundException('Rol no encontrado');
    }

    // Si el rol es del sistema (isSystem true), no se permite modificarlo => 400.
    if (role.isSystem) {
      throw new BadRequestException('No se pueden modificar los roles del sistema');
    }

    // Actualizar permisos solo si vinieron en la petición (Update permissions if provided).
    // "!== undefined" => distinto de undefined. Distinguimos dos casos:
    //   - undefined: el cliente NO mandó permissionIds => no tocamos los permisos.
    //   - [] (lista vacía): el cliente SÍ lo mandó vacío => quiere QUITAR todos.
    if (dto.permissionIds !== undefined) {
      // Estrategia "reemplazar": borramos TODAS las relaciones de permiso actuales
      // del rol (deleteMany) y luego creamos las nuevas. Más simple que comparar.
      await this.prisma.rolePermission.deleteMany({ where: { roleId: id } });
      // Si la lista trae al menos un permiso (length > 0), creamos las relaciones.
      // Si está vacía, no creamos nada (el rol se queda sin permisos).
      if (dto.permissionIds.length > 0) {
        await this.prisma.rolePermission.createMany({
          // map() transforma cada id de permiso en una fila { roleId, permissionId }
          // de la tabla intermedia que une rol y permiso.
          data: dto.permissionIds.map((permId) => ({
            roleId: id,
            permissionId: permId,
          })),
        });
      }
    }

    // Finalmente actualizamos los datos básicos del rol y devolvemos el rol ya
    // actualizado con sus permisos incluidos. (Si name o description son undefined,
    // Prisma simplemente no cambia esos campos.)
    return this.prisma.role.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
      },
      include: {
        rolePermissions: { include: { permission: true } },
      },
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // deleteRole(): elimina un rol del negocio. Recibe el id del rol y el negocio.
  // ───────────────────────────────────────────────────────────────────────────
  async deleteRole(id: string, tenantId: string) {
    // Buscamos el rol asegurando que pertenece a este negocio.
    const role = await this.prisma.role.findFirst({
      where: { id, tenantId },
    });

    // Si no existe => 404.
    if (!role) {
      throw new NotFoundException('Rol no encontrado');
    }

    // Los roles del sistema están protegidos: no se pueden eliminar => 400.
    if (role.isSystem) {
      throw new BadRequestException('No se pueden eliminar los roles del sistema');
    }

    // Borramos el rol. (Sus relaciones rolePermission/userRole suelen borrarse en
    // cascada según la configuración del esquema Prisma.)
    await this.prisma.role.delete({ where: { id } });
    // Devolvemos un mensaje simple de confirmación.
    return { message: 'Rol eliminado' };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // assignRole(): asigna un rol a un usuario (crea la fila userRole). Recibe el
  // negocio y el dto con { userId, roleId }.
  // ───────────────────────────────────────────────────────────────────────────
  async assignRole(tenantId: string, dto: AssignRoleDto) {
    // 1) Verificar que el rol pertenece al negocio (Verify role belongs to tenant).
    const role = await this.prisma.role.findFirst({
      where: { id: dto.roleId, tenantId },
    });
    // "if (!role) throw ..." en una sola línea: si no existe el rol => 404.
    if (!role) throw new NotFoundException('Rol no encontrado');

    // 2) Verificar que el usuario pertenece al negocio (Verify user belongs to tenant).
    const user = await this.prisma.user.findFirst({
      where: { id: dto.userId, tenantId },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    // 3) Evitar duplicados (Check not already assigned): buscamos si ya existe una
    // asignación de ESE rol a ESE usuario.
    const existing = await this.prisma.userRole.findFirst({
      where: { userId: dto.userId, roleId: dto.roleId },
    });
    // Si ya existía => no la repetimos => 400 con mensaje claro.
    if (existing) throw new BadRequestException('El rol ya está asignado');

    // Si todo está bien, creamos la asignación (une usuario + rol dentro del negocio).
    return this.prisma.userRole.create({
      data: { userId: dto.userId, roleId: dto.roleId, tenantId },
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // removeRole(): quita una asignación de rol. OJO: "userRoleId" es el id de la
  // ASIGNACIÓN (fila userRole), no el id del usuario ni el del rol.
  // ───────────────────────────────────────────────────────────────────────────
  async removeRole(userRoleId: string, tenantId: string) {
    // Buscamos la asignación por su id, pero comprobando además que el ROL de esa
    // asignación pertenece a este negocio. "role: { tenantId }" es un filtro sobre
    // la tabla relacionada (role): solo coincide si el rol asociado es del negocio.
    const userRole = await this.prisma.userRole.findFirst({
      where: { id: userRoleId, role: { tenantId } },
    });
    // Si no existe esa asignación (o no es de este negocio) => 404.
    if (!userRole) throw new NotFoundException('Asignación de rol no encontrada');

    // Borramos la asignación: el usuario pierde los permisos que le daba ese rol.
    await this.prisma.userRole.delete({ where: { id: userRoleId } });
    // Mensaje de confirmación.
    return { message: 'Rol eliminado' };
  }
}
