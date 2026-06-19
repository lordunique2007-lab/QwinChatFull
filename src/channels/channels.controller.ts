import { Controller, Get, Post, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ChannelsService } from './channels.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller('channels')
@UseGuards(JwtAuthGuard)
export class ChannelsController {
  constructor(private channels: ChannelsService) {}

  @Post()
  create(@Req() req: any, @Body() body: any) {
    return this.channels.createChannel(req.user.id, body);
  }

  @Get('discover')
  discover(@Query('limit') limit?: number) {
    return this.channels.getDiscoverChannels(limit);
  }

  @Get('subscriptions')
  mySubscriptions(@Req() req: any) {
    return this.channels.getMySubscriptions(req.user.id);
  }

  @Post(':id/subscribe')
  subscribe(@Req() req: any, @Param('id') id: string) {
    return this.channels.subscribe(id, req.user.id);
  }

  @Post(':id/unsubscribe')
  unsubscribe(@Req() req: any, @Param('id') id: string) {
    return this.channels.unsubscribe(id, req.user.id);
  }

  @Post(':id/posts')
  post(@Req() req: any, @Param('id') id: string, @Body() body: { content: string; media_url?: string }) {
    return this.channels.postToChannel(id, req.user.id, body.content, body.media_url);
  }

  @Get(':id/posts')
  getPosts(@Param('id') id: string, @Query('limit') limit?: number) {
    return this.channels.getChannelPosts(id, limit);
  }
}
