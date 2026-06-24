// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// De React importamos:
//   - forwardRef: función que permite que un componente "reenvíe" una
//     referencia (ref) hacia un elemento interno (aquí el <button> real del
//     DOM). Sin esto, el componente padre no podría obtener el botón real,
//     por ejemplo para enfocarlo (.focus()) con código.
//   - type ButtonHTMLAttributes: es un TIPO de TypeScript (no código que se
//     ejecuta; sirve solo para chequeo de tipos). Describe TODAS las props
//     nativas de un <button> de HTML (onClick, type, disabled, name, etc.).
//     Lo usaremos para que nuestro botón herede esas props automáticamente.
import { forwardRef, type ButtonHTMLAttributes } from 'react';

// cn = utilidad para "concatenar" clases CSS de forma condicional y limpiar
// duplicados. Convierte varias cadenas/condiciones en una sola string de
// clases para el atributo className.
import { cn } from '@/lib/utils';

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS (PROPS) — Las "props" son los datos/configuración que el componente
// recibe desde fuera, como los argumentos de una función.
// ─────────────────────────────────────────────────────────────────────────────

// Esta interface describe qué props acepta el botón.
// "extends ButtonHTMLAttributes<HTMLButtonElement>" significa: además de
// nuestras props propias, acepta TODAS las props nativas de un <button>.
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  // variant = estilo visual del botón. El "?" indica que es OPCIONAL.
  // El tipo es una "unión literal": solo se permiten estos 5 valores exactos.
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  // size = tamaño del botón (pequeño/medio/grande). También opcional.
  size?: 'sm' | 'md' | 'lg';
  // isLoading = si true, muestra un spinner girando y desactiva el botón.
  isLoading?: boolean;
}

// variantClasses = un "diccionario" (objeto) que mapea cada variante a sus
// clases de Tailwind. Record<Clave, Valor> es un tipo de TS para objetos cuyas
// claves son de un tipo y valores de otro. NonNullable<...> quita el "undefined"
// del tipo de variant (porque era opcional) y deja solo los 5 valores válidos.
const variantClasses: Record<NonNullable<ButtonProps['variant']>, string> = {
  // bg-primary-600 = fondo teal; text-white = texto blanco;
  // hover:bg-primary-700 = oscurece al pasar el ratón; focus:ring = aro al enfocar.
  primary:
    'bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500',
  // secundario: fondo blanco, texto gris, borde gris.
  secondary:
    'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus:ring-gray-300',
  // outline: fondo transparente con borde y texto teal.
  outline:
    'bg-transparent text-primary-600 border border-primary-600 hover:bg-primary-50 focus:ring-primary-500',
  // ghost: sin fondo ni borde, solo se tiñe al hover (botón "fantasma").
  ghost: 'bg-transparent text-gray-700 hover:bg-gray-100 focus:ring-gray-300',
  // danger: rojo, para acciones destructivas (borrar, cancelar).
  danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
};

// sizeClasses = diccionario igual que el anterior pero para los tamaños.
// px = padding horizontal, py = padding vertical, rounded = esquinas redondeadas.
const sizeClasses: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'text-xs px-3 py-1.5 rounded-md',
  md: 'text-sm px-4 py-2 rounded-lg',
  lg: 'text-base px-5 py-2.5 rounded-lg',
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE Button
// Es un componente de función envuelto en forwardRef. Recibe DOS argumentos:
//   1) props (desestructuradas entre llaves)
//   2) ref (la referencia que se reenvía al <button>)
// ─────────────────────────────────────────────────────────────────────────────
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      // Aquí "desestructuramos" las props: sacamos cada una a su variable.
      // El "= valor" da un valor por defecto si la prop no se pasó.
      variant = 'primary', // estilo por defecto
      size = 'md', // tamaño por defecto
      isLoading = false, // no cargando por defecto
      disabled, // prop nativa: si el botón está deshabilitado
      className, // clases extra que pase quien use el botón
      children, // el contenido entre <Button>...</Button> (texto/iconos)
      // ...props = "resto" de props (todas las que no nombramos arriba), p.ej.
      // onClick, type, name. Las pasaremos tal cual al <button>.
      ...props
    },
    ref, // la referencia reenviada
  ) => {
    // JSX = sintaxis parecida a HTML dentro de JavaScript que describe la UI.
    // El "return" devuelve lo que se va a pintar en pantalla.
    return (
      <button
        ref={ref} // conectamos la ref reenviada con el botón real
        // disabled si está deshabilitado O si está cargando (|| = "o lógico").
        disabled={disabled || isLoading}
        className={cn(
          // Clases base que SIEMPRE se aplican: flex en línea, centra contenido,
          // gap entre icono y texto, fuente media, transición de color suave,
          // y estilos del aro de foco (accesibilidad por teclado).
          'inline-flex items-center justify-center gap-2 font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2',
          // Cuando está deshabilitado: medio transparente y cursor "prohibido".
          'disabled:opacity-50 disabled:cursor-not-allowed',
          // Elegimos las clases según la variante y el tamaño pedidos.
          variantClasses[variant],
          sizeClasses[size],
          // className extra del usuario va al final para poder sobrescribir.
          className,
        )}
        {...props} // esparcimos el resto de props nativas sobre el <button>
      >
        {/* Renderizado condicional: "isLoading && (...)" pinta el spinner SOLO
            si isLoading es true. Si es false, no se dibuja nada. */}
        {isLoading && (
          // <svg> = dibujo vectorial. animate-spin = lo hace girar (efecto de
          // "cargando"). currentColor hereda el color del texto del botón.
          <svg
            className="animate-spin h-4 w-4 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
          >
            {/* El círculo tenue de fondo del spinner. */}
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            {/* El arco más visible que crea la sensación de giro. */}
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        )}
        {/* children = el contenido que el usuario puso dentro del botón. */}
        {children}
      </button>
    );
  },
);

// displayName = nombre que aparece en las herramientas de desarrollo de React.
// Es útil porque los componentes con forwardRef si no, salen como "Anónimo".
Button.displayName = 'Button';
