// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────
// De NestJS: Injectable (marca la clase como servicio inyectable) y Logger
// (para escribir mensajes en la consola del servidor).
import { Injectable, Logger } from '@nestjs/common';
// Resend es el SDK (librería oficial) del proveedor de email "Resend". Con él
// enviamos correos reales desde código, sin montar nuestro propio servidor SMTP.
import { Resend } from 'resend';
// Los contratos compartidos: forma de un mensaje y forma de un canal. Esta clase
// implementa NotificationChannel (promete tener el método send).
import { NotificationChannel, NotificationPayload } from './channel.interface';

@Injectable() // <- Servicio inyectable de NestJS.
// "implements NotificationChannel" = esta clase cumple el contrato del canal.
export class EmailChannel implements NotificationChannel {
  // Logger etiquetado con el nombre de la clase ("EmailChannel").
  private readonly logger = new Logger(EmailChannel.name);
  // resend: el cliente de Resend ya configurado, O null si no hay API key.
  // El tipo "Resend | null" significa "puede ser un Resend o puede ser null".
  private readonly resend: Resend | null;
  // fromAddress: el remitente que verá quien reciba el correo, en formato
  // 'Nombre <correo@dominio>'. Es un texto (string).
  private readonly fromAddress: string;

  // El constructor se ejecuta UNA vez, cuando NestJS crea este servicio. Aquí
  // leemos la configuración del entorno y preparamos el cliente de Resend.
  constructor() {
    // process.env.X lee una "variable de entorno" (configuración del servidor,
    // fuera del código). RESEND_API_KEY es la clave secreta para usar Resend.
    const apiKey = process.env.RESEND_API_KEY;
    // Correo remitente. El "||" es un valor por defecto: si RESEND_FROM_EMAIL
    // no está definida (es vacía/undefined), usamos 'noreply@siliba.com'.
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@siliba.com';
    // Nombre remitente, con el mismo patrón de valor por defecto ('Siliba').
    const fromName = process.env.RESEND_FROM_NAME || 'Siliba';
    // Combinamos nombre y correo en el formato estándar 'Nombre <correo>'.
    this.fromAddress = `${fromName} <${fromEmail}>`;

    // "!apiKey" se lee "si NO hay API key" (está vacía/undefined).
    if (!apiKey) {
      // Avisamos (warning) que, sin clave, los correos NO se enviarán de verdad:
      // solo se imprimirán en consola (modo de prueba / sandbox).
      this.logger.warn(
        'RESEND_API_KEY no configurada. Los emails se loguearan en consola en lugar de enviarse.',
      );
      // Dejamos resend en null para indicar "sin cliente real disponible".
      this.resend = null;
    } else {
      // Sí hay clave: creamos el cliente real de Resend con esa API key.
      this.resend = new Resend(apiKey);
    }
  }

  // send: envía un correo de verdad con Resend (o lo simula si no hay API key).
  //   - Recibe: payload (destinatario "to", asunto "subject", cuerpo "body").
  //   - Devuelve: una Promise que resuelve a { success, error? }.
  async send(
    payload: NotificationPayload,
  ): Promise<{ success: boolean; error?: string }> {
    // Sin API key configurada -> log en consola (modo dev / sandbox).
    // "!this.resend" se lee "si NO hay cliente Resend" (quedó en null arriba).
    if (!this.resend) {
      // "DRY-RUN" = ensayo en seco: mostramos el correo en consola pero sin
      // enviarlo. Útil para probar sin gastar envíos reales.
      this.logger.log(
        `\n====== EMAIL (DRY-RUN) ======\nTo: ${payload.to}\nSubject: ${payload.subject}\nBody:\n${payload.body}\n=============================\n`,
      );
      // Devolvemos éxito "simulado".
      return { success: true };
    }

    // Hay cliente real: intentamos el envío. "try" protege ante errores.
    try {
      // Llamamos a la API de Resend para enviar el email. Devuelve un objeto del
      // que extraemos, por desestructuración, "data" (info del envío correcto) y
      // "error" (detalle si algo salió mal).
      const { data, error } = await this.resend.emails.send({
        from: this.fromAddress, // remitente preparado en el constructor
        to: [payload.to], // Resend espera una LISTA de destinatarios; metemos uno.
        // Asunto: si payload.subject viene vacío, usamos '(sin asunto)' (el "||").
        subject: payload.subject || '(sin asunto)',
        // Soportamos plantillas HTML (con etiquetas) o texto plano.
        // Generamos las dos versiones del cuerpo: HTML y texto plano. Los
        // clientes de correo eligen cuál mostrar.
        html: this.toHtml(payload.body),
        text: this.toPlainText(payload.body),
      });

      // Resend NO lanza excepción en errores "de negocio": los devuelve en
      // "error". Si "error" tiene valor (es verdadero), hubo fallo.
      if (error) {
        this.logger.error(`Resend error: ${error.message}`);
        return { success: false, error: error.message };
      }

      // Envío correcto: registramos el id del correo. "data?.id" usa optional
      // chaining (?.): si data fuera null/undefined, da undefined en vez de
      // romper al intentar leer .id.
      this.logger.log(`Email enviado a ${payload.to} (id: ${data?.id})`);
      return { success: true };
    } catch (err: any) {
      // Aquí caen errores "duros" (red caída, excepción inesperada, etc.).
      this.logger.error(`Email send failed: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  // toHtml: convierte el cuerpo del mensaje a HTML para el correo.
  // "private" = solo se usa dentro de esta clase. Recibe el cuerpo y devuelve
  // un texto HTML.
  private toHtml(body: string): string {
    // Si ya viene HTML (contiene una etiqueta), lo dejamos tal cual.
    // /<[a-z][\s\S]*>/i es una expresión regular (un patrón de búsqueda):
    // busca un "<" seguido de una letra y luego cualquier cosa hasta un ">".
    // La "i" la hace insensible a mayúsculas/minúsculas. .test(body) devuelve
    // true si el patrón aparece en el texto. Si hay etiquetas, ya es HTML.
    if (/<[a-z][\s\S]*>/i.test(body)) return body;
    // Si es texto plano, lo "escapamos": convertimos caracteres especiales en
    // sus equivalentes seguros para HTML, para que no rompan el documento ni se
    // interpreten como etiquetas. replace(patrón, reemplazo) con la bandera /g
    // (global) cambia TODAS las apariciones, no solo la primera.
    const escaped = body
      .replace(/&/g, '&amp;') // & -> &amp;  (primero, para no re-escapar lo de abajo)
      .replace(/</g, '&lt;') // < -> &lt;   (evita abrir etiquetas falsas)
      .replace(/>/g, '&gt;') // > -> &gt;   (evita cerrar etiquetas falsas)
      .replace(/\n/g, '<br>'); // salto de línea -> <br> (salto visible en HTML)
    // Envolvemos el texto escapado en una plantilla HTML mínima con estilos
    // básicos (tipografía, color, ancho máximo y centrado). El "${escaped}"
    // inserta el contenido dentro del <body>.
    return `<!doctype html><html><body style="font-family: -apple-system, system-ui, sans-serif; color: #111; max-width: 560px; margin: 24px auto; padding: 0 16px;">${escaped}</body></html>`;
  }

  // toPlainText: genera la versión de SOLO texto del cuerpo (sin HTML), para los
  // clientes de correo que no muestran HTML. Recibe el cuerpo y devuelve texto.
  private toPlainText(body: string): string {
    // Strip etiquetas HTML para la version texto plano.
    // 1) /<[^>]+>/g elimina cualquier etiqueta HTML (todo lo que va entre "<" y
    //    ">"). [^>]+ significa "uno o más caracteres que NO sean '>'".
    // 2) /&nbsp;/g convierte el espacio especial HTML (&nbsp;) en un espacio normal.
    // 3) .trim() recorta los espacios sobrantes del principio y del final.
    return body.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
  }
}
