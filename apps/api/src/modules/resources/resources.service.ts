// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// De NestJS importamos:
//   - Injectable: decorador (etiqueta "@") que marca esta clase como un
//     "servicio" inyectable, que NestJS puede crear y pasar a otras clases.
//   - NotFoundException: error listo para usar que hace que la API responda con
//     código HTTP 404 (no encontrado) cuando se lanza.
import { Injectable, NotFoundException } from '@nestjs/common';

// "Prisma" es un objeto de utilidades del cliente de base de datos. Aquí lo
// usamos sobre todo por "Prisma.JsonNull", el valor especial que indica "guarda
// NULL en una columna de tipo JSON" (no se puede usar un null normal de JS ahí).
import { Prisma } from '@prisma/client';

// PrismaService es nuestro "puente" hacia la base de datos. A través de
// this.prisma leemos/escribimos tablas (resource, location, etc.).
import { PrismaService } from '../../prisma/prisma.service';

// Los DTO (moldes de datos) para crear y actualizar un recurso, con sus reglas
// de validación. Aquí los usamos solo como TIPOS de los parámetros.
import { CreateResourceDto, UpdateResourceDto } from './dto/create-resource.dto';

// Utilidades de paginación compartidas:
//   - PaginationDto: el tipo que trae los parámetros de página (page, perPage).
//   - buildPaginatedResponse: función que arma la respuesta paginada estándar
//     (los datos + metadatos como total de elementos, página actual, etc.).
import { PaginationDto, buildPaginatedResponse } from '../../common/dto/pagination.dto';

// @Injectable() => marca la clase como servicio inyectable de NestJS.
@Injectable()
export class ResourcesService {
  // El constructor recibe el PrismaService que NestJS inyecta automáticamente.
  // "private readonly prisma" lo guarda como propiedad de solo lectura
  // (this.prisma) para usarlo en todos los métodos de abajo.
  constructor(private readonly prisma: PrismaService) {}

  // ───────────────────────────────────────────────────────────────────────────
  // findAll(): lista los recursos del negocio, paginados. Puede filtrar además
  // por el empleado al que están asignados (assignedTo).
  //   - tenantId: id del negocio (para que solo veamos SUS recursos).
  //   - pagination: trae page/perPage para saber qué "página" devolver.
  //   - assignedTo: (opcional) id del empleado para filtrar solo sus recursos.
  // Devuelve una respuesta paginada con la lista y los metadatos.
  // ───────────────────────────────────────────────────────────────────────────
  async findAll(tenantId: string, pagination: PaginationDto, assignedTo?: string) {
    // page = número de página a mostrar. "??" (operador de fusión de nulos)
    // significa: "usa pagination.page; pero si es null/undefined, usa 1".
    const page = pagination.page ?? 1;
    // perPage = cuántos elementos por página. Si no viene, usamos 20 por defecto.
    const perPage = pagination.perPage ?? 20;
    // skip = cuántos registros SALTAR antes de empezar a leer. Para la página 1
    // saltamos 0; para la 2 saltamos perPage; etc. Fórmula: (página - 1) * porPágina.
    const skip = (page - 1) * perPage;

    // "where" arma las condiciones de la búsqueda. Empezamos filtrando SIEMPRE
    // por el negocio (tenantId): regla multi-tenant, cada negocio ve solo lo suyo.
    // El ": any" relaja el tipado para poder añadir campos dinámicamente abajo.
    const where: any = { tenantId };
    // Si nos pasaron un empleado (assignedTo es "verdadero", es decir, no vacío),
    // agregamos esa condición para filtrar solo los recursos de ese empleado.
    if (assignedTo) where.assignedTo = assignedTo;

    // Promise.all([...]) ejecuta varias consultas EN PARALELO y espera a que
    // TODAS terminen. Aquí lanzamos dos a la vez (la lista y el conteo total) y
    // con la desestructuración "[data, total]" guardamos cada resultado en su
    // variable. Hacerlas en paralelo es más rápido que una tras otra.
    const [data, total] = await Promise.all([
      // 1) findMany = trae MUCHOS registros (la página actual de recursos).
      this.prisma.resource.findMany({
        where,                       // mismas condiciones de filtro
        skip,                        // salta los de páginas anteriores
        take: perPage,               // toma como máximo "perPage" registros
        orderBy: { name: 'asc' },    // ordena por nombre de A a Z (ascendente)
        include: {
          // include trae también datos de la sucursal relacionada, pero con
          // "select" pedimos solo su id y nombre (no toda la fila).
          location: { select: { id: true, name: true } },
        },
      }),
      // 2) count = cuenta CUÁNTOS recursos cumplen el mismo filtro (sin paginar).
      // Lo necesitamos para saber cuántas páginas hay en total.
      this.prisma.resource.count({ where }),
    ]);

    // Empaquetamos la lista (data) y el total en la respuesta paginada estándar.
    return buildPaginatedResponse(data, total, pagination);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // findOne(): busca UN recurso por su id (dentro del negocio) con todo el
  // detalle. Si no existe, lanza 404.
  //   - id: id del recurso buscado.
  //   - tenantId: id del negocio (para no ver recursos de otros negocios).
  // ───────────────────────────────────────────────────────────────────────────
  async findOne(id: string, tenantId: string) {
    // findFirst = trae el PRIMER registro que cumpla las condiciones. Filtramos
    // por id Y por tenantId a la vez (ambos deben coincidir) por seguridad.
    const resource = await this.prisma.resource.findFirst({
      where: { id, tenantId },
      include: {
        // location: true => trae TODOS los campos de la sucursal relacionada.
        location: true,
        // serviceResources = la tabla puente que une recursos con servicios.
        // Con su "include: { service: true }" traemos también, dentro de cada
        // enlace, los datos del servicio asociado.
        serviceResources: { include: { service: true } },
      },
    });
    // Si "resource" es null (no se encontró), "!resource" es verdadero -> 404.
    if (!resource) throw new NotFoundException('Recurso no encontrado');
    // Si existe, lo devolvemos con todo su detalle.
    return resource;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // create(): crea un recurso nuevo para el negocio.
  //   - tenantId: id del negocio dueño del recurso.
  //   - dto: los datos validados del recurso a crear (CreateResourceDto).
  // ───────────────────────────────────────────────────────────────────────────
  async create(tenantId: string, dto: CreateResourceDto) {
    // VALIDACIÓN: la sucursal indicada debe existir y pertenecer a ESTE negocio.
    const location = await this.prisma.location.findFirst({
      where: { id: dto.locationId, tenantId },
    });
    // Si no se encontró la sucursal -> error 404.
    if (!location) throw new NotFoundException('Ubicación no encontrada');

    // ── CÁLCULO AUTOMÁTICO DE LA CANTIDAD TOTAL ──
    // locQty = el reparto por sucursal si vino; si no, null.
    // "dto.locationQuantities || null": el "||" devuelve el primer valor
    // "verdadero"; si locationQuantities es undefined/null, usa null.
    const locQty = dto.locationQuantities || null;
    // quantity = la cantidad total. Operador ternario (condición ? siVerdad : siFalso):
    //   - SI hay reparto por sucursal (locQty), sumamos todas sus cantidades:
    //       Object.values(locQty) => saca solo los VALORES del objeto (los números).
    //       .reduce((sum, q) => sum + q, 0) recorre esos números y los va
    //       acumulando en "sum" (empezando en 0) -> la suma total.
    //   - SI NO hay reparto, usamos dto.quantity; y si tampoco vino, usamos 1
    //       gracias a "?? 1" (fusión de nulos).
    const quantity = locQty
      ? Object.values(locQty).reduce((sum, q) => sum + q, 0)
      : (dto.quantity ?? 1);

    // Creamos el registro en la tabla "resource" con todos los datos.
    return this.prisma.resource.create({
      data: {
        name: dto.name,                  // nombre del recurso
        description: dto.description,     // descripción libre
        notes: dto.notes,                // notas internas
        type: dto.type,                  // tipo/categoría
        imageUrl: dto.imageUrl,          // imagen principal
        value: dto.value,                // valor/costo
        quantity,                        // cantidad total (calculada arriba)
        // locationQuantities: el reparto por sucursal. Si locQty es null, usamos
        // "Prisma.JsonNull" (el null especial para columnas JSON), porque un null
        // normal de JS no es válido en un campo JSON de Prisma. "??" => si locQty
        // es null/undefined, usa Prisma.JsonNull.
        locationQuantities: locQty ?? Prisma.JsonNull,
        serialNumber: dto.serialNumber,  // número de serie
        brand: dto.brand,                // marca
        // condition: estado físico. "dto.condition || 'good'" => si no vino un
        // estado, usamos 'good' (bueno) por defecto.
        condition: dto.condition || 'good',
        // assignedTo: empleado asignado. "|| null" => si no vino, queda sin asignar.
        assignedTo: dto.assignedTo || null,
        // assignedAt: fecha en que se asignó. Ternario: si HAY empleado asignado,
        // guardamos el momento actual (new Date()); si no, null.
        assignedAt: dto.assignedTo ? new Date() : null,
        // purchaseDate: fecha de compra. Ternario: si vino el texto de fecha, le
        // pegamos "T00:00:00Z" para convertirlo a una fecha real a medianoche UTC;
        // si no vino, null.
        purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate + 'T00:00:00Z') : null,
        locationId: dto.locationId,      // sucursal donde vive el recurso
        tenantId,                        // negocio dueño (regla multi-tenant)
        // isActive: activo por defecto. "?? true" => si no vino, queda en true.
        isActive: dto.isActive ?? true,
      },
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // update(): actualiza un recurso existente con los campos que envíe el cliente.
  //   - id: id del recurso a editar.
  //   - tenantId: id del negocio (seguridad multi-tenant).
  //   - dto: los cambios a aplicar (UpdateResourceDto, todos opcionales).
  // ───────────────────────────────────────────────────────────────────────────
  async update(id: string, tenantId: string, dto: UpdateResourceDto) {
    // Primero confirmamos que el recurso existe y es de este negocio. findOne ya
    // lanza 404 si no lo encuentra. Guardamos su versión actual en "existing".
    const existing = await this.findOne(id, tenantId);

    // "data" arranca como una COPIA de todos los campos del dto.
    // El "...dto" (spread) copia propiedad por propiedad. Luego ajustamos algunos
    // campos especiales abajo. ": any" relaja el tipado para poder modificarlo.
    const data: any = { ...dto };

    // ── MANEJO DEL CAMBIO DE ASIGNACIÓN (assignedTo) ──
    // "'assignedTo' in dto" comprueba si el cliente INCLUYÓ ese campo en la
    // petición (aunque sea para ponerlo en null). Solo entramos si vino.
    if ('assignedTo' in dto) {
      // Normalizamos: si vino vacío/null, queda en null (sin asignar).
      data.assignedTo = dto.assignedTo || null;
      // "!==" es "estrictamente distinto" (compara valor Y tipo, sin convertir).
      // Si el empleado asignado CAMBIÓ respecto al que ya tenía el recurso...
      if (dto.assignedTo !== (existing as any).assignedTo) {
        // ...actualizamos la fecha de asignación: ahora si hay empleado, o null
        // si se desasignó.
        data.assignedAt = dto.assignedTo ? new Date() : null;
      }
    }

    // ── MANEJO DE LA FECHA DE COMPRA (purchaseDate) ──
    // "!== undefined" => solo si el cliente envió este campo (aunque sea vacío).
    if (dto.purchaseDate !== undefined) {
      // Si trae texto, lo convertimos a fecha real (medianoche UTC); si vino
      // vacío, lo dejamos en null.
      data.purchaseDate = dto.purchaseDate ? new Date(dto.purchaseDate + 'T00:00:00Z') : null;
    }

    // ── RECÁLCULO AUTOMÁTICO DE LA CANTIDAD TOTAL ──
    // Si el cliente mandó un nuevo reparto por sucursal, recalculamos la cantidad
    // total sumando todos sus valores (mismo patrón reduce que en create()).
    if (dto.locationQuantities) {
      data.quantity = Object.values(dto.locationQuantities as Record<string, number>).reduce((sum, q) => sum + q, 0);
    }

    // Guardamos los cambios en la base de datos para el recurso con ese id.
    return this.prisma.resource.update({
      where: { id },
      data,
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // remove(): "borrado lógico" (soft delete) de un recurso. No lo elimina de la
  // base de datos; solo lo marca como inactivo (isActive: false) para que deje
  // de mostrarse, pero se conserve el historial.
  //   - id: id del recurso a desactivar.
  //   - tenantId: id del negocio (seguridad multi-tenant).
  // ───────────────────────────────────────────────────────────────────────────
  async remove(id: string, tenantId: string) {
    // Confirmamos que existe y es de este negocio (findOne lanza 404 si no).
    await this.findOne(id, tenantId);
    // Lo marcamos como inactivo en vez de borrarlo de verdad.
    await this.prisma.resource.update({
      where: { id },
      data: { isActive: false },
    });
    // Devolvemos un mensaje simple confirmando la desactivación.
    return { message: 'Recurso desactivado' };
  }
}
