/**
 * Catálogo de figuras del confeti. Cada `draw(ctx, size)` se llama con el
 * canvas ya trasladado al centro de la partícula y rotado; sólo dibuja la
 * forma con respecto al origen (0,0). El color se aplica antes vía
 * `ctx.fillStyle` y `ctx.strokeStyle`.
 *
 * Figuras "icónicas" (tijeras, estrella, corazón, flor) usan caracteres
 * Unicode monocromáticos forzados con el variation selector U+FE0E para
 * evitar que el navegador los renderee como emoji a color. Eso garantiza
 * que respeten el color elegido por el dueño.
 *
 * Las herramientas que no tienen un Unicode reconocible (navaja, peine,
 * esmalte, brocha) se dibujan con varias primitivas compuestas que las
 * hacen más identificables que un triángulo o rectángulo plano.
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

// Forzamos el codepoint como "text style" (no emoji a color) para que se
// renderice como glifo monocromático y respete `ctx.fillStyle`. U+FE0E es
// el variation selector que pide la versión texto del glifo anterior.
const TEXT_STYLE = '︎';

function drawGlyph(
  ctx: CanvasRenderingContext2D,
  glyph: string,
  size: number,
  fontWeight: 'normal' | 'bold' = 'bold',
) {
  // Sans-serif del sistema. `textBaseline=middle` centra verticalmente.
  ctx.font = `${fontWeight} ${size}px "Apple Symbols", "Segoe UI Symbol", "Noto Sans Symbols2", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(glyph + TEXT_STYLE, 0, 0);
}

export const SHAPES: Record<
  ConfettiShape,
  { label: string; draw: (ctx: CanvasRenderingContext2D, size: number) => void }
> = {
  square: {
    label: 'Clásico',
    draw: (ctx, size) => {
      ctx.fillRect(-size / 2, -size / 2, size, size * 0.85);
    },
  },

  scissors: {
    label: 'Tijeras',
    // ✂ U+2702 con forzado a text style. Es la tijera clásica de barbero
    // mucho más reconocible que cualquier primitiva geométrica.
    draw: (ctx, size) => drawGlyph(ctx, '✂', size * 1.1),
  },

  razor: {
    label: 'Navaja',
    // Navaja de barbero estilo "straight razor": mango horizontal +
    // pivote + hoja inclinada hacia arriba a la derecha. Lo que antes
    // parecía una flecha ahora tiene 3 piezas distinguibles.
    draw: (ctx, size) => {
      const s = size;
      // Mango (barra horizontal abajo a la izquierda)
      ctx.beginPath();
      const handleX = -s * 0.5;
      const handleY = s * 0.12;
      const handleW = s * 0.5;
      const handleH = s * 0.14;
      const r = handleH / 2;
      // mango redondeado
      ctx.moveTo(handleX + r, handleY);
      ctx.lineTo(handleX + handleW, handleY);
      ctx.lineTo(handleX + handleW, handleY + handleH);
      ctx.lineTo(handleX + r, handleY + handleH);
      ctx.arc(handleX + r, handleY + r, r, Math.PI / 2, -Math.PI / 2);
      ctx.closePath();
      ctx.fill();
      // Pivote (círculo pequeño donde se conectan)
      ctx.beginPath();
      ctx.arc(0, s * 0.19, s * 0.07, 0, Math.PI * 2);
      ctx.fill();
      // Hoja (paralelogramo inclinado hacia arriba derecha)
      ctx.beginPath();
      ctx.moveTo(s * 0.0, s * 0.12);
      ctx.lineTo(s * 0.5, -s * 0.45);
      ctx.lineTo(s * 0.5, -s * 0.28);
      ctx.lineTo(s * 0.06, s * 0.22);
      ctx.closePath();
      ctx.fill();
    },
  },

  comb: {
    label: 'Peine',
    // Peine clásico horizontal: lomo grueso arriba + 8 dientes finos
    // hacia abajo. Mucho más reconocible que la versión anterior.
    draw: (ctx, size) => {
      const s = size;
      // Lomo
      ctx.fillRect(-s * 0.48, -s * 0.18, s * 0.96, s * 0.18);
      // Dientes
      const teethCount = 8;
      const totalWidth = s * 0.9;
      const startX = -s * 0.45;
      const teethGap = totalWidth / teethCount;
      const teethWidth = teethGap * 0.55;
      const teethHeight = s * 0.4;
      for (let i = 0; i < teethCount; i++) {
        const x = startX + i * teethGap + (teethGap - teethWidth) / 2;
        ctx.fillRect(x, 0, teethWidth, teethHeight);
      }
    },
  },

  polish: {
    label: 'Esmalte',
    // Frasco de esmalte: tapa angosta arriba + cuello + cuerpo más ancho.
    // Tres rectángulos apilados que insinúan un frasco real.
    draw: (ctx, size) => {
      const s = size;
      // Tapa (rectángulo angosto)
      ctx.fillRect(-s * 0.16, -s * 0.5, s * 0.32, s * 0.22);
      // Cuello (más angosto)
      ctx.fillRect(-s * 0.1, -s * 0.28, s * 0.2, s * 0.08);
      // Cuerpo (más ancho con esquinas redondeadas suavemente)
      const bodyX = -s * 0.3;
      const bodyY = -s * 0.2;
      const bodyW = s * 0.6;
      const bodyH = s * 0.6;
      const br = s * 0.08;
      ctx.beginPath();
      ctx.moveTo(bodyX + br, bodyY);
      ctx.lineTo(bodyX + bodyW - br, bodyY);
      ctx.quadraticCurveTo(bodyX + bodyW, bodyY, bodyX + bodyW, bodyY + br);
      ctx.lineTo(bodyX + bodyW, bodyY + bodyH - br);
      ctx.quadraticCurveTo(bodyX + bodyW, bodyY + bodyH, bodyX + bodyW - br, bodyY + bodyH);
      ctx.lineTo(bodyX + br, bodyY + bodyH);
      ctx.quadraticCurveTo(bodyX, bodyY + bodyH, bodyX, bodyY + bodyH - br);
      ctx.lineTo(bodyX, bodyY + br);
      ctx.quadraticCurveTo(bodyX, bodyY, bodyX + br, bodyY);
      ctx.closePath();
      ctx.fill();
    },
  },

  brush: {
    label: 'Brocha',
    // Brocha de maquillaje: mango + virola + cerdas en abanico.
    draw: (ctx, size) => {
      const s = size;
      // Mango (barra estrecha)
      ctx.fillRect(-s * 0.5, -s * 0.06, s * 0.55, s * 0.12);
      // Virola (parte metálica, más gruesa)
      ctx.fillRect(s * 0.02, -s * 0.13, s * 0.09, s * 0.26);
      // Cerdas (trapecio que se abre hacia la derecha)
      ctx.beginPath();
      ctx.moveTo(s * 0.11, -s * 0.18);
      ctx.lineTo(s * 0.5, -s * 0.34);
      ctx.lineTo(s * 0.5, s * 0.34);
      ctx.lineTo(s * 0.11, s * 0.18);
      ctx.closePath();
      ctx.fill();
    },
  },

  star: {
    label: 'Estrella',
    // ★ U+2605 black star. Universalmente monocromática.
    draw: (ctx, size) => drawGlyph(ctx, '★', size * 1.05),
  },

  heart: {
    label: 'Corazón',
    // ♥ U+2665 black heart suit. Monocromática y respeta color.
    draw: (ctx, size) => drawGlyph(ctx, '♥', size * 1.1),
  },

  flower: {
    label: 'Flor',
    // ✿ U+273F floral heart. Flor estilizada monocromática.
    draw: (ctx, size) => drawGlyph(ctx, '✿', size * 1.1),
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
