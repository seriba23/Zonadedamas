'use client';

import { useState, useRef, useEffect } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface SelectOption {
  id: string;
  label: string;
  sublabel?: string;
  avatarUrl?: string | null;
  color?: string;
  initials?: string;
}

interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  allLabel?: string;
}

export function SearchableSelect({ value, onChange, options, placeholder = 'Buscar...', allLabel = 'Todos' }: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const selected = options.find((o) => o.id === value);
  const filtered = options.filter((o) => !search || o.label.toLowerCase().includes(search.toLowerCase()));

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => { setOpen(!open); setSearch(''); }}
        className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white hover:border-gray-400 transition-colors min-w-[180px] text-left"
      >
        {selected ? (
          <>
            <Avatar option={selected} size={20} />
            <span className="text-gray-900 truncate flex-1">{selected.label}</span>
          </>
        ) : (
          <span className="text-gray-500 flex-1">{allLabel}</span>
        )}
        <svg className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-64 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={placeholder}
              className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#008080]"
              autoFocus
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
            <button
              onClick={() => { onChange(''); setOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-gray-50 transition-colors ${!value ? 'bg-teal-50 text-[#008080] font-medium' : 'text-gray-700'}`}
            >
              {allLabel}
            </button>
            {filtered.map((option) => (
              <button
                key={option.id}
                onClick={() => { onChange(option.id); setOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-gray-50 transition-colors ${value === option.id ? 'bg-teal-50' : ''}`}
              >
                <Avatar option={option} size={24} />
                <div className="flex-1 min-w-0">
                  <p className={`truncate ${value === option.id ? 'text-[#008080] font-medium' : 'text-gray-900'}`}>{option.label}</p>
                  {option.sublabel && <p className="text-[10px] text-gray-400 truncate">{option.sublabel}</p>}
                </div>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-3">Sin resultados</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Avatar({ option, size }: { option: SelectOption; size: number }) {
  const s = `${size}px`;
  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 overflow-hidden"
      style={{ width: s, height: s, fontSize: `${size * 0.4}px`, backgroundColor: option.color || '#008080' }}
    >
      {option.avatarUrl ? (
        <img src={option.avatarUrl.startsWith('http') ? option.avatarUrl : `${API_URL}${option.avatarUrl}`} alt="" className="w-full h-full object-cover" />
      ) : (
        <span>{option.initials || option.label.split(' ').map((w) => w[0]).join('').substring(0, 2).toUpperCase()}</span>
      )}
    </div>
  );
}
