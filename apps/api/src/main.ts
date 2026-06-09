import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe, Logger } from '@nestjs/common';
import * as compression from 'compression';
import * as express from 'express';
import * as path from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });

  app.use(compression());

  // Servir archivos subidos a /api/uploads/<folder>/<file> (avatares, portfolio,
  // documentos, products, results). La ruta fisica vive en <repo>/uploads/.
  const uploadsDir = path.resolve(process.cwd(), '..', '..', 'uploads');
  app.useStaticAssets(uploadsDir, {
    prefix: '/api/uploads',
    maxAge: '1d',
    fallthrough: true,
  });
  logger.log(`Static uploads servidos desde ${uploadsDir}`);

  app.enableCors({
    origin: [
      process.env.FRONTEND_URL || 'http://localhost:3010',
      'http://localhost:3000',
      'http://localhost:3010',
      'http://192.168.3.33:3000',
      'http://192.168.3.33:3010',
      'capacitor://localhost',
      'http://localhost',
    ],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.setGlobalPrefix('api');

  // Warning crítico de TZ: las citas se guardan como wall-clock literal
  // (ver parse-wall-clock.ts). Para que `new Date()` con timestamps absolutos
  // y comparaciones funcionen igual en dev y prod, el server DEBERIA estar
  // en UTC. parseWallClock blinda el flujo de citas, pero un server con TZ
  // distinta puede shifteear otros campos (notificaciones, reportes).
  const serverTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (serverTz !== 'UTC' && process.env.TZ !== 'UTC') {
    logger.warn(
      `[TZ] Server NO esta en UTC (TZ del proceso: ${serverTz}, env TZ: ${process.env.TZ || '(unset)'}). ` +
      `Recomendado: export TZ=UTC en el entorno (ecosystem.config.js en prod, .env en dev).`,
    );
  } else {
    logger.log(`[TZ] Server en UTC. OK.`);
  }

  const port = process.env.PORT || 3001;
  await app.listen(port, '0.0.0.0');
  logger.log(`API running on http://localhost:${port}`);
}

bootstrap();
