// ─────────────────────────────────────────────────────────────────────────────
// apps/web/src/app/page.tsx
//
// CONCEPTO: Este es el "page.tsx" de la ruta raíz "/".
// En Next.js App Router, cualquier archivo llamado "page.tsx" dentro de
// la carpeta "app/" define el contenido de una URL:
//
//   app/page.tsx           → ruta "/"
//   app/login/page.tsx     → ruta "/login"
//   app/book/[slug]/page.tsx → ruta "/book/algo"
//
// Esta página NO muestra contenido real: es un "portero" que redirige
// al usuario según su estado de autenticación.
// ─────────────────────────────────────────────────────────────────────────────

// 'use client' es una directiva de Next.js 14 que marca este archivo como
// un COMPONENTE DE CLIENTE (Client Component).
//
// DIFERENCIA FUNDAMENTAL:
//  - Server Component (sin 'use client'): Se renderiza en el servidor.
//    No puede usar hooks (useState, useEffect) ni eventos del navegador.
//    Tiene acceso directo a la base de datos, sistema de archivos, etc.
//  - Client Component ('use client'): Se renderiza en el navegador.
//    Puede usar todos los hooks de React, acceder a localStorage,
//    escuchar eventos del usuario, etc.
//
// Este archivo NECESITA 'use client' porque usa:
//  - useEffect (hook de React)
//  - useRouter (hook de Next.js que solo funciona en el cliente)
//  - useAuth (hook personalizado que accede al contexto de autenticación)
'use client';

// useEffect: hook de React que ejecuta código como "efecto secundario"
// después de que el componente se renderiza en pantalla.
// Lo usamos para ejecutar la lógica de redirección.
import { useEffect } from 'react';

// useRouter: hook de Next.js para navegar entre rutas programáticamente
// (sin que el usuario haga clic en un enlace).
// "router.replace('/login')" redirige a /login sin agregar la ruta actual
// al historial del navegador (el usuario no puede volver atrás con el botón).
import { useRouter } from 'next/navigation';

// useAuth: hook personalizado que expone el estado de autenticación del usuario.
// Retorna: { user, isLoading, isAuthenticated, login, logout, ... }
import { useAuth } from '@/lib/hooks/use-auth';

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function HomePage() {
  // useRouter nos da el objeto "router" con métodos para navegar.
  const router = useRouter();

  // Extraemos del contexto de auth:
  //  - user: objeto con los datos del usuario logueado (o null si no hay sesión)
  //  - isLoading: true mientras se verifica si hay sesión activa (leyendo localStorage,
  //    verificando token JWT, etc.). false cuando ya se sabe si está o no autenticado.
  //  - isAuthenticated: true si el usuario tiene una sesión válida activa
  const { user, isLoading, isAuthenticated } = useAuth();

  // useEffect(función, [dependencias]):
  //  - La FUNCIÓN se ejecuta después de cada render donde alguna dependencia cambió.
  //  - Las DEPENDENCIAS son los valores que useEffect "vigila". Si cambia
  //    alguno de ellos, el efecto se vuelve a ejecutar.
  //  - Aquí vigilamos: isLoading, isAuthenticated, user, router.
  useEffect(() => {
    // Si todavía estamos verificando la sesión, no hacer nada todavía.
    // Evita una redirección prematura antes de saber si el usuario está logueado.
    if (isLoading) return;

    if (isAuthenticated && user) {
      // El usuario tiene sesión activa. Determinamos a dónde redirigirlo.
      //
      // LÓGICA DE ROL:
      //  - Si tiene "isAdmin === true" O tiene el permiso "employees.create"
      //    (permiso de administrador de negocio), lo mandamos al dashboard /home.
      //  - Si no tiene esos permisos, es un empleado → lo mandamos a /employee.
      //
      // "user.permissions?.includes('employees.create')" usa el operador
      // de encadenamiento opcional "?." que evita un error si "permissions"
      // es null o undefined. Es equivalente a:
      //   if (user.permissions && user.permissions.includes('employees.create'))
      const isAdmin = user.isAdmin === true || user.permissions?.includes('employees.create');
      // router.replace en vez de router.push: no agrega esta ruta al historial,
      // así el usuario no puede volver a "/" con el botón "Atrás".
      router.replace(isAdmin ? '/home' : '/employee');
    } else {
      // No hay sesión activa → redirigir al login.
      router.replace('/login');
    }
  // Array de dependencias: el efecto se re-ejecuta si cualquiera de estos cambia.
  }, [isLoading, isAuthenticated, user, router]);

  // ─── JSX: LO QUE SE MUESTRA EN PANTALLA ──────────────────────────────────
  // Mientras se determina hacia dónde redirigir, mostramos un spinner de carga.
  // "min-h-[100dvh]" = altura mínima del 100% de la ventana visible del dispositivo
  // (dvh = dynamic viewport height, más preciso que vh en móviles con barra de URL).
  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-gray-50">
      <div className="text-center">
        {/* Spinner giratorio: un círculo con borde incompleto que gira.
            - border-2: borde de 2px
            - border-[#008080]: borde teal en la mayor parte del círculo
            - border-t-transparent: el borde SUPERIOR es transparente,
              creando el efecto de "arco" que gira con animate-spin */}
        <div className="inline-block w-8 h-8 border-2 border-[#008080] border-t-transparent rounded-full animate-spin" />
        <p className="mt-3 text-sm text-gray-500">Redirigiendo…</p>
      </div>
    </div>
  );
}
