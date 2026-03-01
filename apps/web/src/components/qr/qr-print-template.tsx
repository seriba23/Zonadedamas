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
    <div className="w-[210mm] min-h-[297mm] bg-white flex flex-col items-center justify-center p-12 mx-auto print:p-8">
      {/* App branding */}
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold text-indigo-600 tracking-tight">ZONADEDAMAS</h1>
        <p className="text-lg text-gray-500 mt-1">Tu plataforma de belleza</p>
      </div>

      {/* QR Code */}
      <div className="bg-white border-2 border-gray-200 rounded-2xl p-8 shadow-sm mb-8">
        <QRCodeSVG
          value={qrUrl}
          size={240}
          level="H"
          includeMargin={false}
          bgColor="#ffffff"
          fgColor="#000000"
        />
      </div>

      {/* Business info */}
      <div className="text-center mb-10">
        {logoUrl && (
          <div className="w-16 h-16 rounded-xl bg-gray-100 mx-auto mb-3 overflow-hidden border border-gray-200">
            <img src={`${API_URL}${logoUrl}`} alt="" className="w-full h-full object-cover" />
          </div>
        )}
        <h2 className="text-2xl font-bold text-gray-900">{tenantName}</h2>
        {locationName && (
          <p className="text-lg text-gray-500 mt-1">Sucursal: {locationName}</p>
        )}
      </div>

      {/* Divider */}
      <div className="w-64 h-px bg-gray-300 mb-10" />

      {/* Instructions */}
      <div className="text-center max-w-sm">
        <h3 className="text-xl font-semibold text-gray-900 mb-6">
          Escanea para reservar tu cita
        </h3>

        <div className="space-y-4 text-left">
          <div className="flex items-start gap-4">
            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm font-bold flex-shrink-0">
              1
            </div>
            <p className="text-base text-gray-700 pt-1">
              Abre la cámara de tu celular
            </p>
          </div>
          <div className="flex items-start gap-4">
            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm font-bold flex-shrink-0">
              2
            </div>
            <p className="text-base text-gray-700 pt-1">
              Apunta al código QR
            </p>
          </div>
          <div className="flex items-start gap-4">
            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm font-bold flex-shrink-0">
              3
            </div>
            <p className="text-base text-gray-700 pt-1">
              Elige tu servicio y reserva
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-auto pt-10 text-center">
        <p className="text-sm text-gray-400">www.zonadedamas.com</p>
      </div>
    </div>
  );
}
