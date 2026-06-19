import { Controller, Get, Post, Patch, Delete, Body, Param, Req, UseGuards } from '@nestjs/common';
import { ChatsService } from './chats.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller('chats')
@UseGuards(JwtAuthGuard)
export class ChatsController {
  constructor(private chats: ChatsService) {}

  @Get()
  getMyChats(@Req() req: any) {
    return this.chats.getUserChats(req.user.id);
  }

  @Post('private')
  createPrivateChat(@Req() req: any, @Body() body: { target_user_id: string }) {
    return this.chats.getOrCreatePrivateChat(req.user.id, body.target_user_id);
  }

  @Get(':id')
  getChatDetails(@Req() req: any, @Param('id') id: string) {
    return this.chats.getChatDetails(req.user.id, id);
  }

  @Patch(':id/archive')
  archive(@Req() req: any, @Param('id') id: string, @Body() body: { archived: boolean }) {
    return this.chats.archiveChat(req.user.id, id, body.archived);
  }

  @Patch(':id/pin')
  pin(@Req() req: any, @Param('id') id: string, @Body() body: { pinned: boolean }) {
    return this.chats.pinChat(req.user.id, id, body.pinned);
  }

  @Patch(':id/mute')
  mute(@Req() req: any, @Param('id') id: string, @Body() body: { muted: boolean }) {
    return this.chats.muteChat(req.user.id, id, body.muted);
  }

  @Post(':id/read')
  markRead(@Req() req: any, @Param('id') id: string) {
    return this.chats.markAsRead(req.user.id, id);
  }

  @Delete(':id')
  deleteChat(@Req() req: any, @Param('id') id: string) {
    return this.chats.deleteChat(req.user.id, id);
  }
}
