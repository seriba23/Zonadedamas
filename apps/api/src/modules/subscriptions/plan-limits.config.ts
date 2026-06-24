// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// SubscriptionPlan es un "enum" (lista cerrada de valores posibles) que Prisma
// genera automáticamente a partir del schema de la base de datos. Aquí solo
// puede valer una de estas tres opciones: 'BASICO', 'PLUS' o 'PRO'. Lo usamos
// para garantizar que solo se hable de planes que realmente existen.
import { SubscriptionPlan } from '@prisma/client';

// ─────────────────────────────────────────────────────────────────────────────
// INTERFAZ: el "molde" que describe qué límites/permisos tiene CADA plan.
// Una interface no genera código; solo dice qué campos y de qué tipo debe tener
// un objeto para considerarse "un PlanLimits". Sirve para que TypeScript avise
// si nos equivocamos de campo o de tipo.
// ─────────────────────────────────────────────────────────────────────────────
export interface PlanLimits {
  maxEmployees: number;            // Máximo de empleados activos permitidos.
  maxAppointmentsPerMonth: number; // Máximo de citas por mes (-1 = ilimitado).
  maxLocations: number;            // Máximo de sucursales/ubicaciones (-1 = ilimitado).
  fullReports: boolean;            // ¿Tiene acceso a los reportes completos? (true/false).
  exportReports: boolean;          // ¿Puede exportar/descargar reportes? (true/false).
  monthlyPriceUsd: number;         // Precio mensual del plan en dólares (USD).
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTE PLAN_LIMITS: la "tabla" que asocia cada plan con sus límites.
//
// "Record<SubscriptionPlan, PlanLimits>" es un tipo de TypeScript que significa
// "un objeto cuyas claves son TODOS los valores de SubscriptionPlan (BASICO,
// PLUS, PRO) y cuyos valores son objetos del tipo PlanLimits". Gracias a esto,
// si en el futuro se añade un plan nuevo al enum, TypeScript obligará a definir
// también sus límites aquí (no se puede olvidar ninguno).
// ─────────────────────────────────────────────────────────────────────────────
export const PLAN_LIMITS: Record<SubscriptionPlan, PlanLimits> = {
  // Plan BÁSICO: el más económico, con límites pequeños y sin reportes.
  BASICO: {
    maxEmployees: 3,                 // Hasta 3 empleados activos.
    maxAppointmentsPerMonth: 150,    // Hasta 150 citas al mes.
    maxLocations: 1,                 // Solo 1 ubicación.
    fullReports: false,              // Sin reportes completos.
    exportReports: false,            // No puede exportar reportes.
    monthlyPriceUsd: 29.99,          // Cuesta 29.99 USD/mes.
  },
  // Plan PLUS: intermedio, más capacidad y ya incluye reportes completos.
  PLUS: {
    maxEmployees: 8,                 // Hasta 8 empleados activos.
    maxAppointmentsPerMonth: 500,    // Hasta 500 citas al mes.
    maxLocations: 3,                 // Hasta 3 ubicaciones.
    fullReports: true,               // Incluye reportes completos.
    exportReports: false,            // Pero todavía NO puede exportarlos.
    monthlyPriceUsd: 49.99,          // Cuesta 49.99 USD/mes.
  },
  // Plan PRO: el más completo. El valor -1 se usa como convención para decir
  // "sin límite" (ilimitado); el código que lo lea debe interpretarlo así.
  PRO: {
    maxEmployees: 20,                // Hasta 20 empleados activos.
    maxAppointmentsPerMonth: -1,     // unlimited (-1 = ilimitado).
    maxLocations: -1,                // unlimited (-1 = ilimitado).
    fullReports: true,               // Incluye reportes completos.
    exportReports: true,             // Y además puede exportarlos.
    monthlyPriceUsd: 79.99,          // Cuesta 79.99 USD/mes.
  },
};
