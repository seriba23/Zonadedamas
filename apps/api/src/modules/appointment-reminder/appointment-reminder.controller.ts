// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS: traemos "piezas" de otras librerías para poder usarlas aquí.
// ─────────────────────────────────────────────────────────────────────────────

// De NestJS (el framework del backend) importamos los "decoradores" que sirven
// para declarar un endpoint HTTP. Un decorador es una etiqueta que empieza con
// "@" y se pone arriba de una clase o método para darle un comportamiento extra.
//   - Controller: marca una clase como "controlador" (un grupo de endpoints).
//   - Get / Post: marcan un método como endpoint que responde a GET o POST.
//   - Param: lee un trozo de la URL (ej. el :token de /public/c/:token).
//   - Query: lee un parámetro de la query string (ej. ?date=2026-06-23).
//   - Body: lee el cuerpo (JSON) que el cliente envía en un POST.
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';

// Throttle = "limitador de peticiones". Sirve para impedir que alguien llame al
// endpoint demasiadas veces (protección anti-abuso/spam). Lo configuramos abajo.
import { Throttle } from '@nestjs/throttler';

// Importamos el "servicio": la clase que tiene la lógica de verdad (consultar la
// base de datos, confirmar, cancelar, etc.). El controlador solo recibe la
// petición HTTP y se la pasa al servicio. Así se separa "recibir la llamada"
// (controller) de "hacer el trabajo" (service).
import { AppointmentReminderService } from './appointment-reminder.service';

/**
 * Endpoints publicos para el recordatorio pre-cita del cliente. El admin
 * dispara el recordatorio desde su dashboard (link wa.me) y el cliente
 * abre /c/:token donde puede confirmar, reagendar o cancelar la cita.
 *
 * Sin auth. El token es la auth (mismo confirmationToken del Appointment).
 */
// @Controller('public/c') => todas las rutas de esta clase empiezan con
// "/api/public/c". (El prefijo "/api" se agrega globalmente en otra parte.)
// Así, un método con @Get(':token') responde a GET /api/public/c/<token>.
@Controller('public/c')
export class AppointmentReminderController {
  // CONSTRUCTOR + INYECCIÓN DE DEPENDENCIAS:
  // NestJS crea automáticamente una instancia del servicio y nos la "inyecta"
  // aquí. El "private readonly" hace que quede guardada como propiedad de la
  // clase (this.service) y que NO se pueda reasignar (readonly = solo lectura).
  constructor(private readonly service: AppointmentReminderService) {}

  // ── GET /api/public/c/:token ──────────────────────────────────────────────
  // Devuelve los datos de la cita asociada a ese token (para mostrarlos en la
  // página que abre el cliente). Es el primer endpoint que se llama al abrir
  // el link del WhatsApp.
  @Get(':token')
  // Límite: máximo 30 llamadas por minuto (ttl = 60000 ms = 60 s) desde la
  // misma IP. Si se pasa, NestJS responde error 429 (demasiadas peticiones).
  // Aquí el límite es alto (30) porque solo lee datos, no cambia nada.
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async resolve(@Param('token') token: string) {
    // @Param('token') => toma el valor que venga en la posición :token de la URL
    // y lo guarda en la variable "token" (de tipo string).

    // Le pedimos al servicio que busque la cita. "await" significa "espera a que
    // termine esta operación (que tarda, porque va a la base de datos) antes de
    // seguir". El resultado se guarda en "data".
    const data = await this.service.resolve(token);

    // Respondemos en el formato estándar del proyecto: { data: ... }.
    return { data };
  }

  // ── POST /api/public/c/:token/confirm ─────────────────────────────────────
  // El cliente confirma que SÍ asistirá. Cambia el estado de la cita a CONFIRMED.
  @Post(':token/confirm')
  // Límite más estricto (10/min) porque esto MODIFICA datos.
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async confirm(@Param('token') token: string) {
    // Delegamos todo al servicio y devolvemos directamente lo que él devuelva.
    return this.service.confirm(token);
  }

  // ── POST /api/public/c/:token/cancel ──────────────────────────────────────
  // El cliente cancela la cita. Puede mandar un motivo opcional.
  @Post(':token/cancel')
  // Límite aún más bajo (5/min): cancelar es una acción sensible.
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async cancel(
    @Param('token') token: string,
    // @Body() lee el JSON enviado. Aquí esperamos un objeto que PUEDE traer un
    // campo "reason" (motivo). El "?" en "reason?" significa que es opcional.
    @Body() body: { reason?: string },
  ) {
    // "body?.reason" => el "?." (optional chaining) evita un error si "body"
    // llegara vacío/undefined: en ese caso devuelve undefined en vez de romper.
    return this.service.cancel(token, body?.reason);
  }

  // ── GET /api/public/c/:token/availability?date=YYYY-MM-DD ─────────────────
  // Devuelve los horarios libres del mismo profesional para una fecha dada,
  // para que el cliente pueda elegir uno nuevo al reagendar.
  @Get(':token/availability')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async availability(
    @Param('token') token: string,
    // @Query('date') lee el parámetro "date" de la URL (?date=2026-06-23).
    @Query('date') date: string,
  ) {
    return this.service.availability(token, date);
  }

  // ── POST /api/public/c/:token/reschedule ──────────────────────────────────
  // El cliente reagenda: envía la nueva hora de inicio elegida (startTime).
  @Post(':token/reschedule')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async reschedule(
    @Param('token') token: string,
    // El cuerpo trae "startTime" (la nueva fecha-hora). Aquí NO lleva "?",
    // así que es obligatorio.
    @Body() body: { startTime: string },
  ) {
    return this.service.reschedule(token, body.startTime);
  }
}
