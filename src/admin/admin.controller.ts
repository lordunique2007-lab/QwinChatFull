import { Controller, Get, Post, Patch, Body, Param, Query, Req, UseGuards, Ip } from '@nestjs/common';
import { AdminService } from './admin.service';
import { OwnerGuard, AdminGuard } from '../auth/jwt.guard';

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(private admin: AdminService) {}

  // Dashboard stats
  @Get('stats')
  getStats(@Req() req: any) {
    return this.admin.getPlatformStats(req.user.id);
  }

  // Audit logs
  @Get('audit-logs')
  getAuditLogs(@Req() req: any, @Query('limit') limit?: number) {
    return this.admin.getAuditLogs(req.user.id, limit);
  }

  // User search
  @Get('users/search')
  searchUsers(@Req() req: any, @Query('q') query: string) {
    return this.admin.searchUsers(req.user.id, query);
  }

  // Power 1 - Permanent ban
  @Post('users/:id/ban/permanent')
  permanentBan(@Req() req: any, @Param('id') id: string, @Body() body: { reason: string }, @Ip() ip: string) {
    return this.admin.permanentBanUser(req.user.id, id, body.reason, ip);
  }

  // Power 2 - Temp ban
  @Post('users/:id/ban/temp')
  tempBan(@Req() req: any, @Param('id') id: string, @Body() body: { reason: string; hours: number }, @Ip() ip: string) {
    return this.admin.temporaryBanUser(req.user.id, id, body.reason, body.hours, ip);
  }

  // Power 3 - Unban
  @Post('users/:id/unban')
  unban(@Req() req: any, @Param('id') id: string, @Ip() ip: string) {
    return this.admin.unbanUser(req.user.id, id, ip);
  }

  // Power 4 - Mute
  @Post('users/:id/mute')
  mute(@Req() req: any, @Param('id') id: string, @Body() body: { hours: number }, @Ip() ip: string) {
    return this.admin.muteUser(req.user.id, id, body.hours, ip);
  }

  // Power 5 - Unmute
  @Post('users/:id/unmute')
  unmute(@Req() req: any, @Param('id') id: string, @Ip() ip: string) {
    return this.admin.unmuteUser(req.user.id, id, ip);
  }

  // Power 6 - Delete account
  @UseGuards(OwnerGuard)
  @Post('users/:id/delete')
  deleteAccount(@Req() req: any, @Param('id') id: string, @Ip() ip: string) {
    return this.admin.deleteAccount(req.user.id, id, ip);
  }

  // Power 7 - Restore account
  @Post('users/:id/restore')
  restoreAccount(@Req() req: any, @Param('id') id: string, @Ip() ip: string) {
    return this.admin.restoreAccount(req.user.id, id, ip);
  }

  // Power 8 - Broadcast to all
  @Post('broadcast/all')
  broadcastAll(@Req() req: any, @Body() body: { message: string }, @Ip() ip: string) {
    return this.admin.broadcastToAllUsers(req.user.id, body.message, ip);
  }

  // Power 13 - Announcement
  @Post('announcement')
  announce(@Req() req: any, @Body() body: { title: string; message: string }, @Ip() ip: string) {
    return this.admin.createGlobalAnnouncement(req.user.id, body.title, body.message, ip);
  }

  // Power 14 - Delete any message
  @Post('messages/:id/delete')
  deleteMessage(@Req() req: any, @Param('id') id: string, @Ip() ip: string) {
    return this.admin.deleteAnyMessage(req.user.id, id, ip);
  }

  // Power 15 - Delete any group
  @Post('groups/:id/delete')
  deleteGroup(@Req() req: any, @Param('id') id: string, @Ip() ip: string) {
    return this.admin.deleteAnyGroup(req.user.id, id, ip);
  }

  // Power 18 - Freeze
  @Post('users/:id/freeze')
  freeze(@Req() req: any, @Param('id') id: string, @Ip() ip: string) {
    return this.admin.freezeAccount(req.user.id, id, ip);
  }

  // Power 19 - Unfreeze
  @Post('users/:id/unfreeze')
  unfreeze(@Req() req: any, @Param('id') id: string, @Ip() ip: string) {
    return this.admin.unfreezeAccount(req.user.id, id, ip);
  }

  // Power 20 - Force logout
  @Post('users/:id/force-logout')
  forceLogout(@Req() req: any, @Param('id') id: string, @Ip() ip: string) {
    return this.admin.forceLogout(req.user.id, id, ip);
  }

  // Power 23/24 - Admin roles
  @Post('users/:id/make-admin')
  makeAdmin(@Req() req: any, @Param('id') id: string, @Ip() ip: string) {
    return this.admin.assignAdmin(req.user.id, id, ip);
  }

  @Post('users/:id/remove-admin')
  removeAdmin(@Req() req: any, @Param('id') id: string, @Ip() ip: string) {
    return this.admin.removeAdmin(req.user.id, id, ip);
  }

  // Power 38 - Shadow ban
  @Post('users/:id/shadow-ban')
  shadowBan(@Req() req: any, @Param('id') id: string, @Ip() ip: string) {
    return this.admin.shadowBanUser(req.user.id, id, ip);
  }

  // Power 40 - Maintenance
  @Post('maintenance')
  maintenance(@Req() req: any, @Body() body: { enabled: boolean; message?: string }, @Ip() ip: string) {
    return this.admin.setMaintenanceMode(req.user.id, body.enabled, body.message, ip);
  }

  // Power 41 - Verification
  @Get('verifications')
  getVerifications() {
    return { message: 'Verification requests' };
  }

  @Post('verifications/:id/approve')
  approveVerification(@Req() req: any, @Param('id') id: string, @Body() body: { badge_type: string }, @Ip() ip: string) {
    return this.admin.approveVerification(req.user.id, id, body.badge_type, ip);
  }

  @Post('verifications/:id/reject')
  rejectVerification(@Req() req: any, @Param('id') id: string, @Body() body: { notes: string }, @Ip() ip: string) {
    return this.admin.rejectVerification(req.user.id, id, body.notes, ip);
  }

  // Power 42 - Badges
  @Post('users/:id/badge')
  assignBadge(@Req() req: any, @Param('id') id: string, @Body() body: { badge_type: string }, @Ip() ip: string) {
    return this.admin.assignBadge(req.user.id, id, body.badge_type, ip);
  }

  @Post('users/:id/badge/remove')
  removeBadge(@Req() req: any, @Param('id') id: string, @Ip() ip: string) {
    return this.admin.removeBadge(req.user.id, id, ip);
  }

  // Power 29 - Premium
  @Post('users/:id/grant-premium')
  grantPremium(@Req() req: any, @Param('id') id: string, @Body() body: { days: number }, @Ip() ip: string) {
    return this.admin.grantPremium(req.user.id, id, body.days, ip);
  }

  // Power 27 - Award points
  @Post('users/:id/award-points')
  awardPoints(@Req() req: any, @Param('id') id: string, @Body() body: { points: number }, @Ip() ip: string) {
    return this.admin.manualAwardPoints(req.user.id, id, body.points, ip);
  }

  // Power 30 - Reports
  @Get('reports')
  getReports(@Req() req: any, @Query('status') status?: string) {
    return this.admin.getReports(req.user.id, status);
  }

  @Post('reports/:id/resolve')
  resolveReport(@Req() req: any, @Param('id') id: string, @Body() body: { action: string }, @Ip() ip: string) {
    return this.admin.resolveReport(req.user.id, id, body.action, ip);
  }
}
