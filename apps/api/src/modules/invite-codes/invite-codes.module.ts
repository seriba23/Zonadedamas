// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS: traemos las "piezas" que necesita este módulo.
// ─────────────────────────────────────────────────────────────────────────────

// De NestJS importamos el decorador "Module". Un decorador es una etiqueta que
// empieza con "@" y se coloca arriba de una clase para darle un comportamiento.
// "@Module" agrupa controladores y servicios relacionados en una unidad que
// NestJS sabe cómo construir y conectar entre sí.
import { Module } from '@nestjs/common';

// Importamos el "controlador": la clase que recibe las peticiones HTTP
// (los endpoints) de los códigos de invitación.
import { InviteCodesController } from './invite-codes.controller';

// Importamos el "servicio": la clase con la lógica de verdad (crear códigos,
// listarlos, desactivarlos y hablar con la base de datos).
import { InviteCodesService } from './invite-codes.service';

/**
 * Módulo de "Códigos de invitación".
 *
 * Sirve para que un negocio (tenant) genere códigos con los que sus empleados
 * pueden unirse al negocio. Reúne en un solo lugar su controlador (los
 * endpoints) y su servicio (la lógica), para que NestJS los registre juntos.
 */
@Module({
  // controllers = lista de controladores que pertenecen a este módulo.
  // Aquí solo hay uno: el de los códigos de invitación.
  controllers: [InviteCodesController],
  // providers = lista de servicios "inyectables" que este módulo ofrece.
  // El servicio queda disponible para inyectarse en el controlador de arriba.
  providers: [InviteCodesService],
})
// La clase queda vacía a propósito: toda la "configuración" del módulo va en el
// decorador @Module de arriba. NestJS solo necesita esta clase como contenedor.
export class InviteCodesModule {}
