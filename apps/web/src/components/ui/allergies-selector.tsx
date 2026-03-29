'use client';

const TEAL = '#008080';
const TEAL_LIGHT = '#e0f2f1';

const PRESET_ALLERGIES = [
  'Látex',
  'Fragancias y perfumes',
  'Colorantes y tintes',
  'Productos químicos',
  'Polen',
  'Metales (níquel)',
  'Piel sensible',
];

interface AllergiesSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

function parseAllergies(value: string): { selected: string[]; other: string } {
  const parts = value.split(',').map((s) => s.trim()).filter(Boolean);
  const selected = parts.filter((p) => PRESET_ALLERGIES.includes(p));
  const otherParts = parts.filter((p) => !PRESET_ALLERGIES.includes(p));
  return { selected, other: otherParts.join(', ') };
}

function buildAllergiesString(selected: string[], other: string): string {
  const parts = [...selected];
  if (other.trim()) parts.push(other.trim());
  return parts.join(', ');
}

export function AllergiesSelector({ value, onChange }: AllergiesSelectorProps) {
  const { selected, other } = parseAllergies(value);

  const toggle = (item: string) => {
    const newSelected = selected.includes(item)
      ? selected.filter((s) => s !== item)
      : [...selected, item];
    onChange(buildAllergiesString(newSelected, other));
  };

  const handleOther = (text: string) => {
    onChange(buildAllergiesString(selected, text));
  };

  const showOther = selected.length > 0 || other.length > 0 || value.length > 0;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {PRESET_ALLERGIES.map((item) => {
          const active = selected.includes(item);
          return (
            <button
              key={item}
              type="button"
              onClick={() => toggle(item)}
              className="px-3 py-1.5 rounded-full text-xs font-medium border transition-colors"
              style={active
                ? { backgroundColor: TEAL, color: 'white', borderColor: TEAL }
                : { backgroundColor: 'white', color: '#6b7280', borderColor: '#e5e7eb' }}
            >
              {item}
            </button>
          );
        })}
      </div>
      <input
        type="text"
        value={other}
        onChange={(e) => handleOther(e.target.value)}
        placeholder="Otros (especifica aquí si aplica)"
        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:outline-none"
        style={{ '--tw-ring-color': TEAL } as any}
      />
    </div>
  );
}
