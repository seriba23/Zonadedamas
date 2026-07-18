// ─────────────────────────────────────────────────────────────────────────────
// /marketplace/classes — Sección "CLASES" del marketplace.
//
// Tercera pestaña (junto a Negocios y Profesionales). Lista los negocios/
// profesionales que ofrecen clases (servicios etiquetados con un tipo de clase:
// Yoga, Karate, Baile...). Filtro por tipo de clase y por texto.
// ─────────────────────────────────────────────────────────────────────────────
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { marketplaceApi } from '@/lib/marketplace-api';

interface ClassItem {
  id: string;
  name: string;
  price: number | string;
  isMonthly: boolean;
  classType: string | null;
}
interface ClassBusiness {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  businessType: string | null;
  logoUrl: string | null;
  coverImageUrl: string | null;
  tenantType: string;
  classTypes: string[];
  classes: ClassItem[];
}

function priceLabel(c: ClassItem): string {
  const n = Number(c.price) || 0;
  const money = `$${n.toLocaleString('es-MX')}`;
  return c.isMonthly ? `${money}/mes` : money;
}

export default function MarketplaceClassesPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [classTypeId, setClassTypeId] = useState<string>(''); // '' = Todos

  // Catálogo de tipos de clase (para las píldoras de filtro).
  const { data: typesData } = useQuery({
    queryKey: ['mp-class-types'],
    queryFn: () => marketplaceApi.get<{ data: { id: string; name: string }[] }>('/class-types'),
  });
  const classTypes: { id: string; name: string }[] = (typesData as any)?.data || [];

  // Negocios que ofrecen clases (según filtro).
  const { data, isLoading } = useQuery({
    queryKey: ['mp-classes', search, classTypeId],
    queryFn: () => {
      const qs = new URLSearchParams();
      if (search.trim()) qs.set('search', search.trim());
      if (classTypeId) qs.set('classTypeId', classTypeId);
      const suffix = qs.toString() ? `?${qs.toString()}` : '';
      return marketplaceApi.get<{ data: ClassBusiness[] }>(`/classes${suffix}`);
    },
  });
  const businesses: ClassBusiness[] = (data as any)?.data || [];

  return (
    <div className="min-h-[100dvh] bg-[#f7f7f5] flex flex-col">
      {/* Header sticky */}
      <div className="sticky top-0 z-10 bg-[#f7f7f5]/95 backdrop-blur border-b border-gray-100">
        <div className="max-w-2xl mx-auto w-full px-4 pt-4 pb-3">
          {/* Buscador */}
          <div className="relative mb-3">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar clases (Yoga, Karate, natación...)"
              className="w-full pl-9 pr-3 py-2.5 rounded-full border border-gray-200 bg-white text-sm focus:outline-none focus:border-[#008080] focus:ring-2 focus:ring-[#008080]/20"
            />
          </div>

          {/* Selector Negocios | Profesionales | Clases */}
          <div className="flex justify-center mb-3">
            <div className="inline-flex p-1 rounded-full" style={{ backgroundColor: 'var(--soft-tint)' }}>
              <button onClick={() => router.push('/marketplace')} className="px-4 py-2 rounded-full text-sm font-bold transition-colors text-[#5b6e6a]">Negocios</button>
              <button onClick={() => router.push('/marketplace/professionals')} className="px-4 py-2 rounded-full text-sm font-bold transition-colors text-[#5b6e6a]">Profesionales</button>
              <button className="px-4 py-2 rounded-full text-sm font-bold transition-colors text-white" style={{ backgroundColor: '#008080' }}>Clases</button>
            </div>
          </div>

          {/* Píldoras de tipo de clase */}
          {classTypes.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
              <button
                onClick={() => setClassTypeId('')}
                className={`flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${classTypeId === '' ? 'bg-[#008080] text-white border-[#008080]' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
              >
                Todos
              </button>
              {classTypes.map((ct) => (
                <button
                  key={ct.id}
                  onClick={() => setClassTypeId(ct.id)}
                  className={`flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${classTypeId === ct.id ? 'bg-[#008080] text-white border-[#008080]' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                >
                  {ct.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tarjetas */}
      <div className="max-w-2xl mx-auto w-full px-4 pt-3 pb-24">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-gray-200 rounded-2xl animate-pulse" style={{ height: 150 }} />
            ))}
          </div>
        ) : businesses.length === 0 ? (
          <div className="text-center py-16">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
            </svg>
            <p className="text-sm text-gray-500">Aún no hay clases disponibles{classTypeId ? ' de este tipo' : ''}.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {businesses.map((b) => (
              <button
                key={b.id}
                onClick={() => router.push(`/marketplace/${b.slug}`)}
                className="text-left bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="flex gap-3 p-3">
                  {/* Imagen (cover o logo, o placeholder teal) */}
                  <div className="w-16 h-16 rounded-xl flex-shrink-0 overflow-hidden bg-[#e0f2f1] flex items-center justify-center">
                    {(b.coverImageUrl || b.logoUrl) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={b.coverImageUrl || b.logoUrl || ''} alt={b.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-lg font-bold text-[#008080]">{b.name.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900 truncate">{b.name}</p>
                    {b.address && <p className="text-xs text-gray-400 truncate">{b.address}</p>}
                    {/* Chips de tipo de clase */}
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {b.classTypes.slice(0, 4).map((name) => (
                        <span key={name} className="rounded-full bg-teal-50 text-teal-700 text-[11px] font-medium px-2 py-0.5">{name}</span>
                      ))}
                    </div>
                  </div>
                </div>
                {/* Un par de clases con precio */}
                {b.classes.length > 0 && (
                  <div className="border-t border-gray-100 px-3 py-2 space-y-1">
                    {b.classes.slice(0, 3).map((c) => (
                      <div key={c.id} className="flex items-center justify-between text-xs">
                        <span className="text-gray-600 truncate pr-2">{c.name}</span>
                        <span className="font-semibold text-[#008080] flex-shrink-0">{priceLabel(c)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
