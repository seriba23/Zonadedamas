// ─────────────────────────────────────────────────────────────────────────────
// save-toast.ts — API imperativo para el modal ESTÁNDAR de "guardado".
//
// En vez de cablear un <SuccessPopup> con estado local en cada formulario, toda
// la app llama a `showSaveSuccess()` y aparece UN modal centrado (montado una
// sola vez en el layout raíz por <SaveSuccessProvider>). Así estandarizamos:
// mismo modal, misma posición, mismo estilo para CUALQUIER acción de guardado.
//
// Uso típico en un onSuccess / handler:
//   import { showSaveSuccess } from '@/lib/save-toast';
//   showSaveSuccess();                              // "Cambios guardados"
//   showSaveSuccess({ title: 'Foto actualizada' }); // título personalizado
// ─────────────────────────────────────────────────────────────────────────────

export interface SaveSuccessOptions {
  title?: string;   // título principal (default: "Cambios guardados")
  message?: string; // mensaje secundario opcional
}

// Pub/sub mínimo a nivel de módulo (funciona también fuera de React).
type Listener = (opts: SaveSuccessOptions) => void;
const listeners = new Set<Listener>();

/** Dispara el modal estándar de guardado. */
export function showSaveSuccess(opts: SaveSuccessOptions = {}): void {
  listeners.forEach((fn) => fn(opts));
}

/** Suscribe un listener (lo usa el provider). Devuelve la función para desuscribir. */
export function subscribeSaveSuccess(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
