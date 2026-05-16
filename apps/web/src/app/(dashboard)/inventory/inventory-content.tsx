'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { usePermissions } from '@/lib/hooks/use-permissions';
import { Modal } from '@/components/ui/modal';
import { AvatarCropModal } from '@/components/ui/avatar-crop-modal';
import { formatCurrency } from '@/lib/utils';
import { useRegisterTopbarAction } from '@/lib/hooks/use-topbar-action';

interface Supplier {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  sku?: string;
  description?: string;
  category?: string;
  price: number;
  costPrice: number;
  stock: number;
  minStock: number;
  unit?: string;
  supplierId?: string;
  supplier?: Supplier;
  currency: string;
  imageUrl?: string;
  supplierUrl?: string;
  notes?: string;
  shippingEnabled: boolean;
  shippingCost?: number;
  isShopListed: boolean;
  isActive: boolean;
  images?: { id: string; imageUrl: string; sortOrder: number }[];
}

interface ProductForm {
  name: string;
  sku: string;
  description: string;
  category: string;
  price: number | string;
  costPrice: number | string;
  stock: number | string;
  minStock: number | string;
  unit: string;
  supplierId: string;
  currency: string;
  supplierUrl: string;
  notes: string;
  shippingEnabled: boolean;
  shippingCost: number | string;
  isShopListed: boolean;
  isActive: boolean;
}

const DEFAULT_CATEGORIES: string[] = [];

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const defaultForm: ProductForm = {
  name: '',
  sku: '',
  description: '',
  category: '',
  price: '',
  costPrice: '',
  stock: 0,
  minStock: 0,
  unit: 'pieza',
  supplierId: '',
  currency: 'MXN',
  supplierUrl: '',
  notes: '',
  shippingEnabled: false,
  shippingCost: '',
  isShopListed: false,
  isActive: true,
};

export function InventoryContent() {
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductForm>(defaultForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);

  // Quick-create supplier popup
  const [showNewSupplier, setShowNewSupplier] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierPhone, setNewSupplierPhone] = useState('');
  const [newSupplierEmail, setNewSupplierEmail] = useState('');
  const [newSupplierWebsite, setNewSupplierWebsite] = useState('');
  const [newSupplierNotes, setNewSupplierNotes] = useState('');
  const [supplierError, setSupplierError] = useState<string | null>(null);

  // Quick-add category popup
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [customCategories, setCustomCategories] = useState<string[]>([]);

  // Inventory type tab: 'all' | 'consumable' | 'shop'

  // Filters modal (PWA: filtros agrupados en un modal, igual que en citas)
  const [showFilters, setShowFilters] = useState(false);
  // Detalle producto (read-only) — se abre al clickear una card de la lista
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);

  // Filters APLICADOS — son los que disparan el query a la API.
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterSupplier, setFilterSupplier] = useState('');
  const searchParams = useSearchParams();
  const [filterLowStock, setFilterLowStock] = useState(
    () => searchParams?.get('lowStock') === 'true' || searchParams?.get('stockBajo') === 'true',
  );

  // Filters DRAFT — se editan dentro del modal y SOLO entran en vigor al
  // dar click en "Aplicar". Si el usuario cierra el modal sin aplicar,
  // se descartan en el siguiente openFilters().
  const [draftSearch, setDraftSearch] = useState(search);
  const [draftFilterCategory, setDraftFilterCategory] = useState(filterCategory);
  const [draftFilterSupplier, setDraftFilterSupplier] = useState(filterSupplier);
  const [draftFilterLowStock, setDraftFilterLowStock] = useState(filterLowStock);

  // Sincroniza si el URL cambia (e.g. navegacion desde el alert del Home).
  useEffect(() => {
    const wantsLowStock =
      searchParams?.get('lowStock') === 'true' || searchParams?.get('stockBajo') === 'true';
    if (wantsLowStock) setFilterLowStock(true);
  }, [searchParams]);
  const [page, setPage] = useState(1);
  const perPage = 20;

  const queryParams = new URLSearchParams();
  queryParams.set('page', String(page));
  queryParams.set('perPage', String(perPage));
  if (search) queryParams.set('search', search);
  if (filterCategory) queryParams.set('category', filterCategory);
  if (filterSupplier) queryParams.set('supplierId', filterSupplier);
  if (filterLowStock) queryParams.set('lowStock', 'true');

  const { data, isLoading } = useQuery({
    queryKey: ['products', page, search, filterCategory, filterSupplier, filterLowStock],
    queryFn: () =>
      api.get<{ data: Product[]; meta: { total: number; page: number; perPage: number; totalPages: number } }>(
        `/api/products?${queryParams.toString()}`,
      ),
  });

  const products = data?.data || [];
  const meta = data?.meta;

  // Derive categories from existing products + custom ones added in this session
  const existingCategories = [...new Set(products.map((p) => p.category).filter(Boolean))] as string[];
  const allCategories = [...new Set([...DEFAULT_CATEGORIES, ...existingCategories, ...customCategories])];

  const { data: suppliersData } = useQuery({
    queryKey: ['suppliers-for-products'],
    queryFn: () => api.get<{ data: Supplier[] }>('/api/suppliers?perPage=100'),
  });

  const suppliers = suppliersData?.data || [];

  const saveMutation = useMutation({
    mutationFn: async (payload: Record<string, any>) => {
      let result: any;
      if (editingProduct) {
        result = await api.put(`/api/products/${editingProduct.id}`, payload);
      } else {
        result = await api.post('/api/products', payload);
      }
      // Upload pending image after create/update
      const productId = result?.data?.id || editingProduct?.id;
      if (pendingImage && productId) {
        await api.upload(`/api/products/${productId}/image`, pendingImage);
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      closeModal();
    },
    onError: (err: { message?: string }) => {
      setFormError(err.message || 'Error al guardar el producto');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/products/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setDeleteConfirm(null);
    },
  });

  const quickSupplierMutation = useMutation({
    mutationFn: (payload: { name: string; phone?: string; email?: string; address?: string; notes?: string }) =>
      api.post<{ data: Supplier }>('/api/suppliers', payload),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['suppliers-for-products'] });
      const created = res?.data;
      if (created?.id) {
        setForm((f) => ({ ...f, supplierId: created.id }));
      }
      setShowNewSupplier(false);
      setNewSupplierName('');
      setNewSupplierPhone('');
      setNewSupplierEmail('');
      setNewSupplierWebsite('');
      setNewSupplierNotes('');
      setSupplierError(null);
    },
    onError: (err: any) => {
      const msg = err?.details?.[0] || err?.message || 'Error al crear proveedor';
      setSupplierError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    },
  });

  function handleQuickSupplier() {
    setSupplierError(null);
    if (!newSupplierName.trim()) {
      setSupplierError('El nombre es requerido');
      return;
    }
    const emailVal = newSupplierEmail.trim();
    if (emailVal && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
      setSupplierError('El correo electronico no es valido');
      return;
    }
    const phoneVal = newSupplierPhone.trim();
    if (phoneVal && !/^\d{10}$/.test(phoneVal)) {
      setSupplierError('El telefono debe tener exactamente 10 digitos');
      return;
    }
    const websiteVal = newSupplierWebsite.trim();
    const notesVal = newSupplierNotes.trim();
    quickSupplierMutation.mutate({
      name: newSupplierName.trim(),
      ...(phoneVal && { phone: phoneVal }),
      ...(emailVal && { email: emailVal }),
      ...(websiteVal && { address: websiteVal }),
      ...(notesVal && { notes: notesVal }),
    });
  }

  function handleQuickCategory() {
    const name = newCategoryName.trim();
    if (!name) return;
    if (!allCategories.includes(name)) {
      setCustomCategories((prev) => [...prev, name]);
    }
    setForm((f) => ({ ...f, category: name }));
    setShowNewCategory(false);
    setNewCategoryName('');
  }

  function openCreate() {
    setEditingProduct(null);
    setForm(defaultForm);
    setFormError(null);
    setPendingImage(null);
    setImagePreview(null);
    setIsModalOpen(true);
  }

  function openEdit(product: Product) {
    setEditingProduct(product);
    setPendingImage(null);
    setImagePreview(null);
    setForm({
      name: product.name,
      sku: product.sku || '',
      description: product.description || '',
      category: product.category || '',
      price: product.price,
      costPrice: product.costPrice,
      stock: product.stock,
      minStock: product.minStock,
      unit: product.unit || 'pieza',
      supplierId: product.supplierId || '',
      currency: product.currency || 'MXN',
      supplierUrl: product.supplierUrl || '',
      notes: product.notes || '',
      shippingEnabled: product.shippingEnabled ?? false,
      shippingCost: product.shippingCost ?? '',
      isShopListed: product.isShopListed ?? false,
      isActive: product.isActive,
    });
    setFormError(null);
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingProduct(null);
    setForm(defaultForm);
    setFormError(null);
    setPendingImage(null);
    setImagePreview(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setFormError('El nombre es requerido');
      return;
    }

    const payload: Record<string, any> = {
      name: form.name,
      sku: form.sku || null,
      description: form.description || null,
      category: form.category || null,
      price: Number(form.price) || 0,
      costPrice: Number(form.costPrice) || 0,
      stock: Number(form.stock) || 0,
      minStock: Number(form.minStock) || 0,
      unit: form.unit || 'pieza',
      supplierId: form.supplierId || null,
      currency: form.currency || 'MXN',
      supplierUrl: form.supplierUrl || null,
      notes: form.notes || null,
      shippingEnabled: form.shippingEnabled,
      shippingCost: form.shippingEnabled && form.shippingCost !== '' ? Number(form.shippingCost) : null,
      isShopListed: form.isShopListed,
      isActive: form.isActive,
    };

    saveMutation.mutate(payload);
  }

  function isLowStock(product: Product): boolean {
    // Solo se considera "stock bajo" si hay un minStock configurado (>0).
    // minStock=0 significa "no controlado", asi no se alerta. Coherente
    // con backend findLowStock y getAlertCounts.
    return product.minStock > 0 && product.stock <= product.minStock;
  }

  const hasActiveFilters =
    search.trim().length > 0 ||
    filterCategory !== '' ||
    filterSupplier !== '' ||
    filterLowStock;

  const hasDraftFilters =
    draftSearch.trim().length > 0 ||
    draftFilterCategory !== '' ||
    draftFilterSupplier !== '' ||
    draftFilterLowStock;

  function openFilters() {
    // Sincroniza draft con los filtros actualmente aplicados.
    setDraftSearch(search);
    setDraftFilterCategory(filterCategory);
    setDraftFilterSupplier(filterSupplier);
    setDraftFilterLowStock(filterLowStock);
    setShowFilters(true);
  }

  function applyFilters() {
    setSearch(draftSearch);
    setFilterCategory(draftFilterCategory);
    setFilterSupplier(draftFilterSupplier);
    setFilterLowStock(draftFilterLowStock);
    setPage(1);
    setShowFilters(false);
  }

  function clearDraftFilters() {
    setDraftSearch('');
    setDraftFilterCategory('');
    setDraftFilterSupplier('');
    setDraftFilterLowStock(false);
  }

  // Registrar boton "Agregar" en el topbar global (solo si tiene permiso).
  useRegisterTopbarAction(
    hasPermission('inventory.create') ? (
      <button
        onClick={openCreate}
        className="px-2.5 md:px-3.5 py-1.5 text-[12px] md:text-sm font-semibold rounded-lg bg-[#008080] text-white hover:bg-[#006666] transition-colors whitespace-nowrap"
      >
        Agregar
      </button>
    ) : null,
    [hasPermission('inventory.create')],
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-3 md:p-6">
        {/* Header: contador + boton de filtros */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-500">
            {products.length} producto{products.length !== 1 ? 's' : ''}
          </p>
          <button
            onClick={openFilters}
            aria-label="Mostrar filtros"
            className={`flex-shrink-0 p-1.5 md:p-2 rounded-lg border transition-colors ${
              hasActiveFilters
                ? 'bg-[#008080] border-[#008080] text-white'
                : 'bg-[var(--bg-surface)] border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]'
            }`}
            title="Filtros"
          >
            <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
          </button>
        </div>

        {/* Lista de productos */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="animate-pulse flex items-center gap-3 p-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)]">
                <div className="w-14 h-14 rounded-xl bg-gray-200 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-2/3" />
                  <div className="h-3 bg-gray-200 rounded w-1/3" />
                </div>
                <div className="h-5 bg-gray-200 rounded w-16" />
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-500 mb-4">No hay productos en el inventario</p>
            {hasPermission('inventory.create') && (
              <button onClick={openCreate} className="btn-primary">
                Agregar primer producto
              </button>
            )}
          </div>
        ) : (
          <>
            {/* MOBILE / PWA: lista de cards */}
            <ul className="space-y-3 md:hidden">
              {products.map((product) => {
                const low = isLowStock(product);
                return (
                  <li key={product.id}>
                    <button
                      type="button"
                      onClick={() => setViewingProduct(product)}
                      className="w-full text-left grid items-center gap-x-3 px-3 py-3 rounded-2xl border border-[var(--border)] hover:bg-[var(--bg-muted)] cursor-pointer transition-colors"
                      style={{ backgroundColor: 'var(--bg-surface)', gridTemplateColumns: 'auto 1fr auto' }}
                    >
                      {/* Imagen */}
                      <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {product.imageUrl ? (
                          <img
                            src={`${API_URL}${product.imageUrl}`}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
                          </svg>
                        )}
                      </div>

                      {/* Nombre + datos */}
                      <div className="min-w-0">
                        <p className="text-sm md:text-base font-semibold text-[var(--text-primary)] truncate">
                          {product.name}
                        </p>
                        <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                          Stock:{' '}
                          <span className={`font-semibold ${low ? 'text-red-600' : 'text-[var(--text-primary)]'}`}>
                            {product.stock}
                          </span>
                          <span className="mx-1.5 text-[var(--text-muted)]">·</span>
                          Mín: <span className="font-semibold text-[var(--text-primary)]">{product.minStock}</span>
                        </p>
                      </div>

                      {/* Precio */}
                      <p className="text-sm md:text-base font-bold text-[var(--text-primary)] tabular-nums whitespace-nowrap">
                        {formatCurrency(product.price, product.currency || 'MXN')}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>

            {/* DESKTOP: tabla */}
            <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Nombre</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">SKU</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Categoría</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Precio</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Costo</th>
                      <th className="text-center px-4 py-3 font-medium text-gray-600">Stock</th>
                      <th className="text-center px-4 py-3 font-medium text-gray-600">Mín.</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Proveedor</th>
                      <th className="text-center px-4 py-3 font-medium text-gray-600">Estado</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {products.map((product) => {
                      const low = isLowStock(product);
                      return (
                        <tr
                          key={product.id}
                          onClick={() => setViewingProduct(product)}
                          className={`hover:bg-gray-50 transition-colors cursor-pointer ${low ? 'bg-red-50/50' : ''}`}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {product.imageUrl ? (
                                <img src={`${API_URL}${product.imageUrl}`} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" />
                              ) : (
                                <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center flex-shrink-0">
                                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
                                  </svg>
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="font-medium text-gray-900 flex items-center gap-1.5">
                                  <span className="truncate">{product.name}</span>
                                  {product.isShopListed && (
                                    <span className="px-1.5 py-0.5 text-[9px] font-medium rounded bg-teal-50 text-teal-700 flex-shrink-0">Tienda</span>
                                  )}
                                </div>
                                {product.description && (
                                  <div className="text-xs text-gray-400 line-clamp-1">{product.description}</div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                            {product.sku || '—'}
                          </td>
                          <td className="px-4 py-3">
                            {product.category ? (
                              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
                                {product.category}
                              </span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-900 font-medium tabular-nums">
                            {formatCurrency(product.price, product.currency || 'MXN')}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-500 tabular-nums">
                            {formatCurrency(product.costPrice, product.currency || 'MXN')}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {low ? (
                              <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-700">
                                {product.stock}
                              </span>
                            ) : (
                              <span className="text-gray-900 font-medium">{product.stock}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center text-gray-500">{product.minStock}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs">
                            <div className="flex items-center gap-1">
                              <span>{product.supplier?.name || '—'}</span>
                              {product.supplierUrl && (
                                <a
                                  href={product.supplierUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-[#008080] hover:text-[#006666]"
                                  title="Comprar al proveedor"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                                  </svg>
                                </a>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {product.isActive ? (
                              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700">
                                Activo
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-500">
                                Inactivo
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {hasPermission('inventory.update') && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); openEdit(product); }}
                                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700"
                                  title="Editar"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                              )}
                              {hasPermission('inventory.delete') && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); setDeleteConfirm(product.id); }}
                                  className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600"
                                  title="Eliminar"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            {meta && meta.totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 px-1">
                <p className="text-xs text-gray-500">
                  Mostrando {(meta.page - 1) * meta.perPage + 1} -{' '}
                  {Math.min(meta.page * meta.perPage, meta.total)} de {meta.total}
                </p>
                <div className="flex gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Anterior
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                    disabled={page >= meta.totalPages}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Create/Edit Modal — mismo estilo de lista que el detalle, mismo orden */}
      {isModalOpen && (
        <Modal
          title={editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
          onClose={closeModal}
          size="md"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            {formError && (
              <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{formError}</div>
            )}

            {/* Imagen grande (igual posicion que en detalle) */}
            <div className="flex flex-col items-center gap-2">
              {imagePreview ? (
                <img src={imagePreview} alt="Preview" className="w-32 h-32 rounded-2xl object-cover border border-[var(--border)]" />
              ) : editingProduct?.imageUrl ? (
                <img src={`${API_URL}${editingProduct.imageUrl}`} alt={editingProduct.name} className="w-32 h-32 rounded-2xl object-cover border border-[var(--border)]" />
              ) : (
                <div className="w-32 h-32 rounded-2xl bg-gray-100 flex items-center justify-center border border-[var(--border)]">
                  <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
                  </svg>
                </div>
              )}
              <div className="flex items-center gap-3 text-sm">
                <label className="cursor-pointer font-medium text-[#008080] hover:text-[#006666]">
                  {imagePreview || editingProduct?.imageUrl ? 'Cambiar imagen' : 'Subir imagen'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setCropFile(file);
                      if (e.target) e.target.value = '';
                    }}
                  />
                </label>
                {(imagePreview || pendingImage) && (
                  <button
                    type="button"
                    onClick={() => { setPendingImage(null); setImagePreview(null); }}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    Quitar
                  </button>
                )}
              </div>
            </div>

            {/* Lista de inputs (mismo orden que detalle) */}
            <ul className="divide-y divide-[var(--border)] border border-[var(--border)] rounded-xl overflow-hidden bg-[var(--bg-surface)]">
              {/* Nombre */}
              <li className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide flex-shrink-0">
                  Nombre *
                </span>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                  placeholder="Ej: Tinte L'Oreal Majirel"
                  className="flex-1 min-w-0 text-sm text-right bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--text-primary)] hover:border-gray-400 focus:outline-none focus:border-[#008080] focus:ring-2 focus:ring-[#008080]/20 transition-colors"
                />
              </li>

              {/* SKU */}
              <li className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide flex-shrink-0">
                  SKU
                </span>
                <input
                  type="text"
                  value={form.sku}
                  onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
                  placeholder="TIN-LOR-001"
                  className="flex-1 min-w-0 text-sm text-right bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--text-primary)] hover:border-gray-400 focus:outline-none focus:border-[#008080] focus:ring-2 focus:ring-[#008080]/20 transition-colors"
                />
              </li>

              {/* Categoria + quick-add */}
              <li className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide flex-shrink-0">
                  Categoría
                </span>
                <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
                  <select
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                    className="flex-1 min-w-0 text-sm bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--text-primary)] hover:border-gray-400 focus:outline-none focus:border-[#008080] focus:ring-2 focus:ring-[#008080]/20 transition-colors"
                  >
                    <option value="">Sin categoría</option>
                    {allCategories.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => { setNewCategoryName(''); setShowNewCategory(true); }}
                    className="flex-shrink-0 w-7 h-7 rounded-lg border border-[var(--border)] text-[#008080] hover:bg-[#008080]/10 transition-colors text-sm font-bold"
                    title="Agregar categoría"
                  >
                    +
                  </button>
                </div>
              </li>

              {/* Precio de venta */}
              <li className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide flex-shrink-0">
                  Precio de venta *
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                  required
                  placeholder="0.00"
                  className="w-32 text-sm text-right tabular-nums bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--text-primary)] hover:border-gray-400 focus:outline-none focus:border-[#008080] focus:ring-2 focus:ring-[#008080]/20 transition-colors"
                />
              </li>

              {/* Costo */}
              <li className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide flex-shrink-0">
                  Costo *
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.costPrice}
                  onChange={(e) => setForm((f) => ({ ...f, costPrice: e.target.value }))}
                  required
                  placeholder="0.00"
                  className="w-32 text-sm text-right tabular-nums bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--text-primary)] hover:border-gray-400 focus:outline-none focus:border-[#008080] focus:ring-2 focus:ring-[#008080]/20 transition-colors"
                />
              </li>

              {/* Moneda */}
              <li className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide flex-shrink-0">
                  Moneda
                </span>
                <select
                  value={form.currency}
                  onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                  className="min-w-[220px] flex-1 text-sm bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--text-primary)] hover:border-gray-400 focus:outline-none focus:border-[#008080] focus:ring-2 focus:ring-[#008080]/20 transition-colors"
                >
                  <option value="MXN">MXN - Peso Mexicano</option>
                  <option value="USD">USD - Dólar Estadounidense</option>
                  <option value="EUR">EUR - Euro</option>
                  <option value="COP">COP - Peso Colombiano</option>
                  <option value="ARS">ARS - Peso Argentino</option>
                  <option value="CLP">CLP - Peso Chileno</option>
                  <option value="PEN">PEN - Sol Peruano</option>
                  <option value="BRL">BRL - Real Brasileño</option>
                  <option value="DOP">DOP - Peso Dominicano</option>
                  <option value="GTQ">GTQ - Quetzal</option>
                </select>
              </li>

              {/* Stock actual */}
              <li className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide flex-shrink-0">
                  Stock actual
                </span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.stock}
                  onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
                  className="w-32 text-sm text-right tabular-nums bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--text-primary)] hover:border-gray-400 focus:outline-none focus:border-[#008080] focus:ring-2 focus:ring-[#008080]/20 transition-colors"
                />
              </li>

              {/* Stock minimo */}
              <li className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide flex-shrink-0">
                  Stock mínimo
                </span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.minStock}
                  onChange={(e) => setForm((f) => ({ ...f, minStock: e.target.value }))}
                  className="w-32 text-sm text-right tabular-nums bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--text-primary)] hover:border-gray-400 focus:outline-none focus:border-[#008080] focus:ring-2 focus:ring-[#008080]/20 transition-colors"
                />
              </li>

              {/* Unidad */}
              <li className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide flex-shrink-0">
                  Unidad
                </span>
                <select
                  value={form.unit}
                  onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                  className="w-32 text-sm bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--text-primary)] hover:border-gray-400 focus:outline-none focus:border-[#008080] focus:ring-2 focus:ring-[#008080]/20 transition-colors"
                >
                  <option value="pieza">Pieza</option>
                  <option value="ml">ml</option>
                  <option value="g">g</option>
                  <option value="oz">oz</option>
                  <option value="litro">Litro</option>
                  <option value="kg">kg</option>
                  <option value="par">Par</option>
                  <option value="caja">Caja</option>
                </select>
              </li>

              {/* Proveedor + quick-add */}
              <li className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide flex-shrink-0">
                  Proveedor
                </span>
                <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
                  <select
                    value={form.supplierId}
                    onChange={(e) => setForm((f) => ({ ...f, supplierId: e.target.value }))}
                    className="flex-1 min-w-0 text-sm bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--text-primary)] hover:border-gray-400 focus:outline-none focus:border-[#008080] focus:ring-2 focus:ring-[#008080]/20 transition-colors"
                  >
                    <option value="">Sin proveedor</option>
                    {suppliers.map((sup) => (
                      <option key={sup.id} value={sup.id}>{sup.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => { setNewSupplierName(''); setNewSupplierPhone(''); setNewSupplierEmail(''); setShowNewSupplier(true); }}
                    className="flex-shrink-0 w-7 h-7 rounded-lg border border-[var(--border)] text-[#008080] hover:bg-[#008080]/10 transition-colors text-sm font-bold"
                    title="Agregar proveedor"
                  >
                    +
                  </button>
                </div>
              </li>

              {/* URL del proveedor — stack (full-width) */}
              <li className="px-3 py-2.5 space-y-1.5">
                <span className="block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">
                  URL del proveedor
                </span>
                <input
                  type="url"
                  value={form.supplierUrl}
                  onChange={(e) => setForm((f) => ({ ...f, supplierUrl: e.target.value }))}
                  placeholder="https://www.proveedor.com/producto"
                  className="w-full text-sm bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--text-primary)] hover:border-gray-400 focus:outline-none focus:border-[#008080] focus:ring-2 focus:ring-[#008080]/20 transition-colors"
                />
              </li>

              {/* Descripción — stack (full-width) */}
              <li className="px-3 py-2.5 space-y-1.5">
                <span className="block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">
                  Descripción
                </span>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={3}
                  placeholder="Descripción opcional..."
                  className="w-full text-sm bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--text-primary)] hover:border-gray-400 focus:outline-none focus:border-[#008080] focus:ring-2 focus:ring-[#008080]/20 transition-colors resize-none"
                />
              </li>

              {/* Notas — stack (full-width) */}
              <li className="px-3 py-2.5 space-y-1.5">
                <span className="block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">
                  Notas
                </span>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  placeholder="Notas internas sobre este producto..."
                  className="w-full text-sm bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--text-primary)] hover:border-gray-400 focus:outline-none focus:border-[#008080] focus:ring-2 focus:ring-[#008080]/20 transition-colors resize-none"
                />
              </li>

              {/* Visible en tienda */}
              <li className="flex items-center justify-between gap-3 px-3 py-2.5">
                <span className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">
                  Visible en tienda
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.isShopListed}
                  onClick={() => setForm((f) => ({ ...f, isShopListed: !f.isShopListed }))}
                  className="relative w-11 h-6 rounded-full transition-colors flex-shrink-0"
                  style={{ backgroundColor: form.isShopListed ? '#008080' : 'var(--border)' }}
                >
                  <span
                    className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform"
                    style={{ transform: form.isShopListed ? 'translateX(20px)' : 'translateX(0)' }}
                  />
                </button>
              </li>

              {/* Envío disponible — solo si isShopListed */}
              {form.isShopListed && (
                <li className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <span className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">
                    Envío disponible
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={form.shippingEnabled}
                    onClick={() => setForm((f) => ({ ...f, shippingEnabled: !f.shippingEnabled, ...(!f.shippingEnabled ? {} : { shippingCost: '' }) }))}
                    className="relative w-11 h-6 rounded-full transition-colors flex-shrink-0"
                    style={{ backgroundColor: form.shippingEnabled ? '#008080' : 'var(--border)' }}
                  >
                    <span
                      className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform"
                      style={{ transform: form.shippingEnabled ? 'translateX(20px)' : 'translateX(0)' }}
                    />
                  </button>
                </li>
              )}

              {/* Costo de envio — solo si isShopListed && shippingEnabled */}
              {form.isShopListed && form.shippingEnabled && (
                <li className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide flex-shrink-0">
                    Costo de envío
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[var(--text-muted)] whitespace-nowrap">
                      {!form.shippingCost || Number(form.shippingCost) === 0
                        ? 'Envío gratis'
                        : `${formatCurrency(Number(form.shippingCost), form.currency || 'MXN')} por envío`}
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.shippingCost}
                      onChange={(e) => setForm((f) => ({ ...f, shippingCost: e.target.value }))}
                      placeholder="0.00"
                      className="w-24 text-sm text-right tabular-nums bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--text-primary)] hover:border-gray-400 focus:outline-none focus:border-[#008080] focus:ring-2 focus:ring-[#008080]/20 transition-colors"
                    />
                  </div>
                </li>
              )}

              {/* Estado / Activo */}
              <li className="flex items-center justify-between gap-3 px-3 py-2.5">
                <span className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">
                  Estado
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.isActive}
                  onClick={() => setForm((f) => ({ ...f, isActive: !f.isActive }))}
                  className="relative w-11 h-6 rounded-full transition-colors flex-shrink-0"
                  style={{ backgroundColor: form.isActive ? '#008080' : 'var(--border)' }}
                >
                  <span
                    className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform"
                    style={{ transform: form.isActive ? 'translateX(20px)' : 'translateX(0)' }}
                  />
                </button>
              </li>
            </ul>

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={closeModal} className="btn-secondary">
                Cancelar
              </button>
              <button type="submit" disabled={saveMutation.isPending} className="btn-primary">
                {saveMutation.isPending ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Quick-create Supplier Popup */}
      {showNewSupplier && (
        <Modal title="Nuevo Proveedor" onClose={() => { setShowNewSupplier(false); setSupplierError(null); }}>
          <div className="space-y-4">
            {supplierError && (
              <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{supplierError}</div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
              <input
                type="text"
                value={newSupplierName}
                onChange={(e) => setNewSupplierName(e.target.value)}
                className="input-field"
                placeholder="Nombre del proveedor"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefono (10 digitos)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={10}
                  value={newSupplierPhone}
                  onChange={(e) => setNewSupplierPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  className="input-field"
                  placeholder="Ej: 5512345678"
                />
                {newSupplierPhone && newSupplierPhone.length !== 10 && (
                  <p className="text-xs text-amber-600 mt-1">{newSupplierPhone.length}/10 digitos</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={newSupplierEmail}
                  onChange={(e) => setNewSupplierEmail(e.target.value)}
                  className="input-field"
                  placeholder="correo@ejemplo.com"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pagina web</label>
              <input
                type="url"
                value={newSupplierWebsite}
                onChange={(e) => setNewSupplierWebsite(e.target.value)}
                className="input-field"
                placeholder="https://www.ejemplo.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
              <textarea
                value={newSupplierNotes}
                onChange={(e) => setNewSupplierNotes(e.target.value)}
                className="input-field resize-none"
                rows={2}
                placeholder="Notas sobre el proveedor..."
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => { setShowNewSupplier(false); setSupplierError(null); }} className="btn-secondary">
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleQuickSupplier}
                disabled={!newSupplierName.trim() || quickSupplierMutation.isPending}
                className="btn-primary"
              >
                {quickSupplierMutation.isPending ? 'Creando...' : 'Crear Proveedor'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Quick-add Category Popup */}
      {showNewCategory && (
        <Modal title="Nueva Categoria" onClose={() => setShowNewCategory(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de la categoria *</label>
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                className="input-field"
                placeholder="Ej: Accesorios"
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleQuickCategory(); } }}
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowNewCategory(false)} className="btn-secondary">
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleQuickCategory}
                disabled={!newCategoryName.trim()}
                className="btn-primary"
              >
                Agregar Categoria
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <Modal title="Eliminar Producto" onClose={() => setDeleteConfirm(null)}>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              ¿Estas seguro de que deseas eliminar este producto? Esta accion no se puede deshacer.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="btn-secondary">
                Cancelar
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteConfirm)}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </Modal>
      )}
      {/* Filtros Modal (PWA, igual que en /calendar)
          Los cambios aqui son DRAFT y solo entran en vigor al darle "Aplicar". */}
      {showFilters && (
        <Modal title="Filtros" onClose={() => setShowFilters(false)} size="md">
          <div className="space-y-5">
            {/* Búsqueda */}
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-2">
                Buscar
              </label>
              <input
                type="text"
                value={draftSearch}
                onChange={(e) => setDraftSearch(e.target.value)}
                placeholder="Nombre del producto..."
                className="input-field text-sm py-2"
              />
            </div>

            {/* Categoría — dropdown */}
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-2">
                Categoría
              </label>
              <select
                value={draftFilterCategory}
                onChange={(e) => setDraftFilterCategory(e.target.value)}
                className="w-full text-sm bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--text-primary)] hover:border-gray-400 focus:outline-none focus:border-[#008080] focus:ring-2 focus:ring-[#008080]/20 transition-colors"
              >
                <option value="">Todas las categorías</option>
                {allCategories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Proveedor — dropdown */}
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-2">
                Proveedor
              </label>
              <select
                value={draftFilterSupplier}
                onChange={(e) => setDraftFilterSupplier(e.target.value)}
                className="w-full text-sm bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--text-primary)] hover:border-gray-400 focus:outline-none focus:border-[#008080] focus:ring-2 focus:ring-[#008080]/20 transition-colors"
              >
                <option value="">Todos los proveedores</option>
                {suppliers.map((sup) => (
                  <option key={sup.id} value={sup.id}>{sup.name}</option>
                ))}
              </select>
            </div>

            {/* Stock bajo — toggle */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--text-secondary)]">Solo stock bajo</span>
              <button
                type="button"
                role="switch"
                aria-checked={draftFilterLowStock}
                onClick={() => setDraftFilterLowStock((v) => !v)}
                className="relative w-11 h-6 rounded-full transition-colors flex-shrink-0"
                style={{ backgroundColor: draftFilterLowStock ? '#008080' : 'var(--border)' }}
              >
                <span
                  className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform"
                  style={{ transform: draftFilterLowStock ? 'translateX(20px)' : 'translateX(0)' }}
                />
              </button>
            </div>

            {/* Acciones */}
            <div className="flex items-center gap-2 pt-4 border-t border-[var(--border)]">
              <button
                onClick={clearDraftFilters}
                disabled={!hasDraftFilters}
                className={`flex-1 inline-flex items-center justify-center px-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors whitespace-nowrap ${
                  hasDraftFilters
                    ? 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
                    : 'bg-[var(--bg-subtle)] border-[var(--border)] text-[var(--text-muted)] cursor-not-allowed'
                }`}
              >
                Limpiar
              </button>
              <button
                onClick={applyFilters}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#008080] text-white hover:bg-[#006666] transition-colors"
              >
                Aplicar
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Detalle del producto (read-only) */}
      {viewingProduct && (() => {
        const p = viewingProduct;
        const low = isLowStock(p);
        // Inline = label izq, valor der. Stack = label arriba, valor full-width justificado.
        const inlineRow = (label: string, value: React.ReactNode) => (
          <li key={label} className="flex items-start justify-between gap-3 px-3 py-2.5">
            <span className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide flex-shrink-0 pt-0.5">
              {label}
            </span>
            <span className="text-sm text-[var(--text-primary)] text-right break-words min-w-0">
              {value}
            </span>
          </li>
        );
        const stackRow = (label: string, value: React.ReactNode) => (
          <li key={label} className="px-3 py-2.5 space-y-1.5">
            <span className="block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">
              {label}
            </span>
            <p className="text-sm text-[var(--text-primary)] break-words whitespace-pre-wrap" style={{ textAlign: 'justify' }}>
              {value}
            </p>
          </li>
        );
        return (
          <Modal title="Detalle del producto" onClose={() => setViewingProduct(null)} size="md">
            <div className="space-y-4">
              {/* Imagen grande */}
              <div className="flex justify-center">
                {p.imageUrl ? (
                  <img
                    src={`${API_URL}${p.imageUrl}`}
                    alt={p.name}
                    className="w-32 h-32 rounded-2xl object-cover border border-[var(--border)]"
                  />
                ) : (
                  <div className="w-32 h-32 rounded-2xl bg-gray-100 flex items-center justify-center border border-[var(--border)]">
                    <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Lista de campos */}
              <ul className="divide-y divide-[var(--border)] border border-[var(--border)] rounded-xl overflow-hidden bg-[var(--bg-surface)]">
                {inlineRow('Nombre', p.name)}
                {inlineRow('SKU', p.sku || '—')}
                {inlineRow('Categoría', p.category || '—')}
                {inlineRow('Precio de venta', formatCurrency(p.price, p.currency || 'MXN'))}
                {inlineRow('Costo', formatCurrency(p.costPrice, p.currency || 'MXN'))}
                {inlineRow('Moneda', p.currency || 'MXN')}
                {inlineRow(
                  'Stock actual',
                  <span className={low ? 'font-semibold text-red-600' : 'font-semibold'}>
                    {p.stock} {p.unit || 'pieza'}
                    {low && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-red-50 text-red-700">Stock bajo</span>}
                  </span>,
                )}
                {inlineRow('Stock mínimo', `${p.minStock} ${p.unit || 'pieza'}`)}
                {inlineRow('Unidad', p.unit || 'pieza')}
                {inlineRow('Proveedor', p.supplier?.name || '—')}
                {p.supplierUrl
                  ? stackRow(
                      'URL del proveedor',
                      <a
                        href={p.supplierUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#008080] hover:text-[#006666] underline break-all"
                      >
                        {p.supplierUrl}
                      </a>,
                    )
                  : inlineRow('URL del proveedor', '—')}
                {stackRow('Descripción', p.description || '—')}
                {stackRow('Notas', p.notes || '—')}
                {inlineRow('Visible en tienda', p.isShopListed ? 'Sí' : 'No')}
                {inlineRow(
                  'Envío disponible',
                  p.shippingEnabled
                    ? p.shippingCost
                      ? formatCurrency(p.shippingCost, p.currency || 'MXN')
                      : 'Gratis'
                    : 'No',
                )}
                {inlineRow(
                  'Estado',
                  p.isActive ? (
                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700">Activo</span>
                  ) : (
                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-500">Inactivo</span>
                  ),
                )}
              </ul>

              {/* Acciones */}
              <div className="flex items-center gap-2 pt-2 border-t border-[var(--border)]">
                {hasPermission('inventory.delete') && (
                  <button
                    onClick={() => {
                      setDeleteConfirm(p.id);
                      setViewingProduct(null);
                    }}
                    className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 transition-colors"
                  >
                    Eliminar
                  </button>
                )}
                <div className="flex-1" />
                <button
                  onClick={() => setViewingProduct(null)}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-muted)] transition-colors"
                >
                  Cerrar
                </button>
                {hasPermission('inventory.update') && (
                  <button
                    onClick={() => {
                      setViewingProduct(null);
                      openEdit(p);
                    }}
                    className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#008080] text-white hover:bg-[#006666] transition-colors"
                  >
                    Editar
                  </button>
                )}
              </div>
            </div>
          </Modal>
        );
      })()}

      {/* Image Crop Modal */}
      {cropFile && (
        <AvatarCropModal
          imageFile={cropFile}
          shape="square"
          onAccept={(croppedFile) => {
            setCropFile(null);
            setPendingImage(croppedFile);
            setImagePreview(URL.createObjectURL(croppedFile));
          }}
          onCancel={() => setCropFile(null)}
          onChooseAnother={() => {
            setCropFile(null);
            // Re-trigger file input
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/jpeg,image/png,image/webp';
            input.onchange = (e: any) => {
              const file = e.target?.files?.[0];
              if (file) setCropFile(file);
            };
            input.click();
          }}
        />
      )}
    </div>
  );
}
