'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useMarketplaceAuth } from '@/lib/hooks/use-marketplace-auth';
import { marketplaceApi } from '@/lib/marketplace-api';
import { formatCurrency, formatDate, formatTime } from '@/lib/utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const TEAL = '#008080';
const TEAL_DARK = '#006666';
const TEAL_LIGHT = '#e0f2f1';

const DAY_LABELS: Record<string, string> = {
  MONDAY: 'Lunes',
  TUESDAY: 'Martes',
  WEDNESDAY: 'Miércoles',
  THURSDAY: 'Jueves',
  FRIDAY: 'Viernes',
  SATURDAY: 'Sábado',
  SUNDAY: 'Domingo',
};

interface BizService {
  id: string;
  name: string;
  description?: string;
  durationMinutes: number;
  price: number;
  color?: string;
  category?: string;
  subcategory?: string;
  pointsReward?: number | null;
}

interface BizEmployee {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  color: string;
  bio?: string;
  employeeServices?: { serviceId: string }[];
}

interface AvailableSlot {
  startTime: string;
  endTime: string;
  employeeId: string;
}

type BookingStep = null | 'location' | 'service' | 'employee' | 'datetime' | 'confirm' | 'success';

const DOW_MAP: Record<number, string> = {
  0: 'SUNDAY', 1: 'MONDAY', 2: 'TUESDAY', 3: 'WEDNESDAY',
  4: 'THURSDAY', 5: 'FRIDAY', 6: 'SATURDAY',
};

function parseTimeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + (m || 0);
}

function minutesToTimeStr(minutes: number): string {
  const h = Math.floor(minutes / 60).toString().padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

function SlotGrid({
  dateStr,
  availableSlots,
  selectedSlot,
  onSelect,
  businessHours,
  durationMinutes,
  preferredTime,
}: {
  dateStr: string;
  availableSlots: AvailableSlot[];
  selectedSlot: AvailableSlot | null;
  onSelect: (slot: AvailableSlot) => void;
  businessHours: any[];
  durationMinutes: number;
  preferredTime?: string;
}) {
  const dayOfWeek = dayjs(dateStr).day();
  const dayHours = businessHours?.find((h: any) => h.dayOfWeek === DOW_MAP[dayOfWeek]);

  // Build full list of 30-min slots from business hours
  const allSlots: { time: string; available: boolean; slot: AvailableSlot | null }[] = [];

  if (dayHours?.isOpen && dayHours.openTime && dayHours.closeTime) {
    const start = parseTimeToMinutes(dayHours.openTime);
    const end = parseTimeToMinutes(dayHours.closeTime) - durationMinutes;
    for (let m = start; m <= end; m += 30) {
      const timeStr = minutesToTimeStr(m);
      const matchingSlot = availableSlots.find((s) => {
        const slotTime = s.startTime.split('T')[1]?.substring(0, 5);
        return slotTime === timeStr;
      });
      allSlots.push({ time: timeStr, available: !!matchingSlot, slot: matchingSlot || null });
    }
  } else {
    // Fallback: only show available slots
    availableSlots.forEach((s) => {
      const timeStr = s.startTime.split('T')[1]?.substring(0, 5) || '';
      allSlots.push({ time: timeStr, available: true, slot: s });
    });
  }

  if (allSlots.length === 0) {
    return (
      <p className="text-sm text-gray-400 text-center py-8">
        No hay horarios disponibles para esta fecha
      </p>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-2 p-4">
      {allSlots.map(({ time, available, slot }) => {
        const isSelected = selectedSlot?.startTime?.includes(time);
        const isPreferred = !isSelected && preferredTime === time && available;
        return (
          <button
            key={time}
            disabled={!available}
            onClick={() => slot && onSelect(slot)}
            className="py-2.5 rounded-xl text-sm font-medium transition-all"
            style={
              isSelected
                ? { backgroundColor: '#006666', color: '#fff', boxShadow: '0 2px 8px rgba(0,128,128,0.35)' }
                : isPreferred
                  ? { backgroundColor: '#e0f2f1', color: '#008080', border: '2px solid #008080', boxShadow: '0 0 0 2px rgba(0,128,128,0.15)' }
                  : available
                    ? { backgroundColor: '#e0f2f1', color: '#008080', border: '1.5px solid #b2dfdb' }
                    : { backgroundColor: '#f3f4f6', color: '#d1d5db', cursor: 'not-allowed', textDecoration: 'line-through' }
            }
          >
            {time}
          </button>
        );
      })}
    </div>
  );
}

export default function BusinessDetailPage() {
  const { isAuthenticated } = useMarketplaceAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useParams();
  const searchParams = useSearchParams();
  const tenantSlug = params.tenantSlug as string;
  const bookEmployeeId = searchParams.get('bookEmployee');

  // Payment return handling
  const paymentStatus = searchParams.get('payment');
  const sessionId = searchParams.get('session_id');

  // Verify payment session on return from Stripe
  useEffect(() => {
    if (paymentStatus === 'success' && sessionId) {
      fetch(`${API_URL}/api/stripe/verify-session/${sessionId}`)
        .then((r) => r.json())
        .catch(() => {});
    }
  }, [paymentStatus, sessionId]);

  // Booking flow state
  const [bookingStep, setBookingStep] = useState<BookingStep>(
    paymentStatus === 'success' ? 'success' : null,
  );
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<BizEmployee | null>(null);
  const [anyEmployee, setAnyEmployee] = useState(false);
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [bookingNotes, setBookingNotes] = useState('');
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [preferredTime, setPreferredTime] = useState('');
  const [showFullCalendar, setShowFullCalendar] = useState(false);
  const [userGps, setUserGps] = useState<{ lat: number; lng: number } | null>(null);

  // Try to get user location for "nearest branch" hint
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserGps({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {},
        { timeout: 5000 },
      );
    }
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ['marketplace-business', tenantSlug],
    queryFn: () => marketplaceApi.get<{ data: any }>(`/discover/${tenantSlug}`),
  });

  const biz = (data as any)?.data;

  // Pre-select employee from URL param (from professional profile)
  useEffect(() => {
    if (!bookEmployeeId || !biz) return;
    const emp = (biz.employees || []).find((e: BizEmployee) => e.id === bookEmployeeId);
    if (emp) {
      setSelectedEmployee(emp);
      setAnyEmployee(false);
      setBookingStep('service');
    }
  }, [bookEmployeeId, biz]);

  // Availability query
  const { data: slotsData, isLoading: slotsLoading } = useQuery({
    queryKey: [
      'marketplace-slots',
      tenantSlug,
      selectedDate.format('YYYY-MM-DD'),
      selectedServiceIds,
      selectedEmployee?.id,
    ],
    queryFn: async () => {
      const dateStr = selectedDate.format('YYYY-MM-DD');
      const res = await fetch(`${API_URL}/api/public/${tenantSlug}/availability`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: dateStr,
          endDate: dateStr,
          serviceIds: selectedServiceIds,
          employeeId: anyEmployee ? undefined : selectedEmployee?.id,
        }),
      });
      if (!res.ok) throw new Error('Error al cargar horarios');
      return res.json();
    },
    enabled: bookingStep === 'datetime' && selectedServiceIds.length > 0,
  });

  // Flatten availability response
  const rawSlots = (slotsData as any)?.data || [];
  const slots: AvailableSlot[] = [];
  if (Array.isArray(rawSlots)) {
    for (const day of rawSlots) {
      if (day.employees) {
        for (const emp of day.employees) {
          for (const slot of emp.slots) {
            slots.push({
              startTime: `${day.date}T${slot.startTime}:00`,
              endTime: `${day.date}T${slot.endTime}:00`,
              employeeId: emp.id,
            });
          }
        }
      } else if (day.startTime) {
        slots.push(day);
      }
    }
  }
  // Deduplicate slots by startTime (when anyEmployee, multiple employees can have same slot)
  const deduped = anyEmployee
    ? Array.from(new Map(slots.map((s) => [s.startTime, s])).values())
    : slots;

  // Filter out past slots when selected date is today
  const now = new Date();
  const uniqueSlots = deduped.filter((s) => new Date(s.startTime) > now);

  // Business rewards
  const { data: bizRewardsData } = useQuery({
    queryKey: ['marketplace-biz-rewards', tenantSlug],
    queryFn: () => marketplaceApi.get<{ data: any[] }>(`/${tenantSlug}/rewards`),
    enabled: !!tenantSlug,
  });
  const bizRewards: any[] = (bizRewardsData as any)?.data || [];

  // Booking mutation
  const bookMutation = useMutation({
    mutationFn: () =>
      marketplaceApi.post(`/book/${tenantSlug}`, {
        serviceIds: selectedServiceIds,
        employeeId: selectedSlot?.employeeId || selectedEmployee?.id,
        startTime: selectedSlot?.startTime,
        notes: bookingNotes || undefined,
      }),
    onSuccess: async (res: any) => {
      const appointment = res?.data?.data || res?.data || res;
      // If business accepts online payment, redirect to Stripe Checkout
      if (biz?.acceptsOnlinePayment && appointment?.id) {
        try {
          const checkoutRes: any = await marketplaceApi.post(`/checkout/${tenantSlug}`, {
            appointmentId: appointment.id,
            returnUrl: window.location.origin,
          });
          if (checkoutRes?.data?.checkoutUrl) {
            window.location.href = checkoutRes.data.checkoutUrl;
            return;
          }
        } catch (err: any) {
          console.error('Checkout error:', err);
          // Show success but note that payment is pending
          setBookingStep('success');
          return;
        }
      }
      setBookingStep('success');
    },
  });

  // Favorite state
  const [isFavorited, setIsFavorited] = useState(false);

  // Sync isFavorited from biz data
  useEffect(() => {
    if (biz) setIsFavorited(!!biz.isFavorited);
  }, [biz]);

  const favMutation = useMutation({
    mutationFn: () =>
      marketplaceApi.post<{ data: { favorited: boolean } }>(`/favorites/${tenantSlug}`),
    onMutate: () => {
      setIsFavorited((prev) => !prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['marketplace-business', tenantSlug] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-my-favorites'] });
    },
  });

  const handleToggleFavorite = () => {
    if (!isAuthenticated) {
      router.push(`/marketplace/login?redirect=/marketplace/${tenantSlug}`);
      return;
    }
    favMutation.mutate();
  };

  const [redeemResult, setRedeemResult] = useState<{ code: string; name: string } | null>(null);

  const redeemMutation = useMutation({
    mutationFn: (rewardId: string) =>
      marketplaceApi.post('/rewards/redeem', {
        rewardId,
        tenantSlug,
      }),
    onSuccess: (res: any) => {
      const result = res?.data || res;
      setRedeemResult({ code: result.code, name: result.reward?.name || 'Recompensa' });
      queryClient.invalidateQueries({ queryKey: ['marketplace-biz-rewards', tenantSlug] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-my-stats'] });
    },
  });

  const handleBook = () => {
    if (!isAuthenticated) {
      router.push(`/marketplace/login?redirect=/marketplace/${tenantSlug}`);
      return;
    }
    setSelectedServiceIds([]);
    setSelectedEmployee(null);
    setAnyEmployee(false);
    setSelectedDate(dayjs());
    setSelectedSlot(null);
    setBookingNotes('');
    setSelectedLocationId(null);
    setPreferredTime('');
    // If multiple locations, show location selection first
    const locations = biz?.locations || [];
    setBookingStep(locations.length > 1 ? 'location' : 'service');
  };

  const closeBooking = () => {
    setBookingStep(null);
  };

  // Gallery carousel
  const gallery: { id: string; imageUrl: string; caption?: string }[] = biz?.gallery || [];
  const carouselRef = useRef<HTMLDivElement>(null);
  const [galleryLightbox, setGalleryLightbox] = useState<{ imageUrl: string; caption?: string } | null>(null);

  function scrollCarousel(direction: 'left' | 'right') {
    if (!carouselRef.current) return;
    const scrollAmount = 296; // card width + gap
    carouselRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  }

  // Derived data
  const services: BizService[] = biz?.services || [];
  const employees: BizEmployee[] = biz?.employees || [];
  const selectedServices = services.filter((s) => selectedServiceIds.includes(s.id));
  const totalPrice = selectedServices.reduce((sum, s) => sum + Number(s.price), 0);
  const totalDuration = selectedServices.reduce((sum, s) => sum + s.durationMinutes, 0);
  const totalPointsEarned = selectedServices.reduce((sum, s) => sum + (s.pointsReward || 0), 0);

  // Filter employees by selected services
  const availableEmployees = employees.filter((emp) =>
    selectedServiceIds.every((sid) =>
      emp.employeeServices?.some((es) => es.serviceId === sid),
    ),
  );

  // Calendar helpers
  const startOfMonth = selectedDate.startOf('month');
  const daysInMonth = selectedDate.daysInMonth();
  const firstDayOfWeek = startOfMonth.day();
  const calendarDays = Array.from({ length: daysInMonth }, (_, i) =>
    startOfMonth.add(i, 'day'),
  );

  const stepIndex = ['service', 'employee', 'datetime', 'confirm'].indexOf(
    bookingStep || '',
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div
          className="animate-spin rounded-full h-8 w-8 border-b-2"
          style={{ borderBottomColor: TEAL }}
        />
      </div>
    );
  }

  if (!biz) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-400">Negocio no encontrado</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-36 safe-top">
      {/* Payment cancelled banner */}
      {paymentStatus === 'cancelled' && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 text-center">
          <p className="text-sm text-amber-800">
            El pago fue cancelado. Tu cita sigue reservada — puedes pagar en el establecimiento.
          </p>
        </div>
      )}

      {/* Header / Cover */}
      <div className="relative">
        <div
          className="h-48"
          style={{ background: `linear-gradient(to right, ${TEAL}, ${TEAL_DARK})` }}
        >
          {biz.coverImageUrl && (
            <img
              src={`${API_URL}${biz.coverImageUrl}`}
              alt=""
              className="w-full h-full object-cover"
            />
          )}
        </div>
        <button
          onClick={() => router.push('/marketplace')}
          className="absolute top-4 left-4 p-2 bg-white/80 backdrop-blur rounded-full hover:bg-white transition-colors"
        >
          <svg
            className="w-5 h-5 text-gray-700"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button
          onClick={handleToggleFavorite}
          className="absolute top-4 right-4 p-2 bg-white/80 backdrop-blur rounded-full hover:bg-white transition-colors"
          title={isFavorited ? 'Quitar de favoritos' : 'Guardar en favoritos'}
        >
          <svg
            className="w-5 h-5"
            fill={isFavorited ? '#008080' : 'none'}
            stroke={isFavorited ? '#008080' : '#6b7280'}
            viewBox="0 0 24 24"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
          </svg>
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-4 -mt-6 relative">
        {/* Business info card */}
        <div className="bg-white rounded-xl border border-gray-200 mb-4">
          <div className="p-5">
            <div className="flex items-start gap-4">
              <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0 -mt-12 border-4 border-white shadow-md z-20 relative">
                {biz.logoUrl ? (
                  <img
                    src={`${API_URL}${biz.logoUrl}`}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-2xl font-bold text-gray-400">{biz.name[0]}</span>
                )}
              </div>
              <div className="flex-1">
                <h1 className="text-lg font-bold text-gray-900">{biz.name}</h1>
                {biz.businessType && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {biz.businessType.split(',').map((type: string) => (
                      <span
                        key={type}
                        className="inline-block px-2 py-0.5 text-xs font-medium rounded-full"
                        style={{ backgroundColor: TEAL_LIGHT, color: TEAL }}
                      >
                        {type === 'SALON'
                          ? 'Salón'
                          : type === 'BARBERIA'
                            ? 'Barbería'
                            : type === 'CLINICA'
                              ? 'Clínica'
                              : type}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {biz.description && (
              <p className="text-sm text-gray-600 mt-4">{biz.description}</p>
            )}

            {biz.locations?.length > 0 && (
              <div className="mt-5 pt-4 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                  Sucursales · {biz.locations.length}
                </p>
                <div className="space-y-2">
                  {(() => {
                    // Calculate distance for each location if user GPS available
                    const locsWithDist = biz.locations.map((loc: any) => {
                      let distKm: number | null = null;
                      if (userGps && loc.latitude && loc.longitude) {
                        const R = 6371;
                        const dLat = ((loc.latitude - userGps.lat) * Math.PI) / 180;
                        const dLng = ((loc.longitude - userGps.lng) * Math.PI) / 180;
                        const a =
                          Math.sin(dLat / 2) ** 2 +
                          Math.cos((userGps.lat * Math.PI) / 180) *
                            Math.cos((loc.latitude * Math.PI) / 180) *
                            Math.sin(dLng / 2) ** 2;
                        distKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                      }
                      return { ...loc, distKm };
                    });

                    const nearestId =
                      locsWithDist.filter((l: any) => l.distKm !== null).length > 0
                        ? locsWithDist.reduce((a: any, b: any) =>
                            (a.distKm ?? Infinity) < (b.distKm ?? Infinity) ? a : b,
                          ).id
                        : null;

                    return locsWithDist.map((loc: any) => (
                      <div
                        key={loc.id}
                        className={`flex items-start gap-3 rounded-xl p-3 border transition-colors ${
                          loc.id === nearestId
                            ? 'border-teal-200 bg-teal-50/60'
                            : 'border-gray-100 bg-gray-50/50'
                        }`}
                      >
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                          style={{ backgroundColor: loc.id === nearestId ? '#e0f2f1' : '#f3f4f6' }}
                        >
                          <svg
                            className="w-3.5 h-3.5"
                            style={{ color: loc.id === nearestId ? TEAL : '#9ca3af' }}
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={2}
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-gray-800">{loc.name}</span>
                            {loc.id === nearestId && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: TEAL }}>
                                Más cercana
                              </span>
                            )}
                            {loc.distKm !== null && (
                              <span className="text-[11px] text-gray-400">
                                {loc.distKm < 1
                                  ? `${Math.round(loc.distKm * 1000)} m`
                                  : `${loc.distKm.toFixed(1)} km`}
                              </span>
                            )}
                          </div>
                          {loc.address && (
                            <p className="text-xs text-gray-500 mt-0.5 truncate">{loc.address}</p>
                          )}
                          {loc.phone && (
                            <a href={`tel:${loc.phone}`} className="text-xs mt-0.5 block" style={{ color: TEAL }}>
                              {loc.phone}
                            </a>
                          )}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold" style={{ color: TEAL }}>
              {biz.averageRating != null ? biz.averageRating : '--'}
            </p>
            <p className="text-xs text-gray-500 mt-1">Puntuacion</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold" style={{ color: TEAL }}>
              {biz.completedAppointments || 0}
            </p>
            <p className="text-xs text-gray-500 mt-1">Servicios realizados</p>
          </div>
          <button
            type="button"
            onClick={() => document.getElementById('reviews-section')?.scrollIntoView({ behavior: 'smooth' })}
            className="bg-white rounded-xl border border-gray-200 p-4 text-center transition-all hover:shadow-md"
          >
            <p className="text-2xl font-bold" style={{ color: TEAL }}>
              {biz.totalReviews || 0}
            </p>
            <p className="text-xs text-gray-500 mt-1">Reseñas</p>
          </button>
        </div>

        {/* Gallery Carousel */}
        {gallery.length >= 3 && (
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Fotos del establecimiento</h2>
            <div className="relative">
              {/* Left arrow */}
              <button
                type="button"
                onClick={() => scrollCarousel('left')}
                className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white/90 backdrop-blur rounded-full shadow-md flex items-center justify-center text-gray-600 hover:bg-white transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              {/* Scrollable container */}
              <div
                ref={carouselRef}
                className="flex gap-3 overflow-x-auto scroll-smooth snap-x snap-mandatory scrollbar-hide pb-1"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                {gallery.map((img) => (
                  <div
                    key={img.id}
                    className="snap-start flex-shrink-0 w-[280px] h-[200px] rounded-xl overflow-hidden cursor-pointer"
                    onClick={() => setGalleryLightbox(img)}
                  >
                    <img
                      src={`${API_URL}${img.imageUrl}`}
                      alt={img.caption || 'Foto del establecimiento'}
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                ))}
              </div>

              {/* Right arrow */}
              <button
                type="button"
                onClick={() => scrollCarousel('right')}
                className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white/90 backdrop-blur rounded-full shadow-md flex items-center justify-center text-gray-600 hover:bg-white transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Services grouped by subcategory */}
        {services.length > 0 && (() => {
          const grouped: Record<string, BizService[]> = {};
          services.forEach((s) => {
            const key = s.subcategory || 'Otros';
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(s);
          });
          const groups = Object.entries(grouped);
          const hasSubcategories = groups.length > 1 || groups[0]?.[0] !== 'Otros';

          return (
            <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">Servicios</h2>
              {hasSubcategories ? (
                <div className="space-y-4">
                  {groups.map(([subcategory, svcList]) => (
                    <div key={subcategory}>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                        {subcategory}
                      </p>
                      <div className="space-y-2 pl-3 border-l-2 border-gray-100">
                        {svcList.map((s) => (
                          <div key={s.id} className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-gray-900">{s.name}</p>
                              <p className="text-xs text-gray-500">{s.durationMinutes} min</p>
                            </div>
                            <span className="text-sm font-semibold text-gray-900">
                              {formatCurrency(Number(s.price))}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {services.map((s) => (
                    <div key={s.id} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{s.name}</p>
                        <p className="text-xs text-gray-500">{s.durationMinutes} min</p>
                      </div>
                      <span className="text-sm font-semibold text-gray-900">
                        {formatCurrency(Number(s.price))}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {/* Employees carousel */}
        {employees.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Profesionales</h2>
            <div className="flex gap-4 overflow-x-auto pb-2 scroll-smooth snap-x snap-mandatory" style={{ scrollbarWidth: 'none' }}>
              {employees.map((emp) => (
                <Link
                  key={emp.id}
                  href={`/marketplace/${tenantSlug}/professional/${emp.id}`}
                  className="flex flex-col items-center flex-shrink-0 snap-start group"
                  style={{ minWidth: 80 }}
                >
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center text-white text-lg font-bold overflow-hidden ring-2 ring-transparent group-hover:ring-[#008080] transition-all"
                    style={{ backgroundColor: emp.color }}
                  >
                    {emp.avatarUrl ? (
                      <img
                        src={`${API_URL}${emp.avatarUrl}`}
                        alt={`${emp.firstName} ${emp.lastName}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <>
                        {emp.firstName[0]}
                        {emp.lastName[0]}
                      </>
                    )}
                  </div>
                  <p className="text-xs font-medium text-gray-900 mt-1.5 text-center truncate w-full">
                    {emp.firstName}
                  </p>
                  <p className="text-[10px] text-gray-500 text-center truncate w-full">
                    {emp.lastName}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Rewards */}
        {bizRewards.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Recompensas</h2>
            <div className="space-y-2">
              {bizRewards.map((reward: any) => (
                <div key={reward.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-100">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900 truncate">{reward.name}</p>
                      <span className={`flex-shrink-0 px-1.5 py-0.5 text-[10px] font-medium rounded-full ${
                        reward.type === 'SERVICIO' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                        {reward.type === 'SERVICIO' ? 'Servicio' : 'Descuento'}
                      </span>
                    </div>
                    {reward.description && (
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{reward.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                    <span className="text-xs font-semibold" style={{ color: TEAL }}>{reward.pointsRequired} pts</span>
                    {isAuthenticated && (
                      <button
                        onClick={() => {
                          if (confirm(`¿Canjear "${reward.name}" por ${reward.pointsRequired} puntos?`)) {
                            redeemMutation.mutate(reward.id);
                          }
                        }}
                        disabled={redeemMutation.isPending}
                        className="px-3 py-1 text-xs font-medium text-white rounded-full transition-colors"
                        style={{ backgroundColor: TEAL }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = TEAL_DARK)}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = TEAL)}
                      >
                        Canjear
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {redeemMutation.isError && (
              <div className="mt-2 p-2 rounded-lg bg-red-50 text-red-700 text-xs">
                {(redeemMutation.error as any)?.message || 'Error al canjear'}
              </div>
            )}
          </div>
        )}

        {/* Redeem success modal */}
        {redeemResult && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setRedeemResult(null)}>
            <div className="bg-white rounded-2xl p-6 mx-4 max-w-sm w-full text-center" onClick={(e) => e.stopPropagation()}>
              <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: TEAL_LIGHT }}>
                <svg className="w-8 h-8" style={{ color: TEAL }} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">Recompensa canjeada</h3>
              <p className="text-sm text-gray-500 mb-4">{redeemResult.name}</p>
              <div className="p-3 rounded-lg mb-4" style={{ backgroundColor: TEAL_LIGHT }}>
                <p className="text-xs text-gray-500 mb-1">Tu código de cupón</p>
                <p className="text-2xl font-mono font-bold tracking-widest" style={{ color: TEAL }}>{redeemResult.code}</p>
              </div>
              <p className="text-xs text-gray-400 mb-4">Muestra este código al personal del negocio</p>
              <button
                onClick={() => setRedeemResult(null)}
                className="w-full py-2.5 text-white rounded-xl text-sm font-medium"
                style={{ backgroundColor: TEAL }}
              >
                Aceptar
              </button>
            </div>
          </div>
        )}

        {/* Business Hours */}
        {biz.businessHours?.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Horario</h2>
            <div className="space-y-1.5">
              {biz.businessHours.map((h: any) => (
                <div
                  key={h.id}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-gray-600">
                    {DAY_LABELS[h.dayOfWeek] || h.dayOfWeek}
                  </span>
                  {h.isOpen ? (
                    <span className="text-gray-900 font-medium">
                      {h.openTime} - {h.closeTime}
                    </span>
                  ) : (
                    <span className="text-gray-400">Cerrado</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reviews */}
        {biz.reviews?.length > 0 && (
          <div id="reviews-section" className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">
              Reseñas recientes
            </h2>
            <div className="space-y-4">
              {biz.reviews.map((r: any) => (
                <div
                  key={r.id}
                  className="border-b border-gray-50 last:border-b-0 pb-3 last:pb-0"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-900">
                      {r.clientName}
                    </span>
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <svg
                          key={star}
                          className={`w-3.5 h-3.5 ${star <= r.rating ? 'text-amber-400' : 'text-gray-200'}`}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                  </div>
                  {r.comment && (
                    <p className="text-xs text-gray-500">{r.comment}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">Con {r.employeeName}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Floating CTA — sits above the bottom nav (bottom-20 = 5rem) */}
      {!bookingStep && (
        <div className="fixed bottom-20 left-0 right-0 px-4 pointer-events-none">
          <div className="max-w-2xl mx-auto pointer-events-auto">
            <button
              onClick={handleBook}
              className="w-full text-white py-3 rounded-2xl font-semibold text-sm transition-colors shadow-lg"
              style={{ backgroundColor: TEAL, boxShadow: '0 4px 16px rgba(0,128,128,0.4)' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = TEAL_DARK)}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = TEAL)}
            >
              Reservar cita
            </button>
          </div>
        </div>
      )}

      {/* ─── BOOKING OVERLAY ─────────────────────────────── */}
      {bookingStep && bookingStep !== 'success' && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col">
          {/* Booking header */}
          <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
            <button
              onClick={() => {
                if (bookingStep === 'location') closeBooking();
                else if (bookingStep === 'service') {
                  if ((biz?.locations || []).length > 1) setBookingStep('location');
                  else closeBooking();
                }
                else if (bookingStep === 'employee') setBookingStep('service');
                else if (bookingStep === 'datetime') {
                  if (bookEmployeeId) setBookingStep('service'); // came from professional profile
                  else setBookingStep('employee');
                }
                else if (bookingStep === 'confirm') setBookingStep('datetime');
              }}
              className="p-1 hover:bg-gray-100 rounded-lg"
            >
              <svg
                className="w-6 h-6 text-gray-600"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <h1 className="text-lg font-semibold text-gray-900 flex-1">
              Reservar cita
            </h1>
            <button
              onClick={closeBooking}
              className="p-1 hover:bg-gray-100 rounded-lg"
            >
              <svg
                className="w-6 h-6 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Progress bar */}
          <div className="bg-white border-b border-gray-100 px-4 py-3">
            <div className="max-w-2xl mx-auto flex items-center gap-2">
              {[
                ...(biz?.locations?.length > 1 ? [{ key: 'location', label: 'Sucursal' }] : []),
                { key: 'service', label: 'Servicio' },
                ...(!bookEmployeeId ? [{ key: 'employee', label: 'Profesional' }] : []),
                { key: 'datetime', label: 'Horario' },
                { key: 'confirm', label: 'Confirmar' },
              ].map(({ key, label }, idx, arr) => {
                const activeSteps = arr.map(s => s.key);
                const currentIdx = activeSteps.indexOf(bookingStep || '');
                const thisIdx = idx;
                return (
                  <div key={key} className="flex items-center gap-2 flex-1">
                    <div className="flex items-center gap-1.5">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0"
                        style={
                          currentIdx > thisIdx
                            ? { backgroundColor: '#008080', color: '#fff' }
                            : currentIdx === thisIdx
                              ? { backgroundColor: '#e0f2f1', color: '#008080', border: '2px solid #008080' }
                              : { backgroundColor: '#f3f4f6', color: '#9ca3af' }
                        }
                      >
                        {currentIdx > thisIdx ? '✓' : thisIdx + 1}
                      </div>
                      <span
                        className="text-xs hidden sm:block"
                        style={{
                          color: currentIdx === thisIdx ? '#008080' : '#9ca3af',
                          fontWeight: currentIdx === thisIdx ? 500 : 400,
                        }}
                      >
                        {label}
                      </span>
                    </div>
                    {idx < arr.length - 1 && (
                      <div className="flex-1 h-0.5" style={{ backgroundColor: currentIdx > thisIdx ? '#008080' : '#e5e7eb' }} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-2xl mx-auto px-4 py-6">

              {/* Step 0: Location */}
              {bookingStep === 'location' && (() => {
                const locations = biz?.locations || [];
                const locsWithDist = locations.map((loc: any) => {
                  let distKm: number | null = null;
                  if (userGps && loc.latitude && loc.longitude) {
                    const R = 6371;
                    const dLat = ((loc.latitude - userGps.lat) * Math.PI) / 180;
                    const dLng = ((loc.longitude - userGps.lng) * Math.PI) / 180;
                    const a = Math.sin(dLat / 2) ** 2 + Math.cos((userGps.lat * Math.PI) / 180) * Math.cos((loc.latitude * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
                    distKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                  }
                  return { ...loc, distKm };
                }).sort((a: any, b: any) => (a.distKm ?? Infinity) - (b.distKm ?? Infinity));

                return (
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 mb-1">Selecciona la sucursal</h2>
                    <p className="text-sm text-gray-500 mb-4">¿A cuál sucursal deseas ir?</p>
                    <div className="grid gap-3">
                      {locsWithDist.map((loc: any, idx: number) => (
                        <button
                          key={loc.id}
                          onClick={() => { setSelectedLocationId(loc.id); setBookingStep('service'); }}
                          className="w-full text-left p-4 rounded-xl border-2 transition-all"
                          style={selectedLocationId === loc.id
                            ? { borderColor: TEAL, backgroundColor: TEAL_LIGHT }
                            : { borderColor: '#e5e7eb', backgroundColor: '#fff' }}
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                              style={{ backgroundColor: idx === 0 && loc.distKm !== null ? TEAL_LIGHT : '#f3f4f6' }}>
                              <svg className="w-5 h-5" style={{ color: idx === 0 && loc.distKm !== null ? TEAL : '#9ca3af' }} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                              </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-medium text-gray-900">{loc.name}</p>
                                {idx === 0 && loc.distKm !== null && (
                                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: TEAL }}>Más cercana</span>
                                )}
                                {loc.distKm !== null && (
                                  <span className="text-xs text-gray-400">
                                    {loc.distKm < 1 ? `${Math.round(loc.distKm * 1000)} m` : `${loc.distKm.toFixed(1)} km`}
                                  </span>
                                )}
                              </div>
                              {loc.address && <p className="text-sm text-gray-500 mt-0.5">{loc.address}</p>}
                              {loc.phone && <p className="text-xs mt-0.5" style={{ color: TEAL }}>{loc.phone}</p>}
                            </div>
                            {selectedLocationId === loc.id && (
                              <svg className="w-5 h-5 flex-shrink-0" style={{ color: TEAL }} fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                              </svg>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Step 1: Services */}
              {bookingStep === 'service' && (() => {
                const grouped: Record<string, BizService[]> = {};
                services.forEach((s) => {
                  const key = s.subcategory || 'Otros';
                  if (!grouped[key]) grouped[key] = [];
                  grouped[key].push(s);
                });
                const groups = Object.entries(grouped);
                const hasSubcategories = groups.length > 1 || groups[0]?.[0] !== 'Otros';

                const renderServiceButton = (service: BizService) => {
                  const isSelected = selectedServiceIds.includes(service.id);
                  return (
                    <button
                      key={service.id}
                      onClick={() =>
                        setSelectedServiceIds((prev) =>
                          isSelected
                            ? prev.filter((id) => id !== service.id)
                            : [...prev, service.id],
                        )
                      }
                      className="w-full text-left p-4 rounded-xl border-2 transition-all"
                      style={
                        isSelected
                          ? { borderColor: TEAL, backgroundColor: TEAL_LIGHT }
                          : { borderColor: '#e5e7eb', backgroundColor: '#fff' }
                      }
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-lg flex-shrink-0"
                          style={{
                            backgroundColor: service.color || TEAL,
                          }}
                        />
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">
                            {service.name}
                          </p>
                          {service.description && (
                            <p className="text-sm text-gray-500">
                              {service.description}
                            </p>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-semibold text-gray-900">
                            {formatCurrency(Number(service.price))}
                          </p>
                          <p className="text-xs text-gray-500">
                            {service.durationMinutes} min
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                };

                return (
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">
                    Selecciona el servicio
                  </h2>
                  {hasSubcategories ? (
                    <div className="space-y-5">
                      {groups.map(([subcategory, svcList]) => (
                        <div key={subcategory}>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                            {subcategory}
                          </p>
                          <div className="grid gap-3">
                            {svcList.map(renderServiceButton)}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      {services.map(renderServiceButton)}
                    </div>
                  )}

                  {selectedServiceIds.length > 0 && (
                    <div className="mt-6 p-4 bg-white rounded-xl border border-gray-200">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm text-gray-600">
                          {selectedServiceIds.length} servicio
                          {selectedServiceIds.length !== 1 ? 's' : ''}
                        </span>
                        <span className="text-sm font-semibold">
                          {totalDuration} min · {formatCurrency(totalPrice)}
                        </span>
                      </div>
                      <button
                        onClick={() => setBookingStep('employee')}
                        className="w-full text-white py-3 rounded-xl font-medium text-sm transition-colors"
                        style={{ backgroundColor: TEAL }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.backgroundColor = TEAL_DARK)
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.backgroundColor = TEAL)
                        }
                      >
                        Continuar
                      </button>
                    </div>
                  )}
                </div>
                );
              })()}

              {/* Step 2: Employee */}
              {bookingStep === 'employee' && (
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">
                    Selecciona el profesional
                  </h2>
                  <div className="grid gap-3">
                    {/* Any employee option */}
                    <button
                      onClick={() => {
                        setSelectedEmployee(null);
                        setAnyEmployee(true);
                        setSelectedSlot(null);
                        setBookingStep('datetime');
                      }}
                      className="w-full text-left p-4 rounded-xl border-2 transition-all"
                      style={{ borderColor: '#e5e7eb', backgroundColor: '#fff' }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-xl flex-shrink-0">
                          ✨
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            Cualquier profesional disponible
                          </p>
                          <p className="text-sm text-gray-500">
                            Te asignaremos el mejor disponible
                          </p>
                        </div>
                      </div>
                    </button>

                    {availableEmployees.map((emp) => (
                      <button
                        key={emp.id}
                        onClick={() => {
                          setSelectedEmployee(emp);
                          setAnyEmployee(false);
                          setSelectedSlot(null);
                          setBookingStep('datetime');
                        }}
                        className="w-full text-left p-4 rounded-xl border-2 transition-all"
                        style={{ borderColor: '#e5e7eb', backgroundColor: '#fff' }}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-12 h-12 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 overflow-hidden"
                            style={{ backgroundColor: emp.color }}
                          >
                            {emp.avatarUrl ? (
                              <img src={`${API_URL}${emp.avatarUrl}`} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <>{emp.firstName[0]}{emp.lastName[0]}</>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900">
                              {emp.firstName} {emp.lastName}
                            </p>
                            {emp.bio && (
                              <p className="text-sm text-gray-500 line-clamp-1">{emp.bio}</p>
                            )}
                          </div>
                          <Link
                            href={`/marketplace/${tenantSlug}/professional/${emp.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-[11px] text-[#008080] font-medium hover:underline flex-shrink-0"
                          >
                            Ver perfil
                          </Link>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 3: Date & Time */}
              {bookingStep === 'datetime' && (
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Selecciona fecha y hora</h2>

                  {/* Employee info */}
                  <div className="flex items-center gap-3 mb-4 p-3 bg-gray-50 rounded-xl border border-gray-100">
                    {anyEmployee ? (
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-xl flex-shrink-0">✨</div>
                    ) : selectedEmployee ? (
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold overflow-hidden flex-shrink-0" style={{ backgroundColor: selectedEmployee.color }}>
                        {selectedEmployee.avatarUrl
                          ? <img src={`${API_URL}${selectedEmployee.avatarUrl}`} alt="" className="w-full h-full object-cover" />
                          : <>{selectedEmployee.firstName[0]}{selectedEmployee.lastName[0]}</>}
                      </div>
                    ) : null}
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {anyEmployee ? 'Cualquier profesional disponible' : selectedEmployee ? `${selectedEmployee.firstName} ${selectedEmployee.lastName}` : ''}
                      </p>
                      <p className="text-xs text-gray-400">{totalDuration} min · {formatCurrency(totalPrice)}</p>
                    </div>
                  </div>

                  {/* Preferred time */}
                  <div className="mb-4 p-3 rounded-xl border" style={{ backgroundColor: '#fffbeb', borderColor: '#fde68a' }}>
                    <p className="text-xs font-medium mb-2" style={{ color: '#92400e' }}>¿Tienes algún horario de preferencia?</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={preferredTime}
                        onChange={(e) => setPreferredTime(e.target.value)}
                        className="flex-1 text-sm border rounded-lg px-3 py-1.5 bg-white focus:outline-none"
                        style={{ borderColor: '#fcd34d' }}
                        onFocus={(e) => { e.currentTarget.style.borderColor = TEAL; e.currentTarget.style.boxShadow = `0 0 0 2px rgba(0,128,128,0.2)`; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = '#fcd34d'; e.currentTarget.style.boxShadow = 'none'; }}
                      />
                      {preferredTime && (
                        <button onClick={() => setPreferredTime('')} className="text-xs px-2 py-1 rounded-lg hover:bg-amber-100" style={{ color: '#b45309' }}>✕</button>
                      )}
                    </div>
                    {preferredTime && (() => {
                      const pref = preferredTime.substring(0, 5);
                      const found = uniqueSlots.find(s => s.startTime.split('T')[1]?.startsWith(pref));
                      if (found) return <p className="text-xs mt-1.5 font-medium" style={{ color: '#065f46' }}>✓ Las {pref} está disponible — aparece destacado abajo</p>;
                      const alts = uniqueSlots.slice(0, 3).map(s => s.startTime.split('T')[1]?.substring(0, 5));
                      return alts.length > 0
                        ? <p className="text-xs mt-1.5" style={{ color: '#92400e' }}>Las {pref} no está disponible. Opciones cercanas: {alts.join(', ')}</p>
                        : null;
                    })()}
                  </div>

                  {/* Date selector row */}
                  <div className="flex items-center gap-2 mb-4">
                    <div className="flex-1 flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2.5">
                      <button
                        disabled={selectedDate.isSame(dayjs(), 'day')}
                        onClick={() => { setSelectedDate((d) => d.subtract(1, 'day')); setSelectedSlot(null); }}
                        className="p-1 rounded-lg hover:bg-gray-100 disabled:opacity-30"
                      >
                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                      </button>
                      <div className="flex-1 text-center">
                        <p className="text-sm font-semibold text-gray-900">
                          {selectedDate.isSame(dayjs(), 'day') ? 'Hoy' : selectedDate.isSame(dayjs().add(1, 'day'), 'day') ? 'Mañana' : selectedDate.format('dddd')}
                        </p>
                        <p className="text-xs text-gray-400">{selectedDate.format('D [de] MMMM')}</p>
                      </div>
                      <button
                        onClick={() => { setSelectedDate((d) => d.add(1, 'day')); setSelectedSlot(null); }}
                        className="p-1 rounded-lg hover:bg-gray-100"
                      >
                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      </button>
                    </div>
                    <button
                      onClick={() => setShowFullCalendar(true)}
                      className="w-11 h-11 flex items-center justify-center rounded-xl border border-gray-200 bg-white hover:bg-gray-50 flex-shrink-0"
                    >
                      <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z" />
                      </svg>
                    </button>
                  </div>

                  {/* Slot grid */}
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-700">
                        {uniqueSlots.length > 0 ? `${uniqueSlots.length} horarios disponibles` : 'Sin horarios disponibles'}
                      </span>
                      <span className="text-xs text-gray-400">{totalDuration} min</span>
                    </div>
                    {slotsLoading ? (
                      <div className="p-4 grid grid-cols-3 gap-2">
                        {Array.from({ length: 9 }).map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded-xl animate-pulse" />)}
                      </div>
                    ) : (
                      <SlotGrid
                        dateStr={selectedDate.format('YYYY-MM-DD')}
                        availableSlots={uniqueSlots}
                        selectedSlot={selectedSlot}
                        onSelect={setSelectedSlot}
                        businessHours={biz?.businessHours || []}
                        durationMinutes={totalDuration || 30}
                        preferredTime={preferredTime}
                      />
                    )}
                  </div>

                  {selectedSlot && (
                    <button
                      onClick={() => setBookingStep('confirm')}
                      className="w-full text-white py-3 rounded-xl font-medium text-sm transition-colors mt-4"
                      style={{ backgroundColor: TEAL }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = TEAL_DARK)}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = TEAL)}
                    >
                      Continuar
                    </button>
                  )}

                  {/* Full calendar modal */}
                  {showFullCalendar && (
                    <div className="fixed inset-0 z-[60] flex items-end justify-center" style={{ touchAction: 'none' }}>
                      <div className="absolute inset-0 bg-black/40" onClick={() => setShowFullCalendar(false)} />
                      <div className="relative w-full max-w-lg bg-white rounded-t-2xl shadow-xl p-5">
                        <div className="flex justify-center mb-4"><div className="w-10 h-1 bg-gray-300 rounded-full" /></div>
                        <div className="flex items-center justify-between mb-3">
                          <button onClick={() => setSelectedDate((d) => d.subtract(1, 'month'))} className="p-1.5 rounded-lg hover:bg-gray-100">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                          </button>
                          <span className="text-sm font-semibold">{selectedDate.format('MMMM YYYY')}</span>
                          <button onClick={() => setSelectedDate((d) => d.add(1, 'month'))} className="p-1.5 rounded-lg hover:bg-gray-100">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                          </button>
                        </div>
                        <div className="grid grid-cols-7 gap-1 text-center">
                          {['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'].map((d) => (
                            <div key={d} className="text-xs font-medium text-gray-400 py-1">{d}</div>
                          ))}
                          {Array.from({ length: firstDayOfWeek }).map((_, i) => <div key={`e-${i}`} />)}
                          {calendarDays.map((day) => {
                            const isToday = day.isSame(dayjs(), 'day');
                            const isPast = day.isBefore(dayjs(), 'day');
                            const isSelected = day.isSame(selectedDate, 'day');
                            return (
                              <button
                                key={day.format('YYYY-MM-DD')}
                                disabled={isPast}
                                onClick={() => { setSelectedDate(day); setSelectedSlot(null); setShowFullCalendar(false); }}
                                className="text-sm py-1.5 rounded-lg transition-colors"
                                style={
                                  isSelected ? { backgroundColor: TEAL, color: '#fff' }
                                  : isToday ? { backgroundColor: TEAL_LIGHT, color: TEAL, fontWeight: 600 }
                                  : isPast ? { color: '#d1d5db', cursor: 'not-allowed' }
                                  : { color: '#374151' }
                                }
                              >
                                {day.date()}
                              </button>
                            );
                          })}
                        </div>
                        <button onClick={() => setShowFullCalendar(false)} className="mt-4 w-full py-2.5 rounded-xl text-sm font-medium text-white" style={{ backgroundColor: TEAL }}>
                          Cerrar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Step 4: Confirm */}
              {bookingStep === 'confirm' && selectedSlot && (
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">
                    Confirma tu reserva
                  </h2>

                  <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4 mb-4">
                    {/* Services */}
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                        Servicios
                      </p>
                      {selectedServices.map((s) => (
                        <div
                          key={s.id}
                          className="flex justify-between text-sm py-0.5"
                        >
                          <span className="text-gray-700">{s.name}</span>
                          <span className="font-medium">
                            {formatCurrency(Number(s.price))}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Date & Time */}
                    <div className="border-t border-gray-100 pt-4">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                        Fecha y hora
                      </p>
                      <p className="text-sm text-gray-700">
                        {formatDate(
                          selectedSlot.startTime,
                          'dddd, D [de] MMMM YYYY',
                        )}{' '}
                        · {formatTime(selectedSlot.startTime.substring(11, 16))}
                      </p>
                    </div>

                    {/* Professional */}
                    {!anyEmployee && selectedEmployee && (
                      <div className="border-t border-gray-100 pt-4">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                          Profesional
                        </p>
                        <div className="flex items-center gap-3">
                          <div
                            className="w-12 h-12 rounded-full flex items-center justify-center text-white text-sm font-bold overflow-hidden flex-shrink-0"
                            style={{ backgroundColor: selectedEmployee.color }}
                          >
                            {selectedEmployee.avatarUrl ? (
                              <img src={`${API_URL}${selectedEmployee.avatarUrl}`} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <>{selectedEmployee.firstName[0]}{selectedEmployee.lastName[0]}</>
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {selectedEmployee.firstName}{' '}{selectedEmployee.lastName}
                            </p>
                            <p className="text-xs text-gray-500">{biz?.name}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Duration, Total & Points */}
                    <div className="border-t border-gray-100 pt-4">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-500">Duración</span>
                        <span className="font-medium text-gray-900">
                          {totalDuration} min
                        </span>
                      </div>
                      <div className="flex justify-between mb-1">
                        <span className="font-semibold text-gray-900">
                          Total
                        </span>
                        <span
                          className="font-bold text-lg"
                          style={{ color: TEAL }}
                        >
                          {formatCurrency(totalPrice)}
                        </span>
                      </div>
                      {totalPointsEarned > 0 && (
                        <div className="flex items-center justify-between text-sm bg-amber-50 rounded-lg px-3 py-2 mt-2">
                          <span className="text-amber-700 font-medium flex items-center gap-1">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                            Ganarás con esta reserva
                          </span>
                          <span className="font-bold text-amber-800">+{totalPointsEarned} pts</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Notes */}
                  <textarea
                    value={bookingNotes}
                    onChange={(e) => setBookingNotes(e.target.value)}
                    placeholder="Notas adicionales (opcional)"
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm resize-none h-20 focus:ring-2 mb-4"
                    style={
                      {
                        '--tw-ring-color': TEAL,
                      } as any
                    }
                  />

                  {bookMutation.isError && (
                    <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
                      {(bookMutation.error as any)?.message ||
                        'Error al confirmar la reserva. Por favor intenta de nuevo.'}
                    </div>
                  )}

                  <button
                    onClick={() => bookMutation.mutate()}
                    disabled={bookMutation.isPending}
                    className="w-full text-white py-3 rounded-xl font-medium text-sm disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                    style={{ backgroundColor: TEAL }}
                    onMouseEnter={(e) => {
                      if (!bookMutation.isPending)
                        e.currentTarget.style.backgroundColor = TEAL_DARK;
                    }}
                    onMouseLeave={(e) => {
                      if (!bookMutation.isPending)
                        e.currentTarget.style.backgroundColor = TEAL;
                    }}
                  >
                    {bookMutation.isPending && (
                      <svg
                        className="animate-spin h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                    )}
                    {bookMutation.isPending
                      ? 'Confirmando...'
                      : biz?.acceptsOnlinePayment
                        ? 'Confirmar y Pagar'
                        : 'Confirmar Reserva'}
                  </button>
                  {biz?.acceptsOnlinePayment && (
                    <p className="text-center text-xs text-gray-400 mt-2">
                      Serás redirigido a Stripe para completar el pago de forma segura
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── SUCCESS SCREEN ──────────────────────────────── */}
      {bookingStep === 'success' && (
        <div className="fixed inset-0 z-50 bg-white flex items-center justify-center px-4">
          <div className="max-w-md w-full text-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: TEAL_LIGHT }}
            >
              <svg
                className="w-8 h-8"
                style={{ color: TEAL }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {paymentStatus === 'success' ? 'Pago confirmado' : 'Reserva confirmada'}
            </h2>
            <p className="text-gray-500 mb-6">
              {paymentStatus === 'success'
                ? 'Tu pago se ha procesado y tu cita ha sido reservada exitosamente.'
                : 'Tu cita ha sido reservada exitosamente.'}
            </p>

            {/* Show booking details only when state is available (direct booking, not Stripe return) */}
            {!paymentStatus && selectedServices.length > 0 && (
              <div className="bg-gray-50 rounded-xl p-4 text-left space-y-2 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Negocio:</span>
                  <span className="font-medium">{biz?.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Servicios:</span>
                  <span className="font-medium text-right">
                    {selectedServices.map((s) => s.name).join(', ')}
                  </span>
                </div>
                {selectedSlot && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Fecha y hora:</span>
                    <span className="font-medium">
                      {formatDate(selectedSlot.startTime)},{' '}
                      {formatTime(selectedSlot.startTime.substring(11, 16))}
                    </span>
                  </div>
                )}
                {!anyEmployee && selectedEmployee && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Profesional:</span>
                    <span className="font-medium">
                      {selectedEmployee.firstName} {selectedEmployee.lastName}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm border-t border-gray-200 pt-2">
                  <span className="font-semibold text-gray-900">Total:</span>
                  <span className="font-bold" style={{ color: TEAL }}>
                    {formatCurrency(totalPrice)}
                  </span>
                </div>
                {totalPointsEarned > 0 && (
                  <div className="flex items-center justify-between text-sm bg-amber-50 rounded-lg px-3 py-2">
                    <span className="text-amber-700 font-medium flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      Puntos ganados
                    </span>
                    <span className="font-bold text-amber-800">+{totalPointsEarned} pts</span>
                  </div>
                )}
              </div>
            )}

            {/* Stripe return — simplified confirmation */}
            {paymentStatus === 'success' && (
              <div className="bg-green-50 rounded-xl p-4 text-center mb-6">
                <div className="flex items-center justify-center gap-2 text-green-700">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                  <span className="text-sm font-semibold">Pago procesado correctamente</span>
                </div>
                <p className="text-xs text-green-600 mt-1">Recibirás un recibo por correo electrónico</p>
              </div>
            )}

            <div className="space-y-3">
              <button
                onClick={() => router.push('/marketplace/appointments')}
                className="w-full text-white py-3 rounded-xl font-medium text-sm transition-colors"
                style={{ backgroundColor: TEAL }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = TEAL_DARK)
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = TEAL)
                }
              >
                Ver mis citas
              </button>
              <button
                onClick={closeBooking}
                className="w-full py-3 rounded-xl font-medium text-sm text-gray-600 hover:bg-gray-100 transition-colors"
              >
                Volver al negocio
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Gallery lightbox */}
      {galleryLightbox && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setGalleryLightbox(null)}
        >
          <div
            className="relative max-w-3xl max-h-[85vh] w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={`${API_URL}${galleryLightbox.imageUrl}`}
              alt={galleryLightbox.caption || ''}
              className="w-full h-full object-contain rounded-lg"
            />
            {galleryLightbox.caption && (
              <p className="text-white text-sm mt-2 text-center">{galleryLightbox.caption}</p>
            )}
            <button
              type="button"
              onClick={() => setGalleryLightbox(null)}
              className="absolute top-2 right-2 p-2 bg-white/20 text-white rounded-full hover:bg-white/30 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
