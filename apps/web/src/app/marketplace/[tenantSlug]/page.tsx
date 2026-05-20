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
  currency?: string;
  color?: string;
  category?: string;
  subcategory?: string;
  pointsReward?: number | null;
  redeemableWithPoints?: boolean;
  pointsRequired?: number | null;
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

type BookingStep = null | 'location' | 'service' | 'promotion' | 'employee' | 'datetime' | 'products' | 'confirm' | 'success';

interface BizPromotion {
  id: string;
  name: string;
  description?: string;
  // Tipo unificado de Reward (origen real en BD)
  type: 'SERVICIO' | 'DESCUENTO' | 'TWO_FOR_ONE';
  // Para DESCUENTO: PERCENTAGE | FLAT
  discountMode?: 'PERCENTAGE' | 'FLAT' | null;
  // Monto del descuento (para DESCUENTO)
  discountAmount?: number | null;
  code?: string;
  startDate?: string;
  endDate?: string;
  validUntil?: string | null;
  pointsRequired?: number | null;
  maxRedemptions?: number | null;
  timesRedeemed?: number;
  serviceIds?: string[];
  service?: { id: string; name: string } | null;
  allowPointPayment?: boolean;
}

interface BookingCartItem {
  id: string;
  name: string;
  price: number;
  currency: string;
  imageUrl?: string;
  quantity: number;
}

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
  const { isAuthenticated, user } = useMarketplaceAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useParams();
  const searchParams = useSearchParams();
  const tenantSlug = params.tenantSlug as string;
  const bookEmployeeId = searchParams.get('bookEmployee');

  // Referral code from shared link
  const refFromUrl = searchParams.get('ref');
  const [refModal, setRefModal] = useState<string | null>(null);
  const [refSenderName, setRefSenderName] = useState<string | null>(null);
  const [refServiceNames, setRefServiceNames] = useState<string[]>([]);

  useEffect(() => {
    if (refFromUrl) {
      const code = refFromUrl.toUpperCase();
      setReferralCodeInput(code);
      setRefModal(code);
      localStorage.setItem(`ref_${tenantSlug}`, code);
      // Fetch referral info to get sender name
      fetch(`${API_URL}/api/marketplace/referral/${code}`)
        .then((r) => r.json())
        .then((res) => {
          if (res?.data?.generatedBy) setRefSenderName(res.data.generatedBy);
          if (res?.data?.serviceNames) setRefServiceNames(res.data.serviceNames);
        })
        .catch(() => {});
    } else if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`ref_${tenantSlug}`);
      if (saved) {
        setReferralCodeInput(saved);
      }
    }
  }, [refFromUrl, tenantSlug]);

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
  const [selectedBundle, setSelectedBundle] = useState<any>(null);
  const [serviceTab, setServiceTab] = useState<'servicios' | 'paquetes'>('servicios');
  // `selectedPromotion` ya no es state propio: se deriva de `selectedCoupon`
  // (el RewardRedemption aplicado). Mantenemos la variable con el mismo
  // nombre para no tocar todo el render del confirm/success, pero la fuente
  // de verdad es selectedCoupon. Ver bloque que la calcula mas abajo.
  const [referralCodeInput, setReferralCodeInput] = useState('');
  const [earnedReferralCode, setEarnedReferralCode] = useState<string | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<BizEmployee | null>(null);
  const [anyEmployee, setAnyEmployee] = useState(false);
  const [serviceEmployeeMap, setServiceEmployeeMap] = useState<Record<string, string>>({});
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [bookingNotes, setBookingNotes] = useState('');
  const [selectedCoupon, setSelectedCoupon] = useState<any>(null);
  const [payWithPoints, setPayWithPoints] = useState(false);
  const [bookingCart, setBookingCart] = useState<BookingCartItem[]>([]);
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
      Object.keys(serviceEmployeeMap).length > 0 ? JSON.stringify(serviceEmployeeMap) : null,
    ],
    queryFn: async () => {
      const dateStr = selectedDate.format('YYYY-MM-DD');

      if (Object.keys(serviceEmployeeMap).length > 1) {
        // Multi-employee: query each employee's availability separately, then intersect
        const uniqueEmpIds = [...new Set(Object.values(serviceEmployeeMap))];
        const empServiceMap: Record<string, string[]> = {};
        for (const [sid, eid] of Object.entries(serviceEmployeeMap)) {
          if (!empServiceMap[eid]) empServiceMap[eid] = [];
          empServiceMap[eid].push(sid);
        }

        // Query availability for each employee with their services
        const results = await Promise.all(
          uniqueEmpIds.map(async (empId) => {
            const empSvcIds = empServiceMap[empId];
            const res = await fetch(`${API_URL}/api/public/${tenantSlug}/availability`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ startDate: dateStr, endDate: dateStr, serviceIds: empSvcIds, employeeId: empId }),
            });
            if (!res.ok) return { data: [] };
            const json = await res.json();
            return { empId, slots: json.data || [] };
          }),
        );

        // Find slots where ALL employees are available at sequential times
        // Use first employee's slots as base, check others are free offset by cumulative duration
        const svcDurations: Record<string, number> = {};
        for (const sid of selectedServiceIds) {
          const svc = services.find((s) => s.id === sid);
          svcDurations[sid] = svc?.durationMinutes || 30;
        }

        const firstEmpId = uniqueEmpIds[0];
        const firstResult = results.find((r: any) => r.empId === firstEmpId);
        const firstSlots = firstResult?.slots || [];

        // For each slot of the first employee, check if subsequent employees are free
        const validSlots: any[] = [];
        for (const slot of firstSlots) {
          const startTime = slot.startTime;
          let currentOffset = 0;
          let allFree = true;

          // Calculate cumulative offset per employee in service order
          for (const sid of selectedServiceIds) {
            const empId = serviceEmployeeMap[sid];
            const duration = svcDurations[sid];
            const slotStartMin = parseInt(startTime.split('T')[1]?.split(':')[0] || startTime.split(':')[0]) * 60 +
              parseInt(startTime.split('T')[1]?.split(':')[1] || startTime.split(':')[1]);
            const neededStartMin = slotStartMin + currentOffset;
            const neededEndMin = neededStartMin + duration;

            // Check if this employee has availability covering this window
            const empResult = results.find((r: any) => r.empId === empId);
            const empSlots = empResult?.slots || [];
            const hasCoverage = empSlots.some((es: any) => {
              const esStart = parseInt(es.startTime.split('T')[1]?.split(':')[0] || es.startTime.split(':')[0]) * 60 +
                parseInt(es.startTime.split('T')[1]?.split(':')[1] || es.startTime.split(':')[1]);
              const esEnd = parseInt(es.endTime.split('T')[1]?.split(':')[0] || es.endTime.split(':')[0]) * 60 +
                parseInt(es.endTime.split('T')[1]?.split(':')[1] || es.endTime.split(':')[1]);
              return esStart <= neededStartMin && esEnd >= neededEndMin;
            });

            if (!hasCoverage) { allFree = false; break; }
            currentOffset += duration;
          }

          if (allFree) {
            validSlots.push({ ...slot, employeeId: firstEmpId, employeeName: slot.employeeName });
          }
        }

        return { data: validSlots };
      }

      // Single employee or any employee
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

  // Query all employees' availability when user has a preferred time and a specific employee selected
  const { data: allEmpSlotsData } = useQuery({
    queryKey: [
      'marketplace-slots-all',
      tenantSlug,
      selectedDate.format('YYYY-MM-DD'),
      selectedServiceIds,
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
        }),
      });
      if (!res.ok) throw new Error('Error al cargar horarios');
      return res.json();
    },
    enabled: bookingStep === 'datetime' && selectedServiceIds.length > 0 && !anyEmployee && !!selectedEmployee && !!preferredTime,
  });

  // Flatten availability response
  const flattenSlots = (raw: any): AvailableSlot[] => {
    const result: AvailableSlot[] = [];
    const data = raw?.data || [];
    if (Array.isArray(data)) {
      for (const day of data) {
        if (day.employees) {
          for (const emp of day.employees) {
            for (const slot of emp.slots) {
              result.push({
                startTime: `${day.date}T${slot.startTime}:00`,
                endTime: `${day.date}T${slot.endTime}:00`,
                employeeId: emp.id,
              });
            }
          }
        } else if (day.startTime) {
          result.push(day);
        }
      }
    }
    return result;
  };

  const slots = flattenSlots(slotsData);
  // Deduplicate slots by startTime (when anyEmployee, multiple employees can have same slot)
  const deduped = anyEmployee
    ? Array.from(new Map(slots.map((s) => [s.startTime, s])).values())
    : slots;

  // Filter out past slots when selected date is today
  const now = new Date();
  const uniqueSlots = deduped.filter((s) => new Date(s.startTime) > now);

  // All employees' slots (for cross-employee suggestion)
  const allEmpSlots = flattenSlots(allEmpSlotsData).filter((s) => new Date(s.startTime) > now);

  // Business rewards
  const { data: bizRewardsData } = useQuery({
    queryKey: ['marketplace-biz-rewards', tenantSlug],
    queryFn: () => marketplaceApi.get<{ data: any[] }>(`/${tenantSlug}/rewards`),
    enabled: !!tenantSlug,
  });
  const bizRewards: any[] = (bizRewardsData as any)?.data || [];

  // Shop products for booking flow
  const { data: shopProductsData } = useQuery({
    queryKey: ['shop-products-booking', tenantSlug],
    queryFn: async () => {
      const r = await fetch(`${API_URL}/api/public/${tenantSlug}/shop/products?perPage=100`);
      return r.ok ? r.json() : null;
    },
    enabled: !!biz?.shopEnabled,
  });
  const shopProducts: any[] = shopProductsData?.data || [];

  // User's active coupons for this business
  const { data: userCouponsData } = useQuery({
    queryKey: ['user-coupons', tenantSlug],
    queryFn: () => marketplaceApi.get<{ data: any[] }>('/my-rewards'),
    enabled: !!user,
  });
  const userCoupons = (userCouponsData?.data || []).filter(
    (r: any) => r.status === 'ACTIVE' && r.tenant?.slug === tenantSlug,
  );

  // User's points for this business
  const { data: userStatsData } = useQuery({
    queryKey: ['user-stats-booking'],
    queryFn: () => marketplaceApi.get<{ data: any }>('/my-stats'),
    enabled: !!user,
  });
  const myPointsHere = ((userStatsData as any)?.data?.pointsByTenant || []).find((t: any) => t.tenantSlug === tenantSlug)?.points || 0;

  const bookingCartTotal = bookingCart.reduce((s, c) => s + Number(c.price) * c.quantity, 0);

  // Booking mutation
  const bookMutation = useMutation({
    mutationFn: async () => {
      const assignments = Object.keys(serviceEmployeeMap).length > 1
        ? selectedServiceIds.map((sid) => ({ serviceId: sid, employeeId: serviceEmployeeMap[sid] })).filter((a) => a.employeeId)
        : undefined;

      const apptRes: any = await marketplaceApi.post(`/book/${tenantSlug}`, {
        serviceIds: selectedServiceIds,
        employeeId: selectedSlot?.employeeId || selectedEmployee?.id,
        // Mandamos el startTime tal cual viene del slot
        // ("YYYY-MM-DDTHH:mm:00" sin TZ). El backend trabaja con horas como
        // "hora del negocio" en UTC raw — los slots de availability tambien
        // se generan asi. Si convirtieramos a UTC absoluto aqui, romperia
        // la comparacion con los slots y permitiria reservar a la misma
        // hora que una cita existente.
        startTime: selectedSlot?.startTime,
        notes: bookingNotes || undefined,
        // selectedCoupon es un RewardRedemption: regalo, canje previo o
        // canje recien hecho en el step "Cupones". Mandamos solo el codigo;
        // ya no usamos promotionId porque todo cupon vive en RewardRedemption.
        couponCode: selectedCoupon?.code || undefined,
        referralCode: referralCodeInput.trim() || undefined,
        payWithPoints: payWithPoints || undefined,
        serviceAssignments: assignments,
      });

      // Also create product reservations if cart has items
      const appointmentId = apptRes?.data?.data?.id || apptRes?.data?.id;
      if (bookingCart.length > 0) {
        try {
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          const token = marketplaceApi.getAccessToken();
          if (token) headers['Authorization'] = `Bearer ${token}`;
          await fetch(`${API_URL}/api/public/${tenantSlug}/shop/reserve-batch`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              items: bookingCart.map((c) => ({ productId: c.id, quantity: c.quantity })),
              customerName: user ? `${user.firstName} ${user.lastName}` : 'Cliente',
              customerPhone: user?.phone || '0000000',
              customerEmail: user?.email || undefined,
              fulfillmentType: 'PICKUP',
              preferredPaymentMethod: 'CASH',
              appointmentId: appointmentId || undefined,
              notes: appointmentId
                ? `Apartado junto con cita del ${new Date(selectedSlot?.startTime || '').toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`
                : undefined,
            }),
          });
        } catch (err) {
          console.error('Error creating product reservations:', err);
        }
      }

      return apptRes;
    },
    onSuccess: async (res: any) => {
      const appointment = res?.data?.data || res?.data || res;

      // Capture referral code from TWO_FOR_ONE promotions
      const refCode = appointment?.referralCode || res?.data?.referralCode;
      if (refCode) {
        setEarnedReferralCode(refCode);
      }

      // Clear referral code from localStorage after successful booking
      if (referralCodeInput.trim()) {
        localStorage.removeItem(`ref_${tenantSlug}`);
      }

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

  // Estado de feedback al canjear puntos por cupon dentro del step "Cupones"
  const [redeemFeedback, setRedeemFeedback] = useState<{ name: string; code: string } | null>(null);
  const [redeemError, setRedeemError] = useState<string | null>(null);

  // Limpiar feedback al salir del step "Cupones" o al cambiar servicios
  useEffect(() => {
    if (bookingStep !== 'promotion') {
      setRedeemFeedback(null);
      setRedeemError(null);
    }
  }, [bookingStep]);
  useEffect(() => {
    setRedeemFeedback(null);
    setRedeemError(null);
    // Si el cupon aplicado ya no aplica a los servicios elegidos, limpiarlo
    // (solo el caso SERVICIO depende del set de servicios; DESCUENTO aplica
    // siempre, TWO_FOR_ONE conserva su referral aunque cambien servicios).
    setSelectedCoupon((current: any) => {
      if (!current?.reward) return current;
      const reward = current.reward;
      if (reward.type === 'SERVICIO') {
        const svcId = reward.service?.id || reward.serviceId;
        if (!svcId || !selectedServiceIds.includes(svcId)) return null;
      }
      return current;
    });
  }, [selectedServiceIds]);

  const redeemRewardMutation = useMutation({
    mutationFn: ({ rewardId }: { rewardId: string }) =>
      marketplaceApi.post<{ data: any }>('/rewards/redeem', { rewardId, tenantSlug }),
    onSuccess: (res: any) => {
      const redemption = res?.data?.data || res?.data || res;
      if (redemption?.id) {
        setSelectedCoupon(redemption);
        setRedeemFeedback({
          name: redemption.reward?.name || 'Cupon',
          code: redemption.code || '',
        });
        setRedeemError(null);
      }
      queryClient.invalidateQueries({ queryKey: ['user-coupons', tenantSlug] });
      queryClient.invalidateQueries({ queryKey: ['user-stats-booking'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-biz-rewards', tenantSlug] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || 'No se pudo canjear el cupon';
      setRedeemError(typeof msg === 'string' ? msg : 'No se pudo canjear el cupon');
    },
  });

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
      const savedRef = localStorage.getItem(`ref_${tenantSlug}`);
      const redirect = savedRef
        ? `/marketplace/${tenantSlug}%3Fref%3D${savedRef}`
        : `/marketplace/${tenantSlug}`;
      router.push(`/marketplace/login?redirect=${redirect}`);
      return;
    }
    const savedRef = localStorage.getItem(`ref_${tenantSlug}`);
    setSelectedServiceIds([]);
    setSelectedBundle(null);
    setSelectedCoupon(null);
    setReferralCodeInput(savedRef || '');
    setEarnedReferralCode(null);
    setSelectedEmployee(null);
    setAnyEmployee(false);
    setSelectedDate(dayjs());
    setSelectedSlot(null);
    setBookingNotes('');
    setBookingCart([]);
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
  const bizCurrency: string = biz?.currency || 'USD';
  const services: BizService[] = biz?.services || [];
  const bizBundles: any[] = biz?.bundles || [];
  // Catalogo de rewards del negocio (canjeables por puntos). Fuente: endpoint
  // /:tenantSlug/rewards. Lo mapeamos al shape BizPromotion porque el resto
  // del flow del booking ya razona con ese shape.
  const bizPromotions: BizPromotion[] = (bizRewards || []).map((r: any) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    type: r.type as BizPromotion['type'],
    discountMode: r.discountMode,
    discountAmount: r.discountAmount == null ? null : Number(r.discountAmount),
    code: r.code,
    validUntil: r.validUntil,
    pointsRequired: r.pointsRequired,
    maxRedemptions: r.maxRedemptions,
    timesRedeemed: r.timesRedeemed,
    serviceIds: Array.isArray(r.serviceIds) ? r.serviceIds : [],
    service: r.service || null,
  }));
  const employees: BizEmployee[] = biz?.employees || [];
  const selectedServices = services.filter((s) => selectedServiceIds.includes(s.id));

  // IDs de rewards que el usuario ya canjeo y siguen activos — evitamos
  // mostrarlos como canjeables (ya estan en "Tus cupones").
  const userActiveRewardIds = new Set(
    (userCoupons as any[])
      .filter((r: any) => r?.status === 'ACTIVE' && r?.rewardId)
      .map((r: any) => r.rewardId as string),
  );

  // Cupones del negocio (catalogo) aplicables a los servicios elegidos.
  // - SERVICIO: aplica si reward.service.id esta entre los servicios elegidos.
  // - DESCUENTO/TWO_FOR_ONE: aplica solo si serviceIds tiene IDs explicitos
  //   que matchean. Si serviceIds vacios se considera NO configurada y NO
  //   aparece (evita cupones "globales" que confunden).
  const applicablePromotions = (() => {
    if (selectedServiceIds.length === 0) return [];
    return bizPromotions
      .filter((p) => !userActiveRewardIds.has(p.id))
      .filter((p) => {
        if (p.type === 'SERVICIO') {
          return !!p.service?.id && selectedServiceIds.includes(p.service.id);
        }
        const pIds = p.serviceIds || [];
        if (pIds.length === 0) return false;
        return pIds.some((id) => selectedServiceIds.includes(id));
      });
  })();

  // Cupones del USUARIO activos que aplican (regalos del negocio o canjes
  // previos). Mismo criterio que los del catalogo: SERVICIO por service.id,
  // DESCUENTO siempre aplica. No filtramos TWO_FOR_ONE de userCoupons porque
  // esos se manejan como referrals separados.
  const userApplicableCoupons = (userCoupons as any[]).filter((r: any) => {
    const reward = r?.reward;
    if (!reward) return false;
    if (r.expiresAt && new Date(r.expiresAt) < new Date()) return false;
    if (selectedServiceIds.length === 0) return false;
    if (reward.type === 'SERVICIO') {
      return !!reward.service?.id && selectedServiceIds.includes(reward.service.id);
    }
    if (reward.type === 'DESCUENTO') return true;
    return false;
  });

  const basePrice = selectedBundle
    ? Number(selectedBundle.bundlePrice)
    : selectedServices.reduce((sum, s) => sum + Number(s.price), 0);
  const totalDuration = selectedServices.reduce((sum, s) => sum + s.durationMinutes, 0);
  const totalPointsEarned = selectedServices.reduce((sum, s) => sum + (s.pointsReward || 0), 0);

  // Descuento del cupon aplicado. La fuente de verdad ahora es selectedCoupon
  // (RewardRedemption ya en posesion del cliente). selectedPromotion se deriva
  // de selectedCoupon mas abajo para mantener compat con render existente.
  const promoDiscount = (() => {
    const reward = (selectedCoupon as any)?.reward;
    if (!reward || selectedServiceIds.length === 0) return 0;
    if (reward.type === 'SERVICIO') {
      const svcId = reward.service?.id || reward.serviceId;
      const svc = selectedServices.find((s) => s.id === svcId);
      return svc ? Number(svc.price) : 0;
    }
    if (reward.type === 'DESCUENTO') {
      const subtotal = selectedServices.reduce((sum, s) => sum + Number(s.price), 0);
      const amt = Number(reward.discountAmount || 0);
      if (reward.discountMode === 'PERCENTAGE') {
        return Math.round((subtotal * amt) / 100 * 100) / 100;
      }
      return Math.min(amt, subtotal);
    }
    if (reward.type === 'TWO_FOR_ONE') {
      // El bookeador original paga completo y recibe codigo para un amigo
      return 0;
    }
    return 0;
  })();
  const totalPrice = basePrice - promoDiscount;

  // Valor derivado: BizPromotion-like construido desde selectedCoupon.reward,
  // para que el resto del render (confirm/success/CTA) siga refiriendose a
  // `selectedPromotion` sin necesidad de refactor masivo.
  const selectedPromotion: BizPromotion | null = (() => {
    const reward = (selectedCoupon as any)?.reward;
    if (!reward) return null;
    return {
      id: (selectedCoupon as any).id,
      name: reward.name,
      description: reward.description,
      type: reward.type,
      discountMode: reward.discountMode,
      discountAmount: reward.discountAmount == null ? null : Number(reward.discountAmount),
      code: (selectedCoupon as any).code,
      pointsRequired: reward.pointsRequired,
      serviceIds: Array.isArray(reward.serviceIds) ? reward.serviceIds : [],
      service: reward.service || null,
      allowPointPayment: reward.allowPointPayment ?? true,
    };
  })();

  // Filter employees: show those who can do ALL services, OR at least ONE if multi-employee needed
  const employeesWithAll = employees.filter((emp) =>
    selectedServiceIds.every((sid) => emp.employeeServices?.some((es) => es.serviceId === sid)),
  );
  const employeesWithAny = employees.filter((emp) =>
    selectedServiceIds.some((sid) => emp.employeeServices?.some((es) => es.serviceId === sid)),
  );
  const isMultiEmployee = employeesWithAll.length === 0 && employeesWithAny.length > 0 && selectedServiceIds.length > 1;
  const availableEmployees = employeesWithAll.length > 0 ? employeesWithAll : employeesWithAny;

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
                    // y ordenar de la mas cercana a la mas lejana (sin GPS o
                    // sin coords -> al final, preservando orden original).
                    const locsWithDist = biz.locations
                      .map((loc: any) => {
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
                      })
                      .sort((a: any, b: any) => (a.distKm ?? Infinity) - (b.distKm ?? Infinity));

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
            <p className="text-xs text-gray-500 mt-1">Puntuación</p>
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
          {/* Shop button - second row centered */}
          {biz.shopEnabled && (
            <div className="col-span-3 flex justify-center">
              <Link
                href={`/marketplace/${tenantSlug}/shop`}
                className="flex items-center gap-2 bg-white rounded-xl border border-gray-200 px-6 py-3 text-center transition-all hover:shadow-md hover:border-[#008080]/30"
              >
                <svg className="w-5 h-5" style={{ color: TEAL }} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 2.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 0 0 3.75.614m-16.5 0a3.004 3.004 0 0 1-.621-4.72l1.189-1.19A1.5 1.5 0 0 1 5.378 3h13.243a1.5 1.5 0 0 1 1.06.44l1.19 1.189a3 3 0 0 1-.621 4.72M6.75 18h3.75a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-.75-.75H6.75a.75.75 0 0 0-.75.75v3.75c0 .414.336.75.75.75Z" />
                </svg>
                <span className="text-sm font-semibold" style={{ color: TEAL }}>Tienda</span>
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
              </Link>
            </div>
          )}
        </div>

        {/* Gallery Carousel */}
        {gallery.length >= 1 && (
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
                              {formatCurrency(Number(s.price), bizCurrency)}
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
                        {formatCurrency(Number(s.price), bizCurrency)}
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
            <div className="grid grid-cols-3 gap-4">
              {employees.map((emp) => (
                <Link
                  key={emp.id}
                  href={`/marketplace/${tenantSlug}/professional/${emp.id}`}
                  className="flex flex-col items-center group"
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
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-500 flex-shrink-0 overflow-hidden">
                        {r.clientAvatarUrl ? (
                          <img src={`${API_URL}${r.clientAvatarUrl}`} alt="" className="w-full h-full object-cover" />
                        ) : r.clientName?.[0] || '?'}
                      </div>
                      <span className="text-sm font-medium text-gray-900">
                        {r.clientName}
                      </span>
                    </div>
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

      {/* Floating CTA — sits above the bottom nav (bottom-20 = 5rem).
          z-40 para quedar por encima de las flechas del carousel de fotos. */}
      {!bookingStep && (
        <div className="fixed bottom-20 left-0 right-0 px-4 pointer-events-none z-40">
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

      {/* ─── REFERRAL CODE FULLSCREEN MODAL ──────────────── */}
      {refModal && (
        <div className="fixed inset-0 z-50 bg-white flex items-center justify-center px-4">
          <div className="max-w-md w-full text-center">
            {/* Icon */}
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: '#ede9fe' }}
            >
              <svg className="w-8 h-8" style={{ color: '#7c3aed' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21" />
              </svg>
            </div>

            <h2 className="text-2xl font-bold text-gray-900 mb-2">Tienes un servicio gratis</h2>
            <p className="text-gray-500 mb-6">
              {refSenderName
                ? <><strong className="text-gray-700">{refSenderName}</strong> te compartió un código para que disfrutes un servicio sin costo en {biz?.name || 'este negocio'}.</>
                : <>Te compartieron un código para que disfrutes un servicio sin costo en {biz?.name || 'este negocio'}.</>
              }
            </p>

            {/* Coupon card */}
            <div className="bg-white rounded-2xl overflow-hidden shadow-md flex text-left mb-6 mx-auto" style={{ minHeight: 110, maxWidth: 400 }}>
              <div
                className="w-20 flex-shrink-0 flex flex-col items-center justify-center gap-0.5 relative"
                style={{ backgroundColor: '#7c3aed' }}
              >
                <span className="text-white font-black text-base leading-tight text-center">GRATIS</span>
                <span className="text-white/70 text-[9px] uppercase tracking-wider">2×1</span>
                <div className="absolute -right-3 -top-3 w-6 h-6 rounded-full bg-white" />
                <div className="absolute -right-3 -bottom-3 w-6 h-6 rounded-full bg-white" />
              </div>
              <div className="flex flex-col items-center justify-center w-4 flex-shrink-0 gap-[3px] py-3">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="w-[3px] h-[3px] rounded-full" style={{ backgroundColor: '#d1d5db' }} />
                ))}
              </div>
              <div className="flex-1 py-3 pr-4 flex flex-col justify-center min-w-0">
                <p className="text-sm font-bold text-gray-900 leading-tight">Servicio gratis</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {refServiceNames.length > 0
                    ? refServiceNames.join(', ')
                    : 'Reserva y tu servicio será sin costo'}
                </p>
                <div
                  className="mt-2 bg-gray-50 rounded-lg py-2 px-3 font-mono text-lg font-black tracking-[0.15em] text-center select-all cursor-pointer"
                  style={{ color: '#7c3aed' }}
                  onClick={() => navigator.clipboard.writeText(refModal)}
                >
                  {refModal}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => {
                  setRefModal(null);
                  router.push('/marketplace/coupons');
                }}
                className="w-full text-white py-3 rounded-xl font-medium text-sm transition-colors"
                style={{ backgroundColor: '#7c3aed' }}
              >
                Ver mis cupones
              </button>
              <button
                onClick={() => {
                  setRefModal(null);
                  handleBook();
                }}
                className="w-full py-3 rounded-xl font-medium text-sm transition-colors border-2"
                style={{ borderColor: '#7c3aed', color: '#7c3aed' }}
              >
                Reservar ahora
              </button>
            </div>
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
                else if (bookingStep === 'promotion') setBookingStep('service');
                else if (bookingStep === 'employee') {
                  // back desde employee: si hubo promos aplicables vuelve
                  // al step promotion, sino directo a service.
                  setBookingStep((applicablePromotions.length > 0 || userApplicableCoupons.length > 0) ? 'promotion' : 'service');
                }
                else if (bookingStep === 'datetime') {
                  if (bookEmployeeId) setBookingStep('service'); // came from professional profile
                  else setBookingStep('employee');
                }
                else if (bookingStep === 'products') setBookingStep('datetime');
                else if (bookingStep === 'confirm') setBookingStep(biz?.shopEnabled && shopProducts.length > 0 ? 'products' : 'datetime');
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
                ...((applicablePromotions.length > 0 || userApplicableCoupons.length > 0) ? [{ key: 'promotion', label: 'Cupones' }] : []),
                ...(!bookEmployeeId ? [{ key: 'employee', label: 'Profesional' }] : []),
                { key: 'datetime', label: 'Horario' },
                ...(biz?.shopEnabled ? [{ key: 'products', label: 'Productos' }] : []),
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
                [...services].sort((a, b) => a.name.localeCompare(b.name, 'es')).forEach((s) => {
                  const key = s.subcategory || 'Otros';
                  if (!grouped[key]) grouped[key] = [];
                  grouped[key].push(s);
                });
                const groups = Object.entries(grouped).sort(([a], [b]) => a === 'Otros' ? 1 : b === 'Otros' ? -1 : a.localeCompare(b, 'es'));
                const hasSubcategories = groups.length > 1 || groups[0]?.[0] !== 'Otros';

                const renderServiceButton = (service: BizService) => {
                  const isSelected = selectedServiceIds.includes(service.id);
                  return (
                    <button
                      key={service.id}
                      onClick={() => {
                        setSelectedServiceIds((prev) =>
                          isSelected
                            ? prev.filter((id) => id !== service.id)
                            : [...prev, service.id],
                        );
                        setSelectedBundle(null);
                      }}
                      className="w-full text-left p-4 rounded-xl border-2 transition-all"
                      style={
                        isSelected
                          ? { borderColor: TEAL, backgroundColor: TEAL_LIGHT }
                          : { borderColor: '#e5e7eb', backgroundColor: '#fff' }
                      }
                    >
                      <div className="flex items-center gap-3">
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
                            {formatCurrency(Number(service.price), bizCurrency)}
                          </p>
                          <p className="text-xs text-gray-500">
                            {service.durationMinutes} min
                          </p>
                        </div>
                      </div>
                      {service.redeemableWithPoints && service.pointsRequired && (
                        <div className="flex items-center gap-1 mt-2 pt-2 border-t border-gray-100">
                          <svg className="w-3.5 h-3.5" style={{ color: TEAL }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="text-xs font-medium" style={{ color: TEAL }}>Canjeable por {service.pointsRequired} puntos</span>
                        </div>
                      )}
                    </button>
                  );
                };

                return (
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-3">
                    Selecciona el servicio
                  </h2>

                  {/* Tabs: Servicios | Paquetes (las Promociones son ahora un step aparte) */}
                  {bizBundles.length > 0 && (
                    <div className="flex rounded-lg border border-gray-300 overflow-hidden mb-4">
                      <button
                        onClick={() => { setServiceTab('servicios'); if (selectedBundle) { setSelectedBundle(null); setSelectedServiceIds([]); } }}
                        className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                          serviceTab === 'servicios' ? 'bg-[#008080] text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        Servicios
                      </button>
                      <button
                        onClick={() => setServiceTab('paquetes')}
                        className={`flex-1 px-4 py-2 text-sm font-medium transition-colors border-l border-gray-300 ${
                          serviceTab === 'paquetes' ? 'bg-[#008080] text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        Paquetes
                      </button>
                    </div>
                  )}

                  {/* Paquetes */}
                  {serviceTab === 'paquetes' && bizBundles.length > 0 && (
                    <div className="grid gap-3 mb-4">
                      {bizBundles.map((bundle: any) => {
                        const bundleServiceIds: string[] = Array.isArray(bundle.serviceIds) ? bundle.serviceIds : [];
                        const isSelected = bundleServiceIds.length > 0 && bundleServiceIds.every((id: string) => selectedServiceIds.includes(id));
                        const bundleServices = bundleServiceIds.map((id: string) => services.find((s) => s.id === id)).filter(Boolean) as any[];
                        const originalPrice = bundleServices.reduce((sum, s) => sum + Number(s.price), 0);

                        return (
                          <button
                            key={bundle.id}
                            onClick={() => {
                              if (isSelected) {
                                setSelectedServiceIds((prev) => prev.filter((id) => !bundleServiceIds.includes(id)));
                                setSelectedBundle(null);
                              } else {
                                setSelectedServiceIds(bundleServiceIds);
                                setSelectedBundle(bundle);
                                setSelectedCoupon(null);
                              }
                            }}
                            className="w-full text-left p-4 rounded-xl border-2 transition-all"
                            style={isSelected ? { borderColor: TEAL, backgroundColor: TEAL_LIGHT } : { borderColor: '#e5e7eb', backgroundColor: '#fff' }}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <p className="font-medium text-gray-900">{bundle.name}</p>
                              <div className="text-right">
                                {originalPrice > Number(bundle.bundlePrice) && (
                                  <span className="text-xs text-gray-400 line-through mr-2">
                                    {formatCurrency(originalPrice, bizCurrency)}
                                  </span>
                                )}
                                <span className="font-bold" style={{ color: TEAL }}>
                                  {formatCurrency(Number(bundle.bundlePrice), bizCurrency)}
                                </span>
                              </div>
                            </div>
                            {bundle.description && (
                              <p className="text-xs text-gray-500 mb-3">{bundle.description}</p>
                            )}
                            <div className="space-y-1.5 mb-3">
                              {bundleServices.map((s) => (
                                <div key={s.id} className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <svg className="w-3.5 h-3.5 flex-shrink-0" style={{ color: TEAL }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span className="text-sm text-gray-700">{s.name}</span>
                                  </div>
                                  <span className="text-xs text-gray-400">{s.durationMinutes} min</span>
                                </div>
                              ))}
                            </div>
                            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                              <span className="text-xs text-gray-400">{bundle.totalDuration} min total</span>
                              {bundle.savingsPercent && Number(bundle.savingsPercent) > 0 && (
                                <span className="text-xs font-semibold text-green-600">Ahorras {Number(bundle.savingsPercent)}%</span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Servicios individuales */}
                  {serviceTab === 'servicios' && (
                    hasSubcategories ? (
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
                    )
                  )}

                  {selectedServiceIds.length > 0 && (
                    <div className="mt-6 p-4 bg-white rounded-xl border border-gray-200">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-600">
                          {selectedServiceIds.length} servicio
                          {selectedServiceIds.length !== 1 ? 's' : ''}
                        </span>
                        <span className="text-sm font-semibold">
                          {totalDuration} min · {formatCurrency(totalPrice, bizCurrency)}
                        </span>
                      </div>
                      {promoDiscount > 0 && selectedPromotion && (
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-green-600 flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
                            </svg>
                            {selectedPromotion.name}
                          </span>
                          <span className="text-xs font-semibold text-green-600">
                            -{formatCurrency(promoDiscount, bizCurrency)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                );
              })()}

              {/* Step "Cupones".
                  Dos secciones:
                  - "Tus cupones": RewardRedemption ACTIVE del cliente que
                    aplican a los servicios elegidos (regalos del negocio o
                    canjes previos). Boton APLICAR/QUITAR.
                  - "Canjea con puntos": catalogo de rewards del negocio que
                    aplican. Boton CANJEAR (X pts). Al canjear se descuentan
                    puntos, se crea un RewardRedemption y queda aplicado a la
                    cita. */}
              {bookingStep === 'promotion' && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-semibold text-gray-900">
                      Cupones
                    </h2>
                    <div
                      className="flex items-center gap-1 px-3 py-1.5 rounded-full"
                      style={{ backgroundColor: TEAL_LIGHT, color: TEAL_DARK }}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-xs font-bold">{myPointsHere.toLocaleString()} pts</span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 mb-4">
                    Solo se muestran los cupones que aplican a los servicios que
                    seleccionaste. Puedes elegir uno o continuar sin cupón.
                  </p>

                  {/* Feedback de canje */}
                  {redeemFeedback && (
                    <div className="mb-4 p-3 rounded-xl border-2" style={{ borderColor: TEAL, backgroundColor: TEAL_LIGHT }}>
                      <p className="text-sm font-semibold" style={{ color: TEAL_DARK }}>
                        ¡Canjeado! {redeemFeedback.name}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: TEAL_DARK }}>
                        Código: <span className="font-mono font-bold">{redeemFeedback.code}</span> · Aplicado a tu cita.
                      </p>
                    </div>
                  )}
                  {redeemError && (
                    <div className="mb-4 p-3 rounded-xl border border-red-200 bg-red-50">
                      <p className="text-sm text-red-700">{redeemError}</p>
                    </div>
                  )}

                  {/* Helper para construir el "stub" de una card de cupon */}
                  {(() => null)()}

                  {/* Seccion A: Tus cupones */}
                  {userApplicableCoupons.length > 0 && (
                    <div className="mb-6">
                      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                        Tus cupones
                      </p>
                      <div className="space-y-3">
                        {userApplicableCoupons.map((r: any) => {
                          const reward = r.reward;
                          const isSelected = selectedCoupon?.id === r.id;
                          const isGift = (r.pointsSpent ?? 0) === 0;
                          const stubColor = isGift ? '#7c3aed' : TEAL;
                          const stubLabel = reward.type === 'SERVICIO'
                            ? 'GRATIS'
                            : reward.discountMode === 'PERCENTAGE'
                              ? `-${Number(reward.discountAmount || 0)}%`
                              : `-${formatCurrency(Number(reward.discountAmount || 0), bizCurrency)}`;
                          const stubFontSize = stubLabel.length <= 4 ? '1.125rem' : stubLabel.length <= 6 ? '0.875rem' : '0.75rem';
                          const valueDescription = reward.type === 'SERVICIO'
                            ? (reward.service?.name ? `${reward.service.name} gratis` : 'Servicio gratis')
                            : reward.discountMode === 'PERCENTAGE'
                              ? `${Number(reward.discountAmount || 0)}% de descuento`
                              : `${formatCurrency(Number(reward.discountAmount || 0), bizCurrency)} de descuento`;
                          return (
                            <button
                              key={r.id}
                              type="button"
                              onClick={() => {
                                if (isSelected) {
                                  setSelectedCoupon(null);
                                } else {
                                  setSelectedCoupon(r);
                                  setPayWithPoints(false);
                                }
                              }}
                              className="relative w-full text-left transition-transform active:scale-[0.99]"
                            >
                              <div
                                className="bg-white rounded-2xl overflow-hidden shadow-md flex"
                                style={{
                                  minHeight: 110,
                                  outline: isSelected ? `2px solid ${stubColor}` : 'none',
                                  outlineOffset: isSelected ? 2 : 0,
                                }}
                              >
                                <div className="w-20 flex-shrink-0 flex flex-col items-center justify-center gap-0.5 relative" style={{ backgroundColor: stubColor }}>
                                  <span className="text-white font-black leading-tight text-center break-all w-full px-2" style={{ fontSize: stubFontSize, wordBreak: 'break-all' }}>
                                    {stubLabel}
                                  </span>
                                  <span className="text-white/70 text-[9px] uppercase tracking-wider">
                                    {isGift ? 'regalo' : 'tuyo'}
                                  </span>
                                  <div className="absolute -right-3 -top-3 w-6 h-6 rounded-full" style={{ backgroundColor: '#f3f4f6' }} />
                                  <div className="absolute -right-3 -bottom-3 w-6 h-6 rounded-full" style={{ backgroundColor: '#f3f4f6' }} />
                                </div>
                                <div className="flex flex-col items-center justify-center w-4 flex-shrink-0 gap-[3px] py-3">
                                  {Array.from({ length: 9 }).map((_, i) => (
                                    <div key={i} className="w-[3px] h-[3px] rounded-full" style={{ backgroundColor: '#d1d5db' }} />
                                  ))}
                                </div>
                                <div className="flex-1 py-3 pr-4 flex flex-col justify-between min-w-0">
                                  <div>
                                    <div className="flex items-start justify-between gap-2">
                                      <p className="text-sm font-bold text-gray-900 leading-tight truncate">
                                        {reward.name}
                                      </p>
                                      {isSelected && (
                                        <span className="text-[10px] font-bold bg-teal-50 text-[#008080] px-2 py-0.5 rounded-full flex-shrink-0 uppercase tracking-wider">
                                          Aplicado
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{valueDescription}</p>
                                    {r.expiresAt && (
                                      <p className="text-[11px] text-gray-400 mt-1">
                                        Vence {new Date(r.expiresAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex items-center justify-end mt-2">
                                    <span
                                      className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-black tracking-wide text-white"
                                      style={{ backgroundColor: isSelected ? '#9ca3af' : stubColor, letterSpacing: '0.05em' }}
                                    >
                                      {isSelected ? 'QUITAR' : 'APLICAR'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Seccion B: Canjea con puntos */}
                  {applicablePromotions.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                        Canjea con puntos
                      </p>
                      <div className="space-y-3">
                        {applicablePromotions.map((promo) => {
                          const points = promo.pointsRequired ?? 0;
                          const canAfford = points > 0 && myPointsHere >= points;
                          const missing = Math.max(0, points - myPointsHere);
                          const isTwoForOne = promo.type === 'TWO_FOR_ONE';
                          const isFreeService = promo.type === 'SERVICIO';
                          const stubColor = isTwoForOne ? '#7c3aed' : TEAL;
                          const subLabel = isTwoForOne ? '2×1' : isFreeService ? 'Servicio gratis' : (promo.discountMode === 'PERCENTAGE' ? `${Number(promo.discountAmount || 0)}% off` : `${formatCurrency(Number(promo.discountAmount || 0), bizCurrency)} menos`);
                          const promoSvcIds = promo.serviceIds || [];
                          const promoServices = promo.type === 'SERVICIO' && promo.service?.id
                            ? services.filter((s) => s.id === promo.service!.id)
                            : services.filter((s) => promoSvcIds.includes(s.id));
                          const endDate = promo.validUntil
                            ? new Date(promo.validUntil).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
                            : null;
                          const isRedeeming = redeemRewardMutation.isPending && (redeemRewardMutation.variables as any)?.rewardId === promo.id;

                          return (
                            <div
                              key={promo.id}
                              className={`relative w-full ${canAfford ? '' : 'opacity-60'}`}
                            >
                              <div
                                className="bg-white rounded-2xl overflow-hidden shadow-md flex"
                                style={{ minHeight: 110 }}
                              >
                                <div className="w-20 flex-shrink-0 flex flex-col items-center justify-center gap-0.5 relative" style={{ backgroundColor: stubColor }}>
                                  <span className="text-white font-black leading-tight text-center w-full px-1" style={{ fontSize: points >= 1000 ? '0.95rem' : '1.05rem' }}>
                                    {points.toLocaleString()}
                                  </span>
                                  <span className="text-white/70 text-[9px] uppercase tracking-wider">
                                    pts
                                  </span>
                                  <div className="absolute -right-3 -top-3 w-6 h-6 rounded-full" style={{ backgroundColor: '#f3f4f6' }} />
                                  <div className="absolute -right-3 -bottom-3 w-6 h-6 rounded-full" style={{ backgroundColor: '#f3f4f6' }} />
                                </div>
                                <div className="flex flex-col items-center justify-center w-4 flex-shrink-0 gap-[3px] py-3">
                                  {Array.from({ length: 9 }).map((_, i) => (
                                    <div key={i} className="w-[3px] h-[3px] rounded-full" style={{ backgroundColor: '#d1d5db' }} />
                                  ))}
                                </div>
                                <div className="flex-1 py-3 pr-4 flex flex-col justify-between min-w-0">
                                  <div>
                                    <p className="text-sm font-bold text-gray-900 leading-tight truncate">
                                      {promo.name}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                                      {promo.description || subLabel}
                                    </p>
                                    {promoServices.length > 0 && (
                                      <p className="text-[11px] text-gray-400 mt-1 truncate">
                                        Aplica a: {promoServices.map((s) => s.name).join(', ')}
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex items-center justify-between mt-2 gap-2">
                                    {endDate ? (
                                      <div className="flex items-center gap-1 px-2 py-1 rounded-lg flex-shrink-0" style={{ backgroundColor: '#f3f4f6', color: '#6b7280' }}>
                                        <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <span className="text-[10px] font-semibold whitespace-nowrap">Vence {endDate}</span>
                                      </div>
                                    ) : <span />}
                                    {canAfford ? (
                                      <button
                                        type="button"
                                        disabled={isRedeeming}
                                        onClick={() => {
                                          setRedeemError(null);
                                          redeemRewardMutation.mutate({ rewardId: promo.id });
                                        }}
                                        className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-black tracking-wide text-white disabled:opacity-60"
                                        style={{ backgroundColor: stubColor, letterSpacing: '0.05em' }}
                                      >
                                        {isRedeeming ? 'CANJEANDO…' : 'CANJEAR'}
                                      </button>
                                    ) : (
                                      <span className="flex-shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wide bg-gray-100 text-gray-500 uppercase">
                                        Te faltan {missing.toLocaleString()} pts
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Mensaje cuando no hay cupones de ningun tipo */}
                  {userApplicableCoupons.length === 0 && applicablePromotions.length === 0 && (
                    <div className="text-center py-8 text-gray-400 text-sm">
                      No hay cupones disponibles para los servicios elegidos.
                    </div>
                  )}
                </div>
              )}

              {/* Step 2: Employee */}
              {bookingStep === 'employee' && (
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">
                    {isMultiEmployee ? 'Asigna un profesional por servicio' : 'Selecciona el profesional'}
                  </h2>

                  {isMultiEmployee ? (
                    /* ─── Multi-employee: assign per service ─── */
                    <div className="space-y-3">
                      {selectedServiceIds.map((sid) => {
                        const svc = services.find((s) => s.id === sid);
                        if (!svc) return null;
                        const canDo = employees.filter((emp) => emp.employeeServices?.some((es) => es.serviceId === sid));
                        const assignedId = serviceEmployeeMap[sid] || (canDo.length === 1 ? canDo[0].id : '');
                        const assigned = canDo.find((e) => e.id === assignedId);

                        // Auto-assign if only one option
                        if (canDo.length === 1 && !serviceEmployeeMap[sid]) {
                          setTimeout(() => setServiceEmployeeMap((m) => ({ ...m, [sid]: canDo[0].id })), 0);
                        }

                        return (
                          <div key={sid} className="bg-white rounded-xl border border-gray-200 p-4">
                            <p className="text-sm font-medium text-gray-900 mb-2">{svc.name}</p>
                            {canDo.length === 1 && assigned ? (
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 overflow-hidden" style={{ backgroundColor: assigned.color }}>
                                  {assigned.avatarUrl ? <img src={`${API_URL}${assigned.avatarUrl}`} alt="" className="w-full h-full object-cover" /> : <>{assigned.firstName[0]}{assigned.lastName[0]}</>}
                                </div>
                                <span className="text-sm text-gray-700">{assigned.firstName} {assigned.lastName}</span>
                              </div>
                            ) : (
                              <select
                                value={assignedId}
                                onChange={(e) => setServiceEmployeeMap((m) => ({ ...m, [sid]: e.target.value }))}
                                className="input-field text-sm"
                              >
                                <option value="">Seleccionar profesional...</option>
                                {canDo.map((emp) => (
                                  <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>
                                ))}
                              </select>
                            )}
                          </div>
                        );
                      })}

                    </div>
                  ) : (
                    /* ─── Single employee: pick one for all ─── */
                    <div className="grid gap-3">
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
                          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                            <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
                            </svg>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">Cualquier profesional disponible</p>
                            <p className="text-sm text-gray-500">Te asignaremos el mejor disponible</p>
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
                            <div className="w-12 h-12 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 overflow-hidden" style={{ backgroundColor: emp.color }}>
                              {emp.avatarUrl ? <img src={`${API_URL}${emp.avatarUrl}`} alt="" className="w-full h-full object-cover" /> : <>{emp.firstName[0]}{emp.lastName[0]}</>}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900">{emp.firstName} {emp.lastName}</p>
                              {emp.bio && <p className="text-sm text-gray-500 line-clamp-1">{emp.bio}</p>}
                            </div>
                            <Link href={`/marketplace/${tenantSlug}/professional/${emp.id}`} onClick={(e) => e.stopPropagation()} className="text-[11px] text-[#008080] font-medium hover:underline flex-shrink-0">
                              Ver perfil
                            </Link>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: Date & Time */}
              {bookingStep === 'datetime' && (
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Selecciona fecha y hora</h2>

                  {/* Employee info */}
                  {Object.keys(serviceEmployeeMap).length > 1 ? (
                    /* Multi-employee: show each service with its employee */
                    <div className="mb-4 bg-gray-50 rounded-xl border border-gray-100 p-3 space-y-2">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Tu equipo para esta cita</p>
                      {selectedServiceIds.map((sid, idx) => {
                        const svc = services.find((s) => s.id === sid);
                        const empId = serviceEmployeeMap[sid];
                        const emp = employees.find((e) => e.id === empId);
                        if (!svc || !emp) return null;
                        // Calculate start offset
                        let offset = 0;
                        for (let i = 0; i < idx; i++) {
                          const prevSvc = services.find((s) => s.id === selectedServiceIds[i]);
                          offset += prevSvc?.durationMinutes || 0;
                        }
                        return (
                          <div key={sid} className="flex items-center gap-3">
                            <div className="flex flex-col items-center w-5 flex-shrink-0">
                              <div className="w-2 h-2 rounded-full bg-[#008080]" />
                              {idx < selectedServiceIds.length - 1 && <div className="w-px h-6 bg-gray-300" />}
                            </div>
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 overflow-hidden" style={{ backgroundColor: emp.color }}>
                              {emp.avatarUrl ? <img src={`${API_URL}${emp.avatarUrl}`} alt="" className="w-full h-full object-cover" /> : <>{emp.firstName[0]}{emp.lastName[0]}</>}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900">{svc.name}</p>
                              <p className="text-[11px] text-gray-400">{emp.firstName} {emp.lastName} · {svc.durationMinutes} min</p>
                            </div>
                          </div>
                        );
                      })}
                      <div className="pt-1 border-t border-gray-200 mt-1">
                        <p className="text-xs text-gray-500">Total: {totalDuration} min · {formatCurrency(totalPrice, bizCurrency)}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 mb-4 p-3 bg-gray-50 rounded-xl border border-gray-100">
                      {anyEmployee ? (
                        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" /></svg>
                        </div>
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
                        <p className="text-xs text-gray-400">{totalDuration} min · {formatCurrency(totalPrice, bizCurrency)}</p>
                      </div>
                    </div>
                  )}

                  {/* Date selector + Calendar + Preferred time — unified row */}
                  <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-2 mb-4">
                    {/* Date selector */}
                    <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl px-2 py-2">
                      <button
                        disabled={selectedDate.isSame(dayjs(), 'day')}
                        onClick={() => { setSelectedDate((d) => d.subtract(1, 'day')); setSelectedSlot(null); }}
                        className="p-1 rounded-lg hover:bg-gray-100 disabled:opacity-30 flex-shrink-0"
                      >
                        <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                      </button>
                      <div className="flex-1 text-center min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {selectedDate.isSame(dayjs(), 'day') ? 'Hoy' : selectedDate.isSame(dayjs().add(1, 'day'), 'day') ? 'Mañana' : selectedDate.format('ddd D')}
                        </p>
                        <p className="text-[10px] text-gray-400 truncate">{selectedDate.format('MMM YYYY')}</p>
                      </div>
                      <button
                        onClick={() => { setSelectedDate((d) => d.add(1, 'day')); setSelectedSlot(null); }}
                        className="p-1 rounded-lg hover:bg-gray-100 flex-shrink-0"
                      >
                        <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      </button>
                    </div>

                    {/* Calendar button */}
                    <button
                      onClick={() => setShowFullCalendar(true)}
                      className="w-11 flex items-center justify-center rounded-xl border border-gray-200 bg-white hover:bg-gray-50"
                    >
                      <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z" />
                      </svg>
                    </button>

                    {/* Preferred time */}
                    <div className="relative flex items-center bg-white border border-gray-200 rounded-xl px-2 py-2">
                      <svg className="w-4 h-4 text-gray-400 flex-shrink-0 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      <input
                        type="time"
                        value={preferredTime}
                        onChange={(e) => setPreferredTime(e.target.value)}
                        placeholder="Hora preferida"
                        className="flex-1 text-sm bg-transparent focus:outline-none min-w-0 text-gray-700"
                      />
                      {preferredTime && (
                        <button onClick={() => setPreferredTime('')} className="text-gray-400 hover:text-gray-600 flex-shrink-0 ml-1">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Hint para el input de hora preferida (se entiende para que es) */}
                  {!preferredTime && (
                    <p className="text-[11px] text-gray-500 mb-3 px-1 flex items-start gap-1.5">
                      <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: TEAL }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>
                        Pon un horario de tu preferencia y buscaremos coincidencias con la disponibilidad de tu profesional.
                      </span>
                    </p>
                  )}

                  {/* Preferred time feedback */}
                  {preferredTime && (() => {
                    const pref = preferredTime.substring(0, 5);
                    const prefMinutes = parseInt(pref.split(':')[0]) * 60 + parseInt(pref.split(':')[1]);
                    const found = uniqueSlots.find(s => s.startTime.split('T')[1]?.startsWith(pref));

                    // Exact match with current employee
                    if (found) {
                      if (!selectedSlot || !selectedSlot.startTime.includes(pref)) {
                        setTimeout(() => setSelectedSlot(found), 0);
                      }
                      return (
                        <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-xl" style={{ backgroundColor: '#e0f2f1' }}>
                          <svg className="w-4 h-4 flex-shrink-0" style={{ color: TEAL }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                          <p className="text-xs font-medium" style={{ color: '#065f46' }}>Las {pref} está disponible</p>
                        </div>
                      );
                    }

                    // No exact match — find closest slot from current employee
                    const closest = [...uniqueSlots]
                      .map(s => {
                        const t = s.startTime.split('T')[1]?.substring(0, 5) || '';
                        const mins = parseInt(t.split(':')[0]) * 60 + parseInt(t.split(':')[1]);
                        return { slot: s, time: t, diff: Math.abs(mins - prefMinutes) };
                      })
                      .sort((a, b) => a.diff - b.diff)[0];

                    // Check other employees for a better match
                    const altEmp = !anyEmployee && selectedEmployee ? (() => {
                      const otherSlots = allEmpSlots.filter(s => s.employeeId !== selectedEmployee.id);
                      const exact = otherSlots.find(s => s.startTime.split('T')[1]?.startsWith(pref));
                      if (exact) {
                        const emp = availableEmployees.find(e => e.id === exact.employeeId);
                        return emp ? { emp, time: pref, slot: exact, diff: 0 } : null;
                      }
                      // Closest from other employees
                      const closestOther = otherSlots
                        .map(s => {
                          const t = s.startTime.split('T')[1]?.substring(0, 5) || '';
                          const mins = parseInt(t.split(':')[0]) * 60 + parseInt(t.split(':')[1]);
                          const emp = availableEmployees.find(e => e.id === s.employeeId);
                          return { slot: s, emp, time: t, diff: Math.abs(mins - prefMinutes) };
                        })
                        .filter(x => x.emp)
                        .sort((a, b) => a.diff - b.diff)[0];
                      return closestOther && (!closest || closestOther.diff < closest.diff) ? closestOther : null;
                    })() : null;

                    if (closest) {
                      if (!selectedSlot || !selectedSlot.startTime.includes(closest.time)) {
                        setTimeout(() => setSelectedSlot(closest.slot), 0);
                      }
                    }

                    return (
                      <div className="mb-3 space-y-2">
                        {closest ? (
                          <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ backgroundColor: '#e0f2f1' }}>
                            <svg className="w-4 h-4 flex-shrink-0" style={{ color: TEAL }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                            <p className="text-xs font-medium" style={{ color: '#065f46' }}>¿Qué tal a las <span className="font-bold">{closest.time}</span>?</p>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50">
                            <svg className="w-4 h-4 flex-shrink-0 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            <p className="text-xs" style={{ color: '#92400e' }}>{selectedEmployee?.firstName} no tiene horarios disponibles hoy</p>
                          </div>
                        )}
                        {altEmp && (
                          <button
                            onClick={() => {
                              setSelectedEmployee(altEmp.emp!);
                              setSelectedSlot(altEmp.slot);
                              setPreferredTime(altEmp.time);
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 border-dashed transition-colors hover:bg-teal-50"
                            style={{ borderColor: '#99d5d5' }}
                          >
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 overflow-hidden"
                              style={{ backgroundColor: altEmp.emp!.color }}
                            >
                              {altEmp.emp!.avatarUrl
                                ? <img src={`${API_URL}${altEmp.emp!.avatarUrl}`} alt="" className="w-full h-full object-cover" />
                                : <>{altEmp.emp!.firstName[0]}{altEmp.emp!.lastName[0]}</>}
                            </div>
                            <div className="flex-1 text-left">
                              <p className="text-xs font-semibold text-gray-900">{altEmp.emp!.firstName} disponible a las {altEmp.time}</p>
                              <p className="text-[10px] text-gray-500">Toca para cambiar de profesional</p>
                            </div>
                            <svg className="w-4 h-4 flex-shrink-0" style={{ color: TEAL }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                          </button>
                        )}
                      </div>
                    );
                  })()}

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
              {/* Products step */}
              {bookingStep === 'products' && (
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-1">Agrega productos</h2>
                  <p className="text-xs text-gray-500 mb-4">Selecciona productos para apartar junto con tu cita (opcional)</p>

                  {shopProducts.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-sm text-gray-400">No hay productos disponibles</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      {shopProducts.map((product: any) => {
                        const inCart = bookingCart.find((c) => c.id === product.id);
                        return (
                          <div key={product.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                            <div className="aspect-square overflow-hidden bg-gray-100">
                              {product.imageUrl ? (
                                <img src={`${API_URL}${product.imageUrl}`} alt={product.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159" /></svg>
                                </div>
                              )}
                            </div>
                            <div className="p-2.5">
                              <p className="text-xs font-medium text-gray-900 line-clamp-2 leading-tight">{product.name}</p>
                              <p className="text-xs font-bold mt-1" style={{ color: TEAL }}>{formatCurrency(Number(product.price), bizCurrency)}</p>
                              <div className="mt-2">
                                {inCart ? (
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                      <button onClick={() => {
                                        if (inCart.quantity <= 1) setBookingCart((c) => c.filter((i) => i.id !== product.id));
                                        else setBookingCart((c) => c.map((i) => i.id === product.id ? { ...i, quantity: i.quantity - 1 } : i));
                                      }} className="w-6 h-6 rounded border border-gray-200 flex items-center justify-center text-gray-600 text-xs">-</button>
                                      <span className="text-xs font-semibold w-4 text-center">{inCart.quantity}</span>
                                      <button onClick={() => setBookingCart((c) => c.map((i) => i.id === product.id ? { ...i, quantity: Math.min(product.stock, i.quantity + 1) } : i))}
                                        className="w-6 h-6 rounded border border-gray-200 flex items-center justify-center text-gray-600 text-xs">+</button>
                                    </div>
                                    <button onClick={() => setBookingCart((c) => c.filter((i) => i.id !== product.id))} className="text-[9px] text-red-500">Quitar</button>
                                  </div>
                                ) : (
                                  <button onClick={() => setBookingCart((c) => [...c, { id: product.id, name: product.name, price: Number(product.price), currency: bizCurrency, imageUrl: product.imageUrl, quantity: 1 }])}
                                    className="w-full py-1.5 text-[10px] font-medium rounded-lg text-white" style={{ backgroundColor: TEAL }}>
                                    Agregar
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Cart summary */}
                  {bookingCart.length > 0 && (
                    <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Productos seleccionados</p>
                      {bookingCart.map((item) => (
                        <div key={item.id} className="flex justify-between text-xs py-1">
                          <span className="text-gray-700">{item.quantity}x {item.name}</span>
                          <span className="font-medium">{formatCurrency(Number(item.price) * item.quantity, bizCurrency)}</span>
                        </div>
                      ))}
                      <div className="border-t border-gray-100 mt-2 pt-2 flex justify-between text-sm font-semibold">
                        <span>Subtotal productos</span>
                        <span style={{ color: TEAL }}>{formatCurrency(bookingCartTotal, bizCurrency)}</span>
                      </div>
                    </div>
                  )}

                </div>
              )}

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
                      {selectedServices.map((s) => {
                        const empId = serviceEmployeeMap[s.id];
                        const emp = empId ? employees.find((e) => e.id === empId) : null;
                        return (
                          <div key={s.id} className="flex justify-between text-sm py-0.5">
                            <span className="text-gray-700">
                              {s.name}
                              {emp && Object.keys(serviceEmployeeMap).length > 1 && (
                                <span className="text-[10px] text-gray-400 ml-1">({emp.firstName})</span>
                              )}
                            </span>
                            <span className="font-medium">
                              {formatCurrency(Number(s.price), bizCurrency)}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Products */}
                    {bookingCart.length > 0 && (
                      <div className="border-t border-gray-100 pt-4">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                          Productos
                        </p>
                        {bookingCart.map((item) => (
                          <div key={item.id} className="flex justify-between text-sm py-0.5">
                            <span className="text-gray-700">{item.quantity}x {item.name}</span>
                            <span className="font-medium">{formatCurrency(Number(item.price) * item.quantity, bizCurrency)}</span>
                          </div>
                        ))}
                      </div>
                    )}

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

                    {/* Professional(s) */}
                    {Object.keys(serviceEmployeeMap).length > 1 ? (
                      <div className="border-t border-gray-100 pt-4">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                          Profesionales
                        </p>
                        <div className="space-y-2">
                          {selectedServiceIds.map((sid, idx) => {
                            const svc = services.find((s) => s.id === sid);
                            const empId = serviceEmployeeMap[sid];
                            const emp = employees.find((e) => e.id === empId);
                            if (!svc || !emp) return null;
                            // Calculate time for this service
                            let offsetMin = 0;
                            for (let i = 0; i < idx; i++) {
                              const ps = services.find((s) => s.id === selectedServiceIds[i]);
                              offsetMin += ps?.durationMinutes || 0;
                            }
                            const slotStartMin = selectedSlot ? parseInt(selectedSlot.startTime.substring(11, 13)) * 60 + parseInt(selectedSlot.startTime.substring(14, 16)) : 0;
                            const svcStartMin = slotStartMin + offsetMin;
                            const svcEndMin = svcStartMin + (svc.durationMinutes || 0);
                            const startStr = `${String(Math.floor(svcStartMin / 60)).padStart(2, '0')}:${String(svcStartMin % 60).padStart(2, '0')}`;
                            const endStr = `${String(Math.floor(svcEndMin / 60)).padStart(2, '0')}:${String(svcEndMin % 60).padStart(2, '0')}`;

                            return (
                              <div key={sid} className="flex items-center gap-3">
                                <div className="flex flex-col items-center w-5 flex-shrink-0">
                                  <div className="w-2 h-2 rounded-full bg-[#008080]" />
                                  {idx < selectedServiceIds.length - 1 && <div className="w-px h-8 bg-gray-300" />}
                                </div>
                                <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 overflow-hidden" style={{ backgroundColor: emp.color }}>
                                  {emp.avatarUrl ? <img src={`${API_URL}${emp.avatarUrl}`} alt="" className="w-full h-full object-cover" /> : <>{emp.firstName[0]}{emp.lastName[0]}</>}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-900">{svc.name}</p>
                                  <p className="text-[11px] text-gray-400">{emp.firstName} {emp.lastName} · {formatTime(startStr)} - {formatTime(endStr)}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : !anyEmployee && selectedEmployee ? (
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
                    ) : null}

                    {/* Duration, Subtotal, Discount & Total */}
                    <div className="border-t border-gray-100 pt-4">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-500">Duración</span>
                        <span className="font-medium text-gray-900">{totalDuration} min</span>
                      </div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-500">Subtotal servicios</span>
                        <span className="font-medium text-gray-900">{formatCurrency(basePrice, bizCurrency)}</span>
                      </div>
                      {promoDiscount > 0 && selectedPromotion && (
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-green-600 font-medium flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
                            </svg>
                            Promoción: {selectedPromotion.name}
                          </span>
                          <span className="text-green-600 font-medium">-{formatCurrency(promoDiscount, bizCurrency)}</span>
                        </div>
                      )}
                      {bookingCart.length > 0 && (
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-500">Productos</span>
                          <span className="font-medium text-gray-900">{formatCurrency(bookingCartTotal, bizCurrency)}</span>
                        </div>
                      )}
                      {(() => {
                        let disc = 0;
                        if (selectedCoupon?.reward) {
                          const reward = selectedCoupon.reward;
                          if (reward.type === 'DESCUENTO') {
                            disc = reward.discountMode === 'PERCENTAGE'
                              ? Math.round(totalPrice * Number(reward.discountAmount) / 100 * 100) / 100
                              : Math.min(Number(reward.discountAmount), totalPrice);
                          } else if (reward.type === 'SERVICIO') {
                            const svc = selectedServices?.find((s: any) => s.id === reward.serviceId);
                            if (svc) disc = Number(svc.price);
                          }
                        }
                        const hasDiscount = disc > 0 || promoDiscount > 0 || payWithPoints;
                        const finalTotal = payWithPoints ? 0 : Math.max(0, totalPrice + bookingCartTotal - disc);
                        const pointsCost = payWithPoints ? selectedServices.reduce((sum, s) => sum + (s.pointsRequired || 0), 0) : 0;
                        return (
                          <>
                            {disc > 0 && !payWithPoints && (
                              <div className="flex justify-between items-center text-sm mb-1 bg-green-50 -mx-4 px-4 py-1.5 rounded-lg">
                                <span className="text-green-700 font-medium flex items-center gap-1.5">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" />
                                  </svg>
                                  Cupón aplicado: {selectedCoupon.reward?.name}
                                </span>
                                <span className="text-green-700 font-bold">-{formatCurrency(disc, bizCurrency)}</span>
                              </div>
                            )}
                            {payWithPoints && (
                              <div className="flex justify-between text-sm mb-1">
                                <span className="text-teal-700 font-medium">Pago con puntos</span>
                                <span className="text-teal-700 font-medium">-{pointsCost} pts</span>
                              </div>
                            )}
                            <div className="flex justify-between pt-2 border-t border-gray-100 mt-2">
                              <span className="font-semibold text-gray-900">Total a pagar</span>
                              <div className="text-right">
                                {hasDiscount && (
                                  <span className="text-sm text-gray-400 line-through mr-2">{formatCurrency(basePrice + bookingCartTotal, bizCurrency)}</span>
                                )}
                                <span className="font-bold text-lg" style={{ color: TEAL }}>
                                  {payWithPoints ? 'Gratis' : formatCurrency(finalTotal, bizCurrency)}
                                </span>
                              </div>
                            </div>
                          </>
                        );
                      })()}
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

                  {/* 2x1 promotion info */}
                  {selectedPromotion?.type === 'TWO_FOR_ONE' && (
                    <div className="rounded-xl border-2 border-dashed p-3 mb-4 text-center" style={{ borderColor: TEAL, backgroundColor: TEAL_LIGHT }}>
                      <p className="text-sm font-bold" style={{ color: TEAL }}>Promoción 2×1</p>
                      <p className="text-xs text-gray-600 mt-1">
                        Al confirmar, recibirás un <strong>código para compartir</strong> con un amigo.
                        Tu amigo podrá usar el mismo servicio gratis.
                      </p>
                    </div>
                  )}

                  {/* Cupon aplicado: banner readonly (la seleccion se hace en
                      el step "Cupones" anterior, este es solo confirmacion). */}
                  {selectedCoupon && (
                    <div className="border border-[#008080]/30 bg-teal-50/50 rounded-xl p-3 mb-4 flex items-center gap-2">
                      <svg className="w-4 h-4 text-[#008080] flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" />
                      </svg>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-[#008080] truncate">
                          Cupón aplicado: {selectedCoupon.reward?.name}
                        </p>
                        {selectedCoupon.code && (
                          <p className="text-[11px] text-[#008080]/80">
                            Código: <span className="font-mono">{selectedCoupon.code}</span>
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedCoupon(null)}
                        className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded"
                      >
                        Quitar
                      </button>
                    </div>
                  )}

                  {/* Pay with points option */}
                  {(() => {
                    const totalPointsNeeded = selectedServices.reduce((sum, s) => sum + (s.redeemableWithPoints && s.pointsRequired ? s.pointsRequired : 0), 0);
                    const allRedeemable = selectedServices.every((s) => s.redeemableWithPoints && s.pointsRequired);
                    const canPayWithPoints = allRedeemable && totalPointsNeeded > 0 && myPointsHere >= totalPointsNeeded;

                    const pointsBlockedByPromo = selectedPromotion && selectedPromotion.allowPointPayment === false;

                    return canPayWithPoints ? (
                      <div className="mb-4">
                        {pointsBlockedByPromo && (
                          <p className="text-xs font-semibold text-gray-400 mb-2">No disponible con esta oferta</p>
                        )}
                        <button
                          disabled={!!pointsBlockedByPromo}
                          onClick={() => { setPayWithPoints(!payWithPoints); if (!payWithPoints) setSelectedCoupon(null); }}
                          className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all ${
                            payWithPoints
                              ? 'border-teal-400 bg-teal-50'
                              : 'border-gray-200 hover:border-gray-300'
                          } ${pointsBlockedByPromo ? 'opacity-40 cursor-not-allowed' : ''}`}
                        >
                          <div className="flex items-center gap-3">
                            <svg className="w-5 h-5" style={{ color: TEAL }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div className="text-left">
                              <p className={`text-sm font-medium ${payWithPoints ? 'text-teal-800' : 'text-gray-900'}`}>Pagar con puntos</p>
                              <p className="text-xs text-gray-500">{totalPointsNeeded} pts necesarios · Tienes {myPointsHere} pts</p>
                            </div>
                          </div>
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                            payWithPoints ? 'border-[#008080] bg-[#008080]' : 'border-gray-300'
                          }`}>
                            {payWithPoints && (
                              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                        </button>
                      </div>
                    ) : null;
                  })()}

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

                </div>
              )}
            </div>
          </div>

          {/* ─── Footer CTA pegajoso (un solo boton por step, igual estilo
              que "Reservar cita" del perfil del negocio). En location y
              employee-single el avance es al click directo, no muestra. */}
          {(() => {
            if (bookingStep === 'location') return null;
            if (bookingStep === 'employee' && !isMultiEmployee) return null;

            let label = 'Continuar';
            let disabled = false;
            let loading = false;
            let onClick: (() => void) | undefined;
            let errorMsg: string | null = null;

            if (bookingStep === 'service') {
              disabled = selectedServiceIds.length === 0;
              // Si hay cupones del catalogo o cupones propios que aplican a
              // los servicios, mostramos step "Cupones" antes de seguir al
              // empleado. Sino, salto.
              onClick = () => setBookingStep(
                (applicablePromotions.length > 0 || userApplicableCoupons.length > 0) ? 'promotion' : 'employee',
              );
            } else if (bookingStep === 'promotion') {
              // Opcional: se puede continuar sin seleccionar cupon.
              label = selectedPromotion ? 'Continuar con cupón' : 'Continuar sin cupón';
              onClick = () => setBookingStep('employee');
            } else if (bookingStep === 'employee') {
              disabled = !selectedServiceIds.every((sid) => serviceEmployeeMap[sid]);
              onClick = () => {
                const primaryEmpId = serviceEmployeeMap[selectedServiceIds[0]];
                const primaryEmp = employees.find((e) => e.id === primaryEmpId) || null;
                setSelectedEmployee(primaryEmp);
                setAnyEmployee(false);
                setSelectedSlot(null);
                setBookingStep('datetime');
              };
            } else if (bookingStep === 'datetime') {
              disabled = !selectedSlot;
              onClick = () => setBookingStep(biz?.shopEnabled && shopProducts.length > 0 ? 'products' : 'confirm');
            } else if (bookingStep === 'products') {
              label = bookingCart.length > 0 ? 'Continuar con productos' : 'Continuar sin productos';
              onClick = () => setBookingStep('confirm');
            } else if (bookingStep === 'confirm') {
              loading = bookMutation.isPending;
              disabled = bookMutation.isPending || !selectedSlot;
              label = bookMutation.isPending
                ? 'Confirmando...'
                : biz?.acceptsOnlinePayment
                  ? 'Confirmar y Pagar'
                  : 'Confirmar Reserva';
              onClick = () => bookMutation.mutate();
              if (bookMutation.isError) {
                errorMsg = (bookMutation.error as any)?.message
                  || 'Error al confirmar la reserva. Por favor intenta de nuevo.';
              }
            }

            return (
              <div
                className="border-t border-gray-200 bg-white px-4 pt-3"
                style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
              >
                <div className="max-w-2xl mx-auto">
                  {errorMsg && (
                    <div className="mb-2 p-2.5 rounded-lg bg-red-50 text-red-700 text-xs">
                      {errorMsg}
                    </div>
                  )}
                  <button
                    onClick={onClick}
                    disabled={disabled}
                    className="w-full text-white py-3 rounded-2xl font-semibold text-sm transition-colors shadow-lg disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    style={{
                      backgroundColor: TEAL,
                      boxShadow: disabled ? 'none' : '0 4px 16px rgba(0,128,128,0.4)',
                    }}
                    onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.backgroundColor = TEAL_DARK; }}
                    onMouseLeave={(e) => { if (!disabled) e.currentTarget.style.backgroundColor = TEAL; }}
                  >
                    {loading && (
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    )}
                    {label}
                  </button>
                  {bookingStep === 'confirm' && biz?.acceptsOnlinePayment && !errorMsg && (
                    <p className="text-center text-[11px] text-gray-400 mt-1.5">
                      Serás redirigido a Stripe para completar el pago de forma segura
                    </p>
                  )}
                </div>
              </div>
            );
          })()}
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
                {(() => {
                  let disc = 0;
                  if (selectedCoupon?.reward) {
                    const reward = selectedCoupon.reward;
                    if (reward.type === 'DESCUENTO') {
                      disc = reward.discountMode === 'PERCENTAGE'
                        ? Math.round(totalPrice * Number(reward.discountAmount) / 100 * 100) / 100
                        : Math.min(Number(reward.discountAmount), totalPrice);
                    } else if (reward.type === 'SERVICIO') {
                      const svc = selectedServices?.find((s: any) => s.id === reward.serviceId);
                      if (svc) disc = Number(svc.price);
                    }
                  }
                  const hasAnyDiscount = disc > 0 || promoDiscount > 0;
                  const finalTotal = Math.max(0, totalPrice - disc);
                  return (
                    <>
                      {hasAnyDiscount && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Subtotal:</span>
                          <span className="text-gray-500">{formatCurrency(basePrice, bizCurrency)}</span>
                        </div>
                      )}
                      {promoDiscount > 0 && selectedPromotion && (
                        <div className="flex justify-between text-sm">
                          <span className="text-green-600 font-medium">Promoción: {selectedPromotion.name}</span>
                          <span className="text-green-600 font-medium">-{formatCurrency(promoDiscount, bizCurrency)}</span>
                        </div>
                      )}
                      {disc > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-green-600 font-medium">Cupón: {selectedCoupon.reward?.name}</span>
                          <span className="text-green-600 font-medium">-{formatCurrency(disc, bizCurrency)}</span>
                        </div>
                      )}
                      {payWithPoints && (
                        <div className="flex justify-between text-sm">
                          <span className="text-teal-700 font-medium">Pagado con puntos</span>
                          <span className="text-teal-700 font-medium">-{selectedServices.reduce((s, sv) => s + (sv.pointsRequired || 0), 0)} pts</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm border-t border-gray-200 pt-2">
                        <span className="font-semibold text-gray-900">Total:</span>
                        <span className="font-bold" style={{ color: TEAL }}>
                          {payWithPoints ? 'Gratis' : formatCurrency(finalTotal, bizCurrency)}
                        </span>
                      </div>
                    </>
                  );
                })()}
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

            {/* Promotion applied info */}
            {selectedPromotion && !earnedReferralCode && (
              <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-4">
                <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
                </svg>
                <p className="text-sm text-green-700 font-medium">Promoción aplicada: {selectedPromotion.name}</p>
              </div>
            )}

            {/* Referral code from 2x1 promotion — coupon style */}
            {earnedReferralCode && (
              <div className="mb-6">
                {selectedPromotion && (
                  <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-3">
                    <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
                    </svg>
                    <p className="text-sm text-green-700 font-medium">Promoción 2×1 aplicada</p>
                  </div>
                )}
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-1">Código para tu amigo</p>
                {/* Coupon-style card */}
                <div className="bg-white rounded-2xl overflow-hidden shadow-md flex" style={{ minHeight: 110 }}>
                  {/* Stub izquierdo — morado para diferenciarlo */}
                  <div
                    className="w-20 flex-shrink-0 flex flex-col items-center justify-center gap-0.5 relative"
                    style={{ backgroundColor: '#7c3aed' }}
                  >
                    <span className="text-white font-black text-lg leading-tight text-center">2×1</span>
                    <span className="text-white/70 text-[9px] uppercase tracking-wider">regalo</span>
                    <div className="absolute -right-3 -top-3 w-6 h-6 rounded-full bg-gray-50" />
                    <div className="absolute -right-3 -bottom-3 w-6 h-6 rounded-full bg-gray-50" />
                  </div>

                  {/* Separador perforado */}
                  <div className="flex flex-col items-center justify-center w-4 flex-shrink-0 gap-[3px] py-3">
                    {Array.from({ length: 9 }).map((_, i) => (
                      <div key={i} className="w-[3px] h-[3px] rounded-full" style={{ backgroundColor: '#d1d5db' }} />
                    ))}
                  </div>

                  {/* Contenido principal */}
                  <div className="flex-1 py-3 pr-4 flex flex-col justify-between min-w-0">
                    <div>
                      <p className="text-sm font-bold text-gray-900 leading-tight">Servicio gratis para un amigo</p>
                      <p className="text-xs text-gray-500 mt-0.5">Comparte este código y tu amigo obtiene el mismo servicio sin costo</p>
                      <div
                        className="mt-2 bg-gray-50 rounded-lg py-2 px-3 font-mono text-lg font-black tracking-[0.15em] select-all cursor-pointer text-center"
                        style={{ color: '#7c3aed' }}
                        onClick={() => navigator.clipboard.writeText(earnedReferralCode)}
                        title="Click para copiar"
                      >
                        {earnedReferralCode}
                      </div>
                    </div>

                    <div className="flex items-center justify-end mt-2">
                      <button
                        onClick={() => {
                          const refUrl = `${window.location.origin}/marketplace/${tenantSlug}?ref=${earnedReferralCode}`;
                          if (navigator.share) {
                            navigator.share({
                              title: `Código 2x1 en ${biz?.name}`,
                              text: `Usa mi código ${earnedReferralCode} para obtener un servicio gratis en ${biz?.name}. Reserva en:`,
                              url: refUrl,
                            }).catch(() => {});
                          } else {
                            navigator.clipboard.writeText(
                              `Usa mi código ${earnedReferralCode} para un servicio gratis en ${biz?.name}. Reserva aquí: ${refUrl}`
                            );
                          }
                        }}
                        className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-black tracking-wide text-white transition-transform active:scale-95 flex items-center gap-1.5"
                        style={{ backgroundColor: '#7c3aed', letterSpacing: '0.05em' }}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                        </svg>
                        COMPARTIR
                      </button>
                    </div>
                  </div>
                </div>
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
