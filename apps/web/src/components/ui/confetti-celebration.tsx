'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface ConfettiCelebrationProps {
  show: boolean;
  duration?: number;
  onComplete?: () => void;
}

const COLORS = ['#00cccc', '#00b3b3', '#009999', '#008080', '#004d4d', '#003333', '#ffffff', '#001919'];

export function ConfettiCelebration({
  show,
  duration = 10000,
  onComplete,
}: ConfettiCelebrationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const [confettiDone, setConfettiDone] = useState(false);

  const startConfetti = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles: Array<{
      x: number;
      y: number;
      w: number;
      h: number;
      color: string;
      vx: number;
      vy: number;
      rotation: number;
      rotationSpeed: number;
      opacity: number;
    }> = [];

    function createBurst() {
      for (let i = 0; i < 40; i++) {
        particles.push({
          x: Math.random() * canvas!.width,
          y: -20 - Math.random() * 80,
          w: 12 + Math.random() * 14,
          h: 10 + Math.random() * 14,
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

    function animate() {
      const elapsed = Date.now() - startTime;

      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);

      // Create new bursts every 500ms for the first 7 seconds
      if (elapsed - lastBurst > 500 && elapsed < duration - 3000) {
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

        // Gentle horizontal sway
        p.vx += Math.sin(elapsed * 0.0005 + i) * 0.01;

        // Fade out in last 3 seconds
        if (elapsed > duration - 3000) {
          p.opacity = Math.max(0, p.opacity - 0.008);
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
        setConfettiDone(true);
      }
    }

    createBurst();
    animate();
  }, [duration]);

  useEffect(() => {
    if (show) {
      setConfettiDone(false);
      startConfetti();
    }
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
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
      {!confettiDone && <canvas ref={canvasRef} className="absolute inset-0" />}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl px-8 py-6 text-center pointer-events-auto animate-bounce-in max-w-sm">
          <div className="text-4xl mb-3">🎉</div>
          <h2 className="text-lg font-bold text-gray-900 mb-1">
            ¡Felicitaciones!
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Cita creada exitosamente
          </p>
          <div className="text-left bg-gray-50 rounded-xl p-4 space-y-2">
            <div className="flex items-start gap-2">
              <span className="text-primary-600 mt-0.5">📋</span>
              <p className="text-xs text-gray-600">
                La cita aparece en tu <span className="font-semibold text-gray-800">calendario</span>. Haz clic sobre ella para ver o editar los detalles.
              </p>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-primary-600 mt-0.5">🔔</span>
              <p className="text-xs text-gray-600">
                El cliente recibirá una <span className="font-semibold text-gray-800">notificación</span> con la confirmación de su cita.
              </p>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-primary-600 mt-0.5">✏️</span>
              <p className="text-xs text-gray-600">
                Puedes <span className="font-semibold text-gray-800">reagendar o cancelar</span> la cita en cualquier momento desde el calendario.
              </p>
            </div>
          </div>
          <button
            onClick={onComplete}
            className="mt-4 w-full btn-primary text-sm"
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
  );
}
