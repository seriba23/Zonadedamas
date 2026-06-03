'use client';

import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { QrPrintTemplate } from '@/components/qr/qr-print-template';

interface Location {
  id: string;
  name: string;
  address: string | null;
}

interface QrData {
  url: string;
  tenantName: string;
  tenantSlug: string;
  logoUrl: string | null;
  locationName: string | null;
}

// Si el backend devuelve una URL con localhost (porque APP_BASE_URL no está
// configurada en el .env del entorno), la sustituimos con el origin actual
// del navegador. Así el QR siempre apunta a un dominio escaneable.
function normalizeQrUrl(url: string): string {
  if (typeof window === 'undefined') return url;
  try {
    const parsed = new URL(url);
    const isLocal = ['localhost', '127.0.0.1', '0.0.0.0'].includes(parsed.hostname);
    if (isLocal) {
      return `${window.location.origin}${parsed.pathname}${parsed.search}`;
    }
    return url;
  } catch {
    return url;
  }
}

export default function QrSettingsPage() {
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [linkCopied, setLinkCopied] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const { data: locationsData } = useQuery({
    queryKey: ['locations'],
    queryFn: () => api.get<{ data: Location[] }>('/api/locations'),
  });

  const locations: Location[] = (locationsData as any)?.data || [];

  const { data: qrData, isLoading } = useQuery({
    queryKey: ['qr-data', selectedLocationId],
    queryFn: () => {
      const params = selectedLocationId ? `?locationId=${selectedLocationId}` : '';
      return api.get<{ data: QrData }>(`/api/marketplace/qr${params}`);
    },
  });

  const rawQr: QrData | null = (qrData as any)?.data || null;
  const qr: QrData | null = rawQr ? { ...rawQr, url: normalizeQrUrl(rawQr.url) } : null;

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>QR - ${qr?.tenantName || 'Siliba'}</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          @page { margin: 0; size: A4; }
          body { margin: 0; }
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        ${printContent.innerHTML}
        <script>
          window.onload = function() {
            setTimeout(function() { window.print(); window.close(); }, 500);
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Código QR</h1>
        <p className="text-sm text-gray-500 mt-1">
          Genera un código QR imprimible para que tus clientes puedan escanear y reservar directamente
        </p>
      </div>

      {/* Location selector */}
      {locations.length > 1 && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Selecciona sucursal
          </label>
          <select
            value={selectedLocationId}
            onChange={(e) => setSelectedLocationId(e.target.value)}
            className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#008080] focus:border-[#008080]"
          >
            <option value="">Todas las sucursales</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name} {loc.address ? `- ${loc.address}` : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#008080] mx-auto" />
        </div>
      ) : qr ? (
        <div className="space-y-6">
          {/* Preview card */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Vista previa</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  URL: <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">{qr.url}</code>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (navigator.share) {
                      navigator.share({ title: qr.tenantName, text: `Reserva tu cita en ${qr.tenantName}`, url: qr.url });
                    } else {
                      navigator.clipboard.writeText(qr.url);
                      setLinkCopied(true);
                      setTimeout(() => setLinkCopied(false), 2000);
                    }
                  }}
                  className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                  </svg>
                  {linkCopied ? 'Link copiado' : 'Compartir link'}
                </button>
                <button
                  onClick={handlePrint}
                  className="px-4 py-2 bg-[#008080] text-white rounded-lg text-sm font-medium hover:bg-[#006666] transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18.75 12h.008v.008h-.008V12zm-3 0h.008v.008h-.008V12z" />
                  </svg>
                  Imprimir
                </button>
              </div>
            </div>

            {/* Scaled preview */}
            <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50 p-4">
              <div className="transform scale-50 origin-top-left" style={{ width: '200%', height: '50%' }}>
                <QrPrintTemplate
                  qrUrl={qr.url}
                  tenantName={qr.tenantName}
                  logoUrl={qr.logoUrl}
                  locationName={qr.locationName}
                />
              </div>
            </div>
          </div>

          {/* Hidden print template */}
          <div ref={printRef} className="hidden">
            <QrPrintTemplate
              qrUrl={qr.url}
              tenantName={qr.tenantName}
              logoUrl={qr.logoUrl}
              locationName={qr.locationName}
            />
          </div>
        </div>
      ) : (
        <div className="text-center py-12 text-gray-400">
          No se pudo generar el código QR
        </div>
      )}
    </div>
  );
}
