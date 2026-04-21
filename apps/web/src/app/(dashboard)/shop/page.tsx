'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { useCurrency } from '@/lib/hooks/use-currency';
import { ReservationsContent } from '../reservations/page';
import { ShopSettingsContent } from '../settings/shop/page';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type ShopTab = 'productos' | 'apartados' | 'configuracion';

const TABS: { key: ShopTab; label: string }[] = [
  { key: 'productos', label: 'Productos' },
  { key: 'apartados', label: 'Pedidos' },
  { key: 'configuracion', label: 'Configuración' },
];

export default function ShopPage() {
  const [activeTab, setActiveTab] = useState<ShopTab>('productos');

  return (
    <div className="flex flex-col h-full">
      <Header title="Tienda" />

      {/* Tabs */}
      <div className="border-b border-gray-200 px-6 flex items-center gap-6">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-[#008080] text-[#008080]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'productos' && <ShopProductsTab />}
        {activeTab === 'apartados' && <ReservationsContent embedded />}
        {activeTab === 'configuracion' && <ShopSettingsContent />}
      </div>
    </div>
  );
}

function ShopProductsTab() {
  const { format: formatCurrency } = useCurrency();
  const [search, setSearch] = useState('');

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
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">{products.length} producto{products.length !== 1 ? 's' : ''} en la tienda</p>
        <div className="flex items-center gap-3">
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar producto..."
              className="text-xs border border-gray-200 rounded-lg pl-8 pr-3 py-1.5 w-48 focus:border-[#008080] focus:ring-1 focus:ring-[#008080]"
            />
          </div>
          <Link href="/inventory" className="text-xs text-[#008080] hover:underline">Ir a inventario</Link>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 bg-teal-50 rounded-full flex items-center justify-center mb-4">
            <svg className="w-7 h-7 text-[#008080]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
          </div>
          <p className="text-gray-500 text-sm mb-1">No hay productos para venta</p>
          <p className="text-xs text-gray-400">Marca productos como "Para venta en tienda" desde <Link href="/inventory" className="text-[#008080] hover:underline">Inventario</Link></p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((product: any) => (
            <div key={product.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
              {/* Image */}
              <div className="h-36 bg-gray-100 flex items-center justify-center overflow-hidden">
                {product.imageUrl ? (
                  <img src={`${API_URL}${product.imageUrl}`} alt="" className="w-full h-full object-cover" />
                ) : (
                  <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                  </svg>
                )}
              </div>

              {/* Info */}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="text-sm font-semibold text-gray-900 truncate">{product.name}</h3>
                  <span className="text-sm font-bold text-gray-900 flex-shrink-0">{formatCurrency(Number(product.price))}</span>
                </div>
                {product.category && <p className="text-xs text-gray-400 mb-2">{product.category}</p>}
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-medium ${product.stock > product.minStock ? 'text-green-600' : product.stock > 0 ? 'text-teal-600' : 'text-red-600'}`}>
                    {product.stock > 0 ? `${product.stock} en stock` : 'Agotado'}
                  </span>
                  {product.shippingEnabled && (
                    <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
                      </svg>
                      Envío
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
