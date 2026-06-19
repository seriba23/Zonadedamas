'use client';

import { useState } from 'react';

const TEAL = '#008080';

export const PASSWORD_RULE = /^(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,}$/;

export function isPasswordValid(value: string): boolean {
  return PASSWORD_RULE.test(value);
}

interface PasswordFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  showRequirements?: boolean;
  autoFocus?: boolean;
  required?: boolean;
}

function EyeIcon({ off }: { off: boolean }) {
  return off ? (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.243 4.243L9.88 9.88" />
    </svg>
  ) : (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function Requirement({ met, label }: { met: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2 text-xs">
      {met ? (
        <svg className="w-4 h-4 shrink-0" fill="none" stroke={TEAL} viewBox="0 0 24 24" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <span className="w-4 h-4 shrink-0 flex items-center justify-center">
          <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
        </span>
      )}
      <span className={met ? 'text-teal-700 font-medium' : 'text-gray-400'}>{label}</span>
    </li>
  );
}

export function PasswordField({
  value,
  onChange,
  placeholder = 'Contraseña',
  showRequirements = false,
  autoFocus = false,
  required = false,
}: PasswordFieldProps) {
  const [show, setShow] = useState(false);

  const hasLength = value.length >= 8;
  const hasNumber = /[0-9]/.test(value);
  const hasSymbol = /[^A-Za-z0-9]/.test(value);

  return (
    <div>
      <div className="relative">
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
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-gray-600"
        >
          <EyeIcon off={show} />
        </button>
      </div>

      {showRequirements && (
        <div className="mt-2 rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
          <p className="text-[11px] font-medium text-gray-500 mb-1.5">Tu contraseña debe tener:</p>
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
