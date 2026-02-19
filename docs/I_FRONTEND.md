# Frontend Architecture (Next.js 14)

## Overview

The frontend is a Next.js 14 application using the App Router, Tailwind CSS for styling, and TanStack Query for server state management. It communicates exclusively with the NestJS API via REST.

---

## Route Structure

```
src/app/
  layout.tsx                    → Root layout (providers: AuthProvider, QueryClientProvider)
  page.tsx                      → Redirect to /calendar

  (auth)/
    login/
      page.tsx                  → Login form (email + password)

  (dashboard)/
    layout.tsx                  → Protected layout: Sidebar + Header + Main content area
    calendar/
      page.tsx                  → Appointment calendar (day/week view)
    clients/
      page.tsx                  → Client list with search + pagination
      [id]/
        page.tsx                → Client detail + appointment history
    services/
      page.tsx                  → Service management (CRUD)
    staff/
      page.tsx                  → Employee management (CRUD + schedules + time-off)
      [id]/
        page.tsx                → Employee detail + schedule editor
    resources/
      page.tsx                  → Resource management (rooms, chairs, equipment)
    pos/
      page.tsx                  → Point of Sale checkout
    reports/
      page.tsx                  → Reports dashboard (revenue, appointments, no-show)
    settings/
      page.tsx                  → General settings
      roles/
        page.tsx                → Role + Permission management matrix
      locations/
        page.tsx                → Location management
      automations/
        page.tsx                → Automation rules (V1)

  book/
    [tenantSlug]/
      page.tsx                  → Public booking page (no auth required)
```

---

## Component Hierarchy

### UI Primitives (Reusable)

These are generic, unstyled-logic components built on Radix UI primitives + Tailwind.

```
components/ui/
  Button.tsx         → Primary, secondary, destructive, ghost variants
  Input.tsx          → Controlled input with label + error state
  Select.tsx         → Dropdown select with search
  Modal.tsx          → Dialog overlay with backdrop
  Drawer.tsx         → Slide-in panel (right or bottom)
  Table.tsx          → Sortable, paginated data table
  Badge.tsx          → Status badges with color variants
  DatePicker.tsx     → Single date and date range picker
  TimePicker.tsx     → Time slot selector
  Avatar.tsx         → User/employee avatar with initials fallback
  Spinner.tsx        → Loading spinner
  Toast.tsx          → Notification toasts (via react-hot-toast)
  EmptyState.tsx     → Empty list placeholder with CTA
  Pagination.tsx     → Page navigation controls
  Skeleton.tsx       → Loading skeleton placeholders
  ColorPicker.tsx    → Hex color picker for services/employees
```

### Layout Components

```
components/layout/
  Sidebar.tsx           → Navigation sidebar with permission-aware menu items
  Header.tsx            → Top bar with location selector, user menu
  PageHeader.tsx        → Page title + action buttons
  ProtectedLayout.tsx   → Wraps dashboard pages, enforces auth
```

### Feature Components

```
components/calendar/
  CalendarView.tsx          → Day/week calendar grid
  AppointmentBlock.tsx      → Colored appointment card on calendar
  TimeColumn.tsx            → Hour markers on left side of calendar

components/appointments/
  AppointmentModal.tsx      → Create/view appointment drawer
  AppointmentStatusBadge.tsx → Status badge with color
  AppointmentActions.tsx    → Cancel/reschedule/complete actions (permission-gated)

components/availability/
  AvailabilityPicker.tsx    → Date + time slot selection UI
  SlotGrid.tsx              → Grid of available time slots
  EmployeeSelector.tsx      → Employee filter for availability

components/clients/
  ClientDrawer.tsx          → Slide-in client detail panel
  ClientSearchBox.tsx       → Debounced search input
  ClientTagBadge.tsx        → Colored tag pill

components/pos/
  POSCheckout.tsx           → Full POS flow: items, payment method, tip, total
  PaymentMethodSelector.tsx → Cash/card/transfer toggle
  ReceiptPreview.tsx        → Receipt summary before confirming

components/staff/
  ScheduleEditor.tsx        → Weekly schedule grid editor
  TimeOffCalendar.tsx       → Time-off management UI
  ServiceAssignment.tsx     → Multi-select service assignment

components/rbac/
  RolePermissionMatrix.tsx  → Checkbox grid: roles x permissions
  RoleCard.tsx              → Role summary with permission count

components/reports/
  RevenueChart.tsx          → Line/bar chart for revenue
  AppointmentStats.tsx      → KPI cards (total, completed, cancelled)
  NoShowRate.tsx            → No-show percentage gauge
```

---

## State Management

### Server State: TanStack Query

All API data is managed via `@tanstack/react-query`. No Redux or Zustand needed for MVP.

```typescript
// hooks/useClients.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export function useClients(params: ClientQueryParams) {
  return useQuery({
    queryKey: ['clients', params],
    queryFn: () => apiClient.get('/clients', { params }),
    staleTime: 30_000, // 30 seconds
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateClientDto) => apiClient.post('/clients', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });
}

export function useClient(id: string) {
  return useQuery({
    queryKey: ['clients', id],
    queryFn: () => apiClient.get(`/clients/${id}`),
    enabled: !!id,
  });
}
```

### Auth State: React Context

```typescript
// contexts/AuthContext.tsx
'use client';

import { createContext, useContext, useState, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  tenantId: string;
  permissions: string[];
}

interface AuthContextValue {
  user: User | null;
  accessToken: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const { data } = await apiClient.post('/auth/login', { email, password });
      setAccessToken(data.data.accessToken);
      setUser(data.data.user);
      // Store refresh token in localStorage for persistence
      localStorage.setItem('refreshToken', data.data.refreshToken);
      // Store access token in memory only (not localStorage - XSS mitigation)
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) {
      await apiClient.post('/auth/logout', { refreshToken }).catch(() => {});
    }
    setUser(null);
    setAccessToken(null);
    localStorage.removeItem('refreshToken');
  }, []);

  return (
    <AuthContext.Provider value={{ user, accessToken, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
```

---

## Auth Flow

### Login Flow

```
1. User submits login form (email + password)
2. POST /api/auth/login
3. On success:
   a. accessToken stored in React state (memory only)
   b. refreshToken stored in localStorage
   c. Redirect to /calendar
4. /api/auth/me called to fetch full user + permissions
5. Permissions stored in AuthContext
```

### Token Refresh Flow

```
1. API request returns 401
2. apiClient interceptor catches 401
3. POST /api/auth/refresh with stored refreshToken
4. On success:
   a. New accessToken stored in memory
   b. New refreshToken stored in localStorage
   c. Original request retried with new accessToken
5. On failure (refresh also 401):
   a. Logout user
   b. Redirect to /login
```

### API Client with Interceptors

```typescript
// lib/api-client.ts
import axios, { AxiosInstance } from 'axios';

let authStore: { accessToken: string | null; refreshToken: string | null } = {
  accessToken: null,
  refreshToken: null,
};

export function setAuthTokens(access: string, refresh: string) {
  authStore = { accessToken: access, refreshToken: refresh };
}

export const apiClient: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api',
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor - attach access token
apiClient.interceptors.request.use((config) => {
  if (authStore.accessToken) {
    config.headers.Authorization = `Bearer ${authStore.accessToken}`;
  }
  return config;
});

// Response interceptor - handle 401 with token refresh
let isRefreshing = false;
let failedQueue: Array<{ resolve: Function; reject: Function }> = [];

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return apiClient(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        const { data } = await axios.post('/api/auth/refresh', { refreshToken });
        const newAccessToken = data.data.accessToken;

        authStore.accessToken = newAccessToken;
        localStorage.setItem('refreshToken', data.data.refreshToken);

        failedQueue.forEach(({ resolve }) => resolve(newAccessToken));
        failedQueue = [];

        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return apiClient(originalRequest);
      } catch {
        failedQueue.forEach(({ reject }) => reject(error));
        failedQueue = [];
        // Redirect to login
        window.location.href = '/login';
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);
```

---

## Route Protection

### middleware.ts

```typescript
// src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login', '/book/'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic = PUBLIC_PATHS.some(path => pathname.startsWith(path));
  if (isPublic) return NextResponse.next();

  // For dashboard routes, check for auth cookie (set on login for SSR pages)
  // Since we use memory + localStorage for tokens, protection is mainly client-side
  // The API itself enforces auth, so worst case user sees empty state then redirects

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|api|favicon.ico).*)'],
};
```

---

## Key Custom Hooks

```typescript
// hooks/useAppointments.ts
export function useAppointments(params: AppointmentQueryParams) {
  return useQuery({
    queryKey: ['appointments', params],
    queryFn: () => apiClient.get('/appointments', { params }).then(r => r.data),
    staleTime: 10_000,
  });
}

// hooks/useAvailability.ts
export function useAvailability(query: AvailabilityQuery | null) {
  return useQuery({
    queryKey: ['availability', query],
    queryFn: () => apiClient.post('/availability/query', query).then(r => r.data),
    enabled: !!query && !!query.serviceIds?.length,
    staleTime: 60_000,
  });
}

// hooks/usePermissions.ts
export function usePermissions() {
  const { user } = useAuth();
  const permissions = user?.permissions ?? [];
  return {
    hasPermission: (p: string) => permissions.includes(p),
    hasAnyPermission: (...ps: string[]) => ps.some(p => permissions.includes(p)),
    permissions,
  };
}
```

---

## Tailwind Configuration

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fdf4ff',
          100: '#fae8ff',
          500: '#a855f7',
          600: '#9333ea',
          700: '#7e22ce',
          900: '#581c87',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
```

---

## Environment Variables

```bash
# apps/web/.env.local
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_APP_NAME=Zona de Damas
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Performance Considerations

| Concern | Solution |
|---|---|
| Initial page load | Server Components for static shell, Client Components for interactive parts |
| API waterfall | Parallel `useQuery` calls on page mount |
| Stale data | TanStack Query with appropriate `staleTime` per resource type |
| Calendar rendering | Virtualized rendering for week view with many appointments |
| Search debouncing | 300ms debounce on all search inputs before API call |
| Image optimization | Next.js `<Image>` component for logos and avatars |
