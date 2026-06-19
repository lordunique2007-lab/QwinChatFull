import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private users: UsersService) {}

  @Get('me')
  getProfile(@Req() req: any) {
    return this.users.getProfile(req.user.id);
  }

  @Patch('me')
  updateProfile(@Req() req: any, @Body() body: any) {
    return this.users.updateProfile(req.user.id, body);
  }

  @Patch('me/username')
  changeUsername(@Req() req: any, @Body() body: { username: string }) {
    return this.users.changeUsername(req.user.id, body.username);
  }

  @Patch('me/privacy')
  updatePrivacy(@Req() req: any, @Body() body: any) {
    return this.users.updatePrivacy(req.user.id, body);
  }

  @Patch('me/theme')
  updateTheme(@Req() req: any, @Body() body: { theme: string }) {
    return this.users.updateTheme(req.user.id, body.theme);
  }

  @Post(':id/block')
  blockUser(@Req() req: any, @Param('id') id: string) {
    return this.users.blockUser(req.user.id, id);
  }

  @Post(':id/unblock')
  unblockUser(@Req() req: any, @Param('id') id: string) {
    return this.users.unblockUser(req.user.id, id);
  }

  @Get('me/blocked')
  getBlocked(@Req() req: any) {
    return this.users.getBlockedUsers(req.user.id);
  }

  @Post(':id/report')
  reportUser(@Req() req: any, @Param('id') id: string, @Body() body: { reason: string; message_ids?: string[] }) {
    return this.users.reportUser(req.user.id, id, body.reason, body.message_ids || []);
  }

  @Get('me/sessions')
  getSessions(@Req() req: any) {
    return this.users.getSessions(req.user.id);
  }

  @Delete('me/sessions/:id')
  revokeSession(@Req() req: any, @Param('id') id: string) {
    return this.users.revokeSession(req.user.id, id);
  }

  @Post('me/daily-reward')
  claimDailyReward(@Req() req: any) {
    return this.users.claimDailyReward(req.user.id);
  }

  @Post('me/referral')
  useReferral(@Req() req: any, @Body() body: { code: string }) {
    return this.users.useReferralCode(req.user.id, body.code);
  }

  @Get('search')
  searchUsers(@Query('q') query: string) {
    return this.users.searchUsers(query);
  }
}
