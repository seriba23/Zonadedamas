// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// De NestJS importamos el decorador de servicio y varios errores listos para usar.
// Al lanzar uno de estos errores, la API responde con el código HTTP indicado:
import {
  Injectable,            // marca la clase como "servicio" inyectable de NestJS.
  NotFoundException,     // al lanzarlo, responde HTTP 404 (no encontrado).
  BadRequestException,   // al lanzarlo, responde HTTP 400 (petición inválida).
  ForbiddenException,    // al lanzarlo, responde HTTP 403 (prohibido / sin permiso).
} from '@nestjs/common';
// EventEmitter2 = "emisor de eventos". Permite "avisar" a otras partes del
// sistema de que algo pasó (ej. "se creó una compra", "queda poco stock") sin
// llamarlas directamente. Otros módulos "escuchan" esos avisos y reaccionan.
import { EventEmitter2 } from '@nestjs/event-emitter';
// PrismaService es nuestro "puente" hacia la base de datos. A través de
// this.prisma leemos/escribimos tablas (tenant, product, productReservation...).
import { PrismaService } from '../../prisma/prisma.service';
// Los DTOs con la forma validada de los datos que llegan al apartar.
import { CreateReservationDto, CreateBatchReservationDto } from './dto/create-reservation.dto';
// Servicio para guardar/borrar archivos (las capturas de comprobantes de pago).
import { UploadsService } from '../uploads/uploads.service';

// @Injectable() => marca la clase como servicio que NestJS puede crear e inyectar.
@Injectable()
export class ShopService {
  // CONSTRUCTOR: NestJS inyecta automáticamente estas 3 dependencias y quedan
  // guardadas como propiedades privadas (this.prisma, this.eventEmitter, etc.).
  constructor(
    private prisma: PrismaService,         // acceso a la base de datos.
    private eventEmitter: EventEmitter2,   // para emitir eventos del dominio.
    private uploadsService: UploadsService, // para guardar/borrar archivos.
  ) {}

  /**
   * Genera un código corto único para una reserva (ej. "RX12AB"). Excluye
   * caracteres ambiguos (0/O, 1/I/L) para que sea fácil de dictar por
   * WhatsApp o teléfono.
   */
  // "private" => solo se usa dentro de esta clase. "async" => es una función que
  // espera operaciones lentas (consultas a la BD). Devuelve una Promesa de string
  // (el código generado).
  private async generateReservationCode(): Promise<string> {
    // Conjunto de caracteres permitidos. OJO: NO incluye 0, O, 1, I, L para
    // evitar confusiones al leer/dictar el código (esas se parecen entre sí).
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    // BUCLE EXTERNO: intentamos generar un código hasta 6 veces. Si el código
    // generado ya existe en la BD (colisión), reintentamos con otro.
    for (let attempt = 0; attempt < 6; attempt++) {
      let code = ''; // aquí iremos construyendo el código, letra por letra.
      // BUCLE INTERNO: añadimos 6 caracteres al código.
      for (let i = 0; i < 6; i++) {
        // Math.random() => número decimal aleatorio entre 0 y 1 (sin llegar a 1).
        // Multiplicado por la longitud de "chars" y redondeado hacia abajo con
        // Math.floor() => un índice aleatorio válido dentro de "chars".
        // charAt(índice) => toma el carácter en esa posición. "+=" lo concatena.
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      // Comprobamos en la BD si ya existe una reserva con ese mismo código.
      // findFirst busca la PRIMERA que cumpla la condición (o null si no hay).
      // select: { id: true } => solo traemos el id (basta para saber si existe).
      const exists = await this.prisma.productReservation.findFirst({
        where: { code },
        select: { id: true },
      });
      // "!exists" se lee "si NO existe": el código está libre, lo devolvemos y
      // salimos de la función inmediatamente (return corta el bucle).
      if (!exists) return code;
    }
    // Fallback al UUID corto si por alguna razón seguimos colisionando.
    // Si tras 6 intentos no logramos un código libre, generamos uno de respaldo:
    // Math.random().toString(36) => convierte el aleatorio a texto en base 36
    // (dígitos + letras a-z). substring(2, 8) => recorta 6 caracteres útiles
    // (saltando el "0." inicial). toUpperCase() => lo pasa a mayúsculas.
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // resolveTenant(): a partir del "slug" (el nombre del negocio en la URL),
  // busca el negocio en la BD y comprueba que su tienda esté disponible.
  // Devuelve el negocio con su configuración de tienda. Es el punto de partida
  // de casi todos los métodos de abajo.
  // ───────────────────────────────────────────────────────────────────────────
  async resolveTenant(slug: string) {
    // findUnique = "encuentra UN registro único". Buscamos el negocio cuyo slug
    // coincida. "select" elige SOLO los campos que necesitamos (más eficiente):
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug },
      select: {
        id: true,                 // id interno del negocio.
        name: true,               // nombre visible.
        shopEnabled: true,        // ¿la tienda está activada?
        isMarketplaceListed: true,// ¿el negocio aparece en el marketplace?
        shopPickupEnabled: true,  // ¿permite recoger en tienda?
        shopShippingEnabled: true,// ¿permite envíos a domicilio?
        shopPaymentCash: true,    // ¿acepta efectivo?
        shopPaymentSpei: true,    // ¿acepta transferencia SPEI?
        shopPaymentCard: true,    // ¿acepta tarjeta?
        shopSpeiBankName: true,   // banco para la transferencia SPEI.
        shopSpeiHolderName: true, // titular de la cuenta SPEI.
        shopSpeiClabe: true,      // CLABE (número de cuenta para SPEI).
      },
    });
    // Si no existe ningún negocio con ese slug -> error 404.
    if (!tenant) throw new NotFoundException('Negocio no encontrado');
    // Si el negocio NO está listado en el marketplace O su tienda está apagada,
    // la tienda no debe mostrarse -> error 404.
    //   - "||" (OR lógico): basta con que UNA de las dos condiciones sea verdadera.
    //   - "!tenant.isMarketplaceListed" = "NO está listado".
    if (!tenant.isMarketplaceListed || !tenant.shopEnabled) {
      throw new NotFoundException('Tienda no disponible');
    }
    // Todo correcto: devolvemos el negocio con su configuración.
    return tenant;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // getShopSettings(): arma y devuelve la configuración pública de la tienda:
  // qué métodos de pago y de entrega ofrece, y los datos SPEI si aplican.
  // ───────────────────────────────────────────────────────────────────────────
  async getShopSettings(slug: string) {
    // Primero resolvemos el negocio (también valida que la tienda esté activa).
    const tenant = await this.resolveTenant(slug);

    // Construimos la lista de métodos de pago aceptados. Empieza vacía y vamos
    // añadiendo ("push") cada método que el negocio tenga activado.
    const paymentMethods: string[] = [];
    if (tenant.shopPaymentCash) paymentMethods.push('CASH'); // si acepta efectivo.
    if (tenant.shopPaymentSpei) paymentMethods.push('SPEI'); // si acepta SPEI.
    if (tenant.shopPaymentCard) paymentMethods.push('CARD'); // si acepta tarjeta.

    // Igual para las opciones de entrega: recoger en tienda y/o envío.
    const fulfillmentOptions: string[] = [];
    if (tenant.shopPickupEnabled) fulfillmentOptions.push('PICKUP');
    if (tenant.shopShippingEnabled) fulfillmentOptions.push('SHIPPING');

    // Devolvemos la respuesta en el formato estándar { data: ... }.
    return {
      data: {
        shopEnabled: tenant.shopEnabled, // confirma que la tienda está activa.
        tenantName: tenant.name,         // nombre del negocio.
        paymentMethods,                  // lista construida arriba.
        fulfillmentOptions,              // lista construida arriba.
        // speiInfo: solo enviamos los datos bancarios SI el negocio acepta SPEI
        // Y tiene una CLABE configurada. Es un OPERADOR TERNARIO:
        //   condición ? objetoConDatos : null
        //   - "&&" (AND lógico): ambas condiciones deben ser verdaderas.
        // Si no se cumplen, devolvemos null (no hay datos SPEI que mostrar).
        speiInfo: tenant.shopPaymentSpei && tenant.shopSpeiClabe ? {
          bankName: tenant.shopSpeiBankName,
          holderName: tenant.shopSpeiHolderName,
          clabe: tenant.shopSpeiClabe,
        } : null,
      },
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // getProducts(): devuelve la lista PAGINADA de productos a la venta del negocio.
  // "query" trae los parámetros opcionales de la URL: página, cantidad por
  // página y filtro de categoría.
  // ───────────────────────────────────────────────────────────────────────────
  async getProducts(
    slug: string,
    query: { page?: number; perPage?: number; category?: string },
  ) {
    // Resolvemos el negocio (valida tienda activa).
    const tenant = await this.resolveTenant(slug);
    // page = número de página. "query.page || 1": si page es undefined/0, usa 1.
    // Math.max(1, ...) garantiza que nunca baje de 1 (no existe la página 0).
    const page = Math.max(1, query.page || 1);
    // perPage = cuántos por página. Aseguramos que esté entre 1 y 100:
    //   - Math.max(1, query.perPage || 20): al menos 1 (por defecto 20).
    //   - Math.min(100, ...): como máximo 100 (evita pedir miles de golpe).
    const perPage = Math.min(100, Math.max(1, query.perPage || 20));
    // skip = cuántos registros SALTAR para llegar a la página pedida.
    // Ej.: página 3 con 20 por página => saltar (3-1)*20 = 40 productos.
    const skip = (page - 1) * perPage;

    // "where" = las condiciones de búsqueda. Es un objeto que iremos rellenando.
    // (": any" relaja el tipado para poder añadir "category" condicionalmente).
    const where: any = {
      tenantId: tenant.id,    // solo productos de ESTE negocio (multi-tenant).
      isShopListed: true,     // solo los marcados para mostrarse en la tienda.
      isActive: true,         // solo los activos (no archivados).
      stock: { gt: 0 },       // "gt" = "greater than" (>): solo con stock > 0.
    };
    // Si el cliente pidió filtrar por categoría, la añadimos a las condiciones.
    if (query.category) {
      where.category = query.category;
    }

    // Promise.all ejecuta DOS consultas EN PARALELO (a la vez) y espera a ambas.
    // La desestructuración "[data, total]" guarda el 1er resultado en "data"
    // (la lista de productos) y el 2º en "total" (el conteo total).
    const [data, total] = await Promise.all([
      // 1) La lista de productos de esta página.
      this.prisma.product.findMany({
        where,
        select: {                  // elegimos solo los campos a devolver:
          id: true,
          name: true,
          description: true,
          category: true,
          price: true,
          currency: true,
          stock: true,
          imageUrl: true,          // imagen principal.
          shippingEnabled: true,   // ¿este producto admite envío?
          shippingCost: true,      // costo de envío del producto.
          images: {                // galería de imágenes adicionales (relación):
            select: { id: true, imageUrl: true, sortOrder: true },
            orderBy: { sortOrder: 'asc' }, // ordenadas por su número de orden, ascendente.
          },
        },
        orderBy: { name: 'asc' },  // ordenamos los productos por nombre A→Z.
        skip,                      // saltamos los de páginas anteriores.
        take: perPage,             // tomamos como mucho "perPage" productos.
      }),
      // 2) El conteo TOTAL de productos que cumplen "where" (sin paginar).
      //    Sirve para calcular cuántas páginas hay en total.
      this.prisma.product.count({ where }),
    ]);

    // Devolvemos los datos + "meta" con la información de paginación.
    return {
      data,
      meta: {
        total,    // total de productos disponibles.
        page,     // página actual.
        perPage,  // tamaño de página.
        // totalPages = total / porPágina, redondeado HACIA ARRIBA con
        // Math.ceil (si sobran productos, hace falta una página más).
        totalPages: Math.ceil(total / perPage),
      },
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // getProductDetail(): devuelve el detalle de UN producto concreto del negocio.
  // ───────────────────────────────────────────────────────────────────────────
  async getProductDetail(slug: string, productId: string) {
    const tenant = await this.resolveTenant(slug);

    // findFirst: la PRIMERA fila que cumpla todas las condiciones (o null).
    const product = await this.prisma.product.findFirst({
      where: {
        id: productId,        // el producto pedido...
        tenantId: tenant.id,  // ...que pertenezca a ESTE negocio...
        isShopListed: true,   // ...esté listado en la tienda...
        isActive: true,       // ...y activo.
      },
      select: {               // campos a devolver (incluye "unit", para el detalle):
        id: true,
        name: true,
        description: true,
        category: true,
        price: true,
        stock: true,
        unit: true,           // unidad de venta (pieza, ml, etc.).
        imageUrl: true,
        shippingCost: true,
        images: {             // galería de imágenes adicionales:
          select: { id: true, imageUrl: true, sortOrder: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
    // Si no se encontró el producto (o no cumple las condiciones) -> 404.
    if (!product) throw new NotFoundException('Producto no encontrado');

    // Lo devolvemos en el formato estándar { data: ... }.
    return { data: product };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // createReservation(): aparta UN producto. Valida la configuración del negocio,
  // descuenta stock de forma segura (transacción) y crea la reserva. Al final
  // emite eventos (compra creada, posible reserva ligada a cita, stock bajo).
  // "marketplaceUserId?" es opcional: si el cliente está logueado, será su id;
  // si es invitado, vendrá undefined.
  // ───────────────────────────────────────────────────────────────────────────
  async createReservation(slug: string, dto: CreateReservationDto, marketplaceUserId?: string) {
    const tenant = await this.resolveTenant(slug);

    // Validate fulfillment type
    // Validamos el tipo de entrega contra lo que el negocio realmente ofrece:
    // si pide envío pero el negocio NO hace envíos -> error.
    //   - "&&" exige que AMBAS sean verdad; "!" niega (NO ofrece envíos).
    if (dto.fulfillmentType === 'SHIPPING' && !tenant.shopShippingEnabled) {
      throw new BadRequestException('Este negocio no ofrece envios');
    }
    // Igual para recoger en tienda: si lo pide pero el negocio no lo ofrece -> error.
    if (dto.fulfillmentType === 'PICKUP' && !tenant.shopPickupEnabled) {
      throw new BadRequestException(
        'Este negocio no ofrece recoger en tienda',
      );
    }

    // Validate payment method
    // paymentAllowed será true solo si el método elegido por el cliente coincide
    // con un método que el negocio acepta. Encadenamos 3 comprobaciones con "||"
    // (OR): basta que UNA pareja (método elegido + negocio lo acepta) sea verdad.
    const paymentAllowed =
      (dto.preferredPaymentMethod === 'CASH' && tenant.shopPaymentCash) ||
      (dto.preferredPaymentMethod === 'SPEI' && tenant.shopPaymentSpei) ||
      (dto.preferredPaymentMethod === 'CARD' && tenant.shopPaymentCard);
    // Si ninguna coincidió (paymentAllowed es falso) -> error.
    if (!paymentAllowed) {
      throw new BadRequestException(
        'Metodo de pago no aceptado por este negocio',
      );
    }

    // Validate shipping address for shipping
    // Si es envío pero NO mandó dirección -> error (la necesitamos para entregar).
    if (dto.fulfillmentType === 'SHIPPING' && !dto.shippingAddress) {
      throw new BadRequestException(
        'Direccion de envio requerida para entregas a domicilio',
      );
    }

    // Stock crossings to alert on after the transaction commits
    // Lista para anotar productos que, al descontar, CRUZARON el umbral de stock
    // mínimo (de "suficiente" a "bajo"). Emitiremos avisos DESPUÉS de la
    // transacción (no dentro, para no mezclar avisos con la operación de BD).
    const stockAlerts: Array<{
      id: string;
      name: string;
      stock: number;
      minStock: number;
    }> = [];

    // Transactional: validate stock and create reservation
    // $transaction ejecuta varias operaciones de BD como UNA sola unidad: o se
    // completan todas, o no se aplica ninguna (evita dejar el stock a medias).
    // "tx" es el cliente de Prisma DENTRO de la transacción; hay que usar "tx"
    // (no this.prisma) para que todo cuente como la misma transacción.
    const reservation = await this.prisma.$transaction(
      async (tx) => {
        // Volvemos a leer el producto DENTRO de la transacción (datos frescos).
        const product = await tx.product.findFirst({
          where: {
            id: dto.productId,
            tenantId: tenant.id,
            isShopListed: true,
            isActive: true,
          },
        });
        if (!product) throw new NotFoundException('Producto no encontrado');

        // Si hay menos stock que la cantidad pedida -> no se puede apartar.
        // "<" compara: stock disponible MENOR que lo solicitado.
        if (product.stock < dto.quantity) {
          throw new BadRequestException(
            `Stock insuficiente. Disponible: ${product.stock}`,
          );
        }

        // Decrement stock
        // Descontamos del stock la cantidad apartada. "decrement" es un operador
        // de Prisma que resta de forma atómica (resta directamente en la BD).
        const updatedProduct = await tx.product.update({
          where: { id: product.id },
          data: { stock: { decrement: dto.quantity } },
          select: { id: true, name: true, stock: true, minStock: true },
        });
        // Only alert when *crossing* the threshold (was above, now below)
        // Solo avisamos cuando se CRUZA el umbral (antes estaba por encima del
        // mínimo y ahora quedó igual o por debajo). Si ya estaba bajo, no
        // repetimos el aviso. Las 3 condiciones (unidas por &&) deben cumplirse:
        //   - minStock > 0: el negocio definió un umbral.
        //   - product.stock > minStock: ANTES estaba por encima del umbral.
        //   - updatedProduct.stock <= minStock: AHORA quedó igual o por debajo.
        if (
          updatedProduct.minStock > 0 &&
          product.stock > updatedProduct.minStock &&
          updatedProduct.stock <= updatedProduct.minStock
        ) {
          stockAlerts.push(updatedProduct); // lo anotamos para avisar luego.
        }

        // Create reservation with price snapshot
        // Creamos la reserva. Guardamos un "snapshot" del precio (unitPrice) tal
        // como está AHORA, para que no cambie si después editan el producto.
        return tx.productReservation.create({
          data: {
            tenantId: tenant.id,
            productId: product.id,
            quantity: dto.quantity,
            unitPrice: product.price, // precio congelado al momento de apartar.
            // Costo de envío: si es SHIPPING, usamos el del producto ("|| 0"
            // pone 0 si fuera null/undefined); si es PICKUP, el costo es 0.
            shippingCost: dto.fulfillmentType === 'SHIPPING' ? (product.shippingCost || 0) : 0,
            customerName: dto.customerName,
            customerEmail: dto.customerEmail,
            customerPhone: dto.customerPhone,
            // "as any" fuerza el tipo para encajar con el enum de Prisma sin
            // que TypeScript se queje por la diferencia de tipos.
            fulfillmentType: dto.fulfillmentType as any,
            preferredPaymentMethod: dto.preferredPaymentMethod as any,
            shippingAddress: dto.shippingAddress,
            // "|| null": si no vino appointmentId, guardamos null explícitamente.
            appointmentId: dto.appointmentId || null,
            notes: dto.notes,
            userId: marketplaceUserId, // dueño de la reserva (o undefined si invitado).
            paymentProofUrl: dto.paymentProofUrl || null,
            code: await this.generateReservationCode(), // código corto único.
          },
          include: {
            // Traemos también algunos datos del producto para usarlos al emitir
            // los eventos de abajo (nombre e imagen).
            product: { select: { id: true, name: true, imageUrl: true } },
          },
        });
      },
      // Nivel de aislamiento "Serializable": el más estricto. Evita que dos
      // clientes aparten el mismo último producto a la vez (anti doble-venta).
      { isolationLevel: 'Serializable' },
    );

    // Emitimos el evento "purchase.created" para avisar a otros módulos (ej. el
    // de notificaciones al negocio) de que hubo una nueva compra/apartado.
    this.eventEmitter.emit('purchase.created', {
      tenantId: tenant.id,
      purchase: {
        id: reservation.id,
        customerName: reservation.customerName,
        customerEmail: reservation.customerEmail,
        customerPhone: reservation.customerPhone,
        fulfillmentType: reservation.fulfillmentType,
        paymentMethod: reservation.preferredPaymentMethod,
        // items: aquí es un solo producto, pero lo metemos en un arreglo de 1
        // elemento para que el formato sea igual al de la compra por lote.
        items: [
          {
            productId: reservation.product.id,
            productName: reservation.product.name,
            // "??" (nullish coalescing): usa imageUrl si NO es null/undefined;
            // si lo es, usa null. (A diferencia de "||", no se activa con "" o 0.)
            productImage: reservation.product.imageUrl ?? null,
            quantity: reservation.quantity,
            // Number(...) convierte el precio (que Prisma da como Decimal) a un
            // número normal de JavaScript, para poder operar con él.
            unitPrice: Number(reservation.unitPrice),
          },
        ],
        // total = (precio unitario * cantidad) + costo de envío.
        // "shippingCost || 0" pone 0 si fuese null/undefined antes de sumar.
        total:
          Number(reservation.unitPrice) * reservation.quantity +
          Number(reservation.shippingCost || 0),
        createdAt: reservation.createdAt,
      },
    });

    // Si la reserva está ligada a una cita (appointmentId existe), avisamos
    // además con un evento específico para reservas de producto en cita.
    if (reservation.appointmentId) {
      this.eventEmitter.emit('product_reservation.created', {
        tenantId: tenant.id,
        reservationId: reservation.id,
        productName: reservation.product.name,
        clientName: reservation.customerName,
        quantity: reservation.quantity,
      });
    }

    // Recorremos los productos que cruzaron el umbral de stock bajo y emitimos
    // un aviso por cada uno. "for...of" recorre cada elemento "p" de stockAlerts.
    for (const p of stockAlerts) {
      this.eventEmitter.emit('inventory.low_stock', {
        tenantId: tenant.id,
        productId: p.id,
        productName: p.name,
        stock: p.stock,        // stock que quedó.
        threshold: p.minStock, // umbral mínimo configurado.
      });
    }

    // Devolvemos la reserva creada en el formato estándar { data: ... }.
    return { data: reservation };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // createBatchReservation(): aparta VARIOS productos a la vez (un carrito).
  // Es como createReservation pero recorre una lista de items, creando una
  // reserva por cada uno dentro de la MISMA transacción (todo o nada).
  // ───────────────────────────────────────────────────────────────────────────
  async createBatchReservation(slug: string, dto: CreateBatchReservationDto, marketplaceUserId?: string) {
    const tenant = await this.resolveTenant(slug);

    // Mismas validaciones que en la reserva individual: tipo de entrega...
    if (dto.fulfillmentType === 'SHIPPING' && !tenant.shopShippingEnabled) {
      throw new BadRequestException('Este negocio no ofrece envios');
    }
    if (dto.fulfillmentType === 'PICKUP' && !tenant.shopPickupEnabled) {
      throw new BadRequestException('Este negocio no ofrece recoger en tienda');
    }

    // ...método de pago aceptado...
    const paymentAllowed =
      (dto.preferredPaymentMethod === 'CASH' && tenant.shopPaymentCash) ||
      (dto.preferredPaymentMethod === 'SPEI' && tenant.shopPaymentSpei) ||
      (dto.preferredPaymentMethod === 'CARD' && tenant.shopPaymentCard);
    if (!paymentAllowed) {
      throw new BadRequestException('Metodo de pago no aceptado por este negocio');
    }

    // ...y dirección de envío si corresponde.
    if (dto.fulfillmentType === 'SHIPPING' && !dto.shippingAddress) {
      throw new BadRequestException('Direccion de envio requerida');
    }

    // Lista de avisos de stock bajo (igual que en la reserva individual).
    const stockAlerts: Array<{
      id: string;
      name: string;
      stock: number;
      minStock: number;
    }> = [];

    // Transacción: o se crean TODAS las reservas del carrito, o ninguna.
    const reservations = await this.prisma.$transaction(
      async (tx) => {
        // "results" irá acumulando cada reserva creada para devolverlas juntas.
        const results: any[] = [];

        // Recorremos cada item del carrito. "for...of" toma cada "item" del arreglo.
        for (const item of dto.items) {
          // Leemos el producto de ese item dentro de la transacción.
          const product = await tx.product.findFirst({
            where: {
              id: item.productId,
              tenantId: tenant.id,
              isShopListed: true,
              isActive: true,
            },
          });
          // Si alguno no existe, abortamos TODA la transacción (nada se guarda).
          if (!product) throw new NotFoundException(`Producto no encontrado: ${item.productId}`);
          // Si falta stock para ese item, también abortamos todo.
          if (product.stock < item.quantity) {
            throw new BadRequestException(`Stock insuficiente para "${product.name}". Disponible: ${product.stock}`);
          }

          // Descontamos el stock de este producto (operador "decrement").
          const updatedProduct = await tx.product.update({
            where: { id: product.id },
            data: { stock: { decrement: item.quantity } },
            select: { id: true, name: true, stock: true, minStock: true },
          });
          // Mismo chequeo de "cruce de umbral" que en la reserva individual.
          if (
            updatedProduct.minStock > 0 &&
            product.stock > updatedProduct.minStock &&
            updatedProduct.stock <= updatedProduct.minStock
          ) {
            stockAlerts.push(updatedProduct);
          }

          // Creamos la reserva de este item (con snapshot de precio).
          const reservation = await tx.productReservation.create({
            data: {
              tenantId: tenant.id,
              productId: product.id,
              quantity: item.quantity,
              unitPrice: product.price,
              shippingCost: dto.fulfillmentType === 'SHIPPING' ? (product.shippingCost || 0) : 0,
              customerName: dto.customerName,
              customerEmail: dto.customerEmail,
              customerPhone: dto.customerPhone,
              fulfillmentType: dto.fulfillmentType as any,
              preferredPaymentMethod: dto.preferredPaymentMethod as any,
              shippingAddress: dto.shippingAddress,
              appointmentId: dto.appointmentId || null,
              notes: dto.notes,
              userId: marketplaceUserId,
              paymentProofUrl: dto.paymentProofUrl || null,
              code: await this.generateReservationCode(),
            },
            include: {
              product: { select: { id: true, name: true, imageUrl: true } },
            },
          });
          // Guardamos la reserva creada en la lista de resultados.
          results.push(reservation);
        }

        // Devolvemos todas las reservas creadas (al cerrar la transacción).
        return results;
      },
      { isolationLevel: 'Serializable' },
    );

    // Si se creó al menos una reserva, emitimos los eventos de la compra.
    // ".length > 0" comprueba que la lista NO esté vacía.
    if (reservations.length > 0) {
      // "first" = la primera reserva. Sus datos de cliente/entrega son comunes a
      // todo el carrito, así que los usamos como cabecera de la compra.
      const first = reservations[0];
      // total = suma de (precio * cantidad + envío) de TODAS las reservas.
      // reduce() recorre la lista acumulando en "sum" (empieza en 0). "r" es
      // cada reserva. "shippingCost || 0" evita sumar null/undefined.
      const total = reservations.reduce(
        (sum, r) => sum + Number(r.unitPrice) * r.quantity + Number(r.shippingCost || 0),
        0,
      );
      // Un solo evento "purchase.created" para todo el carrito (no uno por item).
      this.eventEmitter.emit('purchase.created', {
        tenantId: tenant.id,
        purchase: {
          id: first.id,
          customerName: first.customerName,
          customerEmail: first.customerEmail,
          customerPhone: first.customerPhone,
          fulfillmentType: first.fulfillmentType,
          paymentMethod: first.preferredPaymentMethod,
          // map() transforma CADA reserva "r" en un objeto de item resumido.
          // Devuelve un NUEVO arreglo con un item por cada reserva del carrito.
          items: reservations.map((r) => ({
            productId: r.product.id,
            productName: r.product.name,
            productImage: r.product.imageUrl ?? null, // "??": null si no hay imagen.
            quantity: r.quantity,
            unitPrice: Number(r.unitPrice),
          })),
          total,                    // total calculado arriba.
          createdAt: first.createdAt,
        },
      });

      // Si la compra está ligada a una cita, emitimos un evento por CADA reserva.
      if (first.appointmentId) {
        // "for...of" recorre cada reserva "r" del carrito.
        for (const r of reservations) {
          this.eventEmitter.emit('product_reservation.created', {
            tenantId: tenant.id,
            reservationId: r.id,
            productName: r.product.name,
            clientName: first.customerName,
            quantity: r.quantity,
          });
        }
      }
    }

    // Avisos de stock bajo (uno por cada producto que cruzó el umbral).
    for (const p of stockAlerts) {
      this.eventEmitter.emit('inventory.low_stock', {
        tenantId: tenant.id,
        productId: p.id,
        productName: p.name,
        stock: p.stock,
        threshold: p.minStock,
      });
    }

    // Devolvemos todas las reservas creadas.
    return { data: reservations };
  }

  /**
   * Adjuntar/reemplazar la captura del comprobante de transferencia en una
   * reserva ya creada. Solo el cliente dueño puede hacerlo (verificado
   * contra userId). Si ya había una captura previa, se borra del disco.
   */
  // ───────────────────────────────────────────────────────────────────────────
  // attachPaymentProof(): adjunta/reemplaza la captura del comprobante de pago en
  // una reserva ya existente. Solo el DUEÑO de la reserva puede hacerlo.
  // Recibe: slug del negocio, id de la reserva, el archivo subido y el id del
  // usuario (que el guard obligatorio garantizó). Devuelve la URL guardada.
  // ───────────────────────────────────────────────────────────────────────────
  async attachPaymentProof(
    slug: string,
    reservationId: string,
    file: any,
    marketplaceUserId: string,
  ) {
    // Si no llegó archivo -> error 400.
    if (!file) throw new BadRequestException('Archivo de comprobante requerido');

    // Resolvemos el negocio (valida tienda activa).
    const tenant = await this.resolveTenant(slug);

    // Buscamos la reserva por su id, asegurando que sea de ESTE negocio.
    const reservation = await this.prisma.productReservation.findFirst({
      where: { id: reservationId, tenantId: tenant.id },
    });
    // Si no existe -> 404.
    if (!reservation) throw new NotFoundException('Apartado no encontrado');
    // VERIFICACIÓN DE DUEÑO: "!==" compara que el dueño de la reserva NO sea el
    // usuario actual. Si son distintos, no es su reserva -> error 403 (prohibido).
    if (reservation.userId !== marketplaceUserId) {
      throw new ForbiddenException('No puedes modificar este apartado');
    }
    // Si la reserva ya fue entregada o cancelada, no admite cambios.
    // includes() devuelve true si el estado actual está en la lista.
    // "as string" le indica a TypeScript que tratemos el estado como texto.
    if (['DELIVERED', 'CANCELLED'].includes(reservation.status as string)) {
      throw new BadRequestException('Este apartado ya no admite cambios');
    }

    // Guardamos el nuevo archivo en disco (carpeta 'payments') y obtenemos su URL.
    const newUrl = await this.uploadsService.saveFile(file, 'payments');

    // Borrar la captura anterior si existia
    // Si la reserva ya tenía un comprobante, borramos el archivo viejo del disco
    // para no acumular basura. ".catch(() => {})" ignora cualquier error al
    // borrar (si el archivo ya no estaba, no queremos que rompa la operación).
    if (reservation.paymentProofUrl) {
      await this.uploadsService.deleteFile(reservation.paymentProofUrl).catch(() => {});
    }

    // Actualizamos la reserva con la URL del nuevo comprobante.
    const updated = await this.prisma.productReservation.update({
      where: { id: reservation.id },
      data: { paymentProofUrl: newUrl },
    });

    // Devolvemos solo lo esencial: el id y la nueva URL del comprobante.
    return { data: { id: updated.id, paymentProofUrl: updated.paymentProofUrl } };
  }
}
