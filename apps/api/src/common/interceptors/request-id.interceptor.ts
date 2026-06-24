// ─────────────────────────────────────────────────────────────────────────────
// INTERCEPTOR RequestIdInterceptor — "pega un identificador único a cada petición"
// ─────────────────────────────────────────────────────────────────────────────
//
// IDEA GENERAL: un "interceptor" en NestJS es un envoltorio que se ejecuta
// ANTES y/o DESPUÉS del método del controlador, sin que este se entere. Sirve
// para tareas transversales (logs, transformar respuestas, medir tiempos...).
// Este interceptor le asigna a CADA petición un identificador único (requestId).
// Así, si algo falla, podemos rastrear todos los logs y la respuesta de esa
// misma petición buscando ese id.

// De NestJS:
//   - CallHandler: representa "el siguiente paso" de la cadena (al final, el
//     método del controlador). Tiene .handle() para continuar el flujo.
//   - ExecutionContext: contexto de la petición (request, response...).
//   - Injectable: marca la clase como inyectable.
//   - NestInterceptor: el contrato que todo interceptor debe cumplir (método
//     intercept).
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
// Observable (de RxJS): un "flujo" de datos que llegará en el futuro. NestJS
// trabaja la respuesta como un Observable; aquí solo lo dejamos pasar.
import { Observable } from 'rxjs';
// uuid v4: función que genera identificadores únicos aleatorios (ej.
// "9b1c...-...-..."). La renombramos a "uuidv4" al importarla.
import { v4 as uuidv4 } from 'uuid';

// @Injectable(): permite registrar y usar este interceptor en la app.
@Injectable()
// "implements NestInterceptor": cumplimos el contrato de interceptor.
export class RequestIdInterceptor implements NestInterceptor {
  // intercept se ejecuta para cada petición. Recibe el contexto y "next" (lo que
  // sigue en la cadena). Devuelve un Observable (el flujo de la respuesta).
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // Sacamos los objetos crudos de petición y respuesta HTTP.
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // Calculamos el requestId:
    //   - request.headers['x-request-id']: si el cliente (o un proxy) ya mandó
    //     un id en esa cabecera, lo reutilizamos. "as string" le dice a
    //     TypeScript que lo trate como texto.
    //   - "|| uuidv4()": si NO venía ninguno, generamos uno nuevo con uuid.
    const requestId = (request.headers['x-request-id'] as string) || uuidv4();
    // Guardamos el id dentro de la petición para que otras piezas (el logger,
    // el filtro de errores) puedan leerlo más adelante.
    request.requestId = requestId;
    // También lo devolvemos al cliente en la cabecera de respuesta "X-Request-ID"
    // por si necesita reportarlo en caso de error.
    response.setHeader('X-Request-ID', requestId);

    // next.handle() continúa la cadena (ejecuta el controlador y demás). Como no
    // queremos hacer nada DESPUÉS, simplemente devolvemos ese flujo tal cual.
    return next.handle();
  }
}
