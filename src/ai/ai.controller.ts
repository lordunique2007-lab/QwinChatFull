import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { AIService } from './ai.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AIController {
  constructor(private ai: AIService) {}

  @Post('chat')
  chat(@Body() body: { message: string; history?: any[] }) {
    return this.ai.chat(body.message, body.history).then(response => ({ response }));
  }

  @Post('translate')
  translate(@Body() body: { text: string; target_language: string }) {
    return this.ai.translate(body.text, body.target_language).then(translation => ({ translation }));
  }

  @Post('summarize')
  summarize(@Body() body: { messages: string[] }) {
    return this.ai.summarize(body.messages).then(summary => ({ summary }));
  }

  @Post('smart-replies')
  smartReplies(@Body() body: { message: string }) {
    return this.ai.smartReplies(body.message).then(replies => ({ replies }));
  }
}
