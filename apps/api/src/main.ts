// ─────────────────────────────────────────────────────────────────────────────
// PUNTO DE ARRANQUE DEL SERVIDOR (main.ts): este es el PRIMER archivo que se
// ejecuta cuando levantas la API. Su trabajo es "encender" NestJS: crear la app
// a partir del AppModule, configurarla (CORS, validaciones, prefijo /api...) y
// ponerla a escuchar peticiones en un puerto.
// ─────────────────────────────────────────────────────────────────────────────

// NestFactory: la "fábrica" que crea una instancia de la aplicación NestJS a
// partir del módulo raíz.
import { NestFactory } from '@nestjs/core';

// NestExpressApplication: el TIPO de app cuando NestJS usa Express por debajo.
// Lo usamos para acceder a métodos propios de Express, como useStaticAssets().
import { NestExpressApplication } from '@nestjs/platform-express';

// De @nestjs/common:
//   - ValidationPipe: "tubería" que valida automáticamente los datos que llegan
//     en las peticiones, usando las reglas de los DTOs (clases con decoradores).
//   - Logger: utilidad para imprimir mensajes en la consola del servidor.
import { ValidationPipe, Logger } from '@nestjs/common';

// compression: middleware que COMPRIME las respuestas (gzip) para que viajen más
// ligeras por la red y la web cargue más rápido. "* as" importa todo el módulo.
import * as compression from 'compression';

// express: el framework HTTP sobre el que corre NestJS. Se importa por si se
// necesitan utilidades suyas.
import * as express from 'express';

// path: utilidad de Node para construir rutas de archivos/carpetas de forma
// segura sin importar el sistema operativo (Windows usa "\", Linux usa "/").
import * as path from 'path';

// El módulo raíz que junta toda la aplicación (ver app.module.ts).
import { AppModule } from './app.module';

// bootstrap(): función "async" (asíncrona) que arranca todo. Es async porque
// crear la app y ponerla a escuchar son operaciones que tardan y usan "await".
async function bootstrap() {
  // logger: para escribir mensajes etiquetados como "Bootstrap" en consola.
  const logger = new Logger('Bootstrap');

  // NestFactory.create<...>(AppModule, opciones) construye la aplicación a partir
  // del módulo raíz. Al ser <NestExpressApplication>, sabemos que usa Express.
  //   - rawBody: true => conserva el cuerpo "crudo" (sin procesar) de la petición.
  //     Esto lo necesita Stripe para verificar la firma de sus webhooks.
  //   - "await" espera a que la app quede completamente creada.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });

  // app.use(...) agrega un "middleware" (código que procesa cada petición). Aquí
  // activamos la compresión de respuestas en toda la app.
  app.use(compression());

  // Servir archivos subidos a /api/uploads/<folder>/<file> (avatares, portfolio,
  // documentos, products, results). La ruta fisica vive en <repo>/uploads/.
  // path.resolve(...) construye la ruta ABSOLUTA de la carpeta de subidas:
  //   - process.cwd() = carpeta desde la que se ejecuta el proceso (apps/api).
  //   - '..', '..' = subimos dos niveles (de apps/api hasta la raíz del repo).
  //   - 'uploads' = entramos a la carpeta uploads. Resultado: <repo>/uploads.
  const uploadsDir = path.resolve(process.cwd(), '..', '..', 'uploads');
  // useStaticAssets() expone esa carpeta físicamente como archivos servibles por
  // HTTP. Es un método propio de NestExpressApplication.
  app.useStaticAssets(uploadsDir, {
    prefix: '/api/uploads', // URL pública: lo de uploads/ se sirve bajo /api/uploads
    maxAge: '1d', // cachea los archivos en el navegador durante 1 día
    fallthrough: true, // si el archivo no existe, sigue con las demás rutas (no corta)
  });
  // Dejamos constancia en el log de desde dónde se sirven los archivos.
  logger.log(`Static uploads servidos desde ${uploadsDir}`);

  // enableCors(...) configura CORS: la regla de qué ORÍGENES (dominios) del
  // navegador pueden llamar a esta API. Sin esto, el navegador bloquearía las
  // peticiones del frontend por seguridad.
  app.enableCors({
    // "origin": lista blanca de orígenes permitidos. Solo estas direcciones
    // podrán consumir la API desde un navegador.
    origin: [
      // process.env.FRONTEND_URL = variable de entorno con la URL del frontend.
      // "|| 'http://localhost:3010'" => si esa variable no existe, usa este valor
      // por defecto (el "||" devuelve el primer valor "verdadero").
      process.env.FRONTEND_URL || 'http://localhost:3010',
      'http://localhost:3000', // web en desarrollo (puerto típico de Next.js)
      'http://localhost:3010', // web en otro puerto de desarrollo
      'http://192.168.3.33:3000', // acceso por IP de red local (probar desde móvil)
      'http://192.168.3.33:3010', // ídem, otro puerto
      'capacitor://localhost', // app móvil empaquetada con Capacitor
      'http://localhost', // origen genérico de la app móvil/local
    ],
    // credentials: true => permite enviar cookies/credenciales en las peticiones
    // entre orígenes (necesario para mantener la sesión).
    credentials: true,
  });

  // useGlobalPipes(...) aplica una "tubería" de validación a TODAS las peticiones.
  // Con un ValidationPipe, los datos entrantes se validan contra los DTOs antes
  // de llegar a tu código.
  app.useGlobalPipes(
    new ValidationPipe({
      // whitelist: true => elimina del objeto recibido cualquier campo que NO
      // esté declarado en el DTO (limpia datos extraños).
      whitelist: true,
      // transform: true => convierte automáticamente los tipos (p.ej. un "5" de
      // la URL, que llega como texto, pasa a número 5) y crea instancias del DTO.
      transform: true,
      // forbidNonWhitelisted: true => si llega un campo NO permitido, en vez de
      // solo quitarlo, RECHAZA la petición con un error (más estricto).
      forbidNonWhitelisted: true,
    }),
  );

  // setGlobalPrefix('api') => antepone "/api" a TODAS las rutas. Por eso un
  // @Controller('clients') responde en /api/clients y no solo en /clients.
  app.setGlobalPrefix('api');

  // Warning crítico de TZ: las citas se guardan como wall-clock literal
  // (ver parse-wall-clock.ts). Para que `new Date()` con timestamps absolutos
  // y comparaciones funcionen igual en dev y prod, el server DEBERIA estar
  // en UTC. parseWallClock blinda el flujo de citas, pero un server con TZ
  // distinta puede shifteear otros campos (notificaciones, reportes).
  // serverTz: averiguamos en qué zona horaria está configurado el servidor.
  // Intl.DateTimeFormat().resolvedOptions().timeZone devuelve, p.ej., "UTC" o
  // "America/Mexico_City". Lo usamos solo para AVISAR si no es UTC.
  const serverTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  // Si la zona del proceso NO es UTC Y tampoco la variable de entorno TZ es UTC,
  // mostramos una ADVERTENCIA (warn), porque trabajar fuera de UTC puede
  // desplazar fechas en notificaciones/reportes.
  if (serverTz !== 'UTC' && process.env.TZ !== 'UTC') {
    logger.warn(
      // Usamos plantillas de texto (`...${...}...`) para insertar valores dentro
      // del mensaje. "process.env.TZ || '(unset)'" muestra "(unset)" si TZ no
      // está definida. El "+" une las dos líneas en un solo texto.
      `[TZ] Server NO esta en UTC (TZ del proceso: ${serverTz}, env TZ: ${process.env.TZ || '(unset)'}). ` +
      `Recomendado: export TZ=UTC en el entorno (ecosystem.config.js en prod, .env en dev).`,
    );
  } else {
    // Si está en UTC, simplemente confirmamos que todo está OK.
    logger.log(`[TZ] Server en UTC. OK.`);
  }

  // port: puerto donde escuchará la API. Toma el de la variable de entorno PORT
  // o, si no existe, usa 3001 por defecto.
  const port = process.env.PORT || 3001;
  // app.listen(port, host) ARRANCA el servidor y lo deja escuchando peticiones.
  //   - '0.0.0.0' significa "escucha en TODAS las interfaces de red" (no solo en
  //     localhost), permitiendo el acceso desde otros equipos de la red local.
  //   - "await" espera a que el servidor esté realmente levantado.
  await app.listen(port, '0.0.0.0');
  // Avisamos en consola que la API ya está corriendo y en qué URL.
  logger.log(`API running on http://localhost:${port}`);
}

// Llamada final: ejecutamos bootstrap() para que todo lo anterior ocurra y el
// servidor arranque. Sin esta línea, nada se pondría en marcha.
bootstrap();
