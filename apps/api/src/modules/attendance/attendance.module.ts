// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS: traemos las piezas que este "módulo" necesita para armarse.
// ─────────────────────────────────────────────────────────────────────────────

// Module = decorador de NestJS que sirve para AGRUPAR clases relacionadas
// (controladores + servicios) en una unidad llamada "módulo". NestJS arma toda
// la aplicación juntando módulos como si fueran piezas de LEGO.
import { Module } from '@nestjs/common';

// El controlador: la clase que recibe las peticiones HTTP (GET/POST/PUT) y las
// reparte hacia el servicio. Es la "puerta de entrada" del módulo de asistencia.
import { AttendanceController } from './attendance.controller';

// El servicio: la clase que tiene la LÓGICA de verdad (consultar la base de
// datos, calcular distancias, registrar entradas/salidas, etc.).
import { AttendanceService } from './attendance.service';

/**
 * Módulo de Asistencia (Attendance).
 *
 * Agrupa todo lo relacionado con el registro de asistencia de los empleados:
 * marcar entrada (check-in), marcar salida (check-out), historial, estadísticas
 * y la aprobación/rechazo de registros por parte del administrador.
 */
@Module({
  // controllers: lista de controladores que pertenecen a este módulo. Aquí solo
  // hay uno. NestJS lee sus decoradores (@Get, @Post...) para registrar las rutas.
  controllers: [AttendanceController],
  // providers: lista de servicios "inyectables" que viven dentro del módulo.
  // Al estar aquí, NestJS sabe crearlos y pasarlos (inyectarlos) a quien los pida.
  providers: [AttendanceService],
  // exports: qué cosas de este módulo quedan DISPONIBLES para OTROS módulos que
  // importen a AttendanceModule. Exportamos el servicio por si otro módulo
  // necesitara usar su lógica de asistencia.
  exports: [AttendanceService],
})
// La clase queda vacía a propósito: toda la "configuración" del módulo vive en
// el decorador @Module de arriba. La clase solo le da un nombre al módulo.
export class AttendanceModule {}
