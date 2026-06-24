// 'use client' porque maneja eventos de clic en el navegador.
'use client';

// PROPS del paginador.
interface PaginationProps {
  total: number; // total de elementos (en todas las páginas)
  page: number; // página actual (empieza en 1)
  perPage: number; // elementos por página
  onPageChange: (page: number) => void; // se llama al cambiar de página
}

// Componente Pagination: barra "Anterior / 1 2 3 ... / Siguiente".
export function Pagination({
  total,
  page,
  perPage,
  onPageChange,
}: PaginationProps) {
  // totalPages = número de páginas. Math.ceil redondea hacia ARRIBA (si sobran
  // elementos, hace falta una página más). Ej: 21 elementos / 10 = 2.1 -> 3.
  const totalPages = Math.ceil(total / perPage);
  // start = número del primer elemento mostrado en esta página (base 1).
  const start = (page - 1) * perPage + 1;
  // end = número del último elemento. Math.min evita pasarse del total en la
  // última página (ej. página 3 de 21 elementos -> end = 21, no 30).
  const end = Math.min(page * perPage, total);

  // Si solo hay una página (o ninguna), no mostramos el paginador.
  if (totalPages <= 1) return null;

  // getPageNumbers = arma la lista de botones a mostrar, insertando '...' para
  // resumir cuando hay muchas páginas (ej. 1 ... 4 5 6 ... 20).
  function getPageNumbers() {
    // pages = array que puede contener números o el string '...'.
    const pages: (number | '...')[] = [];
    const delta = 2; // cuántas páginas mostrar a cada lado de la actual

    // Recorremos todas las páginas de la 1 a la última.
    for (let i = 1; i <= totalPages; i++) {
      if (
        i === 1 || // siempre mostramos la primera
        i === totalPages || // y la última
        (i >= page - delta && i <= page + delta) // y las cercanas a la actual
      ) {
        pages.push(i); // página visible
      } else if (
        // Para el resto, ponemos '...' pero solo si el anterior no era ya '...'
        // (así no se repiten puntos suspensivos seguidos).
        pages[pages.length - 1] !== '...'
      ) {
        pages.push('...');
      }
    }
    return pages;
  }

  // pageNumbers = resultado calculado de la función anterior.
  const pageNumbers = getPageNumbers();

  return (
    // Contenedor: texto a la izquierda, botones a la derecha (justify-between).
    <div className="flex items-center justify-between py-3">
      {/* Texto "Mostrando X–Y de Z". {' '} inserta un espacio explícito. */}
      <p className="text-sm text-gray-500">
        Mostrando{' '}
        <span className="font-medium">{start}</span>–
        <span className="font-medium">{end}</span> de{' '}
        <span className="font-medium">{total}</span>
      </p>

      <div className="flex items-center gap-1">
        {/* Botón "Anterior": va a page-1. Deshabilitado en la primera página. */}
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Anterior
        </button>

        {/* Recorremos pageNumbers. "p" = cada número o '...', "idx" = índice.
            Ternario: si es '...' pintamos un texto inerte; si es número, un botón. */}
        {pageNumbers.map((p, idx) =>
          p === '...' ? (
            // Puntos suspensivos. Key con el índice porque '...' puede repetirse.
            <span key={`ellipsis-${idx}`} className="px-2 text-gray-400 text-sm">
              ...
            </span>
          ) : (
            // Botón de página numérica.
            <button
              key={p}
              onClick={() => onPageChange(p as number)} // "as number" tranquiliza a TS
              className={`min-w-[36px] h-9 text-sm rounded-lg border transition-colors ${
                // Si es la página actual, se resalta en teal; si no, estilo neutro.
                page === p
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {p}
            </button>
          ),
        )}

        {/* Botón "Siguiente": va a page+1. Deshabilitado en la última página. */}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}
