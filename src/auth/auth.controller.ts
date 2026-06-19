import { Controller, Post, Body, Get, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt.guard';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  // POST /api/v1/auth/send-otp
  @Post('send-otp')
  sendOtp(@Body() body: { contact: string; type: 'phone' | 'email' }) {
    return this.auth.sendOtp(body.contact, body.type);
  }

  // POST /api/v1/auth/verify-otp
  @Post('verify-otp')
  verifyOtp(@Body() body: { contact: string; code: string }) {
    return this.auth.verifyOtp(body.contact, body.code);
  }

  // POST /api/v1/auth/register
  @Post('register')
  register(@Body() body: any) {
    return this.auth.register(body);
  }

  // POST /api/v1/auth/login
  @Post('login')
  login(@Body() body: { contact: string; contact_type: 'phone' | 'email' }) {
    return this.auth.login(body.contact, body.contact_type);
  }

  // POST /api/v1/auth/logout
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout(@Req() req: any) {
    return this.auth.logout(req.user.id);
  }

  // POST /api/v1/auth/refresh
  @Post('refresh')
  refresh(@Body() body: { refresh_token: string }) {
    return this.auth.refreshToken(body.refresh_token);
  }

  // GET /api/v1/auth/me
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: any) {
    return { user: req.user };
  }
}
