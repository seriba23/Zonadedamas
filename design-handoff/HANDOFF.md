# Handoff — Siliba Design System v2

Este documento contiene el plan completo para que Claude Code aplique el rediseño visual a tu repo `seriba23/Zonadedamas`.

---

## 📦 Archivos que necesitas

Descárgalos desde el panel de la derecha (o ejecuta "Download project") y guárdalos donde Claude Code pueda leerlos. Recomiendo crear una carpeta `design-handoff/` en la raíz del repo:

```
Zonadedamas/
├── apps/
├── packages/
├── design-handoff/         ← crea esta carpeta
│   ├── design-system.html  ← documentación completa (tokens, componentes, specs)
│   ├── screens.html        ← pantallas rediseñadas (Dashboard, Calendar, Staff, Reports, Services, Inventory)
│   ├── logo-siliba.png     ← logo de marca
│   └── HANDOFF.md          ← este archivo
└── CLAUDE.md
```

> **Tip:** committea esta carpeta al repo para que cualquier dev (o tú en otra sesión) pueda referenciarla.

---

## 🎯 Estrategia: PRs pequeños y atómicos

**NO le pidas a Claude Code que haga todo de una vez.** El rediseño tiene riesgo cero si lo divides en estos 9 PRs en orden:

| PR  | Archivos tocados | Riesgo |
|-----|------------------|--------|
| 1️⃣ Extender tokens en Tailwind | `tailwind.config.ts` | Bajo |
| 2️⃣ Fix colores hardcoded en KPI | `kpi-card.tsx`, `upcoming-appointments.tsx` | Bajo |
| 3️⃣ Status Confirmada → teal | `badge.tsx` | Bajo |
| 4️⃣ Refactor globals.css | `globals.css` | Bajo |
| 5️⃣ Modo oscuro vía CSS vars | `globals.css`, `layout.tsx` | Medio |
| 6️⃣ Rediseñar Dashboard | `dashboard-view.tsx`, sub-componentes | Medio |
| 7️⃣ Rediseñar Calendario + Registro | `calendar-view.tsx` | Alto |
| 8️⃣ Personal con tabs (Organigrama, Asistencia, Horarios, Comisiones) | `staff/*` | Alto |
| 9️⃣ Rediseñar Servicios e Inventario | `services/`, `inventory/` | Medio |

Empieza por PR 1-5 (todos son refactors pequeños y mejoran al instante).

---

## 📝 Prompts listos para Claude Code

Copia y pega cada uno cuando te toque ese PR.

---

### PR 1 · Extender Tailwind con escala completa

```
Lee design-handoff/design-system.html (sección "Color") para entender los tokens.

Actualiza apps/web/tailwind.config.ts para extender la paleta con:
- gray: escala 50–900 con valores slate (50:#f8fafc, 100:#f1f5f9, 200:#e2e8f0, 300:#cbd5e1, 400:#94a3b8, 500:#64748b, 600:#475569, 700:#334155, 800:#1e293b, 900:#0f172a)
- success: 50:#ecfdf5, 100:#d1fae5, 600:#059669, 700:#047857
- warning: 50:#fffbeb, 100:#fef3c7, 600:#d97706, 700:#b45309
- danger:  50:#fef2f2, 100:#fee2e2, 600:#dc2626, 700:#b91c1c
- info:    50:#eff6ff, 100:#dbeafe, 600:#2563eb, 700:#1d4ed8
- purple:  50:#faf5ff, 100:#f3e8ff, 600:#9333ea, 700:#7e22ce

NO toques la escala primary (ya está bien). NO refactorices código todavía — este PR solo agrega tokens.

Después, ejecuta `npm run build` para asegurar que no rompió nada.
```

---

### PR 2 · Eliminar colores hardcoded en Dashboard

```
Lee design-handoff/design-system.html sección 10 (Cards & KPIs) y la sección 13 paso 2 + paso 4.

Cambios concretos:

1) apps/web/src/components/dashboard/kpi-card.tsx:
   - Reemplaza `bg-[#e0f2f1] text-[#008080]` por `bg-primary-50 text-primary-600`
   - El círculo del icono: cambia `w-10 h-10` a `w-11 h-11` (44×44px)
   - Cambia `rounded-lg` del wrapper del icono a `rounded-xl`

2) apps/web/src/components/dashboard/upcoming-appointments.tsx:
   - Reemplaza TODAS las ocurrencias de `text-[#008080]` por `text-primary-600`
   - Reemplaza `text-[#006666]` por `text-primary-700`
   - En la función statusLabel, cambia CONFIRMED de `bg-green-100 text-green-700` a `bg-primary-50 text-primary-700`
   - Cambia COMPLETED de `bg-gray-100 text-gray-600` a `bg-success-50 text-success-700`

No cambies layouts ni estructura, solo clases CSS. Ejecuta `npm run build` al terminar.
```

---

### PR 3 · Status "Confirmada" en teal (no azul)

```
Lee design-handoff/design-system.html sección 8 (Badges & Status).

En apps/web/src/components/ui/badge.tsx:

1) Agrega 'primary' al tipo BadgeProps.variant (después de 'default')
2) Agrega esta entrada a variantClasses: primary: 'bg-primary-50 text-primary-700'
3) En AppointmentStatusBadge, cambia:
   - confirmed: { variant: 'info' } → { variant: 'primary' }
   - no_show: cambia label 'Ausente' → 'No-show' y mantén variant 'default'

Verifica que el badge "Confirmada" ahora se vea en teal donde sea que aparezca.
```

---

### PR 4 · Refactor globals.css

```
Lee design-handoff/design-system.html sección 4 (Espaciado & radios) y sección 13 paso 6.

En apps/web/src/app/globals.css:

1) Cambia `.card` de:
   @apply bg-white rounded-xl shadow-sm border border-gray-200 p-6;
   A:
   @apply bg-white rounded-xl border border-gray-200 p-5;
   (quitamos sombra default — se agrega cuando hace falta — y p-6 → p-5)

2) Agrega después:
   .card-elevated { @apply shadow-sm border-transparent; }
   .card-highlight { @apply bg-primary-50 border-primary-200; }

3) En `.btn-primary` y `.btn-secondary`, cambia `rounded-lg` por `rounded-[10px]` (token md).
4) En `.input-field`, asegúrate de que el focus use `ring-4 ring-primary-100` en lugar de `ring-2 ring-primary-500`. La border puede seguir siendo primary-500.

Ejecuta build y haz una pasada visual rápida.
```

---

### PR 5 · Modo oscuro vía CSS variables

```
Lee design-handoff/screens.html — abre el archivo en un navegador y activa el toggle de Tweaks (esquina inferior derecha) para ver cómo se ve oscuro.

Implementación:

1) En apps/web/src/app/globals.css, agrega un bloque de variables CSS antes de @layer base:

   :root {
     --bg-canvas: #f8fafc;
     --bg-surface: #ffffff;
     --border: #e2e8f0;
     --text-primary: #0f172a;
     --text-secondary: #475569;
     --text-muted: #94a3b8;
   }

   html[data-theme="dark"] {
     --bg-canvas: #0b1220;
     --bg-surface: #0f172a;
     --border: #1e293b;
     --text-primary: #f1f5f9;
     --text-secondary: #94a3b8;
     --text-muted: #64748b;
   }

2) En body, reemplaza `bg-gray-50 text-gray-900` por `bg-[var(--bg-canvas)] text-[var(--text-primary)]`.

3) Agrega un toggle de modo oscuro en el sidebar (apps/web/src/components/layout/sidebar.tsx) que use localStorage y setee document.documentElement.dataset.theme.

4) Pasa los componentes principales (Card, Sidebar, Header, KpiCard) a usar bg-[var(--bg-surface)] border-[var(--border)] en lugar de bg-white border-gray-200.

Empieza por Card y KpiCard primero. Verifica que el toggle funciona antes de continuar con otros componentes.
```

---

### PR 6 · Rediseñar Dashboard

```
Abre design-handoff/screens.html y enfoca el artboard "01 Dashboard / Inicio · Admin · Dashboard" (1280×820).

Replica estos cambios en apps/web/src/components/dashboard/:

1) Sidebar (apps/web/src/components/layout/sidebar.tsx):
   - Quita el logo "S" en cuadrito teal. Solo el wordmark "Siliba" en text-primary-600 font-bold text-xl.

2) KPI Cards (kpi-card.tsx) — ya hecho en PR 2.

3) AlertsPanel (alerts-panel.tsx):
   - Cuando hay alertas, render una Card con `card-highlight` (bg-primary-50 + border-primary-200)
   - Icono circular teal a la izquierda, texto en primary-700, y un Button primary "Acción sugerida" a la derecha
   - Si no hay alertas, no la rendericen.

4) Last7DaysChart (last-7-days-chart.tsx):
   - Header con el TOTAL grande (text-2xl font-extrabold), trend label en success-700, y segmented control 7d/30d/3m a la derecha.
   - Mejora el SVG: usa stroke teal-600 con gradiente lineal al fondo (primary-600 .25 → 0).

5) UpcomingAppointments — ya tocado en PR 2.

6) Agrega `EmployeesToday`: lista de empleados con avatares 36px + nombre/rol a la izquierda y "X citas / hoy" a la derecha.

NO cambies la lógica de fetching ni el shape de data. Solo presentation layer.
```

---

### PR 7 · Calendario + nueva vista Registro

```
Abre design-handoff/screens.html y enfoca:
- "02 Calendario · Admin · Día (por empleado)" — vista actual
- En el segmented control: Día / Semana / Mes / Registro — agrega Semana y Registro

Cambios:

1) En calendar-view.tsx, agrega un state `view: 'day' | 'week' | 'month' | 'registro'`.

2) Día view (la actual): mantenla pero asegúrate de que las citas usen color por estado, NO por empleado (el empleado va en el header de la columna).

3) Semana view (NUEVA):
   - Columnas por día (Lun 11, Mar 12, Mié 13, ...) — cada columna muestra día de la semana arriba en uppercase pequeño + el número grande
   - Hoy resaltado con primary-50 de fondo en el header
   - Citas más compactas (50px por hora en lugar de 60px)

4) Registro view (NUEVA — IMPORTANTE):
   - Tabla con columnas: Fecha y hora | Cliente | Servicios | Empleado | Estado | Total | ...
   - Filtros arriba: buscar + dropdowns de estado y empleado
   - Paginación inferior

5) Línea AHORA en danger-600 (rojo) atravesando la hora actual con un punto al inicio.

Crea un nuevo archivo apps/web/src/components/calendar/appointments-registry.tsx para la vista Registro — referencia screens.html sección 02 ("Registro de citas") para el diseño exacto.

Mantén la funcionalidad existente intacta.
```

---

### PR 8 · Personal con 5 tabs

```
Abre design-handoff/screens.html y enfoca "03 Personal · Admin · Personal" (1280×820).

Crea estructura de tabs en apps/web/src/app/(dashboard)/staff/page.tsx con:
- Lista (actual)
- Organigrama (NUEVA)
- Asistencia (NUEVA)
- Horarios (existente — employee-schedule-editor.tsx — adáptalo a vista global)
- Comisiones (NUEVA)

Componentes a crear:

1) apps/web/src/components/staff/staff-tabs.tsx — componente TabNav reutilizable
2) apps/web/src/components/staff/staff-list-grid.tsx — la grid actual de cards
3) apps/web/src/components/staff/organigrama.tsx — vista de árbol jerárquico
4) apps/web/src/components/staff/asistencia-grid.tsx — grid semanal con presente/tarde/falta/vacaciones
5) apps/web/src/components/staff/comisiones-table.tsx — tabla con quincenas + exportar nómina

Lee cada artboard correspondiente en screens.html (cambia entre tabs en el artboard enfocado) para ver el diseño exacto.

Para datos:
- Asistencia: nueva tabla `employee_attendance` con campos employee_id, date, status (PRESENT/LATE/ABSENT/VACATION), check_in, check_out
- Comisiones: usa el campo `commission` que ya debe existir o créalo en `employees` table; calcula sobre ingresos del período

Si no quieres tocar backend en este PR, empieza con mock data y agrega los endpoints después.
```

---

### PR 9 · Servicios e Inventario

```
Abre design-handoff/screens.html y enfoca:
- "05 Servicios · Admin · Servicios" 
- "06 Inventario · Admin · Inventario"

Servicios — tabs Lista / Categorías / Paquetes:

1) Crea apps/web/src/components/services/services-tabs.tsx
2) services-grid.tsx — cards con banda de color superior según categoría, duración, precio, avatares de empleados, # bookings 30d
3) categories-grid.tsx — cards por categoría mostrando sus servicios e ingresos del mes
4) bundles-grid.tsx — paquetes con precio tachado + ahorro destacado en banner teal

Inventario — tabs Productos / Movimientos / Proveedores:

1) products-table.tsx — incluye barra de progreso visual de stock vs mínimo, badge de estado (Ok/Bajo/Sin stock) y banner de alerta si hay productos críticos
2) movements-log.tsx — log con tipo color-coded (Entrada=success, Salida=info, Ajuste=warning) + cantidad con signo
3) suppliers-grid.tsx — cards con contacto, SKUs, total gastado, última orden

Backend: probablemente ya tienes los modelos. Si no:
- inventory_items: id, name, sku, stock, min_stock, cost, price, category, supplier_id
- inventory_movements: id, item_id, type (IN/OUT/ADJ), qty, by_user_id, note, created_at
- suppliers: id, name, contact, phone, email
```

---

## 🔧 Tips para trabajar con Claude Code

1. **Antes de cada PR:** dile `lee design-handoff/design-system.html sección X` para que tenga el contexto. NO asumas que recordó del PR anterior.

2. **Verifica visualmente:** después de cada PR, ejecuta `npm run dev` y compara con `screens.html` lado a lado.

3. **Si rompió algo:** dile `revierte tu último cambio y trabaja paso a paso` — a veces se entusiasma.

4. **Para los archivos grandes** (appointment-modal.tsx tiene 50KB): pídele que lo divida en sub-componentes ANTES de rediseñar.

5. **Commits atómicos:** un PR por sección, no mezcles tokens con rediseño de pantalla.

---

## 🧪 Cómo validar cada PR

Después de cada cambio:

```bash
# 1. Build sin errores
cd apps/web && npm run build

# 2. Tipos OK
npx tsc --noEmit

# 3. Visual smoke test
npm run dev
# abre las pantallas afectadas, compara con screens.html

# 4. Si tienes Storybook o Playwright, corre los tests
```

---

## 📋 Checklist final

Cuando termines los 9 PRs, verifica:

- [ ] Ningún componente usa `bg-[#xxxxxx]` o `text-[#xxxxxx]` (todo es token)
- [ ] Estado "Confirmada" se ve teal en todas las pantallas
- [ ] Cards usan `rounded-xl` consistentemente (botones `rounded-[10px]`)
- [ ] Sidebar tiene solo wordmark "Siliba", no el cuadrito S
- [ ] Modo oscuro funciona sin colores hardcoded saliéndose
- [ ] Calendario tiene 4 views: Día, Semana, Mes, Registro
- [ ] Personal tiene 5 tabs operativos
- [ ] Servicios e Inventario implementados

---

¿Listo? Empieza por PR 1. Toma ~10 minutos por PR pequeño y ~30-60 min por los grandes.
