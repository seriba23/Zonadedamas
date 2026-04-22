'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

type Tab = 'register' | 'history';

export default function EmployeeAttendancePage() {
  const [activeTab, setActiveTab] = useState<Tab>('register');

  return (
    <div className="flex flex-col h-full">
      {/* Sub menu */}
      <div className="border-b border-gray-200 px-6 flex items-center gap-6">
        {([
          { key: 'register' as Tab, label: 'Registrar' },
          { key: 'history' as Tab, label: 'Historial de registros' },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-[#008080] text-[#008080]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'register' && <RegisterTab />}
        {activeTab === 'history' && <HistoryTab />}
      </div>
    </div>
  );
}

function RegisterTab() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [outOfRangeInfo, setOutOfRangeInfo] = useState<{ distance: number; type: 'in' | 'out'; coords: { latitude: number; longitude: number } } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['my-attendance-today'],
    queryFn: () => api.get<{ data: any }>('/api/attendance/me/today'),
    refetchInterval: 30000,
  });

  const record = data?.data || null;
  const hasCheckedIn = !!record?.checkInTime;
  const hasCheckedOut = !!record?.checkOutTime;

  const checkInMutation = useMutation({
    mutationFn: (body: { latitude: number; longitude: number; forceOutOfRange?: boolean }) =>
      api.post('/api/attendance/check-in', body),
    onSuccess: () => { setError(null); setOutOfRangeInfo(null); queryClient.invalidateQueries({ queryKey: ['my-attendance-today'] }); },
    onError: (err: any) => handleError(err, 'in'),
  });

  const checkOutMutation = useMutation({
    mutationFn: (body: { latitude: number; longitude: number; forceOutOfRange?: boolean }) =>
      api.post('/api/attendance/check-out', body),
    onSuccess: () => { setError(null); setOutOfRangeInfo(null); queryClient.invalidateQueries({ queryKey: ['my-attendance-today'] }); },
    onError: (err: any) => handleError(err, 'out'),
  });

  let lastCoords: { latitude: number; longitude: number } | null = null;

  function handleError(err: any, type: 'in' | 'out') {
    try {
      const parsed = JSON.parse(err.message);
      if (parsed.code === 'OUT_OF_RANGE') {
        setOutOfRangeInfo({ distance: parsed.distance, type, coords: lastCoords! });
        setError(`Estás a ${parsed.distance}m del negocio (máximo ${parsed.allowedRadius}m).`);
        return;
      }
    } catch {}
    setError(err.message || 'Error al registrar');
  }

  function handleAction(type: 'in' | 'out') {
    setError(null); setOutOfRangeInfo(null); setGeoLoading(true);
    if (!navigator.geolocation) { setError('Tu navegador no soporta geolocalización.'); setGeoLoading(false); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoLoading(false);
        const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        lastCoords = coords;
        if (type === 'in') checkInMutation.mutate(coords); else checkOutMutation.mutate(coords);
      },
      (err) => {
        setGeoLoading(false);
        setError(err.code === err.PERMISSION_DENIED ? 'Debes permitir el acceso a tu ubicación.' : 'No se pudo obtener tu ubicación.');
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  function handleForceRegister() {
    if (!outOfRangeInfo) return;
    const { type, coords } = outOfRangeInfo;
    if (type === 'in') checkInMutation.mutate({ ...coords, forceOutOfRange: true });
    else checkOutMutation.mutate({ ...coords, forceOutOfRange: true });
  }

  const now = new Date();
  const timeStr = now.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });
  const isPending = geoLoading || checkInMutation.isPending || checkOutMutation.isPending;

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 py-10">
      <p className="text-5xl font-bold text-gray-900 tabular-nums mb-1">{timeStr}</p>
      <p className="text-sm text-gray-400 capitalize mb-8">{dateStr}</p>

      <div className="w-full max-w-sm bg-white rounded-2xl border border-gray-200 shadow-sm p-6 text-center">
        {isLoading ? (
          <div className="h-24 animate-pulse bg-gray-100 rounded-xl" />
        ) : hasCheckedOut ? (
          <>
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-50 flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            </div>
            <p className="text-sm font-semibold text-gray-900 mb-1">Turno completado</p>
            {record.status === 'PENDING_REVIEW' && <p className="text-xs text-teal-700 bg-teal-50 rounded-lg px-2 py-1 inline-block mb-2">Pendiente de revisión por admin</p>}
            <div className="flex justify-center gap-6 text-xs text-gray-500 mt-3">
              <div><p className="text-gray-400">Entrada</p><p className="font-mono font-medium text-gray-700">{new Date(record.checkInTime).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</p></div>
              <div><p className="text-gray-400">Salida</p><p className="font-mono font-medium text-gray-700">{new Date(record.checkOutTime).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</p></div>
              <div>
                <p className="text-gray-400">Duración</p>
                <p className="font-mono font-medium text-gray-700">
                  {(() => { const mins = Math.round((new Date(record.checkOutTime).getTime() - new Date(record.checkInTime).getTime()) / 60000); return mins < 60 ? `${mins}min` : `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, '0')}`; })()}
                </p>
              </div>
            </div>
          </>
        ) : hasCheckedIn ? (
          <>
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-teal-50 flex items-center justify-center"><div className="w-3 h-3 rounded-full bg-[#008080] animate-pulse" /></div>
            <p className="text-sm font-semibold text-gray-900 mb-1">En turno</p>
            {record.status === 'PENDING_REVIEW' && <p className="text-xs text-teal-700 bg-teal-50 rounded-lg px-2 py-1 inline-block mb-2">Pendiente de revisión</p>}
            <p className="text-xs text-gray-400 mb-4">Entrada: {new Date(record.checkInTime).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</p>
            <button onClick={() => handleAction('out')} disabled={isPending} className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-50 bg-red-600 hover:bg-red-700">
              {isPending ? 'Obteniendo ubicación...' : 'Registrar salida'}
            </button>
          </>
        ) : (
          <>
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-50 flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <p className="text-sm text-gray-500 mb-4">Aún no has registrado tu entrada hoy.</p>
            <button onClick={() => handleAction('in')} disabled={isPending} className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-50" style={{ backgroundColor: '#008080' }}>
              {isPending ? 'Obteniendo ubicación...' : 'Registrar entrada'}
            </button>
          </>
        )}

        {error && !outOfRangeInfo && <div className="mt-4 px-3 py-2 rounded-lg bg-red-50 border border-red-200"><p className="text-xs text-red-700">{error}</p></div>}
        {outOfRangeInfo && (
          <div className="mt-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-center">
            <p className="text-xs text-red-700 mb-3">No estás dentro del rango, te encuentras a <span className="font-bold">{outOfRangeInfo.distance}m</span>. ¿Deseas enviar tu registro de todos modos? El administrador revisará el registro.</p>
            <button onClick={handleForceRegister} disabled={isPending} className="w-full py-2.5 rounded-xl text-xs font-medium bg-gray-100 border border-gray-200 text-gray-700 hover:bg-gray-200 disabled:opacity-50 transition-colors">
              {isPending ? 'Enviando...' : 'Enviar a revisión'}
            </button>
          </div>
        )}
      </div>

      <p className="text-[10px] text-gray-300 mt-6 text-center max-w-xs">Tu ubicación se valida para confirmar que estás en el lugar de trabajo.</p>
    </div>
  );
}

function HistoryTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['my-attendance-history'],
    queryFn: () => api.get<{ data: any[] }>('/api/attendance/me/history'),
  });

  const records = data?.data || [];

  return (
    <div className="p-6 max-w-lg mx-auto pb-24 lg:pb-6">
      <p className="text-sm text-gray-500 mb-4">Tu historial de asistencia de los últimos 30 días.</p>

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      ) : records.length === 0 ? (
        <p className="text-center text-sm text-gray-400 py-12">Sin registros de asistencia</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {records.map((r: any) => {
            const checkIn = r.checkInTime ? new Date(r.checkInTime).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) : '—';
            const checkOut = r.checkOutTime ? new Date(r.checkOutTime).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) : '—';
            const totalMin = r.checkInTime && r.checkOutTime ? Math.round((new Date(r.checkOutTime).getTime() - new Date(r.checkInTime).getTime()) / 60000) : null;
            const duration = totalMin != null ? (totalMin < 60 ? `${totalMin}min` : `${Math.floor(totalMin / 60)}:${String(totalMin % 60).padStart(2, '0')}`) : '—';

            const statusInfo: Record<string, { label: string; color: string }> = {
              APPROVED: { label: 'Aprobado', color: 'text-green-600 bg-green-50' },
              PENDING_REVIEW: { label: 'En revisión', color: 'text-teal-700 bg-teal-50' },
              REJECTED: { label: 'Rechazado', color: 'text-red-600 bg-red-50' },
            };
            const st = statusInfo[r.status] || statusInfo.APPROVED;

            return (
              <div key={r.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900 capitalize">
                    {new Date(r.date).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'short' })}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{checkIn} — {checkOut}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-mono font-medium text-gray-700">{duration}</span>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${st.color}`}>{st.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
