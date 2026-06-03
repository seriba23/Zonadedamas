'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface CoverCropModalProps {
  imageFile: File;
  onAccept: (croppedFile: File) => void;
  onCancel: () => void;
  onChooseAnother: () => void;
  aspect?: 'landscape' | 'portrait';
}

export function CoverCropModal({
  imageFile,
  onAccept,
  onCancel,
  onChooseAnother,
  aspect = 'portrait',
}: CoverCropModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);

  // Punteros activos en el contenedor (multi-touch para pinch zoom).
  // Map de pointerId → {x, y, clientX, clientY}.
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  // Estado del gesto en curso (drag de 1 dedo o pinch de 2 dedos).
  const gestureRef = useRef<{
    mode: 'idle' | 'drag' | 'pinch';
    startOffset: { x: number; y: number };
    startZoom: number;
    startDist: number;
    startMid: { x: number; y: number };
  }>({
    mode: 'idle',
    startOffset: { x: 0, y: 0 },
    startZoom: 1,
    startDist: 0,
    startMid: { x: 0, y: 0 },
  });

  // Preview & output dimensions based on aspect
  const isLandscape = aspect === 'landscape';
  const PREVIEW_W = isLandscape ? 420 : 270;
  const PREVIEW_H = isLandscape ? 150 : 480;
  const OUTPUT_W = isLandscape ? 1200 : 720;
  const OUTPUT_H = isLandscape ? 430 : 1280;

  // Load the image
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      setImageLoaded(true);
      setOffset({ x: 0, y: 0 });
      setZoom(1);
    };
    img.src = URL.createObjectURL(imageFile);
    return () => URL.revokeObjectURL(img.src);
  }, [imageFile]);

  // Draw image on canvas
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = PREVIEW_W;
    canvas.height = PREVIEW_H;

    ctx.clearRect(0, 0, PREVIEW_W, PREVIEW_H);

    // Scale image to cover the preview area
    const scale = Math.max(PREVIEW_W / img.width, PREVIEW_H / img.height) * zoom;
    const scaledW = img.width * scale;
    const scaledH = img.height * scale;

    const x = (PREVIEW_W - scaledW) / 2 + offset.x;
    const y = (PREVIEW_H - scaledH) / 2 + offset.y;

    // Rectangular clip (no circle)
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, PREVIEW_W, PREVIEW_H);
    ctx.clip();
    ctx.drawImage(img, x, y, scaledW, scaledH);
    ctx.restore();
  }, [zoom, offset]);

  useEffect(() => {
    if (imageLoaded) drawCanvas();
  }, [imageLoaded, drawCanvas]);

  function clampOffsetForZoom(x: number, y: number, z: number) {
    const img = imageRef.current;
    if (!img) return { x, y };
    const scale = Math.max(PREVIEW_W / img.width, PREVIEW_H / img.height) * z;
    const maxX = Math.max(0, (img.width * scale - PREVIEW_W) / 2);
    const maxY = Math.max(0, (img.height * scale - PREVIEW_H) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, x)),
      y: Math.min(maxY, Math.max(-maxY, y)),
    };
  }

  function clampOffset(x: number, y: number) {
    return clampOffsetForZoom(x, y, zoom);
  }

  function updateGestureMode() {
    const count = pointersRef.current.size;
    if (count === 2) {
      const pts = Array.from(pointersRef.current.values());
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      gestureRef.current = {
        mode: 'pinch',
        startOffset: { ...offset },
        startZoom: zoom,
        startDist: Math.hypot(dx, dy) || 1,
        startMid: { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 },
      };
    } else if (count === 1) {
      const pt = Array.from(pointersRef.current.values())[0];
      gestureRef.current = {
        mode: 'drag',
        startOffset: { ...offset },
        startZoom: zoom,
        startDist: 0,
        startMid: { x: pt.x, y: pt.y },
      };
    } else {
      gestureRef.current.mode = 'idle';
    }
  }

  function handlePointerDown(e: React.PointerEvent) {
    e.preventDefault();
    containerRef.current?.setPointerCapture(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    updateGestureMode();
  }

  function handlePointerMove(e: React.PointerEvent) {
    e.preventDefault();
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    const g = gestureRef.current;
    if (g.mode === 'drag') {
      const pt = Array.from(pointersRef.current.values())[0];
      const dx = pt.x - g.startMid.x;
      const dy = pt.y - g.startMid.y;
      setOffset(clampOffset(g.startOffset.x + dx, g.startOffset.y + dy));
    } else if (g.mode === 'pinch') {
      const pts = Array.from(pointersRef.current.values());
      if (pts.length < 2) return;
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      const dist = Math.hypot(dx, dy) || 1;
      const ratio = dist / g.startDist;
      const newZoom = Math.min(3, Math.max(1, g.startZoom * ratio));
      setZoom(newZoom);
      setOffset((prev) => clampOffsetForZoom(prev.x, prev.y, newZoom));
    }
  }

  function handlePointerUp(e: React.PointerEvent) {
    e.preventDefault();
    pointersRef.current.delete(e.pointerId);
    updateGestureMode();
  }

  function handlePointerCancel(e: React.PointerEvent) {
    pointersRef.current.delete(e.pointerId);
    updateGestureMode();
  }

  // Ajustes rápidos: centran y/o reencuadran sin que el usuario tenga que
  // arrastrar y zoom manualmente.
  function centerImage() {
    setOffset({ x: 0, y: 0 });
  }
  function fitToFrame() {
    // Mínimo zoom 1 = imagen escalada por 'cover'; centrada en (0,0) ya cubre
    // todo el frame. Restablecer ambos a su valor inicial.
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }

  async function handleAccept() {
    const canvas = document.createElement('canvas');
    const img = imageRef.current;
    if (!img) return;

    canvas.width = OUTPUT_W;
    canvas.height = OUTPUT_H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const scale = Math.max(PREVIEW_W / img.width, PREVIEW_H / img.height) * zoom;
    const scaledW = img.width * scale;
    const scaledH = img.height * scale;
    const x = (PREVIEW_W - scaledW) / 2 + offset.x;
    const y = (PREVIEW_H - scaledH) / 2 + offset.y;

    const outputScaleX = OUTPUT_W / PREVIEW_W;
    const outputScaleY = OUTPUT_H / PREVIEW_H;

    ctx.drawImage(
      img,
      x * outputScaleX,
      y * outputScaleY,
      scaledW * outputScaleX,
      scaledH * outputScaleY,
    );

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const croppedFile = new File([blob], imageFile.name, {
          type: 'image/jpeg',
        });
        onAccept(croppedFile);
      },
      'image/jpeg',
      0.9,
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div
        className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-gray-900 mb-1 text-center">
          Ajustar portada
        </h3>
        <p className="text-xs text-gray-400 text-center mb-4">
          Tamaño recomendado: {isLandscape ? '1200 x 430 px (horizontal)' : '720 x 1280 px (vertical)'}
        </p>

        {/* Rectangular preview */}
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
              WebkitUserSelect: 'none',
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            onPointerLeave={handlePointerCancel}
          >
            <canvas
              ref={canvasRef}
              width={PREVIEW_W}
              height={PREVIEW_H}
              className="block"
            />
          </div>
        </div>

        {/* Ajustes rápidos: centrar / restablecer */}
        <div className="flex items-center justify-center gap-2 mb-3 flex-wrap">
          <button
            type="button"
            onClick={centerImage}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
            title="Centrar la imagen en el recuadro"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m-8-8h16M9 9l-3 3 3 3m6-6l3 3-3 3" />
            </svg>
            Centrar
          </button>
          <button
            type="button"
            onClick={fitToFrame}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
            title="Ajustar al tamaño del recuadro (resetea el zoom)"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4" />
            </svg>
            Ajustar al recuadro
          </button>
        </div>

        {/* Zoom slider */}
        <div className="flex items-center gap-3 mb-6 px-2">
          <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
          </svg>
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            className="flex-1 accent-primary-600"
          />
          <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
          </svg>
        </div>

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
