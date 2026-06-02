'use client';

import { useEffect, useRef, useCallback } from 'react';

interface ConfettiCelebrationProps {
  show: boolean;
  /** Duración total en ms. Default 5000 (la mitad del valor anterior).
   * Mantén corto: el confeti es decorativo, no debe estorbar. */
  duration?: number;
  /** Partículas por burst. Default 20 (la mitad del valor anterior). */
  particlesPerBurst?: number;
  onComplete?: () => void;
}

const COLORS = ['#00cccc', '#00b3b3', '#009999', '#008080', '#004d4d', '#003333', '#ffffff', '#001919'];

/**
 * Solo el confeti — render del canvas con partículas teal cayendo desde
 * arriba. NO incluye modal ni texto: ese papel ahora lo cumple
 * `AppointmentSuccessSheet` u otro card específico de cada flujo.
 *
 * Cambios respecto a la versión anterior:
 *  - Sin modal interno; este componente sólo dibuja confeti.
 *  - Duración default 5s (antes 10s) y partículas 20/burst (antes 40).
 *  - Fade out en los últimos 1.5s en lugar de 3s para cerrar más rápido.
 */
export function ConfettiCelebration({
  show,
  duration = 5000,
  particlesPerBurst = 20,
  onComplete,
}: ConfettiCelebrationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const startConfetti = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles: Array<{
      x: number; y: number; w: number; h: number;
      color: string; vx: number; vy: number;
      rotation: number; rotationSpeed: number; opacity: number;
    }> = [];

    function createBurst() {
      for (let i = 0; i < particlesPerBurst; i++) {
        particles.push({
          x: Math.random() * canvas!.width,
          y: -20 - Math.random() * 80,
          w: 10 + Math.random() * 12,
          h: 8 + Math.random() * 12,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
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
        if (p.y > canvas!.height + 20 || p.opacity <= 0) {
          particles.splice(i, 1);
          continue;
        }

        ctx!.save();
        ctx!.translate(p.x, p.y);
        ctx!.rotate((p.rotation * Math.PI) / 180);
        ctx!.globalAlpha = p.opacity;
        ctx!.fillStyle = p.color;
        ctx!.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
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
  }, [duration, particlesPerBurst]);

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
