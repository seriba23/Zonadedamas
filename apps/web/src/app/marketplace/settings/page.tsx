// ============================================================
// ARCHIVO: apps/web/src/app/marketplace/settings/page.tsx
// ROL: Página de configuración del usuario en el marketplace.
//
// ¿Qué muestra?
//   1. Sección "Búsqueda": selector de radio de búsqueda en km.
//   2. Sección "Cuenta": links a Editar perfil, Tomar un respiro,
//      Eliminar mi cuenta.
//   3. Sección "Ayuda y Legal": links a Centro de Ayuda,
//      Aviso de Privacidad, Términos y Condiciones.
//   4. Botón flotante "Guardar configuración" (solo aparece si hay cambios).
//   5. Modales: Tomar un respiro (suspender cuenta), Eliminar cuenta,
//      y confirmación de suspensión exitosa.
//
// Componentes auxiliares definidos en este archivo:
//   - ContactChangeForm: formulario inline para cambiar email o teléfono.
//   - EditProfilePanel: panel expandible para editar nombre, foto, fechas, etc.
//     (Nota: en V2 este panel fue separado a su propia página /settings/edit-profile)
//
// Notas de diseño:
//   - Las notificaciones fueron removidas en V1 (los toggles no tenían efecto real).
//   - El selector de país fue eliminado de esta página; ahora vive en Editar Perfil.
//   - La moneda se deriva automáticamente del país de la dirección.
// ============================================================

// 'use client': usa hooks de React y Next.js.
'use client';

// useState: estado local para los campos del formulario y visibilidad de modales.
// useEffect: para cargar los datos del usuario en el formulario al montar.
// useMemo: para calcular la etiqueta de la moneda local sin re-ejecutar en cada render.
// useRef: referencia a elementos del DOM (campo de archivo para el avatar).
import { useState, useEffect, useMemo, useRef } from 'react';

// useRouter: para navegar a otras páginas.
import { useRouter } from 'next/navigation';

// useMutation: para las operaciones de escritura (guardar config, suspender, eliminar).
import { useMutation } from '@tanstack/react-query';

// useMarketplaceAuth: contexto de auth del marketplace.
import { useMarketplaceAuth } from '@/lib/hooks/use-marketplace-auth';

// marketplaceApi: cliente HTTP del marketplace.
import { marketplaceApi } from '@/lib/marketplace-api';

// resolveImageUrl: convierte rutas relativas de imágenes en URLs absolutas.
import { resolveImageUrl } from '@/lib/utils';

// SuccessPopup: modal de éxito con ícono de check y botón "Aceptar".
import { SuccessPopup } from '@/components/ui/success-popup';

import { SectionHelp } from '@/components/ui/section-help';

// AvatarCropModal: modal para recortar la imagen de avatar antes de subirla.
import { AvatarCropModal } from '@/components/ui/avatar-crop-modal';

// DatePicker: selector de fecha personalizado con soporte para español.
import { DatePicker } from '@/components/ui/date-picker';

// ─── Constantes de color ──────────────────────────────────────────────
const TEAL = '#008080';
const TEAL_DARK = '#006666';
const TEAL_LIGHT = '#e0f2f1';

// ─── Lista de países del mundo ─────────────────────────────────────────
// Array de objetos, cada uno con:
//   code: código ISO Alpha-2 del país (ej: 'MX', 'US').
//   label: nombre nativo del país (ej: 'México', 'Deutschland').
//   currency: nombre de la moneda en inglés (ej: 'Peso Mexicano').
//   currencyCode: código ISO 4217 de la moneda (ej: 'MXN', 'USD').
// .sort((a, b) => a.label.localeCompare(b.label)):
//   ordena el array alfabéticamente por label.
//   localeCompare: comparación de strings respetando caracteres especiales (ü, ñ, etc.).
// All countries with native names, sorted alphabetically by native name
const COUNTRIES: { code: string; label: string; currency: string; currencyCode: string }[] = [
  { code: 'AF', label: 'افغانستان', currency: 'Afghani', currencyCode: 'AFN' },
  { code: 'AL', label: 'Shqipëria', currency: 'Lek', currencyCode: 'ALL' },
  { code: 'DE', label: 'Deutschland', currency: 'Euro', currencyCode: 'EUR' },
  { code: 'AD', label: 'Andorra', currency: 'Euro', currencyCode: 'EUR' },
  { code: 'AO', label: 'Angola', currency: 'Kwanza', currencyCode: 'AOA' },
  { code: 'AG', label: 'Antigua and Barbuda', currency: 'East Caribbean Dollar', currencyCode: 'XCD' },
  { code: 'SA', label: 'المملكة العربية السعودية', currency: 'Riyal', currencyCode: 'SAR' },
  { code: 'DZ', label: 'الجزائر', currency: 'Dinar', currencyCode: 'DZD' },
  { code: 'AR', label: 'Argentina', currency: 'Peso Argentino', currencyCode: 'ARS' },
  { code: 'AM', label: 'Հայաստան', currency: 'Dram', currencyCode: 'AMD' },
  { code: 'AU', label: 'Australia', currency: 'Australian Dollar', currencyCode: 'AUD' },
  { code: 'AT', label: 'Österreich', currency: 'Euro', currencyCode: 'EUR' },
  { code: 'AZ', label: 'Azərbaycan', currency: 'Manat', currencyCode: 'AZN' },
  { code: 'BS', label: 'Bahamas', currency: 'Bahamian Dollar', currencyCode: 'BSD' },
  { code: 'BD', label: 'বাংলাদেশ', currency: 'Taka', currencyCode: 'BDT' },
  { code: 'BB', label: 'Barbados', currency: 'Barbados Dollar', currencyCode: 'BBD' },
  { code: 'BH', label: 'البحرين', currency: 'Dinar', currencyCode: 'BHD' },
  { code: 'BE', label: 'België', currency: 'Euro', currencyCode: 'EUR' },
  { code: 'BZ', label: 'Belize', currency: 'Belize Dollar', currencyCode: 'BZD' },
  { code: 'BJ', label: 'Bénin', currency: 'Franc CFA', currencyCode: 'XOF' },
  { code: 'BY', label: 'Беларусь', currency: 'Ruble', currencyCode: 'BYN' },
  { code: 'MM', label: 'မြန်မာ', currency: 'Kyat', currencyCode: 'MMK' },
  { code: 'BO', label: 'Bolivia', currency: 'Boliviano', currencyCode: 'BOB' },
  { code: 'BA', label: 'Bosna i Hercegovina', currency: 'Convertible Mark', currencyCode: 'BAM' },
  { code: 'BW', label: 'Botswana', currency: 'Pula', currencyCode: 'BWP' },
  { code: 'BR', label: 'Brasil', currency: 'Real', currencyCode: 'BRL' },
  { code: 'BN', label: 'Brunei', currency: 'Brunei Dollar', currencyCode: 'BND' },
  { code: 'BG', label: 'България', currency: 'Lev', currencyCode: 'BGN' },
  { code: 'BF', label: 'Burkina Faso', currency: 'Franc CFA', currencyCode: 'XOF' },
  { code: 'BI', label: 'Burundi', currency: 'Franc', currencyCode: 'BIF' },
  { code: 'BT', label: 'འབྲུག', currency: 'Ngultrum', currencyCode: 'BTN' },
  { code: 'CV', label: 'Cabo Verde', currency: 'Escudo', currencyCode: 'CVE' },
  { code: 'KH', label: 'កម្ពុជា', currency: 'Riel', currencyCode: 'KHR' },
  { code: 'CM', label: 'Cameroun', currency: 'Franc CFA', currencyCode: 'XAF' },
  { code: 'CA', label: 'Canada', currency: 'Canadian Dollar', currencyCode: 'CAD' },
  { code: 'QA', label: 'قطر', currency: 'Riyal', currencyCode: 'QAR' },
  { code: 'TD', label: 'Tchad', currency: 'Franc CFA', currencyCode: 'XAF' },
  { code: 'CL', label: 'Chile', currency: 'Peso Chileno', currencyCode: 'CLP' },
  { code: 'CN', label: '中国', currency: 'Yuan', currencyCode: 'CNY' },
  { code: 'CY', label: 'Κύπρος', currency: 'Euro', currencyCode: 'EUR' },
  { code: 'CO', label: 'Colombia', currency: 'Peso Colombiano', currencyCode: 'COP' },
  { code: 'KM', label: 'Komori', currency: 'Franc', currencyCode: 'KMF' },
  { code: 'KR', label: '대한민국', currency: 'Won', currencyCode: 'KRW' },
  { code: 'KP', label: '조선', currency: 'Won', currencyCode: 'KPW' },
  { code: 'CR', label: 'Costa Rica', currency: 'Colón', currencyCode: 'CRC' },
  { code: 'CI', label: "Côte d'Ivoire", currency: 'Franc CFA', currencyCode: 'XOF' },
  { code: 'HR', label: 'Hrvatska', currency: 'Euro', currencyCode: 'EUR' },
  { code: 'CU', label: 'Cuba', currency: 'Peso Cubano', currencyCode: 'CUP' },
  { code: 'DK', label: 'Danmark', currency: 'Krone', currencyCode: 'DKK' },
  { code: 'DM', label: 'Dominica', currency: 'East Caribbean Dollar', currencyCode: 'XCD' },
  { code: 'EC', label: 'Ecuador', currency: 'US Dollar', currencyCode: 'USD' },
  { code: 'EG', label: 'مصر', currency: 'Pound', currencyCode: 'EGP' },
  { code: 'SV', label: 'El Salvador', currency: 'US Dollar', currencyCode: 'USD' },
  { code: 'AE', label: 'الإمارات', currency: 'Dirham', currencyCode: 'AED' },
  { code: 'ER', label: 'ኤርትራ', currency: 'Nakfa', currencyCode: 'ERN' },
  { code: 'SK', label: 'Slovensko', currency: 'Euro', currencyCode: 'EUR' },
  { code: 'SI', label: 'Slovenija', currency: 'Euro', currencyCode: 'EUR' },
  { code: 'ES', label: 'España', currency: 'Euro', currencyCode: 'EUR' },
  { code: 'US', label: 'United States', currency: 'US Dollar', currencyCode: 'USD' },
  { code: 'EE', label: 'Eesti', currency: 'Euro', currencyCode: 'EUR' },
  { code: 'ET', label: 'ኢትዮጵያ', currency: 'Birr', currencyCode: 'ETB' },
  { code: 'PH', label: 'Pilipinas', currency: 'Peso', currencyCode: 'PHP' },
  { code: 'FI', label: 'Suomi', currency: 'Euro', currencyCode: 'EUR' },
  { code: 'FJ', label: 'Fiji', currency: 'Fiji Dollar', currencyCode: 'FJD' },
  { code: 'FR', label: 'France', currency: 'Euro', currencyCode: 'EUR' },
  { code: 'GA', label: 'Gabon', currency: 'Franc CFA', currencyCode: 'XAF' },
  { code: 'GM', label: 'Gambia', currency: 'Dalasi', currencyCode: 'GMD' },
  { code: 'GE', label: 'საქართველო', currency: 'Lari', currencyCode: 'GEL' },
  { code: 'GH', label: 'Ghana', currency: 'Cedi', currencyCode: 'GHS' },
  { code: 'GR', label: 'Ελλάδα', currency: 'Euro', currencyCode: 'EUR' },
  { code: 'GD', label: 'Grenada', currency: 'East Caribbean Dollar', currencyCode: 'XCD' },
  { code: 'GT', label: 'Guatemala', currency: 'Quetzal', currencyCode: 'GTQ' },
  { code: 'GN', label: 'Guinée', currency: 'Franc', currencyCode: 'GNF' },
  { code: 'GQ', label: 'Guinea Ecuatorial', currency: 'Franc CFA', currencyCode: 'XAF' },
  { code: 'GW', label: 'Guiné-Bissau', currency: 'Franc CFA', currencyCode: 'XOF' },
  { code: 'GY', label: 'Guyana', currency: 'Guyana Dollar', currencyCode: 'GYD' },
  { code: 'HT', label: 'Haïti', currency: 'Gourde', currencyCode: 'HTG' },
  { code: 'HN', label: 'Honduras', currency: 'Lempira', currencyCode: 'HNL' },
  { code: 'HU', label: 'Magyarország', currency: 'Forint', currencyCode: 'HUF' },
  { code: 'IN', label: 'भारत', currency: 'Rupee', currencyCode: 'INR' },
  { code: 'ID', label: 'Indonesia', currency: 'Rupiah', currencyCode: 'IDR' },
  { code: 'IQ', label: 'العراق', currency: 'Dinar', currencyCode: 'IQD' },
  { code: 'IR', label: 'ایران', currency: 'Rial', currencyCode: 'IRR' },
  { code: 'IE', label: 'Éire', currency: 'Euro', currencyCode: 'EUR' },
  { code: 'IS', label: 'Ísland', currency: 'Króna', currencyCode: 'ISK' },
  { code: 'IL', label: 'ישראל', currency: 'Shekel', currencyCode: 'ILS' },
  { code: 'IT', label: 'Italia', currency: 'Euro', currencyCode: 'EUR' },
  { code: 'JM', label: 'Jamaica', currency: 'Jamaica Dollar', currencyCode: 'JMD' },
  { code: 'JP', label: '日本', currency: 'Yen', currencyCode: 'JPY' },
  { code: 'JO', label: 'الأردن', currency: 'Dinar', currencyCode: 'JOD' },
  { code: 'KZ', label: 'Қазақстан', currency: 'Tenge', currencyCode: 'KZT' },
  { code: 'KE', label: 'Kenya', currency: 'Shilling', currencyCode: 'KES' },
  { code: 'KG', label: 'Кыргызстан', currency: 'Som', currencyCode: 'KGS' },
  { code: 'KW', label: 'الكويت', currency: 'Dinar', currencyCode: 'KWD' },
  { code: 'LA', label: 'ລາວ', currency: 'Kip', currencyCode: 'LAK' },
  { code: 'LS', label: 'Lesotho', currency: 'Loti', currencyCode: 'LSL' },
  { code: 'LV', label: 'Latvija', currency: 'Euro', currencyCode: 'EUR' },
  { code: 'LB', label: 'لبنان', currency: 'Pound', currencyCode: 'LBP' },
  { code: 'LR', label: 'Liberia', currency: 'Liberian Dollar', currencyCode: 'LRD' },
  { code: 'LY', label: 'ليبيا', currency: 'Dinar', currencyCode: 'LYD' },
  { code: 'LI', label: 'Liechtenstein', currency: 'Swiss Franc', currencyCode: 'CHF' },
  { code: 'LT', label: 'Lietuva', currency: 'Euro', currencyCode: 'EUR' },
  { code: 'LU', label: 'Luxembourg', currency: 'Euro', currencyCode: 'EUR' },
  { code: 'MK', label: 'Северна Македонија', currency: 'Denar', currencyCode: 'MKD' },
  { code: 'MG', label: 'Madagasikara', currency: 'Ariary', currencyCode: 'MGA' },
  { code: 'MY', label: 'Malaysia', currency: 'Ringgit', currencyCode: 'MYR' },
  { code: 'MW', label: 'Malawi', currency: 'Kwacha', currencyCode: 'MWK' },
  { code: 'MV', label: 'ދިވެހިރާއްޖެ', currency: 'Rufiyaa', currencyCode: 'MVR' },
  { code: 'ML', label: 'Mali', currency: 'Franc CFA', currencyCode: 'XOF' },
  { code: 'MT', label: 'Malta', currency: 'Euro', currencyCode: 'EUR' },
  { code: 'MA', label: 'المغرب', currency: 'Dirham', currencyCode: 'MAD' },
  { code: 'MU', label: 'Mauritius', currency: 'Rupee', currencyCode: 'MUR' },
  { code: 'MR', label: 'موريتانيا', currency: 'Ouguiya', currencyCode: 'MRU' },
  { code: 'MX', label: 'México', currency: 'Peso Mexicano', currencyCode: 'MXN' },
  { code: 'MD', label: 'Moldova', currency: 'Leu', currencyCode: 'MDL' },
  { code: 'MC', label: 'Monaco', currency: 'Euro', currencyCode: 'EUR' },
  { code: 'MN', label: 'Монгол', currency: 'Tugrik', currencyCode: 'MNT' },
  { code: 'ME', label: 'Crna Gora', currency: 'Euro', currencyCode: 'EUR' },
  { code: 'MZ', label: 'Moçambique', currency: 'Metical', currencyCode: 'MZN' },
  { code: 'NA', label: 'Namibia', currency: 'Namibia Dollar', currencyCode: 'NAD' },
  { code: 'NP', label: 'नेपाल', currency: 'Rupee', currencyCode: 'NPR' },
  { code: 'NI', label: 'Nicaragua', currency: 'Córdoba', currencyCode: 'NIO' },
  { code: 'NE', label: 'Niger', currency: 'Franc CFA', currencyCode: 'XOF' },
  { code: 'NG', label: 'Nigeria', currency: 'Naira', currencyCode: 'NGN' },
  { code: 'NO', label: 'Norge', currency: 'Krone', currencyCode: 'NOK' },
  { code: 'NZ', label: 'New Zealand', currency: 'NZ Dollar', currencyCode: 'NZD' },
  { code: 'OM', label: 'عمان', currency: 'Rial', currencyCode: 'OMR' },
  { code: 'NL', label: 'Nederland', currency: 'Euro', currencyCode: 'EUR' },
  { code: 'PK', label: 'پاکستان', currency: 'Rupee', currencyCode: 'PKR' },
  { code: 'PA', label: 'Panamá', currency: 'Balboa', currencyCode: 'PAB' },
  { code: 'PG', label: 'Papua New Guinea', currency: 'Kina', currencyCode: 'PGK' },
  { code: 'PY', label: 'Paraguay', currency: 'Guaraní', currencyCode: 'PYG' },
  { code: 'PE', label: 'Perú', currency: 'Sol', currencyCode: 'PEN' },
  { code: 'PL', label: 'Polska', currency: 'Złoty', currencyCode: 'PLN' },
  { code: 'PT', label: 'Portugal', currency: 'Euro', currencyCode: 'EUR' },
  { code: 'PR', label: 'Puerto Rico', currency: 'US Dollar', currencyCode: 'USD' },
  { code: 'GB', label: 'United Kingdom', currency: 'Pound Sterling', currencyCode: 'GBP' },
  { code: 'CG', label: 'Congo', currency: 'Franc CFA', currencyCode: 'XAF' },
  { code: 'CD', label: 'Congo (RDC)', currency: 'Franc', currencyCode: 'CDF' },
  { code: 'CF', label: 'Centrafrique', currency: 'Franc CFA', currencyCode: 'XAF' },
  { code: 'DO', label: 'República Dominicana', currency: 'Peso Dominicano', currencyCode: 'DOP' },
  { code: 'CZ', label: 'Česko', currency: 'Koruna', currencyCode: 'CZK' },
  { code: 'RO', label: 'România', currency: 'Leu', currencyCode: 'RON' },
  { code: 'RW', label: 'Rwanda', currency: 'Franc', currencyCode: 'RWF' },
  { code: 'RU', label: 'Россия', currency: 'Ruble', currencyCode: 'RUB' },
  { code: 'WS', label: 'Samoa', currency: 'Tala', currencyCode: 'WST' },
  { code: 'SN', label: 'Sénégal', currency: 'Franc CFA', currencyCode: 'XOF' },
  { code: 'RS', label: 'Србија', currency: 'Dinar', currencyCode: 'RSD' },
  { code: 'SG', label: 'Singapore', currency: 'Singapore Dollar', currencyCode: 'SGD' },
  { code: 'SY', label: 'سوريا', currency: 'Pound', currencyCode: 'SYP' },
  { code: 'SO', label: 'Soomaaliya', currency: 'Shilling', currencyCode: 'SOS' },
  { code: 'LK', label: 'ශ්‍රී ලංකාව', currency: 'Rupee', currencyCode: 'LKR' },
  { code: 'SZ', label: 'Eswatini', currency: 'Lilangeni', currencyCode: 'SZL' },
  { code: 'ZA', label: 'South Africa', currency: 'Rand', currencyCode: 'ZAR' },
  { code: 'SD', label: 'السودان', currency: 'Pound', currencyCode: 'SDG' },
  { code: 'SE', label: 'Sverige', currency: 'Krona', currencyCode: 'SEK' },
  { code: 'CH', label: 'Schweiz', currency: 'Swiss Franc', currencyCode: 'CHF' },
  { code: 'SR', label: 'Suriname', currency: 'Surinamese Dollar', currencyCode: 'SRD' },
  { code: 'TH', label: 'ประเทศไทย', currency: 'Baht', currencyCode: 'THB' },
  { code: 'TW', label: '臺灣', currency: 'NT Dollar', currencyCode: 'TWD' },
  { code: 'TZ', label: 'Tanzania', currency: 'Shilling', currencyCode: 'TZS' },
  { code: 'TJ', label: 'Тоҷикистон', currency: 'Somoni', currencyCode: 'TJS' },
  { code: 'TL', label: 'Timor-Leste', currency: 'US Dollar', currencyCode: 'USD' },
  { code: 'TG', label: 'Togo', currency: 'Franc CFA', currencyCode: 'XOF' },
  { code: 'TT', label: 'Trinidad and Tobago', currency: 'TT Dollar', currencyCode: 'TTD' },
  { code: 'TN', label: 'تونس', currency: 'Dinar', currencyCode: 'TND' },
  { code: 'TM', label: 'Türkmenistan', currency: 'Manat', currencyCode: 'TMT' },
  { code: 'TR', label: 'Türkiye', currency: 'Lira', currencyCode: 'TRY' },
  { code: 'UA', label: 'Україна', currency: 'Hryvnia', currencyCode: 'UAH' },
  { code: 'UG', label: 'Uganda', currency: 'Shilling', currencyCode: 'UGX' },
  { code: 'UY', label: 'Uruguay', currency: 'Peso Uruguayo', currencyCode: 'UYU' },
  { code: 'UZ', label: "O'zbekiston", currency: 'Sum', currencyCode: 'UZS' },
  { code: 'VE', label: 'Venezuela', currency: 'Bolívar', currencyCode: 'VES' },
  { code: 'VN', label: 'Việt Nam', currency: 'Đồng', currencyCode: 'VND' },
  { code: 'YE', label: 'اليمن', currency: 'Rial', currencyCode: 'YER' },
  { code: 'ZM', label: 'Zambia', currency: 'Kwacha', currencyCode: 'ZMW' },
  { code: 'ZW', label: 'Zimbabwe', currency: 'ZiG', currencyCode: 'ZWG' },
].sort((a, b) => a.label.localeCompare(b.label));

// ─── Diccionario: moneda por código de país ───────────────────────────
// Object.fromEntries(iterable): crea un objeto a partir de pares [clave, valor].
// COUNTRIES.map((c) => [c.code, { name, code }]): genera los pares.
// Resultado: { 'MX': { name: 'Peso Mexicano', code: 'MXN' }, 'US': {...}, ... }
const CURRENCY_BY_COUNTRY = Object.fromEntries(
  COUNTRIES.map((c) => [c.code, { name: c.currency, code: c.currencyCode }]),
);

// ─── Idiomas disponibles ──────────────────────────────────────────────
// Solo 3 idiomas en V1. Se puede expandir en versiones futuras.
const LANGUAGES = [
  { code: 'es', label: 'Español' },
  { code: 'en', label: 'English' },
  { code: 'pt', label: 'Português' },
];

// ─── Opciones de radio de búsqueda en km ─────────────────────────────
// Distancias disponibles para filtrar negocios cercanos.
const RADIUS_OPTIONS = [1, 3, 5, 10, 15, 25, 50];

// ─── Opciones de suspensión temporal ─────────────────────────────────
// "Tomar un respiro": el usuario puede pausar su cuenta por un período.
// days: número de días de suspensión.
// label: texto para mostrar al usuario.
const BREAK_OPTIONS = [
  { days: 7, label: '1 semana' },
  { days: 14, label: '2 semanas' },
  { days: 30, label: '1 mes' },
  { days: 60, label: '2 meses' },
  { days: 90, label: '3 meses' },
];

// URL base de la API.
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// ─── Componente: ContactChangeForm ────────────────────────────────────
// Formulario inline para cambiar el email o el teléfono del usuario.
// Aparece dentro de la sección de "Editar perfil".
//
// PROPS:
//   field: 'email' | 'phone' → qué campo se está cambiando.
//   label: string → texto del campo ("Email", "Teléfono").
//   currentValue: string → valor actual del campo (para mostrar como referencia).
//   type: string → tipo del input HTML ('email', 'tel').
//   socialProvider?: string | null → si el usuario tiene cuenta social,
//     no pedimos contraseña para confirmar el cambio de email.
//   onSuccess: () => void → callback al guardar exitosamente.
//   onCancel: () => void → callback al cancelar.

// ─── Contact Change Form ──────────────────────────────

function ContactChangeForm({
  field,
  label,
  currentValue,
  type,
  socialProvider,
  onSuccess,
  onCancel,
}: {
  field: 'email' | 'phone';
  label: string;
  currentValue: string;
  type: string;
  socialProvider?: string | null;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  // value: el nuevo valor que el usuario está escribiendo.
  const [value, setValue] = useState('');

  // password: contraseña actual (para confirmar el cambio de email).
  // Solo se pide si el campo es email y no hay proveedor social.
  const [password, setPassword] = useState('');

  // error: mensaje de error del servidor.
  const [error, setError] = useState('');

  // useMutation para hacer el PUT a la API con el nuevo valor.
  const mutation = useMutation({
    mutationFn: () =>
      marketplaceApi.put('/auth/profile/contact', {
        [field]: value,                           // Clave dinámica: 'email' o 'phone'.
        currentPassword: password || undefined,   // undefined = no enviar el campo.
      }),
    onSuccess: () => {
      onSuccess(); // Llama al callback del padre (cierra el form, refresca datos).
    },
    onError: (err: any) => {
      setError(err.message || 'Error al actualizar');
    },
  });

  return (
    <div className="mt-2 p-3 bg-gray-50 rounded-lg space-y-2">
      {/* Muestra el valor actual como referencia. */}
      <p className="text-xs text-gray-500">Actual: {currentValue}</p>

      {/* Input para el nuevo valor. */}
      <input
        type={type}
        inputMode={field === 'phone' ? 'numeric' : undefined}
        maxLength={field === 'phone' ? 10 : undefined}
        value={value}
        onChange={(e) => setValue(field === 'phone' ? e.target.value.replace(/\D/g, '').slice(0, 10) : e.target.value)}
        placeholder={field === 'phone' ? '10 dígitos' : `Nuevo ${label.toLowerCase()}`}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:outline-none"
        style={{ '--tw-ring-color': TEAL } as any}
      />

      {/* Campo de contraseña: solo si es cambio de email Y no es cuenta social.
          Condición: !socialProvider && field === 'email'
          !socialProvider: true si NO tiene proveedor social (cuenta normal con contraseña).
          field === 'email': true si estamos cambiando el email. */}
      {!socialProvider && field === 'email' && (
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Contraseña actual (requerida)"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:outline-none"
          style={{ '--tw-ring-color': TEAL } as any}
        />
      )}

      {/* Error del servidor. */}
      {error && <p className="text-xs text-red-600">{error}</p>}

      {/* Botones de acción. */}
      <div className="flex gap-2">
        {/* Botón Confirmar: deshabilitado si:
            - No hay valor nuevo (!value).
            - Es cambio de email sin contraseña y sin proveedor social.
            - La mutation está en progreso (mutation.isPending). */}
        <button
          onClick={() => mutation.mutate()}
          disabled={!value || (!socialProvider && field === 'email' && !password) || mutation.isPending}
          className="flex-1 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
          style={{ backgroundColor: TEAL }}
        >
          {mutation.isPending ? 'Verificando...' : 'Confirmar'}
        </button>
        {/* Botón Cancelar: llama al callback onCancel del padre. */}
        <button
          onClick={onCancel}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ─── Componente: EditProfilePanel ────────────────────────────────────
// Panel de edición de perfil que aparece expandido dentro de la página de settings.
// Incluye: avatar, nombre, fecha de nacimiento, género, alergias, dirección,
// email, teléfono, y sección de cambio de contraseña con recuperación OTP.
//
// PROPS:
//   user: datos del usuario actual (para pre-rellenar los campos).
//   onClose: función para cerrar el panel.
//   onSaved: función llamada cuando se guardan los datos exitosamente.

// ─── Edit Profile Panel ───────────────────────────────

function EditProfilePanel({
  user,
  onClose,
  onSaved,
}: {
  user: {
    firstName: string; lastName: string; email: string; phone: string | null;
    avatarUrl?: string | null; birthDate?: string | null; gender?: string | null;
    allergies?: string | null; address?: string | null; socialProvider?: string | null;
  };
  onClose: () => void;
  onSaved: () => void;
}) {
  // form: estado del formulario con todos los campos editables.
  // Los valores se pre-rellenan con los datos actuales del usuario.
  // user.birthDate?.split('T')[0]: toma solo la parte de la fecha (YYYY-MM-DD)
  // sin la hora UTC (la API devuelve fecha+hora, pero el input solo necesita la fecha).
  const [form, setForm] = useState({
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    birthDate: user.birthDate ? user.birthDate.split('T')[0] : '',
    gender: user.gender || '',
    allergies: user.allergies || '',
    address: user.address || '',
  });

  // passwordForm: estado separado para el formulario de cambio de contraseña.
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // showPasswordSection: controla si la sección de cambio de contraseña está expandida.
  const [showPasswordSection, setShowPasswordSection] = useState(false);

  // changingField: qué campo de contacto se está editando ('email' | 'phone' | null).
  const [changingField, setChangingField] = useState<'email' | 'phone' | null>(null);

  // OTP recovery state:
  // otpStep: flujo del proceso de verificación OTP (One-Time Password).
  //   'idle': sin OTP activo.
  //   'sent': código OTP enviado al teléfono.
  //   'verified': código verificado con éxito.
  const [otpStep, setOtpStep] = useState<'idle' | 'sent' | 'verified'>('idle');

  // otpCode: el código OTP de 6 dígitos que escribe el usuario.
  const [otpCode, setOtpCode] = useState('');

  // otpError: error del proceso OTP.
  const [otpError, setOtpError] = useState('');

  // error: error general del formulario de perfil.
  const [error, setError] = useState('');

  // successPopup: datos del popup de éxito. null = popup cerrado.
  const [successPopup, setSuccessPopup] = useState<{ title: string; message?: string } | null>(null);

  // passwordError: error específico del formulario de contraseña.
  const [passwordError, setPasswordError] = useState('');

  // avatarPreview: URL de previsualización de la imagen recortada del avatar.
  // null = usando la foto actual del usuario.
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  // cropFile: archivo de imagen seleccionado para recortar.
  // null = sin imagen pendiente de recorte.
  const [cropFile, setCropFile] = useState<File | null>(null);

  // fileInputRef: referencia al input type="file" oculto.
  // useRef<HTMLInputElement>(null): crea una referencia inicializada a null.
  // Usamos .current.click() para abrir el selector de archivos desde el botón del avatar.
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Mutation: guardar cambios del perfil ──
  const profileMutation = useMutation({
    mutationFn: () => marketplaceApi.put('/auth/profile', {
      firstName: form.firstName,
      lastName: form.lastName,
      birthDate: form.birthDate || undefined,   // undefined = no enviar si vacío.
      gender: form.gender || undefined,
      allergies: form.allergies || undefined,
      address: form.address || undefined,
    }),
    onSuccess: () => {
      setSuccessPopup({ title: 'Perfil actualizado', message: 'Tus datos se han guardado correctamente' });
      setError('');
      onSaved(); // Refresca los datos del usuario en el contexto.
    },
    onError: (err: any) => {
      setError(err.message || 'Error al actualizar');
    },
  });

  // ── Mutation: subir avatar ──
  // uploadFile: sube el archivo como FormData multipart.
  const avatarMutation = useMutation({
    mutationFn: (file: File) => marketplaceApi.uploadFile('/auth/avatar', file),
    onSuccess: () => {
      setAvatarPreview(null); // Borramos el preview local (ya está en el servidor).
      onSaved();              // Refresca el usuario para obtener el nuevo avatarUrl.
    },
    onError: (err: any) => {
      setError(err.message || 'Error al subir foto');
    },
  });

  // ── Mutations: OTP para recuperación de contraseña ──
  // Envía un SMS con el código OTP al teléfono del usuario.
  const otpSendMutation = useMutation({
    mutationFn: () => marketplaceApi.post('/auth/otp/send', {}),
    onSuccess: () => { setOtpStep('sent'); setOtpError(''); },
    onError: (err: any) => { setOtpError(err.message || 'Error al enviar código'); },
  });

  // Verifica el código OTP introducido por el usuario.
  const otpVerifyMutation = useMutation({
    mutationFn: () => marketplaceApi.post('/auth/otp/verify', { code: otpCode }),
    onSuccess: () => { setOtpStep('verified'); setOtpError(''); },
    onError: (err: any) => { setOtpError(err.message || 'Código incorrecto'); },
  });

  // ── Mutation: cambiar contraseña ──
  // Puede usar la contraseña actual O el código OTP verificado.
  const passwordMutation = useMutation({
    mutationFn: () =>
      marketplaceApi.put('/auth/profile/password', {
        // Ternario: si el OTP fue verificado → lo usamos; si no → enviamos la contraseña actual.
        ...(otpStep === 'verified' ? { otpCode } : { currentPassword: passwordForm.currentPassword }),
        newPassword: passwordForm.newPassword,
      }),
    onSuccess: () => {
      setSuccessPopup({ title: 'Contraseña actualizada', message: 'Tu contraseña se ha cambiado correctamente' });
      setPasswordError('');
      // Limpiamos el formulario de contraseña tras el éxito.
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setOtpStep('idle');
      setOtpCode('');
    },
    onError: (err: any) => {
      setPasswordError(err.message || 'Error al cambiar contraseña');
    },
  });

  // ── Manejador: selección de archivo para avatar ──
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // e.target.files: FileList de archivos seleccionados.
    // [0]: tomamos solo el primero (solo permitimos un archivo).
    const file = e.target.files?.[0];
    if (!file) return;
    setCropFile(file);   // Guardamos el archivo para mostrarlo en AvatarCropModal.
    e.target.value = ''; // Limpiamos el input para permitir re-seleccionar el mismo archivo.
  };

  // ── Manejador: aceptar imagen recortada ──
  const handleCropAccept = (croppedFile: File) => {
    // URL.createObjectURL: crea una URL temporal del archivo en memoria del navegador.
    // Permite previsualizar la imagen sin subirla aún al servidor.
    setAvatarPreview(URL.createObjectURL(croppedFile));
    avatarMutation.mutate(croppedFile); // Subimos el archivo recortado al servidor.
    setCropFile(null); // Cerramos el modal de recorte.
  };

  // ── Manejador: validar y enviar nueva contraseña ──
  const handlePasswordSubmit = () => {
    setPasswordError('');

    // Validación 1: las contraseñas deben coincidir.
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('Las contraseñas no coinciden');
      return;
    }
    // Validación 2: mínimo 8 caracteres.
    if (passwordForm.newPassword.length < 8) {
      setPasswordError('Mínimo 8 caracteres');
      return;
    }
    // Validación 3: al menos un dígito.
    if (!/[0-9]/.test(passwordForm.newPassword)) {
      setPasswordError('Debe contener al menos un número');
      return;
    }
    // Validación 4: al menos un símbolo.
    if (!/[!@#$%^&*()_+\-=\[\]{}|;:'",.<>?/~`]/.test(passwordForm.newPassword)) {
      setPasswordError('Debe contener al menos un símbolo');
      return;
    }

    passwordMutation.mutate(); // Si pasa todas las validaciones → enviamos.
  };

  // initials: iniciales del usuario para el avatar de fallback.
  const initials = `${(user.firstName || '')[0] || ''}${(user.lastName || '')[0] || ''}`.toUpperCase();

  // avatarSrc: URL de la imagen del avatar a mostrar.
  // avatarPreview tiene prioridad (recién recortada); si no → la URL del servidor.
  // resolveImageUrl convierte la ruta relativa del servidor a URL absoluta.
  const avatarSrc = avatarPreview || resolveImageUrl(user.avatarUrl);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      {/* Cabecera del panel con botón de cierre. */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-900">Editar mi perfil</p>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* ── Sección de avatar ──
          El botón abre el input de archivo oculto al hacer click.
          fileInputRef.current?.click(): accede al elemento DOM del input
          y simula un click para abrir el selector de archivos del sistema operativo. */}
      {/* Avatar upload */}
      <div className="flex flex-col items-center">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="relative w-32 h-32 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0"
          style={{ backgroundColor: TEAL_LIGHT }}
        >
          {/* Iniciales de fondo: si la imagen falla (URL de Google que expira o
              rota), quedan visibles como respaldo en vez de un ícono roto. */}
          <span className="absolute inset-0 flex items-center justify-center text-4xl font-bold" style={{ color: TEAL }}>{initials}</span>
          {avatarSrc && (
            <img
              src={avatarSrc}
              alt=""
              referrerPolicy="no-referrer"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
              className="relative w-full h-full object-cover"
            />
          )}
          {/* Overlay con ícono de cámara: siempre visible encima del avatar. */}
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center rounded-full">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
            </svg>
          </div>
          {/* Spinner de carga superpuesto mientras se sube el avatar. */}
          {avatarMutation.isPending && (
            <div className="absolute inset-0 bg-white/60 flex items-center justify-center rounded-full">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2" style={{ borderColor: TEAL }} />
            </div>
          )}
        </button>
        <p className="text-xs text-gray-400 mt-2">Toca para cambiar</p>
        {/* Input de archivo oculto (no visible en pantalla, solo accesible por referencia). */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleAvatarChange}
        />
      </div>

      {/* Modal de recorte: solo visible cuando hay un archivo pendiente de recortar. */}
      {/* Crop modal */}
      {cropFile && (
        <AvatarCropModal
          imageFile={cropFile}
          onAccept={handleCropAccept}
          onCancel={() => setCropFile(null)}
          onChooseAnother={() => {
            setCropFile(null);
            fileInputRef.current?.click(); // Vuelve a abrir el selector de archivos.
          }}
        />
      )}

      {/* ── Campos del formulario ── */}
      {/* Name fields */}
      <div className="space-y-3">
        {/* Nombre y apellido en dos columnas. */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Nombre</label>
            {/* setForm((f) => ({ ...f, firstName: e.target.value })):
                Copia el objeto form (...f) y sobreescribe solo firstName. */}
            <input
              type="text"
              value={form.firstName}
              onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:outline-none"
              style={{ '--tw-ring-color': TEAL } as any}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Apellido</label>
            <input
              type="text"
              value={form.lastName}
              onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:outline-none"
              style={{ '--tw-ring-color': TEAL } as any}
            />
          </div>
        </div>

        {/* Fecha de nacimiento y género en dos columnas. */}
        {/* Birth date + Gender */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Fecha de nacimiento</label>
            {/* DatePicker: componente personalizado de selección de fecha.
                value: fecha en formato YYYY-MM-DD.
                onChange: callback con la nueva fecha seleccionada. */}
            <DatePicker
              value={form.birthDate}
              onChange={(v) => setForm((f) => ({ ...f, birthDate: v }))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Género</label>
            {/* select: menú desplegable HTML nativo. */}
            <select
              value={form.gender}
              onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:outline-none bg-white"
              style={{ '--tw-ring-color': TEAL } as any}
            >
              <option value="">Seleccionar</option>
              <option value="FEMALE">Femenino</option>
              <option value="MALE">Masculino</option>
              <option value="NON_BINARY">No binario</option>
              <option value="PREFER_NOT_SAY">Prefiero no decir</option>
            </select>
          </div>
        </div>

        {/* Campo de alergias / notas médicas. */}
        {/* Allergies / Medical notes */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Alergias / Notas médicas
          </label>
          {/* textarea: campo de texto multilínea.
              resize-none: evita que el usuario pueda redimensionar manualmente. */}
          <textarea
            value={form.allergies}
            onChange={(e) => setForm((f) => ({ ...f, allergies: e.target.value }))}
            placeholder="Ej: Alergia al látex, piel sensible, etc."
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:outline-none resize-none"
            style={{ '--tw-ring-color': TEAL } as any}
          />
          <p className="text-[10px] text-gray-400 mt-0.5">Los negocios podrán ver esta información antes de tu cita</p>
        </div>

        {/* Campo de dirección. */}
        {/* Address */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Direccion
          </label>
          <textarea
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            placeholder="Calle, numero, colonia, ciudad, estado, CP"
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:outline-none resize-none"
            style={{ '--tw-ring-color': TEAL } as any}
          />
          <p className="text-[10px] text-gray-400 mt-0.5">Se usara como direccion sugerida para envios de productos</p>
        </div>

        {/* Campo de email (con botón "Cambiar" para abrir ContactChangeForm). */}
        {/* Email */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-medium text-gray-500">Email</label>
            {/* Botón "Cambiar" visible solo cuando NO estamos ya cambiando el email. */}
            {changingField !== 'email' && (
              <button
                onClick={() => { setChangingField('email'); }}
                className="text-xs font-medium hover:underline"
                style={{ color: TEAL }}
              >
                Cambiar
              </button>
            )}
          </div>
          {/* Renderizado condicional: si changingField === 'email' → form; si no → texto. */}
          {changingField === 'email' ? (
            <ContactChangeForm
              field="email"
              label="Email"
              currentValue={user.email}
              type="email"
              socialProvider={user.socialProvider}
              onSuccess={() => { setChangingField(null); onSaved(); }}
              onCancel={() => setChangingField(null)}
            />
          ) : (
            // Muestra el email actual como texto de solo lectura.
            <p className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600">
              {user.email}
            </p>
          )}
        </div>

        {/* Campo de teléfono (igual patrón que email). */}
        {/* Phone */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-medium text-gray-500">Teléfono</label>
            {changingField !== 'phone' && (
              <button
                onClick={() => { setChangingField('phone'); }}
                className="text-xs font-medium hover:underline"
                style={{ color: TEAL }}
              >
                Cambiar
              </button>
            )}
          </div>
          {changingField === 'phone' ? (
            <ContactChangeForm
              field="phone"
              label="Teléfono"
              currentValue={user.phone || 'No registrado'}
              type="tel"
              socialProvider={user.socialProvider}
              onSuccess={() => { setChangingField(null); onSaved(); }}
              onCancel={() => setChangingField(null)}
            />
          ) : (
            <p className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600">
              {user.phone || 'No registrado'}
            </p>
          )}
        </div>
      </div>

      {/* Error general del formulario. */}
      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
      )}

      {/* Botón de guardar cambios del perfil. */}
      <button
        onClick={() => profileMutation.mutate()}
        disabled={profileMutation.isPending}
        className="w-full text-white py-2.5 rounded-lg font-medium text-sm disabled:opacity-50 transition-colors"
        style={{ backgroundColor: TEAL }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = TEAL_DARK)}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = TEAL)}
      >
        {profileMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
      </button>

      {/* ── Sección colapsable de cambio de contraseña ──
          border-t: línea divisoria superior.
          showPasswordSection && (...): muestra el formulario si está expandido. */}
      {/* Change password (collapsible) */}
      <div className="border-t border-gray-100 pt-4">
        {/* Botón toggle: expande/colapsa la sección de contraseña. */}
        <button
          onClick={() => setShowPasswordSection(!showPasswordSection)}
          className="w-full flex items-center justify-between"
        >
          <p className="text-sm font-medium text-gray-700">
            {/* Texto del botón cambia según si tiene proveedor social y si hay contraseña. */}
            {user.socialProvider && !passwordForm.currentPassword ? 'Establecer contraseña' : 'Cambiar contraseña'}
          </p>
          {/* Ícono de flecha: rota 180° cuando la sección está expandida. */}
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${showPasswordSection ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Formulario de contraseña (visible solo si showPasswordSection es true). */}
        {showPasswordSection && (
          <div className="mt-3 space-y-3">
            {/* Info para cuentas con proveedor social. */}
            {user.socialProvider && (
              <p className="text-xs text-gray-400 bg-gray-50 px-3 py-2 rounded-lg">
                Tu cuenta está vinculada con {user.socialProvider === 'google' ? 'Google' : 'Facebook'}. Puedes establecer una contraseña para también iniciar sesión con email.
              </p>
            )}

            {/* Campos de contraseña actual (solo para cuentas sin proveedor social). */}
            {!user.socialProvider && (
              <div>
                {/* Badge de verificación OTP exitosa. */}
                {otpStep === 'verified' ? (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm" style={{ backgroundColor: '#e0f2f1', color: TEAL }}>
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="font-medium">Identidad verificada por SMS</span>
                  </div>
                ) : (
                  <>
                    {/* Campo de contraseña actual (si el OTP no está en proceso). */}
                    <label className="block text-xs font-medium text-gray-500 mb-1">Contraseña actual</label>
                    <input
                      type="password"
                      value={passwordForm.currentPassword}
                      onChange={(e) => setPasswordForm((p) => ({ ...p, currentPassword: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:outline-none"
                      style={{ '--tw-ring-color': TEAL } as any}
                      disabled={otpStep !== 'idle'} // Deshabilitado si OTP está en proceso.
                    />

                    {/* ── Flujo OTP para recuperar contraseña ──
                        Permite cambiar la contraseña sin saber la actual,
                        usando un código SMS. */}
                    {/* OTP Recovery */}
                    {otpStep === 'idle' && (
                      <button
                        type="button"
                        onClick={() => { setOtpError(''); otpSendMutation.mutate(); }}
                        disabled={otpSendMutation.isPending}
                        className="mt-1.5 text-xs font-medium disabled:opacity-50"
                        style={{ color: TEAL }}
                      >
                        {otpSendMutation.isPending ? 'Enviando...' : '¿Olvidaste tu contraseña? Recuperar por SMS'}
                      </button>
                    )}

                    {/* Paso OTP "enviado": campo para ingresar el código de 6 dígitos. */}
                    {otpStep === 'sent' && (
                      <div className="mt-2 space-y-2">
                        <p className="text-xs text-gray-500">Ingresa el código de 6 dígitos enviado a tu teléfono</p>
                        <div className="flex gap-2">
                          {/* Input de solo dígitos: maxLength={6}, inputMode="numeric". */}
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            value={otpCode}
                            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder="000000"
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-center tracking-widest font-mono focus:ring-2 focus:outline-none"
                            style={{ '--tw-ring-color': TEAL } as any}
                          />
                          <button
                            type="button"
                            onClick={() => otpVerifyMutation.mutate()}
                            disabled={otpCode.length !== 6 || otpVerifyMutation.isPending}
                            className="px-4 py-2 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                            style={{ backgroundColor: TEAL }}
                          >
                            {otpVerifyMutation.isPending ? '...' : 'Verificar'}
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => { setOtpStep('idle'); setOtpCode(''); setOtpError(''); }}
                          className="text-xs text-gray-400 hover:text-gray-600"
                        >
                          Cancelar
                        </button>
                      </div>
                    )}
                  </>
                )}
                {/* Error del proceso OTP. */}
                {otpError && <p className="mt-1 text-xs text-red-600">{otpError}</p>}
              </div>
            )}

            {/* Campo de nueva contraseña. */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Nueva contraseña</label>
              <input
                type="password"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm((p) => ({ ...p, newPassword: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:outline-none"
                style={{ '--tw-ring-color': TEAL } as any}
                placeholder="Min. 8 caracteres, 1 número, 1 símbolo"
              />
            </div>

            {/* Campo de confirmación de nueva contraseña. */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Confirmar nueva contraseña</label>
              <input
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm((p) => ({ ...p, confirmPassword: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:outline-none"
                style={{ '--tw-ring-color': TEAL } as any}
              />
            </div>

            {/* Error del formulario de contraseña. */}
            {passwordError && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{passwordError}</p>
            )}

            {/* Botón de guardar contraseña. */}
            <button
              onClick={handlePasswordSubmit}
              disabled={passwordMutation.isPending}
              className="w-full text-white py-2.5 rounded-lg font-medium text-sm disabled:opacity-50 transition-colors"
              style={{ backgroundColor: TEAL }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = TEAL_DARK)}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = TEAL)}
            >
              {passwordMutation.isPending ? 'Guardando...' : user.socialProvider ? 'Establecer contraseña' : 'Cambiar contraseña'}
            </button>
          </div>
        )}
      </div>

      {/* Popup de éxito: modal con check verde y botón "Aceptar".
          show={!!successPopup}: !! convierte el objeto/null a boolean. */}
      <SuccessPopup
        show={!!successPopup}
        title={successPopup?.title || ''}
        message={successPopup?.message}
        onClose={() => setSuccessPopup(null)}
      />
    </div>
  );
}

// ─── Settings Page ────────────────────────────────────

// ─── Componente principal: MarketplaceSettingsPage ─────────────────────
export default function MarketplaceSettingsPage() {
  const router = useRouter();

  // Extraemos del contexto de auth: usuario, estado de carga, refreshUser y logout.
  const { user, isAuthenticated, isLoading: authLoading, refreshUser, logout } = useMarketplaceAuth();

  // settings: objeto con todas las preferencias del usuario.
  // Se inicializa con valores por defecto y se actualiza desde los datos del usuario.
  const [settings, setSettings] = useState({
    country: '',
    language: 'es',
    currency: 'LOCAL', // 'LOCAL': usa la moneda del país del usuario.
    searchRadius: 10,  // 10 km por defecto.
    notifAppointments: true,
    notifPromotions: true,
    notifRewards: true,
    notifMessages: true,
  });

  // hasChanges: true cuando el usuario ha modificado alguna preferencia.
  // Controla si se muestra el botón "Guardar configuración".
  const [hasChanges, setHasChanges] = useState(false);

  // successPopup: si es true, muestra el popup de éxito al guardar.
  const [successPopup, setSuccessPopup] = useState(false);

  // showDeleteConfirm: controla la visibilidad del modal de confirmación de eliminación.
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // deletePassword: contraseña introducida para confirmar la eliminación.
  const [deletePassword, setDeletePassword] = useState('');

  // deleteError: error del proceso de eliminación.
  const [deleteError, setDeleteError] = useState('');

  // showEditProfile: controla si el panel de edición de perfil está expandido.
  const [showEditProfile, setShowEditProfile] = useState(false);

  // showBreakModal: controla si el modal "Tomar un respiro" está visible.
  const [showBreakModal, setShowBreakModal] = useState(false);

  // breakDays: duración de la suspensión seleccionada en días.
  const [breakDays, setBreakDays] = useState(30);

  // suspendError: error del proceso de suspensión.
  const [suspendError, setSuspendError] = useState('');

  // showSuspendSuccess: controla si el modal de confirmación de suspensión está visible.
  const [showSuspendSuccess, setShowSuspendSuccess] = useState(false);

  // suspendedLabel: texto con la duración seleccionada para el modal de éxito.
  // Ej: "1 mes", "2 semanas".
  const [suspendedLabel, setSuspendedLabel] = useState('');

  // Efecto: redirigir si no está autenticado.
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/marketplace/login?redirect=/marketplace/settings');
    }
  }, [authLoading, isAuthenticated, router]);

  // Efecto: cargar las preferencias del usuario en el estado local.
  // Se ejecuta cuando los datos del usuario están disponibles.
  useEffect(() => {
    if (user) {
      // En V1 forzamos siempre LOCAL — la opcion USD se elimino del UI.
      // Si un usuario tenia USD seteado de antes, lo migramos silenciosamente
      // a LOCAL aqui para que no quede atrapado en una moneda que ya no
      // puede cambiar desde la app.
      const savedCurrency = (user as any).currency;
      // Si la moneda guardada era USD (ya no está disponible), la migramos a LOCAL.
      const currency = savedCurrency === 'USD' ? 'LOCAL' : (savedCurrency || 'LOCAL');
      setSettings({
        country: (user as any).country || '',
        language: (user as any).language || 'es',
        currency,
        searchRadius: (user as any).searchRadius || 10,
        // ?? true: si el valor es null/undefined, usa true como default.
        notifAppointments: (user as any).notifAppointments ?? true,
        notifPromotions: (user as any).notifPromotions ?? true,
        notifRewards: (user as any).notifRewards ?? true,
        notifMessages: (user as any).notifMessages ?? true,
      });
      // Si se migro, marcar dirty para que se persista al backend al guardar.
      if (savedCurrency === 'USD') setHasChanges(true);
    }
  }, [user]);

  // updateField: función genérica para actualizar un campo de settings.
  // <K extends keyof typeof settings>: TypeScript genérico que garantiza
  // que key es una clave válida del objeto settings y value es del tipo correcto.
  const updateField = <K extends keyof typeof settings>(key: K, value: (typeof settings)[K]) => {
    setSettings((s) => ({ ...s, [key]: value }));
    setHasChanges(true); // Marcamos que hay cambios sin guardar.
  };

  // ── Mutation: guardar configuración ──
  const saveMutation = useMutation({
    mutationFn: () => marketplaceApi.put('/auth/settings', settings),
    onSuccess: () => {
      setSuccessPopup(true); // Muestra el popup de éxito.
      setHasChanges(false);  // Ya no hay cambios sin guardar.
      refreshUser();         // Recarga los datos del usuario.
    },
  });

  // ── Mutation: suspender cuenta temporalmente ──
  const suspendMutation = useMutation({
    mutationFn: (days: number) => marketplaceApi.post('/auth/suspend', { days }),
    onSuccess: () => {
      setShowBreakModal(false);
      setSuspendError('');
      // Buscamos el label de la opción seleccionada para el mensaje de éxito.
      const opt = BREAK_OPTIONS.find((o) => o.days === breakDays);
      setSuspendedLabel(opt?.label || `${breakDays} días`);
      setShowSuspendSuccess(true); // Muestra modal de confirmación.
    },
    onError: (err: any) => {
      setSuspendError(err.message || 'Error al suspender la cuenta');
    },
  });

  // ── Mutation: eliminar cuenta permanentemente ──
  const deleteMutation = useMutation({
    mutationFn: (password: string) => marketplaceApi.del('/auth/account', { password }),
    onSuccess: () => {
      setShowDeleteConfirm(false);
      logout();              // Cierra la sesión.
      router.push('/marketplace'); // Vuelve al marketplace (como visitante).
    },
    onError: (err: any) => {
      setDeleteError(err.message || 'Error al eliminar la cuenta');
    },
  });

  // ── useMemo: calcular la etiqueta de la moneda local ──
  // useMemo memoiza el resultado: solo recalcula cuando cambia settings.country.
  // Sin useMemo, se recalcularía en CADA render aunque country no haya cambiado.
  // Get currency label for selected country
  const localCurrencyLabel = useMemo(() => {
    if (!settings.country) return 'Moneda local';
    // CURRENCY_BY_COUNTRY[settings.country]: accede al diccionario con el código del país.
    const info = CURRENCY_BY_COUNTRY[settings.country];
    return info ? `${info.name} (${info.code})` : 'Moneda local';
  }, [settings.country]);

  // Pantalla de carga mientras verifica auth.
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: TEAL }} />
      </div>
    );
  }

  // Si no está autenticado → no renderizamos (el useEffect habrá redirigido).
  if (!isAuthenticated || !user) return null;

  return (
    <div className="min-h-screen bg-gray-50 safe-top">


      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* ── Header de la página ── */}
        <div className="flex items-center gap-3 mb-6">
          {/* Botón de regreso al perfil. */}
          <button
            onClick={() => router.push('/marketplace/profile')}
            className="w-9 h-9 rounded-full flex items-center justify-center bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          {/* Ícono ⓘ de ayuda contextual — lado izquierdo, junto al botón de volver. */}
          <SectionHelp className="p-1.5 rounded-lg text-gray-400 hover:text-[#008080] hover:bg-gray-100 transition-colors flex-shrink-0" />
          <h1 className="text-lg font-bold text-gray-900">Configuración</h1>
        </div>

        <div className="space-y-4">
          {/* Seccion "General" eliminada: el pais ahora se gestiona unicamente
              desde el dropdown de pais dentro de "Editar perfil" (parte de
              direccion). Asi evitamos 2 selectores que podian quedar
              desincronizados. La moneda se deriva del pais de la direccion
              automaticamente al guardar. */}

          {/* ── Sección Búsqueda: radio de búsqueda en km ── */}
          {/* ─── Search ──────────────────────────────── */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                Búsqueda
              </h2>
            </div>

            <div className="px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-700">Radio de búsqueda</p>
                {/* Muestra el valor actual del radio seleccionado. */}
                <span className="text-sm font-semibold" style={{ color: TEAL }}>{settings.searchRadius} km</span>
              </div>
              {/* Botones pill para seleccionar el radio.
                  .map((r) => ...): un botón por cada opción de RADIUS_OPTIONS.
                  key={r}: el número de km es único → sirve como key. */}
              <div className="flex gap-1.5 flex-wrap">
                {RADIUS_OPTIONS.map((r) => (
                  <button
                    key={r}
                    onClick={() => updateField('searchRadius', r)}
                    className="px-3 py-1 rounded-full text-xs font-medium transition-colors"
                    style={
                      // Estilo activo si este radio es el seleccionado.
                      settings.searchRadius === r
                        ? { backgroundColor: TEAL, color: 'white' }
                        : { backgroundColor: '#f3f4f6', color: '#6b7280' }
                    }
                  >
                    {r} km
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-2">Distancia máxima para buscar negocios cercanos</p>
            </div>
          </div>

          {/* Notificaciones: removidas en V1 — los toggles solo se guardaban
              en BD pero NO hay sistema de notificaciones funcional que los
              respete (no push, no cron de recordatorios, no emails que los
              consulten). El cliente activaba/desactivaba sin efecto real,
              dando falsa expectativa. Se replantea en V2 cuando se
              implemente el sistema de push/email/SMS end-to-end. Los
              campos siguen en el modelo User para reactivar facilmente.
              Ver project_v2_notifications.md. */}

          {/* ── Sección Cuenta: editar perfil, suspender, eliminar ── */}
          {/* ─── Account ─────────────────────────────── */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
                </svg>
                Cuenta
              </h2>
            </div>

            {/* divide-y: línea divisoria entre cada fila de la lista. */}
            <div className="divide-y divide-gray-100">
              {/* Fila "Editar perfil": navega a la página dedicada de edición. */}
              <button
                onClick={() => router.push('/marketplace/settings/edit-profile')}
                className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
              >
                <div>
                  <p className="text-sm text-gray-700">Editar perfil</p>
                  <p className="text-xs text-gray-400">Nombre, foto, correo, teléfono, contraseña</p>
                </div>
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>

              {/* Fila "Tomar un respiro": abre el modal de suspensión temporal. */}
              <button
                onClick={() => setShowBreakModal(true)}
                className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-amber-50 transition-colors"
              >
                <div>
                  <p className="text-sm text-amber-700">Tomar un respiro</p>
                  <p className="text-xs text-gray-400">Suspender tu cuenta temporalmente</p>
                </div>
                <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.182 16.318A4.486 4.486 0 0 0 12.016 15a4.486 4.486 0 0 0-3.198 1.318M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Z" />
                </svg>
              </button>

              {/* Fila "Eliminar mi cuenta": abre el modal de confirmación. */}
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-red-50 transition-colors"
              >
                <div>
                  <p className="text-sm text-red-600">Eliminar mi cuenta</p>
                  <p className="text-xs text-gray-400">Se borrarán todos tus datos permanentemente</p>
                </div>
                <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
              </button>
            </div>
          </div>

          {/* ── Sección Ayuda y Legal ── */}
          {/* ─── Help & Legal ─────────────────────── */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
                </svg>
                Ayuda y Legal
              </h2>
            </div>

            <div className="divide-y divide-gray-100">
              <button
                onClick={() => router.push('/marketplace/help')}
                className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: TEAL_LIGHT }}>
                    <svg className="w-4 h-4" style={{ color: TEAL }} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm text-gray-700">Centro de Ayuda</p>
                    <p className="text-xs text-gray-400">Soporte, FAQ y documentos legales</p>
                  </div>
                </div>
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>

              <button
                onClick={() => router.push('/marketplace/legal/privacy')}
                className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
              >
                <p className="text-sm text-gray-700">Aviso de Privacidad</p>
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>

              <button
                onClick={() => router.push('/marketplace/legal/terms')}
                className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
              >
                <p className="text-sm text-gray-700">Términos y Condiciones</p>
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            </div>
          </div>

          {/* ── Botón "Guardar configuración" (flotante sticky) ──
              Solo visible cuando hasChanges es true.
              sticky bottom-4: se queda pegado al fondo mientras el usuario hace scroll. */}
          {/* Save button */}
          {hasChanges && (
            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="w-full text-white py-3 rounded-xl font-medium text-sm disabled:opacity-50 transition-colors sticky bottom-4 shadow-lg"
              style={{ backgroundColor: TEAL }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = TEAL_DARK)}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = TEAL)}
            >
              {saveMutation.isPending ? 'Guardando...' : 'Guardar configuración'}
            </button>
          )}

          {/* Versión de la app al fondo. */}
          <p className="text-center text-xs text-gray-300 pb-4">
            Siliba v1.0
          </p>
        </div>
      </div>

      {/* ─── Modal "Tomar un respiro" (suspender cuenta temporalmente) ── */}
      {/* Renderizado condicional: solo si showBreakModal es true. */}
      {showBreakModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setShowBreakModal(false)} // Click fuera → cierra el modal.
        >
          <div
            className="bg-white rounded-2xl p-6 mx-4 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()} // Click dentro → NO cierra el modal.
          >
            {/* Ícono de reloj en círculo ámbar. */}
            <div className="w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-4 bg-amber-50">
              <svg className="w-7 h-7 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1 text-center">Tomar un respiro</h3>
            <p className="text-sm text-gray-500 mb-1 text-center">
              Tu cuenta se suspenderá temporalmente. No aparecerás en la plataforma durante el periodo que elijas.
            </p>
            <p className="text-xs text-gray-400 mb-4 text-center">
              Al cumplirse el periodo, tu cuenta se reactivará automáticamente y recibirás una notificación.
            </p>

            {/* Opciones de duración de la suspensión.
                .map((opt) => ...): un botón por cada opción de BREAK_OPTIONS. */}
            <div className="space-y-2 mb-5">
              {BREAK_OPTIONS.map((opt) => (
                <button
                  key={opt.days}
                  onClick={() => setBreakDays(opt.days)} // Selecciona esta duración.
                  className="w-full px-4 py-2.5 rounded-xl text-sm font-medium text-left transition-colors flex items-center justify-between"
                  style={
                    // Estilo activo si este es el número de días seleccionado.
                    breakDays === opt.days
                      ? { backgroundColor: TEAL_LIGHT, color: TEAL, border: `1.5px solid ${TEAL}` }
                      : { backgroundColor: '#f9fafb', color: '#374151', border: '1.5px solid #e5e7eb' }
                  }
                >
                  {opt.label}
                  {/* Check: solo visible para la opción seleccionada. */}
                  {breakDays === opt.days && (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              ))}
            </div>

            {/* Error de la suspensión (si la API falla). */}
            {suspendError && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg mb-3">{suspendError}</p>
            )}

            {/* Botones de acción: Cancelar / Suspender cuenta. */}
            <div className="flex gap-3">
              <button
                onClick={() => { setShowBreakModal(false); setSuspendError(''); }}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => { setSuspendError(''); suspendMutation.mutate(breakDays); }}
                disabled={suspendMutation.isPending}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-50"
                style={{ backgroundColor: '#f59e0b' }} // Color ámbar para acción destructiva.
              >
                {suspendMutation.isPending ? 'Procesando...' : 'Suspender cuenta'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal de confirmación de eliminación de cuenta ── */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => { setShowDeleteConfirm(false); setDeletePassword(''); setDeleteError(''); }}
        >
          <div
            className="bg-white rounded-2xl p-6 mx-4 max-w-sm w-full text-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Ícono de advertencia en círculo rojo. */}
            <div className="w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-4 bg-red-50">
              <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">¿Eliminar tu cuenta?</h3>
            <p className="text-sm text-gray-500 mb-2">
              Esta acción es irreversible. Se eliminarán tus datos, favoritos y cupones.
            </p>
            <p className="text-sm font-medium text-red-600 mb-4">
              Tu información no podrá ser recuperada.
            </p>

            {/* Campo de contraseña: solo para cuentas sin proveedor social.
                !(user as any).socialProvider: si NO tiene proveedor social → pedimos contraseña. */}
            {!(user as any).socialProvider && (
              <input
                type="password"
                value={deletePassword}
                onChange={(e) => { setDeletePassword(e.target.value); setDeleteError(''); }}
                placeholder="Confirma tu contraseña"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm mb-3 focus:ring-2 focus:ring-red-400 focus:border-red-400"
              />
            )}

            {/* Error de la eliminación. */}
            {deleteError && (
              <p className="text-xs text-red-600 mb-3">{deleteError}</p>
            )}

            {/* Botones: Cancelar / Eliminar. */}
            <div className="flex gap-3">
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeletePassword(''); setDeleteError(''); }}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              {/* Botón "Eliminar": deshabilitado si:
                  - No tiene proveedor social Y no hay contraseña.
                  - La mutation está en progreso. */}
              <button
                disabled={(!(user as any).socialProvider && !deletePassword) || deleteMutation.isPending}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
                onClick={() => deleteMutation.mutate(deletePassword)}
              >
                {deleteMutation.isPending ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal de éxito de suspensión ── */}
      {showSuspendSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl p-6 mx-4 max-w-sm w-full text-center">
            {/* Ícono de check en círculo teal. */}
            <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: TEAL_LIGHT }}>
              <svg className="w-8 h-8" style={{ color: TEAL }} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Cuenta suspendida</h3>
            <p className="text-sm text-gray-500 mb-1">
              {/* suspendedLabel: ej: "1 mes", "2 semanas". */}
              Tu cuenta ha sido suspendida por <span className="font-semibold text-gray-700">{suspendedLabel}</span>.
            </p>
            <p className="text-xs text-gray-400 mb-5">
              Puedes volver cuando quieras iniciando sesión.
            </p>
            <button
              onClick={() => {
                setShowSuspendSuccess(false);
                logout();              // Cierra la sesión.
                router.push('/marketplace'); // Vuelve al marketplace.
              }}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-colors"
              style={{ backgroundColor: TEAL }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = TEAL_DARK)}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = TEAL)}
            >
              Salir
            </button>
          </div>
        </div>
      )}

      {/* Popup de éxito al guardar la configuración.
          show={successPopup}: successPopup es un boolean directamente. */}
      <SuccessPopup
        show={successPopup}
        title="Configuración guardada"
        message="Tus preferencias se han actualizado correctamente"
        onClose={() => setSuccessPopup(false)}
      />
    </div>
  );
}
