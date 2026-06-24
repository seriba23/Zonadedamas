// ─────────────────────────────────────────────────────────────────────────────
// INTERCEPTOR LoggingInterceptor — "anota en consola cada petición y su tiempo"
// ─────────────────────────────────────────────────────────────────────────────
//
// IDEA GENERAL: este interceptor escribe en el log (la consola del servidor) una
// línea CUANDO LLEGA la petición y otra CUANDO TERMINA, incluyendo el método
// HTTP, la URL, el código de estado, cuánto tardó y el requestId. Es muy útil
// para ver en vivo qué está pasando y detectar rutas lentas. Aprovecha el id que
// puso el RequestIdInterceptor para enlazar la entrada con la salida.

// De NestJS, además de las piezas habituales de interceptor (CallHandler,
// ExecutionContext, Injectable, NestInterceptor), importamos:
//   - Logger: la utilidad estándar para imprimir mensajes con formato bonito y
//     una "etiqueta de contexto" (aquí 'HTTP').
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
// Observable (RxJS): el flujo de la respuesta futura.
import { Observable } from 'rxjs';
// tap (operador de RxJS): nos deja "espiar" el flujo y ejecutar código cuando
// emite un valor, SIN modificar lo que viaja por él. Perfecto para loggear al
// terminar sin tocar la respuesta.
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  // Creamos un Logger con la etiqueta 'HTTP'. Esa etiqueta aparece entre
  // corchetes en cada línea del log para identificar de dónde viene el mensaje.
  // "private readonly" = propiedad interna de solo lectura.
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // Petición y respuesta crudas.
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    // DESESTRUCTURACIÓN: de "request" sacamos a la vez sus propiedades "method"
    // (GET, POST...) y "url" (la ruta pedida), y las guardamos en variables del
    // mismo nombre.
    const { method, url } = request;
    // Tomamos el requestId que dejó el RequestIdInterceptor. Si no existiera,
    // "|| 'N/A'" usa el texto 'N/A' (Not Available) para no dejarlo vacío.
    const requestId = request.requestId || 'N/A';
    // Date.now() = milisegundos del instante actual. Lo guardamos para calcular
    // luego cuánto tardó la petición (fin - inicio).
    const start = Date.now();

    // Log de ENTRADA: "--> MÉTODO URL [id]". La flecha "-->" indica "entrando".
    this.logger.log(`--> ${method} ${url} [${requestId}]`);

    // Continuamos la cadena con next.handle() y, sobre ese flujo, encadenamos
    // ".pipe(...)" para aplicarle operadores. Aquí usamos tap para reaccionar
    // CUANDO la respuesta ya está lista.
    return next.handle().pipe(
      tap(() => {
        // En este punto el controlador ya respondió, así que el código de estado
        // (200, 404, 500...) ya está disponible en la respuesta.
        const statusCode = response.statusCode;
        // Tiempo transcurrido = ahora - inicio (en milisegundos).
        const responseTime = Date.now() - start;
        // Log de SALIDA: "<-- MÉTODO URL ESTADO TIEMPOms [id]". La flecha "<--"
        // indica "saliendo/respondiendo".
        this.logger.log(
          `<-- ${method} ${url} ${statusCode} ${responseTime}ms [${requestId}]`,
        );
      }),
    );
  }
}
