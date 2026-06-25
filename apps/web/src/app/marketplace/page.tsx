// ============================================================
// ARCHIVO: apps/web/src/app/marketplace/page.tsx
// ROL: Página principal del marketplace → lista de negocios con filtros.
//
// ¿Qué muestra?
//   1. Header sticky con barra de búsqueda, botones de filtro y tab Negocios/Profesionales.
//   2. Lista de tarjetas de negocios (MarketplaceBusinessCard) filtrados/ordenados.
//   3. Modal "bottom sheet" de Filtros (categoría + ordenamiento).
//   4. Animación "heartPop" para el corazón de favoritos.
//
// Flujo de datos:
//   - useQuery 'marketplace-discover': pide la lista de negocios a la API
//     con los filtros activos (search, category, sortBy, availableNow, coords GPS).
//   - useQuery 'marketplace-my-favorites': pide los favoritos del usuario autenticado.
//   - useMutation toggleFavMutation: marca/desmarca favorito (con UI optimista).
//   - Si ?shop=1 → navega al shop de cada negocio en vez de al detalle.
//   - Si ?favorites=1 → activa automáticamente el filtro de solo favoritos.
// ============================================================

// 'use client': usa múltiples hooks → se ejecuta en el navegador.
'use client';

// useState: hook para estado local del componente.
// useEffect: hook para efectos secundarios (GPS, favoritos, searchParams).
import { useState, useEffect } from 'react';

// useRouter: para navegar al detalle de un negocio al hacer click.
// useSearchParams: para leer ?shop=1 y ?favorites=1 de la URL.
import { useRouter, useSearchParams } from 'next/navigation';

// useQuery: hook de React Query para cargar datos con caché automático.
//   Recibe: { queryKey, queryFn } → identifica y obtiene los datos.
//   Devuelve: { data, isLoading, error, ... }
// useMutation: hook de React Query para operaciones de escritura (POST, PUT, DELETE).
//   Con soporte de "optimistic updates" (UI se actualiza antes de la respuesta del servidor).
// useQueryClient: hook para acceder al cliente de React Query y poder
//   invalidar/refrescar queries manualmente.
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// marketplaceApi: cliente HTTP configurado para el marketplace.
//   Incluye automáticamente el token JWT en las cabeceras.
import { marketplaceApi } from '@/lib/marketplace-api';

// useMarketplaceAuth: hook del contexto de auth.
//   Aquí solo usamos isAuthenticated para saber si mostrar botón de favoritos.
import { useMarketplaceAuth } from '@/lib/hooks/use-marketplace-auth';

// MarketplaceBusinessCard: componente de tarjeta para mostrar un negocio
// con su foto, nombre, rating, precio, etc.
import { MarketplaceBusinessCard } from '@/components/marketplace/business-card';

// ─── Categorías de negocios ─────────────────────────────────────────
// Categorías ordenadas alfabéticamente por label (es-MX). "Todos" siempre
// primero porque es la opción "sin filtro", no una categoría más.
// Cada objeto tiene:
//   value: string → se envía como parámetro a la API ('', 'BARBERIA', etc.)
//   label: string → se muestra al usuario en los botones pill.
const CATEGORIES = [
  { value: '', label: 'Todos' },
  { value: 'BARBERIA', label: 'Barbería' },
  { value: 'CLINICA', label: 'Clínica' },
  { value: 'SALON', label: 'Salón' },
  { value: 'SPA', label: 'SPA' },
  { value: 'TATUAJES', label: 'Tatuajes' },
];

// ─── Interfaz TypeScript: Business ──────────────────────────────────
// Define la "forma" del objeto negocio que devuelve la API.
// TypeScript usa interfaces para tipar objetos y detectar errores.
// | null → el campo puede ser null (el negocio no lo tiene configurado).
interface Business {
  id: string;               // Identificador único del negocio (CUID).
  name: string;             // Nombre del negocio.
  slug: string;             // URL amigable del negocio (ej: "salon-bliss").
  logoUrl: string | null;   // URL del logo (puede no tener logo).
  coverImageUrl: string | null; // URL de imagen de portada.
  cardColor: string | null; // Color personalizado de la tarjeta.
  businessType: string | null; // Tipo de negocio (SALON, BARBERIA, etc.).
  description: string | null;  // Descripción del negocio.
  address: string | null;      // Dirección física.
  distance: number | null;     // Distancia al usuario en km (requiere GPS).
  averageRating: number | null; // Promedio de calificaciones (1-5).
  totalReviews: number;         // Total de reseñas.
  completedAppointments: number; // Total de citas completadas.
  priceRange: { min: number; max: number } | null; // Rango de precios.
  hasImmediateAvailability: boolean; // ¿Tiene disponibilidad inmediata?
}

// ─── Tipo para el ordenamiento ───────────────────────────────────────
// SortBy es un tipo unión: solo puede ser uno de estos 3 valores.
// '' = sin ordenamiento (orden por defecto de la API).
// 'rating' = ordenar por calificación promedio (mayor primero).
// 'services' = ordenar por cantidad de servicios (mayor primero).
type SortBy = '' | 'rating' | 'services';

// ─── CSS de animación para el corazón de favoritos ──────────────────
// HEARTBEAT_KEYFRAMES: string con CSS @keyframes para la animación
// "heartPop" que escala el corazón al marcar favorito.
// Se inyecta con <style>{HEARTBEAT_KEYFRAMES}</style> en el JSX.
const HEARTBEAT_KEYFRAMES = `
@keyframes heartPop {
  0%   { transform: scale(1); }
  25%  { transform: scale(1.45); }
  50%  { transform: scale(0.9); }
  75%  { transform: scale(1.2); }
  100% { transform: scale(1); }
}
.heart-pop { animation: heartPop 0.5s ease-out forwards; }
`;

// ─── Componente principal de la página ──────────────────────────────
export default function MarketplacePage() {
  // router: para navegar al detalle de un negocio al hacer click en la tarjeta.
  const router = useRouter();

  // queryClient: para invalidar (refrescar) la query de favoritos tras el toggle.
  const queryClient = useQueryClient();

  // isAuthenticated: ¿tiene el usuario sesión? Si no, ocultamos el botón de favoritos.
  const { isAuthenticated } = useMarketplaceAuth();

  // ─── Estado del filtro de vista ─────────────────────────────────────
  // viewTab: controla qué tab está seleccionado ('negocios' o 'profesionales').
  // Al seleccionar 'profesionales', redirigimos a /marketplace/professionals.
  const [viewTab, setViewTab] = useState<'negocios' | 'profesionales'>('negocios');

  // ─── Estados de búsqueda y filtros ──────────────────────────────────

  // search: texto de búsqueda libre. Se envía como parámetro ?search= a la API.
  const [search, setSearch] = useState('');

  // category: categoría seleccionada. Ej: 'SALON', 'BARBERIA', '' (todas).
  const [category, setCategory] = useState('');

  // favoriteSlugs: Set con los slugs de negocios que el usuario tiene como favoritos.
  // Set es una colección de valores únicos (sin duplicados), ideal para comprobar
  // rápidamente si un slug está marcado: favoriteSlugs.has(slug) → O(1).
  const [favoriteSlugs, setFavoriteSlugs] = useState<Set<string>>(new Set());

  // animatingFav: Set con los slugs que están actualmente animando el corazón.
  // La animación dura 550ms → después lo quitamos del Set.
  const [animatingFav, setAnimatingFav] = useState<Set<string>>(new Set());

  // showFavoritesOnly: cuando es true, mostramos solo los negocios favoritos
  // del usuario en vez de la lista completa.
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // sortBy: criterio de ordenamiento activo.
  // Tipo SortBy: '' | 'rating' | 'services'.
  const [sortBy, setSortBy] = useState<SortBy>('');

  // availableNow: cuando es true, filtramos solo negocios con disponibilidad
  // inmediata (tienen huecos libres hoy). Se activa con el botón "rayo".
  const [availableNow, setAvailableNow] = useState(false);

  // searchParams: parámetros de la URL actual.
  const searchParams = useSearchParams();

  // shopOnly: si la URL tiene ?shop=1, al click en un negocio va al shop
  // (tienda de productos) en vez de al detalle del negocio.
  const shopOnly = searchParams.get('shop') === '1';

  // ─── Efecto: activar filtro de favoritos desde la URL ───────────────
  // Si llegamos con ?favorites=1 (desde el perfil al hacer click en el
  // contador de Favoritos), activamos el filtro automaticamente.
  useEffect(() => {
    if (searchParams.get('favorites') === '1') {
      setShowFavoritesOnly(true);
      setCategory('');
    }
  }, [searchParams]);
  // showCategorySheet eliminado: la categoría se elige dentro del modal de
  // Filtros (showFiltersSheet) junto con el ordenamiento.

  // showFiltersSheet: controla si el modal bottom sheet de filtros está visible.
  const [showFiltersSheet, setShowFiltersSheet] = useState(false);

  // ─── Estado y efecto para GPS ────────────────────────────────────────
  // coords: las coordenadas GPS del usuario { lat, lng }.
  // null = no disponibles (permiso denegado, o no se cargó aún).
  // Se usan para ordenar negocios por distancia en la API.

  // Detección silenciosa de GPS — usa @capacitor/geolocation en nativo, fallback web
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  // useEffect vacío de dependencias []: se ejecuta UNA sola vez al montar.
  // Función async auto-invocada (IIFE) para usar await dentro del efecto.
  useEffect(() => {
    (async () => {
      try {
        // @capacitor/geolocation funciona en nativo (Android/iOS) y hace fallback a navigator.geolocation en web
        // import() dinámico: carga el módulo solo cuando se necesita.
        // En web, Capacitor delega a navigator.geolocation del navegador.
        const { Geolocation } = await import('@capacitor/geolocation');

        // Solicita permiso de ubicación al usuario (muestra el diálogo del navegador).
        await Geolocation.requestPermissions();

        // Obtiene la posición actual con alta precisión.
        // timeout: 8000 = si no responde en 8 segundos, lanza error.
        const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 8000 });

        // Guardamos lat y lng en el estado.
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      } catch {
        // Si falla (permiso denegado o no disponible), silencioso
        // No hacemos nada: la app funciona sin GPS (sin ordenamiento por distancia).
      }
    })();
  }, []);

  // ─── Query: Lista de negocios ─────────────────────────────────────────
  // useQuery carga los datos automáticamente cuando el componente se monta,
  // y los vuelve a cargar cuando cambia cualquier valor del queryKey.
  const { data, isLoading } = useQuery({
    // queryKey: array que identifica esta query. React Query la usa como "clave"
    // del caché. Si cualquier valor cambia, la query se vuelve a ejecutar.
    queryKey: ['marketplace-discover', search, category, sortBy, availableNow, shopOnly, coords?.lat, coords?.lng],

    // queryFn: función que hace la petición HTTP. Debe devolver una Promesa.
    queryFn: () => {
      // URLSearchParams: objeto para construir query strings de forma segura.
      // Evita problemas con caracteres especiales en los valores.
      const params = new URLSearchParams();
      if (search) params.set('search', search);       // ?search=corte
      if (category) params.set('category', category); // ?category=SALON
      if (sortBy) params.set('sortBy', sortBy);       // ?sortBy=rating
      if (availableNow) params.set('availableNow', 'true'); // ?availableNow=true
      if (shopOnly) params.set('shopOnly', 'true');         // ?shopOnly=true
      // coords?.lat: "optional chaining". Si coords es null, no lanza error,
      // simplemente devuelve undefined (la condición if falla limpiamente).
      if (coords) { params.set('lat', String(coords.lat)); params.set('lng', String(coords.lng)); }
      params.set('perPage', '50'); // Máximo 50 negocios por página.
      // Hacemos GET a /discover con todos los parámetros construidos.
      return marketplaceApi.get<{ data: Business[]; meta: any }>(`/discover?${params}`);
    },
  });

  // ─── Query: Favoritos del usuario ────────────────────────────────────
  // Solo se ejecuta si isAuthenticated es true (enabled: isAuthenticated).
  // Si el usuario no está autenticado, no pedimos sus favoritos.
  const { data: favData } = useQuery({
    queryKey: ['marketplace-my-favorites'],
    queryFn: () => marketplaceApi.get<{ data: any[] }>('/my-favorites'),
    enabled: isAuthenticated, // Solo cuando el usuario está logueado.
  });

  // ─── Efecto: sincronizar favoriteSlugs con los datos de la API ──────
  // Cuando favData cambia (llegan datos de la API), actualizamos el Set
  // de slugs favoritos para que los corazones se pinten correctamente.
  useEffect(() => {
    // (favData as any)?.data: accedemos con "as any" porque TypeScript
    // no conoce el tipo exacto de la respuesta. ?. evita error si favData es null.
    const favs = (favData as any)?.data || [];

    // Creamos un nuevo Set con los slugs de los favoritos.
    // .map((f: any) => f.slug): transforma el array de objetos en array de slugs.
    // new Set([...]): crea un Set con valores únicos a partir del array.
    setFavoriteSlugs(new Set(favs.map((f: any) => f.slug)));
  }, [favData]);

  // ─── Mutation: toggle favorito (marcar/desmarcar) ────────────────────
  // useMutation para la operación POST /favorites/:slug.
  const toggleFavMutation = useMutation({
    // mutationFn: función que hace la petición HTTP.
    // Recibe el slug del negocio que queremos marcar/desmarcar.
    mutationFn: (slug: string) =>
      marketplaceApi.post<{ data: { favorited: boolean } }>(`/favorites/${slug}`),

    // onMutate: se ejecuta ANTES de que la petición HTTP salga.
    // Es el "optimistic update": actualizamos la UI inmediatamente
    // sin esperar la respuesta del servidor. Mejor experiencia de usuario.
    onMutate: async (slug) => {
      // Determinamos si el negocio va a ser marcado (true) o desmarcado (false).
      const willFavorite = !favoriteSlugs.has(slug);

      // Actualizamos el Set de favoritos de forma inmediata.
      // prev => nuevo estado: React requiere que el estado sea inmutable,
      // por eso creamos un nuevo Set en vez de modificar el existente.
      setFavoriteSlugs((prev) => {
        const next = new Set(prev); // Copia del Set anterior.
        if (next.has(slug)) next.delete(slug); // Si ya era fav, lo quitamos.
        else next.add(slug);                   // Si no era fav, lo añadimos.
        return next;
      });

      // Si va a ser marcado (no desmarcado), reproducimos la animación del corazón.
      if (willFavorite) {
        // Añadimos el slug al Set de animando.
        setAnimatingFav((prev) => new Set(prev).add(slug));

        // Después de 550ms (duración de la animación), quitamos el slug
        // del Set para que la animación no se repita.
        setTimeout(() => {
          setAnimatingFav((prev) => {
            const next = new Set(prev);
            next.delete(slug);
            return next;
          });
        }, 550);
      }
    },

    // onSettled: se ejecuta cuando la mutation termina (éxito O error).
    // Invalidamos la query de favoritos para que React Query la vuelva a pedir
    // desde la API y sincronice el estado real con el optimista.
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['marketplace-my-favorites'] });
    },
  });

  // ─── Manejador del click en el corazón ──────────────────────────────
  // e: React.MouseEvent → el evento del click.
  // slug: string → el identificador del negocio.
  const handleToggleFavorite = (e: React.MouseEvent, slug: string) => {
    // e.stopPropagation(): evita que el click se propague al elemento padre
    // (la tarjeta del negocio), lo que evita navegar al detalle al click en el corazón.
    e.stopPropagation();

    // Solo marcamos favoritos si el usuario está autenticado.
    if (!isAuthenticated) return;

    // Ejecutamos la mutation con el slug del negocio.
    toggleFavMutation.mutate(slug);
  };

  // ─── Toggle del ordenamiento ─────────────────────────────────────────
  // toggleSort: si el mismo criterio ya está activo, lo desactiva ('').
  // Si es diferente, lo activa.
  // s: SortBy → el criterio a activar/desactivar.
  const toggleSort = (s: SortBy) => setSortBy(sortBy === s ? '' : s);

  // ─── Datos computados ────────────────────────────────────────────────

  // allBusinesses: todos los negocios de la API (respuesta de /discover).
  // || []: si data es null/undefined (aún cargando), usamos array vacío.
  const allBusinesses: Business[] = (data as any)?.data || [];

  // favoriteBusinesses: lista de negocios favoritos del usuario.
  const favoriteBusinesses: Business[] = (favData as any)?.data || [];

  // businesses: la lista que realmente renderizamos.
  // Si showFavoritesOnly → solo favoritos; si no → todos los negocios filtrados.
  const businesses = showFavoritesOnly ? favoriteBusinesses : allBusinesses;

  // CATEGORY_LABELS: diccionario para traducir el valor de categoría al label en español.
  // Record<string, string>: tipo TypeScript para un objeto con claves y valores string.
  const CATEGORY_LABELS: Record<string, string> = { SALON: 'Salón', BARBERIA: 'Barbería', SPA: 'SPA', CLINICA: 'Clínica', TATUAJES: 'Tatuajes' };

  // favoritesByCategory: cuando showFavoritesOnly y no hay categoría seleccionada,
  // agrupamos los favoritos por tipo de negocio para mostrarlos con encabezados.
  // Si showFavoritesOnly es false O hay categoría → null (no agrupamos).
  const favoritesByCategory = showFavoritesOnly && !category
    ? Object.entries(
        // .reduce(): recorre favoriteBusinesses y construye un objeto donde
        // cada clave es un tipo de negocio y el valor es el array de negocios de ese tipo.
        // acc: acumulador (el objeto que vamos construyendo).
        // biz: cada negocio en la iteración.
        favoriteBusinesses.reduce<Record<string, Business[]>>((acc, biz) => {
          // .split(',')[0]: toma solo el primer tipo si hay varios separados por coma.
          const type = biz.businessType?.split(',')[0] || 'OTRO';
          // (acc[type] ||= []).push(biz):
          //   acc[type] ||= []: si acc[type] no existe, lo inicializa como array vacío.
          //   .push(biz): añade el negocio al array de su tipo.
          (acc[type] ||= []).push(biz);
          return acc;
        }, {}),
      )
      // .sort(): ordena las categorías según un orden predefinido.
      // [a] y [b]: destructuran el par [tipo, array] de Object.entries.
      .sort(([a], [b]) => {
        const order = ['SALON', 'BARBERIA', 'SPA', 'CLINICA', 'TATUAJES'];
        // indexOf(a): posición del tipo en el orden. -1 si no está (tipo desconocido).
        // Si el tipo no está en order → le damos posición 99 (va al final).
        return (order.indexOf(a) === -1 ? 99 : order.indexOf(a)) - (order.indexOf(b) === -1 ? 99 : order.indexOf(b));
      })
    : null; // null = no agrupamos por categoría.

  // ─── Función renderizadora de tarjeta de negocio ─────────────────────
  // renderBusinessCard: recibe un objeto Business y devuelve el JSX de la tarjeta.
  // Se extrae como función para no repetir el código en los 3 lugares donde
  // se usan tarjetas (lista normal, favoritos agrupados, favoritos filtrados).
  const renderBusinessCard = (biz: Business) => (
    // MarketplaceBusinessCard: componente de tarjeta con foto, nombre, rating, etc.
    // key={biz.id}: identificador único para React (necesario en listas).
    // biz: los datos del negocio.
    // onClick: al hacer click, navega al detalle o al shop según shopOnly.
    // showFavorite: solo muestra el botón de corazón si el usuario está autenticado.
    // isFav: ¿este negocio está en los favoritos del usuario?
    //   favoriteSlugs.has(biz.slug): busca en el Set, O(1) eficiente.
    // isAnimating: ¿debe ejecutar la animación heartPop ahora?
    //   animatingFav.has(biz.slug): true mientras la animación está activa.
    // onToggleFavorite: manejador del click en el corazón.
    <MarketplaceBusinessCard
      key={biz.id}
      biz={biz}
      onClick={() => router.push(shopOnly ? `/marketplace/${biz.slug}/shop` : `/marketplace/${biz.slug}`)}
      showFavorite={isAuthenticated}
      isFav={favoriteSlugs.has(biz.slug)}
      isAnimating={animatingFav.has(biz.slug)}
      onToggleFavorite={(e) => handleToggleFavorite(e, biz.slug)}
    />
  );

  return (
    // Fragmento: agrupa el <style> y el <div> sin añadir un nodo extra al DOM.
    <>
      {/* Inyectamos el CSS de animación heartPop directamente en el DOM.
          HEARTBEAT_KEYFRAMES es el string con @keyframes y .heart-pop. */}
      <style>{HEARTBEAT_KEYFRAMES}</style>

      <div>

        {/* ── Header (sticky) ──
            Una sola fila compacta: search (flex-1) + rayo + ajustes +
            corazón. La categoría se elige dentro del modal de Filtros. */}
        {/* sticky top-0 z-30: el header queda fijo al hacer scroll.
            bg-gray-50: fondo gris muy claro que "tapa" el contenido al scrollear. */}
        <div className="bg-gray-50 px-4 pb-3 safe-top sticky top-0 z-30">
          <div className="max-w-2xl mx-auto">
            {/* Fila con buscador + 3 botones de acción. */}
            <div className="flex items-center gap-2 mb-2.5">
              {/* ── Campo de búsqueda ──
                  flex-1: ocupa todo el espacio horizontal disponible.
                  min-w-0: permite que se comprima si hay otros elementos. */}
              <div className="relative flex-1 min-w-0">
                {/* Ícono de lupa posicionado absolutamente dentro del input.
                    absolute left-3 top-1/2 -translate-y-1/2: centrado verticalmente. */}
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {/* Input de búsqueda controlado:
                    value={search}: el valor del input es el estado search.
                    onChange={(e) => setSearch(e.target.value)}: actualiza el estado
                    en tiempo real mientras el usuario escribe.
                    Cada cambio en search dispara una nueva query (con debounce
                    implícito porque React Query tiene un queryKey que cambia). */}
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar negocio o servicio..."
                  className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-[13px] bg-white focus:outline-none focus:ring-2 focus:border-transparent"
                  style={{ ['--tw-ring-color' as any]: '#008080' }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = '#008080'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(0,128,128,0.25)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = 'none'; }}
                />
              </div>

              {/* ── Botón Rayo: "Disponible ahora" ──
                  Activa el filtro availableNow al hacer click.
                  style condicional: si availableNow=true → fondo teal; si false → blanco. */}
              {/* Rayo — Disponible ahora (solo icono) */}
              <button
                onClick={() => setAvailableNow(!availableNow)}
                title="Disponible ahora"
                className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
                style={availableNow
                  ? { backgroundColor: '#008080', color: 'white', border: '1.5px solid #008080' }
                  : { backgroundColor: 'white', color: '#6b7280', border: '1.5px solid #e5e7eb' }
                }
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                </svg>
              </button>

              {/* ── Botón Filtros (ajustes + categoría) ──
                  Abre el modal bottom sheet de filtros.
                  El punto rojo (badge) aparece si hay filtros activos (sortBy o category). */}
              {/* Ajustes/Filtros — incluye categoria y ordenamiento */}
              <button
                onClick={() => setShowFiltersSheet(true)}
                title="Filtros"
                className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 relative transition-colors"
                style={sortBy || category
                  ? { backgroundColor: '#008080', color: 'white', border: '1.5px solid #008080' }
                  : { backgroundColor: 'white', color: '#6b7280', border: '1.5px solid #e5e7eb' }
                }
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
                </svg>
                {/* Badge rojo: solo visible si hay filtros activos.
                    && = renderizado condicional: si (sortBy || category) es truthy → muestra el badge. */}
                {(sortBy || category) && (
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-gray-50" />
                )}
              </button>

              {/* ── Botón Favoritos (corazón) ──
                  Solo visible si el usuario está autenticado.
                  Activa/desactiva el filtro de mostrar solo favoritos. */}
              {/* Favoritos */}
              {isAuthenticated && (
                <button
                  onClick={() => { setShowFavoritesOnly((prev) => !prev); setCategory(''); }}
                  title="Favoritos"
                  className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
                  style={showFavoritesOnly
                    ? { backgroundColor: '#008080', color: 'white', border: '1.5px solid #008080' }
                    : { backgroundColor: 'white', color: '#6b7280', border: '1.5px solid #e5e7eb' }
                  }
                >
                  {/* fill: si showFavoritesOnly → corazón relleno blanco; si no → sin relleno. */}
                  <svg className="w-4 h-4" fill={showFavoritesOnly ? 'white' : 'none'} stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                  </svg>
                </button>
              )}
            </div>

            {/* ── Selector Negocios | Profesionales ──
                Selector "segmentado" estilo toggle de dos opciones.
                Al hacer click en "Profesionales" → navegamos a /marketplace/professionals.
                "Negocios" siempre muestra esta misma página. */}
            {/* Selector Negocios | Profesionales — mismo estilo segmentado
                que el selector "Servicios | Paquetes" del booking, para
                mantener coherencia visual entre las distintas vistas. */}
            <div className="flex rounded-lg border border-gray-300 overflow-hidden">
              {/* Tab "Negocios": activo cuando viewTab === 'negocios'. */}
              <button
                onClick={() => { setViewTab('negocios'); }}
                className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                  // Clases condicionales con template literal:
                  // Si es el tab activo → fondo teal y texto blanco.
                  // Si no → fondo blanco y texto gris oscuro.
                  viewTab === 'negocios' ? 'bg-[#008080] text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                Negocios
              </button>
              {/* Tab "Profesionales": siempre inactivo en esta página
                  porque al hacer click navegamos a /marketplace/professionals. */}
              <button
                onClick={() => { setViewTab('profesionales'); router.push('/marketplace/professionals'); }}
                className="flex-1 px-4 py-2 text-sm font-medium transition-colors border-l border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              >
                Profesionales
              </button>
            </div>

            {/* Contador de resultados: solo visible cuando hay datos y no está cargando. */}
            {/* Renderizado condicional: !isLoading && businesses.length > 0 → ambas condiciones deben ser true. */}
            {/* Contador de resultados — dentro del header sticky */}
            {!isLoading && businesses.length > 0 && (
              <p className="text-xs text-gray-400 mt-2">
                {/* Pluralización manual:
                    businesses.length !== 1 ? 's' : ''
                    Si hay más de 1 → añade 's' (negocios), si es 1 → sin 's' (negocio). */}
                {businesses.length} negocio{businesses.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        </div>

        {/* ── Lista de tarjetas de negocios ── */}
        <div className="max-w-2xl mx-auto w-full px-4 pt-2 pb-24">
          {/* ── Renderizado condicional con tres ramas ──
              Se elige UNA de las siguientes tres vistas según el estado:
              1. isLoading → spinner de carga.
              2. businesses.length === 0 → estado vacío con mensaje.
              3. favoritesByCategory → favoritos agrupados por categoría.
              4. else → lista normal de tarjetas.

              Sintaxis: A ? B : C (ternario encadenado)
              A ? B : C2 ? D : E (si A → B; si C2 → D; sino → E) */}
          {isLoading ? (
            // Estado de carga: spinner animado.
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto" style={{ borderBottomColor: '#008080' }} />
              <p className="text-sm text-gray-400 mt-3">Buscando negocios...</p>
            </div>
          ) : businesses.length === 0 ? (
            // Estado vacío: no hay resultados.
            // El mensaje varía según el filtro activo.
            <div className="text-center py-12">
              <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <p className="text-gray-400 mb-1">
                {/* Ternario: mensaje principal según showFavoritesOnly. */}
                {showFavoritesOnly ? 'No tienes favoritos aún' : 'No se encontraron negocios'}
              </p>
              <p className="text-sm text-gray-400">
                {/* Ternario encadenado: mensaje secundario más específico. */}
                {showFavoritesOnly
                  ? 'Pulsa el corazón en los negocios que te gusten para guardarlos aquí'
                  : availableNow
                    ? 'Ningún negocio tiene disponibilidad inmediata'
                    : search ? 'Intenta con otro término de búsqueda' : 'No hay negocios disponibles en esta zona'}
              </p>
            </div>
          ) : favoritesByCategory ? (
            // Vista de favoritos agrupados por categoría de negocio.
            // space-y-5: espacio de 20px entre los grupos de categorías.
            <div className="space-y-5">
              {/* .map() sobre el array de pares [tipo, listaNegociosDeTipo].
                  Cada iteración renderiza un grupo (encabezado + tarjetas).
                  key={type}: el tipo ('SALON', 'BARBERIA'...) como key única. */}
              {favoritesByCategory.map(([type, bizList]) => (
                <div key={type}>
                  {/* Encabezado del grupo: nombre de la categoría + badge con cantidad. */}
                  <div className="flex items-center gap-2 mb-2">
                    {/* CATEGORY_LABELS[type]: obtiene el label en español del tipo.
                        || type: si no hay traducción, muestra el valor original. */}
                    <h2 className="text-sm font-semibold text-gray-700">{CATEGORY_LABELS[type] || type}</h2>
                    {/* Badge con el conteo de negocios en esta categoría.
                        bizList.length: la cantidad de negocios de este tipo. */}
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ backgroundColor: '#e0f2f1', color: '#008080' }}>{bizList.length}</span>
                  </div>
                  {/* Lista de tarjetas del grupo.
                      .map((biz) => renderBusinessCard(biz)): renderiza cada negocio del grupo. */}
                  <div className="space-y-2">
                    {bizList.map((biz) => renderBusinessCard(biz))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // Vista normal: lista lineal de todas las tarjetas.
            // space-y-2: espacio de 8px entre tarjetas.
            <div className="space-y-2">
              {/* .map() sobre businesses: itera cada negocio y renderiza su tarjeta.
                  renderBusinessCard(biz) ya incluye el key={biz.id}. */}
              {businesses.map((biz) => renderBusinessCard(biz))}
            </div>
          )}
        </div>

        {/* ── Bottom sheets ──
            La categoria vive dentro del modal de Filtros (showFiltersSheet)
            para concentrar todas las opciones en un mismo lugar. */}

        {/* ── Modal de Filtros (bottom sheet) ──
            showFiltersSheet && (...): solo renderiza si showFiltersSheet es true.
            fixed inset-0: ocupa toda la pantalla (overlay).
            flex items-end: el panel del modal sube desde el fondo. */}
        {showFiltersSheet && (
          <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ touchAction: 'none' }}>
            {/* Fondo oscuro semi-transparente.
                onClick: click fuera del modal → lo cierra. */}
            <div className="absolute inset-0 bg-black/40" onClick={() => setShowFiltersSheet(false)} />

            {/* Panel del modal (hoja desde abajo).
                relative: para que el z-index funcione sobre el overlay.
                pb-safe: padding inferior para safe area de iPhones. */}
            <div className="relative w-full max-w-lg bg-white rounded-t-2xl shadow-xl pb-safe">
              {/* Handle bar: pastilla gris decorativa indicando que se puede arrastrar. */}
              <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 bg-gray-300 rounded-full" /></div>

              {/* Cabecera del modal: título "Filtros" + botón cerrar. */}
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-base font-semibold text-gray-900">Filtros</h3>
                <button onClick={() => setShowFiltersSheet(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">
                  <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <div className="px-5 py-4">
                {/* Botón "Limpiar filtros": solo visible si hay filtros activos. */}
                {(sortBy || category) && (
                  <button
                    onClick={() => { setSortBy(''); setCategory(''); }}
                    className="w-full flex items-center justify-center gap-1.5 mb-4 py-2 rounded-xl text-xs font-medium border transition-colors"
                    style={{ color: '#dc2626', borderColor: '#fecaca', backgroundColor: '#fef2f2' }}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    Limpiar filtros
                  </button>
                )}

                {/* ── Sección Categoría ──
                    Botones pill para cada categoría. */}
                {/* Categoría */}
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Categoría</p>
                <div className="flex flex-wrap gap-1.5 mb-5">
                  {/* .map() sobre CATEGORIES: renderiza un botón por cada categoría.
                      key={cat.value}: '' para "Todos", 'SALON' para Salón, etc. */}
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.value}
                      onClick={() => { setCategory(cat.value); setShowFavoritesOnly(false); }}
                      className="px-3 py-1.5 rounded-full text-xs font-medium border transition-colors"
                      // Estilo condicional: si esta categoría está seleccionada → teal activo.
                      style={category === cat.value
                        ? { backgroundColor: '#008080', color: 'white', borderColor: '#008080' }
                        : { backgroundColor: 'white', color: '#6b7280', borderColor: '#e5e7eb' }
                      }
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                {/* ── Sección Ordenamiento ──
                    Opciones de ordenamiento en lista vertical. */}
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Ordenar por</p>
                <div className="space-y-1">
                  {/* .map() sobre las opciones de ordenamiento.
                      Cada opción es un objeto con value, label e icon (SVG). */}
                  {[
                    { value: 'rating', label: 'Más puntuados', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" /> },
                    { value: 'services', label: 'Más servicios', icon: <><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75z" /><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></> },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      // toggleSort: activa el ordenamiento o lo desactiva si ya estaba activo.
                      onClick={() => toggleSort(opt.value as SortBy)}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm transition-colors"
                      // Estilo condicional: fondo teal si este criterio está activo.
                      style={sortBy === opt.value ? { backgroundColor: '#e0f2f1', color: '#008080', fontWeight: 600 } : { color: '#374151' }}
                    >
                      <span className="flex items-center gap-3">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">{opt.icon}</svg>
                        {opt.label}
                      </span>
                      {/* Ícono de check: solo visible cuando este criterio está activo. */}
                      {sortBy === opt.value && (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                      )}
                    </button>
                  ))}
                </div>
              </div>
              {/* Espaciado inferior dentro del modal para el safe area. */}
              <div className="px-4 py-4" />
            </div>
          </div>
        )}
      </div>
    </>
  );
}
