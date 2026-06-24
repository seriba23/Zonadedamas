// Module: decorador que agrupa controladores y servicios en una "unidad"
// que NestJS sabe arrancar y conectar entre sí.
import { Module } from '@nestjs/common';
// Importamos todas las piezas del módulo para registrarlas abajo.
import { StaffNotificationsController } from './staff-notifications.controller';
import { StaffNotificationsService } from './staff-notifications.service';
import { NotifyStaffService } from './notify-staff.service';
import { WebPushService } from './web-push.service';
import { StaffEventsListener } from './staff-events.listener';

// @Module define cómo se compone este módulo:
@Module({
  // controllers: clases que exponen endpoints HTTP.
  controllers: [StaffNotificationsController],
  // providers: servicios/clases inyectables que viven dentro de este módulo.
  providers: [
    StaffNotificationsService, // lógica de listado/lectura/suscripción
    NotifyStaffService,        // crea notificaciones y dispara el push
    WebPushService,            // envía las notificaciones push reales
    StaffEventsListener,       // escucha eventos de dominio y notifica
  ],
  // exports: lo que este módulo COMPARTE con otros módulos que lo importen.
  // Solo exportamos NotifyStaffService porque es lo que otros módulos usan
  // para "notificar al staff" cuando ocurre algo.
  exports: [NotifyStaffService],
})
export class StaffNotificationsModule {}
