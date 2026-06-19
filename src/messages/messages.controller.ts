import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private messages: MessagesService) {}

  @Get('chat/:chatId')
  getChatMessages(@Req() req: any, @Param('chatId') chatId: string, @Query('limit') limit?: number, @Query('before') before?: string) {
    return this.messages.getChatMessages(chatId, req.user.id, limit, before);
  }

  @Patch(':id')
  editMessage(@Req() req: any, @Param('id') id: string, @Body() body: { content: string }) {
    return this.messages.editMessage(id, req.user.id, body.content);
  }

  @Delete(':id/me')
  deleteForMe(@Req() req: any, @Param('id') id: string) {
    return this.messages.deleteForMe(id, req.user.id);
  }

  @Delete(':id/everyone')
  deleteForEveryone(@Req() req: any, @Param('id') id: string) {
    return this.messages.deleteForEveryone(id, req.user.id);
  }

  @Post(':id/pin')
  pinMessage(@Req() req: any, @Param('id') id: string, @Body() body: { chat_id: string }) {
    return this.messages.pinMessage(id, body.chat_id, req.user.id);
  }

  @Post(':id/star')
  starMessage(@Req() req: any, @Param('id') id: string) {
    return this.messages.starMessage(id, req.user.id);
  }

  @Get('starred')
  getStarred(@Req() req: any) {
    return this.messages.getStarredMessages(req.user.id);
  }

  @Post('schedule')
  scheduleMessage(@Req() req: any, @Body() body: { chat_id: string; content: string; schedule_at: string }) {
    return this.messages.scheduleMessage(body.chat_id, req.user.id, body.content, body.schedule_at);
  }

  @Get('search')
  searchMessages(@Req() req: any, @Query('q') query: string) {
    return this.messages.searchMessages(req.user.id, query);
  }
}
