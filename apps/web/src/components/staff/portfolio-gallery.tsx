// ============================================================
// ARCHIVO: portfolio-gallery.tsx
// ¿QUÉ HACE ESTE COMPONENTE?
//   Galería de portafolio del empleado. Muestra las fotos de trabajos
//   realizados en un grid de 3 columnas estilo Instagram. Permite:
//     - Subir nuevas fotos (JPEG, PNG, WebP, máx. 5MB).
//     - Filtrar por categoría de servicio, visibilidad y orden.
//     - Buscar fotos por texto (caption o nombre de servicio).
//     - Abrir un lightbox (visor a pantalla completa) al hacer clic.
//     - Desde el lightbox: destacar, ocultar/mostrar o eliminar fotos.
// ¿QUÉ RECIBE? (props)
//   - employeeId: ID del empleado cuyo portafolio se muestra.
//   - canEdit: si el usuario puede subir/eliminar/modificar fotos.
// ============================================================

'use client';
// Necesario para usar hooks y eventos interactivos.

import { useState, useRef, useMemo } from 'react';
// useState: todos los estados de la UI (filtros, lightbox, etc.).
// useRef: referencia al input[type=file] oculto para subir fotos.
// useMemo: calcula valores derivados (categorías, filtros aplicados)
//   sin recalcular en cada render si sus dependencias no cambiaron.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
// useQuery: carga el portafolio desde el servidor.
// useMutation: sube, elimina, oculta y destaca fotos.
// useQueryClient: invalida caché para refrescar la galería.

import { api, ApiResponse } from '@/lib/api';
// api: módulo de HTTP. ApiResponse: tipo genérico de respuesta { data: T }.

// ─── TIPOS ──────────────────────────────────────────────────

interface PortfolioImage {
  // Una imagen del portafolio del empleado.
  id: string;
  imageUrl: string;          // ruta relativa al archivo (ej: "/uploads/img.jpg")
  caption?: string | null;   // descripción opcional de la foto
  isHidden?: boolean;        // si está oculta del perfil público
  isFeatured?: boolean;      // si está destacada (aparece primero)
  services?: { id: string; name: string }[];  // servicios asociados a la foto
  createdAt: string;         // fecha ISO de subida
}

interface PortfolioGalleryProps {
  employeeId: string;
  canEdit: boolean;
}

// ─── CONSTANTES ─────────────────────────────────────────────

// URL base del servidor para construir URLs absolutas de imágenes.
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Color teal del proyecto, usado en estilos inline de los filtros.
const TEAL = '#008080';

// Tipos de filtro de visibilidad. Solo puede ser uno de estos cuatro valores.
type VisibilityFilter = 'all' | 'visible' | 'hidden' | 'featured';

// Tipos de ordenación disponibles.
type SortKey = 'recent' | 'oldest';

// ─── COMPONENTE PRINCIPAL ────────────────────────────────────
export function PortfolioGallery({ employeeId, canEdit }: PortfolioGalleryProps) {
  const queryClient = useQueryClient();

  // Ref al input[type=file] oculto dentro del botón de "+" para subir fotos.
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Estados de la UI ─────────────────────────────────────

  // Imagen actualmente abierta en el lightbox. null = lightbox cerrado.
  const [lightboxImage, setLightboxImage] = useState<PortfolioImage | null>(null);

  // Texto de búsqueda para filtrar por caption o nombre de servicio.
  const [search, setSearch] = useState('');

  // Multi-seleccion de categorias: array de service ids. Vacio = "Todos".
  // Array de IDs de servicios activos como filtro de categoría.
  // Vacío = sin filtro (mostrar todas las fotos).
  const [activeCategories, setActiveCategories] = useState<string[]>([]);

  // Filtro de visibilidad activo.
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>('all');

  // Orden de las fotos: 'recent' (más nueva primero) o 'oldest'.
  const [sortBy, setSortBy] = useState<SortKey>('recent');

  // Si el panel lateral de filtros está abierto.
  const [showFiltersSheet, setShowFiltersSheet] = useState(false);

  // IDs de imagenes con archivo roto/404 en disco. Las ocultamos del grid
  // para que no queden recuadros vacios con el alt-text visible.
  // Set<string>: conjunto de IDs de imágenes que fallaron al cargar.
  const [failedImageIds, setFailedImageIds] = useState<Set<string>>(new Set());

  // ─── QUERY: portafolio del empleado ─────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ['employee-portfolio', employeeId],
    queryFn: () =>
      api.get<ApiResponse<PortfolioImage[]>>(
        `/api/employees/${employeeId}/portfolio`,
      ),
  });
  // Extraemos el array de imágenes (o [] si aún no cargó).
  const images = data?.data || [];

  // ─── MUTATION: subir foto ────────────────────────────────
  const uploadMutation = useMutation({
    mutationFn: (file: File) =>
      api.upload(`/api/employees/${employeeId}/portfolio`, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-portfolio', employeeId] });
    },
  });

  // ─── MUTATION: eliminar foto ─────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: (imageId: string) =>
      api.delete(`/api/employees/${employeeId}/portfolio/${imageId}`),
    // onSuccess recibe (data, variables) donde variables = el argumento que
    // se pasó a .mutate() — en este caso el imageId.
    onSuccess: async (_data, imageId) => {
      // Optimistic: marcar como fallida tambien para que no quede el
      // recuadro vacio si el refetch tarda. Despues forzar refetch.
      // La imagen ya no existe, así que la marcamos como "fallida" para
      // ocultarla inmediatamente antes de que el refetch llegue.
      setFailedImageIds((prev) => new Set(prev).add(imageId));
      setLightboxImage(null);  // cerrar el lightbox si estaba abierto
      // refetchQueries fuerza un GET inmediato (a diferencia de invalidate
      // que lo pospone al próximo uso).
      await queryClient.refetchQueries({ queryKey: ['employee-portfolio', employeeId] });
    },
  });

  // ─── MUTATION: cambiar visibilidad ──────────────────────
  const toggleVisibilityMutation = useMutation({
    mutationFn: ({ imageId, isHidden }: { imageId: string; isHidden: boolean }) =>
      api.patch(`/api/employees/${employeeId}/portfolio/${imageId}/visibility`, { isHidden }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['employee-portfolio', employeeId] });
      // Si el lightbox está abierto con ESTA imagen, actualizamos su estado
      // local para que el botón de "Ocultar/Mostrar" refleje el cambio.
      if (lightboxImage?.id === variables.imageId) {
        setLightboxImage({ ...lightboxImage, isHidden: variables.isHidden });
      }
    },
  });

  // ─── MUTATION: cambiar destacado ────────────────────────
  const toggleFeaturedMutation = useMutation({
    mutationFn: ({ imageId, isFeatured }: { imageId: string; isFeatured: boolean }) =>
      api.patch(`/api/employees/${employeeId}/portfolio/${imageId}/featured`, { isFeatured }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['employee-portfolio', employeeId] });
      // Igual que con visibilidad: actualizamos el lightbox si está abierto.
      if (lightboxImage?.id === variables.imageId) {
        setLightboxImage({ ...lightboxImage, isFeatured: variables.isFeatured });
      }
    },
  });

  // ─── handleFileSelect ────────────────────────────────────
  // Manejador del onChange del input[type=file].
  // Valida el tipo y tamaño del archivo antes de subir.
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      alert('Solo se permiten archivos JPEG, PNG o WebP');
      return;
    }
    // 5 * 1024 * 1024 = 5 MB en bytes.
    if (file.size > 5 * 1024 * 1024) {
      alert('El archivo no puede superar 5MB');
      return;
    }

    uploadMutation.mutate(file);
    // Limpiamos el input para que se pueda subir el mismo archivo de nuevo.
    e.target.value = '';
  }

  // Categorias derivadas de los services unicos de las imagenes.
  // useMemo recalcula solo cuando cambia el array "images".
  const categories = useMemo(() => {
    // Usamos un Map para deduplicar: si el mismo servicio aparece en
    // múltiples fotos, solo lo listamos una vez.
    // Map<id, name>: clave = ID del servicio, valor = nombre del servicio.
    const map = new Map<string, string>();
    for (const img of images) {
      // "img.services || []" = si services es undefined, usamos [].
      for (const s of img.services || []) {
        if (!map.has(s.id)) map.set(s.id, s.name);
      }
    }
    // Convertimos el Map a array de objetos { id, name }.
    // Array.from(map.entries()) = [[id1, name1], [id2, name2], ...]
    // .map(([id, name]) => ...) = transformamos cada par a objeto.
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [images]);

  // Pipeline de filtros: categoria + visibilidad + busqueda + sort.
  // Tambien quita imagenes cuyo archivo fallo al cargar (404) para no
  // dejar recuadros vacios con el alt-text "Portafolio" visible.
  // useMemo recalcula cuando cambia cualquiera de sus dependencias.
  const filtered = useMemo(() => {
    // Convertimos la búsqueda a minúsculas para comparación insensible a mayúsculas.
    const q = search.trim().toLowerCase();
    // Set para búsqueda O(1) de categorías activas.
    const categorySet = new Set(activeCategories);

    let result = images.filter((img) => {
      // Excluir imágenes con archivo roto.
      if (failedImageIds.has(img.id)) return false;

      // Si hay categorias activas, la foto debe estar en al menos una.
      // .some() devuelve true si al menos un elemento cumple la condición.
      // Si categorySet está vacío, pasamos todas las fotos (sin filtro de categoría).
      if (categorySet.size > 0 && !(img.services || []).some((s) => categorySet.has(s.id))) return false;

      // Filtros de visibilidad.
      if (visibilityFilter === 'visible' && img.isHidden) return false;
      if (visibilityFilter === 'hidden' && !img.isHidden) return false;
      if (visibilityFilter === 'featured' && !img.isFeatured) return false;

      // Filtro de búsqueda: buscamos en el caption y en los nombres de servicios.
      if (q) {
        // Construimos un string "haystack" con todo el texto buscable de esta imagen.
        // [img.caption || '', ...(img.services || []).map((s) => s.name)]
        //   - img.caption || '': el caption o string vacío si no hay caption.
        //   - Spread de nombres de servicios: ["Corte", "Color", ...]
        // .join(' '): unimos todo en un string separado por espacios.
        // .toLowerCase(): convertimos a minúsculas para comparación sin distinción.
        const haystack = [img.caption || '', ...(img.services || []).map((s) => s.name)]
          .join(' ')
          .toLowerCase();
        // .includes(q): true si el texto de búsqueda aparece en el haystack.
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    // Ordenamos el resultado según el criterio seleccionado.
    // [...result] crea una copia para no mutar el array original.
    result = [...result].sort((a, b) => {
      // .getTime() convierte la fecha a milisegundos desde el epoch.
      const at = new Date(a.createdAt).getTime();
      const bt = new Date(b.createdAt).getTime();
      // 'recent': la más nueva primero (bt - at = descendente).
      // 'oldest': la más antigua primero (at - bt = ascendente).
      return sortBy === 'recent' ? bt - at : at - bt;
    });
    return result;
  }, [images, activeCategories, visibilityFilter, search, sortBy, failedImageIds]);
  // Las dependencias del useMemo: se recalcula cuando cualquiera cambia.

  // hasFilters: true si hay algún filtro activo (para mostrar el badge rojo).
  const hasFilters = !!search || activeCategories.length > 0 || visibilityFilter !== 'all' || sortBy !== 'recent';
  // "!!" convierte el string "search" a boolean (truthy si no está vacío).

  // toggleCategory: activa o desactiva una categoría en el filtro multi-selección.
  const toggleCategory = (id: string) => {
    setActiveCategories((prev) =>
      // Si ya está en el array, lo eliminamos (.filter() excluye los que coinciden).
      // Si no está, lo añadimos al final (spread + nuevo id).
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  // ─── Estado de carga ─────────────────────────────────────
  if (isLoading) {
    return (
      <div className="px-4 md:px-6">
        <div className="grid grid-cols-3 gap-1">
          {/* 9 esqueletos en forma de grid 3x3 */}
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="aspect-square bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // ─── JSX principal ───────────────────────────────────────
  return (
    <div className="px-4 md:px-6">
      {/* ─── Header: busqueda + filtros + upload ─────────── */}
      <div className="flex items-center gap-2 mb-3">
        {/* Campo de búsqueda con ícono de lupa */}
        <div className="relative flex-1 min-w-0">
          {/* Ícono absoluto posicionado dentro del input */}
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar foto, servicio…"
            className="w-full bg-white border border-gray-200 rounded-full pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-[#008080]"
            // "pl-9" = padding-left de 36px para dejar espacio al ícono de lupa.
          />
        </div>

        {/* Botón de filtros: cambia de color cuando hay filtros activos */}
        <button
          onClick={() => setShowFiltersSheet(true)}
          title="Filtros"
          className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 relative transition-colors"
          // Estilo inline condicional: si hay filtros activos, fondo teal;
          // si no, fondo blanco con borde gris.
          style={hasFilters
            ? { backgroundColor: TEAL, color: 'white', border: '1.5px solid ' + TEAL }
            : { backgroundColor: 'white', color: '#6b7280', border: '1.5px solid #e5e7eb' }
          }
        >
          {/* Ícono de ajustes/filtros */}
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
          </svg>
          {/* Punto rojo de notificación: visible solo si hay filtros activos */}
          {hasFilters && (
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-gray-50" />
          )}
        </button>

        {/* Botón de subir foto: solo visible si canEdit */}
        {canEdit && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            // "fileInputRef.current?.click()" abre el selector de archivos
            // del input oculto. El "?." evita error si current es null.
            disabled={uploadMutation.isPending}
            title="Agregar foto"
            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-white transition-colors"
            style={{ backgroundColor: TEAL, border: '1.5px solid ' + TEAL }}
          >
            {/* Spinner durante la subida, o ícono "+" cuando está libre */}
            {uploadMutation.isPending ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            )}
            {/* Input oculto dentro del botón para subir archivos */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileSelect}
              className="hidden"
            />
          </button>
        )}
      </div>

      {/* Chip de categorías activas (resumen — el control real está en
          el sheet de filtros). Muestra cuántas categorías están aplicadas
          con un X para limpiar todas de un golpe. */}
      {/* Chips de categorías activas: solo visibles si hay alguna. */}
      {activeCategories.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          {/* .map() sobre los IDs de categorías activas. */}
          {activeCategories.map((catId) => {
            // Buscamos el objeto { id, name } correspondiente al catId.
            const cat = categories.find((c) => c.id === catId);
            // Si no encontramos la categoría (caso raro), no renderizamos nada.
            if (!cat) return null;
            return (
              // Chip con el nombre de la categoría y botón "X" para quitarla.
              <span
                key={catId}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--primary-tint)] text-[var(--primary-tint-fg)]"
              >
                {cat.name}
                <button
                  type="button"
                  onClick={() => toggleCategory(catId)}
                  className="hover:opacity-70"
                  aria-label={`Quitar ${cat.name}`}
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* ─── Grid ─────────────────────────────────────── */}
      {/* Si no hay fotos después de aplicar los filtros, mostramos mensaje. */}
      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400 text-sm">
            {/* Ternario: mensaje diferente si había filtros o si está vacío. */}
            {hasFilters ? 'Sin resultados para los filtros aplicados' : 'No hay fotos en el portafolio'}
          </p>
        </div>
      ) : (
        // Grid de 3 columnas con las fotos filtradas.
        <div className="grid grid-cols-3 gap-1">
          {/* .map() genera un div por cada imagen filtrada.
              "img" = objeto PortfolioImage */}
          {filtered.map((img) => (
            <div
              key={img.id}
              // "aspect-square" mantiene el elemento cuadrado (1:1).
              // "overflow-hidden" recorta la imagen dentro del cuadrado.
              // "group" activa estilos "group-hover:" en los hijos al hacer hover.
              className="relative aspect-square rounded-xl overflow-hidden group cursor-pointer"
              // Al hacer clic en la tarjeta, abrimos el lightbox con esta imagen.
              onClick={() => setLightboxImage(img)}
            >
              <img
                src={`${API_URL}${img.imageUrl}`}
                alt=""  // alt vacío porque es imagen decorativa (portafolio)
                // "grayscale" en Tailwind aplica filtro CSS de escala de grises.
                // Las fotos ocultas se muestran más apagadas visualmente.
                className={`w-full h-full object-cover bg-gray-100 ${img.isHidden ? 'opacity-50 grayscale' : ''}`}
                // onError se dispara si la imagen no carga (archivo 404 o roto).
                // Añadimos el ID al Set de imágenes fallidas para ocultarla.
                onError={() => setFailedImageIds((prev) => new Set(prev).add(img.id))}
              />
              {/* Badge de "destacada" (estrella dorada): solo si isFeatured */}
              {img.isFeatured && (
                <span className="absolute top-1.5 right-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-400 text-white text-[10px] font-bold shadow-sm">
                  <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                  </svg>
                </span>
              )}
              {/* Badge de "oculta" (ícono de ojo tachado): solo si isHidden */}
              {img.isHidden && (
                <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-gray-900/80 text-white text-[10px] font-semibold">
                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                </span>
              )}
              {/* Servicios asociados: banner oscuro en la parte inferior de la foto */}
              {img.services && img.services.length > 0 && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                  <p className="text-[10px] text-white font-medium truncate">
                    {/* Une los nombres de los servicios con " · " como separador */}
                    {img.services.map((s) => s.name).join(' · ')}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ─── Bottom sheet filtros ────────────────────── */}
      {/* Panel deslizable desde abajo con los controles de filtro.
          Solo visible cuando showFiltersSheet es true. */}
      {showFiltersSheet && (
        // Overlay de fondo oscuro que ocupa toda la pantalla.
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ touchAction: 'none' }}>
          {/* Fondo oscuro: al hacer clic cierra el panel. */}
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowFiltersSheet(false)} />
          {/* Panel blanco con bordes redondeados en la parte superior. */}
          <div className="relative w-full max-w-lg bg-white rounded-t-2xl shadow-xl pb-safe">
            {/* Indicador visual de "drag" (barra gris arriba) */}
            <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 bg-gray-300 rounded-full" /></div>
            {/* Header del panel con título y botón de cierre */}
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">Filtros</h3>
              <button onClick={() => setShowFiltersSheet(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">
                <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-5 py-4">
              {/* Botón "Limpiar filtros": solo visible si hay algún filtro activo */}
              {hasFilters && (
                <button
                  // Al hacer clic, restablecemos todos los filtros a sus valores por defecto.
                  onClick={() => { setSearch(''); setActiveCategories([]); setVisibilityFilter('all'); setSortBy('recent'); }}
                  className="w-full flex items-center justify-center gap-1.5 mb-4 py-2 rounded-xl text-xs font-medium border transition-colors"
                  style={{ color: '#dc2626', borderColor: '#fecaca', backgroundColor: '#fef2f2' }}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  Limpiar filtros
                </button>
              )}

              {/* Categorias (multi-seleccion). Vacio = mostrar todas. */}
              {/* Sección de categorías: solo si hay categorías disponibles */}
              {categories.length > 0 && (
                <>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Categorías</p>
                  <div className="flex flex-wrap gap-1.5 mb-5">
                    {/* Botón "Todas" para limpiar el filtro de categorías */}
                    <button
                      onClick={() => setActiveCategories([])}
                      className="px-3 py-1.5 rounded-full text-xs font-medium border transition-colors"
                      // Activo (teal) cuando no hay categorías seleccionadas.
                      style={activeCategories.length === 0
                        ? { backgroundColor: TEAL, color: 'white', borderColor: TEAL }
                        : { backgroundColor: 'white', color: '#6b7280', borderColor: '#e5e7eb' }
                      }
                    >
                      Todas
                    </button>
                    {/* Botón por cada categoría disponible */}
                    {categories.map((cat) => {
                      // Comprobamos si esta categoría está activa.
                      const active = activeCategories.includes(cat.id);
                      return (
                        <button
                          key={cat.id}
                          onClick={() => toggleCategory(cat.id)}
                          className="px-3 py-1.5 rounded-full text-xs font-medium border transition-colors flex items-center gap-1"
                          style={active
                            ? { backgroundColor: TEAL, color: 'white', borderColor: TEAL }
                            : { backgroundColor: 'white', color: '#6b7280', borderColor: '#e5e7eb' }
                          }
                        >
                          {cat.name}
                          {/* Palomita visible solo cuando la categoría está activa */}
                          {active && (
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Sección de filtro de visibilidad */}
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Visibilidad</p>
              <div className="flex flex-wrap gap-1.5 mb-5">
                {/* Creamos el array de opciones en línea con tipo explícito.
                    "as { value: VisibilityFilter; label: string }[]" es una
                    aserción de tipo para que TS no infiera el tipo como string. */}
                {([
                  { value: 'all', label: 'Todas' },
                  { value: 'visible', label: 'Visibles' },
                  { value: 'hidden', label: 'Ocultas' },
                  { value: 'featured', label: 'Destacadas' },
                ] as { value: VisibilityFilter; label: string }[]).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setVisibilityFilter(opt.value)}
                    className="px-3 py-1.5 rounded-full text-xs font-medium border transition-colors"
                    style={visibilityFilter === opt.value
                      ? { backgroundColor: TEAL, color: 'white', borderColor: TEAL }
                      : { backgroundColor: 'white', color: '#6b7280', borderColor: '#e5e7eb' }
                    }
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Sección de ordenación */}
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Ordenar por</p>
              <div className="flex flex-wrap gap-1.5">
                {([
                  { value: 'recent', label: 'Más reciente' },
                  { value: 'oldest', label: 'Más antigua' },
                ] as { value: SortKey; label: string }[]).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setSortBy(opt.value)}
                    className="px-3 py-1.5 rounded-full text-xs font-medium border transition-colors"
                    style={sortBy === opt.value
                      ? { backgroundColor: TEAL, color: 'white', borderColor: TEAL }
                      : { backgroundColor: 'white', color: '#6b7280', borderColor: '#e5e7eb' }
                    }
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            {/* Espaciado inferior para evitar que el contenido quede tapado
                por la barra de navegación en iOS (safe area insets). */}
            <div className="px-4 py-4" />
          </div>
        </div>
      )}

      {/* ─── Lightbox ─────────────────────────────────── */}
      {/* Visor de imagen a pantalla completa. Solo visible cuando
          lightboxImage tiene valor (no es null). */}
      {lightboxImage && (
        // Fondo oscuro. Al hacer clic fuera de la imagen, cierra el lightbox.
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          {/* Contenedor de la imagen. stopPropagation evita que el clic
              en la imagen misma cierre el lightbox. */}
          <div
            className="relative max-w-3xl max-h-[85vh] w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Imagen a pantalla completa */}
            <img
              src={`${API_URL}${lightboxImage.imageUrl}`}
              alt=""
              className="w-full h-full object-contain rounded-lg"
              // "object-contain" muestra la imagen completa sin recortar,
              // manteniendo la proporción (con barras si es necesario).
            />
            {/* Caption (descripción) debajo de la imagen */}
            {lightboxImage.caption && (
              <p className="text-white text-sm mt-2 text-center">{lightboxImage.caption}</p>
            )}
            {/* Botones de acción en la esquina superior derecha */}
            <div className="absolute top-2 right-2 flex gap-2">
              {/* Botones de edición: solo visibles si canEdit */}
              {canEdit && (
                <>
                  {/* Botón "Destacar/Quitar destacado" */}
                  <button
                    type="button"
                    // "!lightboxImage.isFeatured" invierte el estado actual.
                    onClick={() => toggleFeaturedMutation.mutate({ imageId: lightboxImage.id, isFeatured: !lightboxImage.isFeatured })}
                    disabled={toggleFeaturedMutation.isPending}
                    className="px-3 py-2 rounded-full transition-colors text-xs font-semibold flex items-center gap-1.5"
                    // Fondo dorado si está destacada, blanco si no.
                    style={lightboxImage.isFeatured
                      ? { backgroundColor: '#f59e0b', color: 'white' }
                      : { backgroundColor: 'rgba(255,255,255,0.9)', color: '#374151' }
                    }
                    title={lightboxImage.isFeatured ? 'Quitar destacado' : 'Destacar foto'}
                  >
                    {/* Ícono de estrella: rellena si está destacada, vacía si no */}
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill={lightboxImage.isFeatured ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                    </svg>
                    {lightboxImage.isFeatured ? 'Destacada' : 'Destacar'}
                  </button>

                  {/* Botón "Ocultar/Mostrar en perfil público" */}
                  <button
                    type="button"
                    onClick={() => toggleVisibilityMutation.mutate({ imageId: lightboxImage.id, isHidden: !lightboxImage.isHidden })}
                    disabled={toggleVisibilityMutation.isPending}
                    className="px-3 py-2 bg-white/90 text-gray-700 rounded-full hover:bg-white transition-colors text-xs font-semibold flex items-center gap-1.5"
                    title={lightboxImage.isHidden ? 'Mostrar en perfil publico' : 'Ocultar del perfil publico'}
                  >
                    {/* Contenido condicional: ícono y texto según estado de visibilidad */}
                    {lightboxImage.isHidden ? (
                      // Si está oculta, mostramos "Mostrar" (para revertir)
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Mostrar
                      </>
                    ) : (
                      // Si está visible, mostramos "Ocultar" (para ocultarla)
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                        </svg>
                        Ocultar
                      </>
                    )}
                  </button>

                  {/* Botón "Eliminar" */}
                  <button
                    type="button"
                    onClick={() => deleteMutation.mutate(lightboxImage.id)}
                    disabled={deleteMutation.isPending}
                    className="p-2 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors"
                    title="Eliminar"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </>
              )}
              {/* Botón de cerrar el lightbox (siempre visible) */}
              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                className="p-2 bg-white/20 text-white rounded-full hover:bg-white/30 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
