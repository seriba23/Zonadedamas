// ============================================================
// ARCHIVO: use-setup-status.ts
// PROPÓSITO: Verifica si el negocio recién creado ha completado
//            todos los pasos de configuración inicial necesarios para
//            empezar a recibir reservas.
//
//            Este hook alimenta el "Asistente de Configuración" (Setup Wizard)
//            del dashboard, mostrando al dueño del negocio qué le falta
//            completar y el porcentaje de progreso.
//
// LOS 5 PASOS QUE VERIFICA:
//   1. Perfil del negocio (descripción + logo)
//   2. Horarios de atención (al menos uno activo/abierto)
//   3. Servicios (al menos uno creado)
//   4. Empleados (más de 1, ya que el dueño ya cuenta como 1)
//   5. Horarios de empleados (todos los empleados activos tienen horario)
//
// PATRÓN: Usa 4 consultas paralelas con react-query (useQuery) y
//         combina sus resultados para calcular el estado de configuración.
// ============================================================

'use client';
// Solo corre en el navegador

import { useQuery } from '@tanstack/react-query';
// useQuery: hook de react-query para hacer consultas al servidor con caché
import { api } from '@/lib/api';
// api: cliente HTTP para llamar al backend (rutas del dashboard)
// @/lib/api es un alias de ruta que apunta a apps/web/src/lib/api

// ============================================================
// HOOK: useSetupStatus
// No recibe parámetros.
// Devuelve un objeto con el estado de configuración del negocio.
// ============================================================
export function useSetupStatus() {

  // ============================================================
  // CONSULTA 1: Datos del negocio (tenant actual)
  // Verifica si tiene descripción y logo.
  // staleTime: 5 minutos → no vuelve a consultar en 5 minutos
  // ============================================================
  const { data: businessData, isLoading: l1 } = useQuery({
    queryKey: ['tenant-setup-check'], // Clave de caché única para esta consulta
    queryFn: () => api.get<any>('/api/tenants/current'),
    // api.get<any>: hacemos GET al backend. <any> le dice a TypeScript
    // que no nos importa el tipo exacto de la respuesta en este momento.
    staleTime: 5 * 60 * 1000, // 5 minutos en milisegundos
  });

  // ============================================================
  // CONSULTA 2: Lista de empleados
  // Necesitamos saber cuántos hay y si tienen horarios configurados.
  // perPage=100: pedimos hasta 100 empleados de una sola vez.
  // ============================================================
  const { data: employeesData, isLoading: l2 } = useQuery({
    queryKey: ['employees-count'],
    queryFn: () => api.get<{ data: any[] }>('/api/employees?perPage=100'),
    // { data: any[] }: la respuesta tiene forma { data: [...array de empleados...] }
    staleTime: 5 * 60 * 1000,
  });

  // ============================================================
  // CONSULTA 3: Lista de servicios
  // Necesitamos saber si hay al menos un servicio creado.
  // ============================================================
  const { data: servicesData, isLoading: l3 } = useQuery({
    queryKey: ['services-count'],
    queryFn: () => api.get<{ data: any[] }>('/api/services'),
    staleTime: 5 * 60 * 1000,
  });

  // ============================================================
  // CONSULTA 4: Horarios de atención del negocio
  // Necesitamos saber si hay al menos un día marcado como "abierto".
  // ============================================================
  const { data: businessHoursData, isLoading: l4 } = useQuery({
    queryKey: ['business-hours-check'],
    queryFn: () => api.get<{ data: any[] }>('/api/tenant/business-hours'),
    staleTime: 5 * 60 * 1000,
  });

  // ============================================================
  // isLoading: true si CUALQUIERA de las 4 consultas todavía está cargando.
  // El operador || (OR) devuelve true si al menos uno de los valores es true.
  // ============================================================
  const isLoading = l1 || l2 || l3 || l4;

  // ============================================================
  // EXTRACCIÓN DE DATOS
  // Sacamos los arrays/objetos de las respuestas, usando || como fallback
  // en caso de que la consulta todavía no haya devuelto datos.
  //
  // "as any": le decimos a TypeScript que confíe en nosotros sobre el tipo
  //           (eludimos la verificación de tipos en estos accesos)
  // ============================================================
  const business = businessData?.data as any;   // Objeto del negocio (o undefined)
  const employees = employeesData?.data || [];   // Array de empleados (o array vacío)
  const services = servicesData?.data || [];     // Array de servicios (o array vacío)
  const businessHours = businessHoursData?.data || []; // Array de horarios (o array vacío)

  // ============================================================
  // VERIFICACIONES: Cada "needs..." es true si falta algo por configurar.
  // ============================================================

  // Paso 1: ¿Falta completar el perfil?
  // El perfil se considera incompleto si NO tiene descripción Y NO tiene logo.
  // && (AND): ambas condiciones deben cumplirse para que sea true.
  // !business.description: true si description es null, undefined o string vacío
  // !business.logoUrl: true si logoUrl es null, undefined o string vacío
  const needsBusinessProfile = business && !business.description && !business.logoUrl;

  // Paso 2: ¿Faltan horarios de atención?
  // Falta si el array está vacío O si todos los días tienen isOpen = false.
  // || (OR): cualquiera de las dos condiciones activa la alerta
  // .every((h) => !h.isOpen): devuelve true si TODOS los horarios tienen isOpen=false
  const needsBusinessHours = businessHours.length === 0 || businessHours.every((h: any) => !h.isOpen);
  // "h" es la variable iteradora del .every(): representa cada objeto de horario

  // Paso 3: ¿Faltan servicios?
  // Falta si el array de servicios está completamente vacío
  const needsServices = services.length === 0;

  // Paso 4: ¿Faltan empleados?
  // Falta si hay 1 o menos empleados. El dueño ya está contado (length <= 1 significa
  // que solo está el dueño y no hay empleados adicionales).
  const needsEmployees = employees.length <= 1;

  // Paso 5: ¿Faltan horarios de empleados?
  // Primero filtramos los empleados que:
  //   - están activos (e.isActive = true)
  //   - Y no tienen horarios configurados correctamente
  //
  // .filter((e) => ...): crea un nuevo array solo con los elementos que
  //   cumplen la condición del callback. "e" = cada empleado.
  const employeesWithoutSchedule = employees.filter(
    (e: any) => e.isActive && (!e.schedules || e.schedules.length === 0 || e.schedules.every((s: any) => !s.isWorking)),
    // e.isActive: solo nos interesan empleados activos
    // !e.schedules: no tiene ningún horario asignado
    // e.schedules.length === 0: tiene el array pero está vacío
    // e.schedules.every((s) => !s.isWorking): tiene horarios pero todos tienen isWorking=false
    // "s" = cada objeto de horario del empleado
  );
  // needsEmployeeSchedules es true si hay al menos un empleado sin horario
  const needsEmployeeSchedules = employeesWithoutSchedule.length > 0;

  // ============================================================
  // CÁLCULO DE PROGRESO
  //
  // checks: array de booleanos, uno por cada paso.
  //   true = paso completado, false = paso pendiente.
  //   El ! (negación) invierte el "needs": "necesita X" → "!necesita X" = "tiene X"
  // ============================================================
  const checks = [
    !needsBusinessProfile,   // true si el perfil ESTÁ completo
    !needsBusinessHours,     // true si los horarios ESTÁN configurados
    !needsServices,          // true si los servicios EXISTEN
    !needsEmployees,         // true si hay suficientes empleados
    !needsEmployeeSchedules, // true si todos los empleados tienen horario
  ];
  const totalSteps = checks.length; // Total de pasos = 5 (longitud del array)

  // .filter(Boolean): filtra el array dejando solo los valores "truthy".
  // Boolean convierte cada elemento a true/false. Así contamos cuántos pasos
  // están completados.
  // Ejemplo: [true, false, true, false, true].filter(Boolean) → [true, true, true]
  // .length → 3 (pasos completados)
  const completedSteps = checks.filter(Boolean).length;

  // isSetupComplete: true solo si NINGÚN paso falta
  // (todos los "needs..." son false)
  const isSetupComplete = !needsBusinessProfile && !needsBusinessHours && !needsServices && !needsEmployees && !needsEmployeeSchedules;

  // ============================================================
  // VALOR DE RETORNO
  // Devolvemos todo lo que los componentes del wizard pueden necesitar.
  // ============================================================
  return {
    isSetupComplete,           // ¿Está todo configurado?
    isLoading,                 // ¿Todavía cargando alguna consulta?
    completedSteps,            // Número de pasos completados (0-5)
    totalSteps,                // Total de pasos (5)
    // Expose individual checks for the wizard
    needsBusinessProfile,      // ¿Falta completar el perfil?
    needsBusinessHours,        // ¿Faltan horarios de atención?
    needsServices,             // ¿Faltan servicios?
    needsEmployees,            // ¿Faltan empleados?
    needsEmployeeSchedules,    // ¿Algún empleado no tiene horario?
    employeesWithoutSchedule,  // Array de empleados específicos sin horario (para mostrarlos en el wizard)
    employees,                 // Lista completa de empleados
  };
}
