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

// ─────────────────────────────────────────────────────────────────────────────
// TIPO: ConfettiShape
// ─────────────────────────────────────────────────────────────────────────────
// En TypeScript, "type" define un alias: aquí listamos todos los nombres de
// figura válidos mediante el operador "|" (OR de tipos).
// Leer como: "ConfettiShape puede ser 'square' O 'scissors' O 'razor' O ..."
// Usar este tipo en otras partes del código evita escribir cadenas arbitrarias
// y deja que TypeScript avise si escribimos mal un nombre.
export type ConfettiShape =
  | 'square'      // cuadrado clásico
  | 'scissors'    // tijeras
  | 'razor'       // navaja de barbero
  | 'comb'        // peine
  | 'polish'      // esmalte de uñas
  | 'brush'       // brocha de maquillaje
  | 'star'        // estrella
  | 'heart'       // corazón
  | 'flower';     // flor

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTE: DEFAULT_CONFETTI_COLORS
// ─────────────────────────────────────────────────────────────────────────────
// Array (lista) de colores en formato hexadecimal que se usan cuando el dueño
// del negocio no ha elegido una paleta personalizada.
// Los cuatro colores son variaciones de la marca: turquesa oscuro (#008080),
// turquesa brillante (#00b3b3), verde muy pálido (#e0f2f1) y blanco (#ffffff).
export const DEFAULT_CONFETTI_COLORS = ['#00b3b3', '#008080', '#e0f2f1', '#ffffff'];

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTE INTERNA: TEXT_STYLE
// ─────────────────────────────────────────────────────────────────────────────
// El carácter Unicode U+FE0E (variation selector 15) le dice al navegador:
// "muestra el símbolo anterior como TEXTO, no como emoji de color".
// Sin este truco, ✂ en un iPhone se pintaría de color naranja/azul en lugar
// de respetar el color que nosotros definimos en ctx.fillStyle.
// Se concatena detrás de cada glifo antes de dibujarlo.
// Forzamos el codepoint como "text style" (no emoji a color) para que se
// renderice como glifo monocromático y respete `ctx.fillStyle`. U+FE0E es
// el variation selector que pide la versión texto del glifo anterior.
const TEXT_STYLE = '︎';

// ─────────────────────────────────────────────────────────────────────────────
// FUNCIÓN INTERNA: drawGlyph
// ─────────────────────────────────────────────────────────────────────────────
// Dibuja un carácter de texto (glifo) en el canvas con el tamaño indicado.
//
// Parámetros:
//   ctx        → el contexto 2D del canvas (es el "pincel" del navegador)
//   glyph      → el carácter a dibujar, p.ej. '✂' o '★'
//   size       → tamaño en píxeles de la figura
//   fontWeight → grosor de la fuente; 'bold' (negrita) por defecto
//                TypeScript fuerza que solo sea 'normal' | 'bold'
//
// No devuelve nada (void). Solo pinta en el canvas.
function drawGlyph(
  ctx: CanvasRenderingContext2D,
  glyph: string,
  size: number,
  fontWeight: 'normal' | 'bold' = 'bold', // valor por defecto: 'bold'
) {
  // Configuramos la fuente. Se prueban fuentes de símbolos en orden de
  // preferencia. `${fontWeight} ${size}px` es interpolación de cadena en JS.
  // Sans-serif del sistema. `textBaseline=middle` centra verticalmente.
  ctx.font = `${fontWeight} ${size}px "Apple Symbols", "Segoe UI Symbol", "Noto Sans Symbols2", sans-serif`;
  // 'center' hace que el texto se pinte centrado horizontalmente en x=0.
  ctx.textAlign = 'center';
  // 'middle' hace que el texto se pinte centrado verticalmente en y=0.
  ctx.textBaseline = 'middle';
  // fillText pinta el texto. Sumamos TEXT_STYLE para forzar modo monocromático.
  // La posición (0, 0) es el origen, que ya fue trasladado al centro
  // de la partícula de confeti por el motor de animación antes de llamar aquí.
  ctx.fillText(glyph + TEXT_STYLE, 0, 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTE: SHAPES
// ─────────────────────────────────────────────────────────────────────────────
// Diccionario (objeto) que asocia cada nombre de figura (ConfettiShape) con
// dos cosas:
//   label → texto legible en español para mostrar en la interfaz
//   draw  → función que recibe el canvas y el tamaño, y dibuja la figura
//
// "Record<ConfettiShape, ...>" es la forma de TypeScript de decir:
// "este objeto debe tener exactamente una entrada por cada valor de ConfettiShape".
// Si añadiéramos una figura nueva al tipo y no la ponemos aquí, TypeScript avisa.
export const SHAPES: Record<
  ConfettiShape,
  { label: string; draw: (ctx: CanvasRenderingContext2D, size: number) => void }
> = {
  // ── CUADRADO ──────────────────────────────────────────────────────────────
  square: {
    label: 'Clásico',
    // fillRect(x, y, ancho, alto): dibuja un rectángulo relleno.
    // Empezamos en (-size/2, -size/2) para que el centro quede en (0,0).
    // La altura es 0.85 del tamaño para que parezca un confeti ligeramente
    // aplastado, no un cuadrado perfecto.
    draw: (ctx, size) => {
      ctx.fillRect(-size / 2, -size / 2, size, size * 0.85);
    },
  },

  // ── TIJERAS ───────────────────────────────────────────────────────────────
  scissors: {
    label: 'Tijeras',
    // ✂ U+2702 con forzado a text style. Es la tijera clásica de barbero
    // mucho más reconocible que cualquier primitiva geométrica.
    // size * 1.1 → se amplía un 10% para que el glifo llene bien el espacio.
    draw: (ctx, size) => drawGlyph(ctx, '✂', size * 1.1),
  },

  // ── NAVAJA ────────────────────────────────────────────────────────────────
  razor: {
    label: 'Navaja',
    // Navaja de barbero estilo "straight razor": mango horizontal +
    // pivote + hoja inclinada hacia arriba a la derecha. Lo que antes
    // parecía una flecha ahora tiene 3 piezas distinguibles.
    draw: (ctx, size) => {
      // Guardamos `size` en `s` para acortar las expresiones matemáticas.
      const s = size;

      // ── MANGO (barra horizontal abajo a la izquierda) ────────────────────
      // beginPath() inicia un nuevo trazo vectorial (como levantar el lápiz).
      ctx.beginPath();
      const handleX = -s * 0.5;   // coordenada X del extremo izquierdo del mango
      const handleY = s * 0.12;   // coordenada Y (un poco abajo del centro)
      const handleW = s * 0.5;    // ancho del mango
      const handleH = s * 0.14;   // alto del mango
      const r = handleH / 2;      // radio del extremo redondeado (semicírculo)
      // Construimos el contorno del mango: líneas rectas + arco semicircular.
      // moveTo mueve el lápiz sin dibujar. lineTo traza una línea hasta el punto.
      // mango redondeado
      ctx.moveTo(handleX + r, handleY);
      ctx.lineTo(handleX + handleW, handleY);
      ctx.lineTo(handleX + handleW, handleY + handleH);
      ctx.lineTo(handleX + r, handleY + handleH);
      // arc(cx, cy, radio, ánguloInicio, ánguloFin): dibuja un arco.
      // Math.PI/2 = 90°, -Math.PI/2 = -90° → semicírculo a la izquierda.
      ctx.arc(handleX + r, handleY + r, r, Math.PI / 2, -Math.PI / 2);
      ctx.closePath(); // cierra el trazo uniendo el último punto con el primero
      ctx.fill();      // rellena el interior con el color actual (ctx.fillStyle)

      // ── PIVOTE (círculo pequeño donde mango y hoja se conectan) ──────────
      ctx.beginPath();
      // arc con ángulo 0 a Math.PI*2 traza un círculo completo.
      ctx.arc(0, s * 0.19, s * 0.07, 0, Math.PI * 2);
      ctx.fill();

      // ── HOJA (paralelogramo inclinado hacia arriba a la derecha) ─────────
      ctx.beginPath();
      // Los cuatro vértices del paralelogramo, en sentido horario.
      ctx.moveTo(s * 0.0, s * 0.12);
      ctx.lineTo(s * 0.5, -s * 0.45);
      ctx.lineTo(s * 0.5, -s * 0.28);
      ctx.lineTo(s * 0.06, s * 0.22);
      ctx.closePath();
      ctx.fill();
    },
  },

  // ── PEINE ─────────────────────────────────────────────────────────────────
  comb: {
    label: 'Peine',
    // Peine clásico horizontal: lomo grueso arriba + 8 dientes finos
    // hacia abajo. Mucho más reconocible que la versión anterior.
    draw: (ctx, size) => {
      const s = size;

      // Lomo: rectángulo ancho y poco alto en la parte superior.
      ctx.fillRect(-s * 0.48, -s * 0.18, s * 0.96, s * 0.18);

      // Dientes: 8 rectángulos estrechos y altos, equidistantes.
      const teethCount = 8;        // número de dientes
      const totalWidth = s * 0.9;  // ancho total que ocupan todos los dientes
      const startX = -s * 0.45;   // X del primer diente (extremo izquierdo)
      const teethGap = totalWidth / teethCount;       // espacio por cada diente
      const teethWidth = teethGap * 0.55;             // ancho de cada diente (55% del gap)
      const teethHeight = s * 0.4;                    // alto de cada diente

      // Bucle: i va de 0 a 7 (teethCount - 1).
      // Cada iteración calcula la posición X del diente i-ésimo y lo dibuja.
      for (let i = 0; i < teethCount; i++) {
        // Centramos el diente dentro de su "hueco" (gap) dividiendo el espacio
        // sobrante (teethGap - teethWidth) entre 2.
        const x = startX + i * teethGap + (teethGap - teethWidth) / 2;
        // Los dientes empiezan en Y=0 (justo debajo del lomo) y van hacia abajo.
        ctx.fillRect(x, 0, teethWidth, teethHeight);
      }
    },
  },

  // ── ESMALTE ───────────────────────────────────────────────────────────────
  polish: {
    label: 'Esmalte',
    // Frasco de esmalte: tapa angosta arriba + cuello + cuerpo más ancho.
    // Tres rectángulos apilados que insinúan un frasco real.
    draw: (ctx, size) => {
      const s = size;

      // Tapa (rectángulo angosto centrado, en la parte superior).
      ctx.fillRect(-s * 0.16, -s * 0.5, s * 0.32, s * 0.22);

      // Cuello (más angosto, conecta tapa con el cuerpo).
      ctx.fillRect(-s * 0.1, -s * 0.28, s * 0.2, s * 0.08);

      // Cuerpo (más ancho con esquinas redondeadas suavemente).
      // Dibujamos el cuerpo a mano con quadraticCurveTo para las esquinas.
      const bodyX = -s * 0.3;    // X esquina superior-izquierda del cuerpo
      const bodyY = -s * 0.2;    // Y esquina superior-izquierda
      const bodyW = s * 0.6;     // ancho del cuerpo
      const bodyH = s * 0.6;     // alto del cuerpo
      const br = s * 0.08;       // radio de la esquina redondeada (border-radius)
      ctx.beginPath();
      // Recorremos el contorno en sentido horario, esquina a esquina.
      // En cada esquina usamos quadraticCurveTo(puntoControl, puntoDestino)
      // que dibuja una curva de Bézier cuadrática (curva suave).
      ctx.moveTo(bodyX + br, bodyY);                                              // top-left → start
      ctx.lineTo(bodyX + bodyW - br, bodyY);                                      // borde superior
      ctx.quadraticCurveTo(bodyX + bodyW, bodyY, bodyX + bodyW, bodyY + br);      // esquina top-right
      ctx.lineTo(bodyX + bodyW, bodyY + bodyH - br);                              // borde derecho
      ctx.quadraticCurveTo(bodyX + bodyW, bodyY + bodyH, bodyX + bodyW - br, bodyY + bodyH); // esquina bot-right
      ctx.lineTo(bodyX + br, bodyY + bodyH);                                      // borde inferior
      ctx.quadraticCurveTo(bodyX, bodyY + bodyH, bodyX, bodyY + bodyH - br);      // esquina bot-left
      ctx.lineTo(bodyX, bodyY + br);                                              // borde izquierdo
      ctx.quadraticCurveTo(bodyX, bodyY, bodyX + br, bodyY);                      // esquina top-left
      ctx.closePath();
      ctx.fill();
    },
  },

  // ── BROCHA ────────────────────────────────────────────────────────────────
  brush: {
    label: 'Brocha',
    // Brocha de maquillaje: mango + virola + cerdas en abanico.
    draw: (ctx, size) => {
      const s = size;

      // Mango (barra estrecha horizontal a la izquierda).
      ctx.fillRect(-s * 0.5, -s * 0.06, s * 0.55, s * 0.12);

      // Virola (anillo metálico donde el mango se une a las cerdas, más gruesa).
      ctx.fillRect(s * 0.02, -s * 0.13, s * 0.09, s * 0.26);

      // Cerdas: trapecio que se ensancha hacia la derecha (forma de abanico).
      // Los 4 puntos definen un trapecio: estrecho a la izquierda, ancho a la derecha.
      ctx.beginPath();
      ctx.moveTo(s * 0.11, -s * 0.18);   // vértice superior-izquierdo
      ctx.lineTo(s * 0.5, -s * 0.34);    // vértice superior-derecho (más alto)
      ctx.lineTo(s * 0.5, s * 0.34);     // vértice inferior-derecho (más bajo)
      ctx.lineTo(s * 0.11, s * 0.18);    // vértice inferior-izquierdo
      ctx.closePath();
      ctx.fill();
    },
  },

  // ── ESTRELLA ──────────────────────────────────────────────────────────────
  star: {
    label: 'Estrella',
    // ★ U+2605 black star. Universalmente monocromática.
    // size * 1.05 → se amplía un 5% para llenar mejor el espacio.
    draw: (ctx, size) => drawGlyph(ctx, '★', size * 1.05),
  },

  // ── CORAZÓN ───────────────────────────────────────────────────────────────
  heart: {
    label: 'Corazón',
    // ♥ U+2665 black heart suit. Monocromática y respeta color.
    draw: (ctx, size) => drawGlyph(ctx, '♥', size * 1.1),
  },

  // ── FLOR ──────────────────────────────────────────────────────────────────
  flower: {
    label: 'Flor',
    // ✿ U+273F floral heart. Flor estilizada monocromática.
    draw: (ctx, size) => drawGlyph(ctx, '✿', size * 1.1),
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTE: SHAPE_NAMES
// ─────────────────────────────────────────────────────────────────────────────
// Lista (array) con todos los nombres de figura en el orden en que queremos
// mostrarlos en la interfaz. Es el mismo conjunto que ConfettiShape pero como
// array real de cadenas de texto en lugar de un tipo TypeScript, lo que permite
// recorrerlo con .map(), .includes(), etc. en tiempo de ejecución.
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

// ─────────────────────────────────────────────────────────────────────────────
// FUNCIÓN: isValidShape
// ─────────────────────────────────────────────────────────────────────────────
// Comprueba si una cadena de texto es un nombre de figura válido.
//
// Parámetros:
//   name → puede ser string, null o undefined (por eso los tres tipos con |)
//
// Devuelve: boolean (true si es válida, false si no)
// También actúa como "type guard": si devuelve true, TypeScript sabe que
// `name` es de tipo ConfettiShape (lo indica "name is ConfettiShape").
//
// Cómo funciona la expresión:
//   !!name                          → convierte a boolean; descarta null/""/undefined
//   SHAPE_NAMES.includes(name as ConfettiShape)
//                                   → .includes() comprueba si name está en la lista
//   "as ConfettiShape"              → le decimos a TypeScript que confíe en nosotros
//                                     por el momento; el !! ya descartó los falsy
//   &&                              → ambas condiciones deben ser true
export function isValidShape(name: string | null | undefined): name is ConfettiShape {
  return !!name && SHAPE_NAMES.includes(name as ConfettiShape);
}
