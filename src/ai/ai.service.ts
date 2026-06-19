import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AIService {
  constructor(private config: ConfigService) {}

  private async callClaude(systemPrompt: string, userMessage: string): Promise<string> {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.get('ANTHROPIC_API_KEY'),
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          system: systemPrompt,
          messages: [{ role: 'user', content: userMessage }],
        }),
      });
      const data = await response.json();
      return data.content?.[0]?.text || "I couldn't process that. Try again!";
    } catch (err) {
      console.error('AI call failed:', err);
      return "QwinAI is temporarily unavailable. Please try again shortly.";
    }
  }

  async chat(userMessage: string, conversationHistory: any[] = []) {
    const systemPrompt = `You are QwinAI, the friendly built-in AI assistant for QwinCHAT, a messaging app created by Qwin Grace. You help users with translating messages, summarizing conversations, answering questions, and general chat. Keep responses concise, warm, and helpful. Use occasional emojis naturally.`;
    return this.callClaude(systemPrompt, userMessage);
  }

  async translate(text: string, targetLanguage: string) {
    const systemPrompt = `You are a professional translator. Translate the given text to ${targetLanguage}. Return ONLY the translation, nothing else.`;
    return this.callClaude(systemPrompt, text);
  }

  async summarize(messages: string[]) {
    const systemPrompt = `Summarize this chat conversation concisely in 2-4 sentences, capturing the key points and any decisions made.`;
    return this.callClaude(systemPrompt, messages.join('\n'));
  }

  async smartReplies(lastMessage: string): Promise<string[]> {
    const systemPrompt = `Given a message, suggest exactly 3 short, natural quick-reply options (each under 6 words). Return ONLY a JSON array of 3 strings, nothing else. Example: ["Sounds good!", "Let me check", "Can't right now"]`;
    const result = await this.callClaude(systemPrompt, lastMessage);
    try {
      return JSON.parse(result.replace(/```json|```/g, '').trim());
    } catch {
      return ['👍', 'Got it!', "I'll check"];
    }
  }

  async moderateContent(content: string): Promise<{ flagged: boolean; reason?: string }> {
    const systemPrompt = `You are a content moderator. Analyze the message for: hate speech, harassment, spam, scams, or explicit content. Respond ONLY with JSON: {"flagged": true/false, "reason": "brief reason if flagged"}`;
    const result = await this.callClaude(systemPrompt, content);
    try {
      return JSON.parse(result.replace(/```json|```/g, '').trim());
    } catch {
      return { flagged: false };
    }
  }
}
