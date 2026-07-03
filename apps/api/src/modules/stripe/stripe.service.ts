// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// De NestJS importamos:
//   - Injectable: decorador que marca esta clase como servicio inyectable.
//   - BadRequestException: error que responde HTTP 400 (petición inválida).
//   - NotFoundException: error que responde HTTP 404 (no encontrado).
//   - Logger: utilidad para imprimir mensajes en consola con formato (info/error).
//   - OnModuleInit: "interfaz" (contrato) que, si la implementa la clase, hace
//     que NestJS llame al método onModuleInit() una vez al arrancar el módulo.
import { Injectable, BadRequestException, NotFoundException, Logger, OnModuleInit } from '@nestjs/common';
// PrismaService = nuestro "puente" a la base de datos (ORM Prisma). Con
// this.prisma leemos/escribimos tablas (tenant, subscription, payment, etc.).
import { PrismaService } from '../../prisma/prisma.service';
// "Stripe" es la librería oficial de Stripe para Node. Crearemos un cliente
// (this.stripe) y a través de él llamaremos a la API de Stripe (crear clientes,
// suscripciones, sesiones de pago, etc.).
import Stripe from 'stripe';
// Configuración de los CÓDIGOS DE CREADOR (descuentos de influencers):
//   - CREATOR_DISCOUNT: cuánto descuento corresponde según el tipo de cuenta.
//   - DISCOUNT_MONTHS: cuántos meses dura el descuento.
//   - tenantKind: función que traduce el tenantType a la "clave" usada en la config.
import {
  CREATOR_DISCOUNT,
  DISCOUNT_MONTHS,
  tenantKind,
} from '../creator-codes/creator-codes.config';

// CONSTANTES de tiempo (en milisegundos). Se calculan multiplicando para que
// sea legible: 30 * 60 * 1000 = 30 minutos · 60 segundos · 1000 ms.
const UNPAID_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutos: tiempo máximo sin pagar.
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // cada 5 minutos revisamos pagos viejos.

// @Injectable() marca la clase como servicio inyectable de NestJS.
// "implements OnModuleInit" promete que la clase tendrá el método onModuleInit(),
// que NestJS ejecutará automáticamente al iniciar (lo usamos para lanzar la
// tarea de limpieza periódica).
@Injectable()
export class StripeService implements OnModuleInit {
  // logger = herramienta para imprimir mensajes con la etiqueta "StripeService".
  // "private readonly" => propiedad interna de solo lectura.
  private readonly logger = new Logger(StripeService.name);
  // stripe = el cliente de la API de Stripe (se crea en el constructor).
  private stripe: Stripe;
  // feePercent = el porcentaje de comisión que la plataforma se queda de cada
  // cobro a clientes (se lee de configuración).
  private feePercent: number;

  // CONSTRUCTOR: NestJS inyecta PrismaService. Aquí también preparamos el
  // cliente de Stripe y leemos la comisión de plataforma.
  constructor(private prisma: PrismaService) {
    // Creamos el cliente de Stripe con la CLAVE SECRETA (sk_...). Se lee de la
    // variable de entorno; "|| ''" evita pasar undefined si no está configurada.
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
      // apiVersion fija la versión de la API de Stripe a usar (para que el
      // comportamiento no cambie sin avisar cuando Stripe publique versiones nuevas).
      apiVersion: '2026-02-25.clover',
    });
    // parseInt(texto, 10) convierte un texto a número entero en base 10 (decimal).
    // "|| '5'" usa 5% por defecto si la variable de entorno no está definida.
    this.feePercent = parseInt(process.env.STRIPE_PLATFORM_FEE_PERCENT || '5', 10);
  }

  // onModuleInit(): NestJS lo llama UNA vez cuando el módulo termina de cargar.
  onModuleInit() {
    // Arrancamos una tarea recurrente: cada CLEANUP_INTERVAL_MS milisegundos
    // ejecuta cancelUnpaidAppointments(). setInterval programa esa repetición.
    // La función flecha "() => this.cancelUnpaidAppointments()" conserva el
    // "this" correcto (el del servicio) al llamarse más tarde.
    setInterval(() => this.cancelUnpaidAppointments(), CLEANUP_INTERVAL_MS);
    this.logger.log('Unpaid appointment cleanup job started (every 5 min)');
  }

  // ─── CLEANUP UNPAID APPOINTMENTS ────────────────────
  // Tarea de limpieza: cancela citas cuyo pago con Stripe quedó "PENDING"
  // demasiado tiempo (el cliente abrió el checkout pero nunca pagó). Así no
  // quedan citas "fantasma" bloqueando el horario del profesional.

  // "private" => solo se usa dentro de esta clase. "async" => trabaja con
  // operaciones que tardan (base de datos) y usa "await".
  private async cancelUnpaidAppointments() {
    // try/catch para que un error en la tarea NO tumbe la app: si algo falla,
    // lo registramos y seguimos.
    try {
      // "cutoff" = el instante límite. Date.now() es "ahora" en ms; le restamos
      // el timeout para obtener "hace 30 minutos". Todo pago creado ANTES de
      // este instante se considera vencido.
      const cutoff = new Date(Date.now() - UNPAID_TIMEOUT_MS);

      // Buscamos pagos PENDIENTES, de método STRIPE, creados antes del corte.
      // "lt" = "less than" (menor que): createdAt anterior a "cutoff".
      const expiredPayments = await this.prisma.payment.findMany({
        where: {
          status: 'PENDING',
          paymentMethod: 'STRIPE',
          createdAt: { lt: cutoff },
        },
        // select: traemos solo los campos que necesitamos (más eficiente).
        select: { id: true, appointmentId: true },
      });

      // Si no hay ninguno, terminamos temprano (no hay nada que limpiar).
      // ".length === 0" => la lista está vacía. "===" compara valor Y tipo.
      if (expiredPayments.length === 0) return;

      // Recorremos cada pago vencido. "for...of" itera elemento a elemento.
      for (const payment of expiredPayments) {
        // Si el pago está ligado a una cita, cancelamos esa cita.
        if (payment.appointmentId) {
          await this.prisma.appointment.update({
            where: { id: payment.appointmentId },
            data: { status: 'CANCELLED' },
          });
        }

        // Borramos el registro de pago pendiente (ya no sirve).
        await this.prisma.payment.delete({ where: { id: payment.id } });
      }

      this.logger.log(`Cancelled ${expiredPayments.length} unpaid appointment(s)`);
    } catch (err) {
      this.logger.error('Error in unpaid cleanup job:', err);
    }
  }

  // ─── CONNECT ONBOARDING ─────────────────────────────
  // CONCEPTO "Stripe Connect": modelo en el que NUESTRA plataforma orquesta los
  // cobros y reparte el dinero a cuentas conectadas (de cada negocio). El negocio
  // usa una cuenta tipo "standard" (gestionada por él en Stripe). Para empezar a
  // cobrar debe completar el "onboarding" (verificar identidad, banco, etc.).

  // createConnectAccountLink(): crea (si no existe) la cuenta Connect del negocio
  // y devuelve una URL hacia Stripe para que complete el onboarding.
  //   - Recibe: tenantId (qué negocio) y returnUrl (a dónde volver al terminar).
  //   - Devuelve: { url } con el enlace de onboarding.
  async createConnectAccountLink(tenantId: string, returnUrl: string) {
    // Buscamos el negocio en nuestra base de datos.
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    // "!tenant" => si no existe, lanzamos 404.
    if (!tenant) throw new NotFoundException('Tenant no encontrado');

    // "let" (variable reasignable): id de la cuenta Connect ya guardada (o null).
    let accountId = tenant.stripeAccountId;

    // Si el negocio aún NO tiene cuenta Connect, la creamos en Stripe.
    if (!accountId) {
      const account = await this.stripe.accounts.create({
        type: 'standard', // tipo de cuenta Connect gestionada por el propio negocio.
        email: tenant.email,
        business_profile: {
          name: tenant.name,
          url: `https://siliba.com/marketplace/${tenant.slug}`, // perfil público.
        },
      });
      // Guardamos el id que Stripe nos devolvió.
      accountId = account.id;

      // Persistimos ese id en nuestra base de datos para reutilizarlo después.
      await this.prisma.tenant.update({
        where: { id: tenantId },
        data: { stripeAccountId: accountId },
      });
    }

    // Generamos el enlace de onboarding. Stripe lo asocia a la cuenta y nos da
    // una URL temporal donde el negocio completará sus datos.
    const accountLink = await this.stripe.accountLinks.create({
      account: accountId,
      refresh_url: returnUrl, // a dónde ir si el link caduca y hay que regenerarlo.
      return_url: returnUrl,  // a dónde volver al terminar el onboarding.
      type: 'account_onboarding',
    });

    return { url: accountLink.url };
  }

  // getConnectStatus(): consulta a Stripe si el negocio ya puede cobrar y
  // sincroniza ese estado en nuestra base de datos.
  async getConnectStatus(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant no encontrado');

    // Si nunca creó cuenta Connect, no está conectado.
    if (!tenant.stripeAccountId) {
      return { connected: false, stripeAccountId: null };
    }

    // Preguntamos a Stripe el estado REAL de la cuenta (no confiamos solo en DB).
    const account = await this.stripe.accounts.retrieve(tenant.stripeAccountId);
    // "charges_enabled" indica si la cuenta ya puede aceptar cobros.
    // "!!" convierte el valor a booleano puro (true/false), por si viniera
    // undefined: !!undefined => false; !!true => true.
    const connected = !!account.charges_enabled;

    // Si el estado real cambió respecto a lo guardado, actualizamos la DB.
    // "!==" => distinto (compara valor y tipo).
    if (connected !== tenant.stripeOnboardingComplete) {
      await this.prisma.tenant.update({
        where: { id: tenantId },
        data: { stripeOnboardingComplete: connected },
      });
    }

    return { connected, stripeAccountId: tenant.stripeAccountId };
  }

  // ─── CONNECT ONBOARDING (INFLUENCERS) ───────────────
  // Cuentas "express": variante de Connect con onboarding SIMPLIFICADO (Stripe
  // pone gran parte de la interfaz). A los influencers les pagamos comisiones
  // mediante "Transfer" (envío de dinero plataforma → cuenta conectada), así que
  // pedimos la "capability" (permiso/capacidad) de transfers.

  // createInfluencerConnectLink(): crea (si no existe) la cuenta Express del
  // influencer y devuelve la URL de onboarding.
  async createInfluencerConnectLink(influencerId: string, returnUrl: string) {
    const influencer = await this.prisma.influencer.findUnique({
      where: { id: influencerId },
    });
    if (!influencer) throw new NotFoundException('Influencer no encontrado');

    // Crea una cuenta Connect nueva con la config correcta y la guarda.
    // Cuenta EXPRESS: coincide con el perfil de plataforma confirmado en Stripe
    // (onboarding alojado en Stripe + Dashboard Express para el vendedor +
    // plataforma responsable de reembolsos/contracargos). El creador solo recibe
    // comisiones vía "transfers", por eso pedimos esa capacidad.
    const createAccount = async (): Promise<string> => {
      const account = await this.stripe.accounts.create({
        type: 'express',
        email: influencer.email,
        business_type: 'individual',
        // Pre-cargamos el perfil de negocio para que el creador (afiliado que
        // solo promociona la app y cobra comisión) no tenga que inventar un
        // sitio/actividad: promociona Siliba y recibe comisiones por referidos.
        business_profile: {
          url: process.env.WEB_URL || 'https://app.siliba.com',
          product_description:
            'Marketing de afiliados: promoción de la aplicación Siliba (plataforma de reservas de citas) y comisiones por clientes/negocios referidos.',
        },
        capabilities: { transfers: { requested: true } },
        metadata: { influencerId: influencer.id },
      });
      await this.prisma.influencer.update({
        where: { id: influencerId },
        data: { stripeAccountId: account.id },
      });
      return account.id;
    };

    let accountId = influencer.stripeAccountId || (await createAccount());

    try {
      const accountLink = await this.stripe.accountLinks.create({
        account: accountId,
        refresh_url: returnUrl,
        return_url: returnUrl,
        type: 'account_onboarding',
      });
      return { url: accountLink.url };
    } catch (err: any) {
      // La cuenta guardada puede ser de una config antigua (platform-liable) que
      // Stripe bloquea. La recreamos con la config nueva y reintentamos una vez.
      this.logger.warn(`[connect] accountLink falló (${err?.message}); recreando cuenta del creador con nueva config`);
      accountId = await createAccount();
      const accountLink = await this.stripe.accountLinks.create({
        account: accountId,
        refresh_url: returnUrl,
        return_url: returnUrl,
        type: 'account_onboarding',
      });
      return { url: accountLink.url };
    }
  }

  /**
   * Transfiere comisión a la cuenta Connect del influencer. El influencer
   * absorbe la fee de Stripe (recibe el neto del payout a su banco; el Transfer
   * platform→connected no tiene fee adicional). Moneda = la del price de plataforma.
   *
   * Recibe: la cuenta destino, el monto en UNIDADES (ej. 50 = $50.00) y unos
   * metadatos. Devuelve la Transfer creada (Promise<Stripe.Transfer>).
   */
  async createInfluencerTransfer(
    destinationAccountId: string,
    amountUnits: number,
    // Record<string, string> = un objeto cuyas claves y valores son textos
    // (un "diccionario" libre de pares clave→valor).
    metadata: Record<string, string>,
  ): Promise<Stripe.Transfer> {
    // Queremos pagar en la MISMA moneda del price de plataforma. Lo averiguamos.
    const priceId = process.env.STRIPE_PLATFORM_PRICE_ID;
    // Valor por defecto: dólares. Se sobreescribe si conseguimos el price real.
    let currency = 'usd';
    if (priceId) {
      try {
        // "price" en Stripe = un precio concreto (monto + moneda + recurrencia)
        // asociado a un "product". Aquí solo nos interesa su moneda.
        const price = await this.stripe.prices.retrieve(priceId);
        currency = price.currency || 'usd';
      } catch (_) { /* usa usd por defecto */ }
    }

    // Creamos la Transfer (envío de dinero a la cuenta conectada del influencer).
    return this.stripe.transfers.create({
      // Stripe trabaja en la unidad MÍNIMA (centavos). Multiplicamos por 100 y
      // Math.round() redondea para evitar decimales por errores de coma flotante.
      amount: Math.round(amountUnits * 100),
      currency,
      destination: destinationAccountId, // cuenta que RECIBE el dinero.
      metadata,
    });
  }

  // getInfluencerConnectStatus(): igual que el de tenant, pero para influencers.
  // Aquí lo importante NO es cobrar, sino poder RECIBIR pagos: por eso miramos
  // "payouts_enabled" en lugar de "charges_enabled".
  async getInfluencerConnectStatus(influencerId: string) {
    const influencer = await this.prisma.influencer.findUnique({
      where: { id: influencerId },
    });
    if (!influencer) throw new NotFoundException('Influencer no encontrado');

    if (!influencer.stripeAccountId) {
      return { connected: false, stripeAccountId: null };
    }

    const account = await this.stripe.accounts.retrieve(influencer.stripeAccountId);
    // payouts_enabled: la cuenta puede RECIBIR transfers (lo que nos importa)
    const connected = !!account.payouts_enabled;

    if (connected !== influencer.stripeOnboardingComplete) {
      await this.prisma.influencer.update({
        where: { id: influencerId },
        data: { stripeOnboardingComplete: connected },
      });
    }

    return { connected, stripeAccountId: influencer.stripeAccountId };
  }

  // ─── CHECKOUT SESSION ───────────────────────────────
  // CONCEPTO "Checkout Session": una página de pago HOSPEDADA por Stripe. Le
  // damos los productos/montos y Stripe genera una URL segura donde el cliente
  // paga con tarjeta. Aquí usamos el "destination charge" de Connect: cobramos,
  // nos quedamos una comisión (application_fee) y enviamos el resto al negocio.

  // createCheckoutSession(): genera la sesión de pago de una cita y crea un
  // registro Payment en estado PENDING.
  //   - "params: {...}" recibe un solo objeto con todos los datos (más legible
  //     que muchos argumentos sueltos).
  async createCheckoutSession(params: {
    tenantId: string;
    appointmentId: string;
    clientId: string;
    // lineItems = lista de conceptos a cobrar. "amount" va en la unidad mínima
    // (centavos). Los "[]" al final significan "arreglo (lista) de estos objetos".
    lineItems: { name: string; amount: number; quantity: number }[];
    currency: string;
    successUrl: string; // a dónde mandar al cliente si paga bien.
    cancelUrl: string;  // a dónde mandar al cliente si cancela.
  }) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: params.tenantId } });
    if (!tenant) throw new NotFoundException('Tenant no encontrado');
    // El negocio solo puede cobrar online si tiene cuenta Connect Y completó el
    // onboarding. "||" => si CUALQUIERA de las dos falla, no acepta pagos.
    if (!tenant.stripeAccountId || !tenant.stripeOnboardingComplete) {
      throw new BadRequestException('Este negocio no acepta pagos online');
    }

    // Evitamos cobrar dos veces: si ya hay un pago COMPLETED para esta cita, paramos.
    const existingPayment = await this.prisma.payment.findFirst({
      where: {
        appointmentId: params.appointmentId,
        status: 'COMPLETED',
      },
    });
    if (existingPayment) {
      throw new BadRequestException('Esta cita ya fue pagada');
    }

    // Sumamos el total en centavos. reduce() recorre la lista acumulando en "sum"
    // (que empieza en 0); por cada item suma precio × cantidad.
    const totalCents = params.lineItems.reduce((sum, item) => sum + item.amount * item.quantity, 0);
    // Comisión de plataforma en centavos = total × porcentaje ÷ 100, redondeado.
    const feeCents = Math.round(totalCents * this.feePercent / 100);

    // Creamos la sesión de pago en Stripe.
    const session = await this.stripe.checkout.sessions.create({
      mode: 'payment', // pago único (no suscripción).
      // line_items: convertimos cada concepto a la forma que Stripe espera.
      // map() transforma cada elemento de la lista en uno nuevo.
      line_items: params.lineItems.map((item) => ({
        price_data: {
          currency: params.currency.toLowerCase(), // Stripe quiere la moneda en minúsculas.
          product_data: { name: item.name },        // nombre que verá el cliente.
          unit_amount: item.amount,                 // precio unitario en centavos.
        },
        quantity: item.quantity,
      })),
      // payment_intent_data: configura el reparto de dinero de Connect.
      payment_intent_data: {
        // application_fee_amount: lo que SE QUEDA la plataforma (en centavos).
        application_fee_amount: feeCents,
        // transfer_data.destination: a qué cuenta del negocio va el resto.
        transfer_data: {
          destination: tenant.stripeAccountId,
        },
      },
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      // metadata: datos propios que viajan con la sesión; los leeremos en el
      // webhook para saber qué cita/negocio/cliente corresponde al pago.
      metadata: {
        appointmentId: params.appointmentId,
        tenantId: params.tenantId,
        clientId: params.clientId,
      },
    });

    // Guardamos el Payment en estado PENDING (se marcará COMPLETED por el webhook).
    // Pasamos el total de centavos a unidades decimales (÷ 100) para guardarlo.
    const totalDecimal = totalCents / 100;
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: params.appointmentId },
    });

    await this.prisma.payment.create({
      data: {
        tenantId: params.tenantId,
        appointmentId: params.appointmentId,
        clientId: params.clientId,
        // "appointment?.locationId || ''": si no hay cita o no tiene sucursal,
        // guardamos cadena vacía para no romper (el campo no admite null).
        locationId: appointment?.locationId || '',
        amount: totalDecimal,
        totalAmount: totalDecimal,
        currency: params.currency,
        paymentMethod: 'STRIPE',
        status: 'PENDING',
        // Guardamos el id de la sesión para enlazarla cuando llegue el webhook.
        stripeSessionId: session.id,
      },
    });

    return { checkoutUrl: session.url };
  }

  // ─── VERIFY SESSION (fallback when webhooks don't arrive) ──
  // PLAN B: a veces el webhook de Stripe tarda o no llega (red, configuración).
  // El frontend, tras el pago, llama aquí para confirmar el estado consultando
  // a Stripe directamente y marcar el Payment como COMPLETED si ya se pagó.
  async verifyAndCompleteSession(sessionId: string) {
    // Buscamos el Payment ligado a esa sesión.
    const payment = await this.prisma.payment.findFirst({
      where: { stripeSessionId: sessionId },
    });
    // Si no existe, devolvemos null (el controlador responderá 'NOT_FOUND').
    if (!payment) return null;
    // Si ya estaba completado, lo devolvemos tal cual (nada que hacer).
    if (payment.status === 'COMPLETED') return payment;

    // Preguntamos a Stripe el estado actual de la sesión.
    const session = await this.stripe.checkout.sessions.retrieve(sessionId);
    // "payment_status === 'paid'" => Stripe confirma que el cliente ya pagó.
    if (session.payment_status === 'paid') {
      return this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'COMPLETED',
          // Guardamos el id del PaymentIntent (la "intención de pago" de Stripe
          // que representa el cobro real). Según cómo venga la respuesta, puede
          // ser un texto (id) o un objeto: con el operador ternario elegimos.
          //   typeof X === 'string' ? X : X?.id || null
          //   = si es texto úsalo; si es objeto usa su .id; si nada, null.
          stripePaymentIntentId: typeof session.payment_intent === 'string'
            ? session.payment_intent
            : session.payment_intent?.id || null,
        },
      });
    }

    // Si aún no está pagada, devolvemos el payment sin cambios.
    return payment;
  }

  // ─── WEBHOOKS ───────────────────────────────────────
  // constructWebhookEvent(): verifica la FIRMA del webhook y devuelve el evento.
  //   - payload: el cuerpo crudo (bytes) tal cual llegó (Buffer).
  //   - signature: la firma que Stripe envió en la cabecera 'stripe-signature'.
  // Si la firma no cuadra con nuestro "webhook secret", Stripe SDK lanza error
  // (lo que impide que un atacante nos envíe eventos falsos).
  constructWebhookEvent(payload: Buffer, signature: string): Stripe.Event {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
      throw new BadRequestException('Webhook secret not configured');
    }
    // constructEvent recalcula la firma sobre payload+secret y la compara con la
    // recibida; si coinciden, parsea y devuelve el evento de forma segura.
    return this.stripe.webhooks.constructEvent(payload, signature, secret);
  }

  // handleCheckoutCompleted(): se ejecuta cuando un pago de cita se completó.
  // Marca el Payment correspondiente como COMPLETED.
  async handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    // Sacamos el appointmentId que pusimos en metadata al crear la sesión.
    // "session.metadata || {}" => si no hay metadata, usamos objeto vacío para
    // no romper al desestructurar.
    const { appointmentId } = session.metadata || {};
    if (!appointmentId) return; // sin cita asociada, no hacemos nada.

    const payment = await this.prisma.payment.findFirst({
      where: { stripeSessionId: session.id },
    });
    // Si no hay pago, o ya estaba completado, salimos (idempotencia: aguanta
    // que el webhook llegue repetido sin volver a procesar).
    if (!payment || payment.status === 'COMPLETED') return;

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'COMPLETED',
        // (mismo patrón ternario explicado en verifyAndCompleteSession)
        stripePaymentIntentId: typeof session.payment_intent === 'string'
          ? session.payment_intent
          : session.payment_intent?.id || null,
      },
    });
  }

  // handleCheckoutExpired(): la sesión de pago caducó sin pagarse. Borramos el
  // Payment pendiente para no dejar basura.
  async handleCheckoutExpired(session: Stripe.Checkout.Session) {
    const payment = await this.prisma.payment.findFirst({
      where: { stripeSessionId: session.id, status: 'PENDING' },
    });
    if (payment) {
      await this.prisma.payment.delete({ where: { id: payment.id } });
    }
  }

  // handleAccountUpdated(): Stripe avisa que una cuenta Connect cambió. La cuenta
  // puede ser de un NEGOCIO (Standard) o de un INFLUENCER (Express); buscamos en
  // ambas tablas y sincronizamos el estado de onboarding correspondiente.
  async handleAccountUpdated(account: Stripe.Account) {
    // La cuenta puede pertenecer a un tenant (Standard) o a un influencer (Express)
    const tenant = await this.prisma.tenant.findFirst({
      where: { stripeAccountId: account.id },
    });
    if (tenant) {
      await this.prisma.tenant.update({
        where: { id: tenant.id },
        // Negocio: lo que importa es si ya puede COBRAR (charges_enabled).
        data: { stripeOnboardingComplete: !!account.charges_enabled },
      });
      return; // ya resuelto; no seguimos buscando entre influencers.
    }

    const influencer = await this.prisma.influencer.findFirst({
      where: { stripeAccountId: account.id },
    });
    if (influencer) {
      await this.prisma.influencer.update({
        where: { id: influencer.id },
        // Influencer: lo que importa es si ya puede RECIBIR pagos (payouts_enabled).
        data: { stripeOnboardingComplete: !!account.payouts_enabled },
      });
    }
  }

  // ─── PLATFORM SUBSCRIPTIONS ─────────────────────────
  // Modelo PLANO: el negocio paga una cuota mensual fija según su tipo de cuenta:
  //   FREELANCER → PRO ($300/mes)   BUSINESS → PLUS ($500/mes)
  // El número de empleados NO afecta el cobro (queda como dato informativo).
  //
  // CONCEPTOS Stripe usados aquí:
  //   - customer: representa al pagador (el negocio) en Stripe.
  //   - subscription: cobro RECURRENTE asociado a un customer y a un "price".
  //   - price/product: el "product" es el plan; el "price" es su monto+frecuencia.
  //   - invoice: cada factura que la suscripción genera en cada periodo.
  //   - PaymentIntent: la "intención de cobro"; su "client_secret" lo usa el
  //     frontend (Stripe Elements) para confirmar el pago de la tarjeta.

  // getOrCreateCustomer(): devuelve el id del customer de Stripe del negocio,
  // creándolo la primera vez. ": Promise<string>" => promete devolver un texto.
  async getOrCreateCustomer(tenantId: string): Promise<string> {
    const sub = await this.prisma.subscription.findUnique({ where: { tenantId } });
    // Si ya hay customer guardado, lo reutilizamos PERO verificando que siga
    // existiendo en ESTA cuenta de Stripe. Si la clave/cuenta cambió, el customer
    // viejo ya no existe ("No such customer") y hay que recrearlo en vez de fallar.
    if (sub?.stripeCustomerId) {
      try {
        const existing: any = await this.stripe.customers.retrieve(sub.stripeCustomerId);
        if (existing && !existing.deleted) return sub.stripeCustomerId;
      } catch (err: any) {
        // resource_missing = el customer no existe en esta cuenta: seguimos y
        // creamos uno nuevo. Cualquier otro error sí se propaga.
        if (err?.code !== 'resource_missing') throw err;
      }
    }

    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant no encontrado');

    // Creamos el customer en Stripe con datos del negocio.
    const customer = await this.stripe.customers.create({
      email: tenant.email,
      name: tenant.name,
      metadata: { tenantId }, // para reconocerlo después.
    });

    // Guardamos su id en nuestra suscripción para no volver a crearlo.
    await this.prisma.subscription.update({
      where: { tenantId },
      data: { stripeCustomerId: customer.id },
    });

    return customer.id;
  }

  /** Retrieves the client_secret from a Stripe subscription's first invoice. */
  // Obtiene el "client_secret" siguiendo la cadena: suscripción → última factura
  // → PaymentIntent → client_secret. El frontend necesita ese secret para cobrar
  // la primera mensualidad con la tarjeta del cliente. Devuelve el secret o null.
  private async getClientSecretFromSubscription(stripeSubId: string): Promise<string | null> {
    try {
      // 1) Traemos la suscripción de Stripe.
      const stripeSub = await this.stripe.subscriptions.retrieve(stripeSubId);
      // 2) Su "latest_invoice" (última factura) puede venir como id (texto) o
      //    como objeto; el ternario obtiene el id en ambos casos.
      const invoiceId = typeof stripeSub.latest_invoice === 'string'
        ? stripeSub.latest_invoice
        : (stripeSub.latest_invoice as any)?.id;

      if (!invoiceId) return null; // sin factura, no hay nada que cobrar aún.

      // 3) Traemos la factura. "as any" relaja el tipado para leer payment_intent.
      const invoice = await this.stripe.invoices.retrieve(invoiceId) as any;
      // 4) De la factura sacamos el id del PaymentIntent (texto u objeto).
      const piId = typeof invoice.payment_intent === 'string'
        ? invoice.payment_intent
        : invoice.payment_intent?.id;

      if (!piId) return null;

      // 5) Traemos el PaymentIntent y devolvemos su client_secret.
      const pi = await this.stripe.paymentIntents.retrieve(piId);
      // Log de diagnóstico: imprime si el secret salió OK o NULL (sin exponerlo).
      this.logger.log(`[getClientSecret] pi=${pi.id} status=${pi.status} secret=${pi.client_secret ? 'OK' : 'NULL'}`);
      return pi.client_secret;
    } catch (err: any) {
      // Si algo falla en la cadena, lo registramos y devolvemos null (no rompemos).
      this.logger.error(`[getClientSecret] error: ${err.message}`);
      return null;
    }
  }

  // ─── CÓDIGOS DE CREADOR (descuento meses 1-2) ───────
  // Un "código de creador" es un cupón promocional de un influencer aprobado.
  // Aplica un descuento durante los primeros meses de la suscripción del negocio.

  /**
   * Valida un código de creador para un tenant que va a activar su suscripción.
   * Reglas: código activo, influencer aprobado, y el tenant NO debe haber usado
   * ningún código antes (un solo uso de por vida).
   */
  async validateCreatorCodeForTenant(tenantId: string, rawCode: string) {
    // Normalizamos: "(rawCode || '')" evita null; .trim() quita espacios;
    // .toUpperCase() pasa a MAYÚSCULAS (los códigos se guardan en mayúsculas).
    const code = (rawCode || '').trim().toUpperCase();
    // Si quedó vacío, pedimos que ingresen uno.
    if (!code) return { valid: false, reason: 'Ingresa un código' };

    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return { valid: false, reason: 'Negocio no encontrado' };

    // Regla "un solo uso de por vida": si ya hay un registro de uso, se rechaza.
    const priorUsage = await this.prisma.creatorCodeUsage.findUnique({
      where: { tenantId },
    });
    if (priorUsage) {
      return { valid: false, reason: 'Ya usaste un código de creador anteriormente' };
    }

    // Buscamos el código e incluimos los datos del influencer dueño.
    const creatorCode = await this.prisma.creatorCode.findUnique({
      where: { code },
      include: { influencer: true },
    });
    // "!creatorCode || !creatorCode.isActive" => si no existe o está inactivo, inválido.
    if (!creatorCode || !creatorCode.isActive) {
      return { valid: false, reason: 'Código inválido o inactivo' };
    }
    // El influencer debe estar APROBADO ("!==" = distinto de 'APPROVED').
    if (creatorCode.influencer.status !== 'APPROVED') {
      return { valid: false, reason: 'Código inválido o inactivo' };
    }

    // tenantKind() traduce el tipo de cuenta a la clave de la config de descuentos.
    const kind = tenantKind(tenant.tenantType);
    // CREATOR_DISCOUNT[kind] = el descuento correspondiente a ese tipo de cuenta.
    const discount = CREATOR_DISCOUNT[kind];

    // Devolvemos toda la info útil para mostrar y aplicar el descuento.
    return {
      valid: true,
      code,
      codeId: creatorCode.id,
      influencerId: creatorCode.influencerId,
      // Nombre completo armado con plantilla de texto (`...${}...`).
      influencerName: `${creatorCode.influencer.firstName} ${creatorCode.influencer.lastName}`,
      discount,
      months: DISCOUNT_MONTHS,
    };
  }

  /** Crea un Stripe Coupon de monto fijo para los meses 1-2, en la moneda del price. */
  // CONCEPTO "coupon" en Stripe: un descuento reutilizable que se aplica a una
  // suscripción. Aquí creamos uno de MONTO FIJO ("amount_off") que se repite
  // durante DISCOUNT_MONTHS meses. Devuelve el id del cupón creado.
  private async createCreatorCoupon(priceId: string, discountUnits: number): Promise<string> {
    // Tomamos la moneda del price para que el descuento sea en la misma moneda.
    const price = await this.stripe.prices.retrieve(priceId);
    const currency = price.currency || 'usd';
    const coupon = await this.stripe.coupons.create({
      // amount_off en centavos (× 100, redondeado).
      amount_off: Math.round(discountUnits * 100),
      currency,
      duration: 'repeating',            // se aplica en varios periodos seguidos...
      duration_in_months: DISCOUNT_MONTHS, // ...durante este número de meses.
      name: `Creador -${discountUnits} (${DISCOUNT_MONTHS} meses)`,
    });
    return coupon.id;
  }

  /** Creates a fresh Stripe subscription and returns its clientSecret. */
  // Crea una suscripción NUEVA en Stripe (aplicando cupón de creador si procede),
  // guarda los datos en nuestra DB y devuelve el clientSecret del primer cobro.
  //   - "creatorCode?" lleva "?": es OPCIONAL.
  //   - El tipo de retorno promete { subscriptionId, clientSecret } (este último
  //     puede ser texto o null).
  private async createFreshStripeSubscription(
    customerId: string,
    priceId: string,
    quantity: number,
    tenantId: string,
    employeeCount: number,
    monthlyAmount: number,
    creatorCode?: string,
  ): Promise<{ subscriptionId: string; clientSecret: string | null }> {
    // creatorContext guardará el cupón y el id del código si el descuento aplica.
    // Empieza en null ("todavía no hay cupón").
    let creatorContext: { codeId: string; couponId: string } | null = null;
    if (creatorCode) {
      // Revalidamos el código en el servidor (no confiamos solo en el frontend).
      const validation = await this.validateCreatorCodeForTenant(tenantId, creatorCode);
      // Si es válido y trae codeId, creamos el cupón en Stripe.
      // "validation.discount!" => el "!" le dice a TypeScript "confía, no es null".
      if (validation.valid && validation.codeId) {
        const couponId = await this.createCreatorCoupon(priceId, validation.discount!);
        creatorContext = { codeId: validation.codeId, couponId };
      }
      // Si no es válido, se ignora silenciosamente (el UI ya validó antes).
    }

    // Creamos la suscripción en Stripe.
    const subscription = await this.stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId, quantity }], // qué plan y cuántas unidades.
      // "...(cond ? {A} : {})" => SPREAD CONDICIONAL: si hay cupón, añade la
      // propiedad "discounts"; si no, no añade nada (objeto vacío {}).
      ...(creatorContext ? { discounts: [{ coupon: creatorContext.couponId }] } : {}),
      // 'default_incomplete' => la sub queda en estado "incompleta" hasta que el
      // cliente confirme el primer pago en el frontend (con el clientSecret).
      payment_behavior: 'default_incomplete',
      // Guarda la tarjeta usada como método de pago por defecto de la sub.
      payment_settings: { save_default_payment_method: 'on_subscription' },
      // metadata: el tenantId siempre; el creatorCodeId solo si hubo cupón.
      metadata: { tenantId, ...(creatorContext ? { creatorCodeId: creatorContext.codeId } : {}) },
    });

    // Registrar el uso del código (un solo uso de por vida garantizado por @@unique tenantId)
    if (creatorContext) {
      try {
        await this.prisma.creatorCodeUsage.create({
          data: { codeId: creatorContext.codeId, tenantId, discountMonthsLeft: DISCOUNT_MONTHS },
        });
      } catch (err: any) {
        // Si falla el registro (ej. carrera con otra petición), solo lo logueamos.
        this.logger.error(`[creatorCode] no se pudo registrar usage: ${err.message}`);
      }
    }

    // Guardamos en nuestra DB los datos de la suscripción recién creada.
    await this.prisma.subscription.update({
      where: { tenantId },
      data: {
        stripeSubscriptionId: subscription.id,
        stripePriceId: priceId,
        billedEmployeeCount: employeeCount,
        monthlyAmountUsd: monthlyAmount, // monto PLANO del plan (300 PRO / 500 PLUS)
        // NO marcamos ACTIVE aquí: la sub nace 'default_incomplete' (sin pago).
        // El estado se mantiene (TRIAL) y solo pasa a ACTIVE cuando llega el
        // webhook invoice.paid. Marcarlo optimista hacía que, si el usuario
        // cerraba el modal sin pagar, la cuenta pareciera ya pagada (mostraba
        // "Cancelar suscripción"), lo cual es peligroso/confuso.
        cancelledAt: null,
      },
    });

    // Obtenemos el clientSecret para que el frontend confirme el primer cobro.
    const clientSecret = await this.getClientSecretFromSubscription(subscription.id);
    this.logger.log(`[createFresh] sub=${subscription.id} clientSecret=${clientSecret ? 'OK' : 'NULL'}`);
    return { subscriptionId: subscription.id, clientSecret };
  }

  /**
   * Plan de plataforma según el tipo de cuenta (modelo PLANO, no por asiento):
   *  - FREELANCER → PRO ($300/mes)  → STRIPE_PRICE_PRO
   *  - BUSINESS   → PLUS ($500/mes)  → STRIPE_PRICE_PLUS
   * Fallback a STRIPE_PLATFORM_PRICE_ID si no están las nuevas vars.
   *
   * Devuelve el priceId de Stripe a usar, el monto ($300/$500) y si es freelancer.
   */
  private async platformPlanFor(tenantId: string): Promise<{ priceId: string; amount: number; isFreelancer: boolean }> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { tenantType: true }, // solo necesitamos el tipo de cuenta.
    });
    // "=== 'FREELANCER'" => true si es cuenta de profesional independiente.
    // "tenant?." evita error si tenant fuera null.
    const isFreelancer = tenant?.tenantType === 'FREELANCER';
    // Elegimos el price según el tipo. Cada lado del ternario usa "||" como
    // FALLBACK: si no está la var específica (PRO/PLUS), cae a la genérica.
    const priceId = isFreelancer
      ? (process.env.STRIPE_PRICE_PRO || process.env.STRIPE_PLATFORM_PRICE_ID)
      : (process.env.STRIPE_PRICE_PLUS || process.env.STRIPE_PLATFORM_PRICE_ID);
    // Sin price configurado no podemos cobrar → error de configuración.
    if (!priceId) {
      throw new BadRequestException('Falta configurar el price de Stripe (STRIPE_PRICE_PRO / STRIPE_PRICE_PLUS)');
    }
    // amount: 300 para freelancer (PRO), 500 para negocio (PLUS).
    return { priceId, amount: isFreelancer ? 300 : 500, isFreelancer };
  }

  // createPlatformSubscription(): activa la suscripción de plataforma del negocio.
  // Intenta REUSAR una suscripción existente si está en estado aprovechable;
  // si no, crea una nueva. Devuelve subscriptionId, clientSecret y si se reactivó.
  async createPlatformSubscription(tenantId: string, employeeCount: number, creatorCode?: string) {
    // Desestructuramos el plan (price y monto) según el tipo de cuenta.
    const { priceId, amount } = await this.platformPlanFor(tenantId);

    const customerId = await this.getOrCreateCustomer(tenantId);
    const quantity = 1; // Modelo plano: una sola licencia, sin multiplicar por empleados.
    const existingSub = await this.prisma.subscription.findUnique({ where: { tenantId } });

    // ¿Hay una suscripción de Stripe previa que podamos reutilizar?
    if (existingSub?.stripeSubscriptionId) {
      try {
        const stripeSub = await this.stripe.subscriptions.retrieve(existingSub.stripeSubscriptionId);
        const stripeStatus = (stripeSub as any).status;

        // CASO 1: ya está activa y pagada → nada que cobrar.
        if (stripeStatus === 'active') {
          await this.prisma.subscription.update({
            where: { tenantId },
            data: { status: 'ACTIVE', cancelledAt: null },
          });
          return { subscriptionId: stripeSub.id, clientSecret: null, reactivated: true };
        }

        // CASO 2: existe pero sin pagar ('incomplete'). El PaymentIntent sigue
        // válido ~23h; intentamos reusar su clientSecret para terminar el pago.
        if (stripeStatus === 'incomplete') {
          const clientSecret = await this.getClientSecretFromSubscription(existingSub.stripeSubscriptionId);
          if (clientSecret) return { subscriptionId: stripeSub.id, clientSecret, reactivated: false };
          // Si el PaymentIntent caducó, seguimos abajo para crear una nueva.
        }
        // Otros estados ('incomplete_expired', 'canceled', etc.) → crear nueva.
      } catch (_) { /* la sub no existe en Stripe; seguimos para crear una nueva */ }

      // Limpiamos la referencia obsoleta antes de crear una nueva.
      await this.prisma.subscription.update({
        where: { tenantId },
        data: { stripeSubscriptionId: null },
      });
    }

    // Creamos una suscripción nueva desde cero.
    const result = await this.createFreshStripeSubscription(customerId, priceId, quantity, tenantId, employeeCount, amount, creatorCode);
    // "...result" copia todas sus propiedades y añadimos reactivated: false.
    return { ...result, reactivated: false };
  }

  // updateSubscriptionEmployeeCount(): solo actualiza el conteo de empleados
  // facturados. En el modelo plano NO cambia el monto ni la sub de Stripe.
  async updateSubscriptionEmployeeCount(tenantId: string, employeeCount: number) {
    // Modelo PLANO: el número de empleados NO afecta el cobro (el plan es fijo
    // por tipo de cuenta). Solo registramos el conteo como dato informativo;
    // no se modifica la suscripción de Stripe ni el monto.
    const sub = await this.prisma.subscription.findUnique({ where: { tenantId } });
    if (!sub) return; // sin suscripción, no hay nada que actualizar.
    await this.prisma.subscription.update({
      where: { tenantId },
      data: { billedEmployeeCount: employeeCount },
    });
  }

  // cancelPlatformSubscription(): cancela la suscripción. Si estaba activa, la
  // programa para terminar al final del periodo ya pagado (el negocio conserva
  // acceso hasta entonces). Devuelve hasta cuándo tiene acceso (accessUntil).
  async cancelPlatformSubscription(tenantId: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { tenantId } });

    // accessUntil por defecto: la próxima fecha de cobro guardada, o "ahora" si
    // no hubiera. ".toISOString()" devuelve la fecha como texto estándar.
    let accessUntil = sub?.nextBillingDate?.toISOString() || new Date().toISOString();

    if (sub?.stripeSubscriptionId) {
      try {
        const stripeSub = await this.stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
        const stripeStatus = (stripeSub as any).status;

        if (stripeStatus === 'active') {
          // Programar la cancelación para el fin del periodo pagado (no corta ya).
          const updated = await this.stripe.subscriptions.update(sub.stripeSubscriptionId, {
            cancel_at_period_end: true,
          });
          // current_period_end viene en SEGUNDOS UNIX; × 1000 lo pasa a ms para Date.
          accessUntil = new Date((updated as any).current_period_end * 1000).toISOString();
        } else {
          // Incompleta/caducada (nunca pagó) → cancelar de inmediato.
          // ".catch(() => {})" ignora el error si la cancelación falla.
          await this.stripe.subscriptions.cancel(sub.stripeSubscriptionId).catch(() => {});
        }
      } catch (_) {} // si la sub no existe en Stripe, seguimos sin romper.
    }

    // Reflejamos la cancelación en nuestra DB.
    await this.prisma.subscription.update({
      where: { tenantId },
      data: { status: 'CANCELLED', cancelledAt: new Date(), nextBillingDate: new Date(accessUntil) },
    });

    return { accessUntil };
  }

  // reactivatePlatformSubscription(): vuelve a poner en marcha una suscripción.
  // Según el estado de Stripe: quita la cancelación programada, reusa un cobro
  // pendiente, o crea una nueva suscripción desde cero.
  async reactivatePlatformSubscription(tenantId: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { tenantId } });

    if (sub?.stripeSubscriptionId) {
      try {
        const stripeSub = await this.stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
        const stripeStatus = (stripeSub as any).status;

        // Activa pero marcada para cancelarse → simplemente quitamos esa marca.
        if (stripeStatus === 'active') {
          if ((stripeSub as any).cancel_at_period_end) {
            await this.stripe.subscriptions.update(sub.stripeSubscriptionId, {
              cancel_at_period_end: false,
            });
          }
          await this.prisma.subscription.update({
            where: { tenantId },
            data: { status: 'ACTIVE', cancelledAt: null },
          });
          return { reactivated: true, clientSecret: null };
        }

        // Incompleta (sin pagar) → intentamos reusar su clientSecret (< 23h).
        if (stripeStatus === 'incomplete') {
          const clientSecret = await this.getClientSecretFromSubscription(sub.stripeSubscriptionId);
          if (clientSecret) return { reactivated: false, clientSecret };
        }
      } catch (_) {}

      // Referencia obsoleta o caducada → la limpiamos antes de crear una nueva.
      await this.prisma.subscription.update({
        where: { tenantId },
        data: { stripeSubscriptionId: null },
      }).catch(() => {});
    }

    // Crear una nueva suscripción en Stripe (gestiona el clientSecret). Si Stripe
    // NO está disponible (no configurado, o el negocio paga por transferencia),
    // NO bloqueamos: reactivamos solo en la BD restaurando el acceso. El cobro
    // real lo gestiona el negocio por transferencia y el super admin lo verifica.
    try {
      const preview = await this.getSubscriptionPreview(tenantId);
      const result = await this.createPlatformSubscription(tenantId, preview.activeEmployeeCount);
      // Reactivado sin necesidad de cobro (Stripe reusó una sub vigente).
      if (result.reactivated) return { reactivated: true, clientSecret: null };
      // Hay un pago de Stripe que completar en el frontend.
      if (result.clientSecret) return { reactivated: false, clientSecret: result.clientSecret };
      // Stripe no produjo un pago utilizable (p.ej. sin publishable key, o pago
      // por transferencia): NO bloqueamos — reactivamos en la BD. El cobro real
      // se gestiona por transferencia y el super admin lo verifica.
      this.logger.warn(`[reactivate] sin clientSecret de Stripe; reactivación manual en DB (tenant=${tenantId})`);
      await this.prisma.subscription.update({
        where: { tenantId },
        data: { status: 'ACTIVE', cancelledAt: null },
      });
      return { reactivated: true, clientSecret: null };
    } catch (err: any) {
      this.logger.warn(`[reactivate] Stripe no disponible; reactivación manual en DB: ${err?.message}`);
      await this.prisma.subscription.update({
        where: { tenantId },
        data: { status: 'ACTIVE', cancelledAt: null },
      });
      return { reactivated: true, clientSecret: null };
    }
  }

  // advancePayment(): crea un cobro ÚNICO (PaymentIntent) para pagar un mes por
  // adelantado. Devuelve el clientSecret (para confirmar el pago en el frontend)
  // y el monto. NO es una suscripción: es un pago suelto.
  async advancePayment(tenantId: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { tenantId } });
    if (!sub) throw new NotFoundException('Suscripción no encontrada');
    // Si ya tiene un mes adelantado pendiente, no permitimos otro.
    if (sub.advancePaid) throw new BadRequestException('Ya tienes un mes adelantado pendiente.');

    const customerId = await this.getOrCreateCustomer(tenantId);
    // Monto mensual a centavos. Number(...) convierte el Decimal de la DB a número.
    const amount = Math.round(Number(sub.monthlyAmountUsd) * 100); // cents

    // PaymentIntent = la intención/representación de un cobro único en Stripe.
    const pi = await this.stripe.paymentIntents.create({
      amount,
      // Los montos de suscripción son MXN (el campo se llama *Usd por legado).
      currency: 'mxn',
      customer: customerId,
      metadata: { tenantId, type: 'advance_payment' },
      description: 'Pago adelantado mensualidad Siliba',
    });

    return { clientSecret: pi.client_secret, amount: Number(sub.monthlyAmountUsd) };
  }

  // confirmAdvancePayment(): tras confirmarse el pago adelantado, marca el mes
  // como pagado y EMPUJA la próxima fecha de cobro un mes hacia adelante.
  async confirmAdvancePayment(tenantId: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { tenantId } });
    if (!sub) throw new NotFoundException('Suscripción no encontrada');

    // Partimos de la fecha de próximo cobro y le sumamos 1 mes.
    const nextBilling = new Date(sub.nextBillingDate);
    // setMonth(getMonth() + 1) avanza un mes (getMonth da 0-11; +1 = mes siguiente).
    nextBilling.setMonth(nextBilling.getMonth() + 1);

    await this.prisma.subscription.update({
      where: { tenantId },
      data: {
        advancePaid: true,
        nextBillingDate: nextBilling,
        lastPaymentDate: new Date(),
      },
    });
  }

  // switchToAnnual(): cambia del plan mensual al ANUAL (12 meses, 15% descuento).
  // Cancela la suscripción mensual y crea una anual nueva. Devuelve clientSecret,
  // total anual y fin del periodo.
  async switchToAnnual(tenantId: string, employeeCount: number) {
    const annualPriceId = process.env.STRIPE_ANNUAL_PRICE_ID;
    if (!annualPriceId) throw new BadRequestException('STRIPE_ANNUAL_PRICE_ID no configurado');

    const sub = await this.prisma.subscription.findUnique({ where: { tenantId } });
    const customerId = await this.getOrCreateCustomer(tenantId);
    // Modelo flat por tenantType. Plan anual = 12 meses con 15% de descuento.
    //  - FREELANCER: 300 * 12 * 0.85 = 3060 MXN/ano
    //  - BUSINESS:   500 * 12 * 0.85 = 5100 MXN/ano
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { tenantType: true },
    });
    const monthlyFlat = tenant?.tenantType === 'FREELANCER' ? 300 : 500;
    const quantity = 1; // Plan flat: una sola "licencia base", el employeeCount queda como metadato.
    // Total anual = mensual × 12 × 0.85 (el 0.85 aplica el 15% de descuento).
    const annualTotal = Math.round(monthlyFlat * 12 * 0.85);

    // Cancelamos la suscripción mensual existente (si está activa o incompleta).
    if (sub?.stripeSubscriptionId) {
      try {
        const existing = await this.stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
        // "||" => entra si está en CUALQUIERA de los dos estados.
        if ((existing as any).status === 'active' || (existing as any).status === 'incomplete') {
          await this.stripe.subscriptions.cancel(sub.stripeSubscriptionId);
        }
      } catch (_) {}
    }

    // Creamos la suscripción ANUAL.
    const annualSub = await this.stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: annualPriceId, quantity }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      // expand pide a Stripe que devuelva ya incluidos (sin pedirlos aparte) la
      // última factura y su PaymentIntent, para leer el clientSecret directo.
      expand: ['latest_invoice.payment_intent'],
      metadata: { tenantId, planInterval: 'ANNUAL' },
    });

    // Fin del periodo anual (segundos → ms con × 1000).
    const periodEnd = new Date((annualSub as any).current_period_end * 1000);

    // Guardamos el cambio a plan anual en nuestra DB.
    await this.prisma.subscription.update({
      where: { tenantId },
      data: {
        stripeSubscriptionId: annualSub.id,
        stripePriceId: annualPriceId,
        planInterval: 'ANNUAL',
        billedEmployeeCount: employeeCount,
        monthlyAmountUsd: annualTotal / 12, // equivalente mensual (informativo).
        annualAmountUsd: annualTotal,
        annualPeriodEnd: periodEnd,
        availableLicenses: 0,
      },
    });

    // Extraemos el clientSecret de la factura/PaymentIntent expandidos.
    const inv = annualSub.latest_invoice as any;
    const pi = inv?.payment_intent;
    let clientSecret: string | null = null;
    // El PaymentIntent puede venir como id (texto) o como objeto ya expandido.
    if (typeof pi === 'string') {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(pi);
      clientSecret = paymentIntent.client_secret;
    } else if (pi?.client_secret) {
      clientSecret = pi.client_secret;
    }

    return { clientSecret, annualTotal, periodEnd: periodEnd.toISOString() };
  }

  // addLicensesToAnnualPlan(): agrega "licencias" (cupos) al plan anual. Usa
  // primero las licencias gratis de la "bolsa" (availableLicenses) y solo cobra
  // las que falten, PRORRATEADAS por los meses que quedan del año.
  async addLicensesToAnnualPlan(tenantId: string, count: number) {
    const sub = await this.prisma.subscription.findUnique({ where: { tenantId } });
    if (!sub) throw new NotFoundException('Suscripción no encontrada');
    // Esta función es solo para plan ANUAL.
    if (sub.planInterval !== 'ANNUAL') throw new BadRequestException('Solo disponible en plan anual.');

    // toCharge = cuántas hay que COBRAR = pedidas menos las gratis disponibles,
    // pero nunca menos de 0 (Math.max(0, ...) impide negativos).
    const toCharge = Math.max(0, count - sub.availableLicenses);
    // freeFromPool = cuántas salen gratis de la bolsa = pedidas menos las cobradas.
    const freeFromPool = count - toCharge;

    if (toCharge === 0) {
      // Todas salen de la bolsa: no hay que cobrar nada.
      await this.prisma.subscription.update({
        where: { tenantId },
        data: {
          // decrement/increment: operadores de Prisma que restan/suman al valor
          // actual del campo (sin tener que leerlo antes).
          availableLicenses: { decrement: freeFromPool },
          billedEmployeeCount: { increment: count },
        },
      });
      return { clientSecret: null, charged: false, freeFromPool: count };
    }

    // Calculamos los meses que faltan hasta el fin del periodo anual.
    const periodEnd = sub.annualPeriodEnd || new Date();
    // Math.max(1, ...) asegura al menos 1 mes. Math.ceil redondea hacia arriba.
    // La división convierte la diferencia en ms a "meses" (30.44 = días promedio/mes).
    const monthsLeft = Math.max(1, Math.ceil(
      (periodEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30.44)
    ));
    // Precio por licencia = $8.50/mes (ya con 15% dto) × meses restantes, en centavos.
    const pricePerLicense = Math.round(8.5 * monthsLeft * 100); // $8.50/month with 15% discount
    const totalAmount = pricePerLicense * toCharge;

    const customerId = await this.getOrCreateCustomer(tenantId);
    // Cobro único por las licencias a cobrar. String(...) convierte números a
    // texto porque metadata solo admite valores de tipo string.
    const pi = await this.stripe.paymentIntents.create({
      amount: totalAmount,
      // Montos en MXN (el campo se llama *Usd por legado).
      currency: 'mxn',
      customer: customerId,
      metadata: { tenantId, type: 'add_licenses', count: String(toCharge), freeFromPool: String(freeFromPool) },
      description: `${toCharge} licencia(s) adicional(es) — ${monthsLeft} mes(es) restantes`,
    });

    return {
      clientSecret: pi.client_secret,
      charged: true,
      toCharge,
      freeFromPool,
      monthsLeft,
      amountUsd: totalAmount / 100, // de vuelta a unidades para mostrar.
    };
  }

  // confirmLicenseAddition(): tras pagar las licencias, actualiza la DB: descuenta
  // las gratis de la bolsa y suma todas (cobradas + gratis) al conteo facturado.
  async confirmLicenseAddition(tenantId: string, toCharge: number, freeFromPool: number) {
    await this.prisma.subscription.update({
      where: { tenantId },
      data: {
        availableLicenses: { decrement: freeFromPool },
        billedEmployeeCount: { increment: toCharge + freeFromPool },
        lastPaymentDate: new Date(),
      },
    });
  }

  // createBillingPortalSession(): genera un enlace al PORTAL DE FACTURACIÓN de
  // Stripe (página hospedada donde el negocio gestiona tarjeta, facturas, etc.).
  async createBillingPortalSession(tenantId: string, returnUrl: string) {
    const customerId = await this.getOrCreateCustomer(tenantId);
    const session = await this.stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
    return { url: session.url };
  }

  // getSubscriptionPreview(): calcula el resumen de cobro SIN cobrar nada.
  // En el modelo plano, el monto depende solo del tipo de cuenta.
  async getSubscriptionPreview(tenantId: string) {
    // Modelo flat: precio fijo segun tenantType, sin cargo por empleado.
    //  - FREELANCER (independiente, plan Pro):  $300 MXN/mes
    //  - BUSINESS  (empresa, plan Plus):       $500 MXN/mes
    // El conteo de empleados se mantiene como dato informativo pero ya no
    // afecta el monto del cobro.
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { tenantType: true },
    });
    // count() cuenta cuántos empleados ACTIVOS tiene el negocio (dato informativo).
    const activeEmployeeCount = await this.prisma.employee.count({
      where: { tenantId, isActive: true },
    });
    // Monto plano según tipo: 300 freelancer (Pro), 500 negocio (Plus).
    const totalMonthly = tenant?.tenantType === 'FREELANCER' ? 300 : 500;
    return {
      activeEmployeeCount,
      baseAmount: totalMonthly,
      employeeAmount: 0, // siempre 0: ya no se cobra por empleado.
      totalMonthly,
    };
  }

  /**
   * Cambia un tenant FREELANCER a BUSINESS (Pro -> Plus).
   * - En produccion (Stripe configurado): genera payment intent para el
   *   prorrateo del primer cobro y devuelve clientSecret.
   * - En local/dev (sin Stripe): solo actualiza tenantType + subscription
   *   en DB y devuelve { changed: true } sin clientSecret.
   *
   * No reduce de BUSINESS a FREELANCER. No es idempotente: si ya es
   * BUSINESS, lanza BadRequest.
   */
  async upgradeToPlus(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, tenantType: true },
    });
    if (!tenant) throw new NotFoundException('Tenant no encontrado');
    // Si ya es BUSINESS, no hay nada que subir (no es idempotente: lanza error).
    if (tenant.tenantType === 'BUSINESS') {
      throw new BadRequestException('Tu cuenta ya esta en el plan Plus.');
    }

    const sub = await this.prisma.subscription.findUnique({ where: { tenantId } });
    if (!sub) throw new NotFoundException('Suscripcion no encontrada');

    const newMonthly = 500; // mensualidad del plan Plus.
    const newAnnual = Math.round(newMonthly * 12 * 0.85); // anual con 15% dto.
    // isAnnual: ¿el negocio está en plan anual? (para calcular el monto correcto).
    const isAnnual = sub.planInterval === 'ANNUAL';

    // Si Stripe esta configurado y hay subscription activa de Stripe,
    // intentamos prorratear ($500-$300=$200 al mes hasta fin de periodo).
    // En este flow inicial nos limitamos a actualizar DB y dejar que el
    // proximo ciclo cobre el monto nuevo. El upgrade con cobro inmediato
    // queda como mejora futura.
    // Cambiamos el tipo de cuenta del negocio a BUSINESS.
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { tenantType: 'BUSINESS' },
    });

    // Actualizamos los montos del plan en la suscripción (DB). El ternario elige
    // el monto correcto según sea anual o mensual.
    await this.prisma.subscription.update({
      where: { tenantId },
      data: {
        plan: 'PLUS',
        monthlyAmountUsd: isAnnual ? newAnnual / 12 : newMonthly,
        baseMonthlyUsd: newMonthly,
        perEmployeeUsd: 0,
        // Si es anual usa el nuevo anual; si no, conserva el valor previo.
        annualAmountUsd: isAnnual ? newAnnual : sub.annualAmountUsd,
      },
    });

    // Cambiar el precio en la suscripción de Stripe (PRO → PLUS) para que el
    // próximo cobro sea $500 y no siga en $300. Prorratea hasta fin de periodo.
    if (sub.stripeSubscriptionId) {
      const plusPrice = process.env.STRIPE_PRICE_PLUS || process.env.STRIPE_PLATFORM_PRICE_ID;
      if (plusPrice) {
        try {
          const stripeSub = await this.stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
          // items.data[0] = el primer (y único) ítem de la suscripción. "?." evita
          // error si no hubiera ítems; tomamos su id para poder reemplazar su price.
          const itemId = stripeSub.items.data[0]?.id;
          if (itemId) {
            await this.stripe.subscriptions.update(sub.stripeSubscriptionId, {
              items: [{ id: itemId, price: plusPrice, quantity: 1 }],
              // CONCEPTO "proration": al cambiar de precio a mitad de periodo,
              // Stripe calcula la diferencia proporcional (lo ya pagado vs lo
              // nuevo) y la ajusta en la próxima factura. 'create_prorations'
              // genera esos ajustes automáticamente.
              proration_behavior: 'create_prorations',
            });
          }
        } catch (_) { /* si Stripe falla, la BD ya quedó en PLUS; se reconcilia al renovar */ }
      }
    }

    return {
      changed: true,
      newMonthly,
      newAnnual,
      message: 'Tu cuenta cambio al plan Plus. El nuevo monto aplica desde el proximo cobro.',
    };
  }

  // ─── SUBSCRIPTION WEBHOOK HANDLERS ──────────────────
  // Estos métodos los dispara el webhook cuando Stripe nos avisa de cambios en
  // la suscripción o sus facturas. Mantienen NUESTRA base de datos sincronizada
  // con lo que Stripe considera la verdad.

  // handleSubscriptionUpdated(): la suscripción cambió de estado en Stripe.
  async handleSubscriptionUpdated(subscription: Stripe.Subscription) {
    // Recuperamos el tenantId que guardamos en metadata al crear la suscripción.
    const tenantId = subscription.metadata?.tenantId;
    if (!tenantId) return; // sin tenant asociado, no podemos hacer nada.

    // "Diccionario" que traduce los estados de Stripe a NUESTROS estados internos.
    const statusMap: Record<string, string> = {
      active: 'ACTIVE',
      past_due: 'PAST_DUE',   // pago vencido.
      canceled: 'CANCELLED',
      unpaid: 'PAST_DUE',
      trialing: 'ACTIVE',     // en periodo de prueba (lo tratamos como activo).
    };

    // Buscamos la traducción. "|| 'PAST_DUE'" => si el estado no está en el mapa,
    // asumimos PAST_DUE por seguridad (mejor restringir acceso que regalarlo).
    const newStatus = statusMap[subscription.status] || 'PAST_DUE';
    // Fin del periodo actual (segundos UNIX → ms con × 1000).
    const currentPeriodEnd = new Date((subscription as any).current_period_end * 1000);

    await this.prisma.subscription.update({
      where: { tenantId },
      data: {
        status: newStatus as any, // "as any" para encajar con el enum de Prisma.
        nextBillingDate: currentPeriodEnd,
        contractEndDate: currentPeriodEnd,
      },
    });
  }

  // handleSubscriptionDeleted(): la suscripción se eliminó del todo en Stripe.
  async handleSubscriptionDeleted(subscription: Stripe.Subscription) {
    const tenantId = subscription.metadata?.tenantId;
    if (!tenantId) return;

    await this.prisma.subscription.update({
      where: { tenantId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        stripeSubscriptionId: null, // limpiamos la referencia ya inexistente.
      },
    });
  }

  // handleInvoicePaid(): se pagó una factura de la suscripción. Marcamos la
  // suscripción ACTIVE y guardamos un registro de la factura en nuestra DB.
  async handleInvoicePaid(invoice: Stripe.Invoice) {
    // El "customer" puede venir como id (texto) o como objeto: el ternario saca el id.
    const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
    if (!customerId) return;

    // Buscamos NUESTRA suscripción por el customer de Stripe.
    const sub = await this.prisma.subscription.findFirst({
      where: { stripeCustomerId: customerId },
    });
    if (!sub) return;

    await this.prisma.subscription.update({
      where: { id: sub.id },
      data: { status: 'ACTIVE', lastPaymentDate: new Date() },
    });

    // Monto pagado a unidades (centavos ÷ 100).
    const amount = invoice.amount_paid / 100;
    // Creamos el registro de factura en nuestra DB.
    await this.prisma.invoice.create({
      data: {
        subscriptionId: sub.id,
        tenantId: sub.tenantId,
        // Número de factura único usando el timestamp actual (`INV-<ms>`).
        invoiceNumber: `INV-${Date.now()}`,
        amountUsd: amount,
        baseAmount: 10,            // (campos heredados del modelo anterior por asiento)
        employeeAmount: amount - 10,
        employeeCount: sub.billedEmployeeCount,
        status: 'PAID',
        // Fechas del periodo facturado (segundos UNIX → ms).
        periodStart: new Date((invoice as any).period_start * 1000),
        periodEnd: new Date((invoice as any).period_end * 1000),
        dueDate: new Date((invoice as any).period_end * 1000),
        paidAt: new Date(),
        stripeInvoiceId: invoice.id,
      },
    });
  }

  // createSetupIntent(): crea un "SetupIntent" para GUARDAR una tarjeta sin
  // cobrar todavía (para usarla luego en cobros automáticos). Devuelve el
  // clientSecret que el frontend usa con Stripe Elements para capturarla.
  async createSetupIntent(tenantId: string) {
    const customerId = await this.getOrCreateCustomer(tenantId);

    const setupIntent = await this.stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'], // solo tarjetas.
      // 'off_session' = la tarjeta podrá usarse en cobros futuros automáticos
      // (cuando el cliente NO esté presente confirmando).
      usage: 'off_session',
      metadata: { tenantId },
    });

    // Mark the card as default payment method on the subscription after setup
    return { clientSecret: setupIntent.client_secret };
  }

  // attachDefaultPaymentMethod(): asocia una tarjeta (ya capturada) al customer
  // y la deja como método de pago POR DEFECTO (en el customer y, si existe, en
  // la suscripción) para que los cobros recurrentes usen esa tarjeta.
  async attachDefaultPaymentMethod(tenantId: string, paymentMethodId: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { tenantId } });
    // Sin customer de Stripe no hay a quién asociar la tarjeta → salimos.
    if (!sub?.stripeCustomerId) return;

    // 1) Adjuntamos el método de pago al customer.
    await this.stripe.paymentMethods.attach(paymentMethodId, {
      customer: sub.stripeCustomerId,
    });

    // 2) Lo marcamos como predeterminado para las FACTURAS del customer.
    await this.stripe.customers.update(sub.stripeCustomerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });

    // 3) Si ya hay una suscripción, también lo fijamos como su método por defecto.
    if (sub.stripeSubscriptionId) {
      await this.stripe.subscriptions.update(sub.stripeSubscriptionId, {
        default_payment_method: paymentMethodId,
      });
    }
  }

  // handleInvoicePaymentFailed(): falló el cobro de una factura. Marcamos la
  // suscripción como PAST_DUE (vencida) y abrimos un PERIODO DE GRACIA de 7 días
  // antes de cortar el acceso, para dar margen a actualizar el pago.
  async handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
    const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
    if (!customerId) return;

    const sub = await this.prisma.subscription.findFirst({
      where: { stripeCustomerId: customerId },
    });
    if (!sub) return;

    // "Ahora" + 7 días (7 · 24h · 60min · 60s · 1000ms) = fin del periodo de gracia.
    const gracePeriodEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await this.prisma.subscription.update({
      where: { id: sub.id },
      data: { status: 'PAST_DUE', gracePeriodEndsAt },
    });
  }
}
