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

type BookingStep = null | 'service' | 'employee' | 'datetime' | 'confirm' | 'success';

export default function BusinessDetailPage() {
  const { isAuthenticated } = useMarketplaceAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useParams();
  const searchParams = useSearchParams();
  const tenantSlug = params.tenantSlug as string;

  // Payment return handling
  const paymentStatus = searchParams.get('payment');

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

  const { data, isLoading } = useQuery({
    queryKey: ['marketplace-business', tenantSlug],
    queryFn: () => marketplaceApi.get<{ data: any }>(`/discover/${tenantSlug}`),
  });

  const biz = (data as any)?.data;

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
  const uniqueSlots = anyEmployee
    ? Array.from(new Map(slots.map((s) => [s.startTime, s])).values())
    : slots;

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
      const appointment = res.data || res;
      // If business accepts online payment, redirect to Stripe Checkout
      if (biz?.acceptsOnlinePayment && appointment?.id) {
        try {
          const checkoutRes: any = await marketplaceApi.post(`/checkout/${tenantSlug}`, {
            appointmentId: appointment.id,
          });
          if (checkoutRes?.data?.checkoutUrl) {
            window.location.href = checkoutRes.data.checkoutUrl;
            return;
          }
        } catch {
          // If checkout fails, still show success (appointment was created)
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
    // Reset booking state
    setSelectedServiceIds([]);
    setSelectedEmployee(null);
    setAnyEmployee(false);
    setSelectedDate(dayjs());
    setSelectedSlot(null);
    setBookingNotes('');
    setBookingStep('service');
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
    <div className="min-h-screen pb-24">
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
              <div className="mt-4 pt-3 border-t border-gray-100">
                {biz.locations.map((loc: any) => (
                  <div
                    key={loc.id}
                    className="flex items-start gap-2 text-sm text-gray-500"
                  >
                    <svg
                      className="w-4 h-4 mt-0.5 flex-shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
                      />
                    </svg>
                    <span>{loc.address || loc.name}</span>
                  </div>
                ))}
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

      {/* Floating CTA */}
      {!bookingStep && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3">
          <div className="max-w-2xl mx-auto">
            <button
              onClick={handleBook}
              className="w-full text-white py-3 rounded-xl font-medium text-sm transition-colors"
              style={{ backgroundColor: TEAL }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor = TEAL_DARK)
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = TEAL)
              }
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
                if (bookingStep === 'service') closeBooking();
                else if (bookingStep === 'employee') setBookingStep('service');
                else if (bookingStep === 'datetime') setBookingStep('employee');
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
                { key: 'service', label: 'Servicio' },
                { key: 'employee', label: 'Profesional' },
                { key: 'datetime', label: 'Horario' },
                { key: 'confirm', label: 'Confirmar' },
              ].map(({ key, label }, idx, arr) => (
                <div key={key} className="flex items-center gap-2 flex-1">
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0"
                      style={
                        stepIndex > idx
                          ? { backgroundColor: TEAL, color: '#fff' }
                          : stepIndex === idx
                            ? {
                                backgroundColor: TEAL_LIGHT,
                                color: TEAL,
                                border: `2px solid ${TEAL}`,
                              }
                            : { backgroundColor: '#f3f4f6', color: '#9ca3af' }
                      }
                    >
                      {stepIndex > idx ? '✓' : idx + 1}
                    </div>
                    <span
                      className="text-xs hidden sm:block"
                      style={{
                        color: stepIndex === idx ? TEAL : '#9ca3af',
                        fontWeight: stepIndex === idx ? 500 : 400,
                      }}
                    >
                      {label}
                    </span>
                  </div>
                  {idx < arr.length - 1 && (
                    <div
                      className="flex-1 h-0.5"
                      style={{
                        backgroundColor: stepIndex > idx ? TEAL : '#e5e7eb',
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-2xl mx-auto px-4 py-6">
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
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">
                    Selecciona fecha y hora
                  </h2>

                  {/* Mini calendar */}
                  <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
                    <div className="flex items-center justify-between mb-3">
                      <button
                        onClick={() =>
                          setSelectedDate((d) => d.subtract(1, 'month'))
                        }
                        className="p-1.5 rounded-lg hover:bg-gray-100"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 19l-7-7 7-7"
                          />
                        </svg>
                      </button>
                      <span className="text-sm font-semibold">
                        {selectedDate.format('MMMM YYYY')}
                      </span>
                      <button
                        onClick={() =>
                          setSelectedDate((d) => d.add(1, 'month'))
                        }
                        className="p-1.5 rounded-lg hover:bg-gray-100"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </button>
                    </div>
                    <div className="grid grid-cols-7 gap-1 text-center">
                      {['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'].map((d) => (
                        <div
                          key={d}
                          className="text-xs font-medium text-gray-400 py-1"
                        >
                          {d}
                        </div>
                      ))}
                      {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                        <div key={`empty-${i}`} />
                      ))}
                      {calendarDays.map((day) => {
                        const isToday = day.isSame(dayjs(), 'day');
                        const isPast = day.isBefore(dayjs(), 'day');
                        const isSelected = day.isSame(selectedDate, 'day');
                        return (
                          <button
                            key={day.format('YYYY-MM-DD')}
                            disabled={isPast}
                            onClick={() => {
                              setSelectedDate(day);
                              setSelectedSlot(null);
                            }}
                            className="text-sm py-1.5 rounded-lg transition-colors"
                            style={
                              isSelected
                                ? { backgroundColor: TEAL, color: '#fff' }
                                : isToday
                                  ? {
                                      backgroundColor: TEAL_LIGHT,
                                      color: TEAL,
                                      fontWeight: 600,
                                    }
                                  : isPast
                                    ? { color: '#d1d5db', cursor: 'not-allowed' }
                                    : { color: '#374151' }
                            }
                          >
                            {day.date()}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Time slots */}
                  <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">
                      Horarios disponibles —{' '}
                      {formatDate(selectedDate.toDate())}
                    </h3>
                    {slotsLoading ? (
                      <div className="grid grid-cols-4 gap-2">
                        {Array.from({ length: 8 }).map((_, i) => (
                          <div
                            key={i}
                            className="h-10 bg-gray-100 rounded-lg animate-pulse"
                          />
                        ))}
                      </div>
                    ) : uniqueSlots.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-4">
                        No hay horarios disponibles para esta fecha
                      </p>
                    ) : (
                      <div className="grid grid-cols-4 gap-2">
                        {uniqueSlots.map((slot) => {
                          const time = slot.startTime.substring(11, 16);
                          const isSlotSelected =
                            selectedSlot?.startTime === slot.startTime;
                          return (
                            <button
                              key={slot.startTime + slot.employeeId}
                              onClick={() => setSelectedSlot(slot)}
                              className="py-2 text-sm rounded-lg border transition-colors"
                              style={
                                isSlotSelected
                                  ? {
                                      backgroundColor: TEAL,
                                      color: '#fff',
                                      borderColor: TEAL,
                                    }
                                  : {
                                      borderColor: '#e5e7eb',
                                      color: '#374151',
                                    }
                              }
                            >
                              {formatTime(time)}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {selectedSlot && (
                    <button
                      onClick={() => setBookingStep('confirm')}
                      className="w-full text-white py-3 rounded-xl font-medium text-sm transition-colors mt-4"
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
                        <div className="flex items-center gap-2">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold overflow-hidden"
                            style={{
                              backgroundColor: selectedEmployee.color,
                            }}
                          >
                            {selectedEmployee.avatarUrl ? (
                              <img src={`${API_URL}${selectedEmployee.avatarUrl}`} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <>{selectedEmployee.firstName[0]}{selectedEmployee.lastName[0]}</>
                            )}
                          </div>
                          <span className="text-sm text-gray-700">
                            {selectedEmployee.firstName}{' '}
                            {selectedEmployee.lastName}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Duration & Total */}
                    <div className="border-t border-gray-100 pt-4">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-500">Duración</span>
                        <span className="font-medium text-gray-900">
                          {totalDuration} min
                        </span>
                      </div>
                      <div className="flex justify-between">
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

            <div className="bg-gray-50 rounded-xl p-4 text-left space-y-2 mb-6">
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
            </div>

            <div className="space-y-3">
              <button
                onClick={() => router.push('/marketplace/profile')}
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
