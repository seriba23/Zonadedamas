// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// Injectable: decorador (etiqueta "@") de NestJS que marca esta clase como un
// "servicio" inyectable, es decir, algo que NestJS puede crear y entregar a
// otras clases (como el controlador) automáticamente.
import { Injectable } from '@nestjs/common';

// PrismaService es nuestro "puente" hacia la base de datos. Prisma es el ORM
// (la herramienta) que convierte llamadas de JavaScript en consultas SQL. A
// través de this.prisma leeremos tablas: appointment, payment, client, etc.
import { PrismaService } from '../../prisma/prisma.service';

// Reutilizamos dos piezas del módulo de productos para contar "stock bajo"
// EXACTAMENTE igual que en /inventory (así los números coinciden):
//   - LOW_STOCK_WHERE(tenantId): construye el filtro "where" de productos con
//     stock bajo para un negocio concreto.
//   - isLowStockRow: función que, dado un producto (con stock y minStock),
//     dice true/false si realmente está bajo de stock.
import { LOW_STOCK_WHERE, isLowStockRow } from '../products/products.service';

// @Injectable() marca la clase como servicio inyectable de NestJS.
@Injectable()
export class ReportsService {
  // El constructor recibe el PrismaService que NestJS inyecta automáticamente.
  // "private readonly prisma" lo guarda como propiedad de solo lectura
  // (this.prisma) para usarlo en todos los métodos de abajo.
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Desglose de "Venta Total" del período: servicios sueltos | paquetes | productos.
   * Endpoint ligero usado en /reports, /home y /pos history para el grid
   * "Venta Total". Mantiene el mismo criterio de fechas que getDashboardReport
   * (startTime para servicios/paquetes; updatedAt para productos DELIVERED).
   */
  async getSalesBreakdown(tenantId: string, startDate: string, endDate: string) {
    // Convertimos los textos de fecha ("2026-06-01") en objetos Date que marcan
    // el INICIO y el FIN del rango. La "Z" final significa zona horaria UTC.
    //   - start: 00:00:00 del primer día.
    //   - end:   23:59:59 del último día (para incluir todo ese día completo).
    const start = new Date(`${startDate}T00:00:00Z`);
    const end = new Date(`${endDate}T23:59:59Z`);

    // Promise.all([...]) lanza VARIAS consultas a la vez (en paralelo) y espera
    // a que TODAS terminen. Es más rápido que pedirlas una por una. El resultado
    // llega como un arreglo que aquí "desestructuramos" en dos variables:
    // completedAppts (citas completadas) y productSales (ventas de productos).
    const [completedAppts, productSales] = await Promise.all([
      // 1) Citas COMPLETADAS del período (su startTime cae dentro del rango).
      this.prisma.appointment.findMany({
        where: {
          tenantId,                 // SIEMPRE filtramos por el negocio (multi-tenant).
          status: 'COMPLETED',      // solo citas ya terminadas.
          // gte = "mayor o igual que" (>=); lte = "menor o igual que" (<=).
          // Es decir: start <= startTime <= end.
          startTime: { gte: start, lte: end },
        },
        // select = qué campos traer (menos campos = consulta más liviana).
        select: {
          bundleId: true,           // si la cita pertenece a un paquete, aquí va su id.
          items: { select: { priceSnapshot: true } }, // precios "congelados" al reservar.
        },
      }),
      // 2) Ventas de PRODUCTOS: reservas en estado DELIVERED (ya entregadas).
      this.prisma.productReservation.findMany({
        where: {
          tenantId,
          status: 'DELIVERED',
          // Aquí filtramos por updatedAt (cuándo pasó a DELIVERED = entrega real),
          // no por startTime, porque los productos no tienen "hora de cita".
          updatedAt: { gte: start, lte: end },
        },
        select: { quantity: true, unitPrice: true }, // cantidad y precio unitario.
      }),
    ]);

    // Acumuladores: "services" suma servicios sueltos; "bundles" suma paquetes.
    // Empiezan en 0 y van creciendo dentro del bucle.
    let services = 0;
    let bundles = 0;
    // for..of recorre UNA por UNA cada cita completada.
    for (const apt of completedAppts) {
      // reduce() recorre los items (servicios) de ESTA cita y los "reduce" a un
      // único total:
      //   - "s" es el acumulador (empieza en 0, ver el 0 del final).
      //   - "i" es cada item en cada vuelta.
      //   - Number(i.priceSnapshot): convertimos el precio (que Prisma entrega
      //     como Decimal/objeto) a número normal para poder sumarlo.
      const itemsTotal = apt.items.reduce((s, i) => s + Number(i.priceSnapshot), 0);
      // Si la cita tiene bundleId (pertenece a un paquete), su total va a
      // "bundles"; si no, va a "services". (if/else clasifica el ingreso.)
      if (apt.bundleId) bundles += itemsTotal;
      else services += itemsTotal;
    }
    // "products": total de ventas de productos.
    let products = 0;
    // Recorremos cada venta y sumamos precio_unitario * cantidad.
    for (const sale of productSales) {
      products += Number(sale.unitPrice) * sale.quantity;
    }
    // "total": la suma de los tres grupos (la "Venta Total" del período).
    const total = services + bundles + products;

    // Devolvemos los cuatro montos REDONDEADOS a 2 decimales.
    // El truco "Math.round(x * 100) / 100" redondea a centavos:
    //   - multiplica por 100 (12.3456 -> 1234.56),
    //   - redondea al entero más cercano (-> 1235),
    //   - divide entre 100 (-> 12.35).
    return {
      total: Math.round(total * 100) / 100,
      services: Math.round(services * 100) / 100,
      bundles: Math.round(bundles * 100) / 100,
      products: Math.round(products * 100) / 100,
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // getDashboardReport(): el reporte GRANDE del dashboard. Recibe el negocio
  // (tenantId) y un rango de fechas (texto), y devuelve un objeto enorme con
  // KPIs, ingresos por día, top servicios/empleados/clientes, métodos de pago,
  // métricas de clientes y actividad reciente.
  // ───────────────────────────────────────────────────────────────────────────
  async getDashboardReport(tenantId: string, startDate: string, endDate: string) {
    // Inicio (00:00:00) y fin (23:59:59) del rango, en UTC (ver la "Z").
    const start = new Date(`${startDate}T00:00:00Z`);
    const end = new Date(`${endDate}T23:59:59Z`);

    // Lanzamos SEIS consultas en paralelo con Promise.all y desestructuramos sus
    // resultados en estas seis variables (en el mismo orden que las consultas).
    const [
      appointments,   // todas las citas del rango (con relaciones incluidas).
      payments,       // pagos COMPLETADOS del rango.
      clients,        // número TOTAL de clientes del negocio.
      newClients,     // número de clientes NUEVOS en el rango.
      recentActivity, // últimos 10 eventos del negocio (para "actividad reciente").
      productSales,   // ventas de productos entregados (para ingresos + ganancia).
      depositAgg,     // suma de ANTICIPOS recibidos en el rango (isDeposit).
      depositTenant,  // ¿el negocio tiene el anticipo habilitado? (para mostrar la tarjeta).
    ] = await Promise.all([
      // 1) TODAS las citas del rango (sin filtrar por estado: aquí entran
      //    pendientes, completadas, canceladas, etc.; ya las separaremos abajo).
      this.prisma.appointment.findMany({
        where: {
          tenantId,                            // siempre por negocio.
          startTime: { gte: start, lte: end }, // start <= startTime <= end.
        },
        // include = traer también datos de tablas relacionadas:
        include: {
          // items: los servicios de la cita, con su nombre, precio y comisión
          // "congelados" (snapshot) al momento de reservar.
          items: { select: { serviceNameSnapshot: true, priceSnapshot: true, commissionSnapshot: true } },
          // employee: el empleado que atendió (id, nombre, foto y color).
          employee: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, color: true } },
          // client: el cliente (id, nombre, foto y "source" = de dónde vino).
          client: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, source: true } },
          // payments: los pagos asociados a esa cita.
          payments: { select: { status: true, totalAmount: true, paymentMethod: true } },
        },
      }),
      // 2) Pagos COMPLETADOS del rango (filtrando por createdAt = fecha de cobro).
      this.prisma.payment.findMany({
        where: {
          tenantId,
          status: 'COMPLETED',
          createdAt: { gte: start, lte: end },
        },
        select: { totalAmount: true, paymentMethod: true, createdAt: true },
      }),
      // 3) Conteo TOTAL de clientes del negocio (count = solo cuenta cuántos hay).
      this.prisma.client.count({ where: { tenantId } }),
      // 4) Conteo de clientes NUEVOS: los creados dentro del rango de fechas.
      this.prisma.client.count({
        where: { tenantId, createdAt: { gte: start, lte: end } },
      }),
      // 5) Eventos recientes del dominio (bitácora interna del sistema).
      this.prisma.domainEvent.findMany({
        where: { tenantId, createdAt: { gte: start, lte: end } },
        orderBy: { createdAt: 'desc' }, // 'desc' = de más nuevo a más viejo.
        take: 10,                       // solo los 10 primeros (los más recientes).
        select: { eventName: true, payload: true, createdAt: true },
      }),
      // 6) Ventas de productos (reservas DELIVERED) — para ingresos + ganancia.
      // updatedAt es cuando paso a DELIVERED (entrega real). Si en el futuro
      // agregamos deliveredAt explicito, cambiamos a ese campo.
      this.prisma.productReservation.findMany({
        where: {
          tenantId,
          status: 'DELIVERED',
          updatedAt: { gte: start, lte: end },
        },
        select: {
          quantity: true,
          unitPrice: true,
          // De la tabla relacionada "product" traemos su costo (para la ganancia).
          product: { select: { costPrice: true } },
        },
      }),
      // 7) ANTICIPOS recibidos en el rango: suma de los pagos isDeposit COMPLETED
      //    (los anticipos que el negocio confirmó como recibidos).
      this.prisma.payment.aggregate({
        where: {
          tenantId,
          isDeposit: true,
          status: 'COMPLETED',
          createdAt: { gte: start, lte: end },
        },
        _sum: { totalAmount: true },
      }),
      // 8) ¿El negocio usa anticipo? Para decidir si mostrar la tarjeta.
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { depositEnabled: true },
      }),
    ]);

    // ─── KPIs (indicadores clave de desempeño) ──────
    // .length = cuántos elementos tiene el arreglo. Total de citas del rango.
    const totalAppointments = appointments.length;
    // filter() crea un NUEVO arreglo solo con las citas que cumplen la condición.
    // "a.status === 'COMPLETED'" => "===" compara valor Y tipo (igualdad estricta).
    // Luego .length cuenta cuántas quedaron. Así contamos las completadas.
    const completedAppointments = appointments.filter((a) => a.status === 'COMPLETED').length;
    // Igual pero para las canceladas.
    const cancelledAppointments = appointments.filter((a) => a.status === 'CANCELLED').length;
    // Igual pero para las "no-show" (el cliente no se presentó).
    const noShowCount = appointments.filter((a) => a.status === 'NO_SHOW').length;
    // Tasa de no-show como porcentaje con 1 decimal. Operador ternario:
    //   condición ? valorSiVerdadero : valorSiFalso
    // Si hay al menos una cita (evita dividir entre 0), calculamos el %:
    //   (noShows / total) * 1000, redondeamos y / 10 => deja UN decimal.
    //   Ej.: 1/8 = 0.125 -> *1000 = 125 -> round 125 -> /10 = 12.5 (%).
    // Si no hay citas, devolvemos 0.
    const noShowRate = totalAppointments > 0 ? Math.round((noShowCount / totalAppointments) * 1000) / 10 : 0;

    // Revenue from completed appointment items (source of truth)
    // "completedApts" = el arreglo (no solo el conteo) de citas completadas.
    // Lo reutilizaremos varias veces más abajo, por eso lo guardamos.
    const completedApts = appointments.filter((a) => a.status === 'COMPLETED');
    // INGRESO TOTAL por servicios: reduce DENTRO de reduce (doble suma).
    //   - reduce externo: recorre cada cita "a", acumulando en "sum".
    //   - reduce interno: por cada cita, suma los precios de SUS items en "s".
    // Resultado: la suma de todos los precios de todos los servicios completados.
    const totalRevenue = completedApts.reduce(
      (sum, a) => sum + a.items.reduce((s, i) => s + Number(i.priceSnapshot), 0), 0,
    );
    // Ticket promedio = ingreso / citas completadas (redondeado a 2 decimales).
    // Ternario para evitar división entre 0 (si no hay completadas, da 0).
    const averageTicket = completedAppointments > 0 ? Math.round((totalRevenue / completedAppointments) * 100) / 100 : 0;

    // ─── Combined revenue (services + products) + profit ──
    // Servicios: ya esta calculado en totalRevenue
    // Comisiones de servicios: suma de commissionSnapshot en items de citas completadas
    // (mismo patrón de doble reduce que totalRevenue, pero sobre la comisión).
    // "Number(i.commissionSnapshot || 0)": si la comisión es null/undefined, el
    // "|| 0" usa 0 para no romper la suma.
    const serviceCommissions = completedApts.reduce(
      (sum, a) => sum + a.items.reduce((s, i) => s + Number(i.commissionSnapshot || 0), 0), 0,
    );
    // Productos: revenue = sum(unitPrice * quantity), cost = sum(costPrice * quantity)
    // costPrice puede ser null (producto sin costo registrado) → contamos 0 para no
    // inflar la ganancia con costos desconocidos. El revenue siempre suma.
    let productRevenue = 0; // ingresos por venta de productos.
    let productCost = 0;    // costo de esos productos (lo que le costaron al negocio).
    // Recorremos cada venta de producto entregada.
    for (const sale of productSales) {
      const qty = sale.quantity;                           // cantidad vendida.
      productRevenue += Number(sale.unitPrice) * qty;      // ingreso = precio * cantidad.
      // costo = costoUnitario * cantidad. El "|| 0" cubre el caso costPrice null.
      productCost += Number(sale.product.costPrice || 0) * qty;
    }
    // Fase A: ganancia = (servicios - comisiones servicios) + (ventas productos - costo productos).
    // Cuando se agreguen comisiones de productos (Fase B), restarlas aqui tambien.
    // Ingreso TOTAL combinado = servicios + productos.
    const totalRevenueAll = totalRevenue + productRevenue;
    // Ganancia TOTAL = (ingreso servicios - comisiones) + (ingreso productos - costo).
    const totalProfit = (totalRevenue - serviceCommissions) + (productRevenue - productCost);

    // ─── Revenue by day (ingresos por día, de las citas completadas) ──
    // "revenueByDay" es un objeto-diccionario: la CLAVE es la fecha ("2026-06-08")
    // y el VALOR es { revenue, count } (ingreso y número de citas de ese día).
    // Record<string, {...}> es solo el tipo: "claves de texto -> ese objeto".
    const revenueByDay: Record<string, { revenue: number; count: number }> = {};
    // Recorremos cada cita completada y la agrupamos por su día.
    for (const apt of completedApts) {
      // Sacamos solo la parte de fecha de su startTime ("2026-06-08").
      const day = apt.startTime.toISOString().split('T')[0];
      // Si todavía no existe una entrada para ese día, la inicializamos en ceros.
      // "!revenueByDay[day]" = "si NO hay nada guardado para ese día".
      if (!revenueByDay[day]) revenueByDay[day] = { revenue: 0, count: 0 };
      // Sumamos al día el total de servicios de esta cita (reduce sobre sus items).
      revenueByDay[day].revenue += apt.items.reduce((s, i) => s + Number(i.priceSnapshot), 0);
      // Y sumamos 1 al contador de citas de ese día.
      revenueByDay[day].count += 1;
    }
    // Llenar TODOS los dias del rango con 0 si no hay datos. Sin esto el
    // grafico salta dias (8, 10, 13, 15 en lugar de 8, 9, 10, ...) y a
    // veces no muestra barras porque el array queda con un solo punto.
    {
      // "cursor" es una fecha que iremos avanzando día a día desde "start".
      const cursor = new Date(start);
      // Mientras el cursor no pase del fin del rango...
      while (cursor <= end) {
        const day = cursor.toISOString().split('T')[0];
        // ...si ese día no tiene entrada, la creamos en ceros.
        if (!revenueByDay[day]) revenueByDay[day] = { revenue: 0, count: 0 };
        // Avanzamos el cursor un día: getUTCDate() devuelve el día del mes y
        // setUTCDate(día + 1) lo adelanta (JS ajusta solo el cambio de mes).
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
    }
    // Convertimos el diccionario en un ARREGLO ordenado por fecha (para el gráfico):
    //   - Object.entries(obj) => lista de pares [clave, valor], aquí [fecha, datos].
    //   - .map(([date, data]) => ({ date, ...data })): por cada par creamos un
    //     objeto plano { date, revenue, count }. El "...data" (spread) copia las
    //     propiedades revenue y count dentro del nuevo objeto.
    //   - .sort(...): ordena por fecha de menor a mayor. localeCompare compara
    //     dos textos alfabéticamente: devuelve negativo/0/positivo, que es lo que
    //     sort necesita para ordenar (como "2026-06-08" < "2026-06-09").
    const revenueByDayArray = Object.entries(revenueByDay)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // ─── Top services (servicios más vendidos) ──────
    // Diccionario indexado por NOMBRE de servicio -> { name, count, revenue }.
    const serviceMap: Record<string, { name: string; count: number; revenue: number }> = {};
    // Recorremos solo las citas completadas (filter las selecciona).
    for (const apt of appointments.filter((a) => a.status === 'COMPLETED')) {
      // Y dentro de cada cita, recorremos cada servicio (item).
      for (const item of apt.items) {
        const name = item.serviceNameSnapshot; // nombre del servicio (clave).
        // Si es la primera vez que vemos ese servicio, lo inicializamos.
        if (!serviceMap[name]) serviceMap[name] = { name, count: 0, revenue: 0 };
        serviceMap[name].count += 1;                       // +1 a las veces vendido.
        serviceMap[name].revenue += Number(item.priceSnapshot); // +precio al ingreso.
      }
    }
    // Object.values(obj) => lista con SOLO los valores del diccionario (sin claves).
    // .sort((a, b) => b.revenue - a.revenue): orden DESCENDENTE por ingreso.
    //   Restar "b - a" pone primero el de mayor revenue (positivo => b va antes).
    // .slice(0, 10): toma los 10 primeros (el "top 10").
    const topServices = Object.values(serviceMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // ─── Top employees (empleados que más facturan) ─
    // Diccionario indexado por ID de empleado -> sus datos + acumulados.
    const empMap: Record<string, { id: string; name: string; avatarUrl: string | null; color: string | null; appointments: number; revenue: number }> = {};
    for (const apt of appointments.filter((a) => a.status === 'COMPLETED')) {
      const emp = apt.employee; // el empleado de esta cita (puede no tener uno).
      // "if (!emp) continue;" => si la cita no tiene empleado, saltamos a la
      // siguiente vuelta del bucle (no la contamos).
      if (!emp) continue;
      // Primera vez que vemos a este empleado: inicializamos su entrada.
      if (!empMap[emp.id]) empMap[emp.id] = {
        id: emp.id,
        // Template string: une nombre y apellido con un espacio. Ej.: "Ana Pérez".
        name: `${emp.firstName} ${emp.lastName}`,
        // "??" (nullish coalescing): usa la derecha solo si la izquierda es
        // null o undefined (a diferencia de "||", que también caería con "" o 0).
        avatarUrl: emp.avatarUrl ?? null,
        color: emp.color ?? null,
        appointments: 0,
        revenue: 0,
      };
      empMap[emp.id].appointments += 1; // +1 cita atendida por este empleado.
      // +ingreso de esta cita (suma de sus items) al total del empleado.
      empMap[emp.id].revenue += apt.items.reduce((s, i) => s + Number(i.priceSnapshot), 0);
    }
    // Top 10 empleados por ingreso (mismo patrón values -> sort desc -> slice).
    const topEmployees = Object.values(empMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // ─── Payment methods (desglose por método de pago) ──
    // Diccionario indexado por método ("CASH", "CARD", ...) -> { count, total }.
    const paymentMethods: Record<string, { count: number; total: number }> = {};
    // Recorremos cada pago completado del rango.
    for (const p of payments) {
      const method = p.paymentMethod; // el método de este pago (la clave).
      if (!paymentMethods[method]) paymentMethods[method] = { count: 0, total: 0 };
      paymentMethods[method].count += 1;                 // +1 pago con ese método.
      paymentMethods[method].total += Number(p.totalAmount); // +monto al total.
    }

    // ─── Client metrics (métricas de clientes) ──────
    // Set = colección de valores ÚNICOS (sin repetidos). Construimos el conjunto
    // de IDs de cliente que aparecen en las citas del rango:
    //   - .map(a => a.client?.id): saca el id del cliente de cada cita. El "?."
    //     (optional chaining) evita error si la cita no tiene cliente (devuelve
    //     undefined en ese caso, en vez de romper).
    //   - .filter(Boolean): elimina los valores "falsy" (undefined/null/""),
    //     dejando solo IDs reales. (Boolean usado como función convierte cada
    //     valor a true/false; filter conserva los true.)
    const clientIds = new Set(appointments.map((a) => a.client?.id).filter(Boolean));
    // groupBy: AGRUPA en la base de datos las citas COMPLETADAS por clientId y
    // cuenta cuántas tiene cada cliente. Sirve para saber qué clientes "vuelven".
    const returningClientsResult = await this.prisma.appointment.groupBy({
      by: ['clientId'],                 // agrupa por cliente.
      where: {
        tenantId,
        status: 'COMPLETED',
        // "in: [...]" => clientId que esté DENTRO de esta lista. "[...clientIds]"
        // (spread) convierte el Set en un arreglo normal. "as string[]" es solo
        // una afirmación de tipo para TypeScript (decirle "esto es string[]").
        clientId: { in: [...clientIds] as string[] },
      },
      _count: { id: true },             // cuenta cuántas citas por grupo (cliente).
      // having: filtro DESPUÉS de agrupar. "_count > 1" => solo clientes con MÁS
      // de una cita completada (es decir, clientes que regresaron). gt = ">".
      having: { id: { _count: { gt: 1 } } },
    });
    // returningClients = cuántos clientes "que vuelven" hay (= filas del groupBy).
    const returningClients = returningClientsResult.length;
    // Tasa de retención (%): clientes que vuelven / clientes únicos del rango.
    // ".size" es cuántos elementos tiene el Set. Ternario evita dividir entre 0.
    // *1000, round, /10 => porcentaje con un decimal (mismo truco que noShowRate).
    const retentionRate = clientIds.size > 0 ? Math.round((returningClients / clientIds.size) * 1000) / 10 : 0;

    // Top clients by spend (clientes que más gastan)
    // Diccionario por ID de cliente -> sus datos + visitas + gasto acumulado.
    const clientSpend: Record<string, { id: string; name: string; avatarUrl: string | null; visits: number; spent: number }> = {};
    for (const apt of appointments.filter((a) => a.status === 'COMPLETED')) {
      const c = apt.client;        // el cliente de la cita.
      if (!c) continue;            // si no hay cliente, saltamos esta cita.
      // Primera vez que vemos al cliente: inicializamos su entrada.
      if (!clientSpend[c.id]) clientSpend[c.id] = {
        id: c.id,
        name: `${c.firstName} ${c.lastName}`,
        avatarUrl: c.avatarUrl ?? null, // foto o null si no tiene.
        visits: 0,
        spent: 0,
      };
      clientSpend[c.id].visits += 1; // +1 visita (cita completada).
      // +lo gastado en esta cita (suma de sus items) al total del cliente.
      clientSpend[c.id].spent += apt.items.reduce((s, i) => s + Number(i.priceSnapshot), 0);
    }
    // Top 10 clientes por gasto (values -> sort descendente por "spent" -> 10).
    const topClients = Object.values(clientSpend)
      .sort((a, b) => b.spent - a.spent)
      .slice(0, 10);

    // By source (de dónde vinieron los clientes de las citas)
    // Diccionario por origen ("WALK_IN", "ONLINE", ...) -> cantidad de citas.
    const bySource: Record<string, number> = {};
    // Recorremos TODAS las citas (no solo completadas).
    for (const apt of appointments) {
      // Origen del cliente; "?." por si no hay cliente, y "|| 'UNKNOWN'" para
      // poner un valor por defecto cuando el origen falte o sea vacío.
      const source = apt.client?.source || 'UNKNOWN';
      // Sumamos 1 al contador de ese origen. "(bySource[source] || 0)" arranca
      // en 0 la primera vez (cuando aún no existe la clave) y luego va sumando.
      bySource[source] = (bySource[source] || 0) + 1;
    }

    // ─── Recent activity (actividad reciente, legible para humanos) ──
    // map() transforma CADA evento técnico en un objeto con descripción amigable.
    // Devuelve un NUEVO arreglo del mismo largo (uno por evento).
    const activityItems = recentActivity.map((e) => {
      // Por defecto la descripción es el nombre técnico del evento.
      // "let" porque la reasignaremos según el tipo de evento.
      let description = e.eventName;
      // Cadena if/else if: comparamos el nombre del evento (=== igualdad estricta)
      // y elegimos un texto en español según corresponda.
      if (e.eventName === 'appointment.created') description = `Nueva cita`;
      else if (e.eventName === 'appointment.cancelled') description = `Cita cancelada`;
      else if (e.eventName === 'appointment.completed') description = `Cita completada`;
      else if (e.eventName === 'payment.completed') description = `Pago recibido`;
      else if (e.eventName === 'client.created') description = `Nuevo cliente`;

      // Objeto final que verá el frontend: tipo, descripción y cuándo ocurrió.
      return {
        type: e.eventName,
        description,
        time: e.createdAt,
      };
    });

    // Objeto final del reporte. Los montos se redondean a 2 decimales con el
    // truco "Math.round(x * 100) / 100" (a centavos). Los conteos y tasas ya
    // venían listos de arriba, así que se devuelven tal cual.
    return {
      kpis: {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        // Fase A — desglose para cards "Todos los ingresos" y "Todas las ganancias"
        productRevenue: Math.round(productRevenue * 100) / 100,
        productCost: Math.round(productCost * 100) / 100,
        serviceCommissions: Math.round(serviceCommissions * 100) / 100,
        totalRevenueAll: Math.round(totalRevenueAll * 100) / 100,
        totalProfit: Math.round(totalProfit * 100) / 100,
        totalAppointments,
        completedAppointments,
        cancelledAppointments,
        noShowCount,
        noShowRate,
        averageTicket,
        newClients,
        totalClients: clients, // "clients" es el conteo total; aquí se renombra.
        // Anticipos recibidos en el rango + si el negocio usa anticipo (para la tarjeta).
        depositReceived: Math.round(Number(depositAgg._sum.totalAmount || 0) * 100) / 100,
        depositEnabled: !!depositTenant?.depositEnabled,
      },
      revenueByDay: revenueByDayArray, // arreglo ordenado por fecha (para gráfico).
      topServices,                     // top 10 servicios por ingreso.
      topEmployees,                    // top 10 empleados por ingreso.
      paymentMethods,                  // desglose por método de pago.
      clientMetrics: {                 // bloque de métricas de clientes.
        totalClients: clients,
        newClients,
        returningClients,
        retentionRate,
        topClients,
        bySource,
      },
      recentActivity: activityItems,   // actividad reciente legible.
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // getTodaySummary(): resumen del DÍA de hoy y del MES en curso, más próximas
  // citas y el ingreso de los últimos 7 días. Calcula "hoy" internamente.
  // ───────────────────────────────────────────────────────────────────────────
  async getTodaySummary(tenantId: string) {
    const now = new Date();                          // instante actual.
    const todayStr = now.toISOString().split('T')[0]; // fecha de hoy ("2026-06-24").
    const startOfDay = new Date(`${todayStr}T00:00:00Z`); // hoy 00:00:00 UTC.
    const endOfDay = new Date(`${todayStr}T23:59:59Z`);   // hoy 23:59:59 UTC.

    // Tres consultas en paralelo: citas de hoy, pagos de hoy y próximas citas.
    const [todayAppointments, todayPayments, upcomingAppointments] = await Promise.all([
      // 1) Cuántas citas hay HOY (count solo devuelve el número).
      this.prisma.appointment.count({
        where: { tenantId, startTime: { gte: startOfDay, lte: endOfDay } },
      }),
      // 2) aggregate = "agregar/resumir" varias filas en valores únicos.
      //    Sobre los pagos COMPLETADOS de hoy calculamos:
      //      _sum.totalAmount => la SUMA de los montos.
      //      _count.id        => CUÁNTOS pagos hubo.
      this.prisma.payment.aggregate({
        where: { tenantId, status: 'COMPLETED', createdAt: { gte: startOfDay, lte: endOfDay } },
        _sum: { totalAmount: true },
        _count: { id: true },
      }),
      // "Próximas citas": cualquier cita futura (incluyendo días posteriores),
      // no solo las del día de hoy. Mostrar las 5 mas proximas.
      this.prisma.appointment.findMany({
        where: {
          tenantId,
          startTime: { gte: now },                  // que empiecen de "ahora" en adelante.
          // status "in [...]" => solo pendientes o confirmadas (las que están vivas).
          status: { in: ['PENDING', 'CONFIRMED'] },
        },
        include: {
          client: { select: { firstName: true, lastName: true, avatarUrl: true } },
          employee: { select: { id: true, firstName: true, lastName: true, color: true, avatarUrl: true } },
          items: { select: { serviceNameSnapshot: true, priceSnapshot: true } },
        },
        orderBy: { startTime: 'asc' },              // 'asc' = de la más próxima a la más lejana.
        take: 5,                                    // solo las 5 primeras.
      }),
    ]);

    // Month KPIs (indicadores del MES en curso)
    // "todayStr.substring(0, 7)" toma los primeros 7 caracteres de "2026-06-24",
    // es decir "2026-06" (año-mes), y le pegamos "-01..." para tener el día 1.
    const monthStart = new Date(`${todayStr.substring(0, 7)}-01T00:00:00Z`);
    // Cuatro consultas del mes en paralelo.
    const [monthAppointments, monthRevenue, monthNoShows, monthCompleted] = await Promise.all([
      // a) Total de citas del mes.
      this.prisma.appointment.count({
        where: { tenantId, startTime: { gte: monthStart, lte: endOfDay } },
      }),
      // b) Suma de ingresos del mes (pagos completados).
      this.prisma.payment.aggregate({
        where: { tenantId, status: 'COMPLETED', createdAt: { gte: monthStart, lte: endOfDay } },
        _sum: { totalAmount: true },
      }),
      // c) Cuántos no-show hubo en el mes.
      this.prisma.appointment.count({
        where: { tenantId, status: 'NO_SHOW', startTime: { gte: monthStart, lte: endOfDay } },
      }),
      // Necesario para ticket promedio coherente con /reports (= revenue / completedAppointments).
      // d) Cuántas citas COMPLETADAS hubo en el mes.
      this.prisma.appointment.count({
        where: { tenantId, status: 'COMPLETED', startTime: { gte: monthStart, lte: endOfDay } },
      }),
    ]);

    // Last 7 days revenue (ingreso de cada uno de los últimos 7 días)
    // Arreglo donde iremos metiendo { fecha, ingreso } por cada día.
    const last7Days: { date: string; revenue: number }[] = [];
    // Bucle de i=6 hasta i=0: con "i" como "hace cuántos días". Empezamos 6 días
    // atrás y terminamos en hoy (i=0), para que el arreglo quede en orden.
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);          // copia de "ahora".
      d.setDate(d.getDate() - i);       // retrocede "i" días.
      const dateStr = d.toISOString().split('T')[0]; // fecha de ese día.
      const dayStart = new Date(`${dateStr}T00:00:00Z`); // inicio de ese día.
      const dayEnd = new Date(`${dateStr}T23:59:59Z`);   // fin de ese día.
      // Suma de ingresos de ese día concreto (pagos completados).
      const dayRevenue = await this.prisma.payment.aggregate({
        where: { tenantId, status: 'COMPLETED', createdAt: { gte: dayStart, lte: dayEnd } },
        _sum: { totalAmount: true },
      });
      // Guardamos el día. "Number(... || 0)": si no hubo pagos, _sum.totalAmount
      // es null; el "|| 0" lo convierte en 0 para no meter null en el resultado.
      last7Days.push({ date: dateStr, revenue: Number(dayRevenue._sum.totalAmount || 0) });
    }

    // Objeto final con los bloques "today", "month", próximas citas y 7 días.
    return {
      today: {
        appointments: todayAppointments,                       // citas de hoy.
        revenue: Number(todayPayments._sum.totalAmount || 0),  // ingreso de hoy (0 si null).
        payments: todayPayments._count.id,                     // nº de pagos de hoy.
      },
      month: {
        appointments: monthAppointments,        // citas del mes.
        completedAppointments: monthCompleted,  // completadas del mes.
        revenue: Number(monthRevenue._sum.totalAmount || 0), // ingreso del mes.
        // Ticket promedio coherente con /reports: solo cuenta citas completadas.
        // Ternario para no dividir entre 0. Si hay completadas: ingreso/completadas
        // redondeado a 2 decimales; si no, 0.
        averageTicket: monthCompleted > 0
          ? Math.round((Number(monthRevenue._sum.totalAmount || 0) / monthCompleted) * 100) / 100
          : 0,
        // Tasa de no-show del mes en % con 1 decimal (mismo truco *1000/10).
        noShowRate: monthAppointments > 0 ? Math.round((monthNoShows / monthAppointments) * 1000) / 10 : 0,
      },
      upcomingAppointments, // las 5 próximas citas (con sus relaciones).
      last7Days,            // ingreso por día de la última semana.
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // getAlertCounts(): conteos para los "badges" de alerta del dashboard:
  // productos con stock bajo, reservas pendientes y citas futuras sin confirmar.
  // ───────────────────────────────────────────────────────────────────────────
  async getAlertCounts(tenantId: string) {
    const now = new Date(); // instante actual (para "citas futuras").

    // Tres conteos en paralelo.
    const [lowStockCount, pendingReservations, unconfirmedAppointments] = await Promise.all([
      // Mismo helper que ProductsService.findLowStock para garantizar que
      // el conteo del alert coincide exactamente con lo que se muestra al
      // filtrar en /inventory.
      this.prisma.product
        .findMany({
          where: LOW_STOCK_WHERE(tenantId), // filtro de "candidatos" a stock bajo.
          select: { stock: true, minStock: true },
        })
        // .then(...) se ejecuta cuando la consulta termina. Sobre los productos
        // traídos aplicamos .filter(isLowStockRow) (deja solo los que REALMENTE
        // están bajos) y .length cuenta cuántos quedaron.
        .then((all) => all.filter(isLowStockRow).length)
        // .catch(() => 0): si la consulta fallara, en vez de romper el endpoint
        // devolvemos 0 (un badge en 0 es preferible a un error).
        .catch(() => 0),
      // Reservas de productos en estado PENDING (cuántas hay). También con .catch.
      this.prisma.productReservation.count({
        where: { tenantId, status: 'PENDING' },
      }).catch(() => 0),
      // Todas las citas sin confirmar (futuras), no solo las de hoy. El
      // alert se enlaza a /calendar?status=PENDING y debe coincidir con
      // lo que el calendario muestra al filtrar.
      this.prisma.appointment.count({
        where: {
          tenantId,
          status: 'PENDING',
          startTime: { gte: now }, // de "ahora" en adelante (futuras).
        },
      }),
    ]);

    // Rango (min/max) de las citas PENDING futuras — el frontend usa esto
    // para abrir el calendario en vista Personalizada cubriendo justo el
    // periodo donde están todas las citas sin confirmar.
    // Ternario: SOLO si hay alguna cita sin confirmar lanzamos el aggregate que
    // calcula la fecha mínima (_min) y máxima (_max) de inicio. Si no hay
    // ninguna, evitamos la consulta y usamos un objeto con nulos (mismo "molde"
    // de respuesta para que el código de abajo no falle).
    const pendingRange =
      unconfirmedAppointments > 0
        ? await this.prisma.appointment.aggregate({
            where: { tenantId, status: 'PENDING', startTime: { gte: now } },
            _min: { startTime: true }, // la cita futura más cercana.
            _max: { startTime: true }, // la cita futura más lejana.
          })
        : { _min: { startTime: null }, _max: { startTime: null } };

    // Objeto final con los tres conteos y el rango de fechas.
    return {
      lowStockCount,            // productos bajo de stock.
      pendingReservations,     // reservas de producto pendientes.
      unconfirmedAppointments, // citas futuras sin confirmar.
      unconfirmedRange: {
        // "from": fecha de la cita más cercana, o null si no hay. El ternario
        // evita llamar a .toISOString() sobre null (que daría error). Tomamos
        // solo la parte de fecha con split('T')[0].
        from: pendingRange._min.startTime
          ? pendingRange._min.startTime.toISOString().split('T')[0]
          : null,
        // "to": fecha de la cita más lejana, o null si no hay (mismo patrón).
        to: pendingRange._max.startTime
          ? pendingRange._max.startTime.toISOString().split('T')[0]
          : null,
      },
    };
  }
}
