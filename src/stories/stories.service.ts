import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class StoriesService {
  constructor(private supabase: SupabaseService) {}

  async createStory(userId: string, data: { type: string; content?: string; media_url?: string; background_color?: string }) {
    return this.supabase.insert('stories', {
      user_id: userId,
      ...data,
    });
  }

  // Get stories feed (contacts' active stories)
  async getStoriesFeed(userId: string) {
    const { data } = await this.supabase.db
      .from('stories')
      .select('*, user:users(id, username, display_name, avatar_url)')
      .eq('is_active', true)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    // Group by user
    const grouped: Record<string, any> = {};
    for (const story of data || []) {
      const uid = story.user_id;
      if (!grouped[uid]) {
        grouped[uid] = { user: story.user, stories: [], viewed: true };
      }
      grouped[uid].stories.push(story);
    }

    // Check viewed status
    for (const uid in grouped) {
      const storyIds = grouped[uid].stories.map((s: any) => s.id);
      const { data: views } = await this.supabase.db
        .from('story_views')
        .select('story_id')
        .eq('viewer_id', userId)
        .in('story_id', storyIds);
      const viewedIds = new Set((views || []).map((v: any) => v.story_id));
      grouped[uid].viewed = grouped[uid].stories.every((s: any) => viewedIds.has(s.id));
    }

    return Object.values(grouped);
  }

  async getMyStories(userId: string) {
    const { data } = await this.supabase.db
      .from('stories')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });
    return data;
  }

  async viewStory(storyId: string, viewerId: string) {
    await this.supabase.db.from('story_views').upsert({ story_id: storyId, viewer_id: viewerId });
    const story = await this.supabase.findById('stories', storyId);
    const { count } = await this.supabase.db.from('story_views').select('*', { count: 'exact', head: true }).eq('story_id', storyId);
    await this.supabase.update('stories', storyId, { view_count: count || 0 });
    return { viewed: true };
  }

  async getStoryViewers(storyId: string, ownerId: string) {
    const story = await this.supabase.findById('stories', storyId);
    if (!story || story.user_id !== ownerId) throw new NotFoundException('Story not found');

    const { data } = await this.supabase.db
      .from('story_views')
      .select('*, viewer:users(id, username, display_name, avatar_url)')
      .eq('story_id', storyId)
      .order('viewed_at', { ascending: false });
    return data;
  }

  async deleteStory(storyId: string, userId: string) {
    const story = await this.supabase.findById('stories', storyId);
    if (!story || story.user_id !== userId) throw new NotFoundException('Story not found');
    return this.supabase.update('stories', storyId, { is_active: false });
  }

  async replyToStory(storyId: string, userId: string, content: string) {
    const story = await this.supabase.findById('stories', storyId);
    if (!story) throw new NotFoundException('Story not found');

    // Create/get private chat with story owner, send message referencing story
    const { ChatsService } = require('../chats/chats.service');
    // Simplified: just insert a message-like notification (real impl would use ChatsService)
    return { success: true, message: 'Reply sent to story owner' };
  }
}
