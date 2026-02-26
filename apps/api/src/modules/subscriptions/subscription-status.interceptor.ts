import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ForbiddenException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { PrismaService } from '../../prisma/prisma.service';

// Paths that are always allowed, even when suspended
const ALWAYS_ALLOWED_PATHS = [
  '/api/auth/me',
  '/api/auth/login',
  '/api/auth/refresh',
  '/api/auth/logout',
  '/api/subscription',
  '/api/subscription/usage',
  '/api/subscription/invoices',
];

// Platform endpoints are never affected by tenant subscription
const PLATFORM_PREFIX = '/api/platform';

@Injectable()
export class SubscriptionStatusInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const path = request.url?.split('?')[0] || '';
    const method = request.method;

    // Skip for platform endpoints, public endpoints, and always-allowed paths
    if (
      path.startsWith(PLATFORM_PREFIX) ||
      path.startsWith('/api/public') ||
      ALWAYS_ALLOWED_PATHS.some((p) => path.startsWith(p))
    ) {
      return next.handle();
    }

    // Only check for authenticated tenant users
    const user = request.user;
    if (!user?.tenantId) {
      return next.handle();
    }

    const subscription = await this.prisma.subscription.findUnique({
      where: { tenantId: user.tenantId },
    });

    // No subscription found — allow (legacy/free tenants)
    if (!subscription) {
      return next.handle();
    }

    // SUSPENDED: block everything except allowed paths
    if (subscription.status === 'SUSPENDED') {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'SUBSCRIPTION_SUSPENDED',
        message: 'Tu cuenta está suspendida. Contacta soporte para reactivarla.',
      });
    }

    // PAST_DUE: allow reads (GET), block writes (POST, PUT, PATCH, DELETE) on appointments
    if (subscription.status === 'PAST_DUE') {
      const isWrite = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
      const isAppointmentWrite = isWrite && path.startsWith('/api/appointments');

      if (isAppointmentWrite) {
        throw new ForbiddenException({
          statusCode: 403,
          error: 'SUBSCRIPTION_PAST_DUE',
          message: 'Tienes un pago pendiente. No puedes crear o modificar citas hasta regularizar tu cuenta.',
        });
      }

      // For other requests, add a warning to the response
      return next.handle().pipe(
        map((data) => {
          if (data && typeof data === 'object') {
            return {
              ...data,
              _subscriptionWarning: 'Pago pendiente. Tienes 24 horas para regularizar tu cuenta.',
            };
          }
          return data;
        }),
      );
    }

    return next.handle();
  }
}
