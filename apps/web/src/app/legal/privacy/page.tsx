// ─────────────────────────────────────────────────────────────────────────────
// apps/web/src/app/legal/privacy/page.tsx
//
// CONCEPTO: Página del Aviso de Privacidad de Siliba.
// URL: /legal/privacy
//
// Página ESTÁTICA de contenido legal. No hace llamadas a la API ni maneja
// estado complejo. Solo muestra el texto del aviso de privacidad conforme
// a la LFPDPPP (Ley Federal de Protección de Datos Personales en Posesión
// de los Particulares) de México.
//
// Es un Client Component ('use client') ÚNICAMENTE porque usa useRouter()
// para el botón "Volver" (router.back()). Si no necesitara ese botón,
// podría ser un Server Component puro.
//
// Esta página también se carga dentro de un <iframe> en el modal de T&C
// del flujo de registro (register/page.tsx) para que el usuario pueda leer
// el aviso sin salir del formulario de registro.
// ─────────────────────────────────────────────────────────────────────────────
'use client';

import { useRouter } from 'next/navigation';

const TEAL = '#008080';

export default function PrivacyPolicyPage() {
  const router = useRouter();

  return (
    // "safe-top": clase personalizada de Tailwind que agrega padding-top
    // igual al safe-area-inset-top del dispositivo (el "notch" del iPhone).
    <div className="min-h-screen bg-gray-50 safe-top">


      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          {/* router.back(): navega a la página anterior del historial del navegador.
              Es equivalente al botón "Atrás" del navegador. */}
          <button
            onClick={() => router.back()}
            className="w-9 h-9 rounded-full flex items-center justify-center bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <h1 className="text-lg font-bold text-gray-900">Aviso de Privacidad</h1>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="prose prose-sm max-w-none text-gray-700 space-y-5">
            <div className="text-center mb-6">
              <h2 className="text-base font-bold text-gray-900 mb-1">Siliba</h2>
              <p className="text-sm font-semibold text-gray-700">Aviso de Privacidad Integral</p>
              <p className="text-xs text-gray-400 mt-1">Última actualización: 10 de marzo de 2026</p>
              <p className="text-xs text-gray-400 italic">
                Conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP) y su Reglamento
              </p>
            </div>

            {/* I */}
            <div>
              <h3 className="text-sm font-bold text-gray-900 mb-2">I. Identidad y Domicilio del Responsable</h3>
              <p className="text-sm leading-relaxed">
                Siliba (en adelante &quot;el Responsable&quot;), persona física con actividad empresarial, con domicilio en la
                Ciudad de Guadalajara, Jalisco, México, es el responsable del tratamiento de sus datos personales de conformidad
                con la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (en adelante &quot;la Ley&quot;) y su Reglamento.
              </p>
              <p className="text-sm leading-relaxed mt-2">
                Para cualquier asunto relacionado con el presente Aviso de Privacidad, puede contactarnos a través de:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                <li>
                  Correo electrónico:{' '}
                  <a href="mailto:privacidad@siliba.com" className="font-medium" style={{ color: TEAL }}>
                    privacidad@siliba.com
                  </a>
                </li>
                <li>Plataforma: a través de la sección de Ayuda y Privacidad dentro de la aplicación.</li>
              </ul>
            </div>

            {/* II */}
            <div>
              <h3 className="text-sm font-bold text-gray-900 mb-2">II. Datos Personales que se Recaban</h3>
              <p className="text-sm leading-relaxed mb-2">
                El Responsable recaba las siguientes categorías de datos personales según el perfil del usuario:
              </p>

              <h4 className="text-sm font-semibold text-gray-800 mt-3 mb-1">A. Clientes</h4>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                <li><strong>Datos de identificación:</strong> nombre completo, fecha de nacimiento, fotografía de perfil.</li>
                <li><strong>Datos de contacto:</strong> correo electrónico, número de teléfono móvil.</li>
                <li><strong>Datos de uso del servicio:</strong> historial de citas, servicios agendados, calificaciones y reseñas, preferencias de servicio.</li>
                <li><strong>Datos de ubicación:</strong> geolocalización aproximada para mostrar negocios cercanos (solo con consentimiento expreso).</li>
                <li><strong>Datos técnicos:</strong> identificador del dispositivo, sistema operativo, dirección IP, datos de uso de la aplicación.</li>
              </ul>

              <h4 className="text-sm font-semibold text-gray-800 mt-3 mb-1">B. Profesionales de Servicio</h4>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                <li><strong>Datos de identificación:</strong> nombre completo, fotografía de perfil, especialidades y certificaciones.</li>
                <li><strong>Datos de contacto:</strong> correo electrónico, número de teléfono.</li>
                <li><strong>Datos laborales:</strong> horarios de trabajo, servicios ofrecidos, historial de atenciones, calificaciones recibidas.</li>
                <li><strong>Datos técnicos:</strong> identificador del dispositivo, sistema operativo, dirección IP.</li>
              </ul>

              <h4 className="text-sm font-semibold text-gray-800 mt-3 mb-1">C. Gerentes / Administradores de Negocio</h4>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                <li><strong>Datos de identificación:</strong> nombre completo, cargo dentro del negocio.</li>
                <li><strong>Datos de contacto:</strong> correo electrónico corporativo, número de teléfono.</li>
                <li><strong>Datos del negocio:</strong> nombre comercial, domicilio(s) de sucursales, RFC (para facturación), información bancaria para cobros de licencia.</li>
                <li><strong>Datos técnicos:</strong> identificador del dispositivo, sistema operativo, dirección IP.</li>
              </ul>

              <p className="text-sm leading-relaxed mt-3 p-3 bg-gray-50 rounded-lg">
                El Responsable <strong>NO</strong> recaba datos personales sensibles (estado de salud, origen étnico, creencias religiosas,
                preferencia sexual, datos genéticos, biométricos o financieros más allá de los estrictamente necesarios para la facturación).
              </p>
            </div>

            {/* III */}
            <div>
              <h3 className="text-sm font-bold text-gray-900 mb-2">III. Finalidades del Tratamiento</h3>

              <h4 className="text-sm font-semibold text-gray-800 mt-2 mb-1">Finalidades primarias (necesarias para la prestación del servicio)</h4>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                <li>Crear, gestionar y mantener activa la cuenta del usuario en la plataforma.</li>
                <li>Permitir la búsqueda, visualización y reservación de servicios de belleza y cuidado personal.</li>
                <li>Gestionar la agenda de citas entre clientes y profesionales de servicio.</li>
                <li>Enviar notificaciones relacionadas con sus citas (confirmaciones, recordatorios, cancelaciones).</li>
                <li>Procesar y registrar el pago o cobro de los servicios de licenciamiento contratados.</li>
                <li>Brindar soporte técnico y atención a reportes o incidencias.</li>
                <li>Cumplir con obligaciones legales y fiscales aplicables.</li>
              </ul>

              <h4 className="text-sm font-semibold text-gray-800 mt-3 mb-1">Finalidades secundarias (opcionales, requieren consentimiento)</h4>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                <li>Enviar comunicaciones de marketing, promociones y novedades de la plataforma o de negocios aliados.</li>
                <li>Realizar estudios estadísticos y análisis de comportamiento para mejorar la plataforma.</li>
                <li>Compartir reseñas y calificaciones públicas dentro de la plataforma con fines de reputación.</li>
              </ul>

              <p className="text-sm leading-relaxed mt-2">
                Si no desea que sus datos sean tratados para las finalidades secundarias, puede manifestarlo en cualquier momento
                a través del correo electrónico de contacto o desde la configuración de privacidad dentro de la aplicación.
              </p>
            </div>

            {/* IV */}
            <div>
              <h3 className="text-sm font-bold text-gray-900 mb-2">IV. Transferencias de Datos Personales</h3>
              <p className="text-sm leading-relaxed mb-2">
                El Responsable podrá transferir sus datos personales a terceros en los siguientes supuestos:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                <li>
                  A proveedores de servicios tecnológicos (alojamiento en nube, procesamiento de pagos, servicios de notificaciones push)
                  que actúen como encargados del tratamiento, bajo contratos de confidencialidad y con niveles de protección equivalentes
                  a los establecidos en la Ley.
                </li>
                <li>A autoridades competentes cuando sea requerido por disposición legal o resolución judicial.</li>
                <li>
                  A los negocios registrados en la plataforma, únicamente los datos necesarios para la prestación del servicio agendado
                  (nombre del cliente y datos de contacto básicos).
                </li>
              </ul>
              <p className="text-sm leading-relaxed mt-2">
                El Responsable <strong>no vende, cede ni comercializa</strong> sus datos personales a terceros con fines publicitarios propios de esos terceros.
              </p>
            </div>

            {/* V */}
            <div>
              <h3 className="text-sm font-bold text-gray-900 mb-2">V. Derechos ARCO</h3>
              <p className="text-sm leading-relaxed mb-2">
                Como titular de sus datos personales, usted tiene los siguientes derechos:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                <li><strong>Acceso:</strong> Conocer qué datos personales tenemos de usted y cómo los usamos.</li>
                <li><strong>Rectificación:</strong> Solicitar la corrección de sus datos cuando sean inexactos o incompletos.</li>
                <li><strong>Cancelación:</strong> Solicitar la eliminación de sus datos de nuestros registros.</li>
                <li><strong>Oposición:</strong> Oponerse al tratamiento de sus datos para finalidades específicas.</li>
              </ul>
              <p className="text-sm leading-relaxed mt-2">
                Para ejercer cualquiera de estos derechos, envíe una solicitud al correo{' '}
                <a href="mailto:privacidad@siliba.com" className="font-medium" style={{ color: TEAL }}>
                  privacidad@siliba.com
                </a>{' '}
                con: (i) nombre completo y datos de contacto; (ii) descripción clara del derecho que desea ejercer;
                (iii) copia de identificación oficial. El Responsable responderá en un plazo máximo de 20 días hábiles.
              </p>
            </div>

            {/* VI */}
            <div>
              <h3 className="text-sm font-bold text-gray-900 mb-2">VI. Uso de Cookies y Tecnologías de Rastreo</h3>
              <p className="text-sm leading-relaxed mb-2">
                La plataforma Siliba utiliza cookies y tecnologías similares para mejorar la experiencia del usuario,
                recordar preferencias, analizar el tráfico y el rendimiento de la aplicación. Estas tecnologías pueden recolectar:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                <li>Identificadores de sesión para mantener la autenticación activa.</li>
                <li>Preferencias de idioma y configuración de la aplicación.</li>
                <li>Datos de uso anónimos para análisis de rendimiento.</li>
              </ul>
              <p className="text-sm leading-relaxed mt-2">
                Puede deshabilitar las cookies desde la configuración de su dispositivo, aunque esto puede afectar el
                funcionamiento de algunas funcionalidades de la plataforma.
              </p>
            </div>

            {/* VII */}
            <div>
              <h3 className="text-sm font-bold text-gray-900 mb-2">VII. Medidas de Seguridad</h3>
              <p className="text-sm leading-relaxed mb-2">
                El Responsable implementa medidas técnicas, administrativas y físicas para proteger sus datos personales, que incluyen:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                <li>Cifrado de contraseñas mediante algoritmos de hash seguros.</li>
                <li>Uso de tokens JWT con vigencia limitada y rotación de tokens de refresco.</li>
                <li>Conexiones cifradas mediante protocolo HTTPS/TLS.</li>
                <li>Acceso restringido a los datos por roles y perfiles de usuario.</li>
                <li>Respaldos periódicos de la base de datos.</li>
              </ul>
              <p className="text-sm leading-relaxed mt-2">
                En caso de una vulneración de seguridad que afecte significativamente sus datos, se le notificará a la brevedad
                posible por los medios disponibles.
              </p>
            </div>

            {/* VIII */}
            <div>
              <h3 className="text-sm font-bold text-gray-900 mb-2">VIII. Modificaciones al Aviso de Privacidad</h3>
              <p className="text-sm leading-relaxed">
                El Responsable se reserva el derecho de actualizar o modificar el presente Aviso de Privacidad en cualquier momento.
                Los cambios serán notificados a través de la aplicación y/o por correo electrónico. La versión vigente siempre estará
                disponible dentro de la sección de Privacidad de la aplicación.
              </p>
            </div>

            {/* IX */}
            <div>
              <h3 className="text-sm font-bold text-gray-900 mb-2">IX. Autoridad Competente</h3>
              <p className="text-sm leading-relaxed">
                Si considera que el tratamiento de sus datos personales no es adecuado, puede presentar una queja ante la
                Secretaría Anticorrupción y Buen Gobierno (SABG), órgano que, desde diciembre de 2024, asumió las funciones
                de protección de datos personales anteriormente ejercidas por el INAI.
              </p>
            </div>

            <p className="text-xs text-gray-400 text-center pt-4 border-t border-gray-100 italic">
              Siliba — 10 de marzo de 2026
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
