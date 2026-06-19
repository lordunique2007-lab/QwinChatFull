import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class CallsService {
  constructor(private supabase: SupabaseService) {}

  async logCall(callerId: string, receiverId: string, type: 'voice' | 'video', chatId?: string) {
    return this.supabase.insert('call_logs', {
      caller_id: callerId,
      receiver_id: receiverId,
      chat_id: chatId,
      type,
      status: 'ringing',
      started_at: new Date().toISOString(),
    });
  }

  async updateCallStatus(callId: string, status: 'answered' | 'missed' | 'declined' | 'ended', durationSeconds = 0) {
    return this.supabase.update('call_logs', callId, {
      status,
      duration_seconds: durationSeconds,
      ended_at: new Date().toISOString(),
    });
  }

  async getCallHistory(userId: string, limit = 30) {
    const { data } = await this.supabase.db
      .from('call_logs')
      .select(`
        *,
        caller:users!caller_id(id, username, display_name, avatar_url),
        receiver:users!receiver_id(id, username, display_name, avatar_url)
      `)
      .or(`caller_id.eq.${userId},receiver_id.eq.${userId}`)
      .order('created_at', { ascending: false })
      .limit(limit);
    return data;
  }
}
