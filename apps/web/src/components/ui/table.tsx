import { type ReactNode } from 'react'; // tipo "contenido pintable"
import { cn } from '@/lib/utils';

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS GENÉRICOS
// La "<T>" es un GENÉRICO: un "comodín de tipo". Permite que la tabla funcione
// con CUALQUIER tipo de fila (clientes, citas, productos...). Quien usa la
// tabla decide qué es T, y TypeScript verifica la coherencia.
// ─────────────────────────────────────────────────────────────────────────────

// Column<T> describe una columna de la tabla para filas de tipo T.
export interface Column<T> {
  key: string; // clave: nombre del campo del objeto a mostrar
  header: string; // texto de la cabecera de la columna
  // render = función OPCIONAL que recibe la fila y devuelve JSX personalizado
  // (ej. pintar un badge en vez del texto crudo). Si no se da, se muestra el
  // valor del campo directamente.
  render?: (item: T) => ReactNode;
  className?: string; // clases extra para esa columna
}

// TableProps<T> = props de la tabla.
export interface TableProps<T> {
  columns: Column<T>[]; // definición de columnas
  data: T[]; // array de filas a mostrar
  onRowClick?: (item: T) => void; // callback opcional al hacer clic en una fila
  isLoading?: boolean; // si true, muestra filas "esqueleto" de carga
  emptyMessage?: string; // texto cuando no hay datos
  // keyExtractor = función opcional para obtener una key única de cada fila.
  keyExtractor?: (item: T) => string;
}

// SkeletonRow = una fila "fantasma" animada que se muestra mientras cargan los
// datos. Recibe cuántas columnas pintar.
function SkeletonRow({ columns }: { columns: number }) {
  return (
    <tr>
      {/* Array.from({length: N}) crea un array de N huecos. .map lo recorre y
          pinta una celda <td> por columna. "_" = no usamos el valor; "i" = índice
          (lo usamos como key). animate-pulse = parpadeo gris de "cargando". */}
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
        </td>
      ))}
    </tr>
  );
}

// Componente Table genérico. "T extends Record<string, unknown>" significa:
// T debe ser un objeto cuyas claves son strings y valores de cualquier tipo
// (una fila típica). Así podemos acceder a item[col.key].
export function Table<T extends Record<string, unknown>>({
  columns,
  data,
  onRowClick,
  isLoading = false,
  emptyMessage = 'No hay datos disponibles',
  keyExtractor,
}: TableProps<T>) {
  return (
    // Contenedor con borde redondeado. overflow-hidden recorta a las esquinas.
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* overflow-x-auto permite scroll horizontal en pantallas pequeñas. */}
      <div className="overflow-x-auto">
        <table className="w-full">
          {/* CABECERA de la tabla. */}
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              {/* Recorremos las columnas para pintar cada <th> (encabezado). */}
              {columns.map((col) => (
                <th
                  key={col.key} // key única por columna
                  className={cn(
                    // uppercase + tracking-wider = estilo de cabecera de tabla;
                    // whitespace-nowrap evita que el texto del título se parta.
                    'text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap',
                    col.className,
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          {/* CUERPO. divide-y dibuja líneas finas entre filas. */}
          <tbody className="divide-y divide-gray-100">
            {/* Ternario de TRES estados:
                1) si está cargando -> filas esqueleto;
                2) si no hay datos -> mensaje de vacío;
                3) si hay datos -> pintamos las filas reales. */}
            {isLoading ? (
              // 1) 5 filas esqueleto de carga.
              Array.from({ length: 5 }).map((_, i) => (
                <SkeletonRow key={i} columns={columns.length} />
              ))
            ) : data.length === 0 ? (
              // 2) Fila única con el mensaje. colSpan ocupa todas las columnas.
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-12 text-center text-sm text-gray-500"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              // 3) Recorremos los datos. "item" = la fila, "idx" = su posición.
              data.map((item, idx) => {
                // key única de la fila: si hay keyExtractor lo usamos; si no,
                // usamos item.id, y si tampoco existe (??), el índice como respaldo.
                // "??" (nullish) toma item.id salvo que sea null/undefined.
                const key = keyExtractor
                  ? keyExtractor(item)
                  : String(item.id ?? idx);
                return (
                  <tr
                    key={key}
                    // Si hay onRowClick, conectamos el clic; si no, undefined
                    // (la fila no es clicable).
                    onClick={onRowClick ? () => onRowClick(item) : undefined}
                    className={cn(
                      'transition-colors',
                      // Solo aplicamos hover/cursor de "mano" si la fila es clicable.
                      onRowClick
                        ? 'hover:bg-gray-50 cursor-pointer'
                        : '',
                    )}
                  >
                    {/* Por cada fila, recorremos las columnas para pintar celdas. */}
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={cn(
                          'px-4 py-3 text-sm text-gray-700',
                          col.className,
                        )}
                      >
                        {/* Si la columna define render, lo usamos (celda
                            personalizada); si no, mostramos el valor del campo,
                            o un "-" si está vacío (?? = respaldo si null/undefined). */}
                        {col.render
                          ? col.render(item)
                          : String(item[col.key] ?? '-')}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
