import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ChannelsService {
  constructor(private supabase: SupabaseService) {}

  async createChannel(userId: string, data: { name: string; description?: string; is_public?: boolean }) {
    return this.supabase.insert('channels', {
      ...data,
      owner_id: userId,
      invite_link: uuidv4().slice(0, 8),
      subscriber_count: 1,
    });
  }

  async getDiscoverChannels(limit = 20) {
    const { data } = await this.supabase.db
      .from('channels')
      .select('*')
      .eq('is_public', true)
      .order('subscriber_count', { ascending: false })
      .limit(limit);
    return data;
  }

  async getMySubscriptions(userId: string) {
    const { data } = await this.supabase.db
      .from('channel_subscriptions')
      .select('*, channel:channels(*)')
      .eq('user_id', userId);
    return data?.map((d: any) => d.channel) || [];
  }

  async subscribe(channelId: string, userId: string) {
    await this.supabase.insert('channel_subscriptions', { channel_id: channelId, user_id: userId });
    const channel = await this.supabase.findById('channels', channelId);
    await this.supabase.update('channels', channelId, { subscriber_count: (channel.subscriber_count || 0) + 1 });
    return { subscribed: true };
  }

  async unsubscribe(channelId: string, userId: string) {
    await this.supabase.db.from('channel_subscriptions').delete().eq('channel_id', channelId).eq('user_id', userId);
    const channel = await this.supabase.findById('channels', channelId);
    await this.supabase.update('channels', channelId, { subscriber_count: Math.max(0, (channel.subscriber_count || 1) - 1) });
    return { subscribed: false };
  }

  async postToChannel(channelId: string, ownerId: string, content: string, mediaUrl?: string) {
    const channel = await this.supabase.findById('channels', channelId);
    if (channel.owner_id !== ownerId) throw new ForbiddenException('Only owner can post');

    return this.supabase.insert('messages', {
      chat_id: channelId,
      sender_id: ownerId,
      content,
      media_url: mediaUrl || null,
      type: mediaUrl ? 'media' : 'text',
    });
  }

  async getChannelPosts(channelId: string, limit = 30) {
    const { data } = await this.supabase.db
      .from('messages')
      .select('*')
      .eq('chat_id', channelId)
      .order('created_at', { ascending: false })
      .limit(limit);
    return data;
  }
}
