import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AppointmentReminderService } from './appointment-reminder.service';

/**
 * Endpoints publicos para el recordatorio pre-cita del cliente. El admin
 * dispara el recordatorio desde su dashboard (link wa.me) y el cliente
 * abre /c/:token donde puede confirmar, reagendar o cancelar la cita.
 *
 * Sin auth. El token es la auth (mismo confirmationToken del Appointment).
 */
@Controller('public/c')
export class AppointmentReminderController {
  constructor(private readonly service: AppointmentReminderService) {}

  @Get(':token')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async resolve(@Param('token') token: string) {
    const data = await this.service.resolve(token);
    return { data };
  }

  @Post(':token/confirm')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async confirm(@Param('token') token: string) {
    return this.service.confirm(token);
  }

  @Post(':token/cancel')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async cancel(
    @Param('token') token: string,
    @Body() body: { reason?: string },
  ) {
    return this.service.cancel(token, body?.reason);
  }

  @Get(':token/availability')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async availability(
    @Param('token') token: string,
    @Query('date') date: string,
  ) {
    return this.service.availability(token, date);
  }

  @Post(':token/reschedule')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async reschedule(
    @Param('token') token: string,
    @Body() body: { startTime: string },
  ) {
    return this.service.reschedule(token, body.startTime);
  }
}
