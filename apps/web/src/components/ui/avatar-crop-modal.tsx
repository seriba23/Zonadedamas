'use client';
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ avatar-crop-modal.tsx                                                   │
// │                                                                         │
// │ ¿QUÉ HACE ESTE COMPONENTE?                                              │
// │ Muestra un modal para recortar una imagen de perfil (avatar) antes de   │
// │ subirla al servidor. El usuario puede:                                  │
// │  - Arrastrar la imagen para moverla dentro del recuadro                 │
// │  - Deslizar un slider para hacer zoom (acercar/alejar)                  │
// │  - Ver una previsualización circular o cuadrada en tiempo real          │
// │  - Cancelar, elegir otra foto, o aceptar el recorte                     │
// │                                                                         │
// │ CONCEPTOS CLAVE:                                                         │
// │  - Canvas: elemento HTML que permite dibujar gráficos con JavaScript.   │
// │    Aquí lo usamos para dibujar la imagen escalada y centrada.           │
// │  - Pointer Events: unificación de mouse, touch y stylus en un solo API  │
// │  - useRef: acceso directo al canvas y a la imagen sin re-renders        │
// │  - useCallback: memoriza funciones para no recrearlas en cada render    │
// └─────────────────────────────────────────────────────────────────────────┘

// Hooks de React que usamos en este componente
import { useState, useRef, useCallback, useEffect } from 'react';

// ─── INTERFAZ DE PROPS ───────────────────────────────────────────────────────
interface AvatarCropModalProps {
  imageFile: File;                         // El archivo de imagen que el usuario seleccionó
  onAccept: (croppedFile: File) => void;   // Callback: cuando acepta el recorte
  onCancel: () => void;                    // Callback: cuando presiona "Cancelar"
  onChooseAnother: () => void;             // Callback: cuando presiona "Otra foto"
  shape?: 'circle' | 'square';            // Forma del recorte final (default: 'circle')
}

// ─── COMPONENTE PRINCIPAL ────────────────────────────────────────────────────
export function AvatarCropModal({
  imageFile,
  onAccept,
  onCancel,
  onChooseAnother,
  shape = 'circle', // Por defecto: recorte circular (para avatares de perfil)
}: AvatarCropModalProps) {

  // ─── REFS (referencias a elementos del DOM) ───────────────────────────────
  // canvasRef: referencia directa al elemento <canvas> donde dibujamos la imagen
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // imageRef: guarda la imagen HTML cargada; no dispara re-render al asignarla
  const imageRef = useRef<HTMLImageElement | null>(null);

  // containerRef: referencia al div que contiene el canvas (para el drag y el clip visual)
  const containerRef = useRef<HTMLDivElement>(null);

  // ─── ESTADO LOCAL ─────────────────────────────────────────────────────────
  // zoom: nivel de ampliación de la imagen (1 = normal, 3 = máximo)
  const [zoom, setZoom] = useState(1);

  // offset: desplazamiento en píxeles de la imagen desde su posición centrada
  // { x: 0, y: 0 } = imagen centrada perfectamente
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  // dragging: true mientras el usuario tiene el dedo/mouse presionado y arrastra
  const [dragging, setDragging] = useState(false);

  // dragStart: posición de la pantalla donde comenzó el arrastre, menos el offset actual.
  // Esto nos permite calcular cuánto se movió el puntero sin que la imagen salte.
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // imageLoaded: true cuando la imagen HTML terminó de cargar (img.onload)
  const [imageLoaded, setImageLoaded] = useState(false);

  // Tamaño del canvas de previsualización en píxeles (cuadrado: 300x300)
  const PREVIEW_SIZE = 300;

  // ─── EFECTO 1: Bloquear scroll del fondo mientras el modal está abierto ───
  // Cuando el modal se abre, el body no debe poder hacer scroll (mala UX).
  useEffect(() => {
    document.body.style.overflow = 'hidden'; // Bloquea el scroll

    // Función de limpieza: se ejecuta al desmontar el componente (cerrar el modal)
    return () => { document.body.style.overflow = ''; }; // Restaura el scroll
  }, []); // [] = solo al montar/desmontar

  // ─── EFECTO 2: Cargar la imagen en memoria ────────────────────────────────
  useEffect(() => {
    // Creamos un objeto Image de JavaScript (el equivalente a <img> en JS)
    const img = new Image();

    // Cuando la imagen termina de cargarse, la guardamos en el ref y marcamos ready
    img.onload = () => {
      imageRef.current = img; // Guardamos para usarla en el canvas
      setImageLoaded(true);   // Dispara el re-render y el dibujo inicial
      // Centramos la imagen al cargar
      setOffset({ x: 0, y: 0 });
      setZoom(1);
    };

    // URL.createObjectURL convierte el File en una URL temporal del navegador
    // Esto permite que el <img> pueda "cargar" desde un archivo local
    img.src = URL.createObjectURL(imageFile);

    // Limpieza: liberamos la URL temporal cuando el componente se desmonta o
    // cuando imageFile cambia, para evitar "memory leaks" (fugas de memoria)
    return () => URL.revokeObjectURL(img.src);
  }, [imageFile]); // Se re-ejecuta si el usuario elige otra imagen

  // ─── FUNCIÓN: drawCanvas ─────────────────────────────────────────────────
  // Dibuja la imagen en el canvas aplicando el zoom y el offset actuales.
  // useCallback memoriza esta función y solo la recrea si zoom u offset cambian.
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current; // El elemento <canvas>
    const img = imageRef.current;     // La imagen ya cargada
    if (!canvas || !img) return;      // Si alguno no está listo, no hacemos nada

    const ctx = canvas.getContext('2d'); // Contexto 2D para dibujar
    if (!ctx) return;

    // Fijamos el tamaño interno del canvas (los píxeles de dibujo, no el tamaño CSS)
    canvas.width = PREVIEW_SIZE;
    canvas.height = PREVIEW_SIZE;

    // Limpiamos el canvas antes de redibujar
    ctx.clearRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE);

    // Calculamos la escala para que la imagen cubra TODO el canvas (como CSS "cover"):
    // Math.max(w/img.w, h/img.h) → la escala mínima que asegura cobertura total
    // * zoom → aplicamos el zoom del usuario (1 a 3)
    const scale = Math.max(PREVIEW_SIZE / img.width, PREVIEW_SIZE / img.height) * zoom;
    const scaledW = img.width * scale;   // Ancho de la imagen escalada
    const scaledH = img.height * scale;  // Alto de la imagen escalada

    // Posición x,y para centrar la imagen + el desplazamiento del usuario:
    // (PREVIEW_SIZE - scaledW) / 2 centra la imagen, + offset.x la mueve
    // Center + offset — no arc clip here, container's overflow-hidden handles the circle
    const x = (PREVIEW_SIZE - scaledW) / 2 + offset.x;
    const y = (PREVIEW_SIZE - scaledH) / 2 + offset.y;

    // Dibujamos la imagen en el canvas con las coordenadas y tamaño calculados
    ctx.drawImage(img, x, y, scaledW, scaledH);
  }, [zoom, offset]); // Se recrea solo cuando cambia zoom u offset

  // ─── EFECTO 3: Redibujar el canvas cuando la imagen está lista o cambia ───
  useEffect(() => {
    if (imageLoaded) drawCanvas(); // Solo dibujamos si la imagen ya cargó
  }, [imageLoaded, drawCanvas]);   // Reacciona a imageLoaded o a cambios en drawCanvas

  // ─── MANEJADORES DE ARRASTRE (Pointer Events) ────────────────────────────
  // Pointer Events = mouse + touch + stylus en un solo API.
  // Esto permite que funcione igual con dedo en móvil y con mouse en escritorio.

  // handlePointerDown: cuando el usuario presiona (inicia el arrastre)
  function handlePointerDown(e: React.PointerEvent) {
    e.preventDefault(); // Evita comportamientos por defecto (como selección de texto)
    setDragging(true);

    // Guardamos el punto de origen del arrastre restando el offset actual.
    // Esto hace que el cálculo de movimiento sea relativo al punto donde el usuario presionó.
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });

    // setPointerCapture: el div "captura" todos los eventos del puntero aunque el usuario
    // lo mueva fuera del div. Indispensable para que el drag no se rompa.
    containerRef.current?.setPointerCapture(e.pointerId);
  }

  // clampOffset: limita el offset para que la imagen no se desplace tanto que
  // el canvas quede sin cubrir (deje áreas en blanco).
  function clampOffset(x: number, y: number) {
    const img = imageRef.current;
    if (!img) return { x, y }; // Sin imagen, no podemos calcular límites

    const scale = Math.max(PREVIEW_SIZE / img.width, PREVIEW_SIZE / img.height) * zoom;

    // maxX/maxY: el desplazamiento máximo permitido para cada eje.
    // Si la imagen escalada mide 400px y el canvas 300px, solo puede moverse 50px en cada lado.
    const maxX = (img.width * scale - PREVIEW_SIZE) / 2;
    const maxY = (img.height * scale - PREVIEW_SIZE) / 2;

    return {
      // Math.min(max, Math.max(-max, x)) → limita x al rango [-maxX, maxX]
      x: Math.min(maxX, Math.max(-maxX, x)),
      y: Math.min(maxY, Math.max(-maxY, y)),
    };
  }

  // handlePointerMove: cuando el usuario arrastra (mueve con presión)
  function handlePointerMove(e: React.PointerEvent) {
    e.preventDefault();
    if (!dragging) return; // Si no está en modo arrastre, ignoramos

    // Calculamos el nuevo offset restando el punto de origen
    const raw = { x: e.clientX - dragStart.x, y: e.clientY - dragStart.y };
    // Lo limitamos para no salirnos de los bordes y actualizamos el estado
    setOffset(clampOffset(raw.x, raw.y));
  }

  // handlePointerUp: cuando el usuario suelta (termina el arrastre)
  function handlePointerUp(e: React.PointerEvent) {
    e.preventDefault();
    setDragging(false); // Salimos del modo arrastre
  }

  // ─── MANEJADOR: handleAccept ──────────────────────────────────────────────
  // Cuando el usuario hace click en "Aceptar", generamos la imagen recortada
  // a alta resolución (400x400) y la devolvemos al padre como un File.
  async function handleAccept() {
    // Creamos un NUEVO canvas (temporal, no el del preview) para el output final
    const canvas = document.createElement('canvas');
    const img = imageRef.current;
    if (!img) return;

    // Output at 400x400 for good quality
    const OUTPUT_SIZE = 400;
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Recalculamos la posición y tamaño en las mismas proporciones que el preview
    const scale = Math.max(PREVIEW_SIZE / img.width, PREVIEW_SIZE / img.height) * zoom;
    const scaledW = img.width * scale;
    const scaledH = img.height * scale;
    const x = (PREVIEW_SIZE - scaledW) / 2 + offset.x;
    const y = (PREVIEW_SIZE - scaledH) / 2 + offset.y;

    // outputScale: factor para pasar de coordenadas del preview al canvas de output
    // Si el output es 400 y el preview 300, outputScale = 400/300 ≈ 1.333
    const outputScale = OUTPUT_SIZE / PREVIEW_SIZE;

    // Si la forma es 'circle', aplicamos una máscara circular antes de dibujar
    if (shape === 'circle') {
      ctx.beginPath(); // Comenzamos un nuevo trazo
      // arc(x, y, radio, ángulo inicio, ángulo fin): dibuja un círculo
      // Math.PI * 2 = 360° en radianes = círculo completo
      ctx.arc(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, 0, Math.PI * 2);
      ctx.clip(); // Todo lo que se dibuje de ahora en adelante queda dentro del círculo
    }

    // Dibujamos la imagen escalada al tamaño del output (400x400)
    ctx.drawImage(
      img,
      x * outputScale,         // Coordenada X escalada
      y * outputScale,         // Coordenada Y escalada
      scaledW * outputScale,   // Ancho escalado
      scaledH * outputScale,   // Alto escalado
    );

    // canvas.toBlob convierte el canvas en un archivo JPEG de forma asíncrona
    // 0.9 = 90% de calidad JPEG (buen balance entre peso y calidad)
    canvas.toBlob(
      (blob) => {
        if (!blob) return; // Si algo falló, no continuamos

        // Creamos un File a partir del blob (binario de la imagen)
        // con el mismo nombre que el original, pero tipo JPEG
        const croppedFile = new File([blob], imageFile.name, {
          type: 'image/jpeg',
        });

        // Devolvemos el archivo recortado al componente padre
        onAccept(croppedFile);
      },
      'image/jpeg', // Formato de salida
      0.9,          // Calidad (0 a 1)
    );
  }

  // ─── JSX PRINCIPAL ────────────────────────────────────────────────────────
  return (
    // Overlay oscuro que cubre toda la pantalla (fixed inset-0)
    // z-[60] → encima del z-50 de otros modales que pudieran estar abiertos
    // touchAction: 'none' → evita que el navegador móvil interfiera con los gestos
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4" style={{ touchAction: 'none' }}>
      {/* Panel blanco del modal */}
      <div
        className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6"
        onClick={(e) => e.stopPropagation()}
        // stopPropagation: evita que el click dentro del modal cierre el overlay
      >
        {/* Título */}
        <h3 className="text-lg font-semibold text-gray-900 mb-1 text-center">
          Ajustar fotografía
        </h3>
        <p className="text-xs text-gray-400 text-center mb-4">
          Tamaño recomendado: 400 x 400 px (cuadrada)
        </p>

        {/* Circular preview */}
        {/* Contenedor del canvas: overflow-hidden + rounded-full = el círculo visual */}
        <div className="flex justify-center mb-4">
          <div
            ref={containerRef}
            // Si shape='circle' → rounded-full (círculo). Si 'square' → rounded-xl
            className={`relative overflow-hidden border-2 border-gray-200 cursor-grab active:cursor-grabbing ${shape === 'circle' ? 'rounded-full' : 'rounded-xl'}`}
            style={{ width: PREVIEW_SIZE, height: PREVIEW_SIZE, touchAction: 'none' }}
            // Registramos los eventos de puntero en el contenedor
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp} // Si el puntero se cancela (llamada, etc.), tratamos igual que up
          >
            {/* El canvas donde dibujamos la imagen en tiempo real */}
            <canvas
              ref={canvasRef}
              width={PREVIEW_SIZE}
              height={PREVIEW_SIZE}
              style={{ display: 'block' }} // Evita espacio extra debajo del canvas
            />
          </div>
        </div>

        {/* Zoom slider: barra deslizante para acercar/alejar */}
        <div className="flex items-center gap-3 mb-6 px-2">
          {/* Ícono de lupa con "-" (alejar) */}
          <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
          </svg>

          {/* Input de tipo range = slider (barra deslizante) */}
          {/* min=1, max=3 → zoom entre 1x y 3x, step=0.05 → incrementos pequeños */}
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => {
              const newZoom = parseFloat(e.target.value); // Convertimos string a número
              setZoom(newZoom);

              // Al cambiar el zoom también recalculamos los límites del offset
              // porque una imagen más zoomeada puede desplazarse más
              const img = imageRef.current;
              if (!img) return;
              const scale = Math.max(PREVIEW_SIZE / img.width, PREVIEW_SIZE / img.height) * newZoom;
              const maxX = (img.width * scale - PREVIEW_SIZE) / 2;
              const maxY = (img.height * scale - PREVIEW_SIZE) / 2;
              // Actualizamos el offset para que no quede fuera de los nuevos límites
              setOffset((prev) => ({
                x: Math.min(maxX, Math.max(-maxX, prev.x)),
                y: Math.min(maxY, Math.max(-maxY, prev.y)),
              }));
            }}
            className="flex-1"
            style={{ accentColor: '#008080' }} // Color del slider en teal
          />

          {/* Ícono de lupa con "+" (acercar) */}
          <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
          </svg>
        </div>

        {/* Instrucciones para el usuario */}
        <p className="text-xs text-gray-400 text-center mb-4">
          Arrastra para mover, desliza para hacer zoom
        </p>

        {/* 3 buttons: Cancelar | Otra foto | Aceptar */}
        <div className="flex gap-2">
          {/* Botón Cancelar: llama al callback del padre sin hacer nada con la imagen */}
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>

          {/* Botón Otra foto: el padre abrirá el selector de archivos de nuevo */}
          <button
            type="button"
            onClick={onChooseAnother}
            className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Otra foto
          </button>

          {/* Botón Aceptar: genera el recorte final y lo devuelve al padre */}
          <button
            type="button"
            onClick={handleAccept}
            className="flex-1 px-3 py-2 text-sm rounded-lg text-white transition-colors"
            style={{ backgroundColor: '#008080' }}
            // Efecto hover manual porque el color exacto no está en Tailwind
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#006666'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#008080'}
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
  );
}
