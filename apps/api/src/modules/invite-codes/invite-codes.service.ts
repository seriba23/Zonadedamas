// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// De NestJS importamos "Injectable": un decorador (etiqueta "@") que marca esta
// clase como un "servicio" que NestJS puede crear e inyectar en otras clases
// (por ejemplo, en el controlador).
import { Injectable } from '@nestjs/common';

// PrismaService es nuestro "puente" hacia la base de datos. Prisma es la
// herramienta (ORM) que convierte llamadas de JavaScript en consultas SQL.
// A través de this.prisma leeremos/escribiremos tablas como tenantInviteCode.
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Servicio de "Códigos de invitación".
 *
 * Un negocio (tenant) genera un código corto (8 caracteres). Ese código se le
 * comparte a un empleado para que pueda unirse al negocio. Cada código puede
 * limitar el puesto (jobTitle), los servicios que el empleado podrá ofrecer,
 * cuántas veces se puede usar (maxUses) y cuándo caduca (expiresAt).
 *
 * Aquí vive la lógica: crear, listar y desactivar códigos.
 */
@Injectable() // <- Marca la clase como servicio inyectable de NestJS.
export class InviteCodesService {
  // El constructor recibe el PrismaService que NestJS inyecta automáticamente.
  // "private readonly prisma" lo guarda como propiedad (this.prisma) de solo
  // lectura, para usarlo en todos los métodos de abajo.
  constructor(private readonly prisma: PrismaService) {}

  // ───────────────────────────────────────────────────────────────────────────
  // create(): crea un nuevo código de invitación para un negocio.
  //   - tenantId   : id del negocio dueño del código (obligatorio).
  //   - jobTitle?  : puesto sugerido para quien use el código (opcional; el "?"
  //                  significa que puede no venir).
  //   - serviceIds?: lista de ids de servicios que el empleado podrá ofrecer
  //                  (opcional).
  //   - maxUses?   : número máximo de usos del código (opcional; 0 = ilimitado).
  //   - expiresAt? : fecha en la que el código caduca (opcional).
  // Devuelve el código recién creado, junto con sus servicios asociados.
  // ───────────────────────────────────────────────────────────────────────────
  async create(tenantId: string, jobTitle?: string, serviceIds?: string[], maxUses?: number, expiresAt?: Date) {
    // Generamos el texto aleatorio del código (ej. "K7P2QW9M"). Ver generateCode().
    const code = this.generateCode();

    // Creamos la fila principal del código en la tabla tenantInviteCode.
    const inviteCode = await this.prisma.tenantInviteCode.create({
      data: {
        tenantId, // a qué negocio pertenece
        code,     // el texto aleatorio generado arriba
        // "jobTitle || null": si jobTitle vino vacío/undefined, el "||" usa null
        // en su lugar (en la base de datos guardamos null, no "undefined").
        jobTitle: jobTitle || null,
        // "maxUses || 0": si no se indicó un máximo, usamos 0 (que aquí significa
        // "sin límite de usos").
        maxUses: maxUses || 0,
        // "expiresAt || null": si no se indicó fecha de caducidad, guardamos null
        // (el código no caduca).
        expiresAt: expiresAt || null,
      },
    });

    // ¿Nos pasaron una lista de servicios para asociar al código?
    // La condición tiene dos partes unidas por "&&" (Y): ambas deben ser ciertas.
    //   1) "serviceIds" existe (no es undefined/null).
    //   2) "serviceIds.length > 0" => la lista trae al menos un servicio.
    if (serviceIds && serviceIds.length > 0) {
      // createMany = inserta VARIAS filas de golpe en la tabla intermedia
      // tenantInviteCodeService (la que une un código con sus servicios).
      await this.prisma.tenantInviteCodeService.createMany({
        // map() recorre cada id de la lista "serviceIds" y, por cada uno,
        // construye un objeto fila { inviteCodeId, serviceId }. El resultado es
        // una nueva lista de objetos lista para insertar.
        data: serviceIds.map((serviceId) => ({
          inviteCodeId: inviteCode.id, // id del código recién creado arriba
          serviceId,                   // id del servicio actual del recorrido
        })),
        // skipDuplicates = si alguna combinación ya existiera, la salta en vez de
        // lanzar un error (evita reventar por duplicados).
        skipDuplicates: true,
      });
    }

    // Volvemos a leer el código recién creado, pero ahora pidiendo también sus
    // servicios asociados, para devolverlo completo a quien llamó.
    return this.prisma.tenantInviteCode.findUnique({
      where: { id: inviteCode.id }, // buscamos por el id que acabamos de crear
      // "include" = además del código, trae datos de tablas relacionadas.
      //   - services = las filas de la tabla intermedia,
      //   - y dentro de cada una, "service" = el servicio en sí, del que solo
      //     elegimos (select) su id y su nombre.
      include: { services: { include: { service: { select: { id: true, name: true } } } } },
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // findAll(): devuelve todos los códigos ACTIVOS de un negocio.
  //   - tenantId: id del negocio del que queremos listar los códigos.
  // ───────────────────────────────────────────────────────────────────────────
  async findAll(tenantId: string) {
    // findMany = "encuentra MUCHOS registros" que cumplan las condiciones.
    return this.prisma.tenantInviteCode.findMany({
      // where = condiciones: del negocio indicado y que sigan activos
      // (isActive: true). Así no mostramos los que ya fueron desactivados.
      where: { tenantId, isActive: true },
      // Igual que en create(), traemos los servicios asociados de cada código.
      include: { services: { include: { service: { select: { id: true, name: true } } } } },
      // orderBy = orden del resultado. "createdAt: 'desc'" = del más reciente al
      // más antiguo (desc = descendente).
      orderBy: { createdAt: 'desc' },
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // deactivate(): desactiva (no borra) un código de invitación.
  //   - id      : id del código a desactivar.
  //   - tenantId: id del negocio dueño (por seguridad multi-tenant: que un
  //               negocio no pueda desactivar códigos de otro).
  // ───────────────────────────────────────────────────────────────────────────
  async deactivate(id: string, tenantId: string) {
    // updateMany = actualiza todas las filas que cumplan el "where". Lo usamos
    // (en vez de update) porque el filtro incluye tenantId además del id: si el
    // código no es de ese negocio, no coincide ninguna fila y no se cambia nada
    // (sin lanzar error). Marcamos isActive en false para "apagar" el código.
    return this.prisma.tenantInviteCode.updateMany({
      where: { id, tenantId },     // qué código y de qué negocio
      data: { isActive: false },   // lo dejamos inactivo
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // generateCode(): crea el texto aleatorio del código (8 caracteres).
  // Es "private": solo se usa dentro de este servicio, no se expone fuera.
  // Devuelve un string como "K7P2QW9M".
  // ───────────────────────────────────────────────────────────────────────────
  private generateCode(): string {
    // Conjunto de caracteres permitidos. Nota: NO incluye caracteres ambiguos
    // como 0/O, 1/I/L para que el código sea fácil de leer y de dictar a viva voz.
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    // Aquí iremos acumulando el código. Empieza vacío.
    let code = '';
    // BUCLE FOR: se repite 8 veces (i va de 0 a 7), una por cada carácter.
    for (let i = 0; i < 8; i++) {
      // En cada vuelta elegimos un carácter al azar:
      //   - Math.random() da un número decimal entre 0 (incluido) y 1 (excluido).
      //   - Multiplicado por chars.length lo lleva al rango [0, 32).
      //   - Math.floor() lo redondea hacia abajo a un entero (0..31).
      //   - chars[...] toma el carácter en esa posición.
      // "+=" añade ese carácter al final de "code".
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    // Devolvemos el código completo de 8 caracteres.
    return code;
  }
}
