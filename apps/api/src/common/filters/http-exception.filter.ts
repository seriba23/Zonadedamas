// ─────────────────────────────────────────────────────────────────────────────
// FILTRO HttpExceptionFilter — "captura TODOS los errores y los formatea igual"
// ─────────────────────────────────────────────────────────────────────────────
//
// IDEA GENERAL: un "exception filter" en NestJS atrapa los errores que ocurren
// en cualquier parte de la app (los que tú lanzas con throw y también los
// inesperados) y produce una respuesta de error con UN FORMATO ÚNIFICADO. Así,
// pase lo que pase, el cliente siempre recibe un JSON con la misma estructura:
//   { statusCode, error, message, details, requestId }
// Esto cumple la convención del proyecto y evita filtrar detalles internos.

// De NestJS:
//   - ArgumentsHost: objeto que da acceso al contexto del error (request,
//     response...), parecido a ExecutionContext.
//   - Catch: decorador que marca esta clase como filtro de excepciones. Sin
//     argumentos, atrapa TODO tipo de error.
//   - ExceptionFilter: el contrato que obliga a tener el método catch.
//   - HttpException: la clase base de los errores HTTP de NestJS
//     (NotFoundException, BadRequestException, etc. heredan de ella).
//   - HttpStatus: un catálogo de códigos HTTP con nombre legible
//     (HttpStatus.NOT_FOUND = 404, etc.).
//   - Logger: para registrar en consola los errores inesperados.
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
// Tipos de Express para tipar correctamente la petición y la respuesta HTTP.
import { Request, Response } from 'express';
// Prisma trae sus PROPIOS tipos de error (errores de base de datos). Los
// importamos para detectarlos y traducirlos a respuestas amables.
import { Prisma } from '@prisma/client';

// @Catch() sin argumentos: este filtro captura CUALQUIER excepción.
@Catch()
// "implements ExceptionFilter": cumplimos el contrato (tener catch).
export class HttpExceptionFilter implements ExceptionFilter {
  // Logger con etiqueta 'ExceptionFilter' para los mensajes de error en consola.
  private readonly logger = new Logger('ExceptionFilter');

  // catch se ejecuta cuando ocurre un error.
  //   - exception: el error capturado. Su tipo es "unknown" porque puede ser
  //     CUALQUIER cosa (un HttpException, un error de Prisma, un Error normal...).
  //   - host: contexto del error para llegar a request/response.
  catch(exception: unknown, host: ArgumentsHost) {
    // Interpretamos el contexto como HTTP y obtenemos respuesta y petición.
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    // El tipo "Request & { requestId?: string }" significa "una Request normal
    // PERO que además puede tener un campo requestId" (el que añadió el
    // RequestIdInterceptor). El "&" combina ambos tipos.
    const request = ctx.getRequest<Request & { requestId?: string }>();

    // Valores POR DEFECTO: si no logramos identificar el error, asumimos un
    // error interno 500 genérico. Iremos sobrescribiendo estos según el caso.
    // "let" permite reasignar después (a diferencia de "const").
    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR; // 500
    let error = 'Internal Server Error';
    let message = 'An unexpected error occurred';
    let details: any[] = []; // lista de detalles (ej. errores de validación)

    // CASO 1: es un error HTTP propio de NestJS (el más común).
    // "instanceof" comprueba si el error es de ese tipo (o hereda de él).
    if (exception instanceof HttpException) {
      // Su código de estado ya viene definido (404, 400, 403...).
      statusCode = exception.getStatus();
      // getResponse() devuelve el "cuerpo" del error: puede ser un texto simple
      // o un objeto con más información.
      const exceptionResponse = exception.getResponse();

      // Si el cuerpo es un OBJETO (y no null), extraemos campos con cuidado.
      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        // Lo tratamos como un diccionario texto→cualquier-cosa para leer claves.
        const resp = exceptionResponse as Record<string, any>;
        // error = el campo 'error' si existe; si no, el nombre de la excepción.
        error = resp['error'] || exception.name;
        // message: si 'message' es un ARREGLO (típico de validaciones, que
        // devuelven varios mensajes), los unimos con ", "; si es un texto, lo
        // usamos tal cual; y si faltara, recurrimos a exception.message.
        message = Array.isArray(resp['message'])
          ? resp['message'].join(', ')
          : resp['message'] || exception.message;
        // details: si había un arreglo de mensajes, lo guardamos completo para
        // que el cliente vea cada error por separado; si no, lista vacía.
        details = Array.isArray(resp['message']) ? resp['message'] : [];
      } else {
        // Si el cuerpo era un texto simple, lo usamos como mensaje.
        message = String(exceptionResponse);
        error = exception.name;
      }
    // CASO 2: es un error CONOCIDO de Prisma (problema en la base de datos).
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      // Prisma identifica cada error con un "code". Traducimos los más comunes:
      if (exception.code === 'P2002') {
        // P2002 = violación de restricción única (valor duplicado).
        statusCode = HttpStatus.CONFLICT; // 409
        error = 'Conflict';
        message = 'A record with that value already exists';
      } else if (exception.code === 'P2025') {
        // P2025 = el registro que se intentaba leer/actualizar no existe.
        statusCode = HttpStatus.NOT_FOUND; // 404
        error = 'Not Found';
        message = 'Record not found';
      } else {
        // Cualquier otro error de Prisma lo tratamos como petición inválida.
        statusCode = HttpStatus.BAD_REQUEST; // 400
        error = 'Database Error';
        message = exception.message;
      }
    // CASO 3: es un Error de JavaScript "normal" (no previsto). Esto es lo más
    // peligroso (un bug), así que ADEMÁS lo registramos en el log con su pila
    // de llamadas (stack) para poder depurarlo.
    } else if (exception instanceof Error) {
      message = exception.message;
      this.logger.error(
        `Unhandled exception: ${exception.message}`,
        exception.stack, // "stack" = el rastro de dónde se originó el error
      );
    }

    // Finalmente enviamos la respuesta con el código y el JSON unificado.
    // "request.requestId || null" añade el id de la petición si existe, o null.
    response.status(statusCode).json({
      statusCode,
      error,
      message,
      details,
      requestId: request.requestId || null,
    });
  }
}
