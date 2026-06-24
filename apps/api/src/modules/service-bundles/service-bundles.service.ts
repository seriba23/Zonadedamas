// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// De NestJS importamos:
//   - Injectable: decorador que marca esta clase como un "servicio" inyectable.
//   - NotFoundException: error listo que responde con HTTP 404 (no encontrado).
//   - BadRequestException: error que responde con HTTP 400 (petición inválida).
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

// PrismaService es el "puente" hacia la base de datos. A través de this.prisma
// leemos/escribimos tablas (serviceBundle, service, etc.) sin escribir SQL a mano.
import { PrismaService } from '../../prisma/prisma.service';

// AuditService = servicio de auditoría. Lo usamos para dejar registrado en una
// bitácora cada vez que se crea, actualiza o borra un paquete (quién y qué).
import { AuditService } from '../audit/audit.service';

// Los DTOs que describen la forma de los datos de entrada al crear/actualizar.
import { CreateServiceBundleDto } from './dto/create-service-bundle.dto';
import { UpdateServiceBundleDto } from './dto/update-service-bundle.dto';

// @Injectable() marca la clase como servicio inyectable de NestJS.
@Injectable()
export class ServiceBundlesService {
  // El constructor recibe los servicios que NestJS inyecta automáticamente.
  // "private" los guarda como propiedades de la clase (this.prisma, this.audit)
  // para usarlos en los métodos de abajo.
  constructor(
    private prisma: PrismaService, // acceso a la base de datos
    private audit: AuditService,   // registro de auditoría
  ) {}

  // ───────────────────────────────────────────────────────────────────────────
  // findAll(): devuelve la LISTA paginada de paquetes del negocio, enriqueciendo
  // cada paquete con los detalles de sus servicios y los cálculos de ahorro.
  // Recibe: tenantId (negocio) y query (filtros de página y estado).
  // ───────────────────────────────────────────────────────────────────────────
  async findAll(
    tenantId: string,
    query: { page?: number; perPage?: number; isActive?: boolean },
  ) {
    // page = número de página. Math.max(1, ...) asegura que nunca sea menor a 1.
    // "query.page || 1": si query.page es undefined/0 (valor "falsy"), usa 1.
    const page = Math.max(1, query.page || 1);
    // perPage = cuántos por página. Math.min(100, ...) lo limita a 100 como
    // máximo; Math.max(1, ...) a 1 como mínimo; si no vino, usa 20 por defecto.
    const perPage = Math.min(100, Math.max(1, query.perPage || 20));
    // skip = cuántos registros saltar para llegar a la página pedida.
    // Ej.: página 3 con 20 por página => saltar (3-1)*20 = 40 registros.
    const skip = (page - 1) * perPage;

    // "where" = condiciones de la búsqueda. Empieza filtrando por tenantId
    // (regla de multi-tenant: SIEMPRE filtrar por negocio). "any" relaja el tipo
    // para poder añadirle más propiedades abajo.
    const where: any = { tenantId };
    // Si se pidió filtrar por activo/inactivo (isActive vino definido, es decir
    // NO es undefined), añadimos esa condición al "where".
    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    // Promise.all(...) ejecuta varias operaciones EN PARALELO y espera a que
    // todas terminen. Aquí lanzamos a la vez: (1) traer la página de paquetes y
    // (2) contar el total de paquetes que cumplen el filtro. Los resultados se
    // reparten por desestructuración en "data" (la lista) y "total" (el conteo).
    const [data, total] = await Promise.all([
      this.prisma.serviceBundle.findMany({
        where,
        orderBy: { sortOrder: 'asc' }, // ordenar por sortOrder ascendente (0 primero)
        skip,        // saltar los de páginas anteriores
        take: perPage, // tomar como mucho "perPage" registros
      }),
      this.prisma.serviceBundle.count({ where }), // total sin paginar
    ]);

    // Enrich with service details (preserving serviceIds order)
    // Ahora "enriquecemos" cada paquete: como en la BD solo guardamos los IDs de
    // los servicios, aquí buscamos sus datos reales (nombre, precio, duración).
    // data.map(...) recorre cada "bundle" (paquete) y devuelve una versión
    // enriquecida; Promise.all espera a que todas esas búsquedas terminen.
    const enrichedData = await Promise.all(
      data.map(async (bundle) => {
        // serviceIds = los IDs guardados en el paquete. Está en un campo JSON,
        // por eso lo "afirmamos" como lista de textos con "as string[]".
        const serviceIds = bundle.serviceIds as string[];
        // Traemos de la BD los servicios cuyo id esté DENTRO de esa lista.
        // "id: { in: serviceIds }" es el operador Prisma "in" = "que esté en".
        const fetchedServices = await this.prisma.service.findMany({
          where: { id: { in: serviceIds }, tenantId },
          select: { id: true, name: true, price: true, durationMinutes: true },
        });
        // Maintain the order defined in serviceIds
        // La BD puede devolver los servicios en cualquier orden. Para respetar el
        // orden original del paquete, construimos un Map (diccionario) id -> servicio.
        // fetchedServices.map((s) => [s.id, s]) crea pares [clave, valor].
        const serviceMap = new Map(fetchedServices.map((s) => [s.id, s]));
        // Recorremos los IDs en su orden original y, por cada uno, sacamos su
        // servicio del Map. .filter(Boolean) elimina los "huecos" (undefined) por
        // si algún id ya no existiera: Boolean(undefined) es false y se descarta.
        const services = serviceIds.map((id) => serviceMap.get(id)).filter(Boolean);

        // totalOriginalPrice = suma de los precios individuales de los servicios.
        // reduce() recorre la lista acumulando en "sum" (empieza en 0). Por cada
        // servicio "s" suma Number(s!.price). El "!" le dice a TypeScript "confía,
        // aquí no es null"; Number(...) convierte el precio (Decimal) a número.
        const totalOriginalPrice = services.reduce(
          (sum, s) => sum + Number(s!.price),
          0,
        );
        // totalDuration = suma de las duraciones (en minutos) de los servicios.
        const totalDuration = services.reduce((sum, s) => sum + s!.durationMinutes, 0);
        // savingsPercent = porcentaje de ahorro del paquete frente a comprar suelto.
        // Ternario: si hay precio original (> 0) calculamos el %, si no, 0 (para
        // evitar dividir entre 0). Fórmula: (original - precioPaquete)/original*100,
        // redondeado con Math.round a un entero.
        const savingsPercent =
          totalOriginalPrice > 0
            ? Math.round(
                ((totalOriginalPrice - Number(bundle.bundlePrice)) /
                  totalOriginalPrice) *
                  100,
              )
            : 0;

        // Devolvemos el paquete original más los datos calculados.
        // "...bundle" copia todas las propiedades del paquete y luego añadimos
        // los campos extra (servicios, duración total, precio original, ahorro).
        return {
          ...bundle,
          services,
          totalDuration,
          totalOriginalPrice,
          savingsPercent,
        };
      }),
    );

    // Respuesta estándar del proyecto: la lista en "data" y la info de
    // paginación en "meta".
    return {
      data: enrichedData,
      meta: {
        total,   // total de paquetes que cumplen el filtro
        page,    // página actual
        perPage, // cuántos por página
        // totalPages = total dividido por perPage, redondeado HACIA ARRIBA
        // (Math.ceil) para incluir la última página aunque esté incompleta.
        totalPages: Math.ceil(total / perPage),
      },
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // findOne(): devuelve UN paquete concreto (por id) enriquecido con sus
  // servicios y cálculos. Recibe: tenantId (negocio) e id (del paquete).
  // ───────────────────────────────────────────────────────────────────────────
  async findOne(tenantId: string, id: string) {
    // findFirst busca el PRIMER paquete que cumpla las condiciones. Filtramos
    // por id Y por tenantId (multi-tenant: que pertenezca a ESTE negocio).
    const bundle = await this.prisma.serviceBundle.findFirst({
      where: { id, tenantId },
    });
    // "!bundle" = "si NO hay paquete" (no existe o no es de este negocio) -> 404.
    if (!bundle) throw new NotFoundException('Service bundle not found');

    // (Mismo enriquecimiento que en findAll, pero para un solo paquete.)
    // Sacamos los IDs de servicios del campo JSON.
    const serviceIds = bundle.serviceIds as string[];
    // Traemos los servicios reales cuyos id estén en la lista (operador "in").
    const fetchedServices = await this.prisma.service.findMany({
      where: { id: { in: serviceIds }, tenantId },
      select: { id: true, name: true, price: true, durationMinutes: true },
    });
    // Maintain the order defined in serviceIds
    // Map id -> servicio para poder reordenarlos según el orden original.
    const serviceMap = new Map(fetchedServices.map((s) => [s.id, s]));
    // Recorremos los IDs en orden y recuperamos su servicio; filter(Boolean)
    // descarta los que no se encontraran (undefined).
    const services = serviceIds.map((id) => serviceMap.get(id)).filter(Boolean);

    // Suma de precios sueltos (reduce acumulando en "sum" desde 0).
    const totalOriginalPrice = services.reduce(
      (sum, s) => sum + Number(s!.price),
      0,
    );
    // Suma de duraciones en minutos.
    const totalDuration = services.reduce((sum, s) => sum + s!.durationMinutes, 0);
    // Porcentaje de ahorro (ternario para evitar dividir entre 0).
    const savingsPercent =
      totalOriginalPrice > 0
        ? Math.round(
            ((totalOriginalPrice - Number(bundle.bundlePrice)) /
              totalOriginalPrice) *
              100,
          )
        : 0;

    // Devolvemos el paquete (copiado con "...bundle") más los datos calculados.
    return {
      data: {
        ...bundle,
        services,
        totalDuration,
        totalOriginalPrice,
        savingsPercent,
      },
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // create(): crea un nuevo paquete. Recibe: tenantId, dto (datos del paquete) y
  // userId opcional (quién lo crea, para la auditoría). Valida que los servicios
  // existan y que el precio del paquete no supere la suma de sus servicios.
  // ───────────────────────────────────────────────────────────────────────────
  async create(
    tenantId: string,
    dto: CreateServiceBundleDto,
    userId?: string,
  ) {
    // ".length" es la cantidad de elementos de la lista. Si es 0, "!0" es true
    // => no se mandó ningún servicio => error 400.
    if (!dto.serviceIds.length) {
      throw new BadRequestException('At least one service is required');
    }

    // Buscamos en la BD los servicios indicados, pero SOLO los activos
    // (isActive: true) y de este negocio (tenantId). El operador "in" filtra por
    // "id que esté dentro de la lista dto.serviceIds".
    const services = await this.prisma.service.findMany({
      where: { id: { in: dto.serviceIds }, tenantId, isActive: true },
      select: { id: true, name: true, price: true, durationMinutes: true },
    });
    // Si la cantidad encontrada NO coincide (!==) con la cantidad pedida, es que
    // algún id no existe, no es de este negocio o está inactivo => error 400.
    if (services.length !== dto.serviceIds.length) {
      throw new BadRequestException('One or more services not found');
    }

    // Suma de los precios sueltos (reduce acumulando en "sum" desde 0).
    const totalOriginalPrice = services.reduce(
      (sum, s) => sum + Number(s.price),
      0,
    );
    // El precio del paquete debe ofrecer un descuento (o quedar igual);
    // un valor superior convertiria el paquete en un sobreprecio.
    // Si el precio del paquete es MAYOR (>) que la suma, lo rechazamos.
    if (dto.bundlePrice > totalOriginalPrice) {
      throw new BadRequestException(
        `El precio del paquete (${dto.bundlePrice}) no puede ser mayor a la suma de los servicios (${totalOriginalPrice}).`,
      );
    }
    // Suma de duraciones en minutos.
    const totalDuration = services.reduce((sum, s) => sum + s.durationMinutes, 0);
    // Porcentaje de ahorro (ternario para no dividir entre 0).
    const savingsPercent =
      totalOriginalPrice > 0
        ? Math.round(
            ((totalOriginalPrice - dto.bundlePrice) / totalOriginalPrice) * 100,
          )
        : 0;

    // Creamos el registro del paquete en la base de datos.
    const bundle = await this.prisma.serviceBundle.create({
      data: {
        tenantId,
        name: dto.name,
        description: dto.description,
        bundlePrice: dto.bundlePrice,
        serviceIds: dto.serviceIds, // se guardan como JSON
        totalDuration,              // ya calculado arriba
        savingsPercent,             // ya calculado arriba
        // "??" es el operador "nullish coalescing": usa el valor de la izquierda
        // SOLO si NO es null/undefined; si lo es, usa el de la derecha (valor por
        // defecto). Así: si dto.flexibleOrder no vino, queda false; etc.
        flexibleOrder: dto.flexibleOrder ?? false,
        isActive: dto.isActive ?? true,    // por defecto activo
        sortOrder: dto.sortOrder ?? 0,     // por defecto el primero
        pointsReward: dto.pointsReward ?? null,
        redeemableWithPoints: dto.redeemableWithPoints ?? false,
        pointsRequired: dto.pointsRequired ?? null,
      },
    });

    // Registramos en la bitácora de auditoría la creación del paquete.
    await this.audit.log({
      tenantId,
      userId,
      action: 'serviceBundle.created', // qué acción ocurrió
      entityType: 'ServiceBundle',     // sobre qué tipo de entidad
      entityId: bundle.id,             // sobre qué registro concreto
      newValues: bundle as any,        // los valores nuevos (para el historial)
    });

    // Devolvemos el paquete creado más los servicios y el precio original.
    return {
      data: {
        ...bundle,
        services,
        totalOriginalPrice,
      },
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // update(): actualiza un paquete existente. Recibe: tenantId, id del paquete,
  // dto (solo los campos a cambiar) y userId opcional (para auditoría).
  // Si cambian los servicios o el precio, recalcula duración, ahorro y revalida.
  // ───────────────────────────────────────────────────────────────────────────
  async update(
    tenantId: string,
    id: string,
    dto: UpdateServiceBundleDto,
    userId?: string,
  ) {
    // Buscamos el paquete actual (debe existir y ser de este negocio).
    const existing = await this.prisma.serviceBundle.findFirst({
      where: { id, tenantId },
    });
    // Si no existe -> 404.
    if (!existing) throw new NotFoundException('Service bundle not found');

    // Declaramos variables que PODRÍAN calcularse o no. "let" permite asignarlas
    // luego; el tipo "| undefined" indica que pueden quedar sin valor (si no se
    // tocan ni servicios ni precio, no hace falta recalcular nada).
    let totalDuration: number | undefined;
    let savingsPercent: number | undefined;
    let services: any[] | undefined;

    // serviceIds a usar para los cálculos: los nuevos (dto.serviceIds) si vinieron;
    // si no (??), los que ya tenía el paquete (existing.serviceIds, campo JSON).
    const serviceIds = dto.serviceIds ?? (existing.serviceIds as string[]);
    // bundlePrice a usar: el nuevo si vino; si no, el actual convertido a número.
    const bundlePrice = dto.bundlePrice ?? Number(existing.bundlePrice);

    // Solo recalculamos si cambió la lista de servicios O el precio.
    // "dto.serviceIds" es "truthy" si vino una lista; "dto.bundlePrice !== undefined"
    // detecta que vino un precio (incluido 0, que sería "falsy" y se perdería con
    // un simple "if (dto.bundlePrice)"). El "||" = "alguna de las dos".
    if (dto.serviceIds || dto.bundlePrice !== undefined) {
      // Traemos los servicios (activos, de este negocio) por sus IDs.
      const fetchedServices = await this.prisma.service.findMany({
        where: { id: { in: serviceIds }, tenantId, isActive: true },
        select: { id: true, name: true, price: true, durationMinutes: true },
      });
      // Si se mandó una NUEVA lista y la cantidad encontrada no coincide (!==)
      // con la pedida, algún servicio no es válido -> error 400.
      if (dto.serviceIds && fetchedServices.length !== dto.serviceIds.length) {
        throw new BadRequestException('One or more services not found');
      }

      // Guardamos los servicios para devolverlos al final.
      services = fetchedServices;
      // Suma de precios sueltos.
      const totalOriginalPrice = fetchedServices.reduce(
        (sum, s) => sum + Number(s.price),
        0,
      );
      // Misma regla que en create: el bundle no puede costar mas que la suma.
      if (bundlePrice > totalOriginalPrice) {
        throw new BadRequestException(
          `El precio del paquete (${bundlePrice}) no puede ser mayor a la suma de los servicios (${totalOriginalPrice}).`,
        );
      }
      // Recalculamos duración total y porcentaje de ahorro.
      totalDuration = fetchedServices.reduce((sum, s) => sum + s.durationMinutes, 0);
      savingsPercent =
        totalOriginalPrice > 0
          ? Math.round(
              ((totalOriginalPrice - bundlePrice) / totalOriginalPrice) * 100,
            )
          : 0;
    }

    // Actualizamos el paquete. Aquí usamos un patrón de "propiedades condicionales":
    //   ...(condición && { campo: valor })
    // Si la condición es verdadera, "&&" devuelve el objeto { campo: valor } y el
    // "..." lo mezcla en "data". Si es falsa, devuelve false y el "..." no añade
    // nada. Resultado: solo se incluyen en la actualización los campos que SÍ
    // vinieron en el dto (los que son "!== undefined"). Así no pisamos con vacío
    // los campos que el usuario no quiso cambiar.
    const bundle = await this.prisma.serviceBundle.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.bundlePrice !== undefined && { bundlePrice: dto.bundlePrice }),
        ...(dto.serviceIds !== undefined && { serviceIds: dto.serviceIds }),
        // totalDuration y savingsPercent solo se incluyen si se recalcularon arriba.
        ...(totalDuration !== undefined && { totalDuration }),
        ...(savingsPercent !== undefined && { savingsPercent }),
        ...(dto.flexibleOrder !== undefined && { flexibleOrder: dto.flexibleOrder }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.pointsReward !== undefined && { pointsReward: dto.pointsReward }),
        ...(dto.redeemableWithPoints !== undefined && { redeemableWithPoints: dto.redeemableWithPoints }),
        ...(dto.pointsRequired !== undefined && { pointsRequired: dto.pointsRequired }),
      },
    });

    // Auditoría: registramos la actualización guardando valores antiguos y nuevos.
    await this.audit.log({
      tenantId,
      userId,
      action: 'serviceBundle.updated',
      entityType: 'ServiceBundle',
      entityId: id,
      oldValues: existing as any, // cómo estaba antes
      newValues: bundle as any,   // cómo quedó
    });

    // Devolvemos el paquete actualizado. Solo añadimos "services" si se
    // recalcularon (services && {...}); si no se tocaron, no se incluye.
    return {
      data: {
        ...bundle,
        ...(services && { services }),
      },
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // remove(): "elimina" un paquete. En realidad NO lo borra de la BD, sino que
  // lo DESACTIVA (isActive: false). Esto es un "soft delete" (borrado suave):
  // el registro se conserva por historial, pero deja de mostrarse/venderse.
  // Recibe: tenantId, id del paquete y userId opcional (para auditoría).
  // ───────────────────────────────────────────────────────────────────────────
  async remove(tenantId: string, id: string, userId?: string) {
    // Comprobamos que el paquete exista y sea de este negocio.
    const existing = await this.prisma.serviceBundle.findFirst({
      where: { id, tenantId },
    });
    // Si no existe -> 404.
    if (!existing) throw new NotFoundException('Service bundle not found');

    // En vez de borrar, lo marcamos como inactivo.
    await this.prisma.serviceBundle.update({
      where: { id },
      data: { isActive: false },
    });

    // Auditoría: registramos la desactivación.
    await this.audit.log({
      tenantId,
      userId,
      action: 'serviceBundle.deactivated',
      entityType: 'ServiceBundle',
      entityId: id,
    });

    // Devolvemos un mensaje simple confirmando la desactivación.
    return { data: { message: 'Service bundle deactivated' } };
  }
}
