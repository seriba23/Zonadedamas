// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// De NestJS importamos los decoradores (etiquetas "@") para declarar endpoints:
//   - Controller: marca la clase como "controlador" (un grupo de endpoints).
//   - Get: marca un método como endpoint que responde a peticiones HTTP GET.
import { Controller, Get } from '@nestjs/common';

// @Controller('health') => todas las rutas de esta clase empiezan con
// "/api/health". Este endpoint es un "chequeo de salud": sirve para que
// herramientas de monitoreo confirmen que la API está viva y respondiendo.
@Controller('health')
export class HealthController {
  // @Get() sin ruta => responde a GET /api/health (la raíz del grupo).
  @Get()
  // check(): no recibe nada y devuelve un objeto simple con el estado del
  // servicio. No usa await porque no consulta base de datos ni servicios
  // externos: solo arma y devuelve datos al instante.
  check() {
    return {
      status: 'ok', // texto fijo que indica "todo bien"
      // timestamp: la fecha/hora actual en formato estándar ISO
      // (ej. "2026-06-24T15:30:00.000Z"). Útil para ver cuándo respondió.
      timestamp: new Date().toISOString(),
      version: '0.1.0', // versión de la API (texto fijo)
    };
  }
}
