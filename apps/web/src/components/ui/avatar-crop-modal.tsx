'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface AvatarCropModalProps {
  imageFile: File;
  onAccept: (croppedFile: File) => void;
  onCancel: () => void;
  onChooseAnother: () => void;
  shape?: 'circle' | 'square';
}

export function AvatarCropModal({
  imageFile,
  onAccept,
  onCancel,
  onChooseAnother,
  shape = 'circle',
}: AvatarCropModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);

  const PREVIEW_SIZE = 300;

  // Lock background scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Load the image
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      setImageLoaded(true);
      // Center the image
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

    canvas.width = PREVIEW_SIZE;
    canvas.height = PREVIEW_SIZE;

    ctx.clearRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE);

    // Calculate scaled dimensions
    const scale = Math.max(PREVIEW_SIZE / img.width, PREVIEW_SIZE / img.height) * zoom;
    const scaledW = img.width * scale;
    const scaledH = img.height * scale;

    // Center + offset — no arc clip here, container's overflow-hidden handles the circle
    const x = (PREVIEW_SIZE - scaledW) / 2 + offset.x;
    const y = (PREVIEW_SIZE - scaledH) / 2 + offset.y;

    ctx.drawImage(img, x, y, scaledW, scaledH);
  }, [zoom, offset]);

  useEffect(() => {
    if (imageLoaded) drawCanvas();
  }, [imageLoaded, drawCanvas]);

  // Mouse/touch drag handlers
  function handlePointerDown(e: React.PointerEvent) {
    e.preventDefault();
    setDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    containerRef.current?.setPointerCapture(e.pointerId);
  }

  function clampOffset(x: number, y: number) {
    const img = imageRef.current;
    if (!img) return { x, y };
    const scale = Math.max(PREVIEW_SIZE / img.width, PREVIEW_SIZE / img.height) * zoom;
    const maxX = (img.width * scale - PREVIEW_SIZE) / 2;
    const maxY = (img.height * scale - PREVIEW_SIZE) / 2;
    return {
      x: Math.min(maxX, Math.max(-maxX, x)),
      y: Math.min(maxY, Math.max(-maxY, y)),
    };
  }

  function handlePointerMove(e: React.PointerEvent) {
    e.preventDefault();
    if (!dragging) return;
    const raw = { x: e.clientX - dragStart.x, y: e.clientY - dragStart.y };
    setOffset(clampOffset(raw.x, raw.y));
  }

  function handlePointerUp(e: React.PointerEvent) {
    e.preventDefault();
    setDragging(false);
  }

  // Generate cropped file on accept
  async function handleAccept() {
    const canvas = document.createElement('canvas');
    const img = imageRef.current;
    if (!img) return;

    // Output at 400x400 for good quality
    const OUTPUT_SIZE = 400;
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const scale = Math.max(PREVIEW_SIZE / img.width, PREVIEW_SIZE / img.height) * zoom;
    const scaledW = img.width * scale;
    const scaledH = img.height * scale;
    const x = (PREVIEW_SIZE - scaledW) / 2 + offset.x;
    const y = (PREVIEW_SIZE - scaledH) / 2 + offset.y;

    // Scale up for output
    const outputScale = OUTPUT_SIZE / PREVIEW_SIZE;
    if (shape === 'circle') {
      ctx.beginPath();
      ctx.arc(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, 0, Math.PI * 2);
      ctx.clip();
    }
    ctx.drawImage(
      img,
      x * outputScale,
      y * outputScale,
      scaledW * outputScale,
      scaledH * outputScale,
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
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4" style={{ touchAction: 'none' }}>
      <div
        className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-gray-900 mb-1 text-center">
          Ajustar fotografía
        </h3>
        <p className="text-xs text-gray-400 text-center mb-4">
          Tamaño recomendado: 400 x 400 px (cuadrada)
        </p>

        {/* Circular preview */}
        <div className="flex justify-center mb-4">
          <div
            ref={containerRef}
            className={`relative overflow-hidden border-2 border-gray-200 cursor-grab active:cursor-grabbing ${shape === 'circle' ? 'rounded-full' : 'rounded-xl'}`}
            style={{ width: PREVIEW_SIZE, height: PREVIEW_SIZE, touchAction: 'none' }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <canvas
              ref={canvasRef}
              width={PREVIEW_SIZE}
              height={PREVIEW_SIZE}
              style={{ display: 'block' }}
            />
          </div>
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
            onChange={(e) => {
              const newZoom = parseFloat(e.target.value);
              setZoom(newZoom);
              const img = imageRef.current;
              if (!img) return;
              const scale = Math.max(PREVIEW_SIZE / img.width, PREVIEW_SIZE / img.height) * newZoom;
              const maxX = (img.width * scale - PREVIEW_SIZE) / 2;
              const maxY = (img.height * scale - PREVIEW_SIZE) / 2;
              setOffset((prev) => ({
                x: Math.min(maxX, Math.max(-maxX, prev.x)),
                y: Math.min(maxY, Math.max(-maxY, prev.y)),
              }));
            }}
            className="flex-1"
            style={{ accentColor: '#008080' }}
          />
          <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
          </svg>
        </div>

        <p className="text-xs text-gray-400 text-center mb-4">
          Arrastra para mover, desliza para hacer zoom
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
            className="flex-1 px-3 py-2 text-sm rounded-lg text-white transition-colors"
            style={{ backgroundColor: '#008080' }}
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
