'use client';

import { useState, useMemo } from 'react';
import { useAuth } from '@/lib/hooks/use-auth';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import dayjs from 'dayjs';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface AppointmentItem {
  serviceNameSnapshot: string;
}

interface AppointmentPhoto {
  id: string;
  imageUrl: string;
  caption: string | null;
  createdAt: string;
}

interface Appointment {
  id: string;
  startTime: string;
  status: string;
  client: { id: string; firstName: string; lastName: string };
  items: AppointmentItem[];
}

interface GalleryPhoto {
  photoId: string;
  url: string;
  caption: string | null;
  appointmentId: string;
  date: string;
  clientName: string;
  serviceName: string;
}

type MonthFilter = 'all' | string; // 'all' or 'YYYY-MM'

export default function EmployeeGalleryPage() {
  const { user } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState<MonthFilter>('all');
  const [lightboxPhoto, setLightboxPhoto] = useState<GalleryPhoto | null>(null);

  // Fetch completed appointments
  const { data: appointments } = useQuery({
    queryKey: ['employee-gallery-appointments', user?.employeeId],
    queryFn: async () => {
      const res = await api.get<{ data: Appointment[] }>(
        `/api/appointments?employeeId=${user!.employeeId}&status=COMPLETED&perPage=100`,
      );
      return res.data;
    },
    enabled: !!user?.employeeId,
  });

  // Fetch photos for each completed appointment
  const appointmentIds = useMemo(
    () => (appointments || []).map((a) => a.id),
    [appointments],
  );

  const { data: photosMap, isLoading } = useQuery({
    queryKey: ['employee-gallery-photos', appointmentIds],
    queryFn: async () => {
      const map: Record<string, AppointmentPhoto[]> = {};
      const fetches = appointmentIds.map(async (id) => {
        try {
          const res = await api.get<{ data: AppointmentPhoto[] }>(
            `/api/appointments/${id}/photos`,
          );
          if (res.data.length > 0) {
            map[id] = res.data;
          }
        } catch {
          // Appointment might not have photos, skip
        }
      });
      await Promise.all(fetches);
      return map;
    },
    enabled: appointmentIds.length > 0,
  });

  // Build gallery items
  const galleryPhotos = useMemo(() => {
    if (!appointments || !photosMap) return [];
    const result: GalleryPhoto[] = [];
    for (const apt of appointments) {
      const photos = photosMap[apt.id];
      if (!photos) continue;
      for (const photo of photos) {
        result.push({
          photoId: photo.id,
          url: photo.imageUrl,
          caption: photo.caption,
          appointmentId: apt.id,
          date: apt.startTime,
          clientName: `${apt.client.firstName} ${apt.client.lastName}`,
          serviceName: apt.items.map((i) => i.serviceNameSnapshot).join(', '),
        });
      }
    }
    return result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [appointments, photosMap]);

  // Available months for filter
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    galleryPhotos.forEach((p) => months.add(dayjs(p.date).format('YYYY-MM')));
    return Array.from(months).sort().reverse();
  }, [galleryPhotos]);

  // Filtered photos
  const filteredPhotos = useMemo(() => {
    if (selectedMonth === 'all') return galleryPhotos;
    return galleryPhotos.filter(
      (p) => dayjs(p.date).format('YYYY-MM') === selectedMonth,
    );
  }, [galleryPhotos, selectedMonth]);

  if (!user?.employeeId) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-800 text-sm">
          Tu cuenta no esta vinculada a un perfil de empleado.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Mi Galería</h1>

      {/* Filters */}
      {availableMonths.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <button
            onClick={() => setSelectedMonth('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              selectedMonth === 'all'
                ? 'bg-[#008080] text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            Todos
          </button>
          {availableMonths.map((month) => (
            <button
              key={month}
              onClick={() => setSelectedMonth(month)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors capitalize ${
                selectedMonth === month
                  ? 'bg-[#008080] text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {dayjs(month + '-01').format('MMM YYYY')}
            </button>
          ))}
        </div>
      )}

      {/* Gallery grid */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-primary-200 border-t-primary-600 rounded-full" />
        </div>
      ) : filteredPhotos.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <span className="text-4xl mb-3 block">📸</span>
          <p className="text-gray-500">No hay fotos en tu galería</p>
          <p className="text-sm text-gray-400 mt-1">
            Las fotos de resultados de tus citas completadas aparecerán aquí
          </p>
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-500 mb-4">
            {filteredPhotos.length} foto{filteredPhotos.length !== 1 ? 's' : ''}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {filteredPhotos.map((photo) => (
              <div
                key={photo.photoId}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setLightboxPhoto(photo)}
              >
                <div className="aspect-square relative bg-gray-100">
                  <img
                    src={`${API_URL}${photo.url}`}
                    alt={photo.caption || photo.serviceName}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-3">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {photo.serviceName}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{photo.clientName}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {dayjs(photo.date).format('D MMM YYYY')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Lightbox modal */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setLightboxPhoto(null)}
        >
          <div
            className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative">
              <img
                src={`${API_URL}${lightboxPhoto.url}`}
                alt={lightboxPhoto.caption || lightboxPhoto.serviceName}
                className="w-full max-h-[60vh] object-contain bg-gray-100"
              />
              <button
                onClick={() => setLightboxPhoto(null)}
                className="absolute top-3 right-3 w-8 h-8 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-black/70 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-5">
              <p className="text-base font-medium text-gray-900">
                {lightboxPhoto.serviceName}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {lightboxPhoto.clientName} — {dayjs(lightboxPhoto.date).format('D [de] MMMM YYYY')}
              </p>
              {lightboxPhoto.caption && (
                <p className="text-sm text-gray-600 mt-2">{lightboxPhoto.caption}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
