// ============================================================
// ARCHIVO: use-tenant-tier.ts
// PROPÓSITO: Determina qué "nivel" o "plan" tiene el negocio del usuario
//            logueado, para condicionar qué funcionalidades están disponibles.
//
// NIVELES (TIERS) DE NEGOCIO:
//   - FREELANCER: profesional independiente que trabaja solo.
//                 Plan básico con menos funcionalidades (ej: sin gestión
//                 de múltiples empleados, sin comisiones, etc.)
//   - BUSINESS:   negocio con equipo. Plan Plus con todas las funcionalidades.
//
// PATRÓN: Hook "thin" (delgado) sin estado propio. Solo lee el estado
//         de useAuth() y calcula booleanos derivados.
//
// EJEMPLO DE USO:
//   const { isFreelancer, isPlus } = useTenantTier();
//   if (isPlus) {
//     // mostrar sección de comisiones de empleados
//   }
// ============================================================

'use client';
// Solo corre en el navegador

import { useAuth } from './use-auth';
// useAuth: accedemos al usuario logueado para leer el tipo del tenant

// ============================================================
// TIPO: TenantType
// Union type de TypeScript: el tipo puede ser UNO de estos dos strings.
// 'FREELANCER' | 'BUSINESS' significa "puede ser 'FREELANCER' O 'BUSINESS'".
// ============================================================
export type TenantType = 'FREELANCER' | 'BUSINESS';

// ============================================================
// HOOK: useTenantTier
// No recibe parámetros.
// Devuelve: { isFreelancer, isPlus, tenantType }
// ============================================================
export function useTenantTier() {
  const { user } = useAuth();

  // user?.tenantType: si user es null (no logueado), devuelve undefined
  // ?? null: si es undefined, usa null como valor por defecto
  // "as TenantType | null": le decimos a TypeScript que trate el valor
  // como TenantType o null (conversión de tipo)
  const tenantType = (user?.tenantType ?? null) as TenantType | null;

  // isFreelancer: true si el negocio es de tipo FREELANCER
  // === es comparación estricta de igualdad (compara valor Y tipo)
  const isFreelancer = tenantType === 'FREELANCER';

  // isPlus: true si el negocio es de tipo BUSINESS (plan Plus con más funcionalidades)
  // El nombre "isPlus" es el término de UI que se muestra al usuario,
  // mientras que "BUSINESS" es el valor interno en la base de datos.
  const isPlus = tenantType === 'BUSINESS';

  // Devolvemos los tres valores para que el componente elija cuál usar
  return { isFreelancer, isPlus, tenantType };
}
