'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { usePermissions } from '@/lib/hooks/use-permissions';
import { Modal } from '@/components/ui/modal';
import { AvatarCropModal } from '@/components/ui/avatar-crop-modal';
import { formatCurrency } from '@/lib/utils';

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

  // Filters
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterSupplier, setFilterSupplier] = useState('');
  const [filterLowStock, setFilterLowStock] = useState(false);
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
    return product.stock <= product.minStock;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-3 md:p-6">
        <div className="flex items-center justify-between mb-5">
          <p className="text-sm text-gray-500">{products.length} producto{products.length !== 1 ? 's' : ''}</p>
          {hasPermission('inventory.create') && (
            <button onClick={openCreate} className="btn-primary">
              + Agregar Producto
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Buscar por nombre..."
            className="input-field w-64"
          />
          <select
            value={filterCategory}
            onChange={(e) => {
              setFilterCategory(e.target.value);
              setPage(1);
            }}
            className="input-field w-48"
          >
            <option value="">Todas las categorias</option>
            {allCategories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <select
            value={filterSupplier}
            onChange={(e) => {
              setFilterSupplier(e.target.value);
              setPage(1);
            }}
            className="input-field w-48"
          >
            <option value="">Todos los proveedores</option>
            {suppliers.map((sup) => (
              <option key={sup.id} value={sup.id}>
                {sup.name}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600">
            <div className="relative">
              <input
                type="checkbox"
                checked={filterLowStock}
                onChange={(e) => {
                  setFilterLowStock(e.target.checked);
                  setPage(1);
                }}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-200 rounded-full peer-checked:bg-red-500 peer-focus:ring-2 peer-focus:ring-red-300 transition-colors" />
              <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow peer-checked:translate-x-4 transition-transform" />
            </div>
            Stock bajo
          </label>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="animate-pulse p-6 space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-4">
                  <div className="h-4 bg-gray-200 rounded w-1/6" />
                  <div className="h-4 bg-gray-200 rounded w-1/8" />
                  <div className="h-4 bg-gray-200 rounded w-1/6" />
                  <div className="h-4 bg-gray-200 rounded w-1/8" />
                  <div className="h-4 bg-gray-200 rounded w-1/8" />
                  <div className="h-4 bg-gray-200 rounded w-1/12" />
                </div>
              ))}
            </div>
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
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Nombre</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">SKU</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Categoria</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Precio</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Costo</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">Stock</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">Min.</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Proveedor</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">Estado</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {products.map((product) => (
                    <tr
                      key={product.id}
                      className={`hover:bg-gray-50 transition-colors ${
                        isLowStock(product) ? 'bg-red-50/50' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {product.imageUrl && (
                            <img src={`${API_URL}${product.imageUrl}`} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" />
                          )}
                          <div>
                            <div className="font-medium text-gray-900 flex items-center gap-1.5">
                              {product.name}
                              {product.isShopListed && (
                                <span className="px-1.5 py-0.5 text-[9px] font-medium rounded bg-teal-50 text-teal-700">Tienda</span>
                              )}
                            </div>
                            {product.description && (
                              <div className="text-xs text-gray-400 line-clamp-1">{product.description}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                        {product.sku || '-'}
                      </td>
                      <td className="px-4 py-3">
                        {product.category ? (
                          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
                            {product.category}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-900 font-medium">
                        {formatCurrency(product.price, product.currency || 'MXN')}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-500">
                        {formatCurrency(product.costPrice, product.currency || 'MXN')}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {isLowStock(product) ? (
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
                          <span>{product.supplier?.name || '-'}</span>
                          {product.supplierUrl && (
                            <a
                              href={product.supplierUrl}
                              target="_blank"
                              rel="noopener noreferrer"
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
                              onClick={() => openEdit(product)}
                              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700"
                              title="Editar"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                />
                              </svg>
                            </button>
                          )}
                          {hasPermission('inventory.delete') && (
                            <button
                              onClick={() => setDeleteConfirm(product.id)}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600"
                              title="Eliminar"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {meta && meta.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
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
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <Modal
          title={editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
          onClose={closeModal}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            {formError && (
              <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{formError}</div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="input-field"
                placeholder="Ej: Tinte L'Oreal Majirel"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
                <input
                  type="text"
                  value={form.sku}
                  onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
                  className="input-field"
                  placeholder="Ej: TIN-LOR-001"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
                <div className="flex gap-2">
                  <select
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                    className="input-field flex-1"
                  >
                    <option value="">Sin categoria</option>
                    {allCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => { setNewCategoryName(''); setShowNewCategory(true); }}
                    className="px-2.5 py-2 text-sm font-medium rounded-lg border border-gray-300 text-primary-600 hover:bg-primary-50 whitespace-nowrap"
                    title="Agregar categoria"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descripcion</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="input-field resize-none"
                rows={2}
                placeholder="Descripcion opcional..."
              />
            </div>

            {/* Currency */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Moneda</label>
              <select
                value={form.currency}
                onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                className="input-field w-48"
              >
                <option value="MXN">MXN - Peso Mexicano</option>
                <option value="USD">USD - Dolar Estadounidense</option>
                <option value="EUR">EUR - Euro</option>
                <option value="COP">COP - Peso Colombiano</option>
                <option value="ARS">ARS - Peso Argentino</option>
                <option value="CLP">CLP - Peso Chileno</option>
                <option value="PEN">PEN - Sol Peruano</option>
                <option value="BRL">BRL - Real Brasileno</option>
                <option value="DOP">DOP - Peso Dominicano</option>
                <option value="GTQ">GTQ - Quetzal</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Precio de venta *</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                  className="input-field"
                  placeholder="0.00"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Costo *</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.costPrice}
                  onChange={(e) => setForm((f) => ({ ...f, costPrice: e.target.value }))}
                  className="input-field"
                  placeholder="0.00"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stock actual</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.stock}
                  onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stock minimo</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.minStock}
                  onChange={(e) => setForm((f) => ({ ...f, minStock: e.target.value }))}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Unidad</label>
                <select
                  value={form.unit}
                  onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                  className="input-field"
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
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Proveedor</label>
              <div className="flex gap-2">
                <select
                  value={form.supplierId}
                  onChange={(e) => setForm((f) => ({ ...f, supplierId: e.target.value }))}
                  className="input-field flex-1"
                >
                  <option value="">Sin proveedor</option>
                  {suppliers.map((sup) => (
                    <option key={sup.id} value={sup.id}>
                      {sup.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => { setNewSupplierName(''); setNewSupplierPhone(''); setNewSupplierEmail(''); setShowNewSupplier(true); }}
                  className="px-2.5 py-2 text-sm font-medium rounded-lg border border-gray-300 text-primary-600 hover:bg-primary-50 whitespace-nowrap"
                  title="Agregar proveedor"
                >
                  +
                </button>
              </div>
            </div>

            {/* Supplier URL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Enlace de compra al proveedor</label>
              <input
                type="url"
                value={form.supplierUrl}
                onChange={(e) => setForm((f) => ({ ...f, supplierUrl: e.target.value }))}
                className="input-field"
                placeholder="https://www.proveedor.com/producto"
              />
              <p className="text-xs text-gray-400 mt-1">URL para reordenar este producto con el proveedor</p>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                className="input-field resize-none"
                rows={2}
                placeholder="Notas internas sobre este producto..."
              />
            </div>

            {/* Product Image */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Imagen del producto</label>
              <div className="flex items-center gap-4">
                {imagePreview ? (
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-16 h-16 rounded-lg object-cover border border-gray-200"
                  />
                ) : editingProduct?.imageUrl ? (
                  <img
                    src={`${API_URL}${editingProduct.imageUrl}`}
                    alt={editingProduct.name}
                    className="w-16 h-16 rounded-lg object-cover border border-gray-200"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 border border-gray-200">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
                    </svg>
                  </div>
                )}
                <label className="cursor-pointer text-sm font-medium text-primary-600 hover:text-primary-700">
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

            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-sm font-medium text-gray-700">Mostrar en tienda</p>
                <p className="text-xs text-gray-500">Visible para clientes en tu perfil publico</p>
              </div>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={form.isShopListed}
                  onChange={(e) => setForm((f) => ({ ...f, isShopListed: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 rounded-full peer-checked:bg-primary-600 peer-focus:ring-2 peer-focus:ring-primary-300 transition-colors" />
                <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow peer-checked:translate-x-5 transition-transform" />
              </div>
            </label>

            {/* Shipping - only shown when isShopListed */}
            {form.isShopListed && (
              <div>
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Envio local disponible</p>
                    <p className="text-xs text-gray-500">Permite que este producto pueda ser enviado al cliente a su casa o ubicacion</p>
                  </div>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={form.shippingEnabled}
                      onChange={(e) => setForm((f) => ({ ...f, shippingEnabled: e.target.checked, ...(!e.target.checked && { shippingCost: '' }) }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 rounded-full peer-checked:bg-primary-600 peer-focus:ring-2 peer-focus:ring-primary-300 transition-colors" />
                    <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow peer-checked:translate-x-5 transition-transform" />
                  </div>
                </label>
                {form.shippingEnabled && (
                  <div className="mt-3 pl-4 border-l-2 border-gray-200">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Costo de envio local</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.shippingCost}
                        onChange={(e) => setForm((f) => ({ ...f, shippingCost: e.target.value }))}
                        className="input-field w-40"
                        placeholder="0.00"
                      />
                      <p className="text-xs text-gray-500">
                        {!form.shippingCost || Number(form.shippingCost) === 0
                          ? 'Envio gratis'
                          : `${formatCurrency(Number(form.shippingCost), form.currency || 'MXN')} por envio`}
                      </p>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Deja en 0 o vacio para envio gratis</p>
                  </div>
                )}
                {!form.shippingEnabled && (
                  <p className="text-xs text-gray-400 mt-1">Este producto solo podra recogerse en tienda</p>
                )}
              </div>
            )}

            <label className="flex items-center justify-between cursor-pointer">
              <p className="text-sm font-medium text-gray-700">Activo</p>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 rounded-full peer-checked:bg-primary-600 peer-focus:ring-2 peer-focus:ring-primary-300 transition-colors" />
                <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow peer-checked:translate-x-5 transition-transform" />
              </div>
            </label>

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
