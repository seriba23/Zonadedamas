// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS: traemos "piezas" de otras librerías/archivos para usarlas aquí.
// ─────────────────────────────────────────────────────────────────────────────

// De NestJS importamos dos cosas:
//   - Injectable: decorador (etiqueta "@") que marca esta clase como un
//     "servicio" que NestJS puede crear e inyectar en otras clases.
//   - NotFoundException: error listo para usar que, al lanzarse, hace que la
//     API responda con código HTTP 404 (recurso no encontrado).
import { Injectable, NotFoundException } from '@nestjs/common';

// PrismaService es nuestro "puente" hacia la base de datos. Prisma es la
// herramienta (ORM) que convierte llamadas de JavaScript en consultas SQL.
// A través de this.prisma podremos leer/escribir tablas como supplier (proveedor).
import { PrismaService } from '../../prisma/prisma.service';

// AuditService = servicio de auditoría. Lo usamos para dejar registro (bitácora)
// de cada operación de escritura (crear/editar/desactivar) en el audit_log.
import { AuditService } from '../audit/audit.service';

// DTOs (Data Transfer Objects): definen la "forma" de los datos que entran.
//   - CreateSupplierDto: campos válidos al CREAR un proveedor.
//   - UpdateSupplierDto: campos válidos al EDITAR un proveedor (todos opcionales).
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

@Injectable() // <- Marca la clase como servicio inyectable de NestJS.
export class SuppliersService {
  // CONSTRUCTOR + INYECCIÓN DE DEPENDENCIAS:
  // NestJS crea automáticamente las instancias de PrismaService y AuditService
  // y nos las "inyecta" aquí. El "private" las guarda como propiedades de la
  // clase (this.prisma, this.audit) para poder usarlas en todos los métodos.
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  // ───────────────────────────────────────────────────────────────────────────
  // findAll(): lista los proveedores de un negocio (tenant) con paginación y un
  // filtro opcional por estado (activo/inactivo).
  //   - Recibe: tenantId (id del negocio) y un objeto "query" con page, perPage
  //     e isActive (todos opcionales).
  //   - Devuelve: { data: [...proveedores], meta: {...info de paginación} }.
  // ───────────────────────────────────────────────────────────────────────────
  async findAll(
    tenantId: string,
    query: { page?: number; perPage?: number; isActive?: boolean },
  ) {
    // PÁGINA ACTUAL: Math.max(1, ...) garantiza que nunca sea menor que 1.
    // "query.page || 1": si page viene undefined/0 (valor "falsy"), usa 1.
    const page = Math.max(1, query.page || 1);
    // CANTIDAD POR PÁGINA: Math.min(100, ...) la limita a 100 como máximo, y
    // Math.max(1, ...) a 1 como mínimo. Si perPage no viene, usa 20 por defecto.
    const perPage = Math.min(100, Math.max(1, query.perPage || 20));
    // SKIP = cuántos registros saltar antes de empezar a leer.
    // Ej.: página 3 con 20 por página => saltar (3-1)*20 = 40 registros.
    const skip = (page - 1) * perPage;

    // "where" = condiciones de la búsqueda. Lo tipamos como "any" para poder
    // agregarle propiedades después sin que TypeScript se queje.
    // SIEMPRE filtramos por tenantId (regla multi-tenant: cada negocio solo ve
    // lo suyo).
    const where: any = { tenantId };
    // Solo si el filtro isActive viene definido (!== undefined significa
    // "es distinto de undefined", o sea: "sí lo enviaron") lo añadimos al where.
    // Nota: usamos !== undefined (y no un simple "if (query.isActive)") porque
    // "false" también es un valor válido que queremos respetar.
    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    // Promise.all ejecuta las DOS consultas EN PARALELO (a la vez) y espera a que
    // ambas terminen. Es más rápido que hacerlas una tras otra.
    // Con desestructuración guardamos: el primer resultado en "data" (la lista)
    // y el segundo en "total" (el conteo).
    const [data, total] = await Promise.all([
      // 1) findMany = trae MUCHOS registros (la lista de proveedores de esta página).
      this.prisma.supplier.findMany({
        where, // mismas condiciones (tenant + filtro)
        // "include" = además del proveedor, trae datos relacionados.
        include: {
          // _count cuenta filas relacionadas sin traerlas todas: aquí cuántos
          // productos tiene cada proveedor (lo expone como _count.products).
          _count: { select: { products: true } },
        },
        // orderBy = ordenar. 'desc' = descendente => los más recientes primero.
        orderBy: { createdAt: 'desc' },
        skip, // saltar los de páginas anteriores
        take: perPage, // tomar como máximo "perPage" registros
      }),
      // 2) count = cuenta el TOTAL de proveedores que cumplen el "where"
      //    (ignora la paginación; sirve para calcular el número de páginas).
      this.prisma.supplier.count({ where }),
    ]);

    // Devolvemos la respuesta en el formato estándar del proyecto: data + meta.
    return {
      data,
      meta: {
        total, // total de proveedores
        page, // página actual
        perPage, // cuántos por página
        // totalPages = total dividido entre perPage, redondeado HACIA ARRIBA con
        // Math.ceil (ej.: 41 proveedores / 20 = 2.05 => 3 páginas).
        totalPages: Math.ceil(total / perPage),
      },
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // findOne(): busca UN proveedor concreto por su id, dentro del negocio (tenant).
  //   - Recibe: tenantId y el id del proveedor.
  //   - Devuelve: { data: proveedor } o lanza 404 si no existe.
  // ───────────────────────────────────────────────────────────────────────────
  async findOne(tenantId: string, id: string) {
    // findFirst = trae el PRIMER registro que cumpla las condiciones.
    // Filtramos por id Y tenantId a la vez (seguridad multi-tenant: así un
    // negocio no puede leer el proveedor de otro aunque adivine su id).
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, tenantId },
      include: {
        // También traemos cuántos productos tiene asociados.
        _count: { select: { products: true } },
      },
    });
    // "!supplier" se lee "si NO hay proveedor" (findFirst devolvió null) => 404.
    if (!supplier) throw new NotFoundException('Supplier not found');
    // Si existe, lo devolvemos envuelto en { data }.
    return { data: supplier };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // create(): crea un nuevo proveedor y deja registro en la auditoría.
  //   - Recibe: tenantId, dto (datos validados del proveedor) y userId opcional
  //     (quién lo crea; el "?" en "userId?" lo marca como opcional).
  //   - Devuelve: { data: proveedor recién creado }.
  // ───────────────────────────────────────────────────────────────────────────
  async create(tenantId: string, dto: CreateSupplierDto, userId?: string) {
    // create = inserta UNA fila nueva en la tabla supplier.
    const supplier = await this.prisma.supplier.create({
      data: {
        tenantId, // a qué negocio pertenece
        name: dto.name, // nombre del proveedor (obligatorio)
        contactName: dto.contactName, // persona de contacto (opcional)
        email: dto.email, // correo (opcional)
        phone: dto.phone, // teléfono (opcional)
        address: dto.address, // dirección (opcional)
        notes: dto.notes, // notas internas (opcional)
      },
      include: {
        // Traemos también el conteo de productos (será 0 recién creado).
        _count: { select: { products: true } },
      },
    });

    // AUDITORÍA: guardamos en la bitácora que se creó este proveedor, con todos
    // sus valores nuevos. "supplier as any" fuerza el tipo para que encaje en el
    // campo newValues (que espera un objeto genérico).
    await this.audit.log({
      tenantId,
      userId,
      action: 'supplier.created', // qué acción ocurrió
      entityType: 'Supplier', // sobre qué tipo de entidad
      entityId: supplier.id, // id de la fila afectada
      newValues: supplier as any, // estado nuevo del registro
    });

    return { data: supplier };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // update(): edita un proveedor existente (solo los campos que se envíen).
  //   - Recibe: tenantId, id del proveedor, dto con los cambios y userId opcional.
  //   - Devuelve: { data: proveedor actualizado } o lanza 404 si no existe.
  // ───────────────────────────────────────────────────────────────────────────
  async update(
    tenantId: string,
    id: string,
    dto: UpdateSupplierDto,
    userId?: string,
  ) {
    // Primero comprobamos que el proveedor exista y sea de ESTE negocio.
    const existing = await this.prisma.supplier.findFirst({
      where: { id, tenantId },
    });
    // Si no existe -> 404 (y no seguimos).
    if (!existing) throw new NotFoundException('Supplier not found');

    // ACTUALIZACIÓN PARCIAL: solo tocamos los campos que el cliente envió.
    // El patrón "...(condición && { campo: valor })" funciona así:
    //   - Si la condición es VERDADERA, el "&&" devuelve el objeto { campo: valor }
    //     y el "..." (spread) lo "esparce" dentro de data, agregando ese campo.
    //   - Si es FALSA, el "&&" devuelve false y "...false" no agrega nada.
    // Así, un campo que llegó como undefined (no enviado) se queda como estaba.
    // Usamos "!== undefined" para distinguir "no enviado" de "enviado vacío/null".
    const supplier = await this.prisma.supplier.update({
      where: { id }, // qué registro actualizar
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.contactName !== undefined && { contactName: dto.contactName }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
      include: {
        _count: { select: { products: true } },
      },
    });

    // AUDITORÍA: registramos el cambio guardando el estado ANTES (oldValues) y
    // DESPUÉS (newValues), para poder comparar qué se modificó.
    await this.audit.log({
      tenantId,
      userId,
      action: 'supplier.updated',
      entityType: 'Supplier',
      entityId: id,
      oldValues: existing as any, // cómo estaba antes
      newValues: supplier as any, // cómo quedó después
    });

    return { data: supplier };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // remove(): "borra" un proveedor. OJO: es un borrado lógico (soft delete): no
  // se elimina de la base de datos, solo se marca isActive=false para conservar
  // su historial y sus productos relacionados.
  //   - Recibe: tenantId, id y userId opcional.
  //   - Devuelve: { data: { message: 'Supplier deactivated' } } o 404 si no existe.
  // ───────────────────────────────────────────────────────────────────────────
  async remove(tenantId: string, id: string, userId?: string) {
    // Verificamos que exista y sea del negocio actual.
    const existing = await this.prisma.supplier.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException('Supplier not found');

    // En vez de delete, hacemos update poniendo isActive en false (desactivar).
    await this.prisma.supplier.update({
      where: { id },
      data: { isActive: false },
    });

    // AUDITORÍA: dejamos constancia de la desactivación.
    await this.audit.log({
      tenantId,
      userId,
      action: 'supplier.deactivated',
      entityType: 'Supplier',
      entityId: id,
    });

    // Devolvemos un mensaje simple de confirmación.
    return { data: { message: 'Supplier deactivated' } };
  }
}
