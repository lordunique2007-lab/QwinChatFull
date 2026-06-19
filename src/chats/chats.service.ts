import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class ChatsService {
  constructor(private supabase: SupabaseService) {}

  // Get all chats for user (chat list)
  async getUserChats(userId: string) {
    const { data: memberships } = await this.supabase.db
      .from('chat_members')
      .select(`
        *,
        chat:chats(*)
      `)
      .eq('user_id', userId)
      .eq('is_archived', false);

    if (!memberships) return [];

    // For each chat, get last message + other member info
    const chats = await Promise.all(memberships.map(async (m: any) => {
      const chat = m.chat;
      const { data: lastMsg } = await this.supabase.db
        .from('messages')
        .select('content, type, created_at, sender_id')
        .eq('chat_id', chat.id)
        .eq('is_deleted_for_all', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      const { count: unreadCount } = await this.supabase.db
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('chat_id', chat.id)
        .gt('created_at', m.last_read_at)
        .neq('sender_id', userId);

      let otherUser = null;
      if (chat.type === 'private') {
        const { data: otherMember } = await this.supabase.db
          .from('chat_members')
          .select('user:users(id, username, display_name, avatar_url, is_online, last_seen)')
          .eq('chat_id', chat.id)
          .neq('user_id', userId)
          .single();
        otherUser = otherMember?.user;
      }

      return {
        ...chat,
        is_pinned: m.is_pinned,
        is_muted: m.is_muted,
        unread_count: unreadCount || 0,
        last_message: lastMsg,
        other_user: otherUser,
        display_name: chat.type === 'private' ? otherUser?.display_name : chat.name,
        display_avatar: chat.type === 'private' ? otherUser?.avatar_url : chat.avatar_url,
      };
    }));

    return chats.sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
      const aTime = a.last_message?.created_at || a.created_at;
      const bTime = b.last_message?.created_at || b.created_at;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });
  }

  // Create or get private chat
  async getOrCreatePrivateChat(userId: string, targetUserId: string) {
    if (userId === targetUserId) throw new BadRequestException('Cannot chat with yourself');

    // Check if chat already exists
    const { data: existing } = await this.supabase.db
      .from('chat_members')
      .select('chat_id, chats!inner(type)')
      .eq('user_id', userId)
      .eq('chats.type', 'private');

    if (existing) {
      for (const e of existing) {
        const { data: otherMember } = await this.supabase.db
          .from('chat_members')
          .select('user_id')
          .eq('chat_id', e.chat_id)
          .eq('user_id', targetUserId)
          .single();
        if (otherMember) {
          return this.supabase.findById('chats', e.chat_id);
        }
      }
    }

    // Create new chat
    const chat = await this.supabase.insert('chats', { type: 'private', created_by: userId });
    await this.supabase.db.from('chat_members').insert([
      { chat_id: chat.id, user_id: userId, role: 'member' },
      { chat_id: chat.id, user_id: targetUserId, role: 'member' },
    ]);
    return chat;
  }

  // Archive chat
  async archiveChat(userId: string, chatId: string, archived: boolean) {
    await this.supabase.db.from('chat_members').update({ is_archived: archived }).eq('chat_id', chatId).eq('user_id', userId);
    return { archived };
  }

  // Pin chat
  async pinChat(userId: string, chatId: string, pinned: boolean) {
    await this.supabase.db.from('chat_members').update({ is_pinned: pinned }).eq('chat_id', chatId).eq('user_id', userId);
    return { pinned };
  }

  // Mute chat
  async muteChat(userId: string, chatId: string, muted: boolean) {
    await this.supabase.db.from('chat_members').update({ is_muted: muted }).eq('chat_id', chatId).eq('user_id', userId);
    return { muted };
  }

  // Mark as read
  async markAsRead(userId: string, chatId: string) {
    await this.supabase.db.from('chat_members').update({ last_read_at: new Date().toISOString() }).eq('chat_id', chatId).eq('user_id', userId);
    return { success: true };
  }

  // Delete chat (for me)
  async deleteChat(userId: string, chatId: string) {
    await this.supabase.db.from('chat_members').delete().eq('chat_id', chatId).eq('user_id', userId);
    return { deleted: true };
  }

  // Get single chat details
  async getChatDetails(userId: string, chatId: string) {
    const member = await this.supabase.db.from('chat_members').select('*').eq('chat_id', chatId).eq('user_id', userId).single();
    if (!member.data) throw new ForbiddenException('Not a member');
    return this.supabase.findById('chats', chatId);
  }
}
