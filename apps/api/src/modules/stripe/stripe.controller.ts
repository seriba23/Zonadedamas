// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS: traemos "piezas" de NestJS y de otras librerías para usarlas aquí.
// ─────────────────────────────────────────────────────────────────────────────

// De NestJS (framework del backend) importamos "decoradores" (etiquetas "@")
// y utilidades para declarar endpoints HTTP:
//   - Controller: marca una clase como controlador (un grupo de endpoints).
//   - Post / Get: marcan un método como endpoint que responde a POST o GET.
//   - Param: lee un trozo variable de la URL (ej. el :sessionId).
//   - Body: lee el cuerpo (JSON) que el cliente envía en la petición.
//   - Req: da acceso al objeto "request" crudo de Express (la petición HTTP).
//   - Res: da acceso al objeto "response" crudo de Express (para responder a mano).
//   - UseGuards: aplica "guardias" (chequeos previos) antes de entrar al método,
//     por ejemplo verificar que el usuario esté autenticado.
//   - Headers: lee una cabecera HTTP concreta (ej. la firma de Stripe).
//   - HttpCode: fija el código de estado HTTP de la respuesta (ej. 200).
import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Req,
  Res,
  UseGuards,
  Headers,
  HttpCode,
} from '@nestjs/common';
// "Response" es el TIPO del objeto respuesta de Express. Lo usamos para tipar
// el parámetro @Res() y poder llamar métodos como res.status() o res.json().
import { Response } from 'express';
// El servicio con toda la lógica de Stripe. El controlador solo le pasa las
// peticiones y devuelve lo que el servicio responde.
import { StripeService } from './stripe.service';
// "Guardia" de autenticación por JWT: comprueba que la petición traiga un token
// de acceso válido (Bearer). Si no, NestJS responde 401 (no autorizado) y el
// método ni siquiera se ejecuta. Así protegemos endpoints privados del negocio.
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

// @Controller('stripe') => todas las rutas de esta clase empiezan con "/api/stripe".
// (El prefijo global "/api" se agrega en otra parte de la app.)
@Controller('stripe')
export class StripeController {
  // CONSTRUCTOR + INYECCIÓN DE DEPENDENCIAS:
  // NestJS crea una instancia del servicio y nos la "inyecta" aquí. El
  // "private readonly" la guarda como propiedad (this.stripeService) de solo
  // lectura, disponible en todos los métodos de abajo.
  constructor(private readonly stripeService: StripeService) {}

  // ─── CONNECT ONBOARDING ─────────────────────────────
  // "Stripe Connect" permite que NUESTRA plataforma cobre en nombre de cada
  // negocio y le envíe el dinero (payout) a SU propia cuenta bancaria. El
  // "onboarding" es el proceso en el que el negocio conecta su cuenta y aporta
  // sus datos a Stripe (verificación de identidad, banco, etc.).

  // ── POST /api/stripe/connect/onboard ──────────────────────────────────────
  // Devuelve una URL hacia Stripe donde el negocio completa su onboarding.
  // Protegido por JWT: solo un usuario logueado del negocio puede iniciarlo.
  @UseGuards(JwtAuthGuard)
  @Post('connect/onboard')
  async connectOnboard(@Req() req: any) {
    // El guardia JWT ya validó el token y dejó los datos del usuario en
    // req.user. De ahí sacamos a qué negocio (tenant) pertenece.
    const tenantId = req.user.tenantId;
    // URL base del frontend. "process.env.FRONTEND_URL" lee una variable de
    // entorno (configuración externa). El "|| 'http://localhost:3000'" es un
    // VALOR POR DEFECTO: si la variable no está definida, usa localhost.
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    // A dónde regresa el negocio cuando termina (o reintenta) el onboarding.
    const returnUrl = `${frontendUrl}/settings/payments?stripe=callback`;

    // Le pedimos al servicio que cree (o reúse) la cuenta Connect y genere el
    // link. "await" = espera a que la operación termine antes de seguir.
    const result = await this.stripeService.createConnectAccountLink(tenantId, returnUrl);
    // Respondemos en el formato estándar del proyecto: { data: ... }.
    return { data: result };
  }

  // ── GET /api/stripe/connect/status ────────────────────────────────────────
  // Dice si el negocio ya completó su onboarding y puede cobrar online.
  @UseGuards(JwtAuthGuard)
  @Get('connect/status')
  async connectStatus(@Req() req: any) {
    const result = await this.stripeService.getConnectStatus(req.user.tenantId);
    return { data: result };
  }

  // ─── PLATFORM SUBSCRIPTION ──────────────────────────
  // Aquí viven los endpoints de la SUSCRIPCIÓN DE PLATAFORMA: lo que el negocio
  // paga a Siliba por usar el sistema. Modelo PLANO según el tipo de cuenta:
  //   FREELANCER → plan PRO ($300/mes)   ·   BUSINESS → plan PLUS ($500/mes).

  // ── POST /api/stripe/subscription/create ──────────────────────────────────
  // Crea (o reactiva) la suscripción del negocio a la plataforma.
  // El @Body puede traer un "creatorCode" OPCIONAL (código de influencer que da
  // descuento los primeros meses).
  @UseGuards(JwtAuthGuard)
  @Post('subscription/create')
  async createSubscription(@Req() req: any, @Body() body: { creatorCode?: string }) {
    const tenantId = req.user.tenantId;
    // "preview" calcula el monto y el conteo de empleados activos del negocio.
    const preview = await this.stripeService.getSubscriptionPreview(tenantId);
    const result = await this.stripeService.createPlatformSubscription(
      tenantId,
      preview.activeEmployeeCount,
      // "body?.creatorCode?.trim() || undefined":
      //   - "?." (optional chaining) evita errores si body o creatorCode faltan.
      //   - ".trim()" quita espacios al inicio/fin del texto.
      //   - "|| undefined": si el resultado es "" (vacío) o nulo, manda undefined
      //     (es decir, "sin código") en lugar de una cadena vacía.
      body?.creatorCode?.trim() || undefined,
    );
    return { data: result };
  }

  // ── POST /api/stripe/subscription/validate-creator-code ───────────────────
  // Comprueba si un código de creador es válido para este negocio ANTES de
  // crear la suscripción (para mostrar el descuento en pantalla).
  @UseGuards(JwtAuthGuard)
  @Post('subscription/validate-creator-code')
  async validateCreatorCode(@Req() req: any, @Body() body: { code: string }) {
    const result = await this.stripeService.validateCreatorCodeForTenant(
      req.user.tenantId,
      // "body?.code || ''": si no viene código, pasa cadena vacía (el servicio
      // ya sabe responder "ingresa un código" ante un valor vacío).
      body?.code || '',
    );
    return { data: result };
  }

  // ── GET /api/stripe/subscription/preview ──────────────────────────────────
  // Devuelve el resumen de cobro (monto mensual, empleados activos) sin cobrar.
  @UseGuards(JwtAuthGuard)
  @Get('subscription/preview')
  async subscriptionPreview(@Req() req: any) {
    const result = await this.stripeService.getSubscriptionPreview(req.user.tenantId);
    return { data: result };
  }

  // ── POST /api/stripe/subscription/cancel ──────────────────────────────────
  // Cancela la suscripción (al final del periodo ya pagado).
  @UseGuards(JwtAuthGuard)
  @Post('subscription/cancel')
  async cancelSubscription(@Req() req: any) {
    const result = await this.stripeService.cancelPlatformSubscription(req.user.tenantId);
    // "result?.accessUntil || null": si el servicio devolvió una fecha hasta la
    // que sigue teniendo acceso, la usamos; si no, devolvemos null.
    return { data: { cancelled: true, accessUntil: result?.accessUntil || null } };
  }

  // ── POST /api/stripe/subscription/reactivate ──────────────────────────────
  // Reactiva una suscripción cancelada o incompleta.
  @UseGuards(JwtAuthGuard)
  @Post('subscription/reactivate')
  async reactivateSubscription(@Req() req: any) {
    const result = await this.stripeService.reactivatePlatformSubscription(req.user.tenantId);
    return { data: result };
  }

  // ── POST /api/stripe/subscription/setup-intent ────────────────────────────
  // Crea un "SetupIntent" de Stripe: prepara el guardado SEGURO de una tarjeta
  // (sin cobrar todavía) para usarla en cobros futuros. Devuelve un clientSecret
  // que el frontend usa con Stripe Elements para capturar la tarjeta.
  @UseGuards(JwtAuthGuard)
  @Post('subscription/setup-intent')
  async setupIntent(@Req() req: any) {
    const result = await this.stripeService.createSetupIntent(req.user.tenantId);
    return { data: result };
  }

  // ── POST /api/stripe/subscription/attach-payment-method ───────────────────
  // Asocia la tarjeta capturada como método de pago POR DEFECTO del negocio.
  @UseGuards(JwtAuthGuard)
  @Post('subscription/attach-payment-method')
  async attachPaymentMethod(@Req() req: any, @Body() body: { paymentMethodId: string }) {
    await this.stripeService.attachDefaultPaymentMethod(req.user.tenantId, body.paymentMethodId);
    return { data: { success: true } };
  }

  // ── POST /api/stripe/subscription/advance-payment ─────────────────────────
  // Inicia el cobro de un mes POR ADELANTADO (paga ya el próximo periodo).
  @UseGuards(JwtAuthGuard)
  @Post('subscription/advance-payment')
  async advancePayment(@Req() req: any) {
    const result = await this.stripeService.advancePayment(req.user.tenantId);
    return { data: result };
  }

  // ── POST /api/stripe/subscription/advance-payment/confirm ─────────────────
  // El frontend llama aquí cuando el pago adelantado se confirmó, para que el
  // backend mueva la fecha de próximo cobro un mes hacia adelante.
  @UseGuards(JwtAuthGuard)
  @Post('subscription/advance-payment/confirm')
  async confirmAdvancePayment(@Req() req: any) {
    await this.stripeService.confirmAdvancePayment(req.user.tenantId);
    return { data: { success: true } };
  }

  // ── POST /api/stripe/subscription/switch-annual ───────────────────────────
  // Cambia del plan MENSUAL al plan ANUAL (12 meses con descuento).
  @UseGuards(JwtAuthGuard)
  @Post('subscription/switch-annual')
  async switchToAnnual(@Req() req: any) {
    const preview = await this.stripeService.getSubscriptionPreview(req.user.tenantId);
    const result = await this.stripeService.switchToAnnual(req.user.tenantId, preview.activeEmployeeCount);
    return { data: result };
  }

  // ── POST /api/stripe/subscription/upgrade-to-plus ─────────────────────────
  // Sube de cuenta FREELANCER (plan Pro $300) a BUSINESS (plan Plus $500).
  @UseGuards(JwtAuthGuard)
  @Post('subscription/upgrade-to-plus')
  async upgradeToPlus(@Req() req: any) {
    const result = await this.stripeService.upgradeToPlus(req.user.tenantId);
    return { data: result };
  }

  // ── POST /api/stripe/subscription/add-licenses ────────────────────────────
  // Agrega licencias (cupos) extra al plan ANUAL. El @Body trae "count".
  @UseGuards(JwtAuthGuard)
  @Post('subscription/add-licenses')
  async addLicenses(@Req() req: any, @Body() body: { count: number }) {
    // "body.count ?? 1": el "??" (nullish coalescing) usa 1 SOLO si count es
    // null o undefined. A diferencia de "||", aquí un 0 SÍ se respetaría.
    const result = await this.stripeService.addLicensesToAnnualPlan(req.user.tenantId, body.count ?? 1);
    return { data: result };
  }

  // ── POST /api/stripe/subscription/add-licenses/confirm ────────────────────
  // Confirma el alta de licencias tras el pago: cuántas se cobraron (toCharge)
  // y cuántas salieron de la "bolsa" de licencias gratis disponibles (freeFromPool).
  @UseGuards(JwtAuthGuard)
  @Post('subscription/add-licenses/confirm')
  async confirmLicenses(@Req() req: any, @Body() body: { toCharge: number; freeFromPool: number }) {
    await this.stripeService.confirmLicenseAddition(req.user.tenantId, body.toCharge, body.freeFromPool);
    return { data: { success: true } };
  }

  // ─── VERIFY SESSION ──────────────────────────────────
  // ── GET /api/stripe/verify-session/:sessionId ─────────────────────────────
  // Plan B por si el webhook de Stripe no llega: el frontend pregunta el estado
  // de una sesión de checkout y, si está pagada, el servicio la marca COMPLETED.
  // NO lleva guardia JWT: se identifica por el sessionId (que es difícil de adivinar).
  @Get('verify-session/:sessionId')
  async verifySession(@Param('sessionId') sessionId: string) {
    // @Param('sessionId') toma el valor de la posición :sessionId de la URL.
    const payment = await this.stripeService.verifyAndCompleteSession(sessionId);
    // "payment?.status || 'NOT_FOUND'": si encontró el pago devolvemos su
    // estado; si "payment" es null (no existe), devolvemos 'NOT_FOUND'.
    return { data: { status: payment?.status || 'NOT_FOUND' } };
  }

  // ─── WEBHOOK ────────────────────────────────────────
  // Un "webhook" es una llamada que STRIPE nos hace a NOSOTROS para avisarnos de
  // eventos (pago completado, suscripción actualizada, factura pagada, etc.).
  // Como cualquiera podría intentar falsificar estas llamadas, Stripe firma cada
  // petición; nosotros verificamos esa firma antes de confiar en el contenido.

  // ── POST /api/stripe/webhook ──────────────────────────────────────────────
  @Post('webhook')
  // @HttpCode(200) fuerza responder 200 (OK). Stripe espera un 2xx para dar el
  // evento por entregado; si no, lo reintenta más tarde.
  @HttpCode(200)
  async webhook(
    // @Req() nos da la petición cruda. Necesitamos su "rawBody" (cuerpo SIN
    // procesar/parsear) porque la verificación de firma se hace sobre los bytes
    // EXACTOS que Stripe envió; si se reformatean, la firma ya no cuadra.
    @Req() req: any,
    // @Headers('stripe-signature') lee la cabecera con la firma que manda Stripe.
    @Headers('stripe-signature') signature: string,
    // @Res() toma el objeto respuesta de Express para responder manualmente.
    @Res() res: Response,
  ) {
    // "event" guardará el evento ya verificado y parseado por Stripe.
    let event;
    // try/catch: intentamos verificar la firma; si falla, caemos al catch.
    try {
      // constructWebhookEvent valida la firma usando el "webhook secret" y, si
      // todo cuadra, devuelve el evento de forma segura. Si la firma es falsa,
      // lanza un error (y no procesamos nada).
      event = this.stripeService.constructWebhookEvent(req.rawBody, signature);
    } catch (err: any) {
      // Firma inválida: lo registramos y respondemos 400 (petición inválida).
      // Devolver 400 le dice a Stripe que NO reintente (la firma nunca cuadrará).
      console.error('Stripe webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // A partir de aquí la FIRMA ya está verificada: el evento es legítimo. Todo
    // el procesamiento va dentro de un try/catch porque, si un handler falla, NO
    // queremos responder 500: reintentar el MISMO evento no lo va a arreglar (un
    // bug de datos o un registro que no existe fallará igual cada vez), y una
    // racha de 500 hace que Stripe acabe DESHABILITANDO el endpoint —rompiendo
    // TODOS los webhooks—. En su lugar registramos el error para investigarlo y
    // respondemos 2xx (Stripe da el evento por entregado y no reintenta en bucle).
    try {
      // "switch" elige qué hacer según el TIPO de evento recibido. Cada "case"
      // delega en el handler correspondiente del servicio. "event.data.object"
      // es el objeto principal del evento (sesión, cuenta, suscripción, factura).
      // "as any" relaja el tipado para pasarlo tal cual al servicio.
      switch (event.type) {
        // Pago de una cita completado con éxito → marcar Payment como COMPLETED.
        case 'checkout.session.completed':
          await this.stripeService.handleCheckoutCompleted(event.data.object as any);
          break; // "break" corta el switch para no caer en los siguientes case.
        // La sesión de pago expiró sin pagarse → borrar el Payment pendiente.
        case 'checkout.session.expired':
          await this.stripeService.handleCheckoutExpired(event.data.object as any);
          break;
        // Cambió el estado de una cuenta Connect (negocio o influencer) →
        // sincronizar si ya puede cobrar/recibir.
        case 'account.updated':
          await this.stripeService.handleAccountUpdated(event.data.object as any);
          break;
        // La suscripción de plataforma cambió de estado (activa, vencida, etc.).
        case 'customer.subscription.updated':
          await this.stripeService.handleSubscriptionUpdated(event.data.object as any);
          break;
        // La suscripción se eliminó por completo → marcarla CANCELLED.
        case 'customer.subscription.deleted':
          await this.stripeService.handleSubscriptionDeleted(event.data.object as any);
          break;
        // Se pagó una factura de la suscripción → marcar ACTIVE y registrar factura.
        case 'invoice.paid':
          await this.stripeService.handleInvoicePaid(event.data.object as any);
          break;
        // Falló el cobro de una factura → marcar PAST_DUE con periodo de gracia.
        case 'invoice.payment_failed':
          await this.stripeService.handleInvoicePaymentFailed(event.data.object as any);
          break;
        // (Otros tipos de evento que Stripe envíe se ignoran a propósito.)
      }
    } catch (err: any) {
      // Log detallado (tipo + id del evento) para poder rastrear el fallo en el
      // Dashboard de Stripe y en los logs del servidor sin romper la entrega.
      console.error(
        `Stripe webhook handler error [${event.type} ${event.id}]:`,
        err?.stack || err?.message || err,
      );
    }

    // Confirmamos a Stripe que recibimos el evento (2xx). Lo hacemos SIEMPRE tras
    // verificar la firma, haya fallado o no el procesamiento interno.
    return res.json({ received: true });
  }
}
