// Client Component: se ejecuta en el navegador (maneja clics del usuario).
'use client';

// Importamos SOLO el TIPO MouseEvent de React (la palabra "type" indica que es
// una importación de tipos, que desaparece al compilar). Lo usamos para tipar
// el evento que recibe el handler del corazón de favoritos.
import type { MouseEvent } from 'react';

// URL base de la API, para construir rutas de imágenes (logo, portada).
// '||' = "si la variable de entorno no existe, usa localhost".
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Diccionario que traduce el código interno del tipo de negocio (en mayúsculas,
// como viene de la base de datos) a una etiqueta bonita en español.
// Record<string, string> = "objeto cuyas claves y valores son textos".
const CATEGORY_LABELS: Record<string, string> = {
  SALON: 'Salón',
  BARBERIA: 'Barbería',
  SPA: 'SPA',
  CLINICA: 'Clínica',
  TATUAJES: 'Tatuajes',
};

// Forma de los datos de UN negocio que esta tarjeta necesita para pintarse.
// Se exporta para que otros archivos (la lista del marketplace) la reutilicen.
export interface BusinessCardData {
  id: string;                          // identificador único del negocio
  name: string;                        // nombre comercial
  slug: string;                        // "slug" para la URL (ej. mi-salon)
  logoUrl: string | null;              // ruta del logo (o null si no tiene)
  coverImageUrl: string | null;        // ruta de la foto de portada (o null)
  cardColor: string | null;            // color de marca para el fondo/iniciales
  businessType: string | null;         // tipo: 'SALON', 'BARBERIA', ...
  distance?: number | null;            // distancia al usuario en km (opcional)
  averageRating?: number | null;       // calificación promedio (opcional)
  totalReviews?: number;               // número total de reseñas (opcional)
  completedAppointments?: number;      // citas completadas (mide antigüedad)
  hasImmediateAvailability?: boolean;  // si tiene cupo inmediato (opcional)
}

// PROPS de la tarjeta. Casi todas opcionales (con '?') para poder usar la
// tarjeta en distintos contextos (con o sin botón de favorito, etc.).
interface MarketplaceBusinessCardProps {
  biz: BusinessCardData;                      // los datos del negocio a mostrar
  onClick?: () => void;                       // qué hacer al tocar la tarjeta
  showFavorite?: boolean;                     // ¿mostrar el corazón?
  isFav?: boolean;                            // ¿está marcado como favorito?
  isAnimating?: boolean;                      // ¿animar el corazón ahora?
  onToggleFavorite?: (e: MouseEvent) => void; // qué hacer al tocar el corazón
}

// Componente "MarketplaceBusinessCard": una tarjeta visual de un negocio para
// la lista del marketplace. Muestra portada/color, logo, nombre, categoría,
// distancia, disponibilidad, estrellas y un sello "NUEVO".
// Las props tienen valores por defecto (= ...) que se usan si no se pasan.
export function MarketplaceBusinessCard({
  biz,
  onClick,
  showFavorite = false,
  isFav = false,
  isAnimating = false,
  onToggleFavorite,
}: MarketplaceBusinessCardProps) {
  // !!biz.coverImageUrl convierte el valor a booleano puro: doble negación.
  // Si hay portada → true; si es null/'' → false.
  const hasCover = !!biz.coverImageUrl;
  // Color de fondo: el del negocio o el teal de marca si no tiene.
  const bgColor = biz.cardColor || '#008080';
  // completed = citas completadas. El operador ?? ("nullish coalescing") usa 0
  // solo si completedAppointments es null o undefined (no si es 0, a diferencia
  // de ||). Sirve para decidir si el negocio es "NUEVO" (< 10 citas).
  const completed = biz.completedAppointments ?? 0;

  return (
    // La tarjeta es un contenedor clickeable. NO usamos <button> aquí porque
    // dentro va OTRO <button> (el corazón de favorito) y un botón no puede
    // contener a otro botón (HTML inválido → error de hidratación). Usamos un
    // <div role="button"> con soporte de teclado (Enter/Espacio) para mantener
    // la accesibilidad. active:scale-[0.98] da el efecto de "presión" al tocarla.
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        // Enter o barra espaciadora activan la tarjeta, como un botón nativo.
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
      className="w-full rounded-2xl overflow-hidden text-left active:scale-[0.98] transition-transform relative cursor-pointer"
      style={{ height: 140 }}
    >
      {/* Fondo: foto de portada O color sólido (ternario con hasCover). */}
      {hasCover ? (
        <img
          src={`${API_URL}${biz.coverImageUrl}`}  // ruta completa de la portada
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        // Sin portada → un div pintado con el color del negocio.
        <div className="absolute inset-0" style={{ backgroundColor: bgColor }} />
      )}

      {/* Gradient: top 50% limpio, de ahí baja suave hasta denso en el borde */}
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.55) 30%, rgba(0,0,0,0.15) 50%, transparent 55%)' }}
      />

      {/* Contenido encima del fondo+degradado (relative para apilarse arriba) */}
      <div className="relative h-full flex flex-col justify-between p-3">

        {/* Fila superior: círculo del logo (izquierda) + corazón (derecha) */}
        <div className="flex items-start justify-between">
          {/* Círculo del logo */}
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 border-2 border-white shadow-md"
            style={{
              backgroundColor: bgColor,
              zIndex: 10,
              position: 'relative',
            }}
          >
            {/* Si hay logo, mostramos la imagen; si no, la primera letra del
                nombre (biz.name[0]) como avatar de respaldo. */}
            {biz.logoUrl ? (
              <img
                src={`${API_URL}${biz.logoUrl}`}
                alt={biz.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-xl font-black text-white" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
                {biz.name[0]}
              </span>
            )}
          </div>

          {/* Corazón de favorito — solo si showFavorite es true (&&). */}
          {showFavorite && (
            <button
              // onToggleFavorite recibe el evento. Quien usa la tarjeta suele
              // llamar e.stopPropagation() dentro para que el clic en el
              // corazón NO dispare también el onClick de toda la tarjeta.
              onClick={onToggleFavorite}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-white/90 backdrop-blur-sm flex-shrink-0"
              style={{ zIndex: 10, position: 'relative' }}
            >
              <svg
                // Si isAnimating es true, añadimos la clase 'heart-pop' que
                // dispara la animación de "latido" al marcar favorito.
                className={`w-4 h-4${isAnimating ? ' heart-pop' : ''}`}
                // Relleno y borde dependen de isFav: lleno y teal si es
                // favorito; vacío y gris si no lo es.
                fill={isFav ? '#008080' : 'none'}
                stroke={isFav ? '#008080' : '#6b7280'}
                viewBox="0 0 24 24"
                strokeWidth={2}
                style={{ transition: 'fill 0.2s ease, stroke 0.2s ease' }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
              </svg>
            </button>
          )}
        </div>

        {/* Parte inferior: nombre, categoría, distancia/disponibilidad y estrellas */}
        <div>
          <p className="text-base font-black text-white leading-tight truncate" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>
            {biz.name}
          </p>
          {/* Categoría — solo si hay businessType. Un negocio puede tener
              varios tipos separados por coma; con .split(',')[0] tomamos el
              PRIMERO, y el diccionario CATEGORY_LABELS lo traduce (o si no está
              en el diccionario, mostramos el código tal cual con ||). */}
          {biz.businessType && (
            <p className="text-xs font-semibold text-white/90 mt-0.5">
              {CATEGORY_LABELS[biz.businessType.split(',')[0]] || biz.businessType.split(',')[0]}
            </p>
          )}
          <div className="flex items-center justify-between mt-1.5">
            {/* Bloque izquierdo: insignia de distancia + insignia "Disponible" */}
            <div className="flex items-center gap-2">
              {/* distance != null comprueba que NO sea null ni undefined (el !=
                  con doble igual cubre ambos). Solo entonces mostramos km/m. */}
              {biz.distance != null && (
                <span className="flex items-center gap-1 text-[10px] font-semibold text-white bg-black/40 px-1.5 py-0.5 rounded-full">
                  <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                  </svg>
                  {/* Si está a menos de 1 km mostramos metros (km*1000
                      redondeado); si no, kilómetros. */}
                  {biz.distance < 1 ? `${Math.round(biz.distance * 1000)} m` : `${biz.distance} km`}
                </span>
              )}
              {/* Insignia verde "Disponible" con punto que parpadea (animate-pulse). */}
              {biz.hasImmediateAvailability && (
                <span className="flex items-center gap-1 text-[10px] font-semibold text-white bg-green-500/80 px-1.5 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                  Disponible
                </span>
              )}
            </div>
            {/* Bloque derecho: estrellas. Solo si el negocio tiene 10+ citas
                completadas Y una calificación (averageRating != null). Así
                evitamos mostrar "5 estrellas" basadas en una sola reseña. */}
            {completed >= 10 && biz.averageRating != null && (
              <div className="flex items-center gap-1 flex-shrink-0">
                <svg className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span className="text-sm font-semibold text-white">{biz.averageRating}</span>
                {/* Total de reseñas entre paréntesis. ?? 0 muestra 0 si no
                    nos pasaron totalReviews. */}
                <span className="text-xs text-white/70">({biz.totalReviews ?? 0})</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sello "NUEVO" — triángulo relleno en la esquina inferior derecha.
          Solo para negocios con menos de 10 citas completadas.
          z-10 para que NUNCA se monte sobre el header sticky (z-30). */}
      {completed < 10 && (
        <div
          className="absolute bottom-0 right-0 z-10"
          style={{
            width: 70,
            height: 70,
            // clipPath recorta el cuadrado en forma de triángulo: los tres
            // puntos (esquina superior derecha, inferior derecha, inferior
            // izquierda) forman la "esquina doblada".
            clipPath: 'polygon(100% 0, 100% 100%, 0 100%)',
            backgroundColor: 'rgba(34,197,94,0.85)', // verde semitransparente
          }}
        >
          <span
            className="absolute font-black text-white"
            style={{
              fontSize: 11,
              letterSpacing: '0.06em',
              top: '64%',
              left: '64%',
              // Centramos el texto en ese punto (-50%,-50%) y lo giramos -45°
              // para que quede en diagonal, paralelo a la hipotenusa del
              // triángulo.
              transform: 'translate(-50%, -50%) rotate(-45deg)',
            }}
          >
            NUEVO
          </span>
        </div>
      )}
    </div>
  );
}
