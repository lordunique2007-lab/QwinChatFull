import { Controller, Get, Post, Patch, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { CallsService } from './calls.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller('calls')
@UseGuards(JwtAuthGuard)
export class CallsController {
  constructor(private calls: CallsService) {}

  @Post()
  logCall(@Req() req: any, @Body() body: { receiver_id: string; type: 'voice' | 'video'; chat_id?: string }) {
    return this.calls.logCall(req.user.id, body.receiver_id, body.type, body.chat_id);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() body: { status: any; duration_seconds?: number }) {
    return this.calls.updateCallStatus(id, body.status, body.duration_seconds);
  }

  @Get('history')
  getHistory(@Req() req: any, @Query('limit') limit?: number) {
    return this.calls.getCallHistory(req.user.id, limit);
  }
}
