'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

const TEAL = '#008080';
const TEAL_LIGHT = '#e0f2f1';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const MESES_CORTOS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const DIAS_SEMANA = ['Lu','Ma','Mi','Ju','Vi','Sá','Do'];

interface DatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  placeholder?: string;
  maxDate?: Date; // defaults to today
  className?: string;
}

type Vista = 'dias' | 'meses' | 'anios';

export function DatePicker({ value, onChange, placeholder = 'dd/mm/aaaa', maxDate, className }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [vista, setVista] = useState<Vista>('dias');
  const [anio, setAnio] = useState(() => new Date().getFullYear());
  const [mes, setMes] = useState(() => new Date().getMonth());
  const [aniosPagInicio, setAniosPagInicio] = useState(0);
  const [inputText, setInputText] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const max = maxDate || new Date();
  const maxAnio = max.getFullYear();
  const maxMes = max.getMonth();
  const maxDia = max.getDate();

  // Sync input text from value prop
  useEffect(() => {
    if (value) {
      const [y, m, d] = value.split('-');
      if (y && m && d) setInputText(`${d}/${m}/${y}`);
    } else {
      setInputText('');
    }
  }, [value]);

  // Init calendar position from value
  useEffect(() => {
    if (value) {
      const [y, m] = value.split('-').map(Number);
      if (y && m) { setAnio(y); setMes(m - 1); }
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Parse selected date from value
  const selDia = value ? parseInt(value.split('-')[2], 10) : -1;
  const selMes = value ? parseInt(value.split('-')[1], 10) - 1 : -1;
  const selAnio = value ? parseInt(value.split('-')[0], 10) : -1;

  const hoy = new Date();
  const hoyDia = hoy.getDate();
  const hoyMes = hoy.getMonth();
  const hoyAnio = hoy.getFullYear();

  // ─── Input mask ─────────────────────────────────
  const handleInputChange = (raw: string) => {
    let v = raw.replace(/\D/g, '');
    if (v.length > 8) v = v.substring(0, 8);
    if (v.length >= 5) {
      v = v.substring(0, 2) + '/' + v.substring(2, 4) + '/' + v.substring(4);
    } else if (v.length >= 3) {
      v = v.substring(0, 2) + '/' + v.substring(2);
    }
    setInputText(v);

    if (v.length === 10) {
      const [dd, mm, yyyy] = v.split('/');
      const d = parseInt(dd, 10), m = parseInt(mm, 10), y = parseInt(yyyy, 10);
      if (d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 1900 && y <= maxAnio) {
        const iso = `${yyyy}-${mm}-${dd}`;
        onChange(iso);
        setAnio(y);
        setMes(m - 1);
      }
    }
  };

  // ─── Select day ─────────────────────────────────
  const selectDay = (d: number, m: number, y: number) => {
    const dd = String(d).padStart(2, '0');
    const mm = String(m + 1).padStart(2, '0');
    onChange(`${y}-${mm}-${dd}`);
    setOpen(false);
  };

  // ─── Navigation ─────────────────────────────────
  const navPrev = () => {
    if (vista === 'anios') {
      setAniosPagInicio((p) => p - 12);
    } else if (vista === 'meses') {
      setAnio((a) => a - 1);
    } else {
      if (mes === 0) { setMes(11); setAnio((a) => a - 1); }
      else setMes((m) => m - 1);
    }
  };

  const navNext = () => {
    if (vista === 'anios') {
      if (aniosPagInicio + 12 <= maxAnio) setAniosPagInicio((p) => p + 12);
    } else if (vista === 'meses') {
      if (anio < maxAnio) setAnio((a) => a + 1);
    } else {
      if (mes === 11) { setMes(0); setAnio((a) => a + 1); }
      else setMes((m) => m + 1);
    }
  };

  const showNextArrow = vista === 'anios'
    ? aniosPagInicio + 11 < maxAnio
    : vista === 'meses'
      ? anio < maxAnio
      : true;

  // ─── Toggle open ────────────────────────────────
  const toggleOpen = () => {
    if (!open) {
      setVista('dias');
      if (value) {
        const [y, m] = value.split('-').map(Number);
        setAnio(y); setMes(m - 1);
      }
    }
    setOpen(!open);
  };

  // ─── Title click ────────────────────────────────
  const clickMes = () => {
    setVista('meses');
  };
  const clickAnio = () => {
    setAniosPagInicio(anio - 5);
    setVista('anios');
  };

  // ─── Render days ────────────────────────────────
  const renderDias = () => {
    const primerDia = new Date(anio, mes, 1);
    const diasEnMes = new Date(anio, mes + 1, 0).getDate();
    let diaInicio = primerDia.getDay() - 1;
    if (diaInicio < 0) diaInicio = 6;

    const cells: JSX.Element[] = [];

    // Previous month days
    const prevUltimo = new Date(anio, mes, 0).getDate();
    for (let i = diaInicio - 1; i >= 0; i--) {
      const d = prevUltimo - i;
      const mPrev = mes === 0 ? 11 : mes - 1;
      const aPrev = mes === 0 ? anio - 1 : anio;
      cells.push(
        <button key={`p${d}`} type="button" className="zdp-cell zdp-other" onClick={() => selectDay(d, mPrev, aPrev)}>
          {d}
        </button>
      );
    }

    // Current month days
    for (let d = 1; d <= diasEnMes; d++) {
      const isHoy = d === hoyDia && mes === hoyMes && anio === hoyAnio;
      const isSel = d === selDia && mes === selMes && anio === selAnio;
      const isFuture = anio > maxAnio || (anio === maxAnio && mes > maxMes) || (anio === maxAnio && mes === maxMes && d > maxDia);
      cells.push(
        <button
          key={d}
          type="button"
          disabled={isFuture}
          className={`zdp-cell ${isHoy ? 'zdp-today' : ''} ${isSel ? 'zdp-selected' : ''} ${isFuture ? 'zdp-disabled' : ''}`}
          onClick={() => selectDay(d, mes, anio)}
        >
          {d}
        </button>
      );
    }

    // Next month days
    const total = diaInicio + diasEnMes;
    const rest = total % 7 === 0 ? 0 : 7 - (total % 7);
    for (let d = 1; d <= rest; d++) {
      const mNext = mes === 11 ? 0 : mes + 1;
      const aNext = mes === 11 ? anio + 1 : anio;
      cells.push(
        <button key={`n${d}`} type="button" className="zdp-cell zdp-other" onClick={() => selectDay(d, mNext, aNext)}>
          {d}
        </button>
      );
    }

    return cells;
  };

  // ─── Render months ──────────────────────────────
  const renderMeses = () => {
    return MESES_CORTOS.map((label, m) => {
      const isSel = m === mes;
      const isHoy = m === hoyMes && anio === hoyAnio;
      const isFuture = anio === maxAnio && m > maxMes;
      return (
        <button
          key={m}
          type="button"
          disabled={isFuture}
          className={`zdp-grid-item ${isSel ? 'zdp-selected' : ''} ${isHoy ? 'zdp-today' : ''} ${isFuture ? 'zdp-disabled' : ''}`}
          onClick={() => { setMes(m); setVista('dias'); }}
        >
          {label}
        </button>
      );
    });
  };

  // ─── Render years ───────────────────────────────
  const renderAnios = () => {
    const items: JSX.Element[] = [];
    for (let a = aniosPagInicio; a <= aniosPagInicio + 11; a++) {
      const isSel = a === anio;
      const isHoy = a === hoyAnio;
      const isFuture = a > maxAnio;
      items.push(
        <button
          key={a}
          type="button"
          disabled={isFuture}
          className={`zdp-grid-item ${isSel ? 'zdp-selected' : ''} ${isHoy ? 'zdp-today' : ''} ${isFuture ? 'zdp-disabled' : ''}`}
          onClick={() => { setAnio(a); setVista('meses'); }}
        >
          {a}
        </button>
      );
    }
    return items;
  };

  // ─── Title text ─────────────────────────────────
  const tituloMes = vista === 'dias' ? MESES[mes] : vista === 'meses' ? '' : '';
  const tituloAnio = vista === 'dias' ? anio : vista === 'meses' ? anio : '';
  const tituloRango = vista === 'anios' ? `${aniosPagInicio} - ${Math.min(aniosPagInicio + 11, maxAnio)}` : '';

  return (
    <div ref={containerRef} className="relative">
      {/* Input */}
      <div className="relative">
        <input
          type="text"
          value={inputText}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder={placeholder}
          maxLength={10}
          className={`w-full px-3 py-2.5 pr-10 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:outline-none ${className || ''}`}
          style={{ '--tw-ring-color': TEAL } as any}
        />
        <button
          type="button"
          onClick={toggleOpen}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-gray-400 hover:text-[#008080] hover:bg-[#e0f2f1] transition-colors"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
        </button>
      </div>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
        >
        <div
          className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 w-[280px] max-w-full"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-2.5">
            <button type="button" onClick={navPrev} className="px-2 py-1 rounded text-lg font-bold hover:bg-[#e0f2f1] transition-colors" style={{ color: TEAL }}>
              ‹
            </button>
            <span className="text-sm font-extrabold text-gray-900">
              {tituloRango || (
                <>
                  <span className="cursor-pointer border-b border-dashed border-gray-400 hover:text-[#008080] hover:border-[#008080] transition-colors" onClick={clickMes}>
                    {tituloMes}
                  </span>
                  {tituloMes && ' '}
                  <span className="cursor-pointer border-b border-dashed border-gray-400 hover:text-[#008080] hover:border-[#008080] transition-colors" onClick={clickAnio}>
                    {tituloAnio}
                  </span>
                </>
              )}
            </span>
            <button
              type="button"
              onClick={navNext}
              className="px-2 py-1 rounded text-lg font-bold hover:bg-[#e0f2f1] transition-colors"
              style={{ color: TEAL, visibility: showNextArrow ? 'visible' : 'hidden' }}
            >
              ›
            </button>
          </div>

          {/* Days view */}
          {vista === 'dias' && (
            <>
              <div className="grid grid-cols-7 text-center text-[11px] font-bold text-gray-400 mb-1">
                {DIAS_SEMANA.map((d) => <span key={d}>{d}</span>)}
              </div>
              <div className="grid grid-cols-7 gap-0.5">
                {renderDias()}
              </div>
            </>
          )}

          {/* Months view */}
          {vista === 'meses' && (
            <div className="grid grid-cols-3 gap-1">
              {renderMeses()}
            </div>
          )}

          {/* Years view */}
          {vista === 'anios' && (
            <div className="grid grid-cols-3 gap-1">
              {renderAnios()}
            </div>
          )}

          {/* Footer */}
          {vista === 'dias' && (
            <div className="flex justify-between mt-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                className="text-xs font-bold px-2.5 py-1 rounded hover:bg-[#e0f2f1] transition-colors"
                style={{ color: TEAL }}
                onClick={() => selectDay(hoyDia, hoyMes, hoyAnio)}
              >
                Hoy
              </button>
              <button
                type="button"
                className="text-xs font-bold text-gray-400 px-2.5 py-1 rounded hover:bg-gray-100 transition-colors"
                onClick={() => { onChange(''); setOpen(false); }}
              >
                Limpiar
              </button>
            </div>
          )}
        </div>
        </div>
      )}

      {/* eslint-disable-next-line react/no-danger */}
      <style dangerouslySetInnerHTML={{ __html: `
        .zdp-cell {
          aspect-ratio: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          font-size: 13px;
          cursor: pointer;
          border: none;
          background: none;
          transition: all 0.12s;
        }
        .zdp-cell:hover:not(.zdp-disabled):not(.zdp-selected) { background: rgba(0,128,128,.1); }
        .zdp-today { border: 2px solid ${TEAL}; font-weight: 700; }
        .zdp-selected { background: ${TEAL} !important; color: #fff !important; font-weight: 700; }
        .zdp-other { color: #cbd5e1; }
        .zdp-other:hover:not(.zdp-disabled) { color: #94a3b8; background: rgba(0,128,128,.06); }
        .zdp-disabled { color: #cbd5e1; cursor: not-allowed; }
        .zdp-grid-item {
          padding: 10px 4px;
          border: none;
          background: none;
          border-radius: 6px;
          font-size: 14px;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.12s;
        }
        .zdp-grid-item:hover:not(.zdp-disabled):not(.zdp-selected) { background: rgba(0,128,128,.1); }
        .zdp-grid-item.zdp-today { border: 2px solid ${TEAL}; font-weight: 700; }
        .zdp-grid-item.zdp-selected { background: ${TEAL}; color: #fff; font-weight: 700; }
        .zdp-grid-item.zdp-disabled { color: #cbd5e1; cursor: not-allowed; }
      `}} />
    </div>
  );
}
