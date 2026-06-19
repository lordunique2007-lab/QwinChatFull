import { Controller, Post, Body, Req, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private notifications: NotificationsService) {}

  @Post('register-token')
  registerToken(@Req() req: any, @Body() body: { token: string }) {
    return this.notifications.registerPushToken(req.user.id, body.token);
  }
}
