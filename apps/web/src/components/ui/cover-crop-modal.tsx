'use client';
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ cover-crop-modal.tsx                                                    │
// │                                                                         │
// │ ¿QUÉ HACE ESTE COMPONENTE?                                              │
// │ Modal para recortar una imagen de portada (cover/banner) antes de       │
// │ subirla. Similar a AvatarCropModal pero con diferencias importantes:    │
// │  - El recorte es RECTANGULAR (no circular): horizontal (1200x430) o    │
// │    vertical (720x1280) según la prop "aspect"                           │
// │  - Soporta GESTOS MULTI-TOUCH: "pinch to zoom" con dos dedos           │
// │    (además del drag con un dedo y el slider de zoom)                   │
// │  - Incluye botones rápidos "Centrar" y "Ajustar al recuadro"           │
// │                                                                         │
// │ CONCEPTOS ADICIONALES VS AvatarCropModal:                               │
// │  - Map<number, {x,y}>: mapa de punteros activos (múltiples dedos)      │
// │  - Math.hypot(dx, dy): calcula la distancia entre dos puntos           │
// │  - outputScaleX/Y: factores independientes para X e Y (portada no es  │
// │    cuadrada, por eso se necesitan dos escalas distintas)                │
// └─────────────────────────────────────────────────────────────────────────┘

// Hooks de React
import { useState, useRef, useCallback, useEffect } from 'react';

// ─── INTERFAZ DE PROPS ───────────────────────────────────────────────────────
interface CoverCropModalProps {
  imageFile: File;                         // Archivo de imagen seleccionado
  onAccept: (croppedFile: File) => void;   // Callback: recibe el archivo recortado
  onCancel: () => void;                    // Callback: usuario canceló
  onChooseAnother: () => void;             // Callback: usuario quiere otra foto
  aspect?: 'landscape' | 'portrait';      // Orientación del recorte (default: 'portrait')
}

// ─── COMPONENTE PRINCIPAL ────────────────────────────────────────────────────
export function CoverCropModal({
  imageFile,
  onAccept,
  onCancel,
  onChooseAnother,
  aspect = 'portrait', // Por defecto recorte vertical (para perfiles de negocio)
}: CoverCropModalProps) {

  // ─── REFS ──────────────────────────────────────────────────────────────────
  const canvasRef = useRef<HTMLCanvasElement>(null);      // El canvas del preview
  const imageRef = useRef<HTMLImageElement | null>(null); // La imagen HTML cargada
  const containerRef = useRef<HTMLDivElement>(null);      // El div contenedor (para setPointerCapture)

  // ─── ESTADO LOCAL ─────────────────────────────────────────────────────────
  const [zoom, setZoom] = useState(1);                          // Nivel de zoom (1-3)
  const [offset, setOffset] = useState({ x: 0, y: 0 });        // Desplazamiento de la imagen
  const [imageLoaded, setImageLoaded] = useState(false);        // ¿Ya cargó la imagen?

  // ─── REF: Punteros activos en el contenedor ────────────────────────────────
  // Punteros activos en el contenedor (multi-touch para pinch zoom).
  // Map de pointerId → {x, y, clientX, clientY}.
  // Map<K, V>: estructura de datos como un diccionario { clave: valor }
  // Aquí: clave = número de dedo (pointerId), valor = {x, y} de ese dedo
  // Usamos un Ref (no State) porque NO queremos re-render al actualizar los punteros
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());

  // ─── REF: Estado del gesto en curso ───────────────────────────────────────
  // Estado del gesto en curso (drag de 1 dedo o pinch de 2 dedos).
  const gestureRef = useRef<{
    mode: 'idle' | 'drag' | 'pinch'; // Tipo de gesto actual
    startOffset: { x: number; y: number }; // Offset al comienzo del gesto
    startZoom: number;                     // Zoom al comienzo del gesto
    startDist: number;                     // Distancia entre dedos al comienzo del pinch
    startMid: { x: number; y: number };   // Punto medio (o punto de inicio del drag)
  }>({
    // Valores iniciales: sin gesto activo
    mode: 'idle',
    startOffset: { x: 0, y: 0 },
    startZoom: 1,
    startDist: 0,
    startMid: { x: 0, y: 0 },
  });

  // ─── DIMENSIONES DEL PREVIEW Y OUTPUT ─────────────────────────────────────
  // Calculamos el tamaño del canvas de previsualización y del output final
  // dependiendo de la orientación elegida.
  const isLandscape = aspect === 'landscape'; // true si es horizontal

  // Tamaño del canvas visible en pantalla (el "preview")
  const PREVIEW_W = isLandscape ? 420 : 270;  // Ancho del preview
  const PREVIEW_H = isLandscape ? 150 : 480;  // Alto del preview

  // Tamaño del archivo final generado (alta resolución para el servidor)
  const OUTPUT_W = isLandscape ? 1200 : 720;  // Ancho del output
  const OUTPUT_H = isLandscape ? 430 : 1280;  // Alto del output

  // ─── EFECTO 1: Cargar la imagen en memoria ────────────────────────────────
  useEffect(() => {
    const img = new Image(); // Creamos objeto imagen de JavaScript

    img.onload = () => {
      imageRef.current = img;   // Guardamos la imagen en el ref
      setImageLoaded(true);     // Marcamos como cargada para disparar el dibujo
      setOffset({ x: 0, y: 0 }); // Centramos la imagen
      setZoom(1);               // Reseteamos el zoom
    };

    // URL.createObjectURL: crea una URL temporal para leer el archivo local
    img.src = URL.createObjectURL(imageFile);

    // Limpieza: liberamos la URL cuando el componente se desmonta o cambia imageFile
    return () => URL.revokeObjectURL(img.src);
  }, [imageFile]);

  // ─── FUNCIÓN: drawCanvas ─────────────────────────────────────────────────
  // Dibuja la imagen en el canvas con el zoom y offset actuales.
  // useCallback memoriza para no redibujar innecesariamente.
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Establecemos el tamaño interno del canvas (píxeles de dibujo)
    canvas.width = PREVIEW_W;
    canvas.height = PREVIEW_H;

    ctx.clearRect(0, 0, PREVIEW_W, PREVIEW_H); // Limpiamos antes de redibujar

    // Scale image to cover the preview area
    // Math.max → escala mínima para que la imagen cubra todo el canvas (sin dejar bordes en blanco)
    const scale = Math.max(PREVIEW_W / img.width, PREVIEW_H / img.height) * zoom;
    const scaledW = img.width * scale;  // Ancho de la imagen con la escala aplicada
    const scaledH = img.height * scale; // Alto de la imagen con la escala aplicada

    // Posición para centrar + desplazamiento del usuario
    const x = (PREVIEW_W - scaledW) / 2 + offset.x;
    const y = (PREVIEW_H - scaledH) / 2 + offset.y;

    // Rectangular clip (no circle): recortamos con un rectángulo (no con círculo como en AvatarCropModal)
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, PREVIEW_W, PREVIEW_H); // Rectángulo del tamaño exacto del canvas
    ctx.clip(); // Todo lo que dibujemos queda dentro del rectángulo
    ctx.drawImage(img, x, y, scaledW, scaledH); // Dibujamos la imagen
    ctx.restore();
  }, [zoom, offset]); // Se recrea solo si zoom u offset cambian

  // ─── EFECTO 2: Redibujar cuando la imagen está lista o cambia el estado ───
  useEffect(() => {
    if (imageLoaded) drawCanvas();
  }, [imageLoaded, drawCanvas]);

  // ─── FUNCIÓN: clampOffsetForZoom ─────────────────────────────────────────
  // Limita el desplazamiento para que la imagen siempre cubra el canvas.
  // Acepta un zoom explícito (para el pinch, donde zoom y offset cambian juntos).
  function clampOffsetForZoom(x: number, y: number, z: number) {
    const img = imageRef.current;
    if (!img) return { x, y };

    const scale = Math.max(PREVIEW_W / img.width, PREVIEW_H / img.height) * z;

    // maxX/maxY: desplazamiento máximo en cada dirección.
    // Math.max(0, ...): si la imagen ya es más grande que el canvas, el max es positivo.
    // Si fuera negativa, podría "encogerse" y quedar espacio en blanco.
    const maxX = Math.max(0, (img.width * scale - PREVIEW_W) / 2);
    const maxY = Math.max(0, (img.height * scale - PREVIEW_H) / 2);

    return {
      x: Math.min(maxX, Math.max(-maxX, x)), // Limita al rango [-maxX, maxX]
      y: Math.min(maxY, Math.max(-maxY, y)),
    };
  }

  // ─── FUNCIÓN: clampOffset ────────────────────────────────────────────────
  // Versión simplificada que usa el zoom actual del estado (para el drag simple)
  function clampOffset(x: number, y: number) {
    return clampOffsetForZoom(x, y, zoom);
  }

  // ─── FUNCIÓN: updateGestureMode ──────────────────────────────────────────
  // Determina qué tipo de gesto está en curso según cuántos dedos hay en la pantalla.
  function updateGestureMode() {
    const count = pointersRef.current.size; // Número de dedos en pantalla

    if (count === 2) {
      // DOS dedos → gesto de "pinch" (pellizco para zoom)
      const pts = Array.from(pointersRef.current.values()); // Obtenemos los dos puntos
      const dx = pts[0].x - pts[1].x; // Diferencia horizontal entre los dos dedos
      const dy = pts[0].y - pts[1].y; // Diferencia vertical entre los dos dedos

      gestureRef.current = {
        mode: 'pinch',
        startOffset: { ...offset },       // Guardamos el offset actual (spread para copiar)
        startZoom: zoom,                   // Guardamos el zoom actual
        // Math.hypot: calcula la hipotenusa = distancia entre los dos dedos
        // || 1 evita división por cero si los dedos están en el mismo punto
        startDist: Math.hypot(dx, dy) || 1,
        startMid: { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 },
        // startMid = punto medio entre los dos dedos
      };
    } else if (count === 1) {
      // UN dedo → gesto de "drag" (arrastrar para mover)
      const pt = Array.from(pointersRef.current.values())[0]; // El único punto
      gestureRef.current = {
        mode: 'drag',
        startOffset: { ...offset }, // Guardamos el offset actual
        startZoom: zoom,
        startDist: 0,
        startMid: { x: pt.x, y: pt.y }, // Punto de inicio del drag
      };
    } else {
      // Sin dedos → sin gesto
      gestureRef.current.mode = 'idle';
    }
  }

  // ─── MANEJADOR: handlePointerDown ────────────────────────────────────────
  // Cuando un dedo/mouse toca la pantalla
  function handlePointerDown(e: React.PointerEvent) {
    e.preventDefault();
    containerRef.current?.setPointerCapture(e.pointerId); // El div "captura" el puntero
    // Registramos el nuevo puntero en el Map con su posición
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    updateGestureMode(); // Determinamos el tipo de gesto (ahora puede haber 1 o 2 dedos)
  }

  // ─── MANEJADOR: handlePointerMove ────────────────────────────────────────
  // Cuando un dedo/mouse se mueve (con presión)
  function handlePointerMove(e: React.PointerEvent) {
    e.preventDefault();
    if (!pointersRef.current.has(e.pointerId)) return; // Si no conocemos este puntero, ignoramos

    // Actualizamos la posición del puntero en el Map
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    const g = gestureRef.current; // Leemos el estado del gesto actual

    if (g.mode === 'drag') {
      // ── MODO DRAG: un solo dedo/mouse arrastrando
      const pt = Array.from(pointersRef.current.values())[0];
      const dx = pt.x - g.startMid.x; // Cuánto se movió en X desde el inicio
      const dy = pt.y - g.startMid.y; // Cuánto se movió en Y
      // Aplicamos el movimiento al offset inicial y lo limitamos
      setOffset(clampOffset(g.startOffset.x + dx, g.startOffset.y + dy));

    } else if (g.mode === 'pinch') {
      // ── MODO PINCH: dos dedos haciendo zoom
      const pts = Array.from(pointersRef.current.values());
      if (pts.length < 2) return; // Necesitamos exactamente 2 puntos

      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      const dist = Math.hypot(dx, dy) || 1; // Distancia actual entre los dedos

      // ratio = distancia actual / distancia inicial
      // Si separamos los dedos (dist > startDist), ratio > 1 → zoom in
      // Si los acercamos (dist < startDist), ratio < 1 → zoom out
      const ratio = dist / g.startDist;

      // Calculamos el nuevo zoom: zoom inicial × ratio, limitado a [1, 3]
      const newZoom = Math.min(3, Math.max(1, g.startZoom * ratio));
      setZoom(newZoom);

      // Reajustamos el offset para que no quede fuera de los nuevos límites del zoom
      // prev → función que recibe el offset anterior y devuelve el nuevo
      setOffset((prev) => clampOffsetForZoom(prev.x, prev.y, newZoom));
    }
  }

  // ─── MANEJADOR: handlePointerUp ──────────────────────────────────────────
  // Cuando un dedo/mouse se levanta
  function handlePointerUp(e: React.PointerEvent) {
    e.preventDefault();
    pointersRef.current.delete(e.pointerId); // Eliminamos este puntero del Map
    updateGestureMode(); // Actualizamos el gesto (puede haber quedado 1 o 0 dedos)
  }

  // ─── MANEJADOR: handlePointerCancel ──────────────────────────────────────
  // Cuando el sistema cancela el puntero (llamada entrante, etc.)
  function handlePointerCancel(e: React.PointerEvent) {
    pointersRef.current.delete(e.pointerId);
    updateGestureMode();
  }

  // Ajustes rápidos: centran y/o reencuadran sin que el usuario tenga que
  // arrastrar y zoom manualmente.

  // ─── Botón "Centrar" ──────────────────────────────────────────────────────
  // Resetea solo el offset (posición), manteniendo el zoom actual
  function centerImage() {
    setOffset({ x: 0, y: 0 }); // Vuelve al centro
  }

  // ─── Botón "Ajustar al recuadro" ─────────────────────────────────────────
  // Mínimo zoom 1 = imagen escalada por 'cover'; centrada en (0,0) ya cubre
  // todo el frame. Restablecer ambos a su valor inicial.
  function fitToFrame() {
    setZoom(1);               // Zoom mínimo: imagen cubre exactamente el recuadro
    setOffset({ x: 0, y: 0 }); // Centrada
  }

  // ─── FUNCIÓN: handleAccept ────────────────────────────────────────────────
  // Genera la imagen final a alta resolución y la devuelve al padre.
  async function handleAccept() {
    const canvas = document.createElement('canvas'); // Canvas temporal para el output
    const img = imageRef.current;
    if (!img) return;

    // Dimensiones del archivo final (alta resolución)
    canvas.width = OUTPUT_W;
    canvas.height = OUTPUT_H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Recalculamos la posición en las mismas coordenadas del preview
    const scale = Math.max(PREVIEW_W / img.width, PREVIEW_H / img.height) * zoom;
    const scaledW = img.width * scale;
    const scaledH = img.height * scale;
    const x = (PREVIEW_W - scaledW) / 2 + offset.x;
    const y = (PREVIEW_H - scaledH) / 2 + offset.y;

    // Factores de escala para pasar de preview a output
    // (pueden ser diferentes porque la portada no es cuadrada)
    const outputScaleX = OUTPUT_W / PREVIEW_W;
    const outputScaleY = OUTPUT_H / PREVIEW_H;

    // Dibujamos la imagen en el canvas de output con coordenadas escaladas
    ctx.drawImage(
      img,
      x * outputScaleX,         // Posición X escalada
      y * outputScaleY,         // Posición Y escalada (escala diferente a X)
      scaledW * outputScaleX,   // Ancho escalado
      scaledH * outputScaleY,   // Alto escalado
    );

    // Convertimos el canvas a archivo JPEG y lo devolvemos al padre
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const croppedFile = new File([blob], imageFile.name, {
          type: 'image/jpeg',
        });
        onAccept(croppedFile); // Entregamos el archivo recortado al padre
      },
      'image/jpeg',
      0.9, // Calidad 90%
    );
  }

  // ─── JSX PRINCIPAL ────────────────────────────────────────────────────────
  return (
    // Overlay oscuro a pantalla completa
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      {/* Panel del modal */}
      <div
        className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6"
        onClick={(e) => e.stopPropagation()} // Evita cerrar al hacer click dentro
      >
        <h3 className="text-lg font-semibold text-gray-900 mb-1 text-center">
          Ajustar portada
        </h3>
        {/* Muestra las dimensiones recomendadas según el aspecto */}
        <p className="text-xs text-gray-400 text-center mb-4">
          Tamaño recomendado: {isLandscape ? '1200 x 430 px (horizontal)' : '720 x 1280 px (vertical)'}
        </p>

        {/* Rectangular preview */}
        {/* Contenedor del canvas: overflow-hidden recorta la imagen */}
        <div className="flex justify-center mb-4">
          <div
            ref={containerRef}
            className="relative rounded-xl overflow-hidden border-2 border-gray-200 cursor-grab active:cursor-grabbing select-none"
            style={{
              width: PREVIEW_W,
              height: PREVIEW_H,
              // touch-action: none bloquea el pinch-zoom del navegador en
              // móvil para que ese gesto opere sobre el crop, no sobre la
              // página completa. También evita el scroll por arrastre.
              touchAction: 'none',
              WebkitUserSelect: 'none', // Evita selección de texto al arrastrar en Safari
            }}
            // Eventos de puntero (mouse + touch + stylus unificados)
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            onPointerLeave={handlePointerCancel} // Si el puntero sale del div, tratamos como cancel
          >
            {/* Canvas donde se dibuja la imagen en tiempo real */}
            <canvas
              ref={canvasRef}
              width={PREVIEW_W}
              height={PREVIEW_H}
              className="block" // display:block elimina el espacio extra debajo del canvas
            />
          </div>
        </div>

        {/* Ajustes rápidos: centrar / restablecer */}
        {/* flex-wrap: si no caben en una línea, bajan a la siguiente */}
        <div className="flex items-center justify-center gap-2 mb-3 flex-wrap">
          {/* Botón Centrar: resetea solo el offset */}
          <button
            type="button"
            onClick={centerImage}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
            title="Centrar la imagen en el recuadro" // Tooltip al pasar el mouse
          >
            {/* Ícono de centrado (SVG) */}
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m-8-8h16M9 9l-3 3 3 3m6-6l3 3-3 3" />
            </svg>
            Centrar
          </button>

          {/* Botón Ajustar al recuadro: resetea zoom Y offset */}
          <button
            type="button"
            onClick={fitToFrame}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
            title="Ajustar al tamaño del recuadro (resetea el zoom)"
          >
            {/* Ícono de ajuste (esquinas) */}
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4" />
            </svg>
            Ajustar al recuadro
          </button>
        </div>

        {/* Zoom slider */}
        <div className="flex items-center gap-3 mb-6 px-2">
          {/* Ícono lupa "-" (alejar) */}
          <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
          </svg>

          {/* Slider de zoom: min=1, max=3, pasos de 0.05 */}
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))} // parseFloat: string → número decimal
            className="flex-1 accent-primary-600" // accent-primary-600: color del slider con Tailwind
          />

          {/* Ícono lupa "+" (acercar) */}
          <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
          </svg>
        </div>

        {/* Instrucciones */}
        <p className="text-xs text-gray-400 text-center mb-4">
          Arrastra para mover. Desliza el control o usa <span className="font-medium">pellizco con dos dedos</span> para hacer zoom.
        </p>

        {/* 3 buttons */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onChooseAnother}
            className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Otra foto
          </button>
          <button
            type="button"
            onClick={handleAccept}
            className="flex-1 px-3 py-2 text-sm rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors"
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
  );
}
