import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class MessagesService {
  constructor(private supabase: SupabaseService) {}

  // Get messages for a chat
  async getChatMessages(chatId: string, userId: string, limit = 50, before?: string) {
    // Verify member
    await this.verifyMember(chatId, userId);

    let query = this.supabase.db
      .from('messages')
      .select(`
        *,
        sender:users!sender_id(id, username, display_name, avatar_url, badge_type),
        reply_to:messages!reply_to_id(id, content, sender:users!sender_id(username)),
        reactions:message_reactions(emoji, user_id),
        receipts:message_receipts(user_id, read_at, delivered_at)
      `)
      .eq('chat_id', chatId)
      .eq('is_deleted_for_all', false)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (before) query = query.lt('created_at', before);

    const { data, error } = await query;
    if (error) throw error;

    // Filter deleted-for-me messages
    const deletedForMe = await this.supabase.db
      .from('deleted_messages')
      .select('message_id')
      .eq('user_id', userId);
    const deletedIds = new Set((deletedForMe.data || []).map((d: any) => d.message_id));

    return (data || []).filter((m: any) => !deletedIds.has(m.id)).reverse();
  }

  // Edit message
  async editMessage(messageId: string, userId: string, content: string) {
    const message = await this.supabase.findById('messages', messageId);
    if (!message) throw new NotFoundException('Message not found');
    if (message.sender_id !== userId) throw new ForbiddenException('Cannot edit others messages');

    const editWindow = 15 * 60 * 1000; // 15 minutes
    if (Date.now() - new Date(message.created_at).getTime() > editWindow) {
      throw new ForbiddenException('Edit window expired (15 minutes)');
    }

    return this.supabase.update('messages', messageId, {
      content,
      is_edited: true,
      edited_at: new Date().toISOString(),
    });
  }

  // Delete message for me
  async deleteForMe(messageId: string, userId: string) {
    await this.supabase.insert('deleted_messages', { message_id: messageId, user_id: userId });
    return { success: true };
  }

  // Delete message for everyone
  async deleteForEveryone(messageId: string, userId: string) {
    const message = await this.supabase.findById('messages', messageId);
    if (!message) throw new NotFoundException('Message not found');
    if (message.sender_id !== userId) throw new ForbiddenException('Cannot delete others messages');

    const deleteWindow = 60 * 60 * 1000; // 1 hour
    if (Date.now() - new Date(message.created_at).getTime() > deleteWindow) {
      throw new ForbiddenException('Delete window expired (1 hour)');
    }

    return this.supabase.update('messages', messageId, { is_deleted_for_all: true, content: null });
  }

  // Pin message
  async pinMessage(messageId: string, chatId: string, userId: string) {
    await this.verifyAdmin(chatId, userId);
    return this.supabase.update('messages', messageId, { is_pinned: true });
  }

  // Star message
  async starMessage(messageId: string, userId: string) {
    await this.supabase.db.from('starred_messages').upsert({ message_id: messageId, user_id: userId });
    return { starred: true };
  }

  // Get starred messages
  async getStarredMessages(userId: string) {
    const { data } = await this.supabase.db
      .from('starred_messages')
      .select('*, message:messages(*)')
      .eq('user_id', userId)
      .order('starred_at', { ascending: false });
    return data;
  }

  // Schedule message
  async scheduleMessage(chatId: string, userId: string, content: string, scheduleAt: string) {
    await this.verifyMember(chatId, userId);
    return this.supabase.insert('messages', {
      chat_id: chatId,
      sender_id: userId,
      content,
      type: 'text',
      schedule_at: scheduleAt,
    });
  }

  // Search messages
  async searchMessages(userId: string, query: string) {
    const { data } = await this.supabase.db
      .from('messages')
      .select(`*, chat:chats(id, name, type), sender:users!sender_id(username, display_name)`)
      .textSearch('content', query)
      .limit(20);
    return data;
  }

  private async verifyMember(chatId: string, userId: string) {
    const { data } = await this.supabase.db
      .from('chat_members')
      .select('id')
      .eq('chat_id', chatId)
      .eq('user_id', userId)
      .single();
    if (!data) throw new ForbiddenException('Not a member of this chat');
  }

  private async verifyAdmin(chatId: string, userId: string) {
    const { data } = await this.supabase.db
      .from('chat_members')
      .select('role')
      .eq('chat_id', chatId)
      .eq('user_id', userId)
      .single();
    if (!data || (data.role !== 'admin' && data.role !== 'owner')) {
      throw new ForbiddenException('Admin access required');
    }
  }
}
