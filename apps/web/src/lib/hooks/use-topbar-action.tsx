// ============================================================
// ARCHIVO: use-topbar-action.tsx
// PROPÓSITO: Permite que una PÁGINA específica del dashboard inyecte
//            un botón o acción personalizada en la barra superior (topbar)
//            del layout, sin necesidad de modificar el layout directamente.
//
// PROBLEMA QUE RESUELVE:
//   El layout del dashboard tiene una barra superior (topbar) fija que
//   se renderiza en todas las páginas. Algunas páginas necesitan poner
//   botones en esa barra (ej: "Nueva cita", "Exportar", "Guardar cambios").
//   Pero la página y el layout son componentes separados y la página
//   está DENTRO del layout (hijo), no al mismo nivel.
//
//   Solución clásica: Context + un "portal" de UI inverso.
//   La página "le dice" al layout qué botón mostrar en la topbar,
//   usando el contexto como canal de comunicación.
//
// PATRÓN DETALLADO:
//   1. TopbarActionProvider: envuelve el layout, guarda el nodo (botón) en estado.
//   2. useTopbarAction(): el LAYOUT lo llama para LEER el botón y renderizarlo.
//   3. useRegisterTopbarAction(): la PÁGINA lo llama para ESCRIBIR el botón.
//      Al desmontar la página, limpia automáticamente el botón.
//
// METÁFORA: Es como un "tablón de anuncios". El layout siempre mira el tablón
//           (useTopbarAction). Cada página pone su anuncio (useRegisterTopbarAction)
//           cuando entra y lo quita cuando se va.
// ============================================================

'use client';
// Solo corre en el navegador

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
// createContext: crea el contenedor de datos compartidos
// useCallback: memoriza funciones para evitar recreaciones innecesarias
// useContext: lee datos del contexto
// useEffect: efecto para registrar/limpiar el botón al montar/desmontar
// useState: guarda el botón actual en estado reactivo
// ReactNode: tipo TypeScript para cualquier contenido renderable por React

// ============================================================
// INTERFAZ: TopbarActionContextValue
// Define qué hay dentro del contexto:
//   - action: el botón/nodo actual (o null si no hay ninguno)
//   - setAction: función para cambiar el botón
// ============================================================
interface TopbarActionContextValue {
  action: ReactNode | null;           // El botón/componente a mostrar (o null)
  setAction: (node: ReactNode | null) => void; // Función para establecer el botón
}

// ============================================================
// Creamos el contexto, inicialmente undefined (sin Provider activo)
// ============================================================
const TopbarActionContext = createContext<TopbarActionContextValue | undefined>(undefined);

// ============================================================
// COMPONENTE: TopbarActionProvider
// El layout lo envuelve todo para que haya un lugar donde guardar
// el botón actual de la topbar.
//
// Recibe: { children } — el layout y todas las páginas que contiene
// ============================================================
export function TopbarActionProvider({ children }: { children: ReactNode }) {
  // action: el nodo React actual a mostrar en la topbar (null = no mostrar nada)
  const [action, setAction] = useState<ReactNode | null>(null);

  // Pasamos action y setAction al contexto para que sean accesibles
  // desde cualquier componente hijo (el layout lo lee, las páginas lo escriben)
  return (
    <TopbarActionContext.Provider value={{ action, setAction }}>
      {children}
    </TopbarActionContext.Provider>
  );
}

// ============================================================
// HOOK: useTopbarAction
// El LAYOUT del dashboard lo usa para leer qué botón debe mostrar
// en la topbar en este momento.
//
// No recibe parámetros.
// Devuelve: ReactNode | null (el botón a renderizar, o null si no hay)
//
// Uso en el layout:
//   const action = useTopbarAction();
//   // En el JSX del topbar:
//   <div className="topbar-right">{action}</div>
// ============================================================

/**
 * Lee la accion que se va a renderizar en el lado derecho del topbar del
 * dashboard. Solo usar dentro del layout.
 */
export function useTopbarAction(): ReactNode | null {
  const ctx = useContext(TopbarActionContext);
  // ctx?.action: si ctx es undefined (sin Provider), devuelve undefined
  // ?? null: si undefined, devuelve null (no renderizar nada)
  return ctx?.action ?? null;
}

// ============================================================
// HOOK: useRegisterTopbarAction
// Las PÁGINAS del dashboard lo usan para registrar un botón en la topbar.
//
// Recibe:
//   node: ReactNode — el botón/componente a mostrar en la topbar
//   deps: any[] — array de dependencias (como en useEffect)
//                 si cambian, re-registra el botón. Por defecto []
//
// No devuelve nada (void): solo tiene un efecto secundario.
//
// EJEMPLO DE USO en una página:
//   useRegisterTopbarAction(
//     <button onClick={handleNew}>Nueva cita</button>,
//     []  // sin dependencias = solo se registra una vez al montar
//   );
// ============================================================

/**
 * Registra un boton/accion en el lado derecho del topbar mientras la pagina
 * que llama este hook este montada. Al desmontar la limpia automaticamente.
 *
 * @param node El nodo React a renderizar; pasar null para no mostrar nada.
 * @param deps Dependencias para re-registrar el nodo cuando cambien.
 */
export function useRegisterTopbarAction(node: ReactNode, deps: any[] = []): void {
  const ctx = useContext(TopbarActionContext);
  const setAction = ctx?.setAction;
  // setAction: la función para actualizar el botón de la topbar.
  // Si ctx es undefined (sin Provider), setAction también es undefined.

  // ============================================================
  // useCallback: memoriza la función de "set" para que sea estable.
  // Sin esto, cada render crearía una nueva función setAction diferente,
  // lo que causaría que el useEffect de abajo se re-ejecutara en cada render
  // (bucle infinito o renders innecesarios).
  //
  // [setAction]: si cambia setAction (raro, pero posible), recrea la función.
  // ============================================================

  // Estabilizamos la funcion de set para que el useEffect no dependa de ella.
  const stableSet = useCallback((n: ReactNode | null) => {
    if (setAction) setAction(n); // Solo llama si setAction existe (hay Provider)
  }, [setAction]);

  // ============================================================
  // useEffect: registra el botón cuando el componente se monta,
  // y lo limpia cuando se desmonta.
  //
  // stableSet(node): establece el botón en la topbar al montar la página
  // return () => stableSet(null): al desmontar, limpia el botón (pone null)
  //
  // deps: las dependencias pasadas por el usuario. Si cambian, vuelve a
  // registrar el botón (útil si el botón depende de estado de la página).
  //
  // eslint-disable-next-line react-hooks/exhaustive-deps:
  // Desactiva la regla de ESLint que pediría incluir todas las dependencias.
  // Aquí es intencional: queremos que el efecto use exactamente las deps
  // que el USUARIO del hook decide, no las que ESLint calcula automáticamente.
  // ============================================================
  useEffect(() => {
    stableSet(node); // Al montar: registra el botón en la topbar
    return () => stableSet(null); // Al desmontar: limpia el botón de la topbar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps); // Las dependencias son las que pasa el usuario del hook
}
