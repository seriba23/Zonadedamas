// Componente de cliente: genera URLs externas (WhatsApp) y renderiza enlaces <a>.
'use client';

// Importamos la función buildWhatsAppUrl de nuestra librería interna.
// Esta función toma el teléfono y el mensaje y devuelve una URL de WhatsApp
// con el formato: https://wa.me/521234567890?text=Hola%20...
// Si el teléfono es inválido o null, devuelve null.
import { buildWhatsAppUrl } from '@/lib/whatsapp';

// ─── Props del componente ────────────────────────────────────────────────────
interface Props {
  // Número de teléfono del negocio. Puede ser null o undefined si no está configurado.
  // El tipo "string | null | undefined" cubre todos los casos posibles.
  phone: string | null | undefined;

  // Texto del mensaje preescrito que se abrirá en WhatsApp.
  // Ejemplo: "Hola, quiero agendar una cita para mañana".
  message: string;

  // Texto del botón (solo en variante 'pill'). Por defecto: 'WhatsApp'.
  label?: string;

  // Variante visual del botón:
  // - 'pill': botón con texto e ícono (para usar en tarjetas o páginas de detalle).
  // - 'icon-only': solo el ícono circular (para espacios reducidos).
  variant?: 'pill' | 'icon-only';

  // Clases CSS adicionales opcionales.
  className?: string;
}

/**
 * Abre WhatsApp con un mensaje preescrito al negocio. Renderiza null si
 * el negocio no tiene businessPhone configurado.
 */
// Desestructuramos las props con valores por defecto para label y variant.
export function WhatsAppButton({ phone, message, label = 'WhatsApp', variant = 'pill', className = '' }: Props) {
  // Construimos la URL de WhatsApp usando la función de utilidad.
  // Si phone es null/undefined/vacío, buildWhatsAppUrl devuelve null.
  const url = buildWhatsAppUrl(phone, message);

  // Si no hay URL (el negocio no tiene teléfono configurado), no renderizamos nada.
  // Devolver null en React significa "no renderizar este componente".
  if (!url) return null;

  // Renderizado condicional según la variante:
  // Si variant === 'icon-only', devolvemos el botón solo con ícono.
  // De lo contrario (variant === 'pill'), seguimos y devolvemos la píldora.
  if (variant === 'icon-only') {
    return (
      // <a> es un enlace HTML. href apunta a la URL de WhatsApp.
      // target="_blank": abre WhatsApp en una nueva pestaña o en la app de WhatsApp.
      // rel="noopener noreferrer": seguridad — evita que la nueva página pueda
      //   acceder a nuestra página a través de window.opener. Buena práctica siempre
      //   que se use target="_blank".
      // title: tooltip con el texto del label (accesibilidad).
      // Color de fondo #25D366: el verde oficial de WhatsApp.
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        title={label}
        className={`inline-flex items-center justify-center w-8 h-8 rounded-full bg-[#25D366] hover:bg-[#1ebe5d] text-white transition-colors ${className}`}
      >
        {/* Logo de WhatsApp en SVG: el ícono oficial del teléfono con burbuja de chat.
            El path largo describe la forma del ícono en coordenadas vectoriales.
            fill="currentColor": usa el color del texto (text-white del padre = blanco). */}
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
        </svg>
      </a>
    );
  }

  // Variante 'pill': botón con ícono pequeño + texto (el label).
  // rounded-full: bordes completamente redondeados (cápsula/píldora).
  // gap-1.5: espacio de 6px entre el ícono y el texto.
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#25D366] hover:bg-[#1ebe5d] text-white text-[11px] font-medium transition-colors ${className}`}
    >
      {/* Logo de WhatsApp (versión más pequeña: w-3.5 h-3.5 = 14px) */}
      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
      </svg>
      {/* {label} se interpola directamente como texto. Por defecto es 'WhatsApp'. */}
      {label}
    </a>
  );
}
