'use client';

import { useEffect, useMemo, useRef, useCallback } from 'react';
import {
  SHAPES,
  DEFAULT_CONFETTI_COLORS,
  isValidShape,
  type ConfettiShape,
} from '@/lib/confetti-shapes';

interface ConfettiCelebrationProps {
  show: boolean;
  /** Duración total en ms. Default 5000. */
  duration?: number;
  /** Partículas por burst. Default 20. */
  particlesPerBurst?: number;
  /** Slug de la figura a usar. Si null/undefined o no válido, usa 'square'. */
  shape?: string | null;
  /** Paleta de hasta 4 colores. Si vacío/null, usa la paleta teal default. */
  colors?: string[] | null;
  onComplete?: () => void;
}

/**
 * Canvas con partículas cayendo desde arriba. Cada partícula es una figura
 * del catálogo `SHAPES`, pintada con uno de los colores configurados. Las
 * partículas rotan mientras caen y se desvanecen al final.
 */
export function ConfettiCelebration({
  show,
  duration = 5000,
  particlesPerBurst = 20,
  shape,
  colors,
  onComplete,
}: ConfettiCelebrationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const activeShape: ConfettiShape = isValidShape(shape) ? shape : 'square';
  // Memoize the palette para evitar que un nuevo array en cada render
  // invalide el useCallback y re-monte la animación en mitad del confeti.
  const palette = useMemo(
    () => (colors && colors.length > 0 ? colors.slice(0, 4) : DEFAULT_CONFETTI_COLORS),
    // Comparamos por contenido serializado para tolerar arrays distintos
    // con los mismos valores (lo típico cuando el padre re-renderea).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(colors)],
  );

  const startConfetti = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const draw = SHAPES[activeShape].draw;

    const particles: Array<{
      x: number;
      y: number;
      size: number;
      color: string;
      vx: number;
      vy: number;
      rotation: number;
      rotationSpeed: number;
      opacity: number;
    }> = [];

    function createBurst() {
      // Tamaño base de partícula: las figuras necesitan ~20-26px para que se
      // distinga la silueta; el cuadrado clásico va un poco más chico.
      const baseSize = activeShape === 'square' ? 12 : 22;
      for (let i = 0; i < particlesPerBurst; i++) {
        particles.push({
          x: Math.random() * canvas!.width,
          y: -20 - Math.random() * 80,
          size: baseSize + Math.random() * 8,
          color: palette[Math.floor(Math.random() * palette.length)],
          vx: (Math.random() - 0.5) * 1,
          vy: 0.4 + Math.random() * 0.7,
          rotation: Math.random() * 360,
          rotationSpeed: (Math.random() - 0.5) * 2,
          opacity: 1,
        });
      }
    }

    const startTime = Date.now();
    let lastBurst = 0;
    const fadeStart = duration - 1500;
    const burstStopAt = duration - 1500;

    function animate() {
      const elapsed = Date.now() - startTime;
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);

      if (elapsed - lastBurst > 500 && elapsed < burstStopAt) {
        createBurst();
        lastBurst = elapsed;
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.vy += 0.01;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;
        p.vx *= 0.999;
        p.vx += Math.sin(elapsed * 0.0005 + i) * 0.01;

        if (elapsed > fadeStart) {
          p.opacity = Math.max(0, p.opacity - 0.015);
        }
        if (p.y > canvas!.height + 40 || p.opacity <= 0) {
          particles.splice(i, 1);
          continue;
        }

        ctx!.save();
        ctx!.translate(p.x, p.y);
        ctx!.rotate((p.rotation * Math.PI) / 180);
        ctx!.globalAlpha = p.opacity;
        ctx!.fillStyle = p.color;
        ctx!.strokeStyle = p.color;
        draw(ctx!, p.size);
        ctx!.restore();
      }

      if (elapsed < duration) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
        onCompleteRef.current?.();
      }
    }

    createBurst();
    animate();
  }, [duration, particlesPerBurst, activeShape, palette]);

  useEffect(() => {
    if (show) startConfetti();
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [show, startConfetti]);

  useEffect(() => {
    function handleResize() {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[60] pointer-events-none">
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  );
}
