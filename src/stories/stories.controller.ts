import { Controller, Get, Post, Delete, Body, Param, Req, UseGuards } from '@nestjs/common';
import { StoriesService } from './stories.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller('stories')
@UseGuards(JwtAuthGuard)
export class StoriesController {
  constructor(private stories: StoriesService) {}

  @Post()
  create(@Req() req: any, @Body() body: any) {
    return this.stories.createStory(req.user.id, body);
  }

  @Get('feed')
  getFeed(@Req() req: any) {
    return this.stories.getStoriesFeed(req.user.id);
  }

  @Get('mine')
  getMine(@Req() req: any) {
    return this.stories.getMyStories(req.user.id);
  }

  @Post(':id/view')
  view(@Req() req: any, @Param('id') id: string) {
    return this.stories.viewStory(id, req.user.id);
  }

  @Get(':id/viewers')
  getViewers(@Req() req: any, @Param('id') id: string) {
    return this.stories.getStoryViewers(id, req.user.id);
  }

  @Delete(':id')
  delete(@Req() req: any, @Param('id') id: string) {
    return this.stories.deleteStory(id, req.user.id);
  }

  @Post(':id/reply')
  reply(@Req() req: any, @Param('id') id: string, @Body() body: { content: string }) {
    return this.stories.replyToStory(id, req.user.id, body.content);
  }
}
