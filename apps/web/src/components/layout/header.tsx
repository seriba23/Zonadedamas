// ─────────────────────────────────────────────────────────────────────────────
// Header — barra superior simple que solo muestra un título.
//
// CONCEPTOS DE REACT PARA PRINCIPIANTES:
// - Un "componente" es una función que devuelve JSX (HTML escrito dentro de
//   JavaScript). React llama a esa función y pinta lo que retorna en pantalla.
// - Las "props" son los datos que recibe el componente desde su padre, igual
//   que los argumentos de una función normal. Aquí la única prop es `title`.
// - Una "interface" de TypeScript describe la FORMA de esas props: qué campos
//   existen y de qué tipo son. Sirve para avisar de errores antes de ejecutar.
// ─────────────────────────────────────────────────────────────────────────────

// Forma de las props que recibe <Header />. Solo necesita un texto (`title`).
interface HeaderProps {
  title: string; // El texto que se mostrará como encabezado de la página.
}

// Definición del componente. `{ title }` es "desestructuración": saca el campo
// `title` del objeto de props para usarlo directamente como variable.
// `: HeaderProps` le dice a TypeScript que el objeto de props tiene esa forma.
export function Header({ title }: HeaderProps) {
  // `return` devuelve el JSX que se va a pintar. Es lo que el usuario ve.
  return (
    // <header> es la etiqueta semántica de cabecera. Las clases de className
    // son utilidades de Tailwind CSS:
    //   - h-12 / md:h-16  → altura 12 (móvil) y 16 a partir de pantalla mediana.
    //   - bg-white        → fondo blanco.
    //   - border-b ...    → borde inferior gris claro.
    //   - px-3 / md:px-6  → relleno horizontal.
    //   - flex items-center → centra verticalmente su contenido.
    <header className="h-12 md:h-16 bg-white border-b border-gray-200 px-3 md:px-6 flex items-center">
      {/* {title} inserta el valor de la prop dentro del HTML. Las llaves {} en
          JSX significan "evalúa esta expresión de JavaScript aquí". */}
      <h1 className="text-base md:text-xl font-semibold text-gray-900">{title}</h1>
    </header>
  );
}
