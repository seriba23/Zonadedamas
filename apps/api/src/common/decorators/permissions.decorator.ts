// ─────────────────────────────────────────────────────────────────────────────
// DECORADOR @RequirePermissions(...) — "esta ruta exige estos permisos"
// ─────────────────────────────────────────────────────────────────────────────
//
// IDEA GENERAL: en NestJS, un "decorador" es una etiqueta que empieza con "@" y
// se pone encima de una clase o de un método. Algunos decoradores no cambian el
// código directamente: solo ADJUNTAN información (metadata) a ese método/clase,
// como pegarle una nota adhesiva. Luego, OTRA pieza (aquí, el PermissionGuard)
// lee esa nota para decidir qué hacer. Este archivo crea esa "nota".

// De NestJS importamos SetMetadata: una función auxiliar que crea un decorador
// capaz de guardar un par clave→valor (la "nota adhesiva") sobre el elemento
// decorado. No ejecuta lógica; solo almacena datos para leerlos después.
import { SetMetadata } from '@nestjs/common';

// PERMISSIONS_KEY es el "nombre de la nota" (la clave con la que guardamos y
// luego recuperamos los permisos). Lo declaramos como constante exportada para
// que tanto este decorador (al GUARDAR) como el guard (al LEER) usen
// exactamente el mismo texto y no haya errores por escribirlo distinto.
export const PERMISSIONS_KEY = 'permissions';

// RequirePermissions es el decorador que usaremos en los controladores, por
// ejemplo: @RequirePermissions('appointments.create').
//
// - "(...permissions: string[])" usa el operador REST ("..."): permite recibir
//   MUCHOS argumentos sueltos y agruparlos automáticamente en un arreglo. Así
//   se puede llamar con uno o varios permisos:
//     @RequirePermissions('a')             -> permissions = ['a']
//     @RequirePermissions('a', 'b', 'c')   -> permissions = ['a','b','c']
// - "=>" es una función flecha (forma corta de escribir una función).
// - El cuerpo devuelve SetMetadata(clave, valor): guarda bajo la clave
//   PERMISSIONS_KEY el arreglo de permisos. Esa metadata queda pegada al
//   método/clase y el PermissionGuard la leerá más tarde para autorizar o no.
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
