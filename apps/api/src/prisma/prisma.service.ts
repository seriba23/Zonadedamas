// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// De NestJS importamos tres "piezas":
//   - Injectable: decorador (etiqueta "@") que marca esta clase como un
//     "servicio" que NestJS puede crear e inyectar en otras clases.
//   - OnModuleInit: es una "interfaz" (un contrato). Si una clase la "implementa",
//     NestJS sabe que debe llamar a su método onModuleInit() AL ARRANCAR el
//     módulo. Sirve para hacer preparativos al inicio (aquí: conectar a la BD).
//   - OnModuleDestroy: otra interfaz parecida, pero su método onModuleDestroy()
//     se llama AL APAGAR la app (aquí: cerrar la conexión a la BD limpiamente).
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';

// PrismaClient es la clase que genera Prisma (el ORM) a partir de tu schema.
// Trae todos los métodos para hablar con la base de datos: this.appointment,
// this.client, this.employee, etc., además de $connect() y $disconnect().
import { PrismaClient } from '@prisma/client';

// @Injectable() => marca la clase como un servicio inyectable de NestJS. Gracias
// a esto, cualquier otra clase puede recibir un PrismaService en su constructor.
@Injectable()
// "extends PrismaClient" => esta clase HEREDA todo lo de PrismaClient. Por eso
// con un solo PrismaService ya tenemos acceso a todas las tablas y consultas.
// "implements OnModuleInit, OnModuleDestroy" => prometemos que esta clase tendrá
// los métodos onModuleInit() y onModuleDestroy() para engancharnos al ciclo de
// vida de NestJS (arranque y apagado).
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  // CICLO DE VIDA - ARRANQUE:
  // NestJS llama a este método automáticamente cuando el módulo se inicializa.
  // "await this.$connect()" abre la conexión con la base de datos y espera a que
  // quede lista antes de seguir. Si no conectáramos aquí, Prisma conectaría
  // "perezosamente" en la primera consulta; hacerlo al inicio detecta errores
  // de conexión cuanto antes.
  async onModuleInit() {
    await this.$connect();
  }

  // CICLO DE VIDA - APAGADO:
  // NestJS llama a este método cuando la app se está cerrando. "$disconnect()"
  // cierra la conexión con la base de datos de forma ordenada (libera recursos),
  // evitando conexiones colgadas. "await" espera a que termine de cerrarse.
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
