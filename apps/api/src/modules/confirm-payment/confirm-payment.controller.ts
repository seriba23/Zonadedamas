import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ConfirmPaymentService } from './confirm-payment.service';

/**
 * Endpoints públicos para la "Confirmación in-situ del cobro" del cliente.
 * El empleado, al cerrar la cita, genera un token y se lo entrega al cliente
 * vía QR/link. El cliente abre la página pública, ve el desglose, confirma
 * el cobro y deja su reseña. Todo sin autenticación; el token es la auth.
 */
@Controller('public/confirm-payment')
export class ConfirmPaymentController {
  constructor(private readonly service: ConfirmPaymentService) {}

  @Get(':token')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async resolve(@Param('token') token: string) {
    const appointment = await this.service.resolve(token);
    return { data: appointment };
  }

  @Post(':token/confirm')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async confirm(@Param('token') token: string) {
    return this.service.confirm(token);
  }

  @Post(':token/review')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async createReview(
    @Param('token') token: string,
    @Body() dto: { rating: number; comment?: string; businessRating?: number; businessComment?: string },
  ) {
    return this.service.createReview(token, dto);
  }
}
