// ─────────────────────────────────────────────────────────────────────────────
// DECORADOR @Public() — "esta ruta NO requiere estar logueado"
// ─────────────────────────────────────────────────────────────────────────────
//
// IDEA GENERAL: por defecto, las rutas del proyecto están protegidas por el
// JwtAuthGuard (exigen un token válido). A veces queremos una ruta abierta a
// cualquiera (ej. login, registro, páginas públicas). Para eso le pegamos la
// "nota adhesiva" isPublic=true con @Public(), y el JwtAuthGuard, al ver esa
// nota, deja pasar sin pedir token. (Mismo mecanismo que permissions.decorator,
// pero aquí la nota es un simple "sí, es pública".)

// SetMetadata: crea decoradores que adjuntan un par clave→valor (la "nota")
// sobre el método o clase decorada, para que otra pieza lo lea después.
import { SetMetadata } from '@nestjs/common';

// IS_PUBLIC_KEY es el nombre de la nota. Lo comparte este decorador (al
// guardar) con el JwtAuthGuard (al leer), por eso es una constante exportada:
// así ambos usan exactamente el mismo texto.
export const IS_PUBLIC_KEY = 'isPublic';

// Public es el decorador que se usa como @Public() sobre una ruta o controlador.
// No recibe argumentos "()" y simplemente guarda la nota IS_PUBLIC_KEY con el
// valor true. El guard buscará esa nota y, si la encuentra, permitirá el acceso
// sin autenticación.
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
