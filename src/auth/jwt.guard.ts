import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private config: ConfigService,
    private supabase: SupabaseService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    const user = await this.supabase.findById('users', payload.sub);
    if (!user) throw new UnauthorizedException();
    if (user.is_banned) throw new UnauthorizedException('Account banned');
    if (user.is_frozen) throw new UnauthorizedException('Account frozen');
    return user;
  }
}

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}

@Injectable()
export class AdminGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any) {
    if (err || !user) throw new UnauthorizedException();
    if (user.role !== 'admin' && user.role !== 'owner') {
      throw new UnauthorizedException('Admin access required');
    }
    return user;
  }
}

@Injectable()
export class OwnerGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any) {
    if (err || !user) throw new UnauthorizedException();
    if (user.role !== 'owner') {
      throw new UnauthorizedException('Owner access required');
    }
    return user;
  }
}
