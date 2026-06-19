import { Controller, Get, Post, Patch, Delete, Body, Param, Req, UseGuards } from '@nestjs/common';
import { GroupsService } from './groups.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller('groups')
@UseGuards(JwtAuthGuard)
export class GroupsController {
  constructor(private groups: GroupsService) {}

  @Post()
  create(@Req() req: any, @Body() body: any) {
    return this.groups.createGroup(req.user.id, body);
  }

  @Get(':id')
  getDetails(@Req() req: any, @Param('id') id: string) {
    return this.groups.getGroupDetails(id, req.user.id);
  }

  @Post(':id/members')
  addMember(@Req() req: any, @Param('id') id: string, @Body() body: { user_id: string }) {
    return this.groups.addMember(id, req.user.id, body.user_id);
  }

  @Delete(':id/members/:userId')
  removeMember(@Req() req: any, @Param('id') id: string, @Param('userId') userId: string) {
    return this.groups.removeMember(id, req.user.id, userId);
  }

  @Post(':id/members/:userId/promote')
  promote(@Req() req: any, @Param('id') id: string, @Param('userId') userId: string) {
    return this.groups.promoteAdmin(id, req.user.id, userId);
  }

  @Post(':id/members/:userId/demote')
  demote(@Req() req: any, @Param('id') id: string, @Param('userId') userId: string) {
    return this.groups.demoteAdmin(id, req.user.id, userId);
  }

  @Post(':id/leave')
  leave(@Req() req: any, @Param('id') id: string) {
    return this.groups.leaveGroup(id, req.user.id);
  }

  @Patch(':id')
  updateSettings(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.groups.updateGroupSettings(id, req.user.id, body);
  }

  @Post(':id/upgrade-capacity')
  upgradeCapacity(@Req() req: any, @Param('id') id: string, @Body() body: { points: number }) {
    return this.groups.upgradeCapacity(id, req.user.id, body.points);
  }

  @Post('join/:inviteCode')
  joinViaInvite(@Req() req: any, @Param('inviteCode') code: string) {
    return this.groups.joinViaInviteLink(code, req.user.id);
  }
}
