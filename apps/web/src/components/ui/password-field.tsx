// Directiva de Next.js: este componente usa estado (useState) y eventos del
// navegador, por lo que solo puede ejecutarse en el cliente (navegador).
'use client';

// useState: hook que crea una variable de estado. Cuando la variable cambia,
// React vuelve a renderizar el componente automáticamente.
import { useState } from 'react';

// Color teal del proyecto (#008080) guardado en una constante para reutilizarlo
// sin repetir el string en múltiples sitios.
const TEAL = '#008080';

// ─── Expresión regular de validación de contraseña ──────────────────────────
// Una "expresión regular" (regex) es un patrón para validar texto.
// /^(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,}$/ se lee así:
//   ^           → el patrón empieza desde el inicio del string
//   (?=.*[0-9]) → lookahead: debe haber AL MENOS un dígito (0-9) en algún lugar
//   (?=.*[^A-Za-z0-9]) → lookahead: debe haber AL MENOS un caracter que NO sea
//                          letra ni dígito (ej. !, @, #...)
//   .{8,}       → al menos 8 caracteres (cualquier carácter)
//   $           → hasta el final del string
// "export" permite que otros archivos importen y usen esta constante.
export const PASSWORD_RULE = /^(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,}$/;

// Función utilitaria exportada: comprueba si una contraseña cumple las reglas.
// .test(value) aplica la regex al string "value" y devuelve true o false.
export function isPasswordValid(value: string): boolean {
  return PASSWORD_RULE.test(value);
}

// ─── Definición de las props del componente principal ───────────────────────
interface PasswordFieldProps {
  // Valor actual del campo (controlado desde el padre).
  value: string;

  // Función del padre para actualizar el valor cuando el usuario escribe.
  onChange: (value: string) => void;

  // Texto gris que se muestra cuando el campo está vacío.
  placeholder?: string;

  // Si true, muestra debajo del campo la lista de requisitos con checks.
  showRequirements?: boolean;

  // Si true, el campo recibe el foco automáticamente al montar el componente.
  autoFocus?: boolean;

  // Si true, el navegador marcará el campo como obligatorio en el formulario.
  required?: boolean;
}

// ─── Componente interno: icono de ojo ───────────────────────────────────────
// Muestra un ojo "tachado" cuando off=true (contraseña visible → click oculta)
// o un ojo normal cuando off=false (contraseña oculta → click muestra).
// Prop "off": boolean que indica si la contraseña está actualmente visible.
function EyeIcon({ off }: { off: boolean }) {
  // Renderizado condicional con ternario:
  // off=true → icono de ojo tachado (off=visible, el ojo está "apagado")
  // off=false → icono de ojo normal (la contraseña está oculta)
  return off ? (
    // Ojo con línea diagonal: indica que la contraseña ESTÁ visible
    // (el ojo "está apagado" / tachado porque ya puedes verla)
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.243 4.243L9.88 9.88" />
    </svg>
  ) : (
    // Ojo sin tachar: la contraseña está oculta (puntos), click la mostrará
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

// ─── Componente interno: un requisito individual ─────────────────────────────
// Muestra una fila con icono (check teal o círculo gris) + texto del requisito.
// Props:
// - met: boolean que indica si este requisito ya se cumple.
// - label: texto descriptivo del requisito (ej. "Mínimo 8 caracteres").
function Requirement({ met, label }: { met: boolean; label: string }) {
  return (
    // <li>: elemento de lista. El padre renderiza esto dentro de un <ul>.
    // flex items-center gap-2: los elementos se colocan en fila con espacio.
    <li className="flex items-center gap-2 text-xs">
      {/* Renderizado condicional con ternario: check verde o círculo gris */}
      {met ? (
        // Requisito cumplido: palomita (checkmark) en color teal
        <svg className="w-4 h-4 shrink-0" fill="none" stroke={TEAL} viewBox="0 0 24 24" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        // Requisito NO cumplido: pequeño círculo gris
        // shrink-0 evita que el icono se encoja si el texto es largo
        <span className="w-4 h-4 shrink-0 flex items-center justify-center">
          <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
        </span>
      )}
      {/* Texto del requisito: teal+negrita si cumplido, gris si no */}
      <span className={met ? 'text-teal-700 font-medium' : 'text-gray-400'}>{label}</span>
    </li>
  );
}

// ─── Componente principal exportado ─────────────────────────────────────────
// Campo de contraseña con botón de mostrar/ocultar y lista opcional de reglas.
export function PasswordField({
  value,
  onChange,
  placeholder = 'Contraseña',   // valor por defecto del placeholder
  showRequirements = false,      // por defecto no muestra los requisitos
  autoFocus = false,             // por defecto no auto-focaliza
  required = false,              // por defecto no es obligatorio
}: PasswordFieldProps) {
  // Estado "show": true = contraseña visible (tipo text), false = oculta (tipo password).
  // Empieza en false: la contraseña se muestra como puntos por defecto.
  const [show, setShow] = useState(false);

  // Comprobaciones de reglas en tiempo real.
  // Se recalculan en cada render (cada vez que el usuario escribe un carácter).
  // .length >= 8: comprueba la longitud del string.
  const hasLength = value.length >= 8;

  // /[0-9]/.test(value): la regex [0-9] busca cualquier dígito en el string.
  // .test() devuelve true si encuentra al menos uno.
  const hasNumber = /[0-9]/.test(value);

  // /[^A-Za-z0-9]/.test(value): [^A-Za-z0-9] es "cualquier caracter que NO sea
  // letra (mayúscula o minúscula) ni dígito", es decir, un símbolo.
  const hasSymbol = /[^A-Za-z0-9]/.test(value);

  // ── JSX retornado ────────────────────────────────────────────────────────
  return (
    <div>
      {/* Contenedor relativo para poder posicionar el botón del ojo en absolute */}
      <div className="relative">
        {/* Campo de texto.
            - type: cambia dinámicamente entre 'text' y 'password' según "show".
              'password' muestra puntos/asteriscos; 'text' muestra caracteres.
            - value: el valor actual (componente controlado — React maneja el valor).
            - onChange: función flecha que llama a onChange del padre con el texto
              actual del input (e.target.value es el texto que el usuario escribió).
            - pr-10: padding derecho para que el texto no quede tapado por el ojo.
            - style: inyectamos la variable CSS de Tailwind para el color del anillo
              de foco usando la constante TEAL. */}
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          required={required}
          className="w-full px-3 py-2.5 pr-10 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2"
          style={{ ['--tw-ring-color' as any]: TEAL }}
        />

        {/* Botón del ojo: posicionado en absolute a la derecha del input.
            - type="button": evita que envíe el formulario si está dentro de un <form>.
            - onClick: función flecha que llama a setShow con el valor opuesto.
              (s) => !s: recibe el valor anterior "s" y devuelve su negación.
              Esto invierte el estado: false→true→false...
            - aria-label: etiqueta de accesibilidad para lectores de pantalla. */}
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-gray-600"
        >
          {/* Pasamos "off={show}": cuando show=true (visible), mostramos ojo tachado */}
          <EyeIcon off={show} />
        </button>
      </div>

      {/* Renderizado condicional: solo muestra la lista de requisitos si
          la prop showRequirements es true. */}
      {showRequirements && (
        <div className="mt-2 rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
          <p className="text-[11px] font-medium text-gray-500 mb-1.5">Tu contraseña debe tener:</p>
          {/* Lista de requisitos. Cada <Requirement> recibe su estado "met" y texto. */}
          <ul className="space-y-1">
            <Requirement met={hasLength} label="Mínimo 8 caracteres" />
            <Requirement met={hasNumber} label="Al menos un número" />
            <Requirement met={hasSymbol} label="Al menos un símbolo (ej: ! @ # $ %)" />
          </ul>
        </div>
      )}
    </div>
  );
}
