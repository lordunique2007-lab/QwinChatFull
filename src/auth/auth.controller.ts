import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('send-otp')
  sendOtp(@Body('contact') contact: string) {
    return this.authService.sendOtp(contact);
  }

  @Post('verify-otp')
  verifyOtp(
    @Body()
    body: {
      contact: string;
      code: string;
      username?: string;
      deviceName?: string;
      deviceType?: string;
    },
  ) {
    return this.authService.verifyOtp(body);
  }

  // TESTING ONLY — skips OTP entirely. Remove or disable before real users arrive.
  @Post('quick-login')
  quickLogin(
    @Body()
    body: {
      contact: string;
      username?: string;
      deviceName?: string;
      deviceType?: string;
    },
  ) {
    return this.authService.quickLogin(body);
  }
}
