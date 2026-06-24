// Client Component (corre en el navegador): necesario porque renderiza un QR.
'use client';

// QRCodeSVG: componente de la librería "qrcode.react" que dibuja un código QR
// en formato SVG (gráfico vectorial que no pierde nitidez al imprimir).
import { QRCodeSVG } from 'qrcode.react';

// Dirección base de la API. Leemos la variable de entorno NEXT_PUBLIC_API_URL;
// el operador || significa "si está vacía/indefinida, usa el valor de la
// derecha" (localhost:3001 en desarrollo). La sirve para armar URLs de imágenes.
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// PROPS del componente: los datos que recibe quien lo usa.
interface QrPrintTemplateProps {
  qrUrl: string;                   // URL que se codifica dentro del QR
  tenantName: string;              // nombre del negocio
  logoUrl: string | null;          // ruta del logo (puede no haber → null)
  locationName?: string | null;    // nombre de sucursal (opcional)
}

// Componente "QrPrintTemplate": arma una hoja A4 lista para imprimir con el
// código QR del negocio y unas instrucciones para que el cliente lo escanee.
export function QrPrintTemplate({ qrUrl, tenantName, logoUrl, locationName }: QrPrintTemplateProps) {
  // URL legible para imprimir en el footer: quitamos el protocolo para que
  // se vea limpio (`app.siliba.com/marketplace/foo` en vez de
  // `https://app.siliba.com/marketplace/foo`). Es el mismo URL que esta
  // codificado en el QR, asi la gente que escanee ve por anticipado el
  // destino y la persona que lo NO pueda escanear puede tipearlo a mano.
  // Esto es una IIFE: una función flecha que se DEFINE y se LLAMA al instante
  // (los paréntesis finales () la ejecutan). Usamos una función para poder usar
  // try/catch y calcular displayUrl en un solo paso.
  const displayUrl = (() => {
    try {
      // new URL(...) parsea la dirección. Si no es una URL válida, lanza error
      // y caemos al catch.
      const u = new URL(qrUrl);
      // host = dominio, pathname = ruta, search = query (?a=b). Los unimos y
      // con .replace(/\/$/, '') quitamos una posible barra final.
      return `${u.host}${u.pathname}${u.search}`.replace(/\/$/, '');
    } catch {
      // Plan B si qrUrl no era una URL completa: quitamos el "http(s)://" del
      // inicio (/^https?:\/\//) y la barra final.
      return qrUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    }
  })();

  return (
    // Las clases "print:" de Tailwind solo aplican cuando se imprime: fijan el
    // tamaño A4 (210mm x 297mm) y los márgenes de la hoja.
    <div className="w-full bg-white flex flex-col items-center py-12 px-8 mx-auto print:w-[210mm] print:min-h-[297mm] print:p-8">
      {/* Encabezado con la marca de la app */}
      <div className="text-center mb-10">
        <h1 className="text-5xl font-bold text-[#008080] tracking-tight print:text-4xl">Siliba</h1>
        <p className="text-xl text-gray-500 mt-2 print:text-lg">Tu confianza, en manos de profesionales</p>
      </div>

      {/* El código QR en sí */}
      <div className="bg-white border-2 border-gray-200 rounded-3xl p-10 shadow-sm mb-10 print:p-8">
        <QRCodeSVG
          value={qrUrl}              // contenido codificado en el QR
          size={320}                 // lado del QR en píxeles (en pantalla)
          level="H"                  // nivel de corrección de errores "High":
                                     // el QR sigue siendo legible aunque se
                                     // ensucie o se imprima borroso
          includeMargin={false}      // sin margen blanco interno propio
          bgColor="#ffffff"          // fondo blanco
          fgColor="#000000"          // puntos negros
          className="print:w-[240px] print:h-[240px]" // tamaño al imprimir
        />
      </div>

      {/* Datos del negocio: logo (si hay), nombre y sucursal */}
      <div className="text-center mb-12">
        {/* Renderizado condicional con &&: si logoUrl tiene valor (no es null),
            se pinta el bloque de la derecha; si es null, no se pinta nada. */}
        {logoUrl && (
          <div className="w-20 h-20 rounded-xl bg-gray-100 mx-auto mb-4 overflow-hidden border border-gray-200">
            {/* La ruta de la imagen es API_URL + logoUrl (ej. http://...:3001/uploads/logo.png) */}
            <img src={`${API_URL}${logoUrl}`} alt="" className="w-full h-full object-cover" />
          </div>
        )}
        {/* {tenantName} inserta el nombre del negocio recibido por props */}
        <h2 className="text-5xl font-bold text-gray-900 print:text-4xl">{tenantName}</h2>
        {/* Solo mostramos la sucursal si nos pasaron locationName */}
        {locationName && (
          <p className="text-xl text-gray-500 mt-2 print:text-lg">Sucursal: {locationName}</p>
        )}
      </div>

      {/* Línea separadora horizontal (un div finito de 1px de alto) */}
      <div className="w-80 h-px bg-gray-300 mb-12 print:mb-16" />

      {/* Instrucciones de uso en 3 pasos numerados */}
      <div className="text-center max-w-md">
        <h3 className="text-2xl font-semibold text-gray-900 mb-8 print:text-xl print:mb-6">
          Escanea para reservar tu cita
        </h3>

        <div className="space-y-5 text-left print:space-y-4">
          <div className="flex items-start gap-5">
            <div className="w-10 h-10 rounded-full bg-[#e0f2f1] text-[#008080] flex items-center justify-center text-base font-bold flex-shrink-0 print:w-8 print:h-8 print:text-sm">
              1
            </div>
            <p className="text-lg text-gray-700 pt-1.5 print:text-base">
              Abre la cámara de tu celular
            </p>
          </div>
          <div className="flex items-start gap-5">
            <div className="w-10 h-10 rounded-full bg-[#e0f2f1] text-[#008080] flex items-center justify-center text-base font-bold flex-shrink-0 print:w-8 print:h-8 print:text-sm">
              2
            </div>
            <p className="text-lg text-gray-700 pt-1.5 print:text-base">
              Apunta al código QR
            </p>
          </div>
          <div className="flex items-start gap-5">
            <div className="w-10 h-10 rounded-full bg-[#e0f2f1] text-[#008080] flex items-center justify-center text-base font-bold flex-shrink-0 print:w-8 print:h-8 print:text-sm">
              3
            </div>
            <p className="text-lg text-gray-700 pt-1.5 print:text-base">
              Elige tu servicio y reserva
            </p>
          </div>
        </div>
      </div>

      {/* Footer con la URL completa del negocio (sin protocolo). Es lo
          ultimo del documento — sin mt-auto, asi el contenido fluye
          natural y no deja espacio vacio en pantalla. En impresion el
          min-h-[297mm] empuja a A4 completo. */}
      <div className="pt-10 text-center">
        {/* displayUrl es la versión "limpia" que calculamos arriba.
            break-all permite cortar la URL en cualquier carácter si es larga. */}
        <p className="text-base text-gray-400 print:text-sm break-all">{displayUrl}</p>
      </div>
    </div>
  );
}
