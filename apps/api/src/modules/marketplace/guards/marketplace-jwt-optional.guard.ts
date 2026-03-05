import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class MarketplaceJwtOptionalGuard extends AuthGuard('marketplace-jwt') {
  handleRequest<TUser = any>(_err: any, user: any): TUser {
    return user || null;
  }
}
