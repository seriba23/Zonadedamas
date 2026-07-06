# Restauración del proyecto — Punto seguro 2026-07-06

Este documento explica **cómo volver el proyecto exactamente a la versión concluida**
del **6 de julio de 2026** (commit `1c6d738`), qué correr, en qué orden y qué hace cada
paso. Guárdalo: si un cambio futuro rompe algo, aquí está la ruta de regreso.

> **Punto seguro:** commit `1c6d738` — *"formulario de registro unificado"* y todo lo
> anterior (unificación de clientes, invitación por WhatsApp, contacto de emergencia,
> suscripción/cliente, etc.).

---

## 1. Qué se respaldó y dónde vive

| # | Respaldo | Ubicación | Qué contiene |
|---|----------|-----------|--------------|
| A | **Tag de git** `respaldo-2026-07-06` | GitHub (`origin`) | Marca inmutable del commit `1c6d738`. Ningún cambio futuro lo altera. |
| B | **Rama de git** `respaldo/2026-07-06` | GitHub (`origin`) | Mismo commit, visible como rama. |
| C | **Bundle de git** | `C:\Users\Sergi\Backups\Zonadedamas-2026-07-06.bundle` (40 MB) | TODO el historial de git (ramas + tags) en un solo archivo. |
| D | **Copia completa** | `C:\Users\Sergi\Backups\Zonadedamas-fullcopy-2026-07-06.tar.gz` (224 MB) | Carpeta completa del proyecto: código, `.git`, `uploads/`, `landing/`, `pruebas/`, `.env` y configs. **Sin** `node_modules` (se regenera). |

- **Repositorio remoto:** `https://github.com/seriba23/Zonadedamas`
- **Rama de trabajo:** `redesign`
- **Ruta del proyecto:** `C:\xampp\htdocs\Zonadedamas`

> ⚠️ **La base de datos MySQL NO está en este respaldo.** Vive aparte en XAMPP
> (base `siliba`). El código puede volver al punto seguro, pero los **datos** de la BD
> no. Ver la sección 6 para respaldar/restaurar la BD.

---

## 2. ¿Qué escenario tienes? (elige uno)

- **Solo quiero deshacer cambios** y el repo local está sano → **Escenario A** (lo normal).
- **Mi carpeta/repo local se dañó** pero tengo el `.bundle` → **Escenario B**.
- **Perdí todo** (o quiero una copia idéntica con uploads/.env) → **Escenario C**.
- **Quiero levantarlo en otra máquina o en el VPS** desde GitHub → **Escenario D**.

Después de CUALQUIER escenario, corre la **sección 5** (dependencias + BD + arranque).

---

## 3. Escenario A — Volver a la versión segura (repo local sano)

Es el caso más común: hiciste cambios en `redesign` que rompieron algo y quieres regresar.

```powershell
# 1) Situarte en el proyecto
cd C:\xampp\htdocs\Zonadedamas

# 2) Ver qué tienes sin guardar (por si quieres conservar algo antes de descartar)
git status

# 3) Traer el tag desde GitHub por si no lo tienes localmente
git fetch origin --tags

# 4a) OPCIÓN SEGURA: crear una rama nueva EN el punto seguro (no borra nada)
git checkout -b recuperacion-2026-07-06 respaldo-2026-07-06

#   --- o ---

# 4b) OPCIÓN FUERTE: forzar la rama redesign a volver al punto seguro
#     ⚠️ DESTRUCTIVO: descarta TODO lo hecho en redesign después de 1c6d738.
git checkout redesign
git reset --hard respaldo-2026-07-06
```

Qué hace cada cosa:
- `git status` → muestra cambios sin guardar (para no perder algo por error).
- `git fetch origin --tags` → descarga el tag `respaldo-2026-07-06` si te falta.
- `git checkout -b ...` (4a) → crea una rama nueva parada en el punto seguro; **no** toca `redesign`.
- `git reset --hard respaldo-2026-07-06` (4b) → mueve `redesign` a ese commit y **borra** los cambios posteriores. Úsalo solo si estás seguro.

---

## 4. Escenario B / C / D — Restaurar desde archivo o GitHub

### Escenario B — Desde el bundle de git (repo local dañado)

El bundle trae todo el historial; se clona como si fuera un repositorio remoto.

```powershell
# Clonar el bundle a una carpeta nueva
cd C:\xampp\htdocs
git clone "C:\Users\Sergi\Backups\Zonadedamas-2026-07-06.bundle" Zonadedamas-restaurado

cd Zonadedamas-restaurado
# Situarte exactamente en el punto seguro
git checkout respaldo-2026-07-06
```
> El bundle **no** incluye `uploads/`, `.env` ni archivos sin trackear (esos están en la
> copia completa, Escenario C).

### Escenario C — Desde la copia completa (pérdida total)

Trae TODO tal cual estaba: código, `.git`, `uploads/`, `landing/`, `pruebas/`, `.env`.

```powershell
# Descomprimir a C:\xampp\htdocs (creará la carpeta Zonadedamas)
cd C:\xampp\htdocs
tar -xzf "C:\Users\Sergi\Backups\Zonadedamas-fullcopy-2026-07-06.tar.gz"
# Resultado: C:\xampp\htdocs\Zonadedamas con todo el contenido
```
> Si ya existe una carpeta `Zonadedamas`, renómbrala/muévela antes para no mezclar.

### Escenario D — Desde GitHub (otra máquina o VPS)

```powershell
# Clonar el repo y pararte en el punto seguro
git clone https://github.com/seriba23/Zonadedamas.git
cd Zonadedamas
git fetch origin --tags
git checkout respaldo-2026-07-06
```
> Desde GitHub **no** vienen `.env` ni `uploads/` (no se suben por seguridad). Debes
> copiar tu `.env` a mano y restaurar `uploads/` desde la copia completa (Escenario C).

---

## 5. Pasos post-restauración (SIEMPRE, en este orden)

```powershell
# 1) Dependencias (regenera node_modules; no venía en el respaldo)
cd C:\xampp\htdocs\Zonadedamas
npm install

# 2) Cliente de Prisma (tipos del ORM)
cd apps\api
npx prisma generate

# 3) Base de datos (ver sección 6). Aplica el esquema:
npx prisma migrate deploy

# 4) (opcional) Datos de ejemplo si la BD está vacía
npm run db:seed

# 5) Arrancar en desarrollo (dos terminales)
#    Terminal 1:
cd C:\xampp\htdocs\Zonadedamas\apps\api
npm run dev
#    Terminal 2:
cd C:\xampp\htdocs\Zonadedamas\apps\web
npm run dev
#    App: http://localhost:3000/login   |   API: http://localhost:3001/api
```

Qué hace cada paso:
- `npm install` → reinstala todas las dependencias (no se respaldan porque se regeneran).
- `npx prisma generate` → genera el cliente tipado de Prisma a partir del `schema.prisma`.
- `npx prisma migrate deploy` → aplica las migraciones al MySQL para que el esquema coincida.
- `npm run db:seed` → siembra permisos/roles/datos demo (solo si la BD está vacía).
- `npm run dev` → levanta API (3001) y Web (3000).

> **Requisitos previos:** XAMPP con Apache + MySQL encendidos, base `siliba` creada,
> y `apps/api/.env` con la cadena de conexión y claves (Stripe, JWT, etc.).

---

## 6. Base de datos MySQL (aparte del respaldo de código)

El respaldo de arriba **no** incluye los datos de MySQL. Para protegerlos, crea un dump:

```powershell
# Crear respaldo de la BD (ajusta la ruta de mysqldump si difiere)
& "C:\xampp\mysql\bin\mysqldump.exe" -u root siliba > "C:\Users\Sergi\Backups\siliba-2026-07-06.sql"
```

Restaurar la BD desde ese dump:

```powershell
# (Re)crear la base vacía y cargar el dump
& "C:\xampp\mysql\bin\mysql.exe" -u root -e "CREATE DATABASE IF NOT EXISTS siliba;"
& "C:\xampp\mysql\bin\mysql.exe" -u root siliba < "C:\Users\Sergi\Backups\siliba-2026-07-06.sql"
```

Si **no** tienes dump, la BD se reconstruye vacía con `prisma migrate deploy` + `npm run db:seed`
(sección 5), pero **sin** los datos reales (clientes, citas, etc.).

---

## 7. Advertencias

- `git reset --hard` **borra** los cambios no guardados y los commits posteriores. Antes,
  corre `git status` y, si dudas, usa la opción segura (rama nueva, Escenario A-4a).
- El `.env` contiene **secretos** (Stripe, JWT). Solo está en la copia completa local
  (`.tar.gz`), nunca en GitHub. No lo compartas.
- `node_modules` no se respalda a propósito: se regenera con `npm install`.
- Para el **VPS** el flujo es el mismo (Escenario D + sección 5), pero con
  `npm run build` + `pm2 restart` en vez de `npm run dev`, y usando el `.env` del servidor.

---

*Generado el 2026-07-06. Punto seguro: commit `1c6d738`, tag `respaldo-2026-07-06`.*
