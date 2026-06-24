// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS: traemos "piezas" de otras librerías para poder usarlas aquí.
// ─────────────────────────────────────────────────────────────────────────────

// De NestJS (el framework del backend) importamos los "decoradores" que sirven
// para declarar un endpoint HTTP. Un decorador es una etiqueta que empieza con
// "@" y se pone arriba de una clase o método para darle un comportamiento extra.
//   - Body: lee el cuerpo (JSON) que el cliente envía en un POST.
//   - Controller: marca una clase como "controlador" (un grupo de endpoints).
//   - Get / Post: marcan un método como endpoint que responde a GET o POST.
//   - Param: lee un trozo de la URL (ej. el :token de /public/confirm-payment/:token).
import { Body, Controller, Get, Param, Post } from '@nestjs/common';

// Throttle = "limitador de peticiones". Sirve para impedir que alguien llame al
// endpoint demasiadas veces (protección anti-abuso/spam). Lo configuramos abajo
// con un límite por minuto en cada método.
import { Throttle } from '@nestjs/throttler';

// Importamos el "servicio": la clase que tiene la lógica de verdad (consultar la
// base de datos, confirmar el cobro, crear la reseña, etc.). El controlador solo
// recibe la petición HTTP y se la pasa al servicio. Así se separa "recibir la
// llamada" (controller) de "hacer el trabajo" (service).
import { ConfirmPaymentService } from './confirm-payment.service';

/**
 * Endpoints públicos para la "Confirmación in-situ del cobro" del cliente.
 * El empleado, al cerrar la cita, genera un token y se lo entrega al cliente
 * vía QR/link. El cliente abre la página pública, ve el desglose, confirma
 * el cobro y deja su reseña. Todo sin autenticación; el token es la auth.
 */
// @Controller('public/confirm-payment') => todas las rutas de esta clase
// empiezan con "/api/public/confirm-payment". (El prefijo "/api" se agrega
// globalmente en otra parte.) Así, un método con @Get(':token') responde a
// GET /api/public/confirm-payment/<token>.
@Controller('public/confirm-payment')
export class ConfirmPaymentController {
  // CONSTRUCTOR + INYECCIÓN DE DEPENDENCIAS:
  // NestJS crea automáticamente una instancia del servicio y nos la "inyecta"
  // aquí. El "private readonly" hace que quede guardada como propiedad de la
  // clase (this.service) y que NO se pueda reasignar (readonly = solo lectura).
  constructor(private readonly service: ConfirmPaymentService) {}

  // ── GET /api/public/confirm-payment/:token ────────────────────────────────
  // Devuelve los datos de la cita asociada a ese token (para mostrarlos en la
  // página que abre el cliente: desglose del cobro, fotos, recompensas, etc.).
  // Es el primer endpoint que se llama al abrir el link/QR.
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
    // seguir". El resultado se guarda en "appointment".
    const appointment = await this.service.resolve(token);

    // Respondemos en el formato estándar del proyecto: { data: ... }.
    return { data: appointment };
  }

  // ── POST /api/public/confirm-payment/:token/confirm ───────────────────────
  // El cliente confirma que el cobro fue correcto. Marca confirmedAt en la cita.
  @Post(':token/confirm')
  // Límite más estricto (10/min) porque esto MODIFICA datos.
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async confirm(@Param('token') token: string) {
    // Delegamos todo al servicio y devolvemos directamente lo que él devuelva.
    return this.service.confirm(token);
  }

  // ── POST /api/public/confirm-payment/:token/review ────────────────────────
  // El cliente deja su reseña: califica al empleado (obligatorio) y, de forma
  // opcional, al negocio. Puede incluir comentarios.
  @Post(':token/review')
  // Límite aún más bajo (5/min): crear reseña es una acción sensible.
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async createReview(
    @Param('token') token: string,
    // @Body() lee el JSON enviado. Aquí esperamos un objeto con:
    //   - rating: nota del empleado (número, obligatorio).
    //   - comment?: comentario del empleado (el "?" => opcional).
    //   - businessRating?: nota del negocio (opcional).
    //   - businessComment?: comentario del negocio (opcional).
    @Body() dto: { rating: number; comment?: string; businessRating?: number; businessComment?: string },
  ) {
    // Pasamos el token y el objeto "dto" al servicio, que valida y crea la reseña.
    return this.service.createReview(token, dto);
  }
}
