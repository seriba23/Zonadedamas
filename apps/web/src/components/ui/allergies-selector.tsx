'use client';
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ allergies-selector.tsx                                                  │
// │                                                                         │
// │ ¿QUÉ HACE ESTE COMPONENTE?                                              │
// │ Muestra un selector de alergias con dos partes:                         │
// │  1. Pastillas (chips) para alergias comunes: el usuario las activa o    │
// │     desactiva con un click (toggle).                                    │
// │  2. Un campo de texto libre para escribir otras alergias no listadas.   │
// │                                                                         │
// │ Todo el valor se almacena como un string único separado por comas, por  │
// │ ejemplo: "Látex, Fragancias y perfumes, Polen, Mis alergias propias"    │
// │                                                                         │
// │ Es un componente CONTROLADO: no tiene estado propio. Recibe "value"     │
// │ del padre y llama "onChange" para notificar cambios. El padre decide    │
// │ dónde guardar el string final.                                          │
// └─────────────────────────────────────────────────────────────────────────┘

// Colores de la identidad visual: teal (#008080) y su versión clara
const TEAL = '#008080';
const TEAL_LIGHT = '#e0f2f1';

// ─── LISTA DE ALERGIAS PREDEFINIDAS ──────────────────────────────────────────
// Estas son las alergias más comunes en el contexto de belleza/wellness.
// Aparecerán como botones tipo "chip" o "pastilla" que el usuario puede
// activar o desactivar con un click.
const PRESET_ALLERGIES = [
  'Látex',
  'Fragancias y perfumes',
  'Colorantes y tintes',
  'Productos químicos',
  'Polen',
  'Metales (níquel)',
  'Piel sensible',
];

// ─── INTERFAZ DE PROPS ───────────────────────────────────────────────────────
interface AllergiesSelectorProps {
  value: string;                    // String completo de alergias separadas por coma
  onChange: (value: string) => void; // Función para notificar al padre del nuevo string
}

// ─── FUNCIÓN AUXILIAR: parseAllergies ────────────────────────────────────────
// Convierte el string "Látex, Polen, Mis alergias" en dos partes:
//   selected: las alergias que están en PRESET_ALLERGIES
//   other: el texto libre que no es un preset conocido
//
// Ejemplo:
//   input: "Látex, Polen, Tengo alergia al kiwi"
//   output: { selected: ["Látex", "Polen"], other: "Tengo alergia al kiwi" }
function parseAllergies(value: string): { selected: string[]; other: string } {
  // .split(',') → separa "Látex, Polen" en ["Látex", " Polen"]
  // .map(s => s.trim()) → elimina espacios de cada parte: ["Látex", "Polen"]
  // .filter(Boolean) → elimina strings vacíos que podrían quedar de "Látex,,"
  const parts = value.split(',').map((s) => s.trim()).filter(Boolean);

  // .filter(p => PRESET_ALLERGIES.includes(p)) → solo los que están en nuestra lista
  const selected = parts.filter((p) => PRESET_ALLERGIES.includes(p));

  // Los que NO están en la lista van al campo libre
  const otherParts = parts.filter((p) => !PRESET_ALLERGIES.includes(p));

  // Reunimos los extras en un string separado por coma
  return { selected, other: otherParts.join(', ') };
}

// ─── FUNCIÓN AUXILIAR: buildAllergiesString ───────────────────────────────────
// Hace lo contrario: toma las alergias seleccionadas + el texto libre
// y los une en un único string separado por comas.
//
// Ejemplo:
//   selected: ["Látex", "Polen"], other: "Alergia al kiwi"
//   output: "Látex, Polen, Alergia al kiwi"
function buildAllergiesString(selected: string[], other: string): string {
  // Copiamos el array de seleccionadas con spread [...selected]
  // (para no mutar el array original)
  const parts = [...selected];

  // Si hay texto en el campo libre, lo añadimos al final
  if (other.trim()) parts.push(other.trim());

  // Unimos todo con ", " y devolvemos el string final
  return parts.join(', ');
}

// ─── COMPONENTE PRINCIPAL ────────────────────────────────────────────────────
// Desestructuramos las dos props: value (string actual) y onChange (callback)
export function AllergiesSelector({ value, onChange }: AllergiesSelectorProps) {
  // Cada vez que el componente renderiza, parseamos el value para saber
  // qué está seleccionado y qué está en el campo libre.
  // No usamos useState porque dependemos 100% del value del padre.
  const { selected, other } = parseAllergies(value);

  // ─── MANEJADOR: toggle de una alergia predefinida ──────────────────────────
  // item: el nombre de la alergia que se clickeó (ej. "Látex")
  const toggle = (item: string) => {
    // Creamos el nuevo array de seleccionadas:
    const newSelected = selected.includes(item)
      ? selected.filter((s) => s !== item)  // Si ya estaba: la quitamos
      : [...selected, item];                 // Si no estaba: la añadimos

    // Construimos el nuevo string completo y notificamos al padre
    onChange(buildAllergiesString(newSelected, other));
  };

  // ─── MANEJADOR: cambio en el campo de texto libre ─────────────────────────
  // text: lo que el usuario escribe en el input
  const handleOther = (text: string) => {
    // Mantenemos las seleccionadas actuales y reemplazamos el texto libre
    onChange(buildAllergiesString(selected, text));
  };

  // ─── VISIBILIDAD DEL CAMPO LIBRE ─────────────────────────────────────────
  // Mostramos el input de texto cuando hay al menos alguna interacción:
  // alguna chip seleccionada, texto libre previo, o cualquier valor en value.
  // Nota: en la práctica siempre se muestra porque showOptional = true por defecto
  const showOther = selected.length > 0 || other.length > 0 || value.length > 0;
  // (La variable showOther está calculada pero el input siempre se muestra abajo,
  // porque no hay un condicional que lo oculte. Es una referencia preparada por si
  // en el futuro se quiere usar.)

  // ─── JSX PRINCIPAL ────────────────────────────────────────────────────────
  return (
    // space-y-2: espacio vertical de 8px entre hijos directos
    <div className="space-y-2">
      {/* Contenedor de chips / pastillas */}
      {/* flex flex-wrap gap-2: las pastillas se distribuyen en fila y bajan
          a la siguiente línea si no caben */}
      <div className="flex flex-wrap gap-2">
        {/* RENDERIZADO DE LISTA: .map() genera un botón por cada alergia predefinida */}
        {PRESET_ALLERGIES.map((item) => {
          // Verificamos si esta alergia está actualmente seleccionada
          // .includes() devuelve true si el item está en el array selected
          const active = selected.includes(item);

          return (
            // key={item}: clave única requerida por React en listas
            <button
              key={item}
              type="button"
              onClick={() => toggle(item)} // Al clickear, activamos/desactivamos
              className="px-3 py-1.5 rounded-full text-xs font-medium border transition-colors"
              // Estilo dinámico usando ternario:
              // Si active → fondo teal, texto blanco, borde teal
              // Si no → fondo blanco, texto gris, borde gris claro
              style={active
                ? { backgroundColor: TEAL, color: 'white', borderColor: TEAL }
                : { backgroundColor: 'white', color: '#6b7280', borderColor: '#e5e7eb' }}
            >
              {item}
              {/* Muestra el nombre de la alergia (ej. "Látex") */}
            </button>
          );
        })}
      </div>

      {/* Campo de texto libre para alergias no listadas */}
      <input
        type="text"
        value={other} // Solo mostramos la parte "libre" (sin los presets)
        onChange={(e) => handleOther(e.target.value)}
        placeholder="Otros (especifica aquí si aplica)"
        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:outline-none"
        // "as any" le dice a TypeScript que ignore que --tw-ring-color no es
        // una propiedad CSS estándar (es una variable propia de Tailwind)
        style={{ '--tw-ring-color': TEAL } as any}
      />
    </div>
  );
}
