'use client';

// ============================================================
// EmployeeHomeServiceContent — "Servicio a domicilio" para el FREELANCER.
// El freelancer no tiene pantalla de Sucursales, así que aquí tomamos su única
// ubicación y abrimos el mismo editor de áreas de cobertura que usa el admin.
// ============================================================

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { CoverageAreasEditor } from './coverage-areas-editor';

interface Loc {
  id: string;
  name: string;
  latitude?: number | null;
  longitude?: number | null;
}

export function EmployeeHomeServiceContent() {
  const [loc, setLoc] = useState<Loc | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    api
      .get<{ data: Loc[] }>('/api/locations')
      .then((r) => setLoc((r.data || [])[0] || null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-6 max-w-lg mx-auto">
        <div className="animate-pulse h-32 bg-gray-200 rounded-xl" />
      </div>
    );
  }

  const hasCoords = loc && loc.latitude != null && loc.longitude != null;

  return (
    <div className="p-6 max-w-lg mx-auto pb-24 lg:pb-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Servicio a domicilio</h1>
      <p className="text-sm text-gray-500 mb-5">
        Define hasta dónde te desplazas y cuánto cobras según la distancia. Marca cada servicio como "disponible a domicilio" desde tu catálogo.
      </p>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        {!loc ? (
          <p className="text-sm text-gray-500">No encontramos tu ubicación. Contacta a soporte para configurarla.</p>
        ) : !hasCoords ? (
          <p className="text-sm text-gray-500">
            Tu ubicación aún no está fijada en el mapa. Se necesita para calcular las zonas; contacta a soporte para establecerla.
          </p>
        ) : (
          <>
            <p className="text-sm text-gray-700 mb-3">Configura tus zonas de cobertura (anillos con radio y precio) sobre el mapa.</p>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
              style={{ backgroundColor: '#008080' }}
            >
              Configurar zonas de cobertura
            </button>
          </>
        )}
      </div>

      {open && loc && (
        <CoverageAreasEditor
          location={{ id: loc.id, name: loc.name, latitude: loc.latitude, longitude: loc.longitude }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
