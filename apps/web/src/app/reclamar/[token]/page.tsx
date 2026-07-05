// ─────────────────────────────────────────────────────────────────────────────
// RUTA PÚBLICA: /reclamar/[token]
//
// El cliente abre este enlace (recibido por WhatsApp de un negocio) para ACTIVAR
// o VINCULAR su cuenta real de la plataforma. Los datos (nombre/teléfono) ya
// vienen prellenados desde la ficha del negocio. Si ya existe cuenta con ese
// teléfono/email, se ofrece iniciar sesión para vincular (sin re-registrar).
// ─────────────────────────────────────────────────────────────────────────────
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { marketplaceApi } from '@/lib/marketplace-api';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const TEAL = '#008080';

interface Preview {
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  businessName: string | null;
  alreadyClaimed: boolean;
  existingAccount: boolean;
}

export default function ReclamarPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Formulario
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [identifier, setIdentifier] = useState(''); // login: email o teléfono

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${BASE_URL}/api/marketplace/claim/${token}`);
        if (!res.ok) { setNotFound(true); return; }
        const json = await res.json();
        const p: Preview = json.data;
        setPreview(p);
        setEmail(p.email || '');
        setIdentifier(p.phone || p.email || '');
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  // Registro (no existe cuenta): crea cuenta con datos prellenados + vincula.
  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!preview) return;
    setError(null);
    setSubmitting(true);
    try {
      await marketplaceApi.registerAndStore({
        email,
        password,
        firstName: preview.firstName,
        lastName: preview.lastName,
        phone: preview.phone || undefined,
        claimToken: token,
      });
      setDone(true);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'No se pudo crear la cuenta.');
    } finally {
      setSubmitting(false);
    }
  }

  // Login + vincular (ya existe cuenta): inicia sesión y consume el token.
  async function handleLoginAndLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await marketplaceApi.loginAndStore(identifier, password);
      await marketplaceApi.post(`/claim/${token}`, {});
      setDone(true);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'No se pudo iniciar sesión.');
    } finally {
      setSubmitting(false);
    }
  }

  const Shell = ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#f5f8f7' }}>
      <div className="w-full max-w-sm bg-white rounded-[22px] border p-6" style={{ borderColor: '#e6efec', boxShadow: '0 18px 40px -30px rgba(15,40,36,.25)' }}>
        <p className="text-[22px] font-extrabold tracking-[-0.02em] text-center mb-4" style={{ color: TEAL }}>Siliba</p>
        {children}
      </div>
    </div>
  );

  if (loading) return <Shell><p className="text-center text-sm text-[#7c8d89]">Cargando…</p></Shell>;

  if (notFound || !preview) return (
    <Shell>
      <p className="text-center text-[15px] font-bold text-[#0f1e1c] mb-1">Invitación no válida</p>
      <p className="text-center text-[13px] text-[#7c8d89]">Este enlace ya se usó o no es correcto. Pídele a tu negocio uno nuevo.</p>
    </Shell>
  );

  if (done || preview.alreadyClaimed) return (
    <Shell>
      <div className="w-14 h-14 mx-auto mb-3 rounded-full flex items-center justify-center" style={{ backgroundColor: '#e4f5ee' }}>
        <svg className="w-7 h-7" fill="none" stroke="#0a7d54" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
      </div>
      <p className="text-center text-[16px] font-extrabold text-[#0f1e1c] mb-1">¡Cuenta lista!</p>
      <p className="text-center text-[13px] text-[#7c8d89] mb-4">Tu cuenta quedó vinculada con {preview.businessName || 'tu negocio'}. Ya puedes ver tus citas e historial.</p>
      <a href="/marketplace" className="block text-center py-2.5 rounded-full text-sm font-bold text-white" style={{ backgroundColor: TEAL }}>Ir a mi cuenta</a>
    </Shell>
  );

  return (
    <Shell>
      <p className="text-center text-[16px] font-extrabold text-[#0f1e1c]">Hola, {preview.firstName}</p>
      <p className="text-center text-[13px] text-[#7c8d89] mb-4">
        {preview.existingAccount
          ? <>Ya tienes cuenta en Siliba. Inicia sesión para vincularla con <b>{preview.businessName || 'tu negocio'}</b>.</>
          : <>Activa tu cuenta en Siliba para ver tus citas e historial con <b>{preview.businessName || 'tu negocio'}</b>.</>}
      </p>

      {error && <div className="mb-3 p-2.5 rounded-lg text-xs text-red-700 bg-red-50">{error}</div>}

      {preview.existingAccount ? (
        <form onSubmit={handleLoginAndLink} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-[#5b6e6a] mb-1">Correo o teléfono</label>
            <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} required className="input-field w-full" placeholder="tu@correo.com o teléfono" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#5b6e6a] mb-1">Contraseña</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="input-field w-full" placeholder="Tu contraseña" />
          </div>
          <button type="submit" disabled={submitting} className="w-full py-2.5 rounded-full text-sm font-bold text-white disabled:opacity-50" style={{ backgroundColor: TEAL }}>
            {submitting ? 'Vinculando…' : 'Iniciar sesión y vincular'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleRegister} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-[#5b6e6a] mb-1">Nombre</label>
              <input value={preview.firstName} readOnly className="input-field w-full bg-gray-50" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#5b6e6a] mb-1">Apellido</label>
              <input value={preview.lastName} readOnly className="input-field w-full bg-gray-50" />
            </div>
          </div>
          {preview.phone && (
            <div>
              <label className="block text-xs font-semibold text-[#5b6e6a] mb-1">Teléfono</label>
              <input value={preview.phone} readOnly className="input-field w-full bg-gray-50" />
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-[#5b6e6a] mb-1">Correo</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="input-field w-full" placeholder="tu@correo.com" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#5b6e6a] mb-1">Crea una contraseña</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="input-field w-full" placeholder="Mínimo 6, con número y símbolo" />
          </div>
          <button type="submit" disabled={submitting} className="w-full py-2.5 rounded-full text-sm font-bold text-white disabled:opacity-50" style={{ backgroundColor: TEAL }}>
            {submitting ? 'Activando…' : 'Activar mi cuenta'}
          </button>
        </form>
      )}
    </Shell>
  );
}
