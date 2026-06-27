'use client';
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ censor-eyes-modal.tsx                                                     │
// │                                                                          │
// │ Editor para "tapar los ojos" de una foto antes de subirla. Coloca un     │
// │ rectángulo del color de Siliba (teal) que el empleado/administrador puede│
// │ MOVER (arrastrar el cuerpo), REDIMENSIONAR (handle de la esquina) y      │
// │ ROTAR (handle de arriba). Al aceptar, el rectángulo se "hornea" sobre la │
// │ imagen a resolución completa y se devuelve un File nuevo (sin tocar el    │
// │ servidor — todo ocurre en el navegador, sin problemas de CORS).          │
// │                                                                          │
// │ Reutiliza el patrón de avatar-crop-modal.tsx: Canvas + Pointer Events    │
// │ (mouse + touch en un solo API), sin librerías externas.                  │
// └─────────────────────────────────────────────────────────────────────────┘

import { useEffect, useRef, useState, useCallback } from 'react';

const TEAL = '#008080'; // color del logo de Siliba (el rectángulo de censura)
const PREVIEW_MAX = 360; // lado máximo (px) del lienzo de previsualización
const HANDLE_HIT = 16; // radio (px) para "agarrar" un handle

interface CensorEyesModalProps {
  imageFile: File;                       // foto seleccionada/tomada
  onAccept: (file: File) => void;        // devuelve la imagen YA censurada
  onSkip: () => void;                    // subir sin cubrir (la original)
  onCancel: () => void;                  // descartar (no subir nada)
}

// Rectángulo de censura: centro (cx,cy), tamaño (w,h) y ángulo en radianes.
interface Rect { cx: number; cy: number; w: number; h: number; angle: number; }

// Rota un punto (px,py) alrededor del origen por el ángulo a (radianes).
function rotatePt(px: number, py: number, a: number) {
  const cos = Math.cos(a), sin = Math.sin(a);
  return { x: px * cos - py * sin, y: px * sin + py * cos };
}

export function CensorEyesModal({ imageFile, onAccept, onSkip, onCancel }: CensorEyesModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  // Tamaño dibujado de la imagen en el preview (el canvas mide exactamente esto).
  const drawnRef = useRef({ w: 0, h: 0 });
  const [ready, setReady] = useState(false);
  const [rect, setRect] = useState<Rect>({ cx: 0, cy: 0, w: 0, h: 0, angle: 0 });

  // Modo de interacción actual y datos del arrastre.
  const modeRef = useRef<'none' | 'move' | 'resize' | 'rotate'>('none');
  // grabRef: al empezar a mover, guardamos el desfase (offset) entre el puntero
  // y el centro del rectángulo. Así en cada movimiento posicionamos el centro
  // de forma ABSOLUTA (centro = puntero − offset), igual que rotar/redimensionar.
  // Evita el enfoque por delta incremental, que es frágil.
  const grabRef = useRef({ x: 0, y: 0 });

  // Bloquear scroll del fondo mientras el modal está abierto.
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Cargar la imagen y colocar el rectángulo inicial sobre la zona de los ojos.
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      // Ajuste "contain": la imagen cabe dentro de PREVIEW_MAX sin deformarse.
      const ratio = Math.min(PREVIEW_MAX / img.width, PREVIEW_MAX / img.height);
      const dw = Math.round(img.width * ratio);
      const dh = Math.round(img.height * ratio);
      drawnRef.current = { w: dw, h: dh };
      // Rectángulo inicial: barra horizontal centrada, a ~38% de la altura
      // (aprox. la zona de los ojos en un retrato).
      setRect({ cx: dw / 2, cy: dh * 0.38, w: dw * 0.5, h: dh * 0.12, angle: 0 });
      setReady(true);
    };
    img.src = URL.createObjectURL(imageFile);
    return () => URL.revokeObjectURL(img.src);
  }, [imageFile]);

  // Posiciones (en píxeles del preview) de los handles de rotar y redimensionar.
  const handlePositions = useCallback((r: Rect) => {
    const resizeLocal = rotatePt(r.w / 2, r.h / 2, r.angle);     // esquina inferior derecha
    const rotateLocal = rotatePt(0, -r.h / 2 - 26, r.angle);     // punto arriba del centro
    return {
      resize: { x: r.cx + resizeLocal.x, y: r.cy + resizeLocal.y },
      rotate: { x: r.cx + rotateLocal.x, y: r.cy + rotateLocal.y },
    };
  }, []);

  // Dibuja la imagen + el rectángulo teal + los handles en el canvas de preview.
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;
    const { w: dw, h: dh } = drawnRef.current;
    canvas.width = dw;
    canvas.height = dh;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, dw, dh);
    ctx.drawImage(img, 0, 0, dw, dh);

    // Rectángulo de censura (con rotación alrededor de su centro).
    ctx.save();
    ctx.translate(rect.cx, rect.cy);
    ctx.rotate(rect.angle);
    ctx.fillStyle = TEAL;
    ctx.fillRect(-rect.w / 2, -rect.h / 2, rect.w, rect.h);
    ctx.restore();

    // Handles (círculos blancos con borde teal) para redimensionar y rotar.
    const h = handlePositions(rect);
    const dot = (x: number, y: number) => {
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = TEAL;
      ctx.stroke();
    };
    // Línea que une el rectángulo con el handle de rotar.
    ctx.beginPath();
    ctx.moveTo(rect.cx, rect.cy);
    ctx.lineTo(h.rotate.x, h.rotate.y);
    ctx.strokeStyle = TEAL;
    ctx.lineWidth = 1;
    ctx.stroke();
    dot(h.resize.x, h.resize.y);
    dot(h.rotate.x, h.rotate.y);
  }, [rect, handlePositions]);

  useEffect(() => { if (ready) draw(); }, [ready, draw]);

  // Convierte la posición del puntero (evento) a coordenadas del canvas.
  function pointerPos(e: React.PointerEvent) {
    const canvas = canvasRef.current!;
    const r = canvas.getBoundingClientRect();
    // El canvas puede estar escalado por CSS; convertimos a px internos.
    const sx = canvas.width / r.width;
    const sy = canvas.height / r.height;
    return { x: (e.clientX - r.left) * sx, y: (e.clientY - r.top) * sy };
  }

  function onPointerDown(e: React.PointerEvent) {
    e.preventDefault();
    const p = pointerPos(e);
    const h = handlePositions(rect);
    const near = (a: { x: number; y: number }) => Math.hypot(p.x - a.x, p.y - a.y) <= HANDLE_HIT;
    if (near(h.rotate)) modeRef.current = 'rotate';
    else if (near(h.resize)) modeRef.current = 'resize';
    else {
      // ¿El puntero cae DENTRO del rectángulo? Lo transformamos a coordenadas
      // locales del rectángulo (deshaciendo la rotación) y comparamos con w/h.
      const local = rotatePt(p.x - rect.cx, p.y - rect.cy, -rect.angle);
      if (Math.abs(local.x) <= rect.w / 2 && Math.abs(local.y) <= rect.h / 2) {
        modeRef.current = 'move';
        // Guardamos el offset puntero→centro para mover de forma absoluta.
        grabRef.current = { x: p.x - rect.cx, y: p.y - rect.cy };
      } else {
        modeRef.current = 'none';
      }
    }
    canvasRef.current?.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (modeRef.current === 'none') return;
    e.preventDefault();
    const p = pointerPos(e);
    setRect((r) => {
      if (modeRef.current === 'move') {
        // Posición absoluta: centro = puntero − offset de agarre.
        return { ...r, cx: p.x - grabRef.current.x, cy: p.y - grabRef.current.y };
      }
      if (modeRef.current === 'resize') {
        // Tamaño = doble de la distancia (local) del puntero al centro.
        const local = rotatePt(p.x - r.cx, p.y - r.cy, -r.angle);
        return { ...r, w: Math.max(16, Math.abs(local.x) * 2), h: Math.max(10, Math.abs(local.y) * 2) };
      }
      // rotate: ángulo del centro al puntero (+90° para que "arriba" sea 0).
      const ang = Math.atan2(p.y - r.cy, p.x - r.cx) + Math.PI / 2;
      return { ...r, angle: ang };
    });
  }

  function onPointerUp(e: React.PointerEvent) {
    e.preventDefault();
    modeRef.current = 'none';
  }

  // Hornea el rectángulo sobre la imagen a RESOLUCIÓN COMPLETA y devuelve el File.
  function accept() {
    const img = imageRef.current;
    if (!img) return;
    const { w: dw } = drawnRef.current;
    const scale = img.width / dw; // factor preview → imagen real
    const out = document.createElement('canvas');
    out.width = img.width;
    out.height = img.height;
    const ctx = out.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(img, 0, 0);
    // Mismo rectángulo, escalado a las coordenadas reales de la imagen.
    ctx.save();
    ctx.translate(rect.cx * scale, rect.cy * scale);
    ctx.rotate(rect.angle);
    ctx.fillStyle = TEAL;
    ctx.fillRect((-rect.w / 2) * scale, (-rect.h / 2) * scale, rect.w * scale, rect.h * scale);
    ctx.restore();
    out.toBlob(
      (blob) => {
        if (!blob) return;
        onAccept(new File([blob], imageFile.name, { type: 'image/jpeg' }));
      },
      'image/jpeg',
      0.9,
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4" style={{ touchAction: 'none' }}>
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-gray-900 text-center mb-1">Cubrir los ojos</h3>
        <p className="text-xs text-gray-400 text-center mb-3">
          Arrastra el rectángulo sobre los ojos. Usa los puntos para redimensionar y rotar.
        </p>

        <div className="flex justify-center mb-4">
          <canvas
            ref={canvasRef}
            className="rounded-xl border border-gray-200 touch-none max-w-full"
            style={{ touchAction: 'none', cursor: 'grab' }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="px-3 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            Sin cubrir
          </button>
          <button
            type="button"
            onClick={accept}
            className="px-3 py-2 text-sm rounded-lg text-white"
            style={{ backgroundColor: TEAL }}
          >
            Aplicar
          </button>
        </div>
      </div>
    </div>
  );
}
