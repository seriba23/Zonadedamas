'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { useMarketplaceAuth } from '@/lib/hooks/use-marketplace-auth';
import { marketplaceApi } from '@/lib/marketplace-api';
import { resolveImageUrl } from '@/lib/utils';
import { SuccessPopup } from '@/components/ui/success-popup';
import { AvatarCropModal } from '@/components/ui/avatar-crop-modal';
import { DatePicker } from '@/components/ui/date-picker';

const TEAL = '#008080';
const TEAL_DARK = '#006666';
const TEAL_LIGHT = '#e0f2f1';

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

const CURRENCY_BY_COUNTRY = Object.fromEntries(
  COUNTRIES.map((c) => [c.code, { name: c.currency, code: c.currencyCode }]),
);

const LANGUAGES = [
  { code: 'es', label: 'Español' },
  { code: 'en', label: 'English' },
  { code: 'pt', label: 'Português' },
];

const RADIUS_OPTIONS = [1, 3, 5, 10, 15, 25, 50];

const BREAK_OPTIONS = [
  { days: 7, label: '1 semana' },
  { days: 14, label: '2 semanas' },
  { days: 30, label: '1 mes' },
  { days: 60, label: '2 meses' },
  { days: 90, label: '3 meses' },
];

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

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
  const [value, setValue] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      marketplaceApi.put('/auth/profile/contact', {
        [field]: value,
        currentPassword: password || undefined,
      }),
    onSuccess: () => {
      onSuccess();
    },
    onError: (err: any) => {
      setError(err.message || 'Error al actualizar');
    },
  });

  return (
    <div className="mt-2 p-3 bg-gray-50 rounded-lg space-y-2">
      <p className="text-xs text-gray-500">Actual: {currentValue}</p>
      <input
        type={type}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={`Nuevo ${label.toLowerCase()}`}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:outline-none"
        style={{ '--tw-ring-color': TEAL } as any}
      />
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
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={() => mutation.mutate()}
          disabled={!value || (!socialProvider && field === 'email' && !password) || mutation.isPending}
          className="flex-1 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
          style={{ backgroundColor: TEAL }}
        >
          {mutation.isPending ? 'Verificando...' : 'Confirmar'}
        </button>
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
  const [form, setForm] = useState({
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    birthDate: user.birthDate ? user.birthDate.split('T')[0] : '',
    gender: user.gender || '',
    allergies: user.allergies || '',
    address: user.address || '',
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [changingField, setChangingField] = useState<'email' | 'phone' | null>(null);
  // OTP recovery state
  const [otpStep, setOtpStep] = useState<'idle' | 'sent' | 'verified'>('idle');
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState('');
  const [error, setError] = useState('');
  const [successPopup, setSuccessPopup] = useState<{ title: string; message?: string } | null>(null);
  const [passwordError, setPasswordError] = useState('');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const profileMutation = useMutation({
    mutationFn: () => marketplaceApi.put('/auth/profile', {
      firstName: form.firstName,
      lastName: form.lastName,
      birthDate: form.birthDate || undefined,
      gender: form.gender || undefined,
      allergies: form.allergies || undefined,
      address: form.address || undefined,
    }),
    onSuccess: () => {
      setSuccessPopup({ title: 'Perfil actualizado', message: 'Tus datos se han guardado correctamente' });
      setError('');
      onSaved();
    },
    onError: (err: any) => {
      setError(err.message || 'Error al actualizar');
    },
  });

  const avatarMutation = useMutation({
    mutationFn: (file: File) => marketplaceApi.uploadFile('/auth/avatar', file),
    onSuccess: () => {
      setAvatarPreview(null);
      onSaved();
    },
    onError: (err: any) => {
      setError(err.message || 'Error al subir foto');
    },
  });

  const otpSendMutation = useMutation({
    mutationFn: () => marketplaceApi.post('/auth/otp/send', {}),
    onSuccess: () => { setOtpStep('sent'); setOtpError(''); },
    onError: (err: any) => { setOtpError(err.message || 'Error al enviar código'); },
  });

  const otpVerifyMutation = useMutation({
    mutationFn: () => marketplaceApi.post('/auth/otp/verify', { code: otpCode }),
    onSuccess: () => { setOtpStep('verified'); setOtpError(''); },
    onError: (err: any) => { setOtpError(err.message || 'Código incorrecto'); },
  });

  const passwordMutation = useMutation({
    mutationFn: () =>
      marketplaceApi.put('/auth/profile/password', {
        ...(otpStep === 'verified' ? { otpCode } : { currentPassword: passwordForm.currentPassword }),
        newPassword: passwordForm.newPassword,
      }),
    onSuccess: () => {
      setSuccessPopup({ title: 'Contraseña actualizada', message: 'Tu contraseña se ha cambiado correctamente' });
      setPasswordError('');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setOtpStep('idle');
      setOtpCode('');
    },
    onError: (err: any) => {
      setPasswordError(err.message || 'Error al cambiar contraseña');
    },
  });

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCropFile(file);
    e.target.value = '';
  };

  const handleCropAccept = (croppedFile: File) => {
    setAvatarPreview(URL.createObjectURL(croppedFile));
    avatarMutation.mutate(croppedFile);
    setCropFile(null);
  };

  const handlePasswordSubmit = () => {
    setPasswordError('');
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('Las contraseñas no coinciden');
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      setPasswordError('Mínimo 8 caracteres');
      return;
    }
    if (!/[0-9]/.test(passwordForm.newPassword)) {
      setPasswordError('Debe contener al menos un número');
      return;
    }
    if (!/[!@#$%^&*()_+\-=\[\]{}|;:'",.<>?/~`]/.test(passwordForm.newPassword)) {
      setPasswordError('Debe contener al menos un símbolo');
      return;
    }
    passwordMutation.mutate();
  };

  const initials = `${(user.firstName || '')[0] || ''}${(user.lastName || '')[0] || ''}`.toUpperCase();
  const avatarSrc = avatarPreview || resolveImageUrl(user.avatarUrl);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
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

      {/* Avatar upload */}
      <div className="flex flex-col items-center">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="relative w-32 h-32 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0"
          style={{ backgroundColor: TEAL_LIGHT }}
        >
          {avatarSrc ? (
            <img src={avatarSrc} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-4xl font-bold" style={{ color: TEAL }}>{initials}</span>
          )}
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center rounded-full">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
            </svg>
          </div>
          {avatarMutation.isPending && (
            <div className="absolute inset-0 bg-white/60 flex items-center justify-center rounded-full">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2" style={{ borderColor: TEAL }} />
            </div>
          )}
        </button>
        <p className="text-xs text-gray-400 mt-2">Toca para cambiar</p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleAvatarChange}
        />
      </div>

      {/* Crop modal */}
      {cropFile && (
        <AvatarCropModal
          imageFile={cropFile}
          onAccept={handleCropAccept}
          onCancel={() => setCropFile(null)}
          onChooseAnother={() => {
            setCropFile(null);
            fileInputRef.current?.click();
          }}
        />
      )}

      {/* Name fields */}
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Nombre</label>
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

        {/* Birth date + Gender */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Fecha de nacimiento</label>
            <DatePicker
              value={form.birthDate}
              onChange={(v) => setForm((f) => ({ ...f, birthDate: v }))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Género</label>
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

        {/* Allergies / Medical notes */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Alergias / Notas médicas
          </label>
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

        {/* Email */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-medium text-gray-500">Email</label>
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
            <p className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600">
              {user.email}
            </p>
          )}
        </div>

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

      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
      )}

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

      {/* Change password (collapsible) */}
      <div className="border-t border-gray-100 pt-4">
        <button
          onClick={() => setShowPasswordSection(!showPasswordSection)}
          className="w-full flex items-center justify-between"
        >
          <p className="text-sm font-medium text-gray-700">
            {user.socialProvider && !passwordForm.currentPassword ? 'Establecer contraseña' : 'Cambiar contraseña'}
          </p>
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

        {showPasswordSection && (
          <div className="mt-3 space-y-3">
            {user.socialProvider && (
              <p className="text-xs text-gray-400 bg-gray-50 px-3 py-2 rounded-lg">
                Tu cuenta está vinculada con {user.socialProvider === 'google' ? 'Google' : 'Facebook'}. Puedes establecer una contraseña para también iniciar sesión con email.
              </p>
            )}
            {!user.socialProvider && (
              <div>
                {otpStep === 'verified' ? (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm" style={{ backgroundColor: '#e0f2f1', color: TEAL }}>
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="font-medium">Identidad verificada por SMS</span>
                  </div>
                ) : (
                  <>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Contraseña actual</label>
                    <input
                      type="password"
                      value={passwordForm.currentPassword}
                      onChange={(e) => setPasswordForm((p) => ({ ...p, currentPassword: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:outline-none"
                      style={{ '--tw-ring-color': TEAL } as any}
                      disabled={otpStep !== 'idle'}
                    />

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

                    {otpStep === 'sent' && (
                      <div className="mt-2 space-y-2">
                        <p className="text-xs text-gray-500">Ingresa el código de 6 dígitos enviado a tu teléfono</p>
                        <div className="flex gap-2">
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
                {otpError && <p className="mt-1 text-xs text-red-600">{otpError}</p>}
              </div>
            )}
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

            {passwordError && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{passwordError}</p>
            )}

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

export default function MarketplaceSettingsPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading, refreshUser, logout } = useMarketplaceAuth();

  const [settings, setSettings] = useState({
    country: '',
    language: 'es',
    currency: 'LOCAL',
    searchRadius: 25,
    notifAppointments: true,
    notifPromotions: true,
    notifRewards: true,
    notifMessages: true,
  });
  const [hasChanges, setHasChanges] = useState(false);
  const [successPopup, setSuccessPopup] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showBreakModal, setShowBreakModal] = useState(false);
  const [breakDays, setBreakDays] = useState(30);
  const [suspendError, setSuspendError] = useState('');
  const [showSuspendSuccess, setShowSuspendSuccess] = useState(false);
  const [suspendedLabel, setSuspendedLabel] = useState('');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/marketplace/login?redirect=/marketplace/settings');
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (user) {
      setSettings({
        country: (user as any).country || '',
        language: (user as any).language || 'es',
        currency: (user as any).currency || 'LOCAL',
        searchRadius: (user as any).searchRadius || 25,
        notifAppointments: (user as any).notifAppointments ?? true,
        notifPromotions: (user as any).notifPromotions ?? true,
        notifRewards: (user as any).notifRewards ?? true,
        notifMessages: (user as any).notifMessages ?? true,
      });
    }
  }, [user]);

  const updateField = <K extends keyof typeof settings>(key: K, value: (typeof settings)[K]) => {
    setSettings((s) => ({ ...s, [key]: value }));
    setHasChanges(true);
  };

  const saveMutation = useMutation({
    mutationFn: () => marketplaceApi.put('/auth/settings', settings),
    onSuccess: () => {
      setSuccessPopup(true);
      setHasChanges(false);
      refreshUser();
    },
  });

  const suspendMutation = useMutation({
    mutationFn: (days: number) => marketplaceApi.post('/auth/suspend', { days }),
    onSuccess: () => {
      setShowBreakModal(false);
      setSuspendError('');
      const opt = BREAK_OPTIONS.find((o) => o.days === breakDays);
      setSuspendedLabel(opt?.label || `${breakDays} días`);
      setShowSuspendSuccess(true);
    },
    onError: (err: any) => {
      setSuspendError(err.message || 'Error al suspender la cuenta');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (password: string) => marketplaceApi.del('/auth/account', { password }),
    onSuccess: () => {
      setShowDeleteConfirm(false);
      logout();
      router.push('/marketplace');
    },
    onError: (err: any) => {
      setDeleteError(err.message || 'Error al eliminar la cuenta');
    },
  });

  // Get currency label for selected country
  const localCurrencyLabel = useMemo(() => {
    if (!settings.country) return 'Moneda local';
    const info = CURRENCY_BY_COUNTRY[settings.country];
    return info ? `${info.name} (${info.code})` : 'Moneda local';
  }, [settings.country]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: TEAL }} />
      </div>
    );
  }

  if (!isAuthenticated || !user) return null;

  return (
    <div className="min-h-screen bg-gray-50 safe-top">


      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.push('/marketplace/profile')}
            className="w-9 h-9 rounded-full flex items-center justify-center bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <h1 className="text-lg font-bold text-gray-900">Configuración</h1>
        </div>

        <div className="space-y-4">
          {/* ─── General ─────────────────────────────── */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" />
                </svg>
                General
              </h2>
            </div>

            <div className="divide-y divide-gray-100">
              {/* Country */}
              <div className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-700">País</p>
                    <p className="text-xs text-gray-400">Afecta moneda y formato</p>
                  </div>
                </div>
                <select
                  value={settings.country}
                  onChange={(e) => {
                    updateField('country', e.target.value);
                    // Auto-set currency to LOCAL when country changes
                    if (settings.currency !== 'USD') updateField('currency', 'LOCAL');
                  }}
                  className="mt-2 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#008080] focus:ring-1 focus:ring-[#008080] bg-white"
                >
                  <option value="">Seleccionar país</option>
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.label}</option>
                  ))}
                </select>
              </div>

              {/* Idioma: oculto en V1, se reactiva cuando soporte multi-idioma. */}

              {/* Currency */}
              <div className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-700">Moneda</p>
                  <p className="text-xs text-gray-400">Cómo ver los precios</p>
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => updateField('currency', 'LOCAL')}
                    className="px-3 py-1 rounded-full text-xs font-medium transition-colors"
                    style={
                      settings.currency === 'LOCAL'
                        ? { backgroundColor: TEAL, color: 'white' }
                        : { backgroundColor: '#f3f4f6', color: '#6b7280' }
                    }
                  >
                    {localCurrencyLabel}
                  </button>
                  <button
                    onClick={() => updateField('currency', 'USD')}
                    className="px-3 py-1 rounded-full text-xs font-medium transition-colors"
                    style={
                      settings.currency === 'USD'
                        ? { backgroundColor: TEAL, color: 'white' }
                        : { backgroundColor: '#f3f4f6', color: '#6b7280' }
                    }
                  >
                    US Dollar (USD)
                  </button>
                </div>
              </div>
            </div>
          </div>

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
                <span className="text-sm font-semibold" style={{ color: TEAL }}>{settings.searchRadius} km</span>
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {RADIUS_OPTIONS.map((r) => (
                  <button
                    key={r}
                    onClick={() => updateField('searchRadius', r)}
                    className="px-3 py-1 rounded-full text-xs font-medium transition-colors"
                    style={
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

          {/* ─── Notifications ───────────────────────── */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
                </svg>
                Notificaciones
              </h2>
            </div>

            <div className="divide-y divide-gray-100">
              {[
                { key: 'notifAppointments' as const, label: 'Recordatorios de citas', desc: 'Antes y después de tus citas' },
                { key: 'notifPromotions' as const, label: 'Ofertas y promociones', desc: 'Descuentos de negocios que visitas' },
                { key: 'notifRewards' as const, label: 'Puntos y recompensas', desc: 'Cuando ganas o puedes canjear puntos' },
                { key: 'notifMessages' as const, label: 'Mensajes directos', desc: 'Conversaciones con profesionales y negocios' },
              ].map((item) => (
                <div key={item.key} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-700">{item.label}</p>
                    <p className="text-xs text-gray-400">{item.desc}</p>
                  </div>
                  <button
                    onClick={() => updateField(item.key, !settings[item.key])}
                    className="relative w-11 h-6 rounded-full transition-colors flex-shrink-0"
                    style={{ backgroundColor: settings[item.key] ? TEAL : '#d1d5db' }}
                  >
                    <span
                      className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform"
                      style={{ transform: settings[item.key] ? 'translateX(20px)' : 'translateX(0)' }}
                    />
                  </button>
                </div>
              ))}
            </div>
          </div>

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

            <div className="divide-y divide-gray-100">
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

          <p className="text-center text-xs text-gray-300 pb-4">
            Siliba v1.0
          </p>
        </div>
      </div>

      {/* ─── Break modal ─────────────────────────── */}
      {showBreakModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setShowBreakModal(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 mx-4 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
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

            <div className="space-y-2 mb-5">
              {BREAK_OPTIONS.map((opt) => (
                <button
                  key={opt.days}
                  onClick={() => setBreakDays(opt.days)}
                  className="w-full px-4 py-2.5 rounded-xl text-sm font-medium text-left transition-colors flex items-center justify-between"
                  style={
                    breakDays === opt.days
                      ? { backgroundColor: TEAL_LIGHT, color: TEAL, border: `1.5px solid ${TEAL}` }
                      : { backgroundColor: '#f9fafb', color: '#374151', border: '1.5px solid #e5e7eb' }
                  }
                >
                  {opt.label}
                  {breakDays === opt.days && (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              ))}
            </div>

            {suspendError && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg mb-3">{suspendError}</p>
            )}

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
                style={{ backgroundColor: '#f59e0b' }}
              >
                {suspendMutation.isPending ? 'Procesando...' : 'Suspender cuenta'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Delete confirmation ─────────────────── */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => { setShowDeleteConfirm(false); setDeletePassword(''); setDeleteError(''); }}
        >
          <div
            className="bg-white rounded-2xl p-6 mx-4 max-w-sm w-full text-center"
            onClick={(e) => e.stopPropagation()}
          >
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
            {!(user as any).socialProvider && (
              <input
                type="password"
                value={deletePassword}
                onChange={(e) => { setDeletePassword(e.target.value); setDeleteError(''); }}
                placeholder="Confirma tu contraseña"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm mb-3 focus:ring-2 focus:ring-red-400 focus:border-red-400"
              />
            )}
            {deleteError && (
              <p className="text-xs text-red-600 mb-3">{deleteError}</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeletePassword(''); setDeleteError(''); }}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
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

      {/* ─── Suspend success modal ────────────── */}
      {showSuspendSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl p-6 mx-4 max-w-sm w-full text-center">
            <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: TEAL_LIGHT }}>
              <svg className="w-8 h-8" style={{ color: TEAL }} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Cuenta suspendida</h3>
            <p className="text-sm text-gray-500 mb-1">
              Tu cuenta ha sido suspendida por <span className="font-semibold text-gray-700">{suspendedLabel}</span>.
            </p>
            <p className="text-xs text-gray-400 mb-5">
              Puedes volver cuando quieras iniciando sesión.
            </p>
            <button
              onClick={() => {
                setShowSuspendSuccess(false);
                logout();
                router.push('/marketplace');
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

      <SuccessPopup
        show={successPopup}
        title="Configuración guardada"
        message="Tus preferencias se han actualizado correctamente"
        onClose={() => setSuccessPopup(false)}
      />
    </div>
  );
}
