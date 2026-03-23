'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import MarketplaceHeader from '../../marketplace-header';

const TEAL = '#008080';

export default function TermsAndConditionsPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50">
      <MarketplaceHeader />

      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 rounded-full flex items-center justify-center bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <h1 className="text-lg font-bold text-gray-900">Términos y Condiciones</h1>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="prose prose-sm max-w-none text-gray-700 space-y-5">
            <div className="text-center mb-6">
              <h2 className="text-base font-bold text-gray-900 mb-1">Siliba</h2>
              <p className="text-sm font-semibold text-gray-700">Términos y Condiciones de Uso</p>
              <p className="text-xs text-gray-400 mt-1">Última actualización: 10 de marzo de 2026</p>
            </div>

            <p className="text-sm leading-relaxed p-3 bg-gray-50 rounded-lg italic">
              Lea detenidamente los presentes Términos y Condiciones antes de utilizar la plataforma Siliba.
              Al crear una cuenta o utilizar la aplicación, usted acepta quedar vinculado por estos términos.
              Si no está de acuerdo, por favor no utilice la plataforma.
            </p>

            {/* 1 */}
            <div>
              <h3 className="text-sm font-bold text-gray-900 mb-2">1. Aceptación de los Términos</h3>
              <p className="text-sm leading-relaxed">
                Los presentes Términos y Condiciones de Uso (en adelante &quot;los Términos&quot;) regulan el acceso y uso de la plataforma
                digital Siliba (en adelante &quot;la Plataforma&quot;), incluyendo la aplicación móvil disponible para Android e iOS,
                el sitio web y cualquier servicio asociado, proporcionados por el Responsable, persona física con actividad empresarial
                con domicilio en Guadalajara, Jalisco, México.
              </p>
              <p className="text-sm leading-relaxed mt-2">
                Al registrarse o utilizar la Plataforma, el usuario acepta estos Términos en su totalidad. El uso continuado de la
                Plataforma tras la publicación de modificaciones implica la aceptación de los mismos.
              </p>
            </div>

            {/* 2 */}
            <div>
              <h3 className="text-sm font-bold text-gray-900 mb-2">2. Definiciones</h3>
              <p className="text-sm leading-relaxed mb-2">
                Para los efectos de los presentes Términos, se entenderá por:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                <li><strong>Plataforma:</strong> la aplicación móvil Siliba, disponible en Google Play Store y Apple App Store, así como el panel web de administración.</li>
                <li><strong>Cliente:</strong> persona física que utiliza la Plataforma para buscar, agendar y recibir servicios de belleza y cuidado personal.</li>
                <li><strong>Profesional:</strong> persona física que ofrece servicios de belleza y cuidado personal a través de la Plataforma.</li>
                <li><strong>Gerente / Administrador:</strong> persona física responsable de la gestión de uno o más negocios registrados en la Plataforma.</li>
                <li><strong>Negocio:</strong> establecimiento comercial que presta servicios de belleza y cuidado personal, registrado en la Plataforma mediante una licencia vigente.</li>
                <li><strong>Licencia:</strong> suscripción periódica contratada por el Negocio que habilita el uso de las funcionalidades de la Plataforma.</li>
                <li><strong>Contenido:</strong> toda información, texto, imágenes, calificaciones, reseñas y datos publicados en la Plataforma.</li>
              </ul>
            </div>

            {/* 3 */}
            <div>
              <h3 className="text-sm font-bold text-gray-900 mb-2">3. Registro y Cuenta de Usuario</h3>

              <h4 className="text-sm font-semibold text-gray-800 mt-2 mb-1">3.1 Requisitos de registro</h4>
              <p className="text-sm leading-relaxed mb-1">Para utilizar la Plataforma es necesario crear una cuenta. El usuario debe:</p>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                <li>Ser mayor de 18 años o contar con la autorización de un tutor legal.</li>
                <li>Proporcionar información verídica, completa y actualizada al momento del registro.</li>
                <li>Mantener la confidencialidad de sus credenciales de acceso.</li>
                <li>Notificar de inmediato al Responsable cualquier uso no autorizado de su cuenta.</li>
              </ul>

              <h4 className="text-sm font-semibold text-gray-800 mt-3 mb-1">3.2 Responsabilidad de la cuenta</h4>
              <p className="text-sm leading-relaxed">
                El usuario es el único responsable de todas las actividades realizadas bajo su cuenta. El Responsable no será
                responsable por pérdidas o daños derivados del incumplimiento de las obligaciones de seguridad de la cuenta por parte del usuario.
              </p>

              <h4 className="text-sm font-semibold text-gray-800 mt-3 mb-1">3.3 Cancelación de cuenta</h4>
              <p className="text-sm leading-relaxed">
                El Responsable se reserva el derecho de suspender o cancelar cuentas que incumplan estos Términos, sin previo aviso
                y sin responsabilidad alguna. El usuario puede solicitar la cancelación de su cuenta en cualquier momento mediante
                solicitud a través de la Plataforma.
              </p>
            </div>

            {/* 4 */}
            <div>
              <h3 className="text-sm font-bold text-gray-900 mb-2">4. Uso Permitido de la Plataforma</h3>

              <h4 className="text-sm font-semibold text-gray-800 mt-2 mb-1">4.1 Usos permitidos</h4>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                <li>Buscar y agendar servicios de belleza y cuidado personal.</li>
                <li>Gestionar su agenda y disponibilidad como Profesional registrado.</li>
                <li>Administrar su negocio, sucursales y equipo de trabajo (para Gerentes con licencia activa).</li>
                <li>Calificar y reseñar los servicios recibidos o brindados.</li>
                <li>Comunicarse a través de los canales habilitados dentro de la Plataforma.</li>
              </ul>

              <h4 className="text-sm font-semibold text-gray-800 mt-3 mb-1">4.2 Usos prohibidos</h4>
              <p className="text-sm leading-relaxed mb-1">Queda estrictamente prohibido:</p>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                <li>Utilizar la Plataforma para fines ilegales o no autorizados.</li>
                <li>Publicar contenido falso, engañoso, difamatorio, obsceno o que infrinja derechos de terceros.</li>
                <li>Realizar ingeniería inversa, descompilar o intentar extraer el código fuente de la Plataforma.</li>
                <li>Usar bots, scrapers o cualquier mecanismo automatizado para acceder a la Plataforma sin autorización.</li>
                <li>Intentar acceder a cuentas, datos o sistemas no autorizados.</li>
                <li>Realizar cualquier acción que afecte el rendimiento, disponibilidad o seguridad de la Plataforma.</li>
                <li>Suplantar la identidad de otro usuario, Negocio o del propio Responsable.</li>
              </ul>
            </div>

            {/* 5 */}
            <div>
              <h3 className="text-sm font-bold text-gray-900 mb-2">5. Licencias y Plan de Servicios</h3>

              <h4 className="text-sm font-semibold text-gray-800 mt-2 mb-1">5.1 Contratación de licencia</h4>
              <p className="text-sm leading-relaxed mb-1">El acceso a las funcionalidades de gestión de negocio requiere la contratación de una licencia vigente. El Negocio acepta:</p>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                <li>Pagar la tarifa correspondiente al plan seleccionado en los plazos acordados.</li>
                <li>Utilizar la licencia exclusivamente para el número de sucursales y usuarios contratados.</li>
                <li>No transferir, sublicenciar ni ceder su licencia a terceros.</li>
              </ul>

              <h4 className="text-sm font-semibold text-gray-800 mt-3 mb-1">5.2 Vigencia y renovación</h4>
              <p className="text-sm leading-relaxed">
                Las licencias tienen vigencia mensual o anual según el plan contratado. La renovación automática puede activarse
                o desactivarse desde el panel de administración. El Responsable notificará con al menos 15 días de anticipación
                cualquier cambio en las tarifas vigentes.
              </p>

              <h4 className="text-sm font-semibold text-gray-800 mt-3 mb-1">5.3 Suspensión por falta de pago</h4>
              <p className="text-sm leading-relaxed">
                El incumplimiento en el pago de la licencia podrá resultar en la suspensión temporal del acceso a las funcionalidades
                de gestión. Los datos del Negocio serán conservados por un período de 30 días naturales posterior a la suspensión
                antes de proceder a su eliminación definitiva, salvo instrucción en contrario.
              </p>
            </div>

            {/* 6 */}
            <div>
              <h3 className="text-sm font-bold text-gray-900 mb-2">6. Gestión de Citas y Servicios</h3>

              <h4 className="text-sm font-semibold text-gray-800 mt-2 mb-1">6.1 Responsabilidad del servicio</h4>
              <p className="text-sm leading-relaxed">
                Siliba actúa como plataforma intermediaria que facilita la conexión entre Clientes y Profesionales.
                El Responsable no es parte de la relación de servicio entre ellos y no garantiza la calidad, seguridad o legalidad
                de los servicios ofrecidos por los Negocios y Profesionales registrados.
              </p>

              <h4 className="text-sm font-semibold text-gray-800 mt-3 mb-1">6.2 Cancelaciones y no presentación</h4>
              <p className="text-sm leading-relaxed">
                Las políticas de cancelación son definidas por cada Negocio dentro de los parámetros permitidos por la Plataforma.
                El Cliente es responsable de revisar estas políticas antes de confirmar una cita. El Responsable no será responsable
                por cobros o cargos derivados de cancelaciones tardías conforme a la política del Negocio.
              </p>

              <h4 className="text-sm font-semibold text-gray-800 mt-3 mb-1">6.3 Reseñas y calificaciones</h4>
              <p className="text-sm leading-relaxed">
                Las reseñas deben ser honestas y basadas en experiencias reales. El Responsable se reserva el derecho de eliminar
                contenido que viole estos Términos, sin que ello genere responsabilidad alguna hacia el autor.
              </p>
            </div>

            {/* 7 */}
            <div>
              <h3 className="text-sm font-bold text-gray-900 mb-2">7. Propiedad Intelectual</h3>
              <p className="text-sm leading-relaxed">
                Todo el contenido de la Plataforma, incluyendo pero no limitado a: nombre comercial &quot;Siliba&quot;, logotipos,
                diseño visual, código fuente, base de datos, textos, imágenes y funcionalidades, es propiedad exclusiva del Responsable
                o cuenta con licencia de uso a su favor, y se encuentra protegido por la Ley Federal del Derecho de Autor, la Ley
                de la Propiedad Industrial y los tratados internacionales aplicables.
              </p>
              <p className="text-sm leading-relaxed mt-2">
                Se prohíbe expresamente la reproducción, distribución, modificación o uso comercial de cualquier elemento de la
                Plataforma sin autorización previa y por escrito del Responsable.
              </p>
              <p className="text-sm leading-relaxed mt-2">
                El Negocio que cargue logotipos, imágenes u otro contenido a la Plataforma declara tener los derechos necesarios
                sobre dicho contenido y otorga al Responsable una licencia no exclusiva para su uso en la Plataforma.
              </p>
            </div>

            {/* 8 */}
            <div>
              <h3 className="text-sm font-bold text-gray-900 mb-2">8. Limitación de Responsabilidad</h3>
              <p className="text-sm leading-relaxed mb-2">
                El Responsable no será responsable, en ningún caso, por:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                <li>Daños directos, indirectos, incidentales o consecuentes derivados del uso o imposibilidad de uso de la Plataforma.</li>
                <li>Interrupciones del servicio por mantenimiento, fallas técnicas, casos fortuitos o de fuerza mayor.</li>
                <li>Actos u omisiones de Negocios, Profesionales o Clientes registrados en la Plataforma.</li>
                <li>Pérdida de datos derivada de eventos fuera del control razonable del Responsable.</li>
                <li>Daños ocasionados por el uso de información contenida en la Plataforma.</li>
              </ul>
              <p className="text-sm leading-relaxed mt-2">
                La responsabilidad total del Responsable ante el usuario, por cualquier causa, en ningún caso excederá el monto
                pagado por el usuario en los últimos 3 meses de licencia activa.
              </p>
            </div>

            {/* 9 */}
            <div>
              <h3 className="text-sm font-bold text-gray-900 mb-2">9. Privacidad y Protección de Datos</h3>
              <p className="text-sm leading-relaxed">
                El tratamiento de sus datos personales se rige por el{' '}
                <Link href="/marketplace/legal/privacy" className="font-medium" style={{ color: TEAL }}>
                  Aviso de Privacidad
                </Link>{' '}
                de Siliba, el cual forma parte integral de estos Términos y está disponible dentro de la Plataforma.
                Al aceptar estos Términos, el usuario también acepta los términos del Aviso de Privacidad.
              </p>
            </div>

            {/* 10 */}
            <div>
              <h3 className="text-sm font-bold text-gray-900 mb-2">10. Modificaciones a los Términos</h3>
              <p className="text-sm leading-relaxed">
                El Responsable se reserva el derecho de modificar estos Términos en cualquier momento. Las modificaciones serán
                notificadas con al menos 10 días de anticipación mediante notificación dentro de la Plataforma y/o por correo
                electrónico. El uso continuado de la Plataforma tras la vigencia de los nuevos términos implica su aceptación.
              </p>
            </div>

            {/* 11 */}
            <div>
              <h3 className="text-sm font-bold text-gray-900 mb-2">11. Terminación</h3>
              <p className="text-sm leading-relaxed mb-2">
                El Responsable podrá terminar o suspender el acceso del usuario a la Plataforma, de manera inmediata y sin previo aviso, en caso de:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                <li>Incumplimiento de cualquiera de estos Términos.</li>
                <li>Conducta que el Responsable considere perjudicial para otros usuarios, terceros o para la Plataforma.</li>
                <li>Orden de autoridad competente.</li>
              </ul>
              <p className="text-sm leading-relaxed mt-2">
                La terminación no exime al usuario de las obligaciones contraídas antes de la misma, incluyendo el pago de licencias pendientes.
              </p>
            </div>

            {/* 12 */}
            <div>
              <h3 className="text-sm font-bold text-gray-900 mb-2">12. Ley Aplicable y Jurisdicción</h3>
              <p className="text-sm leading-relaxed">
                Los presentes Términos se rigen e interpretan conforme a las leyes de los Estados Unidos Mexicanos, con aplicación
                específica de la Ley Federal de Protección al Consumidor (LFPC) y la legislación civil del Estado de Jalisco.
              </p>
              <p className="text-sm leading-relaxed mt-2">
                Para la resolución de cualquier controversia derivada del uso de la Plataforma, las partes se someten a la jurisdicción
                de los tribunales competentes de la ciudad de Guadalajara, Jalisco, México, renunciando expresamente a cualquier otro
                fuero que pudiera corresponderles en razón de su domicilio presente o futuro.
              </p>
            </div>

            {/* 13 */}
            <div>
              <h3 className="text-sm font-bold text-gray-900 mb-2">13. Contacto</h3>
              <p className="text-sm leading-relaxed mb-2">
                Para cualquier pregunta, aclaración o queja relacionada con estos Términos, puede contactarnos:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                <li>
                  Asuntos legales:{' '}
                  <a href="mailto:legal@siliba.com" className="font-medium" style={{ color: TEAL }}>
                    legal@siliba.com
                  </a>
                </li>
                <li>
                  Soporte técnico:{' '}
                  <a href="mailto:soporte@siliba.com" className="font-medium" style={{ color: TEAL }}>
                    soporte@siliba.com
                  </a>
                </li>
                <li>Dentro de la aplicación: Configuración &gt; Centro de Ayuda &gt; Contactar soporte</li>
              </ul>
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
