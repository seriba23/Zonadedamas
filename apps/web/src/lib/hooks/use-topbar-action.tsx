'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

interface TopbarActionContextValue {
  action: ReactNode | null;
  setAction: (node: ReactNode | null) => void;
}

const TopbarActionContext = createContext<TopbarActionContextValue | undefined>(undefined);

export function TopbarActionProvider({ children }: { children: ReactNode }) {
  const [action, setAction] = useState<ReactNode | null>(null);
  return (
    <TopbarActionContext.Provider value={{ action, setAction }}>
      {children}
    </TopbarActionContext.Provider>
  );
}

/**
 * Lee la accion que se va a renderizar en el lado derecho del topbar del
 * dashboard. Solo usar dentro del layout.
 */
export function useTopbarAction(): ReactNode | null {
  const ctx = useContext(TopbarActionContext);
  return ctx?.action ?? null;
}

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

  // Estabilizamos la funcion de set para que el useEffect no dependa de ella.
  const stableSet = useCallback((n: ReactNode | null) => {
    if (setAction) setAction(n);
  }, [setAction]);

  useEffect(() => {
    stableSet(node);
    return () => stableSet(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
