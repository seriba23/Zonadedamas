'use client';

import { useState, useEffect, useCallback } from 'react';

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
const FACEBOOK_APP_ID = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID || '';

interface SocialLoginButtonsProps {
  onSocialLogin: (provider: 'google' | 'facebook', token: string) => Promise<void>;
  disabled?: boolean;
}

// Detect Capacitor native platform safely (SSR-safe)
function isNativePlatform(): boolean {
  try {
    const { Capacitor } = require('@capacitor/core');
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export function SocialLoginButtons({ onSocialLogin, disabled }: SocialLoginButtonsProps) {
  const [loading, setLoading] = useState<'google' | 'facebook' | null>(null);
  const [sdkReady, setSdkReady] = useState({ google: false, facebook: false });
  const [error, setError] = useState('');
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    setIsNative(isNativePlatform());
  }, []);

  // Load Google Identity Services SDK (web only)
  useEffect(() => {
    if (isNative || !GOOGLE_CLIENT_ID || document.getElementById('google-gsi-script')) return;

    const script = document.createElement('script');
    script.id = 'google-gsi-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => setSdkReady((prev) => ({ ...prev, google: true }));
    document.head.appendChild(script);
  }, [isNative]);

  // Initialize Google credential callback (web only)
  useEffect(() => {
    if (isNative || !GOOGLE_CLIENT_ID || !sdkReady.google) return;
    const google = (window as any).google;
    if (!google?.accounts?.id) return;

    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: async (response: any) => {
        if (response.credential) {
          setLoading('google');
          setError('');
          try {
            await onSocialLogin('google', response.credential);
          } catch {
            // error handled by parent
          } finally {
            setLoading(null);
          }
        }
      },
    });
  }, [isNative, sdkReady.google, onSocialLogin]);

  // Load Facebook SDK (web only)
  useEffect(() => {
    if (isNative || !FACEBOOK_APP_ID || document.getElementById('facebook-jssdk')) return;

    (window as any).fbAsyncInit = function () {
      (window as any).FB.init({
        appId: FACEBOOK_APP_ID,
        cookie: true,
        xfbml: false,
        version: 'v19.0',
      });
      setSdkReady((prev) => ({ ...prev, facebook: true }));
    };

    const script = document.createElement('script');
    script.id = 'facebook-jssdk';
    script.src = 'https://connect.facebook.net/es_LA/sdk.js';
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  }, [isNative]);

  // ── Google Sign-In (native Android via plugin) ──
  const handleGoogleNative = useCallback(async () => {
    if (loading || disabled) return;
    if (!GOOGLE_CLIENT_ID) {
      setError('Google Sign-In no está configurado');
      return;
    }
    setLoading('google');
    setError('');
    try {
      const { GoogleAuth } = await import('@codetrix-studio/capacitor-google-auth');
      await GoogleAuth.initialize({ clientId: GOOGLE_CLIENT_ID, scopes: ['profile', 'email'], grantOfflineAccess: true });
      const result = await GoogleAuth.signIn();
      const idToken = result.authentication?.idToken;
      if (!idToken) throw new Error('No se obtuvo token de Google');
      await onSocialLogin('google', idToken);
    } catch (err: any) {
      if (err?.message !== 'The user canceled the sign-in flow.') {
        setError(err?.message || 'Error al iniciar sesión con Google');
      }
    } finally {
      setLoading(null);
    }
  }, [loading, disabled, onSocialLogin]);

  // ── Google Sign-In (web browser via GIS SDK) ──
  const handleGoogleWeb = useCallback(() => {
    if (loading || disabled) return;
    if (!GOOGLE_CLIENT_ID) {
      setError('Google Sign-In no está configurado todavía');
      return;
    }
    const google = (window as any).google;
    if (!google?.accounts?.id) return;

    setError('');
    google.accounts.id.prompt((notification: any) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        const btn = document.getElementById('google-signin-fallback');
        if (btn) {
          google.accounts.id.renderButton(btn, { type: 'standard', size: 'large', width: 320 });
          btn.querySelector('div[role="button"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        }
      }
    });
  }, [loading, disabled]);

  const handleGoogle = isNative ? handleGoogleNative : handleGoogleWeb;

  // ── Facebook Sign-In ──
  const handleFacebook = useCallback(async () => {
    if (loading || disabled) return;
    if (!FACEBOOK_APP_ID) {
      setError('Facebook Login no está configurado todavía');
      return;
    }
    if (!isNative && window.location.protocol !== 'https:') {
      setError('Facebook requiere HTTPS. Disponible próximamente.');
      return;
    }
    setLoading('facebook');
    setError('');

    try {
      const FB = (window as any).FB;
      if (!FB) throw new Error('Facebook SDK no disponible');

      FB.login(
        async (response: any) => {
          if (response.authResponse) {
            try {
              await onSocialLogin('facebook', response.authResponse.accessToken);
            } catch {
              // error handled by parent
            }
          }
          setLoading(null);
        },
        { scope: 'email,public_profile' },
      );
    } catch {
      setLoading(null);
    }
  }, [loading, disabled, isNative, onSocialLogin]);

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={handleGoogle}
        disabled={disabled || loading !== null}
        className="w-full flex items-center justify-center gap-3 px-4 py-2 bg-white border border-gray-300 rounded-lg text-base font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
      >
        {loading === 'google' ? (
          <svg className="animate-spin h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
        )}
        Continuar con Google
      </button>

      <button
        type="button"
        onClick={handleFacebook}
        disabled={disabled || loading !== null}
        className="w-full flex items-center justify-center gap-3 px-4 py-2 bg-[#1877F2] border border-[#1877F2] rounded-lg text-base font-medium text-white hover:bg-[#166FE5] disabled:opacity-50 transition-colors"
      >
        {loading === 'facebook' ? (
          <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
        )}
        Continuar con Facebook
      </button>

      {error && (
        <p className="text-xs text-amber-600 text-center">{error}</p>
      )}

      {/* Hidden fallback container for Google button (web only) */}
      {!isNative && <div id="google-signin-fallback" className="hidden" />}

      <div className="relative my-3 md:my-4">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-white px-3 text-gray-400">o con tu email</span>
        </div>
      </div>
    </div>
  );
}
