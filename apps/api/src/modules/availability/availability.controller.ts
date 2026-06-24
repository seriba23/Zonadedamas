// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS: traemos "piezas" de otras librerías y archivos para usarlas aquí.
// ─────────────────────────────────────────────────────────────────────────────

// Decoradores de NestJS para declarar endpoints HTTP. Un decorador es una
// etiqueta que empieza con "@" y se pone sobre una clase o método.
//   - Body: lee el cuerpo (JSON) que el cliente envía en la petición.
//   - Controller: marca la clase como "controlador" (un grupo de endpoints).
//   - Post: marca un método como endpoint que responde a peticiones POST.
//   - UseGuards: aplica "guardias" (filtros de seguridad) que se ejecutan ANTES
//     del método: si no pasan, la petición se rechaza.
import { Body, Controller, Post, UseGuards } from '@nestjs/common';

// El servicio con toda la lógica de cálculo de disponibilidad.
import { AvailabilityService } from './availability.service';
// Los DTOs que describen y validan el cuerpo de cada endpoint.
import { AvailabilityQueryDto } from './dto/availability-query.dto';
import { BundleAvailabilityQueryDto } from './dto/bundle-availability-query.dto';
import { CompositeAvailabilityQueryDto } from './dto/composite-availability-query.dto';
import { AllSlotsQueryDto } from './dto/all-slots-query.dto';
import { CheckAfterDto } from './dto/check-after.dto';

// JwtAuthGuard: guardia que exige un token JWT válido (usuario logueado).
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
// PermissionGuard: guardia que comprueba que el usuario tenga el permiso
// requerido (se combina con @RequirePermissions).
import { PermissionGuard } from '../../common/guards/permission.guard';
// RequirePermissions: decorador que declara QUÉ permiso hace falta para un
// endpoint (ej. 'availability.read'). El PermissionGuard lo lee.
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
// CurrentTenant: decorador de parámetro que extrae el tenantId (el negocio) del
// token JWT, para que cada consulta se filtre por su negocio (multi-tenant).
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';

// @Controller('availability') => todas las rutas de esta clase empiezan con
// "/api/availability" (el prefijo "/api" se agrega globalmente).
// @UseGuards(JwtAuthGuard, PermissionGuard) => TODOS los endpoints de esta clase
// requieren: 1) estar logueado (JWT válido) y 2) pasar el chequeo de permisos.
@Controller('availability')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class AvailabilityController {
  // INYECCIÓN DE DEPENDENCIAS: NestJS crea el AvailabilityService y lo pasa aquí.
  // "private readonly" lo guarda como propiedad de solo lectura (this.availabilityService).
  constructor(private readonly availabilityService: AvailabilityService) {}

  // ── POST /api/availability/query ──────────────────────────────────────────
  // Devuelve los slots libres en un rango de fechas, agrupados por día y empleado,
  // y luego los "aplana" a una lista simple para el frontend.
  @Post('query')
  // @RequirePermissions('availability.read') => quien llame debe tener este permiso.
  @RequirePermissions('availability.read')
  async query(
    // @CurrentTenant() => inyecta el id del negocio extraído del JWT.
    @CurrentTenant() tenantId: string,
    // @Body() => toma el JSON enviado y lo valida contra AvailabilityQueryDto.
    @Body() query: AvailabilityQueryDto,
  ) {
    // Pedimos al servicio los slots. "await" espera a que termine (va a la BD).
    // El resultado tiene forma anidada: { data: [ { date, employees:[ { slots:[…] } ] } ] }.
    const result = await this.availabilityService.getAvailableSlots(query, tenantId);

    // Flatten nested response into array of slots with employeeId
    // flatSlots será la lista PLANA de resultados (un objeto por cada slot),
    // más fácil de pintar en el frontend que la estructura anidada.
    const flatSlots: Array<{
      startTime: string;
      endTime: string;
      employeeId: string;
      employeeName: string;
    }> = [];

    // TRIPLE BUCLE para recorrer la estructura anidada y aplanarla:
    //   - "day" recorre cada día del resultado.
    //   - "emp" recorre cada empleado dentro de ese día.
    //   - "slot" recorre cada hueco de horario de ese empleado.
    for (const day of result.data) {
      for (const emp of day.employees) {
        for (const slot of emp.slots) {
          // Por cada slot agregamos un objeto plano a flatSlots.
          // Construimos las fechas-hora completas concatenando el día con la
          // hora del slot (ej. "2026-06-23" + "T" + "09:30" + ":00").
          flatSlots.push({
            startTime: `${day.date}T${slot.startTime}:00`,
            endTime: `${day.date}T${slot.endTime}:00`,
            employeeId: emp.id,
            employeeName: emp.name,
          });
        }
      }
    }

    // Respondemos en el formato estándar del proyecto: { data: ... }.
    return { data: flatSlots };
  }

  // ── POST /api/availability/all-slots ──────────────────────────────────────
  // Devuelve TODOS los slots de un empleado en un día (libres y ocupados),
  // marcando cada uno con available: true/false. Útil para pintar la rejilla.
  @Post('all-slots')
  @RequirePermissions('availability.read')
  async allSlots(
    @CurrentTenant() tenantId: string,
    @Body() query: AllSlotsQueryDto,
  ) {
    // Llamamos al servicio pasando los campos del DTO uno por uno.
    const result = await this.availabilityService.getAllSlotsForEmployee(
      query.employeeId,
      query.date,
      query.serviceIds,
      tenantId,
    );
    return { data: result };
  }

  // ── POST /api/availability/check-after ────────────────────────────────────
  // Comprueba si el empleado puede atender JUSTO DESPUÉS de cierta hora, y si no,
  // busca el siguiente hueco disponible (mismo día o próximos 14 días).
  @Post('check-after')
  @RequirePermissions('availability.read')
  async checkAfter(
    @CurrentTenant() tenantId: string,
    @Body() dto: CheckAfterDto,
  ) {
    const result = await this.availabilityService.checkAfterTime(dto, tenantId);
    return { data: result };
  }

  // ── POST /api/availability/bundle ─────────────────────────────────────────
  // Disponibilidad de un "paquete" de servicios encadenados (posiblemente con
  // distintos empleados). Devuelve directamente lo que da el servicio.
  @Post('bundle')
  @RequirePermissions('availability.read')
  async bundleAvailability(
    @CurrentTenant() tenantId: string,
    @Body() query: BundleAvailabilityQueryDto,
  ) {
    return this.availabilityService.getBundleAvailability(query, tenantId);
  }

  // ── POST /api/availability/composite ──────────────────────────────────────
  // Disponibilidad cuando cada servicio tiene un empleado fijo asignado. Luego
  // "aplana" la respuesta para que el frontend la pinte igual que los slots simples.
  @Post('composite')
  @RequirePermissions('availability.read')
  async compositeAvailability(
    @CurrentTenant() tenantId: string,
    @Body() query: CompositeAvailabilityQueryDto,
  ) {
    const result = await this.availabilityService.getCompositeAvailability(query, tenantId);
    // Pasamos el resultado por la función auxiliar de abajo para aplanarlo.
    return flattenCompositeResult(result);
  }
}

// Aplana la respuesta nested {data:[{date, slots:[{startTime, endTime, assignments}]}]}
// al mismo shape que /availability ({data:[{startTime ISO, endTime ISO,
// employeeId, employeeName, assignments}]}) para que el frontend no
// necesite codigo distinto al renderizar slots compositos vs simples.
//
// Tambien soporta la respuesta de getAvailableSlots cuando hay 1 solo
// assignment (delegacion): ese shape ya es {data:[{date, employees:[...]}]}.
//
// "result: any" => acepta cualquier forma de entrada (porque puede venir en dos
// formas distintas, como explican los comentarios de arriba). Devuelve siempre
// la forma plana { data: [...] }.
function flattenCompositeResult(result: any): {
  data: Array<{
    startTime: string;
    endTime: string;
    employeeId: string;
    employeeName: string;
    assignments?: any[];
  }>;
} {
  // Lista plana de salida (cada elemento es un slot listo para el frontend).
  const flatSlots: Array<{
    startTime: string;
    endTime: string;
    employeeId: string;
    employeeName: string;
    assignments?: any[];
  }> = [];

  // Recorremos cada día de la respuesta. "result.data || []" usa el operador
  // "||" (o): si result.data fuera null/undefined, recorre un arreglo vacío en
  // su lugar (evita un error al iterar sobre "nada").
  for (const day of result.data || []) {
    // Hay dos formas posibles de "day". Decidimos según qué propiedad trae:
    if (day.slots) {
      // Composite shape: el día trae "slots", cada uno con "assignments".
      for (const slot of day.slots) {
        // firstAssignment = la primera asignación del slot (el primer
        // servicio/empleado). "slot.assignments?.[0]" usa "?." para que si
        // "assignments" fuera undefined no se rompa, y "[0]" toma el primer
        // elemento de la lista.
        const firstAssignment = slot.assignments?.[0];
        flatSlots.push({
          startTime: `${day.date}T${slot.startTime}:00`,
          endTime: `${day.date}T${slot.endTime}:00`,
          // "firstAssignment?.employeeId || ''" => si hay primera asignación
          // toma su employeeId; si no (?. da undefined), el "|| ''" pone "".
          employeeId: firstAssignment?.employeeId || '',
          employeeName: firstAssignment?.employeeName || '',
          // Conservamos la lista completa de asignaciones por si el frontend
          // necesita mostrar qué empleado hace cada servicio.
          assignments: slot.assignments,
        });
      }
    } else if (day.employees) {
      // getAvailableSlots shape (delegacion en caso de 1 assignment)
      // Aquí el día trae "employees", cada uno con sus propios "slots".
      for (const emp of day.employees) {
        for (const slot of emp.slots) {
          flatSlots.push({
            startTime: `${day.date}T${slot.startTime}:00`,
            endTime: `${day.date}T${slot.endTime}:00`,
            employeeId: emp.id,
            employeeName: emp.name,
          });
        }
      }
    }
  }

  return { data: flatSlots };
}
