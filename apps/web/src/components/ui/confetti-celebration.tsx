'use client';
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ confetti-celebration.tsx                                                │
// │                                                                         │
// │ ¿QUÉ HACE ESTE COMPONENTE?                                              │
// │ Muestra una animación de confeti (papelitos cayendo) que cubre toda la  │
// │ pantalla. Se usa para celebrar momentos importantes: reserva exitosa,   │
// │ redención de recompensa, etc.                                           │
// │                                                                         │
// │ CONCEPTOS CLAVE:                                                         │
// │  - Canvas: área de dibujo HTML donde pintamos los papelitos con código  │
// │  - requestAnimationFrame (RAF): función del navegador que llama a       │
// │    nuestra función de animación ~60 veces por segundo (60fps)           │
// │  - "Burst": un conjunto de partículas lanzadas de una vez               │
// │  - pointer-events: none → el canvas NO interfiere con clicks del usuario│
// │  - useMemo: memoriza un valor calculado para no recalcularlo en cada    │
// │    render si sus dependencias no cambiaron                              │
// │  - useCallback: memoriza una función por la misma razón                 │
// └─────────────────────────────────────────────────────────────────────────┘

// Hooks de React que necesitamos
import { useEffect, useMemo, useRef, useCallback } from 'react';

// Importamos desde la librería de formas de confeti del proyecto:
//   SHAPES: catálogo de formas (cuadrado, estrella, corazón, etc.) con función draw()
//   DEFAULT_CONFETTI_COLORS: paleta de colores teal por defecto
//   isValidShape: valida que un string sea una forma conocida
//   ConfettiShape: tipo TypeScript para los nombres de formas válidas
import {
  SHAPES,
  DEFAULT_CONFETTI_COLORS,
  isValidShape,
  type ConfettiShape,
} from '@/lib/confetti-shapes';

// ─── INTERFAZ DE PROPS ───────────────────────────────────────────────────────
interface ConfettiCelebrationProps {
  show: boolean;               // true = mostrar y animar, false = ocultar
  /** Duración total en ms. Default 5000. */
  duration?: number;           // Cuánto dura la animación completa (en milisegundos)
  /** Partículas por burst. Default 20. */
  particlesPerBurst?: number;  // Cuántos papelitos se crean en cada "ola"
  /**
   * Lista de figuras a mezclar (hasta 3). Cada partícula elige una al azar.
   * Si no se pasa o queda vacío, se usa el legacy `shape` y, si tampoco
   * existe, default 'square'.
   */
  shapes?: string[] | null;    // Array de nombres de formas para usar
  /** Legacy: una sola figura. Mantener compatibilidad. */
  shape?: string | null;       // Una sola forma (compatibilidad con código antiguo)
  /** Paleta de hasta 4 colores. Si vacío/null, usa la paleta teal default. */
  colors?: string[] | null;    // Colores en formato hex: ["#ff0000", "#00ff00", ...]
  onComplete?: () => void;     // Callback: se llama cuando la animación termina
}

/**
 * Canvas con partículas cayendo desde arriba. Cada partícula es una figura
 * del catálogo `SHAPES`, pintada con uno de los colores configurados. Las
 * partículas rotan mientras caen y se desvanecen al final.
 */
export function ConfettiCelebration({
  show,
  duration = 5000,         // Default: 5 segundos de animación
  particlesPerBurst = 20,  // Default: 20 papelitos por ola
  shapes,
  shape,
  colors,
  onComplete,
}: ConfettiCelebrationProps) {

  // ─── REFS ──────────────────────────────────────────────────────────────────
  // canvasRef: referencia al elemento <canvas> donde dibujamos
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // animationRef: guarda el ID de requestAnimationFrame para poder cancelarlo
  // cuando el componente se desmonta o la animación termina
  const animationRef = useRef<number>(0);

  // onCompleteRef: guardamos el callback en un ref para que la función animate()
  // (que vive dentro de un closure) siempre tenga acceso a la versión más reciente,
  // sin necesidad de incluirla como dependencia del useCallback.
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete; // Actualizamos en cada render

  // ─── MEMO: activeShapes ───────────────────────────────────────────────────
  // Calculamos cuáles formas usar basándonos en las props.
  // useMemo(fn, [deps]): solo recalcula si las dependencias cambian.
  // Lista de figuras activas. Aceptamos `shapes` (plural, hasta 3) o el
  // legacy `shape` (singular). Si nada es válido, default a ['square'].
  const activeShapes: ConfettiShape[] = useMemo(() => {
    // Primero intentamos con el array "shapes"; si está vacío o ausente, probamos "shape" singular
    const raw = (shapes && shapes.length > 0 ? shapes : shape ? [shape] : [])
      .filter(isValidShape)  // Filtramos solo las formas reconocidas por el catálogo
      .slice(0, 3);          // Máximo 3 formas diferentes

    // Si después de filtrar no quedó nada válido, usamos 'square' como fallback
    return raw.length > 0 ? (raw as ConfettiShape[]) : ['square'];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(shapes), shape]);
  // JSON.stringify(shapes): comparamos los arrays por contenido, no por referencia
  // (Si el padre siempre crea un nuevo array [], la referencia cambia aunque el contenido sea igual)

  // ─── MEMO: palette ────────────────────────────────────────────────────────
  // Memoize the palette para evitar que un nuevo array en cada render
  // invalide el useCallback y re-monte la animación en mitad del confeti.
  const palette = useMemo(
    () => (colors && colors.length > 0 ? colors.slice(0, 4) : DEFAULT_CONFETTI_COLORS),
    // Comparamos por contenido serializado para tolerar arrays distintos
    // con los mismos valores (lo típico cuando el padre re-renderea).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(colors)],
  );

  // ─── CALLBACK: startConfetti ──────────────────────────────────────────────
  // Función principal de la animación. useCallback la memoriza para no recrearla
  // en cada render (evita loops de efectos).
  const startConfetti = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d'); // Contexto 2D del canvas para dibujar
    if (!ctx) return;

    // Hacemos el canvas tan grande como la ventana del navegador
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // ─── DEFINICIÓN DEL TIPO DE PARTÍCULA ───────────────────────────────
    // Array donde guardamos TODAS las partículas activas en cada frame.
    // Cada partícula es un objeto con estas propiedades:
    const particles: Array<{
      x: number;           // Posición horizontal actual (en píxeles)
      y: number;           // Posición vertical actual (en píxeles)
      size: number;        // Tamaño de la partícula (en píxeles)
      color: string;       // Color en formato hex (ej. "#008080")
      shape: ConfettiShape;// La figura que representa (square, star, heart, etc.)
      vx: number;          // Velocidad horizontal (puede ser negativa = va a la izquierda)
      vy: number;          // Velocidad vertical (positivo = cae hacia abajo)
      rotation: number;    // Ángulo de rotación actual en grados
      rotationSpeed: number; // Cuánto rota por frame (positivo = horario, negativo = antihorario)
      opacity: number;     // Transparencia: 1 = sólido, 0 = invisible
    }> = [];

    // ─── FUNCIÓN: createBurst ────────────────────────────────────────────
    // Crea un conjunto de partículas nuevas de golpe (un "burst" = explosión)
    function createBurst() {
      // Creamos "particlesPerBurst" partículas de una vez
      for (let i = 0; i < particlesPerBurst; i++) {
        // Cada partícula elige una de las figuras activas al azar.
        const pickedShape = activeShapes[Math.floor(Math.random() * activeShapes.length)];
        // Math.random() → número entre 0 y 1
        // Math.floor(...) → redondea hacia abajo para obtener un índice entero

        // Tamaño base: las figuras detalladas necesitan ~22-30px para que
        // se distinga la silueta; el cuadrado clásico va un poco más chico.
        const baseSize = pickedShape === 'square' ? 12 : 22;

        particles.push({
          // ! (non-null assertion): le decimos a TypeScript que canvas no es null aquí
          x: Math.random() * canvas!.width,          // Posición X aleatoria en todo el ancho
          y: -20 - Math.random() * 80,               // Empieza arriba de la pantalla (-20 a -100)
          size: baseSize + Math.random() * 8,        // Tamaño con variación aleatoria
          color: palette[Math.floor(Math.random() * palette.length)], // Color aleatorio de la paleta
          shape: pickedShape,
          vx: (Math.random() - 0.5) * 2,            // Velocidad X: entre -1 y +1 (deriva lateral)
          vy: 1.5 + Math.random() * 2.2,             // Velocidad Y: entre 1.5 y 3.7 (cae)
          rotation: Math.random() * 360,             // Rotación inicial aleatoria (0° a 360°)
          rotationSpeed: (Math.random() - 0.5) * 4, // Velocidad de rotación: -2 a +2 grados/frame
          opacity: 1,                                // Empieza completamente visible
        });
      }
    }

    // ─── VARIABLES DE CONTROL DE LA ANIMACIÓN ───────────────────────────
    const startTime = Date.now();  // Momento en que comenzó la animación
    let lastBurst = 0;             // Tiempo del último burst creado

    // fadeStart: a partir de cuándo comenzar a desvanecer las partículas
    // Se desvanecen en los últimos 1500ms de la animación
    const fadeStart = duration - 1500;

    // burstStopAt: dejamos de crear nuevos bursts en los últimos 1500ms
    // para que las partículas existentes puedan caer y desvanecerse con calma
    const burstStopAt = duration - 1500;

    // ─── FUNCIÓN: animate ────────────────────────────────────────────────
    // Esta función se ejecuta ~60 veces por segundo gracias a requestAnimationFrame.
    // En cada "frame" actualiza la posición de todas las partículas y las redibuja.
    function animate() {
      const elapsed = Date.now() - startTime; // Milisegundos desde que empezó

      // Borramos el canvas completo antes de redibujar
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);

      // Creamos un nuevo burst cada 500ms (mientras no hayamos llegado al tiempo de parada)
      if (elapsed - lastBurst > 500 && elapsed < burstStopAt) {
        createBurst();
        lastBurst = elapsed; // Actualizamos el tiempo del último burst
      }

      // Iteramos las partículas DE ATRÁS PARA ADELANTE porque las vamos eliminando.
      // Si iteráramos hacia adelante y elimináramos partículas, saltaríamos índices.
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]; // La partícula actual

        // ── Física: actualizamos la posición y velocidad de la partícula
        p.x += p.vx;    // Movemos horizontalmente según su velocidad X
        p.vy += 0.06;   // Gravedad: la velocidad vertical aumenta cada frame (aceleración)
        p.y += p.vy;    // Movemos verticalmente según su velocidad Y (ya con gravedad)
        p.rotation += p.rotationSpeed; // Giramos la partícula

        // Fricción del aire: frenamos levemente la deriva lateral
        p.vx *= 0.999;

        // Movimiento ondulante: añadimos una pequeña variación sinusoidal a la velocidad X
        // Math.sin(...) oscila entre -1 y +1 → hace que las partículas "bailen" un poco
        p.vx += Math.sin(elapsed * 0.0005 + i) * 0.01;

        // ── Desvanecimiento: reducimos la opacidad en los últimos 1500ms
        if (elapsed > fadeStart) {
          // Math.max(0, ...) evita que la opacidad sea negativa
          p.opacity = Math.max(0, p.opacity - 0.015);
        }

        // ── Eliminación: si la partícula salió de la pantalla o se volvió invisible
        if (p.y > canvas!.height + 40 || p.opacity <= 0) {
          // .splice(i, 1) → elimina 1 elemento en el índice i del array
          particles.splice(i, 1);
          continue; // Pasamos a la siguiente partícula sin dibujar esta
        }

        // ── Dibujo: pintamos la partícula en su posición actual
        ctx!.save(); // Guardamos el estado del contexto (para no contaminar otras partículas)

        // Movemos el origen del sistema de coordenadas al centro de la partícula
        ctx!.translate(p.x, p.y);

        // Rotamos el contexto en los radianes equivalentes al ángulo en grados
        // (Math.PI / 180 = factor de conversión grados → radianes)
        ctx!.rotate((p.rotation * Math.PI) / 180);

        // Aplicamos la transparencia actual de la partícula
        ctx!.globalAlpha = p.opacity;

        // Aplicamos el color de la partícula (para relleno y trazo)
        ctx!.fillStyle = p.color;
        ctx!.strokeStyle = p.color;

        // Llamamos a la función de dibujo específica de cada forma
        // SHAPES['square'].draw(ctx, size) dibuja un cuadrado de "size" píxeles
        // SHAPES['star'].draw(ctx, size) dibuja una estrella, etc.
        SHAPES[p.shape].draw(ctx!, p.size);

        ctx!.restore(); // Restauramos el estado del contexto (deshacemos translate y rotate)
      }

      // ── Control del bucle
      if (elapsed < duration) {
        // La animación sigue: pedimos al navegador que llame a animate() en el siguiente frame
        animationRef.current = requestAnimationFrame(animate);
      } else {
        // La animación terminó: limpiamos el canvas y llamamos al callback
        ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
        // ?. → "llama solo si no es null/undefined"
        onCompleteRef.current?.();
      }
    }

    // Iniciamos la animación creando el primer burst y arrancando el loop
    createBurst();
    animate();
  }, [duration, particlesPerBurst, activeShapes, palette]);
  // useCallback recrea la función solo si cambia alguna de estas dependencias

  // ─── EFECTO 1: Arrancar/detener la animación según "show" ────────────────
  useEffect(() => {
    if (show) startConfetti(); // Si show=true, iniciamos la animación

    // Función de limpieza: cuando show cambia a false o el componente se desmonta,
    // cancelamos el requestAnimationFrame para no seguir gastando CPU
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [show, startConfetti]); // Reacciona a cambios en show y en startConfetti

  // ─── EFECTO 2: Ajustar el canvas al redimensionar la ventana ─────────────
  useEffect(() => {
    function handleResize() {
      if (canvasRef.current) {
        // Actualizamos el tamaño del canvas para que siga cubriendo toda la pantalla
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    }
    window.addEventListener('resize', handleResize); // Escuchamos el evento resize

    // Limpieza: eliminamos el listener cuando el componente se desmonta
    return () => window.removeEventListener('resize', handleResize);
  }, []); // Solo al montar/desmontar

  // ─── RENDERIZADO CONDICIONAL ──────────────────────────────────────────────
  // Si show=false, no renderizamos NADA (null = componente invisible)
  if (!show) return null;

  // ─── JSX ─────────────────────────────────────────────────────────────────
  return (
    // Capa que cubre toda la pantalla encima de todo (z-[60])
    // pointer-events-none: el usuario puede seguir clickeando DEBAJO del confeti
    <div className="fixed inset-0 z-[60] pointer-events-none">
      {/* El canvas donde se pinta todo el confeti */}
      {/* "absolute inset-0" → ocupa todo el div padre */}
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  );
}
