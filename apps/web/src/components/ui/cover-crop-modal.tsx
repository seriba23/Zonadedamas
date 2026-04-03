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
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);

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

  function handlePointerDown(e: React.PointerEvent) {
    setDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    containerRef.current?.setPointerCapture(e.pointerId);
  }

  function clampOffset(x: number, y: number) {
    const img = imageRef.current;
    if (!img) return { x, y };
    const scale = Math.max(PREVIEW_W / img.width, PREVIEW_H / img.height) * zoom;
    const maxX = (img.width * scale - PREVIEW_W) / 2;
    const maxY = (img.height * scale - PREVIEW_H) / 2;
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
            className="relative rounded-xl overflow-hidden border-2 border-gray-200 cursor-grab active:cursor-grabbing"
            style={{ width: PREVIEW_W, height: PREVIEW_H }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            <canvas
              ref={canvasRef}
              width={PREVIEW_W}
              height={PREVIEW_H}
              className="block"
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
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            className="flex-1 accent-primary-600"
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
            className="flex-1 px-3 py-2 text-sm rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors"
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
  );
}
