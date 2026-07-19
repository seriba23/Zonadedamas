'use client';

// ============================================================
// Pestaña "Productos" de la Tienda. Extraída de shop/page.tsx para poder
// reutilizarla tanto en el panel admin (/shop) como en el portal del
// freelancer (/employee/shop). El único punto que cambia entre portales es
// la ruta del Inventario (admin: /inventory · freelancer: /employee/inventory),
// que se pasa por props.
// ============================================================

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useCurrency } from '@/lib/hooks/use-currency';
import { Modal } from '@/components/ui/modal';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export function ShopProductsTab({ inventoryHref = '/inventory' }: { inventoryHref?: string }) {
  const { format: formatCurrency } = useCurrency();
  const [search, setSearch] = useState('');
  const [detailProduct, setDetailProduct] = useState<any | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['shop-products'],
    queryFn: () => api.get<{ data: any[] }>('/api/products?perPage=100'),
  });

  const allProducts = (data?.data || []).filter((p: any) => p.isShopListed && p.isActive);
  const products = search
    ? allProducts.filter((p: any) =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.sku || '').toLowerCase().includes(search.toLowerCase()) ||
        (p.category || '').toLowerCase().includes(search.toLowerCase())
      )
    : allProducts;

  return (
    <div className="p-4 md:p-6">
      {/* Buscador estilo marketplace + acceso a inventario */}
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar producto en tienda..."
            className="w-full pl-9 pr-9 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#008080]"
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full text-gray-400 hover:bg-gray-100 flex items-center justify-center" aria-label="Limpiar">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
            </button>
          )}
        </div>
        <Link href={inventoryHref} className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <span className="hidden sm:inline">Inventario</span>
        </Link>
      </div>

      <p className="text-xs text-gray-400 mb-3">{products.length} producto{products.length !== 1 ? 's' : ''} en la tienda · toca uno para ver sus ventas</p>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-44 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 bg-teal-50 rounded-full flex items-center justify-center mb-4">
            <svg className="w-7 h-7 text-[#008080]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
          </div>
          <p className="text-gray-500 text-sm mb-1">No hay productos para venta</p>
          <p className="text-xs text-gray-400">Marca productos como "Para venta en tienda" desde <Link href={inventoryHref} className="text-[#008080] hover:underline">Inventario</Link></p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
          {products.map((product: any) => (
            <button
              key={product.id}
              onClick={() => setDetailProduct(product)}
              className="text-left bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md hover:border-teal-200 transition-all"
            >
              <div className="aspect-square bg-gray-100 flex items-center justify-center overflow-hidden">
                {product.imageUrl ? (
                  <img src={`${API_URL}${product.imageUrl}`} alt="" className="w-full h-full object-cover" />
                ) : (
                  <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                  </svg>
                )}
              </div>
              <div className="p-3">
                <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                <p className="text-[11px] text-gray-400 truncate">{product.category || 'Sin categoría'}</p>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-sm font-bold text-gray-900">{formatCurrency(Number(product.price))}</span>
                  <span className={`text-[11px] font-medium ${product.stock > product.minStock ? 'text-green-600' : product.stock > 0 ? 'text-teal-600' : 'text-red-600'}`}>
                    {product.stock > 0 ? `${product.stock} en stock` : 'Agotado'}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {detailProduct && (
        <ProductSalesModal product={detailProduct} onClose={() => setDetailProduct(null)} formatCurrency={formatCurrency} inventoryHref={inventoryHref} />
      )}
    </div>
  );
}

function ProductSalesModal({ product, onClose, formatCurrency, inventoryHref }: { product: any; onClose: () => void; formatCurrency: (n: number) => string; inventoryHref: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['product-sales', product.id],
    queryFn: () => api.get<{ data: { sales: any[]; totals: { units: number; revenue: number; commission: number }; count: number } }>(`/api/products/${product.id}/sales`),
  });
  const sales = data?.data?.sales || [];
  const totals = data?.data?.totals || { units: 0, revenue: 0, commission: 0 };
  const commissionLabel = product.commission
    ? (product.commissionType === 'PERCENT' ? `${Number(product.commission)}% del precio` : `${formatCurrency(Number(product.commission))} / unidad`)
    : 'Sin comisión';

  return (
    <Modal title={product.name} onClose={onClose} size="lg">
      {/* Encabezado producto */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-16 h-16 rounded-xl bg-gray-100 overflow-hidden flex items-center justify-center shrink-0">
          {product.imageUrl ? (
            <img src={`${API_URL}${product.imageUrl}`} alt="" className="w-full h-full object-cover" />
          ) : (
            <svg className="w-7 h-7 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" /></svg>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-gray-500">{product.category || 'Sin categoría'}{product.sku ? ` · SKU ${product.sku}` : ''}</p>
          <p className="text-lg font-bold text-gray-900">{formatCurrency(Number(product.price))}</p>
          <p className="text-xs text-gray-500">Comisión: <span className="font-medium text-teal-700">{commissionLabel}</span></p>
        </div>
        <Link href={`${inventoryHref}?focus=${product.id}`} className="shrink-0 text-xs font-medium text-[#008080] border border-teal-200 rounded-lg px-3 py-1.5 hover:bg-teal-50">
          Editar en inventario
        </Link>
      </div>

      {/* Totales */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5 text-center">
          <p className="text-[11px] text-gray-500">Unidades vendidas</p>
          <p className="text-lg font-black text-gray-900">{totals.units}</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5 text-center">
          <p className="text-[11px] text-gray-500">Ingresos</p>
          <p className="text-lg font-black text-gray-900">{formatCurrency(totals.revenue)}</p>
        </div>
        <div className="rounded-xl border border-teal-100 bg-teal-50 px-3 py-2.5 text-center">
          <p className="text-[11px] text-teal-700">Comisión total</p>
          <p className="text-lg font-black text-teal-700">{formatCurrency(totals.commission)}</p>
        </div>
      </div>

      {/* Lista de ventas */}
      <h3 className="text-sm font-semibold text-gray-800 mb-2">Ventas</h3>
      {isLoading ? (
        <div className="py-8 text-center text-gray-400 text-sm">Cargando...</div>
      ) : sales.length === 0 ? (
        <p className="text-xs text-gray-400 py-4">Aún no hay ventas de este producto.</p>
      ) : (
        <ul className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
          {sales.map((s: any, i: number) => (
            <li key={i} className="px-3 py-2.5 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-900 truncate">{s.buyer}</p>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${s.channel === 'POS' ? 'bg-blue-50 text-blue-700' : 'bg-teal-50 text-teal-700'}`}>
                    {s.channel === 'POS' ? 'Mostrador' : 'Tienda'}
                  </span>
                </div>
                <p className="text-[11px] text-gray-400">
                  {new Date(s.date).toLocaleDateString('es', { day: '2-digit', month: 'short', year: '2-digit' })}
                  {' · '}{s.quantity} u.
                  {s.seller ? ` · vendió ${s.seller}` : ' · venta en línea'}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold text-gray-900">{formatCurrency(s.total)}</p>
                {s.commission > 0 && <p className="text-[11px] text-teal-700">comisión {formatCurrency(s.commission)}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
