'use client';

import { QRCodeSVG } from 'qrcode.react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface QrPrintTemplateProps {
  qrUrl: string;
  tenantName: string;
  logoUrl: string | null;
  locationName?: string | null;
}

export function QrPrintTemplate({ qrUrl, tenantName, logoUrl, locationName }: QrPrintTemplateProps) {
  return (
    <div className="w-full min-h-[80vh] bg-white flex flex-col items-center justify-center py-16 px-8 mx-auto print:w-[210mm] print:min-h-[297mm] print:p-8">
      {/* App branding */}
      <div className="text-center mb-12">
        <h1 className="text-5xl font-bold text-[#008080] tracking-tight print:text-4xl">Siliba</h1>
        <p className="text-xl text-gray-500 mt-2 print:text-lg">Tu confianza, en manos de profesionales</p>
      </div>

      {/* QR Code */}
      <div className="bg-white border-2 border-gray-200 rounded-3xl p-10 shadow-sm mb-10 print:p-8">
        <QRCodeSVG
          value={qrUrl}
          size={320}
          level="H"
          includeMargin={false}
          bgColor="#ffffff"
          fgColor="#000000"
          className="print:w-[240px] print:h-[240px]"
        />
      </div>

      {/* Business info */}
      <div className="text-center mb-12">
        {logoUrl && (
          <div className="w-20 h-20 rounded-xl bg-gray-100 mx-auto mb-4 overflow-hidden border border-gray-200">
            <img src={`${API_URL}${logoUrl}`} alt="" className="w-full h-full object-cover" />
          </div>
        )}
        <h2 className="text-5xl font-bold text-gray-900 print:text-4xl">{tenantName}</h2>
        {locationName && (
          <p className="text-xl text-gray-500 mt-2 print:text-lg">Sucursal: {locationName}</p>
        )}
      </div>

      {/* Divider */}
      <div className="w-80 h-px bg-gray-300 mb-12 print:mb-16" />

      {/* Instructions */}
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

      {/* Footer */}
      <div className="mt-auto pt-12 text-center print:pt-10">
        <p className="text-base text-gray-400 print:text-sm">www.siliba.com</p>
      </div>
    </div>
  );
}
