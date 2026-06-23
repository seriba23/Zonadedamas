// En NestJS, un "módulo" es una caja que agrupa piezas relacionadas (sus
// endpoints y su lógica) y declara qué necesita de afuera. La app principal se
// arma juntando muchos módulos como este.

// Module: el decorador que convierte una clase normal en un módulo de NestJS.
import { Module } from '@nestjs/common';
// PrismaModule: módulo que provee el acceso a la base de datos (PrismaService).
// Lo importamos para que nuestro servicio pueda usar this.prisma.
import { PrismaModule } from '../../prisma/prisma.module';
// El controlador (los endpoints) y el servicio (la lógica) de este módulo.
import { AppointmentReminderController } from './appointment-reminder.controller';
import { AppointmentReminderService } from './appointment-reminder.service';

@Module({
  // imports: otros módulos cuyas piezas necesitamos. Aquí, PrismaModule para
  // poder hablar con la base de datos.
  imports: [PrismaModule],
  // controllers: las clases que reciben las peticiones HTTP de este módulo.
  controllers: [AppointmentReminderController],
  // providers: las clases con lógica (servicios) que NestJS podrá inyectar.
  providers: [AppointmentReminderService],
})
// La clase queda vacía a propósito: toda la "configuración" vive en el
// decorador @Module de arriba. Su único fin es agrupar y exportar el módulo.
export class AppointmentReminderModule {}
