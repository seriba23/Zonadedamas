// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// De NestJS:
//   - Injectable: decorador que marca la clase como "servicio" inyectable.
//   - NotFoundException: error que hace responder a la API con HTTP 404 (no encontrado).
//   - BadRequestException: error que responde con HTTP 400 (petición inválida).
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

// PrismaService: el "puente" hacia la base de datos (el ORM Prisma traduce
// JavaScript a SQL). Con this.prisma leemos/escribimos las tablas.
import { PrismaService } from '../../prisma/prisma.service';

// AuditService: servicio para registrar en el "log de auditoría" cada operación
// de escritura (quién creó/editó/borró qué y cuándo).
import { AuditService } from '../audit/audit.service';

// UploadsService: servicio que sabe guardar y borrar archivos físicos (imágenes).
import { UploadsService } from '../uploads/uploads.service';

// DTOs que describen/validan los datos de entrada al crear/actualizar productos.
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

// Fuente de verdad única para "stock bajo": productos activos del tenant
// con minStock configurado (>0). El where Prisma es laxo y la decisión
// final la toma isLowStockRow para que ambos pasos coincidan exactamente
// entre el alert del Home, el filtro del listado y el badge visual.
//
// LOW_STOCK_WHERE: función auxiliar que arma el "where" (condición de filtro) de
// Prisma para buscar candidatos a stock bajo de un negocio concreto.
//   - Recibe: tenantId (id del negocio).
//   - Devuelve: un objeto where que pide productos de ese negocio (tenantId),
//     activos (isActive: true) y con un mínimo configurado mayor que 0
//     (minStock: { gt: 0 } => "gt" significa "greater than" = mayor que).
export function LOW_STOCK_WHERE(tenantId: string) {
  return { tenantId, isActive: true, minStock: { gt: 0 } };
}
// isLowStockRow: función auxiliar que decide si UN producto concreto está en
// stock bajo. Se usa para que el filtro fino sea idéntico en todos los sitios.
//   - Recibe: un objeto con stock y minStock (ambos pueden ser null).
//   - Devuelve: true si el producto está en stock bajo, false si no.
export function isLowStockRow(p: { stock: number | null; minStock: number | null }) {
  // "p.stock ?? 0": el operador "??" (fusión de nulos) usa p.stock si NO es
  // null/undefined; si lo es, usa 0. Así nunca operamos con valores nulos.
  const stock = p.stock ?? 0;
  const minStock = p.minStock ?? 0;
  // Está en stock bajo si: hay un mínimo configurado (minStock > 0) Y el stock
  // actual es menor o igual a ese mínimo (stock <= minStock).
  return minStock > 0 && stock <= minStock;
}

@Injectable() // <- Marca la clase como servicio inyectable de NestJS.
export class ProductsService {
  // El constructor recibe tres servicios que NestJS inyecta automáticamente.
  // "private" los guarda como propiedades (this.prisma, this.audit, this.uploads)
  // para usarlos en todos los métodos de abajo.
  constructor(
    private prisma: PrismaService,   // acceso a la base de datos
    private audit: AuditService,     // registro de auditoría
    private uploads: UploadsService, // guardar/borrar imágenes
  ) {}

  // ───────────────────────────────────────────────────────────────────────────
  // findAll(): lista productos del negocio con paginación y filtros opcionales.
  //   - Recibe: tenantId y un objeto "query" con página, filtros, etc.
  //   - Devuelve: { data: productos, meta: info de paginación }.
  // ───────────────────────────────────────────────────────────────────────────
  async findAll(
    tenantId: string,
    query: {
      page?: number;
      perPage?: number;
      category?: string;
      supplierId?: string;
      isActive?: boolean;
      lowStock?: boolean;
    },
  ) {
    // page: la página pedida. Math.max(1, ...) garantiza mínimo 1 (nunca 0 o negativa).
    // "query.page || 1": si page es 0/undefined (falsy), usa 1.
    const page = Math.max(1, query.page || 1);
    // perPage: cuántos por página. Lo acotamos entre 1 y 100:
    //   - Math.max(1, query.perPage || 20): mínimo 1 (por defecto 20).
    //   - Math.min(100, ...): máximo 100 (para no pedir demasiados de golpe).
    const perPage = Math.min(100, Math.max(1, query.perPage || 20));
    // skip: cuántos registros saltar para llegar a la página pedida.
    // Ej.: página 3 con 20 por página => saltar (3-1)*20 = 40.
    const skip = (page - 1) * perPage;

    // where: condiciones del filtro. Empezamos SIEMPRE por tenantId (multi-tenant:
    // cada negocio solo ve sus productos). El tipo "any" evita choques de tipos al
    // ir agregando propiedades dinámicamente.
    const where: any = { tenantId };
    // Si vino categoría, la añadimos al filtro.
    if (query.category) {
      where.category = query.category;
    }
    // Si vino proveedor, lo añadimos al filtro.
    if (query.supplierId) {
      where.supplierId = query.supplierId;
    }
    // Si vino isActive (puede ser true O false), lo añadimos. Comparamos con
    // "!== undefined" (y NO con un simple if) porque false también es un valor
    // válido que queremos respetar; un "if (query.isActive)" se saltaría false.
    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }
    // Si piden "stock bajo", delegamos en findLowStock (que tiene su propia lógica
    // fina) y salimos de aquí con "return".
    if (query.lowStock) {
      return this.findLowStock(tenantId, { page, perPage });
    }

    // Promise.all ejecuta las DOS consultas EN PARALELO (más rápido que una tras
    // otra) y espera a que ambas terminen. La desestructuración [data, total]
    // guarda el primer resultado en "data" y el segundo en "total".
    const [data, total] = await Promise.all([
      // 1) La página de productos que cumple el filtro.
      this.prisma.product.findMany({
        where,
        include: {
          // supplier: trae solo id y nombre del proveedor relacionado.
          supplier: { select: { id: true, name: true } },
          // images: las imágenes de galería, ordenadas por sortOrder ascendente
          // ('asc' = de menor a mayor).
          images: { orderBy: { sortOrder: 'asc' } },
        },
        // Ordena por fecha de creación descendente ('desc' = más nuevos primero).
        orderBy: { createdAt: 'desc' },
        skip,          // saltar registros de páginas anteriores
        take: perPage, // tomar como mucho "perPage" registros
      }),
      // 2) El total de productos que cumplen el filtro (para calcular páginas).
      this.prisma.product.count({ where }),
    ]);

    // Devolvemos los datos + metadatos de paginación.
    return {
      data,
      meta: {
        total,
        page,
        perPage,
        // totalPages: total de páginas. Math.ceil redondea HACIA ARRIBA (ej. 21
        // registros / 20 = 1.05 => 2 páginas).
        totalPages: Math.ceil(total / perPage),
      },
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // findLowStock(): lista los productos en stock bajo, paginados.
  // Estrategia: traer TODOS los candidatos de la BD y filtrar/paginar en memoria,
  // porque la regla exacta (isLowStockRow) compara dos columnas entre sí (stock
  // <= minStock), algo que el where de Prisma no expresa de forma directa.
  // ───────────────────────────────────────────────────────────────────────────
  async findLowStock(
    tenantId: string,
    query: { page?: number; perPage?: number },
  ) {
    const page = Math.max(1, query.page || 1);
    const perPage = Math.min(100, Math.max(1, query.perPage || 20));
    const skip = (page - 1) * perPage;

    // Traemos todos los candidatos (activos, con minStock > 0) usando el where
    // compartido. orderBy stock 'asc' => los de menos stock primero.
    const allProducts = await this.prisma.product.findMany({
      where: LOW_STOCK_WHERE(tenantId),
      include: {
        supplier: { select: { id: true, name: true } },
        images: { orderBy: { sortOrder: 'asc' } },
      },
      orderBy: { stock: 'asc' },
    });

    // filter() recorre "allProducts" y se queda SOLO con los que cumplan la
    // condición. Le pasamos directamente isLowStockRow como criterio: para cada
    // producto devuelve true (lo conserva) o false (lo descarta).
    const lowStockProducts = allProducts.filter(isLowStockRow);

    // total: cuántos productos en stock bajo hay en total (.length = tamaño de la lista).
    const total = lowStockProducts.length;
    // data: "recortamos" solo la página pedida. slice(inicio, fin) devuelve los
    // elementos desde "skip" hasta "skip + perPage" (sin incluir ese último).
    const data = lowStockProducts.slice(skip, skip + perPage);

    return {
      data,
      meta: {
        total,
        page,
        perPage,
        totalPages: Math.ceil(total / perPage),
      },
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // findOne(): devuelve UN producto del negocio por su id (con proveedor e imágenes).
  // ───────────────────────────────────────────────────────────────────────────
  async findOne(tenantId: string, id: string) {
    // findFirst busca el PRIMER producto que cumpla ambas condiciones: que su id
    // coincida Y que pertenezca a este negocio (tenantId). Lo segundo evita que
    // un negocio pueda leer productos de otro adivinando ids.
    const product = await this.prisma.product.findFirst({
      where: { id, tenantId },
      include: {
        // Aquí además del id y nombre del proveedor traemos su contactName.
        supplier: { select: { id: true, name: true, contactName: true } },
        images: { orderBy: { sortOrder: 'asc' } },
      },
    });
    // "!product" => "si NO hay producto" (no existe o no es de este negocio) -> 404.
    if (!product) throw new NotFoundException('Product not found');
    return { data: product };
  }

  /**
   * Historial de ventas de un producto: ventas en POS (PaymentItem tipo PRODUCT)
   * y apartados de tienda (ProductReservation), con comprador, vendedor (empleado
   * en POS) y la comisión que se generó para ese empleado según la config del producto.
   */
  // ───────────────────────────────────────────────────────────────────────────
  // getSales(): construye el historial de ventas de UN producto, juntando dos
  // canales distintos (POS y tienda online) en una sola lista, y calculando la
  // comisión que cada venta generó al empleado vendedor.
  //   - Recibe: tenantId y productId.
  //   - Devuelve: { data: { sales, totals, count } }.
  // ───────────────────────────────────────────────────────────────────────────
  async getSales(tenantId: string, productId: string) {
    // Primero verificamos que el producto existe y es de este negocio.
    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId },
    });
    if (!product) throw new NotFoundException('Producto no encontrado');

    // commissionFor: función local que calcula la comisión de UNA venta.
    //   - Recibe: qty (cantidad vendida) y unitPrice (precio unitario).
    //   - Devuelve: el importe de comisión (número).
    const commissionFor = (qty: number, unitPrice: number) => {
      // c = el valor de comisión configurado en el producto. Number(...) lo
      // convierte por si Prisma lo entrega como Decimal/objeto; "|| 0" usa 0 si
      // commission es null/undefined/0.
      const c = Number(product.commission || 0);
      // Si no hay comisión configurada (c es 0 => falsy), devolvemos 0 directamente.
      if (!c) return 0;
      // Según el TIPO de comisión decidimos cómo calcular (operador ternario):
      //   - Si commissionType === 'PERCENT' (porcentaje): comisión = precio * c% por
      //     cada unidad, es decir (unitPrice * c) / 100 multiplicado por la cantidad.
      //   - Si no (tipo 'AMOUNT', monto fijo): comisión = c (importe fijo) por unidad,
      //     es decir c * qty.
      return product.commissionType === 'PERCENT'
        ? (unitPrice * c) / 100 * qty
        : c * qty;
    };

    // POS: items de pago que referencian este producto
    // (ventas hechas en el punto de venta / mostrador).
    const posItems = await this.prisma.paymentItem.findMany({
      // Filtramos: items de tipo PRODUCT, que apunten a este producto
      // (referenceId) y cuyo pago pertenezca a este negocio.
      where: { itemType: 'PRODUCT', referenceId: productId, payment: { tenantId } },
      include: {
        // De cada pago traemos: fecha, cliente y (si el pago venía de una cita)
        // el empleado de esa cita, que es quien hizo la venta y cobra comisión.
        payment: {
          select: {
            id: true,
            createdAt: true,
            client: { select: { firstName: true, lastName: true } },
            appointment: {
              select: { employee: { select: { id: true, firstName: true, lastName: true } } },
            },
          },
        },
      },
    });

    // Tienda: apartados (no cancelados)
    // (ventas/apartados hechos por el cliente desde la tienda online).
    const reservations = await this.prisma.productReservation.findMany({
      // "status: { not: 'CANCELLED' }" => todos los apartados MENOS los cancelados.
      where: { productId, tenantId, status: { not: 'CANCELLED' } },
    });

    // posSales: transformamos cada item de POS en un registro de venta uniforme.
    // map() recorre "posItems" y devuelve una NUEVA lista del mismo tamaño, donde
    // cada elemento "it" se convierte en el objeto que armamos abajo.
    const posSales = posItems.map((it) => {
      const qty = Number(it.quantity);   // cantidad vendida (a número)
      const unit = Number(it.unitPrice); // precio unitario (a número)
      // emp = el empleado vendedor. "it.payment.appointment?.employee" usa "?."
      // (optional chaining): si no hay appointment, NO intenta leer .employee y
      // devuelve undefined en vez de romper. "|| null" deja null si no hay empleado.
      const emp = it.payment.appointment?.employee || null;
      return {
        date: it.payment.createdAt,
        // 'POS' as const fija el tipo literal exacto "POS" (no un string genérico).
        channel: 'POS' as const,
        // buyer: nombre del comprador. Ternario: si hay cliente, "Nombre Apellido";
        // si no, el texto genérico 'Cliente'.
        buyer: it.payment.client ? `${it.payment.client.firstName} ${it.payment.client.lastName}` : 'Cliente',
        quantity: qty,
        total: Number(it.totalPrice),
        // sellerId: id del empleado o null. "emp?.id" evita el error si emp es null.
        sellerId: emp?.id || null,
        // seller: nombre del empleado o null (ternario sobre emp).
        seller: emp ? `${emp.firstName} ${emp.lastName}` : null,
        // commission: solo se calcula si HAY empleado vendedor; si no, 0.
        commission: emp ? commissionFor(qty, unit) : 0,
      };
    });

    // shopSales: lo mismo pero para los apartados de la tienda online.
    // map() recorre "reservations" y cada apartado "r" se convierte en un registro.
    const shopSales = reservations.map((r) => {
      const qty = Number(r.quantity);
      const unit = Number(r.unitPrice);
      return {
        date: r.createdAt,
        channel: 'TIENDA' as const,
        buyer: r.customerName,
        quantity: qty,
        // total = precio unitario * cantidad (el apartado no guarda un total).
        total: unit * qty,
        sellerId: null,
        seller: null, // venta en línea, sin empleado vendedor
        commission: 0,
      };
    });

    // sales: juntamos ambas listas en una sola. "[...a, ...b]" (spread) copia los
    // elementos de posSales y luego los de shopSales en un nuevo arreglo.
    // .sort(...) las ordena por fecha DESCENDENTE (más recientes primero):
    //   - Para cada par (a, b) restamos b - a en milisegundos: si el resultado es
    //     positivo, b va antes que a. new Date(...).getTime() = fecha en ms.
    const sales = [...posSales, ...shopSales].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    // totals: sumamos los acumulados de toda la lista con reduce().
    //   - "acc" es el acumulador (empieza en el objeto del final con todo en 0).
    //   - "s" es cada venta en cada vuelta.
    //   - En cada vuelta sumamos sus unidades, ingresos y comisión a "acc".
    //   - Devolvemos "acc" para arrastrarlo a la siguiente vuelta.
    const totals = sales.reduce(
      (acc, s) => {
        acc.units += s.quantity;        // total de unidades vendidas
        acc.revenue += s.total;         // total de ingresos
        acc.commission += s.commission; // total de comisiones
        return acc;
      },
      { units: 0, revenue: 0, commission: 0 }, // valores iniciales del acumulador
    );

    // Devolvemos la lista de ventas, los totales y el número de ventas (.length).
    return { data: { sales, totals, count: sales.length } };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // create(): crea un producto nuevo para el negocio.
  //   - Recibe: tenantId, dto (datos validados) y userId (quién lo crea, opcional
  //     por el "?" en "userId?: string").
  //   - Devuelve: { data: producto creado }.
  // ───────────────────────────────────────────────────────────────────────────
  async create(tenantId: string, dto: CreateProductDto, userId?: string) {
    // Si el producto trae proveedor, validamos que exista, sea de este negocio y
    // esté activo. Así evitamos asociar un proveedor inválido o de otro negocio.
    if (dto.supplierId) {
      const supplier = await this.prisma.supplier.findFirst({
        where: { id: dto.supplierId, tenantId, isActive: true },
      });
      if (!supplier) throw new NotFoundException('Supplier not found');
    }

    // Creamos el producto en la base de datos. Cada campo se toma del dto.
    const product = await this.prisma.product.create({
      data: {
        tenantId,
        name: dto.name,
        sku: dto.sku,
        description: dto.description,
        category: dto.category,
        price: dto.price,
        costPrice: dto.costPrice,
        commission: dto.commission,
        // "dto.commissionType || 'AMOUNT'": si no especificaron tipo, por defecto
        // es 'AMOUNT' (monto fijo).
        commissionType: dto.commissionType || 'AMOUNT',
        // "dto.stock ?? 0": usa el stock dado; si es null/undefined, 0. (Usamos "??"
        // y no "||" para respetar un 0 explícito, que con "||" se perdería.)
        stock: dto.stock ?? 0,
        minStock: dto.minStock ?? 0,
        unit: dto.unit,
        // Moneda por defecto: pesos mexicanos (MXN) si no se indica otra.
        currency: dto.currency || 'MXN',
        supplierId: dto.supplierId,
        supplierUrl: dto.supplierUrl,
        notes: dto.notes,
        // Flags booleanos con valor por defecto si no vienen ("?? false"/"?? true").
        shippingEnabled: dto.shippingEnabled ?? false,
        shippingCost: dto.shippingCost,
        isShopListed: dto.isShopListed ?? false,
        isActive: dto.isActive ?? true,
      },
      include: {
        supplier: { select: { id: true, name: true } },
        images: { orderBy: { sortOrder: 'asc' } },
      },
    });

    // Registramos en auditoría que se creó este producto (acción 'product.created',
    // con los valores nuevos). "as any" relaja el tipo del objeto guardado.
    await this.audit.log({
      tenantId,
      userId,
      action: 'product.created',
      entityType: 'Product',
      entityId: product.id,
      newValues: product as any,
    });

    return { data: product };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // update(): actualiza un producto existente con SOLO los campos que vengan.
  // ───────────────────────────────────────────────────────────────────────────
  async update(
    tenantId: string,
    id: string,
    dto: UpdateProductDto,
    userId?: string,
  ) {
    // Verificamos que el producto exista y sea de este negocio (guardamos su
    // estado anterior en "existing" para la auditoría).
    const existing = await this.prisma.product.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException('Product not found');

    // Si cambian el proveedor, validamos que exista, sea de este negocio y activo.
    if (dto.supplierId) {
      const supplier = await this.prisma.supplier.findFirst({
        where: { id: dto.supplierId, tenantId, isActive: true },
      });
      if (!supplier) throw new NotFoundException('Supplier not found');
    }

    // Actualizamos solo los campos presentes en el dto. El patrón
    //   ...(dto.X !== undefined && { X: dto.X })
    // funciona así: si dto.X NO es undefined (vino en la petición), el "&&"
    // devuelve el objeto { X: dto.X } y "..." (spread) lo mezcla en "data"; si
    // dto.X es undefined, el "&&" devuelve false y el spread de false no agrega
    // nada. Resultado: NO pisamos con undefined los campos que no se enviaron.
    const product = await this.prisma.product.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.sku !== undefined && { sku: dto.sku }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.costPrice !== undefined && { costPrice: dto.costPrice }),
        ...(dto.commission !== undefined && { commission: dto.commission }),
        ...(dto.commissionType !== undefined && { commissionType: dto.commissionType }),
        ...(dto.stock !== undefined && { stock: dto.stock }),
        ...(dto.minStock !== undefined && { minStock: dto.minStock }),
        ...(dto.unit !== undefined && { unit: dto.unit }),
        ...(dto.supplierId !== undefined && { supplierId: dto.supplierId }),
        ...(dto.currency !== undefined && { currency: dto.currency }),
        ...(dto.supplierUrl !== undefined && { supplierUrl: dto.supplierUrl }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.shippingEnabled !== undefined && { shippingEnabled: dto.shippingEnabled }),
        ...(dto.shippingCost !== undefined && { shippingCost: dto.shippingCost }),
        ...(dto.isShopListed !== undefined && { isShopListed: dto.isShopListed }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: {
        supplier: { select: { id: true, name: true } },
        images: { orderBy: { sortOrder: 'asc' } },
      },
    });

    // Auditoría: guardamos valores ANTERIORES (existing) y NUEVOS (product) para
    // poder ver qué cambió exactamente.
    await this.audit.log({
      tenantId,
      userId,
      action: 'product.updated',
      entityType: 'Product',
      entityId: id,
      oldValues: existing as any,
      newValues: product as any,
    });

    return { data: product };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // remove(): elimina un producto y sus archivos de imagen asociados.
  // ───────────────────────────────────────────────────────────────────────────
  async remove(tenantId: string, id: string, userId?: string) {
    // Buscamos el producto trayendo también las URLs de sus imágenes de galería
    // (las necesitamos para borrar los archivos físicos antes de borrar la fila).
    const existing = await this.prisma.product.findFirst({
      where: { id, tenantId },
      include: { images: { select: { imageUrl: true } } },
    });
    if (!existing) throw new NotFoundException('Product not found');

    // Borrar archivos fisicos asociados antes del delete cascade.
    // Si el producto tiene imagen principal, borramos su archivo. ".catch(() => {})"
    // ignora cualquier error al borrar (p. ej. archivo ya inexistente): no queremos
    // que un fallo al borrar un archivo impida eliminar el producto.
    if (existing.imageUrl) {
      await this.uploads.deleteFile(existing.imageUrl).catch(() => {});
    }
    // for...of recorre cada imagen "img" de la galería y borra su archivo físico.
    for (const img of existing.images) {
      await this.uploads.deleteFile(img.imageUrl).catch(() => {});
    }

    // Hard delete. ProductImage y ProductReservation tienen onDelete: Cascade
    // en el schema, asi que se eliminan automaticamente.
    // ("Hard delete" = borrado real de la fila, no un simple marcado como inactivo.)
    await this.prisma.product.delete({ where: { id } });

    // Auditoría del borrado. Guardamos solo nombre y sku como referencia de lo
    // que se eliminó (no hace falta el objeto completo).
    await this.audit.log({
      tenantId,
      userId,
      action: 'product.deleted',
      entityType: 'Product',
      entityId: id,
      oldValues: { name: existing.name, sku: existing.sku },
    });

    return { data: { message: 'Product deleted' } };
  }

  // ─── Image Management ────────────────────────────

  // ───────────────────────────────────────────────────────────────────────────
  // uploadMainImage(): sube/reemplaza la imagen PRINCIPAL de un producto.
  // ───────────────────────────────────────────────────────────────────────────
  async uploadMainImage(
    tenantId: string,
    productId: string,
    file: any,
    userId?: string,
  ) {
    // Verificamos que el producto exista y sea de este negocio.
    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId },
    });
    if (!product) throw new NotFoundException('Product not found');

    // Si ya tenía una imagen principal, borramos el archivo viejo para no dejar
    // basura en el disco antes de poner la nueva.
    if (product.imageUrl) {
      await this.uploads.deleteFile(product.imageUrl);
    }

    // Guardamos el archivo nuevo en la carpeta 'products' y obtenemos su URL.
    const imageUrl = await this.uploads.saveFile(file, 'products');
    // Guardamos esa URL en el producto.
    const updated = await this.prisma.product.update({
      where: { id: productId },
      data: { imageUrl },
    });

    // Devolvemos solo la URL final de la imagen principal.
    return { data: { imageUrl: updated.imageUrl } };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // addGalleryImage(): agrega una imagen a la galería (máximo 5 por producto).
  // ───────────────────────────────────────────────────────────────────────────
  async addGalleryImage(
    tenantId: string,
    productId: string,
    file: any,
    userId?: string,
  ) {
    // Traemos el producto con TODAS sus imágenes de galería (include: { images: true })
    // para poder contar cuántas tiene.
    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId },
      include: { images: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    // Límite de 5: si ya tiene 5 o más (>=), rechazamos con error 400.
    if (product.images.length >= 5) {
      throw new BadRequestException('Maximo 5 imagenes por producto');
    }

    // Guardamos el archivo y creamos la fila ProductImage que lo enlaza al producto.
    const imageUrl = await this.uploads.saveFile(file, 'products');
    const image = await this.prisma.productImage.create({
      data: {
        productId,
        imageUrl,
        // sortOrder = posición de la imagen. Usamos la cantidad actual como índice:
        // si ya hay 2 (índices 0 y 1), la nueva va en la posición 2 (la última).
        sortOrder: product.images.length,
      },
    });

    return { data: image };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // removeGalleryImage(): elimina una imagen concreta de la galería.
  // ───────────────────────────────────────────────────────────────────────────
  async removeGalleryImage(
    tenantId: string,
    productId: string,
    imageId: string,
  ) {
    // Verificamos que el producto exista y sea de este negocio.
    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId },
    });
    if (!product) throw new NotFoundException('Product not found');

    // Verificamos que la imagen exista Y pertenezca a ese producto (evita borrar
    // una imagen de otro producto pasando un imageId ajeno).
    const image = await this.prisma.productImage.findFirst({
      where: { id: imageId, productId },
    });
    if (!image) throw new NotFoundException('Image not found');

    // Borramos primero el archivo físico y luego la fila de la base de datos.
    await this.uploads.deleteFile(image.imageUrl);
    await this.prisma.productImage.delete({ where: { id: imageId } });

    return { data: { message: 'Image removed' } };
  }

  // ─── Reservations (Dashboard) ───────────────────
  // A partir de aquí: lógica de los "apartados" de productos (ProductReservation).

  // ───────────────────────────────────────────────────────────────────────────
  // findAllReservations(): lista los apartados del negocio, paginados y con
  // filtro opcional por estado.
  // ───────────────────────────────────────────────────────────────────────────
  async findAllReservations(
    tenantId: string,
    query: {
      page?: number;
      perPage?: number;
      status?: string;
    },
  ) {
    const page = Math.max(1, query.page || 1);
    const perPage = Math.min(100, Math.max(1, query.perPage || 20));
    const skip = (page - 1) * perPage;

    // Filtro base por negocio; agregamos el estado solo si vino.
    const where: any = { tenantId };
    if (query.status) {
      where.status = query.status;
    }

    // En paralelo: la página de apartados + el total que cumplen el filtro.
    const [data, total] = await Promise.all([
      this.prisma.productReservation.findMany({
        where,
        include: {
          // De cada apartado traemos datos resumidos del producto, de la cita
          // asociada (si la hay) y del usuario que lo hizo.
          product: { select: { id: true, name: true, imageUrl: true } },
          appointment: { select: { id: true, startTime: true, status: true } },
          user: { select: { id: true, avatarUrl: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: perPage,
      }),
      this.prisma.productReservation.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        perPage,
        totalPages: Math.ceil(total / perPage),
      },
    };
  }

  /**
   * Apartados cobrables: status no terminal + (sin cita o cita CANCELLED).
   * Devuelve los datos minimos que necesita el POS para precargar el cart
   * y el cliente: producto, cantidad, precio, cliente (snapshot) y un
   * flag para saber si vino de cita cancelada vs apartado puro.
   */
  // ───────────────────────────────────────────────────────────────────────────
  // findPayableReservations(): apartados que SÍ se pueden cobrar desde el POS.
  // ───────────────────────────────────────────────────────────────────────────
  async findPayableReservations(tenantId: string) {
    const reservations = await this.prisma.productReservation.findMany({
      where: {
        tenantId,
        // "status: { in: [...] }" => el estado debe estar EN esta lista (no terminal,
        // es decir, ni entregado ni cancelado).
        status: { in: ['PENDING', 'CONFIRMED', 'READY'] },
        // OR => se cumple si CUALQUIERA de estas condiciones es verdadera:
        OR: [
          // 1) El apartado no tiene cita asociada (apartado puro de tienda).
          { appointmentId: null },
          // 2) Tiene cita pero esa cita está CANCELLED (la cita ya no la cobrará,
          //    así que el apartado pasa a ser cobrable aquí).
          { appointment: { status: 'CANCELLED' } },
        ],
      },
      include: {
        product: { select: { id: true, name: true, imageUrl: true } },
        appointment: { select: { id: true, status: true, startTime: true } },
        user: { select: { id: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return { data: reservations };
  }

  /**
   * Ventas de productos en un rango. El rango lo controla el selector de
   * fechas global de /reports, asi que devolvemos un solo bucket
   * { count, revenue } para ese periodo. Si no viene rango, defaults a
   * todos los registros (total historico).
   */
  // ───────────────────────────────────────────────────────────────────────────
  // getSalesStats(): estadísticas de ventas de productos (apartados entregados)
  // en un rango de fechas, más las 5 ventas más recientes.
  // ───────────────────────────────────────────────────────────────────────────
  async getSalesStats(
    tenantId: string,
    range?: { startDate?: string; endDate?: string },
  ) {
    // Base del filtro: este negocio y solo apartados DELIVERED (entregados =
    // ventas concretadas).
    const where: any = { tenantId, status: 'DELIVERED' };
    // Si vino fecha de inicio O de fin, filtramos por updatedAt (cuándo se marcó
    // como entregado). "range?." evita romper si "range" no se pasó.
    if (range?.startDate || range?.endDate) {
      where.updatedAt = {};
      // gte = "greater than or equal" (>=): desde el inicio del día de startDate.
      if (range.startDate) where.updatedAt.gte = new Date(`${range.startDate}T00:00:00Z`);
      // lte = "less than or equal" (<=): hasta el final del día de endDate.
      if (range.endDate) where.updatedAt.lte = new Date(`${range.endDate}T23:59:59Z`);
    }

    // En paralelo: el agregado del periodo + las 5 ventas más recientes.
    const [periodSales, recentSales] = await Promise.all([
      // aggregate calcula valores agregados sobre las filas que cumplen el where:
      //   - _sum: { unitPrice: true } => suma de los precios unitarios.
      //   - _count: true => cuántas filas hay.
      this.prisma.productReservation.aggregate({
        where,
        _sum: { unitPrice: true },
        _count: true,
      }),
      // Las 5 ventas entregadas más recientes (sin importar el rango de fechas),
      // para mostrar una lista de "últimas ventas".
      this.prisma.productReservation.findMany({
        where: { tenantId, status: 'DELIVERED' },
        include: { product: { select: { id: true, name: true, imageUrl: true } } },
        orderBy: { updatedAt: 'desc' },
        take: 5, // solo las 5 primeras
      }),
    ]);

    return {
      data: {
        period: {
          count: periodSales._count,
          // "_sum.unitPrice || 0": si no hubo ventas, la suma viene null; el "|| 0"
          // la convierte en 0. Number(...) asegura que sea número.
          revenue: Number(periodSales._sum.unitPrice || 0),
        },
        recent: recentSales,
      },
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // updateReservationStatus(): cambia el estado de un apartado, validando que la
  // transición sea legal y devolviendo stock si se cancela.
  // ───────────────────────────────────────────────────────────────────────────
  async updateReservationStatus(
    tenantId: string,
    reservationId: string,
    newStatus: string,
    userId?: string,
  ) {
    // Verificamos que el apartado exista y sea de este negocio.
    const reservation = await this.prisma.productReservation.findFirst({
      where: { id: reservationId, tenantId },
    });
    if (!reservation) throw new NotFoundException('Reservation not found');

    // "Máquina de estados": para cada estado actual, la lista de estados a los que
    // se PUEDE pasar. Record<string, string[]> = objeto cuyas claves son textos y
    // sus valores son listas de textos.
    const validTransitions: Record<string, string[]> = {
      PENDING: ['CONFIRMED', 'CANCELLED'],   // de pendiente -> confirmar o cancelar
      CONFIRMED: ['READY', 'CANCELLED'],     // de confirmado -> listo o cancelar
      READY: ['DELIVERED', 'CANCELLED'],     // de listo -> entregado o cancelar
    };

    // allowed = estados permitidos desde el estado actual. Si el estado actual no
    // está en el mapa (p. ej. ya DELIVERED/CANCELLED), "|| []" deja una lista vacía
    // (no se permite ninguna transición).
    const allowed = validTransitions[reservation.status] || [];
    // Si el nuevo estado NO está en la lista de permitidos (!...includes), error 400.
    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(
        `No se puede cambiar de ${reservation.status} a ${newStatus}`,
      );
    }

    // Aplicamos el cambio de estado. "newStatus as any" evita un choque de tipos
    // con el enum de Prisma (newStatus llega como string genérico).
    const updated = await this.prisma.productReservation.update({
      where: { id: reservationId },
      data: { status: newStatus as any },
      include: {
        product: { select: { id: true, name: true } },
      },
    });

    // Restore stock if cancelled
    // Si se cancela, devolvemos al stock las unidades que estaban apartadas.
    // "increment" suma esa cantidad al stock actual del producto.
    if (newStatus === 'CANCELLED') {
      await this.prisma.product.update({
        where: { id: reservation.productId },
        data: { stock: { increment: reservation.quantity } },
      });
    }

    // Auditoría: guardamos el estado anterior y el nuevo.
    await this.audit.log({
      tenantId,
      userId,
      action: 'reservation.status_changed',
      entityType: 'ProductReservation',
      entityId: reservationId,
      oldValues: { status: reservation.status } as any,
      newValues: { status: newStatus } as any,
    });

    return { data: updated };
  }
}
