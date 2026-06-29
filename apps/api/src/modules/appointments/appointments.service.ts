// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// Excepciones y utilidades de NestJS:
//   - ConflictException: error HTTP 409 (conflicto), p.ej. horario ya reservado.
//   - Injectable: marca la clase como servicio inyectable.
//   - Logger: utilidad para escribir mensajes de registro (logs) en consola.
//   - NotFoundException: error HTTP 404 (no encontrado).
//   - BadRequestException: error HTTP 400 (petición inválida).
import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
// PrismaService: el "puente" hacia la base de datos (lee/escribe tablas).
import { PrismaService } from '../../prisma/prisma.service';
// AuditService: registra en la bitácora de auditoría cada operación de escritura.
import { AuditService } from '../audit/audit.service';
// EventsService: emite "eventos de dominio" (otras partes del sistema reaccionan
// a ellos: notificaciones, métricas, etc.) sin acoplarse a este servicio.
import { EventsService } from '../events/events.service';
// AvailabilityService: gestiona la caché de horarios libres. Cuando una cita
// cambia, le pedimos invalidar (borrar) la caché del día afectado.
import { AvailabilityService } from '../availability/availability.service';
// PlanLimitsService: comprueba límites del plan contratado (p.ej. máximo de
// citas permitidas según la suscripción del negocio).
import { PlanLimitsService } from '../subscriptions/plan-limits.service';
// DTOs (formas de los datos de entrada) usados por los métodos de este servicio.
import { CreateAppointmentDto, UpdateAppointmentDto } from './dto/create-appointment.dto';
import { RescheduleDto, CancelDto } from './dto/reschedule.dto';
import { FilterAppointmentsDto } from './dto/filter-appointments.dto';
// Helper que arma la respuesta paginada estándar { data, meta }.
import { buildPaginatedResponse } from '../../common/dto/pagination.dto';
// parseWallClock: convierte el texto de fecha-hora respetando la hora "de reloj"
// que eligió el cliente (fuerza UTC si el ISO viene sin zona horaria).
import { parseWallClock } from '../../common/utils/parse-wall-clock';
// "Prisma" trae tipos y enums del cliente Prisma; aquí lo usamos para indicar el
// nivel de aislamiento Serializable de las transacciones.
import { Prisma } from '@prisma/client';

// @Injectable marca la clase como servicio que NestJS puede crear e inyectar.
@Injectable()
export class AppointmentsService {
  // Logger propio del servicio: el nombre (AppointmentsService.name) aparece en
  // cada línea de log para saber de dónde vino el mensaje.
  private readonly logger = new Logger(AppointmentsService.name);

  // INYECCIÓN DE DEPENDENCIAS: NestJS pasa automáticamente estas 5 clases.
  // "private readonly" las guarda como propiedades de solo lectura (this.xxx).
  constructor(
    private readonly prisma: PrismaService,             // acceso a la base de datos
    private readonly auditService: AuditService,         // auditoría
    private readonly eventsService: EventsService,       // eventos de dominio
    private readonly availabilityService: AvailabilityService, // caché de horarios
    private readonly planLimitsService: PlanLimitsService,     // límites del plan
  ) {}

  // ───────────────────────────────────────────────────────────────────────────
  // create(): crea una cita nueva. Es el método central y el más delicado:
  // valida empleado/cliente/servicios, calcula duración total, y dentro de una
  // transacción "Serializable" (la más estricta) verifica que no haya
  // solapamientos (anti-doble-reserva) antes de insertar la cita y sus items con
  // "snapshots" de precio/duración. Recibe el DTO, el negocio y quién la crea.
  // ───────────────────────────────────────────────────────────────────────────
  async create(dto: CreateAppointmentDto, tenantId: string, userId?: string) {
    // Comprobar el límite de citas del plan contratado (lanza error si se excede).
    await this.planLimitsService.checkAppointmentLimit(tenantId);

    // Validar que el empleado existe, pertenece a este negocio y está activo.
    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, tenantId, isActive: true },
    });
    if (!employee) {
      throw new NotFoundException('Empleado no encontrado o inactivo');
    }

    // Validar que el cliente existe, pertenece a este negocio y está activo.
    const client = await this.prisma.client.findFirst({
      where: { id: dto.clientId, tenantId, isActive: true },
    });
    if (!client) {
      throw new NotFoundException('Cliente no encontrado o inactivo');
    }

    // Traer los servicios para copiar luego sus datos (precio/duración/nombre).
    // "id: { in: dto.serviceIds }" = trae todos los servicios cuyos id estén en
    // la lista recibida.
    const services = await this.prisma.service.findMany({
      where: { id: { in: dto.serviceIds }, tenantId },
    });

    // Si la cantidad encontrada no coincide con la pedida (!==), algún servicio
    // no existe o no es de este negocio -> error.
    if (services.length !== dto.serviceIds.length) {
      throw new NotFoundException('Uno o más servicios no encontrados');
    }

    // ¿Es una reserva "multi-empleado" (cada servicio lo hace una persona
    // distinta)? Es así si vinieron serviceAssignments con al menos un elemento.
    const isMultiEmployee = dto.serviceAssignments && dto.serviceAssignments.length > 0;

    // Mapa (diccionario) que relaciona cada servicio con su empleado asignado.
    // Map<clave, valor> permite buscar rápido el empleado de un serviceId.
    const assignmentMap = new Map<string, string>();
    if (isMultiEmployee) {
      // Recorremos cada asignación (a) y la guardamos en el mapa:
      // serviceId -> employeeId. El "!" tras serviceAssignments le dice a
      // TypeScript "confía, aquí ya sé que no es null/undefined".
      for (const a of dto.serviceAssignments!) {
        assignmentMap.set(a.serviceId, a.employeeId);
      }
    }

    // Lista de IDs de TODOS los empleados implicados en la cita.
    // - Si es multi-empleado: .map(a => a.employeeId) saca el empleado de cada
    //   asignación; "new Set(...)" elimina duplicados (un empleado puede hacer
    //   varios servicios); "[...]" lo convierte de Set de vuelta a arreglo.
    // - Si NO es multi-empleado: solo el empleado principal del DTO.
    const involvedEmployeeIds = isMultiEmployee
      ? [...new Set(dto.serviceAssignments!.map((a) => a.employeeId))]
      : [dto.employeeId];

    // Traer los precios/comisiones específicos de cada empleado para cada
    // servicio (un empleado puede tener un precio propio distinto al base).
    const employeeServices = await this.prisma.employeeService.findMany({
      where: {
        employeeId: { in: involvedEmployeeIds },
        serviceId: { in: dto.serviceIds },
      },
    });

    // VALIDAR que cada servicio tenga un empleado que SÍ sepa hacerlo.
    if (!isMultiEmployee) {
      // Caso un solo empleado: contamos cuántas filas employeeService son de ese
      // empleado. filter() devuelve solo las que cumplen la condición; .length
      // las cuenta. Si ese número no coincide con la cantidad de servicios,
      // significa que al empleado le falta alguno.
      if (employeeServices.filter((es) => es.employeeId === dto.employeeId).length !== dto.serviceIds.length) {
        // empES = solo los servicios que ese empleado SÍ tiene asignados.
        const empES = employeeServices.filter((es) => es.employeeId === dto.employeeId);
        // missing = los serviceIds que NO están en empES. some() comprueba si
        // existe alguno que coincida; el "!" lo niega (= "no lo tiene").
        const missing = dto.serviceIds.filter(
          (id) => !empES.some((es) => es.serviceId === id),
        );
        // Convertimos esos ids faltantes en sus nombres legibles:
        // filter() deja los servicios cuyo id esté en "missing" (includes),
        // y map() extrae solo el nombre de cada uno.
        const missingNames = services
          .filter((s) => missing.includes(s.id))
          .map((s) => s.name);
        // join(', ') une los nombres en un solo texto separado por comas.
        throw new NotFoundException(
          `El empleado no tiene asignado(s): ${missingNames.join(', ')}`,
        );
      }
    } else {
      // Caso multi-empleado: por cada asignación verificamos que ese empleado
      // concreto sí tenga ese servicio concreto.
      for (const a of dto.serviceAssignments!) {
        // some() devuelve true si existe una fila que empareje empleado Y
        // servicio (ambas condiciones con &&).
        const has = employeeServices.some(
          (es) => es.employeeId === a.employeeId && es.serviceId === a.serviceId,
        );
        if (!has) {
          // find() busca el servicio para mostrar su nombre en el mensaje.
          const svc = services.find((s) => s.id === a.serviceId);
          // "svc?.name || a.serviceId": si encontramos el servicio usamos su
          // nombre; si no (?. evita el error) caemos al id como respaldo (||).
          throw new NotFoundException(
            `El empleado asignado no tiene el servicio: ${svc?.name || a.serviceId}`,
          );
        }
      }
    }

    // Mapa para buscar rápido la fila employeeService por una clave combinada
    // "employeeId:serviceId". map() transforma cada fila en un par [clave, fila]
    // y "new Map(...)" construye el diccionario con esos pares.
    const empServiceMap = new Map(
      employeeServices.map((es) => [`${es.employeeId}:${es.serviceId}`, es]),
    );

    // DURACIÓN TOTAL: reduce() recorre los servicios acumulando en "sum"
    // (empieza en 0) la duración de cada uno MÁS su tiempo de margen posterior
    // (bufferAfterMinutes). Así sabemos cuánto dura la cita de principio a fin.
    const totalDuration = services.reduce(
      (sum, s) => sum + s.durationMinutes + s.bufferAfterMinutes,
      0,
    );
    // Wall-clock literal: parseWallClock fuerza UTC si el ISO viene naive,
    // así el valor guardado coincide con la hora que el cliente seleccionó
    // independientemente de la TZ del proceso. Ver doc en parse-wall-clock.ts.
    // startTime = inicio elegido, normalizado con parseWallClock (ver arriba).
    const startTime = parseWallClock(dto.startTime);
    // endTime = inicio + duración total. getTime() da milisegundos; multiplicamos
    // los minutos por 60000 (1 minuto = 60000 ms) para sumarlos correctamente.
    const endTime = new Date(startTime.getTime() + totalDuration * 60000);

    // ── ANTICIPO (depósito) ───────────────────────────────────────────────────
    // Si el negocio exige anticipo, lo calculamos (monto fijo o % del total de
    // servicios, con el mismo precio por-empleado que usan los items) y la cita
    // nace PENDING hasta que el negocio confirme el anticipo. El negocio puede
    // "Omitir anticipo" para confirmarla al instante.
    const depositTenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { depositEnabled: true, depositType: true, depositValue: true },
    });
    const depositRequired = !!depositTenant?.depositEnabled;
    let depositAmount: number | null = null;
    if (depositRequired) {
      const servicesTotal = services.reduce((sum, service) => {
        const itemEmployeeId = assignmentMap.get(service.id) || dto.employeeId;
        const empSvc = empServiceMap.get(`${itemEmployeeId}:${service.id}`);
        return sum + Number(empSvc?.customPrice ?? service.price);
      }, 0);
      const val = Number(depositTenant?.depositValue ?? 0);
      depositAmount =
        depositTenant?.depositType === 'FIXED'
          ? val
          : Math.round((servicesTotal * val) / 100);
    }

    try {
      // $transaction ejecuta TODO el bloque como una sola operación atómica: o se
      // guarda todo, o nada. "tx" es la conexión transaccional (usar tx, no
      // this.prisma, dentro). El nivel Serializable (definido al final) es el más
      // estricto y evita que dos reservas simultáneas pisen el mismo hueco.
      const result = await this.prisma.$transaction(
        async (tx) => {
          // Comprobar solapamientos para CADA empleado implicado en la cita.
          for (const empId of involvedEmployeeIds) {
            // Por defecto, la ventana de tiempo del empleado es toda la cita.
            // "let" porque puede reasignarse abajo en el caso multi-empleado.
            let empStart = startTime;
            let empEnd = endTime;

            if (isMultiEmployee) {
              // En multi-empleado, cada persona solo ocupa el tramo de SUS
              // servicios. Calculamos su ventana exacta [first, last].
              let currentMs = startTime.getTime(); // reloj que avanza por la cita
              let first: number | null = null;     // inicio del 1er servicio suyo
              let last: number | null = null;      // fin del último servicio suyo
              for (const service of services) {
                // Empleado asignado a este servicio (o el principal por defecto).
                const assignedEmp = assignmentMap.get(service.id) || dto.employeeId;
                // Fin de este servicio = posición actual + su duración.
                const itemEndMs = currentMs + service.durationMinutes * 60000;
                if (assignedEmp === empId) {
                  // Si es el primer servicio de este empleado, marca su inicio.
                  if (first === null) first = currentMs;
                  // El fin se actualiza en cada servicio suyo (queda el último).
                  last = itemEndMs;
                }
                // Avanzamos el reloj: tras el servicio sumamos su margen posterior.
                currentMs = itemEndMs + service.bufferAfterMinutes * 60000;
              }
              if (first !== null && last !== null) {
                // El empleado sí participa: su ventana real es [first, last].
                empStart = new Date(first);
                empEnd = new Date(last);
              } else {
                // first/last siguen en null => este empleado no hace nada en la
                // cita; "continue" salta a la siguiente vuelta del for.
                continue; // Employee not involved
              }
            }

            // Buscar la PRIMERA cita de ese empleado que se solape con su ventana.
            // REGLA DE SOLAPAMIENTO de dos intervalos: chocan si una empieza
            // antes de que la otra termine Y termina después de que la otra
            // empiece. Aquí: startTime < empEnd (lt = "<") Y endTime > empStart
            // (gt = ">"). notIn descarta canceladas y no-shows (no ocupan hueco).
            const overlap = await tx.appointment.findFirst({
              where: {
                employeeId: empId,
                tenantId,
                status: { notIn: ['CANCELLED', 'NO_SHOW'] },
                startTime: { lt: empEnd },
                endTime: { gt: empStart },
              },
            });
            if (overlap) {
              // Si hay choque, abortamos la transacción con un 409.
              throw new ConflictException(
                'Este horario ya está reservado. Por favor selecciona otro horario.',
              );
            }
          }

          // Check client overlap (cliente no puede tener 2 citas a la vez,
          // ni siquiera con empleados distintos). Se valida contra el rango
          // completo [startTime, endTime] de la cita nueva, no solo el slot
          // de inicio — asi una cita de 2 horas bloquea las 2 horas enteras.
          // Mismo control de solapamiento, pero contra el propio CLIENTE: no
          // puede tener dos citas a la vez (ni con empleados distintos). Misma
          // regla lt/gt sobre el rango completo de la cita nueva.
          const clientOverlap = await tx.appointment.findFirst({
            where: {
              clientId: dto.clientId,
              tenantId,
              status: { notIn: ['CANCELLED', 'NO_SHOW'] },
              startTime: { lt: endTime },
              endTime: { gt: startTime },
            },
            select: { id: true },
          });
          if (clientOverlap) {
            throw new ConflictException(
              'Ya tienes una cita en este horario. Selecciona otra hora.',
            );
          }

          // Estado inicial según el origen:
          //  - ONLINE (el cliente reservó solo, desde el marketplace o la reserva
          //    pública) → nace PENDING ("Sin confirmar"); se confirmará cuando el
          //    cliente lo haga desde el enlace de recordatorio, o el negocio a mano.
          //  - Cualquier otro origen (MANUAL/WALK_IN/PHONE = lo agendó el negocio)
          //    → nace CONFIRMED, porque el propio negocio ya la confirmó al crearla.
          // Con anticipo requerido, TODA cita nace PENDING (incluso las que crea
          // el negocio), hasta que se confirme el anticipo o se omita.
          const initialStatus = depositRequired
            ? 'PENDING'
            : dto.source === 'ONLINE'
              ? 'PENDING'
              : 'CONFIRMED';

          // Crear la cita. "bundleId: dto.bundleId || null" => si no vino bundle,
          // guardamos null. "source: dto.source || 'MANUAL'" => si no se indicó
          // origen, por defecto MANUAL.
          const appointment = await tx.appointment.create({
            data: {
              tenantId,
              locationId: dto.locationId,
              clientId: dto.clientId,
              employeeId: dto.employeeId,
              bundleId: dto.bundleId || null,
              startTime,
              endTime,
              notes: dto.notes,
              internalNotes: dto.internalNotes,
              source: dto.source || 'MANUAL',
              createdBy: userId,
              status: initialStatus,
              depositRequired,
              depositAmount,
              depositPaid: 0,
            },
          });

          // Crear los items (servicios) con SNAPSHOTS: copiamos precio, duración
          // y nombre tal como están AHORA, para que la cita no cambie si luego se
          // edita el servicio. currentStart es el reloj que avanza servicio a
          // servicio; "items" acumula las filas a insertar.
          let currentStart = new Date(startTime);
          const items = [];
          for (const service of services) {
            // Empleado de este item (el asignado o el principal por defecto).
            const itemEmployeeId = assignmentMap.get(service.id) || dto.employeeId;
            // Fila de precios propios de ese empleado para ese servicio (o nada).
            const empSvc = empServiceMap.get(`${itemEmployeeId}:${service.id}`);
            // "??" (nullish): usa customPrice SOLO si no es null/undefined; si lo
            // es, cae al precio base del servicio. (?? no se confunde con 0.)
            const price = empSvc?.customPrice ?? service.price;
            // Comisión propia del empleado si existe; si no, null.
            const commission = empSvc?.commission ?? null;
            // Fin de este servicio = inicio actual + su duración (en ms).
            const itemEnd = new Date(
              currentStart.getTime() + service.durationMinutes * 60000,
            );
            // Guardamos la fila del item con todos sus datos congelados.
            items.push({
              appointmentId: appointment.id,
              serviceId: service.id,
              employeeId: itemEmployeeId,
              startTime: currentStart,
              endTime: itemEnd,
              priceSnapshot: price,
              commissionSnapshot: commission,
              durationSnapshot: service.durationMinutes,
              serviceNameSnapshot: service.name,
            });
            // Avanzamos el reloj para el siguiente servicio: fin + margen posterior.
            currentStart = new Date(
              itemEnd.getTime() + service.bufferAfterMinutes * 60000,
            );
          }

          // Insertar todos los items de golpe (createMany es más eficiente).
          await tx.appointmentItem.createMany({ data: items });

          // Registrar la primera entrada del historial de estados: de "nada"
          // (fromStatus null) al estado inicial (PENDING o CONFIRMED).
          await tx.appointmentStatusHistory.create({
            data: {
              appointmentId: appointment.id,
              fromStatus: null,
              toStatus: initialStatus,
              changedBy: userId,
            },
          });

          // El valor que devuelve el callback es lo que recibe "result".
          return appointment;
        },
        // Opciones de la transacción: Serializable = aislamiento máximo. Evita
        // condiciones de carrera en la doble reserva (si dos personas reservan a
        // la vez, una de las transacciones se reintenta o falla).
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      // A partir de aquí, FUERA de la transacción: auditoría, eventos y caché.
      // No bloquean la creación; si fallaran, la cita ya quedó guardada.
      await this.auditService.log({
        tenantId,
        userId,
        action: 'appointment.created',
        entityType: 'appointment',
        entityId: result.id,
        // "as any" relaja el tipo: guardamos el objeto completo como valor nuevo.
        newValues: result as any,
      });

      // Emitir el evento de dominio "cita creada" (notificaciones, etc.).
      // toISOString() formatea la fecha como texto estándar; split('T')[0] parte
      // ese texto por la "T" y toma la primera mitad => solo la fecha (YYYY-MM-DD).
      await this.eventsService.emitAppointmentCreated(tenantId, result.id, {
        locationId: dto.locationId,
        employeeId: dto.employeeId,
        startTime: startTime.toISOString(),
        date: startTime.toISOString().split('T')[0],
      });

      // Invalidar (borrar) la caché de disponibilidad de TODOS los empleados
      // implicados para ese día, así el próximo cálculo de horarios refleja la
      // nueva cita.
      const dateStr = startTime.toISOString().split('T')[0];
      for (const empId of involvedEmployeeIds) {
        await this.availabilityService.invalidateCache(
          tenantId,
          dto.locationId,
          empId,
          dateStr,
        );
      }

      // Respuesta estándar del proyecto: { data: ... }.
      return { data: result };
    } catch (error: any) {
      // Red de seguridad por si la base de datos rechaza por su propia restricción
      // de unicidad: P2002 es el código Prisma de "violación de índice único" y
      // "no_employee_overlap" es el nombre de una constraint anti-solapamiento.
      // "error.message?.includes(...)" usa ?. para no romper si message no existe.
      if (error.code === 'P2002' || error.message?.includes('no_employee_overlap')) {
        throw new ConflictException(
          'Este horario ya está reservado. Por favor selecciona otro horario.',
        );
      }
      // Cualquier otro error se relanza tal cual.
      throw error;
    }
  }

  /**
   * Create appointment from POS sale. Calculates startTime = now - totalDuration.
   * Skips overlap validation (POS exception). Links to payment.
   *
   * En español: crea una cita a partir de una venta del Punto de Venta. Como la
   * venta ya sucedió, el inicio se calcula hacia atrás (ahora − duración) y NO se
   * valida solapamiento. Si el cliente ya tenía una cita pendiente hoy, la
   * completa en lugar de crear una nueva. Recibe el negocio, los datos de la
   * venta (cliente, sucursal, asignaciones servicio→empleado, notas) y el usuario.
   */
  async createFromPos(
    tenantId: string,
    data: {
      clientId: string;
      locationId: string;
      serviceAssignments: Array<{ serviceId: string; employeeId: string }>;
      notes?: string;
    },
    userId?: string,
  ) {
    // Traer los servicios vendidos. data.serviceAssignments.map(a => a.serviceId)
    // saca la lista de IDs de servicio; "in" trae todos esos servicios.
    const services = await this.prisma.service.findMany({
      where: { id: { in: data.serviceAssignments.map((a) => a.serviceId) }, tenantId },
    });

    // Duración total (sin buffers aquí). reduce() suma durationMinutes de cada uno.
    const totalDuration = services.reduce((sum, s) => sum + s.durationMinutes, 0);
    const now = new Date(); // momento actual = fin de la venta
    // Como la venta ya ocurrió, calculamos el inicio HACIA ATRÁS: ahora menos la
    // duración total. Así la cita queda con un rango horario coherente en el pasado.
    const startTime = new Date(now.getTime() - totalDuration * 60000);
    const endTime = now;
    // Empleado principal = el de la primera asignación. "?." evita error si la
    // lista estuviera vacía (devolvería undefined en ese caso).
    const primaryEmployeeId = data.serviceAssignments[0]?.employeeId;

    // ¿El cliente ya tiene una cita PENDIENTE hoy? Si es así, en vez de crear una
    // nueva, completamos esa (evita duplicar la cita reservada con la venta POS).
    // Construimos el inicio (00:00:00Z) y fin (23:59:59Z) del día de hoy.
    const todayStart = new Date(now.toISOString().split('T')[0] + 'T00:00:00Z');
    const todayEnd = new Date(now.toISOString().split('T')[0] + 'T23:59:59Z');
    const existingAppointment = await this.prisma.appointment.findFirst({
      where: {
        clientId: data.clientId,
        tenantId,
        // startTime dentro de hoy: gte (>=) inicio y lte (<=) fin del día.
        startTime: { gte: todayStart, lte: todayEnd },
        // Solo nos sirven citas todavía abiertas (PENDING o CONFIRMED).
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
    });

    if (existingAppointment) {
      // Completar la cita existente en lugar de crear una nueva.
      await this.prisma.appointment.update({
        where: { id: existingAppointment.id },
        data: { status: 'COMPLETED' },
      });
      // Si la cita tenia productos reservados al hacer el booking,
      // marcarlos como DELIVERED ahora que se cobro (mismo motivo que en
      // payments.service y complete()).
      // Si la cita tenía productos reservados, marcarlos como DELIVERED ahora que
      // se cobró. updateMany cambia TODOS los que estén PENDING/CONFIRMED/READY.
      await this.prisma.productReservation.updateMany({
        where: {
          appointmentId: existingAppointment.id,
          tenantId,
          status: { in: ['PENDING', 'CONFIRMED', 'READY'] },
        },
        data: { status: 'DELIVERED' },
      });
      // Devolvemos la cita existente ya completada y salimos.
      return { data: existingAppointment };
    }

    // No había cita previa: creamos una YA completada, SIN validar solapamientos
    // (excepción del POS, porque la venta ya ocurrió). Origen WALK_IN.
    // "data.notes || 'Venta...'": si no enviaron notas, usamos un texto por defecto.
    const appointment = await this.prisma.appointment.create({
      data: {
        tenantId,
        locationId: data.locationId,
        clientId: data.clientId,
        employeeId: primaryEmployeeId,
        startTime,
        endTime,
        source: 'WALK_IN',
        status: 'COMPLETED',
        notes: data.notes || 'Venta desde Punto de Venta',
        createdBy: userId,
      },
    });

    // Crear los items con sus snapshots (igual que en create()).
    let currentStart = new Date(startTime);
    const items = [];
    for (const assignment of data.serviceAssignments) {
      // Buscar el servicio de esta asignación entre los ya cargados.
      const service = services.find((s) => s.id === assignment.serviceId);
      // Si no se encontró (raro), saltamos esta asignación con "continue".
      if (!service) continue;

      // Precio/comisión propios del empleado para ese servicio (si existen).
      const employeeService = await this.prisma.employeeService.findFirst({
        where: { employeeId: assignment.employeeId, serviceId: service.id },
      });

      // Fin del item = inicio actual + su duración.
      const itemEnd = new Date(currentStart.getTime() + service.durationMinutes * 60000);
      items.push({
        appointmentId: appointment.id,
        serviceId: service.id,
        employeeId: assignment.employeeId,
        startTime: currentStart,
        endTime: itemEnd,
        // ?? cae al precio/comisión base si el empleado no tiene valor propio.
        priceSnapshot: employeeService?.customPrice ?? service.price,
        commissionSnapshot: employeeService?.commission ?? null,
        durationSnapshot: service.durationMinutes,
        serviceNameSnapshot: service.name,
      });
      // Avanzar el reloj sumando el margen posterior del servicio.
      currentStart = new Date(itemEnd.getTime() + service.bufferAfterMinutes * 60000);
    }

    // Solo insertamos si hay al menos un item.
    if (items.length > 0) {
      await this.prisma.appointmentItem.createMany({ data: items });
    }

    // Historial: de "nada" (null) a COMPLETED.
    await this.prisma.appointmentStatusHistory.create({
      data: { appointmentId: appointment.id, fromStatus: null, toStatus: 'COMPLETED', changedBy: userId },
    });

    return { data: appointment };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // findAll(): devuelve una lista PAGINADA de citas del negocio, aplicando los
  // filtros recibidos (sucursal, empleado(s), cliente, estado, fechas, etc.).
  // ───────────────────────────────────────────────────────────────────────────
  async findAll(tenantId: string, filters: FilterAppointmentsDto) {
    // Página actual: si no vino, 1 (?? cae al segundo valor si el primero es null).
    const page = filters.page ?? 1;
    // Tamaño de página: si no vino, 20.
    const perPage = filters.perPage ?? 20;
    // skip = cuántos registros saltar para llegar a esta página. Página 1 salta 0.
    const skip = (page - 1) * perPage;

    // "where" es el filtro que se irá construyendo. Empieza filtrando por negocio
    // (multi-tenant: SIEMPRE filtramos por tenantId). "any" relaja el tipo.
    const where: any = { tenantId };
    // Si vino sucursal, añadimos el filtro.
    if (filters.locationId) where.locationId = filters.locationId;
    // Filtro por VARIOS empleados (CSV). Tiene prioridad sobre employeeId.
    if (filters.employeeIds) {
      // split(',') parte "a,b,c" en ["a","b","c"]; map(trim) quita espacios;
      // filter(Boolean) descarta cadenas vacías (Boolean('') es false).
      const ids = filters.employeeIds.split(',').map((s) => s.trim()).filter(Boolean);
      // Si quedó al menos un id, filtramos por "employeeId está en esa lista".
      if (ids.length > 0) where.employeeId = { in: ids };
    } else if (filters.employeeId) {
      // Si no vino la lista pero sí un único empleado, filtramos por ese.
      where.employeeId = filters.employeeId;
    }
    // Filtro por cliente.
    if (filters.clientId) where.clientId = filters.clientId;
    // Filtro por estado.
    if (filters.status) where.status = filters.status;

    // pendingPosPayment=true: el POS lista "Por cobrar" de cualquier dia.
    // Cuando este filtro está activo, ignoramos startDate/endDate.
    const isPendingPos = filters.pendingPosPayment === 'true';
    if (isPendingPos) {
      where.pendingPosPayment = true;
    } else if (filters.startDate || filters.endDate) {
      // Construimos un sub-objeto para acotar startTime por rango.
      where.startTime = {};
      // Aceptamos ISO completo ("2026-06-12T00:00:00.000-06:00") o YYYY-MM-DD.
      // Si es solo fecha, se agrega T00:00:00Z (start) o T23:59:59Z (end).
      if (filters.startDate) {
        // gte (>=) inicio del rango. includes('T') detecta si ya es ISO completo;
        // en ambas ramas aquí se construye igual (new Date directo).
        where.startTime.gte = filters.startDate.includes('T')
          ? new Date(filters.startDate)
          : new Date(filters.startDate);
      }
      if (filters.endDate) {
        // lte (<=) fin del rango. Si es solo fecha, le añadimos T23:59:59Z para
        // incluir TODO ese día hasta el último segundo.
        where.startTime.lte = filters.endDate.includes('T')
          ? new Date(filters.endDate)
          : new Date(filters.endDate + 'T23:59:59Z');
      }
    }

    // Promise.all ejecuta las DOS consultas EN PARALELO (más rápido que una tras
    // otra): la lista de citas de esta página y el total de citas que cumplen el
    // filtro (para calcular cuántas páginas hay). Se desestructura en [data, total].
    const [data, total] = await Promise.all([
      // Consulta 1: las citas de esta página.
      this.prisma.appointment.findMany({
        where,
        skip,                          // saltar registros de páginas previas
        take: perPage,                 // tomar como mucho perPage registros
        orderBy: { startTime: 'asc' }, // ordenadas por hora de inicio ascendente
        // include = traer también datos de tablas relacionadas.
        include: {
          client: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              avatarUrl: true,
              // Fecha de nacimiento: el frontend la usa para detectar si el
              // cliente es menor de edad (consentimiento especial de fotos).
              dateOfBirth: true,
              // Si el cliente registró su cuenta en el portal, su foto vive
              // en users.avatar_url, no en clients.avatar_url. Tambien las
              // alergias viven solo en User (no en Client local). Traemos
              // ambas y el frontend hace fallback.
              user: { select: { avatarUrl: true, allergies: true } },
            },
          },
          // Del empleado: datos básicos + color (para pintarlo en el calendario).
          employee: { select: { id: true, firstName: true, lastName: true, color: true, avatarUrl: true } },
          // Items con sus snapshots (nombre/precio/duración/comisión congelados).
          items: { select: { serviceId: true, serviceNameSnapshot: true, priceSnapshot: true, durationSnapshot: true, commissionSnapshot: true } },
          // Para que el frontend pueda filtrar pagadas vs no pagadas sin
          // hacer queries adicionales. Trae todos los pagos; el frontend
          // filtra por status=COMPLETED.
          payments: true,
          // Productos reservados con la cita (para que el empleado vea lo
          // que el cliente sumó al booking).
          productReservations: {
            include: { product: { select: { id: true, name: true, imageUrl: true } } },
          },
          // Cupón canjeado por puntos (si lo hay). discountAmount ya viene
          // como campo escalar del appointment.
          redemption: {
            select: {
              id: true,
              code: true,
              reward: { select: { name: true, type: true, discountAmount: true, discountMode: true } },
            },
          },
        },
      }),
      // Consulta 2: el conteo total de citas que cumplen el mismo filtro.
      this.prisma.appointment.count({ where }),
    ]);

    // Helper que arma { data, meta } con la info de paginación (total, páginas...).
    return buildPaginatedResponse(data, total, filters);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // findOne(): devuelve UNA cita por su id, con todo el detalle relacionado
  // (cliente, empleado, items, historial de estados, pagos, productos, cupón).
  // ───────────────────────────────────────────────────────────────────────────
  async findOne(id: string, tenantId: string) {
    // findFirst con filtro por id Y tenantId: así nunca devolvemos la cita de
    // otro negocio aunque acierten el id (seguridad multi-tenant).
    const appointment = await this.prisma.appointment.findFirst({
      where: { id, tenantId },
      include: {
        client: {
          // Incluye user para traer las alergias (viven en User.allergies
          // cuando el cliente esta vinculado a una cuenta marketplace).
          include: { user: { select: { avatarUrl: true, allergies: true } } },
        },
        employee: true, // todos los campos del empleado
        items: true,    // todos los items con sus snapshots
        // Historial de estados ordenado del más antiguo al más nuevo (asc).
        statusHistory: { orderBy: { createdAt: 'asc' } },
        payments: true,
        productReservations: {
          include: { product: { select: { id: true, name: true, imageUrl: true } } },
        },
        redemption: {
          select: {
            id: true,
            code: true,
            pointsSpent: true,
            reward: { select: { name: true, type: true, discountAmount: true, discountMode: true } },
          },
        },
        // Datos del negocio para el mensaje de anticipo por WhatsApp (los datos
        // de transferencia se toman de la config de Ventas/SPEI).
        tenant: {
          select: {
            name: true,
            shopSpeiBankName: true,
            shopSpeiHolderName: true,
            shopSpeiClabe: true,
          },
        },
      },
    });

    // Si no existe (o es de otro negocio), error 404.
    if (!appointment) {
      throw new NotFoundException('Cita no encontrada');
    }

    return { data: appointment };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // update(): actualiza SOLO las notas (visible e interna) de una cita.
  // ───────────────────────────────────────────────────────────────────────────
  async update(id: string, dto: UpdateAppointmentDto, tenantId: string, userId?: string) {
    // Buscar la cita (filtrando por negocio).
    const appointment = await this.prisma.appointment.findFirst({
      where: { id, tenantId },
    });

    if (!appointment) {
      throw new NotFoundException('Cita no encontrada');
    }

    // Actualizamos. "dto.notes ?? appointment.notes" => si el DTO NO trae notes
    // (null/undefined), conservamos el valor actual; si lo trae, usamos el nuevo.
    // Lo mismo para internalNotes. Así un campo omitido no se borra.
    const updated = await this.prisma.appointment.update({
      where: { id },
      data: {
        notes: dto.notes ?? appointment.notes,
        internalNotes: dto.internalNotes ?? appointment.internalNotes,
      },
    });

    // Auditoría: guardamos los valores antes (old) y después (new) del cambio.
    await this.auditService.log({
      tenantId,
      userId,
      action: 'appointment.updated',
      entityType: 'appointment',
      entityId: id,
      oldValues: appointment as any,
      newValues: updated as any,
    });

    return { data: updated };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // reschedule(): mueve la cita a un nuevo horario (y opcionalmente a otro
  // empleado). Revalida solapamientos en transacción Serializable y reubica los
  // horarios de cada item para que sigan encadenados correctamente.
  // ───────────────────────────────────────────────────────────────────────────
  async reschedule(id: string, dto: RescheduleDto, tenantId: string, userId?: string) {
    // Traer la cita con sus items (los necesitamos para recalcular duración).
    const appointment = await this.prisma.appointment.findFirst({
      where: { id, tenantId },
      include: { items: true },
    });

    if (!appointment) {
      throw new NotFoundException('Cita no encontrada');
    }

    // Reagendar revive y mueve la cita: se permite incluso desde un estado
    // cerrado (cancelada, ausente o completada) para "solo cambiar la fecha".
    // El estado pasa a CONFIRMED con el nuevo horario (más abajo).

    // Recuperar los servicios originales para conocer su bufferAfterMinutes
    // (el snapshot del item no guarda el buffer, así que lo leemos del servicio).
    const serviceIds = appointment.items.map((item) => item.serviceId);
    const services = await this.prisma.service.findMany({
      where: { id: { in: serviceIds }, tenantId },
    });
    // Mapa serviceId -> buffer, para buscar el margen rápido por id.
    const serviceBufferMap = new Map(
      services.map((s) => [s.id, s.bufferAfterMinutes]),
    );

    // Duración total = suma de (duración del item + su buffer). reduce() recorre
    // los items acumulando en "sum". "?? 0" usa 0 si no hubiera buffer para ese id.
    const totalDuration = appointment.items.reduce(
      (sum, item) =>
        sum + item.durationSnapshot + (serviceBufferMap.get(item.serviceId) ?? 0),
      0,
    );
    // Igual que en create: forzar UTC para preservar wall-clock literal.
    const newStartTime = parseWallClock(dto.startTime);
    // Nuevo fin = nuevo inicio + duración total (en ms).
    const newEndTime = new Date(newStartTime.getTime() + totalDuration * 60000);
    // Empleado destino: el del DTO si vino (||), o el actual de la cita.
    const employeeId = dto.employeeId || appointment.employeeId;
    // Fechas (solo YYYY-MM-DD) vieja y nueva, para invalidar caché de ambos días.
    const oldDate = appointment.startTime.toISOString().split('T')[0];
    const newDate = newStartTime.toISOString().split('T')[0];

    try {
      // Transacción Serializable: revalidar solapamientos y mover la cita de
      // forma atómica.
      const updated = await this.prisma.$transaction(
        async (tx) => {
          // Buscar solapamiento con OTRAS citas del mismo empleado. "id: { not: id }"
          // (not = "distinto de") excluye la propia cita que estamos moviendo.
          // Regla lt/gt: chocan si empieza antes del nuevo fin y termina después
          // del nuevo inicio.
          const overlap = await tx.appointment.findFirst({
            where: {
              employeeId,
              tenantId,
              id: { not: id },
              status: { notIn: ['CANCELLED', 'NO_SHOW'] },
              startTime: { lt: newEndTime },
              endTime: { gt: newStartTime },
            },
          });
          if (overlap) {
            throw new ConflictException(
              'Este horario ya está reservado.',
            );
          }

          // Same check pero contra el propio cliente: no puede tener dos
          // citas que se solapen, ni siquiera con empleados distintos.
          const clientOverlap = await tx.appointment.findFirst({
            where: {
              clientId: appointment.clientId,
              tenantId,
              id: { not: id },
              status: { notIn: ['CANCELLED', 'NO_SHOW'] },
              startTime: { lt: newEndTime },
              endTime: { gt: newStartTime },
            },
            select: { id: true },
          });
          if (clientOverlap) {
            throw new ConflictException(
              'Ya tienes una cita en este horario. Selecciona otra hora.',
            );
          }

          // Mover la cita: nuevo empleado, nuevo horario y estado CONFIRMED.
          const result = await tx.appointment.update({
            where: { id },
            data: {
              employeeId,
              startTime: newStartTime,
              endTime: newEndTime,
              status: 'CONFIRMED',
            },
          });

          // Reubicar los horarios de cada item para encadenarlos desde el nuevo
          // inicio. itemStart es el reloj que avanza item a item.
          let itemStart = new Date(newStartTime);
          for (const item of appointment.items) {
            // Buffer de ese servicio (0 si no se encuentra).
            const buffer = serviceBufferMap.get(item.serviceId) ?? 0;
            // Fin del item = inicio actual + su duración congelada.
            const itemEnd = new Date(
              itemStart.getTime() + item.durationSnapshot * 60000,
            );
            // Actualizar el item con su nuevo empleado y horario.
            await tx.appointmentItem.update({
              where: { id: item.id },
              data: {
                employeeId,
                startTime: itemStart,
                endTime: itemEnd,
              },
            });
            // Avanzar el reloj sumando el margen posterior.
            itemStart = new Date(itemEnd.getTime() + buffer * 60000);
          }

          // Registrar el cambio en el historial de estados.
          await tx.appointmentStatusHistory.create({
            data: {
              appointmentId: id,
              fromStatus: appointment.status,
              toStatus: 'CONFIRMED',
              changedBy: userId,
              notes: `Rescheduled to ${newStartTime.toISOString()}`,
            },
          });

          // Lo que devuelve el callback es lo que recibe "updated".
          return result;
        },
        // Aislamiento máximo, igual que en create().
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      // Auditoría: guardamos horario antes y después.
      await this.auditService.log({
        tenantId,
        userId,
        action: 'appointment.rescheduled',
        entityType: 'appointment',
        entityId: id,
        oldValues: { startTime: appointment.startTime, endTime: appointment.endTime },
        newValues: { startTime: newStartTime, endTime: newEndTime },
      });

      // Emitir evento de "cita reagendada" (notificaciones, etc.).
      await this.eventsService.emitAppointmentRescheduled(tenantId, id, {
        locationId: appointment.locationId,
        employeeId,
        oldStartTime: appointment.startTime.toISOString(),
        newStartTime: newStartTime.toISOString(),
      });

      // Invalidar la caché de disponibilidad de AMBOS días (el viejo y el nuevo)
      // y de ambos empleados (el original y el destino), por si cambió.
      await this.availabilityService.invalidateCache(
        tenantId, appointment.locationId, appointment.employeeId, oldDate,
      );
      await this.availabilityService.invalidateCache(
        tenantId, appointment.locationId, employeeId, newDate,
      );

      return { data: updated };
    } catch (error: any) {
      // Misma red de seguridad que en create() ante restricciones de la BD.
      if (error.code === 'P2002' || error.message?.includes('no_employee_overlap')) {
        throw new ConflictException('Este horario ya está reservado.');
      }
      throw error;
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // cancel(): cancela la cita y, en la misma transacción, DEVUELVE al cliente
  // los puntos de fidelidad que gastó y reactiva el cupón canjeado (si los hubo).
  // ───────────────────────────────────────────────────────────────────────────
  async cancel(id: string, dto: CancelDto, tenantId: string, userId?: string) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id, tenantId },
    });

    if (!appointment) {
      throw new NotFoundException('Cita no encontrada');
    }

    // No se puede cancelar una cita ya cerrada.
    if (['CANCELLED', 'COMPLETED', 'NO_SHOW'].includes(appointment.status)) {
      throw new BadRequestException(
        `No se puede cancelar una cita con estado: ${appointment.status}`,
      );
    }

    // Disposición del ANTICIPO al cancelar: la elección del negocio (dto) o, si
    // no vino (ej. el cliente cancela), la política por defecto del negocio.
    const depositPaid = Number(appointment.depositPaid || 0);
    let depositDisposition: 'forfeit' | 'credit' = 'forfeit';
    if (depositPaid > 0) {
      if (dto.depositDisposition) {
        depositDisposition = dto.depositDisposition;
      } else {
        const t = await this.prisma.tenant.findUnique({
          where: { id: tenantId },
          select: { depositCancelPolicy: true },
        });
        depositDisposition = t?.depositCancelPolicy === 'CREDIT' ? 'credit' : 'forfeit';
      }
    }

    // Transacción: cancelar + reembolsos van juntos (todo o nada).
    const updated = await this.prisma.$transaction(async (tx) => {
      // Marcar la cita como CANCELLED, guardando motivo y quién canceló.
      const cancelled = await tx.appointment.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          cancellationReason: dto.reason,
          cancelledBy: userId,
        },
      });

      // Si el cliente gastó puntos (> 0) y existe el cliente, se los devolvemos.
      // increment suma esos puntos a su saldo de fidelidad de forma atómica.
      if (appointment.pointsSpent > 0 && appointment.clientId) {
        await tx.client.update({
          where: { id: appointment.clientId },
          data: { loyaltyPoints: { increment: appointment.pointsSpent } },
        });
      }

      // Anticipo: si la disposición es 'credit', el monto pagado queda como
      // crédito a favor del cliente. Si es 'forfeit', el negocio se queda con él
      // (no se hace nada: el pago de anticipo permanece como ingreso).
      if (depositPaid > 0 && depositDisposition === 'credit' && appointment.clientId) {
        await tx.client.update({
          where: { id: appointment.clientId },
          data: { creditBalance: { increment: depositPaid } },
        });
      }

      // Si la cita usó un cupón (redemptionId), lo reactivamos: status ACTIVE y
      // usedAt a null, para que el cliente pueda reutilizarlo.
      if (appointment.redemptionId) {
        await tx.rewardRedemption.update({
          where: { id: appointment.redemptionId },
          data: { status: 'ACTIVE', usedAt: null },
        });
      }

      return cancelled;
    });

    // Historial del cambio (fuera de la transacción).
    await this.prisma.appointmentStatusHistory.create({
      data: {
        appointmentId: id,
        fromStatus: appointment.status,
        toStatus: 'CANCELLED',
        changedBy: userId,
        notes: dto.reason,
      },
    });

    // Auditoría del cambio de estado.
    await this.auditService.log({
      tenantId,
      userId,
      action: 'appointment.cancelled',
      entityType: 'appointment',
      entityId: id,
      oldValues: { status: appointment.status },
      newValues: { status: 'CANCELLED', reason: dto.reason },
    });

    // Evento de "cita cancelada".
    await this.eventsService.emitAppointmentCancelled(tenantId, id, {
      locationId: appointment.locationId,
      employeeId: appointment.employeeId,
      date: appointment.startTime.toISOString().split('T')[0],
    });

    // Invalidar caché de disponibilidad de ese día (el hueco vuelve a estar libre).
    await this.availabilityService.invalidateCache(
      tenantId,
      appointment.locationId,
      appointment.employeeId,
      appointment.startTime.toISOString().split('T')[0],
    );

    return { data: updated };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // complete(): cierra la cita (COMPLETED). Antes valida el consentimiento de
  // fotos, marca productos como entregados, deja pendiente de cobro si no hubo
  // pago, otorga puntos de fidelidad y registra la notificación de reseña.
  // ───────────────────────────────────────────────────────────────────────────
  async complete(id: string, tenantId: string, userId?: string) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id, tenantId },
    });

    if (!appointment) {
      throw new NotFoundException('Cita no encontrada');
    }

    // No tiene sentido completar dos veces (=== compara valor exacto).
    if (appointment.status === 'COMPLETED') {
      throw new BadRequestException('La cita ya está completada');
    }

    // Ni completar una cancelada.
    if (appointment.status === 'CANCELLED') {
      throw new BadRequestException('No se puede completar una cita cancelada');
    }

    // Photo requirement depends on client consent
    // null = wizard not completed yet → block
    // false = client declined → no photo required
    // true = client accepted → require at least 1 photo
    // Traducción: la exigencia de foto depende del consentimiento del cliente.
    //   null/undefined = aún no se hizo el wizard de cierre -> bloqueamos.
    //   false = el cliente rechazó -> no se requiere foto.
    //   true = el cliente aceptó -> exigimos al menos 1 foto.
    if (appointment.photoConsent === null || appointment.photoConsent === undefined) {
      throw new BadRequestException(
        'Debes completar el flujo de cierre de cita (consentimiento de fotos)',
      );
    }
    if (appointment.photoConsent === true) {
      // count() cuenta cuántas fotos tiene la cita.
      const photoCount = await this.prisma.appointmentPhoto.count({
        where: { appointmentId: id, tenantId },
      });
      // Si aceptó fotos pero no hay ninguna, no dejamos completar.
      if (photoCount === 0) {
        throw new BadRequestException(
          'El cliente aceptó fotos del resultado. Debes subir al menos una foto',
        );
      }
    }

    // Si la cita se completa sin haber registrado ningun pago previamente
    // (caso tipico: el admin marca COMPLETED desde el AppointmentModal sin
    // pasar por el wizard del empleado), la cita debe quedar pendiente de
    // cobro en el POS. Sin esto, la cita desaparece del POS y queda sin
    // posibilidad de cobrar. Si ya hay un pago COMPLETED, no hace falta.
    // OJO: excluimos los pagos de ANTICIPO (isDeposit). Un anticipo NO salda la
    // cita; si solo hay anticipo, la cita sigue "Por cobrar" (pendingPosPayment).
    const existingPayment = await this.prisma.payment.findFirst({
      where: { appointmentId: id, tenantId, status: 'COMPLETED', isDeposit: false },
      select: { id: true },
    });
    // Marcar COMPLETED. pendingPosPayment: si YA hay un pago, false (nada que
    // cobrar); si no, true (queda "Por cobrar" en el POS). El ternario decide.
    const updated = await this.prisma.appointment.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        pendingPosPayment: existingPayment ? false : true,
      },
    });

    // Productos reservados al hacer el booking: marcarlos como DELIVERED
    // cuando la cita se completa por el wizard del empleado (pago en
    // recepción o sin pago). Mismo razonamiento que en payments.service:
    // si no marcamos, quedan en PENDING y los reportes los muestran como
    // "por entregar" para siempre. El stock ya se descontó al crear la
    // reservación, aquí solo cambia el estado.
    // Marcar productos reservados como DELIVERED (entregados) al completar.
    await this.prisma.productReservation.updateMany({
      where: {
        appointmentId: id,
        tenantId,
        status: { in: ['PENDING', 'CONFIRMED', 'READY'] },
      },
      data: { status: 'DELIVERED' },
    });

    // Otorgar puntos de fidelidad al cliente según los servicios realizados.
    const items = await this.prisma.appointmentItem.findMany({
      where: { appointmentId: id },
      include: { service: { select: { pointsReward: true, price: true } } },
    });
    // totalPoints: reduce() recorre los items sumando los puntos de cada uno.
    // Por item: pointsReward si está definido (??); si no, el precio redondeado
    // hacia abajo (Math.floor) convertido a número (Number) como puntos por defecto.
    const totalPoints = items.reduce((sum, item) => {
      const pts =
        item.service.pointsReward ?? Math.floor(Number(item.service.price));
      return sum + pts;
    }, 0);
    // Solo sumamos si hay puntos (> 0) y existe el cliente. increment es atómico.
    if (totalPoints > 0 && appointment.clientId) {
      await this.prisma.client.update({
        where: { id: appointment.clientId },
        data: { loyaltyPoints: { increment: totalPoints } },
      });
    }

    // Historial del cambio a COMPLETED.
    await this.prisma.appointmentStatusHistory.create({
      data: {
        appointmentId: id,
        fromStatus: appointment.status,
        toStatus: 'COMPLETED',
        changedBy: userId,
      },
    });

    // Auditoría.
    await this.auditService.log({
      tenantId,
      userId,
      action: 'appointment.completed',
      entityType: 'appointment',
      entityId: id,
      oldValues: { status: appointment.status },
      newValues: { status: 'COMPLETED' },
    });

    // Evento de "cita completada".
    await this.eventsService.emitAppointmentCompleted(tenantId, id, {
      locationId: appointment.locationId,
      employeeId: appointment.employeeId,
    });

    // Notificación push de "Califica tu experiencia" — registramos la
    // intención. Cuando se conecte FCM/APNS, el worker que consuma
    // NotificationLog con status=SENT y channel=PUSH disparará el envío
    // real. Si hay confirmationToken, incluimos el deeplink al QR/page;
    // si no, link genérico al portal del cliente.
    try {
      // Datos del cliente para personalizar el mensaje. El ternario: si hay
      // clientId lo buscamos; si no, null. findUnique busca por clave única.
      const client = appointment.clientId
        ? await this.prisma.client.findUnique({
            where: { id: appointment.clientId },
            select: { firstName: true, email: true, phone: true },
          })
        : null;
      // Datos del negocio (slug para la URL y nombre para el texto).
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { slug: true, name: true },
      });
      // deepLink: a dónde lleva la notificación. Si hay confirmationToken, al
      // flujo de confirmar pago/reseña; si no, al detalle de la cita en el portal.
      // "tenant?.slug || ''" evita "undefined" en la URL si faltara el slug.
      const deepLink = updated.confirmationToken
        ? `/confirm-payment/${updated.confirmationToken}`
        : `/portal/${tenant?.slug || ''}/appointments/${id}`;
      // Registramos la INTENCIÓN de notificación push (un worker la enviará).
      // Los "|| null" / "|| ''" dan valores seguros si falta algún dato.
      // .trim() quita espacios sobrantes al inicio/fin del mensaje.
      await this.prisma.notificationLog.create({
        data: {
          tenantId,
          channel: 'PUSH',
          eventName: 'appointment.completed',
          recipientEmail: client?.email || null,
          recipientPhone: client?.phone || null,
          subject: 'Califica tu experiencia',
          body: `Hola ${client?.firstName || ''}, tu cita en ${tenant?.name || ''} fue completada. Califica tu experiencia: ${deepLink}`.trim(),
          status: 'SENT',
          metadata: { appointmentId: id, deepLink },
          sentAt: new Date(),
        },
      });
    } catch (err) {
      // No bloqueamos el cierre de la cita si el log de notificación falla.
      // logger.warn solo deja un aviso en consola y seguimos.
      this.logger.warn(`Failed to log appointment.completed push intent: ${err}`);
    }

    return { data: updated };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // setPhotoConsent(): guarda si el cliente acepta (true) o rechaza (false) que
  // se suban fotos del resultado. Paso del wizard previo a completar la cita.
  // ───────────────────────────────────────────────────────────────────────────
  async setPhotoConsent(
    id: string,
    tenantId: string,
    consent: boolean,
    userId?: string,
  ) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id, tenantId },
    });

    if (!appointment) {
      throw new NotFoundException('Cita no encontrada');
    }

    // No se puede tocar el consentimiento si la cita ya está finalizada.
    if (['COMPLETED', 'CANCELLED'].includes(appointment.status)) {
      throw new BadRequestException('No se puede modificar una cita finalizada');
    }

    // Guardamos el consentimiento y la fecha/hora en que se dio.
    const updated = await this.prisma.appointment.update({
      where: { id },
      data: { photoConsent: consent, photoConsentAt: new Date() },
    });

    return { data: updated };
  }

  /**
   * El empleado finalizó el servicio (consent + fotos opcionales) pero el
   * cliente pagará en recepción. Marca la cita pendingPosPayment=true para
   * que aparezca en /pos con badge "Por cobrar". La cita queda IN_PROGRESS;
   * el POS la completará tras registrar el pago.
   */
  async deferToPos(id: string, tenantId: string, userId?: string) {
    // Traemos la cita con sus pagos: si ya tiene pago, no se puede diferir.
    const appointment = await this.prisma.appointment.findFirst({
      where: { id, tenantId },
      include: { payments: true },
    });

    if (!appointment) {
      throw new NotFoundException('Cita no encontrada');
    }

    // No se delega al POS una cita ya finalizada.
    if (['COMPLETED', 'CANCELLED'].includes(appointment.status)) {
      throw new BadRequestException('No se puede delegar al POS una cita finalizada');
    }

    // Si ya hay pago(s), no tiene sentido dejarla "Por cobrar".
    if (appointment.payments.length > 0) {
      throw new ConflictException('Esta cita ya tiene un pago registrado');
    }

    // Marcar pendingPosPayment=true. El estado pasa a IN_PROGRESS solo si venía
    // de PENDING o CONFIRMED (||); en otro caso (ternario) lo dejamos como estaba.
    const updated = await this.prisma.appointment.update({
      where: { id },
      data: {
        pendingPosPayment: true,
        status: appointment.status === 'PENDING' || appointment.status === 'CONFIRMED'
          ? 'IN_PROGRESS'
          : appointment.status,
      },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'appointment.deferred_to_pos',
      entityType: 'appointment',
      entityId: id,
    });

    return { data: updated };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // recordPayment(): registra el pago de una cita. Calcula el subtotal
  // (servicios + productos), aplica descuento y propina, y crea el Payment.
  // ───────────────────────────────────────────────────────────────────────────
  async recordPayment(
    id: string,
    tenantId: string,
    dto: {
      paymentMethod: string;
      amount?: number;
      tipAmount?: number;
      discountAmount?: number;
      notes?: string;
    },
    userId?: string,
  ) {
    // Traer la cita con sus items (precios), productos y pagos previos.
    const appointment = await this.prisma.appointment.findFirst({
      where: { id, tenantId },
      include: {
        items: { select: { priceSnapshot: true } },
        productReservations: { select: { unitPrice: true, quantity: true } },
        payments: true,
      },
    });

    if (!appointment) {
      throw new NotFoundException('Cita no encontrada');
    }

    // No se cobra una cita cancelada.
    if (appointment.status === 'CANCELLED') {
      throw new BadRequestException('No se puede registrar pago en una cita cancelada');
    }

    // No se permite un segundo pago. Los pagos de ANTICIPO (isDeposit) NO
    // cuentan aquí: son prepagos que se descuentan del total, no el cobro final.
    if (appointment.payments.some((p) => !p.isDeposit)) {
      throw new ConflictException('Esta cita ya tiene un pago registrado');
    }

    // Subtotal = servicios + productos. Si el front lo envía (dto.amount) lo
    // usamos; si no, lo recalculamos para no depender solo de los servicios.
    // servicesTotal: reduce() suma el precio (snapshot) de cada item. Number()
    // convierte el Decimal de Prisma a número normal para poder sumar.
    const servicesTotal = appointment.items.reduce(
      (sum, i) => sum + Number(i.priceSnapshot),
      0,
    );
    // productsTotal: reduce() suma precio unitario × cantidad de cada producto.
    // "p.quantity ?? 1" usa 1 si la cantidad fuera null/undefined.
    const productsTotal = appointment.productReservations.reduce(
      (sum, p) => sum + Number(p.unitPrice) * Number(p.quantity ?? 1),
      0,
    );
    // subtotal: el monto enviado por el front (dto.amount) o, si no vino (??),
    // la suma de servicios + productos.
    const subtotal = dto.amount ?? servicesTotal + productsTotal;
    // Propina: nunca negativa. Math.max(0, x) devuelve 0 si x fuera menor que 0.
    const tipAmount = Math.max(0, dto.tipAmount ?? 0);
    // Descuento: el del DTO o el guardado en la cita (??), también acotado a >= 0.
    const discountAmount = Math.max(
      0,
      dto.discountAmount ?? Number(appointment.discountAmount ?? 0),
    );
    // Anticipo ya pagado: se descuenta del total a cobrar (es un prepago).
    const depositPaid = Math.max(0, Number(appointment.depositPaid ?? 0));
    // Total cobrado = subtotal − descuento − anticipo + propina. Guardamos el
    // desglose para que el QR del cliente muestre el mismo monto que se cobró.
    // Math.max(0, ...) evita un total negativo si descuento+anticipo superaran al subtotal.
    const totalAmount = Math.max(0, subtotal - discountAmount - depositPaid) + tipAmount;

    // Crear el registro de pago (COMPLETED, moneda MXN).
    const payment = await this.prisma.payment.create({
      data: {
        tenantId,
        appointmentId: id,
        clientId: appointment.clientId,
        locationId: appointment.locationId,
        amount: subtotal,
        tipAmount,
        discountAmount,
        totalAmount,
        currency: 'MXN',
        // "as any" relaja el tipo del método de pago (string -> enum de Prisma).
        paymentMethod: dto.paymentMethod as any,
        status: 'COMPLETED',
        notes: dto.notes,
      },
    });

    // Auditoría del pago registrado.
    await this.auditService.log({
      tenantId,
      userId,
      action: 'appointment.payment_recorded',
      entityType: 'appointment',
      entityId: id,
      newValues: { paymentMethod: dto.paymentMethod, totalAmount, tipAmount, discountAmount },
    });

    return { data: payment };
  }

  /**
   * Genera el token de confirmación que el cliente usa para confirmar el
   * cobro y dejar su reseña desde su móvil (QR/link al cierre de cita).
   * Idempotente: si ya existe token y no se confirmó, lo devuelve. Si ya
   * se confirmó (confirmedAt set), no se vuelve a generar.
   */
  async generateConfirmationToken(id: string, tenantId: string) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id, tenantId },
      select: { id: true, status: true, confirmationToken: true, confirmedAt: true },
    });
    if (!appointment) throw new NotFoundException('Cita no encontrada');
    // Si ya se confirmó, devolvemos el token existente marcándolo como confirmado.
    if (appointment.confirmedAt) {
      return { data: { token: appointment.confirmationToken, alreadyConfirmed: true } };
    }
    // Si ya existe token (pero sin confirmar), lo reutilizamos (idempotente).
    if (appointment.confirmationToken) {
      return { data: { token: appointment.confirmationToken, alreadyConfirmed: false } };
    }
    // Token de 12 chars (sin ambiguos 0/O, 1/I/L). 32^12 ~ 1.15e18 combinaciones.
    // chars es el alfabeto permitido. Generamos 12 caracteres al azar:
    //   - Math.random() da un decimal entre 0 y 1.
    //   - × chars.length lo escala al rango del alfabeto.
    //   - Math.floor() lo baja al entero (índice válido).
    //   - charAt(índice) toma esa letra y la concatenamos al token.
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let token = '';
    for (let i = 0; i < 12; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    // Guardamos el token recién generado en la cita.
    const updated = await this.prisma.appointment.update({
      where: { id },
      data: { confirmationToken: token },
      select: { confirmationToken: true },
    });
    return { data: { token: updated.confirmationToken, alreadyConfirmed: false } };
  }

  /**
   * Lista citas pendientes de recordatorio WhatsApp. Por defecto:
   * - PENDING o CONFIRMED (no canceladas/completadas)
   * - startTime entre ahora y ahora+36h
   * - reminderSentAt null
   *
   * Si sentToday=true, devuelve solo las que YA se les envio recordatorio
   * hoy (para la pestaña "Enviados hoy").
   */
  async listPendingReminders(
    tenantId: string,
    opts: { hoursAhead: number; sentToday: boolean },
  ) {
    const now = new Date();
    // limit = ahora + N horas (en ms): hoursAhead × 3600 (segundos/hora) × 1000
    // (ms/segundo). Define hasta cuándo miramos hacia el futuro.
    const limit = new Date(now.getTime() + opts.hoursAhead * 3600 * 1000);

    // Filtro base: del negocio, abiertas (PENDING/CONFIRMED) y que empiecen entre
    // ahora (gte) y el límite (lte).
    const where: any = {
      tenantId,
      status: { in: ['PENDING', 'CONFIRMED'] },
      startTime: { gte: now, lte: limit },
    };

    if (opts.sentToday) {
      // Pestaña "Enviados hoy": queremos las que YA recibieron recordatorio hoy.
      // todayStart = copia de "now" con la hora puesta a 00:00:00.000 (medianoche).
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      // reminderSentAt >= medianoche de hoy.
      where.reminderSentAt = { gte: todayStart };
    } else {
      // Por defecto: solo las que AÚN no tienen recordatorio (reminderSentAt null).
      where.reminderSentAt = null;
    }

    const appointments = await this.prisma.appointment.findMany({
      where,
      include: {
        client: {
          select: { id: true, firstName: true, lastName: true, phone: true, avatarUrl: true },
        },
        employee: {
          select: { id: true, firstName: true, lastName: true, color: true, avatarUrl: true },
        },
        items: {
          select: { serviceNameSnapshot: true, priceSnapshot: true, durationSnapshot: true },
        },
      },
      orderBy: { startTime: 'asc' }, // de la más próxima a la más lejana
    });

    return { data: appointments };
  }

  /**
   * Marca la cita como "recordatorio enviado" y, si no existe, genera el
   * confirmationToken para que el frontend lo incluya en el wa.me link.
   */
  async markReminderSent(id: string, tenantId: string) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id, tenantId },
      select: { id: true, confirmationToken: true },
    });
    if (!appointment) throw new NotFoundException('Cita no encontrada');

    // Reutilizamos el token si ya existe; si no (!token), generamos uno nuevo
    // con el mismo método que generateConfirmationToken (12 chars sin ambiguos).
    let token = appointment.confirmationToken;
    if (!token) {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      token = '';
      for (let i = 0; i < 12; i++) {
        token += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    }

    // Guardar el token y sellar la fecha/hora de envío del recordatorio.
    await this.prisma.appointment.update({
      where: { id },
      data: {
        confirmationToken: token,
        reminderSentAt: new Date(),
      },
    });

    return { data: { token, reminderSentAt: new Date().toISOString() } };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // confirm(): el negocio confirma una cita que estaba PENDING o RESCHEDULED,
  // dejándola en CONFIRMED.
  // ───────────────────────────────────────────────────────────────────────────
  async confirm(id: string, tenantId: string, userId?: string) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id, tenantId },
    });

    if (!appointment) {
      throw new NotFoundException('Cita no encontrada');
    }

    // Solo se confirman citas pendientes o reagendadas. El "!" niega includes:
    // si el estado NO está en la lista permitida, lanzamos error.
    if (!['PENDING', 'RESCHEDULED'].includes(appointment.status)) {
      throw new BadRequestException('Solo se pueden confirmar citas pendientes o reagendadas');
    }

    // Cambiar el estado a CONFIRMED.
    const updated = await this.prisma.appointment.update({
      where: { id },
      data: { status: 'CONFIRMED' },
    });

    // Historial del cambio.
    await this.prisma.appointmentStatusHistory.create({
      data: {
        appointmentId: id,
        fromStatus: appointment.status,
        toStatus: 'CONFIRMED',
        changedBy: userId,
      },
    });

    // Auditoría.
    await this.auditService.log({
      tenantId,
      userId,
      action: 'appointment.confirmed',
      entityType: 'appointment',
      entityId: id,
      oldValues: { status: appointment.status },
      newValues: { status: 'CONFIRMED' },
    });

    // Evento de "cita confirmada".
    await this.eventsService.emitAppointmentConfirmed(tenantId, id, {
      locationId: appointment.locationId,
      employeeId: appointment.employeeId,
    });

    return { data: updated };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // confirmDeposit(): el negocio confirma el anticipo (depósito) de una cita.
  //   - action 'accept'           → registra el monto recibido y CONFIRMA la cita.
  //   - action 'request_remainder'→ registra un parcial; la cita sigue PENDING.
  //   - action 'waive'            → exonera el anticipo y CONFIRMA la cita.
  // El monto recibido se acumula en depositPaid (puede haber varios pagos
  // parciales). Cada pago se registra como Payment con isDeposit=true para que
  // NO bloquee el cobro final (que filtra los pagos de anticipo).
  // ───────────────────────────────────────────────────────────────────────────
  async confirmDeposit(
    id: string,
    tenantId: string,
    dto: { amount: number; action: 'accept' | 'request_remainder' | 'waive' },
    userId?: string,
  ) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id, tenantId },
    });
    if (!appointment) throw new NotFoundException('Cita no encontrada');
    if (!appointment.depositRequired) {
      throw new BadRequestException('Esta cita no requiere anticipo');
    }
    // Se puede registrar el anticipo mientras la cita no esté cancelada/ausente
    // (incluso si ya está completada y solo falta cobrar el resto).
    if (['CANCELLED', 'NO_SHOW'].includes(appointment.status)) {
      throw new BadRequestException('No se puede registrar anticipo en una cita cancelada o ausente');
    }

    // Solo confirmamos la cita (cambiamos su estado a CONFIRMED) si venía
    // PENDIENTE/REAGENDADA. Si ya estaba confirmada/en curso/completada, el
    // registro del anticipo NO altera su estado (solo descuenta del total).
    const shouldConfirm = ['PENDING', 'RESCHEDULED'].includes(appointment.status);
    const applyDeposit = async (extraData: Record<string, any>) => {
      const updated = await this.prisma.appointment.update({
        where: { id },
        data: { ...(shouldConfirm ? { status: 'CONFIRMED' } : {}), ...extraData },
      });
      if (shouldConfirm) {
        await this.prisma.appointmentStatusHistory.create({
          data: {
            appointmentId: id,
            fromStatus: appointment.status,
            toStatus: 'CONFIRMED',
            changedBy: userId,
          },
        });
        await this.eventsService.emitAppointmentConfirmed(tenantId, id, {
          locationId: appointment.locationId,
          employeeId: appointment.employeeId,
        });
      }
      return updated;
    };

    // Omitir anticipo: exonera y confirma (si venía pendiente), sin registrar pago.
    if (dto.action === 'waive') {
      const updated = await applyDeposit({ depositWaived: true });
      await this.auditService.log({
        tenantId,
        userId,
        action: 'appointment.deposit_waived',
        entityType: 'appointment',
        entityId: id,
        oldValues: { status: appointment.status },
        newValues: { status: 'CONFIRMED', depositWaived: true },
      });
      return { data: updated };
    }

    // accept | request_remainder: registramos el monto recibido como anticipo.
    const amount = Math.max(0, Number(dto.amount) || 0);
    const newPaid = Number(appointment.depositPaid || 0) + amount;
    if (amount > 0) {
      await this.prisma.payment.create({
        data: {
          tenantId,
          appointmentId: id,
          clientId: appointment.clientId,
          locationId: appointment.locationId,
          amount,
          totalAmount: amount,
          paymentMethod: 'TRANSFER',
          status: 'COMPLETED',
          isDeposit: true,
          notes: 'Anticipo',
          createdBy: userId,
        },
      });
    }

    if (dto.action === 'accept') {
      // Registrar el anticipo recibido. Si estaba exonerado, lo reactivamos.
      const updated = await applyDeposit({ depositPaid: newPaid, depositWaived: false });
      await this.auditService.log({
        tenantId,
        userId,
        action: 'appointment.deposit_confirmed',
        entityType: 'appointment',
        entityId: id,
        newValues: { depositPaid: newPaid },
      });
      return { data: updated };
    }

    // request_remainder: no cambia el estado; solo acumulamos el parcial.
    const updated = await this.prisma.appointment.update({
      where: { id },
      data: { depositPaid: newPaid, depositWaived: false },
    });
    await this.auditService.log({
      tenantId,
      userId,
      action: 'appointment.deposit_partial',
      entityType: 'appointment',
      entityId: id,
      newValues: { depositPaid: newPaid },
    });
    return { data: updated };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // noShow(): marca la cita como NO_SHOW (el cliente no se presentó).
  // ───────────────────────────────────────────────────────────────────────────
  async noShow(id: string, tenantId: string, userId?: string) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id, tenantId },
    });

    if (!appointment) {
      throw new NotFoundException('Cita no encontrada');
    }

    // No se puede marcar no-show una cita ya cerrada.
    if (['CANCELLED', 'COMPLETED', 'NO_SHOW'].includes(appointment.status)) {
      throw new BadRequestException(
        `No se puede marcar como no-show una cita con estado: ${appointment.status}`,
      );
    }

    // Cambiar estado a NO_SHOW.
    const updated = await this.prisma.appointment.update({
      where: { id },
      data: { status: 'NO_SHOW' },
    });

    // Anticipo en no-show: aplica la política por defecto del negocio. Por
    // defecto 'forfeit' (no asistió → pierde la garantía); si el negocio
    // configuró 'CREDIT', el anticipo queda como crédito del cliente.
    const depositPaid = Number(appointment.depositPaid || 0);
    if (depositPaid > 0 && appointment.clientId) {
      const t = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { depositCancelPolicy: true },
      });
      if (t?.depositCancelPolicy === 'CREDIT') {
        await this.prisma.client.update({
          where: { id: appointment.clientId },
          data: { creditBalance: { increment: depositPaid } },
        });
      }
    }

    // Historial del cambio.
    await this.prisma.appointmentStatusHistory.create({
      data: {
        appointmentId: id,
        fromStatus: appointment.status,
        toStatus: 'NO_SHOW',
        changedBy: userId,
      },
    });

    // Auditoría.
    await this.auditService.log({
      tenantId,
      userId,
      action: 'appointment.no_show',
      entityType: 'appointment',
      entityId: id,
      oldValues: { status: appointment.status },
      newValues: { status: 'NO_SHOW' },
    });

    // Evento de "no-show".
    await this.eventsService.emitAppointmentNoShow(tenantId, id, {
      locationId: appointment.locationId,
      employeeId: appointment.employeeId,
    });

    return { data: updated };
  }
}
