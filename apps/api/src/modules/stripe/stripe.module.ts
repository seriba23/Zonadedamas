// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// "Module" es un decorador (etiqueta "@") de NestJS que sirve para AGRUPAR
// piezas relacionadas (controladores, servicios, etc.) en una unidad. NestJS
// construye la app juntando muchos "módulos"; este es el módulo de Stripe.
import { Module } from '@nestjs/common';
// El SERVICIO: la clase con TODA la lógica de cobros (Stripe, suscripciones,
// webhooks, Connect, cupones). Es donde de verdad ocurre el trabajo.
import { StripeService } from './stripe.service';
// El CONTROLADOR: la clase que define las rutas HTTP (endpoints) y delega el
// trabajo al servicio. Solo recibe la petición y responde.
import { StripeController } from './stripe.controller';

// @Module({...}) describe a NestJS cómo está armado este módulo:
@Module({
  // controllers: lista de controladores que exponen rutas HTTP en este módulo.
  controllers: [StripeController],
  // providers: lista de clases "inyectables" (servicios) que NestJS creará una
  // sola vez (singleton) y podrá inyectar donde se necesiten.
  providers: [StripeService],
  // exports: hace que StripeService quede DISPONIBLE para otros módulos que
  // importen StripeModule. Sin esto, el servicio sería privado de este módulo.
  exports: [StripeService],
})
// La clase del módulo va vacía: toda la configuración vive en el decorador
// @Module de arriba. NestJS solo necesita la clase como "contenedor".
export class StripeModule {}
