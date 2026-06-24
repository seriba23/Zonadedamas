// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// De NestJS importamos:
//   - Injectable: decorador que marca la clase como servicio inyectable.
//   - Logger: utilidad de NestJS para imprimir mensajes en la consola del
//     servidor (con formato bonito, fecha y nombre de origen). Mejor que usar
//     console.log porque queda integrado con el sistema de logs del framework.
import { Injectable, Logger } from '@nestjs/common';

// ─────────────────────────────────────────────────────────────────────────────
// TIPO DE DATO
// ─────────────────────────────────────────────────────────────────────────────

// "interface" define la FORMA que tendrá cada valor guardado en la caché.
// No genera código en tiempo de ejecución; solo le dice a TypeScript qué campos
// debe tener un objeto para considerarse un "CacheEntry" (entrada de caché).
interface CacheEntry {
  // value: el dato guardado, siempre como texto (string).
  value: string;
  // expiresAt: el momento (timestamp en milisegundos) en que la entrada caduca.
  // "number | null" = puede ser un número O null. Si es null, NO caduca nunca.
  expiresAt: number | null; // timestamp in ms, null = no expiry
}

// @Injectable() => permite que NestJS cree e inyecte este servicio donde se pida.
@Injectable()
// Esta clase IMITA a Redis (un sistema de caché muy usado), pero todo vive en la
// memoria del proceso (un simple Map), sin servidor externo. Práctico para el
// entorno de desarrollo con XAMPP, donde no se instala Redis.
export class RedisService {
  // logger: instancia para escribir mensajes en consola. "RedisService.name" es
  // el nombre de la clase ("RedisService"), que aparecerá como etiqueta del log.
  // "private readonly" => propiedad interna que no se reasigna.
  private readonly logger = new Logger(RedisService.name);

  // cache: la estructura que guarda todo. Un Map es como un diccionario:
  // asocia una clave (string) con un valor (aquí, un CacheEntry). Es el corazón
  // de este "Redis falso". "private readonly" => interno y no reasignable.
  private readonly cache = new Map<string, CacheEntry>();

  // cleanupInterval: aquí guardamos el "identificador" del temporizador que crea
  // setInterval (más abajo). Lo guardamos para poder DETENERLO al apagar la app.
  // "ReturnType<typeof setInterval>" = "el tipo que devuelve setInterval",
  // forma segura de tipar el id del temporizador sin saber su tipo exacto.
  private cleanupInterval: ReturnType<typeof setInterval>;

  // CONSTRUCTOR: se ejecuta una sola vez, al crear el servicio.
  constructor() {
    // Clean expired entries every 60 seconds
    // setInterval(función, ms) ejecuta la función UNA y otra vez cada X ms. Aquí,
    // cada 60000 ms (= 60 segundos) llamamos a this.cleanup() para borrar las
    // entradas ya caducadas. La forma "() => this.cleanup()" (arrow function)
    // conserva el "this" correcto (el del servicio) dentro de cleanup().
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
    // Dejamos un mensaje en consola avisando que la caché en memoria está lista.
    this.logger.log('In-memory cache initialized (Redis replacement for XAMPP dev)');
  }

  // ── get(): leer un valor de la caché por su clave ───────────────────────────
  // Recibe la clave (key) y devuelve el valor (string) o null si no existe/caducó.
  // Es "async" (devuelve una Promise) para imitar la API de Redis, aunque aquí
  // la lectura sea inmediata.
  async get(key: string): Promise<string | null> {
    // Buscamos la entrada en el Map.
    const entry = this.cache.get(key);
    // Si no existe esa clave, "entry" es undefined -> devolvemos null.
    if (!entry) return null;

    // Si la entrada TIENE fecha de caducidad (expiresAt no es null) Y ya pasó
    // ese instante (ahora es mayor), entonces caducó:
    //   - Date.now() = el momento actual en milisegundos.
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      // La borramos del Map para no dejar basura...
      this.cache.delete(key);
      // ...y devolvemos null, como si nunca hubiera existido.
      return null;
    }

    // Si llegó hasta aquí, la entrada es válida: devolvemos su valor.
    return entry.value;
  }

  // ── set(): guardar un valor en la caché ─────────────────────────────────────
  // Recibe la clave, el valor y un "ttl" OPCIONAL (el "?" lo marca como opcional).
  // ttl = "time to live" (tiempo de vida) EN SEGUNDOS: cuánto durará el dato.
  async set(key: string, value: string, ttl?: number): Promise<void> {
    // Guardamos en el Map una entrada con el valor y su fecha de caducidad.
    this.cache.set(key, {
      value,
      // OPERADOR TERNARIO: condición ? valorSiVerdadero : valorSiFalso.
      // Si nos pasaron un ttl, calculamos cuándo caduca: ahora + ttl segundos.
      // (ttl * 1000 convierte segundos a milisegundos, que es lo que usa Date).
      // Si NO hay ttl, ponemos null => la entrada nunca caduca.
      expiresAt: ttl ? Date.now() + ttl * 1000 : null,
    });
  }

  // ── del(): borrar UNA clave concreta ────────────────────────────────────────
  async del(key: string): Promise<void> {
    // .delete(key) elimina esa entrada del Map (si no existe, no pasa nada).
    this.cache.delete(key);
  }

  // ── delPattern(): borrar TODAS las claves que coincidan con un patrón ────────
  // Útil para invalidar grupos de claves, p.ej. "user:123:*" (todo lo del user).
  async delPattern(pattern: string): Promise<void> {
    // Convert glob pattern to regex (simple: replace * with .*)
    // Convertimos el patrón estilo "glob" (con "*") a una "expresión regular".
    //   - pattern.replace(/\*/g, '.*'): cambia cada "*" por ".*" (en regex, ".*"
    //     significa "cualquier cosa"). La "g" reemplaza TODAS las apariciones.
    //   - "^" y "$" anclan el patrón al inicio y fin, para que coincida la clave
    //     COMPLETA y no solo un trozo.
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    // Recorremos todas las claves guardadas en la caché.
    for (const key of this.cache.keys()) {
      // .test(key) devuelve true si la clave encaja con el patrón.
      if (regex.test(key)) {
        // Si encaja, la borramos.
        this.cache.delete(key);
      }
    }
  }

  // ── cleanup(): limpieza periódica de entradas caducadas ─────────────────────
  // "private" = solo se usa dentro de esta clase (lo llama el setInterval). Borra
  // todas las entradas cuyo tiempo ya venció, para que el Map no crezca sin fin.
  private cleanup(): void {
    // Tomamos el instante actual una sola vez (más eficiente que recalcularlo).
    const now = Date.now();
    // Recorremos el Map. "for...of" sobre un Map entrega pares [clave, valor];
    // con desestructuración los nombramos [key, entry] en cada vuelta.
    for (const [key, entry] of this.cache) {
      // Si la entrada tiene caducidad y ya pasó, la eliminamos.
      if (entry.expiresAt && now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  // ── onModuleDestroy(): se llama al apagar la app ────────────────────────────
  // NestJS invoca este método al cerrar. Detenemos el temporizador con
  // clearInterval(id) para que no quede corriendo "en el vacío" y la app pueda
  // cerrarse limpiamente (evita fugas de memoria).
  onModuleDestroy() {
    clearInterval(this.cleanupInterval);
  }
}
