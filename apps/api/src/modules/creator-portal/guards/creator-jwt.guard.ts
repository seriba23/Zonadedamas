import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class CreatorJwtGuard extends AuthGuard('creator-jwt') {
  handleRequest<TUser = any>(err: any, user: any, _info: any): TUser {
    if (err || !user) {
      throw err || new UnauthorizedException('Autenticación de creador requerida');
    }
    return user;
  }
}
