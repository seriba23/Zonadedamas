'use client';

// SaveSuccessProvider — se monta UNA sola vez (en el layout raíz) y escucha las
// llamadas a showSaveSuccess() para mostrar el modal estándar de guardado.
// Centralizar el render aquí garantiza que todos los "guardado" de la app se
// vean idénticos (modal centrado teal con check), sin estado local repetido.

import { useEffect, useState } from 'react';
import { SuccessPopup } from './success-popup';
import { subscribeSaveSuccess } from '@/lib/save-toast';

export function SaveSuccessProvider() {
  const [state, setState] = useState<{ show: boolean; title: string; message?: string }>({
    show: false,
    title: '',
  });

  useEffect(() => {
    // Al montar, nos suscribimos; al desmontar, limpiamos.
    return subscribeSaveSuccess((opts) => {
      setState({
        show: true,
        title: opts.title || 'Cambios guardados',
        message: opts.message,
      });
    });
  }, []);

  return (
    <SuccessPopup
      show={state.show}
      title={state.title}
      message={state.message}
      autoClose={1800}
      onClose={() => setState((s) => ({ ...s, show: false }))}
    />
  );
}
