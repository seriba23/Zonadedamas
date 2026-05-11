// Plantillas HTML para emails de recuperacion/establecimiento de contrasena.
// Los previews estaticos viven en apps/api/email-templates/preview/*.html
// (no se sirven, solo para revision local). Mantener sincronizados al modificar.

const BRAND_TEAL = '#008080';
const BRAND_TEAL_LIGHT = '#e0f2f1';
const BRAND_TEAL_BORDER = '#b2dfdb';
const BG = '#f5f7f8';
const TEXT_DARK = '#111827';
const TEXT_MUTED = '#6b7280';
const TEXT_LIGHT = '#9ca3af';
const CARD_BORDER = '#e5e7eb';
const DIVIDER = '#f3f4f6';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function shell(opts: { title: string; preheader: string; bodyHtml: string }): string {
  // El preheader es el texto que algunos clientes muestran como preview en la
  // bandeja, justo despues del subject.
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

export function renderPasswordResetEmail(params: {
  firstName: string;
  code: string;
}): string {
  const safeName = escapeHtml(params.firstName || 'Hola');
  const body = `
  <tr>
    <td align="center" style="padding:32px 32px 0 32px;">
      <div style="width:64px;height:64px;border-radius:50%;background-color:${BRAND_TEAL_LIGHT};display:inline-block;line-height:64px;text-align:center;">
        <span style="font-size:28px;line-height:64px;vertical-align:middle;">🔐</span>
      </div>
    </td>
  </tr>
  <tr>
    <td style="padding:24px 32px 8px 32px;text-align:center;">
      <h1 style="margin:0 0 8px 0;font-size:22px;line-height:1.3;color:${TEXT_DARK};font-weight:700;letter-spacing:-0.01em;">Restablece tu contraseña</h1>
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

  return shell({
    title: 'Restablece tu contraseña - Siliba',
    preheader: `Tu código de Siliba es ${params.code}. Expira en 15 minutos.`,
    bodyHtml: body,
  });
}

export function renderPasswordSetOAuthEmail(params: {
  firstName: string;
  code: string;
  provider: 'google' | 'facebook' | string | null;
}): string {
  const safeName = escapeHtml(params.firstName || 'Hola');
  const providerLabel =
    params.provider === 'google'
      ? 'Google'
      : params.provider === 'facebook'
        ? 'Facebook'
        : 'una red social';

  const body = `
  <tr>
    <td align="center" style="padding:32px 32px 0 32px;">
      <div style="width:64px;height:64px;border-radius:50%;background-color:${BRAND_TEAL_LIGHT};display:inline-block;line-height:64px;text-align:center;">
        <span style="font-size:28px;line-height:64px;vertical-align:middle;">🔑</span>
      </div>
    </td>
  </tr>
  <tr>
    <td style="padding:24px 32px 8px 32px;text-align:center;">
      <h1 style="margin:0 0 8px 0;font-size:22px;line-height:1.3;color:${TEXT_DARK};font-weight:700;letter-spacing:-0.01em;">Establece tu contraseña</h1>
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

  return shell({
    title: 'Establece tu contraseña - Siliba',
    preheader: `Establece tu contraseña de Siliba. Tu código es ${params.code}.`,
    bodyHtml: body,
  });
}
