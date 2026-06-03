/**
 * Catálogo de figuras del confeti. Cada `draw(ctx, size)` se llama con el
 * canvas ya trasladado al centro de la partícula y rotado; sólo dibuja la
 * forma con respecto al origen (0,0). El color se aplica antes vía
 * `ctx.fillStyle` y `ctx.strokeStyle`.
 *
 * Diseño minimalista: pocas primitivas por figura para que se vean nítidas
 * a tamaños pequeños (16-24px) y rindan bien con muchas partículas.
 */

export type ConfettiShape =
  | 'square'
  | 'scissors'
  | 'razor'
  | 'comb'
  | 'polish'
  | 'brush'
  | 'star'
  | 'heart'
  | 'flower';

export const DEFAULT_CONFETTI_COLORS = ['#00b3b3', '#008080', '#e0f2f1', '#ffffff'];

export const SHAPES: Record<
  ConfettiShape,
  { label: string; draw: (ctx: CanvasRenderingContext2D, size: number) => void }
> = {
  square: {
    label: 'Clásico',
    draw: (ctx, size) => {
      ctx.fillRect(-size / 2, -size / 2, size, size * 0.8);
    },
  },

  scissors: {
    label: 'Tijeras',
    draw: (ctx, size) => {
      const s = size;
      // Dos manijas (círculos)
      ctx.beginPath();
      ctx.arc(-s * 0.25, s * 0.3, s * 0.18, 0, Math.PI * 2);
      ctx.arc(s * 0.25, s * 0.3, s * 0.18, 0, Math.PI * 2);
      ctx.fill();
      // Cuchillas (líneas gruesas cruzadas)
      ctx.lineWidth = s * 0.15;
      ctx.strokeStyle = ctx.fillStyle as string;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-s * 0.25, s * 0.25);
      ctx.lineTo(s * 0.35, -s * 0.45);
      ctx.moveTo(s * 0.25, s * 0.25);
      ctx.lineTo(-s * 0.35, -s * 0.45);
      ctx.stroke();
    },
  },

  razor: {
    label: 'Navaja',
    draw: (ctx, size) => {
      const s = size;
      // Mango (rectángulo largo)
      ctx.fillRect(-s * 0.45, -s * 0.08, s * 0.55, s * 0.16);
      // Cabezal (triángulo afilado a la derecha)
      ctx.beginPath();
      ctx.moveTo(s * 0.1, -s * 0.18);
      ctx.lineTo(s * 0.5, 0);
      ctx.lineTo(s * 0.1, s * 0.18);
      ctx.closePath();
      ctx.fill();
    },
  },

  comb: {
    label: 'Peine',
    draw: (ctx, size) => {
      const s = size;
      // Base horizontal
      ctx.fillRect(-s * 0.45, -s * 0.1, s * 0.9, s * 0.15);
      // 6 dientes
      const teethCount = 6;
      const teethWidth = s * 0.08;
      const teethHeight = s * 0.3;
      const spacing = (s * 0.9) / teethCount;
      for (let i = 0; i < teethCount; i++) {
        const x = -s * 0.45 + i * spacing + spacing / 2 - teethWidth / 2;
        ctx.fillRect(x, s * 0.05, teethWidth, teethHeight);
      }
    },
  },

  polish: {
    label: 'Esmalte',
    draw: (ctx, size) => {
      const s = size;
      // Tapa (rectángulo arriba, más angosto)
      ctx.fillRect(-s * 0.18, -s * 0.45, s * 0.36, s * 0.25);
      // Cuerpo (botella, más ancho)
      ctx.fillRect(-s * 0.3, -s * 0.2, s * 0.6, s * 0.55);
    },
  },

  brush: {
    label: 'Brocha',
    draw: (ctx, size) => {
      const s = size;
      // Mango (rectángulo)
      ctx.fillRect(-s * 0.45, -s * 0.08, s * 0.55, s * 0.16);
      // Cerdas (trapecio ancho a la derecha)
      ctx.beginPath();
      ctx.moveTo(s * 0.1, -s * 0.2);
      ctx.lineTo(s * 0.5, -s * 0.3);
      ctx.lineTo(s * 0.5, s * 0.3);
      ctx.lineTo(s * 0.1, s * 0.2);
      ctx.closePath();
      ctx.fill();
    },
  },

  star: {
    label: 'Estrella',
    draw: (ctx, size) => {
      const s = size * 0.5;
      const spikes = 5;
      const outerRadius = s;
      const innerRadius = s * 0.45;
      ctx.beginPath();
      for (let i = 0; i < spikes * 2; i++) {
        const radius = i % 2 === 0 ? outerRadius : innerRadius;
        const angle = (Math.PI / spikes) * i - Math.PI / 2;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
    },
  },

  heart: {
    label: 'Corazón',
    draw: (ctx, size) => {
      const s = size * 0.5;
      ctx.beginPath();
      ctx.moveTo(0, s * 0.3);
      // Lóbulo izquierdo
      ctx.bezierCurveTo(-s * 1.2, -s * 0.5, -s * 0.5, -s * 1.1, 0, -s * 0.3);
      // Lóbulo derecho
      ctx.bezierCurveTo(s * 0.5, -s * 1.1, s * 1.2, -s * 0.5, 0, s * 0.3);
      // Punta inferior
      ctx.bezierCurveTo(0, s * 0.6, 0, s * 0.6, 0, s * 0.8);
      ctx.closePath();
      ctx.fill();
    },
  },

  flower: {
    label: 'Flor',
    draw: (ctx, size) => {
      const s = size * 0.5;
      const petals = 5;
      const petalRadius = s * 0.45;
      const centerOffset = s * 0.5;
      // 5 pétalos
      for (let i = 0; i < petals; i++) {
        const angle = (Math.PI * 2 / petals) * i - Math.PI / 2;
        const cx = Math.cos(angle) * centerOffset;
        const cy = Math.sin(angle) * centerOffset;
        ctx.beginPath();
        ctx.arc(cx, cy, petalRadius, 0, Math.PI * 2);
        ctx.fill();
      }
      // Centro
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.3, 0, Math.PI * 2);
      ctx.fill();
    },
  },
};

export const SHAPE_NAMES: ConfettiShape[] = [
  'square',
  'scissors',
  'razor',
  'comb',
  'polish',
  'brush',
  'star',
  'heart',
  'flower',
];

export function isValidShape(name: string | null | undefined): name is ConfettiShape {
  return !!name && SHAPE_NAMES.includes(name as ConfettiShape);
}
