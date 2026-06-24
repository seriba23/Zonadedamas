// Plantillas HTML para emails de recuperacion/establecimiento de contrasena.
// Los previews estaticos viven en apps/api/email-templates/preview/*.html
// (no se sirven, solo para revision local). Mantener sincronizados al modificar.

// ── PALETA DE COLORES DE MARCA ──
// Constantes (const = no cambian) con los códigos de color de Siliba. Se usan
// dentro de los estilos CSS embebidos del HTML para no repetir el valor a mano.
const BRAND_TEAL = '#008080';        // verde azulado principal de la marca.
const BRAND_TEAL_LIGHT = '#e0f2f1';  // versión clara (fondos suaves).
const BRAND_TEAL_BORDER = '#b2dfdb'; // tono para bordes.
const BG = '#f5f7f8';                // color de fondo general del correo.
const TEXT_DARK = '#111827';         // texto principal (casi negro).
const TEXT_MUTED = '#6b7280';        // texto secundario (gris medio).
const TEXT_LIGHT = '#9ca3af';        // texto tenue (gris claro, pies de página).
const CARD_BORDER = '#e5e7eb';       // borde de la tarjeta blanca.
const DIVIDER = '#f3f4f6';           // línea divisoria.

// escapeHtml: convierte caracteres peligrosos en su "entidad HTML" segura, para
// evitar que un texto (ej. el nombre del usuario) rompa el HTML o inyecte código.
// Cada .replace(regex, reemplazo) cambia TODAS las apariciones (la "g" = global):
//   - & -> &amp;   < -> &lt;   > -> &gt;   " -> &quot;
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// shell(): construye el "cascarón" común a todos los correos (cabecera con el
// logo, pie de página, etc.) y mete dentro el cuerpo concreto (bodyHtml).
// Recibe un objeto con: title (título de la pestaña), preheader (texto preview)
// y bodyHtml (el contenido propio de cada email). Devuelve el HTML completo.
function shell(opts: { title: string; preheader: string; bodyHtml: string }): string {
  // El preheader es el texto que algunos clientes muestran como preview en la
  // bandeja, justo despues del subject.
  // Usamos un "template literal" (texto entre comillas invertidas ``) que permite
  // insertar valores con ${...}. Aquí escapamos textos del usuario e insertamos
  // los colores de marca dentro de los estilos CSS.
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(opts.title)}</title>
</head>
<body style="margin:0;padding:0;background-color:${BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:${BG};opacity:0;">
    ${escapeHtml(opts.preheader)}
  </div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${BG};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px;width:100%;background-color:#ffffff;border-radius:16px;border:1px solid ${CARD_BORDER};overflow:hidden;">
          <tr>
            <td style="background-color:${BRAND_TEAL};padding:24px 32px;text-align:center;">
              <div style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">Siliba</div>
              <div style="font-size:12px;color:rgba(255,255,255,0.85);margin-top:4px;">Tu confianza, en manos de profesionales</div>
            </td>
          </tr>
          ${opts.bodyHtml}
          <tr>
            <td style="padding:0 32px;">
              <div style="height:1px;background-color:${DIVIDER};"></div>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;text-align:center;">
              <p style="margin:0;font-size:11px;line-height:1.6;color:${TEXT_LIGHT};">
                ¿Necesitas ayuda? Escríbenos a
                <a href="mailto:soporte@siliba.com" style="color:${BRAND_TEAL};text-decoration:none;font-weight:500;">soporte@siliba.com</a>
              </p>
            </td>
          </tr>
        </table>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px;width:100%;margin-top:20px;">
          <tr>
            <td style="text-align:center;">
              <p style="margin:0;font-size:11px;color:${TEXT_LIGHT};line-height:1.6;">
                © ${new Date().getFullYear()} Siliba. Todos los derechos reservados.<br>
                Guadalajara, México · <a href="https://siliba.com" style="color:${TEXT_LIGHT};text-decoration:underline;">siliba.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// codeBlock(): genera el bloque visual que muestra el código de 6 dígitos
// resaltado (con su recuadro teal) y debajo una etiqueta de expiración.
// Recibe el código y el texto de caducidad; devuelve un fragmento HTML.
function codeBlock(code: string, expirationLabel: string): string {
  return `
  <tr>
    <td align="center" style="padding:24px 32px;">
      <div style="display:inline-block;background-color:${BRAND_TEAL_LIGHT};border:1px solid ${BRAND_TEAL_BORDER};border-radius:12px;padding:18px 32px;">
        <div style="font-family:'SF Mono',Menlo,Consolas,monospace;font-size:32px;font-weight:700;color:${BRAND_TEAL};letter-spacing:0.5em;padding-left:0.5em;">
          ${escapeHtml(code)}
        </div>
      </div>
      <div style="margin-top:10px;font-size:12px;color:${TEXT_LIGHT};">
        ${escapeHtml(expirationLabel)}
      </div>
    </td>
  </tr>`;
}

// renderPasswordResetEmail(): arma el correo de RESTABLECER contraseña (cuenta
// que YA tiene contraseña y la olvidó). Recibe el nombre y el código; devuelve el
// HTML final listo para enviar.
export function renderPasswordResetEmail(params: {
  firstName: string;
  code: string;
}): string {
  // safeName = nombre del usuario ya "escapado" para que sea seguro en el HTML.
  // "params.firstName || 'Hola'": si no hubiera nombre, usamos "Hola" como saludo.
  const safeName = escapeHtml(params.firstName || 'Hola');
  // body = el cuerpo HTML específico de este correo (título, saludo y, mediante
  // codeBlock, el código). Se inserta luego dentro de shell().
  const body = `
  <tr>
    <td style="padding:40px 32px 8px 32px;text-align:center;">
      <h1 style="margin:0 0 10px 0;font-size:22px;line-height:1.3;color:${TEXT_DARK};font-weight:700;letter-spacing:-0.01em;">Restablece tu contraseña</h1>
      <p style="margin:0;font-size:14px;line-height:1.6;color:${TEXT_MUTED};">
        Hola <strong style="color:${TEXT_DARK};">${safeName}</strong>,<br>
        Usa el siguiente código para continuar con el proceso. Expira en 15 minutos.
      </p>
    </td>
  </tr>
  ${codeBlock(params.code, 'Este código es de un solo uso')}
  <tr>
    <td style="padding:8px 32px 32px 32px;">
      <p style="margin:0;font-size:13px;line-height:1.6;color:${TEXT_MUTED};text-align:center;">
        Si no solicitaste este cambio, ignora este mensaje.<br>
        Tu contraseña actual seguirá funcionando.
      </p>
    </td>
  </tr>`;

  // Envolvemos el cuerpo en el cascarón común y devolvemos el HTML completo.
  return shell({
    title: 'Restablece tu contraseña - Siliba',
    preheader: `Tu código de Siliba es ${params.code}. Expira en 15 minutos.`,
    bodyHtml: body,
  });
}

// renderPasswordSetOAuthEmail(): arma el correo para ESTABLECER contraseña por
// primera vez, en cuentas creadas con login social (Google/Facebook) que aún no
// tienen contraseña propia. Recibe nombre, código y el proveedor usado.
export function renderPasswordSetOAuthEmail(params: {
  firstName: string;
  code: string;
  provider: 'google' | 'facebook' | string | null;
}): string {
  // Nombre saneado para HTML (o "Hola" si falta).
  const safeName = escapeHtml(params.firstName || 'Hola');
  // providerLabel = nombre "bonito" del proveedor a mostrar al usuario. Es un
  // ternario ANIDADO (un "if/else" en cadena):
  //   si provider === 'google'  -> 'Google'
  //   si no, si === 'facebook'  -> 'Facebook'
  //   en cualquier otro caso    -> 'una red social'
  const providerLabel =
    params.provider === 'google'
      ? 'Google'
      : params.provider === 'facebook'
        ? 'Facebook'
        : 'una red social';

  const body = `
  <tr>
    <td style="padding:40px 32px 8px 32px;text-align:center;">
      <h1 style="margin:0 0 10px 0;font-size:22px;line-height:1.3;color:${TEXT_DARK};font-weight:700;letter-spacing:-0.01em;">Establece tu contraseña</h1>
      <p style="margin:0;font-size:14px;line-height:1.6;color:${TEXT_MUTED};">
        Hola <strong style="color:${TEXT_DARK};">${safeName}</strong>,<br>
        Tu cuenta de Siliba fue creada con <strong style="color:${TEXT_DARK};">${providerLabel}</strong>. Usa este código para establecer una contraseña y poder iniciar sesión también con tu correo.
      </p>
    </td>
  </tr>
  ${codeBlock(params.code, 'Expira en 15 minutos · Un solo uso')}
  <tr>
    <td style="padding:0 32px 8px 32px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f9fafb;border:1px solid ${DIVIDER};border-radius:10px;">
        <tr>
          <td style="padding:12px 14px;font-size:12px;line-height:1.5;color:${TEXT_MUTED};">
            <strong style="color:${TEXT_DARK};">¿Y mi acceso con ${providerLabel}?</strong><br>
            Seguirás pudiendo entrar con ${providerLabel} normalmente. Esto solo añade un método adicional para iniciar sesión.
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="padding:8px 32px 32px 32px;">
      <p style="margin:0;font-size:13px;line-height:1.6;color:${TEXT_MUTED};text-align:center;">
        Si no solicitaste este cambio, ignora este mensaje.
      </p>
    </td>
  </tr>`;

  // Envolvemos el cuerpo en el cascarón común y devolvemos el HTML completo.
  return shell({
    title: 'Establece tu contraseña - Siliba',
    preheader: `Establece tu contraseña de Siliba. Tu código es ${params.code}.`,
    bodyHtml: body,
  });
}
