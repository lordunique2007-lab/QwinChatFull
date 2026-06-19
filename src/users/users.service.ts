import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class UsersService {
  constructor(private supabase: SupabaseService) {}

  async getProfile(userId: string) {
    const user = await this.supabase.findById('users', userId);
    if (!user) throw new NotFoundException('User not found');
    const { two_factor_secret, push_token, ...safe } = user;
    return safe;
  }

  async updateProfile(userId: string, data: { display_name?: string; bio?: string; avatar_url?: string }) {
    return this.supabase.update('users', userId, data);
  }

  async changeUsername(userId: string, newUsername: string) {
    const existing = await this.supabase.findOne('users', 'username', newUsername.toLowerCase());
    if (existing) throw new BadRequestException('Username already taken');
    return this.supabase.update('users', userId, { username: newUsername.toLowerCase() });
  }

  async updatePrivacy(userId: string, settings: any) {
    return this.supabase.update('users', userId, settings);
  }

  async updateTheme(userId: string, theme: string) {
    return this.supabase.update('users', userId, { theme });
  }

  async blockUser(userId: string, targetId: string) {
    await this.supabase.db.from('contacts').upsert({ user_id: userId, contact_id: targetId, is_blocked: true });
    return { blocked: true };
  }

  async unblockUser(userId: string, targetId: string) {
    await this.supabase.db.from('contacts').update({ is_blocked: false }).eq('user_id', userId).eq('contact_id', targetId);
    return { blocked: false };
  }

  async getBlockedUsers(userId: string) {
    const { data } = await this.supabase.db
      .from('contacts')
      .select('*, blocked_user:users!contact_id(id, username, display_name, avatar_url)')
      .eq('user_id', userId)
      .eq('is_blocked', true);
    return data;
  }

  async reportUser(reporterId: string, reportedUserId: string, reason: string, messageIds: string[] = []) {
    let messagesSnapshot = [];
    if (messageIds.length > 0) {
      const { data } = await this.supabase.db
        .from('messages')
        .select('*')
        .in('id', messageIds)
        .limit(5);
      messagesSnapshot = data || [];
    }
    return this.supabase.insert('reports', {
      reporter_id: reporterId,
      reported_user_id: reportedUserId,
      reason,
      messages_snapshot: messagesSnapshot,
    });
  }

  async getSessions(userId: string) {
    const { data } = await this.supabase.db
      .from('sessions')
      .select('*')
      .eq('user_id', userId)
      .order('last_active', { ascending: false });
    return data;
  }

  async revokeSession(userId: string, sessionId: string) {
    await this.supabase.db.from('sessions').update({ is_active: false }).eq('id', sessionId).eq('user_id', userId);
    return { revoked: true };
  }

  async claimDailyReward(userId: string) {
    const today = new Date().toISOString().split('T')[0];
    const { data: existing } = await this.supabase.db
      .from('daily_rewards')
      .select('id')
      .eq('user_id', userId)
      .gte('claimed_at', `${today}T00:00:00`)
      .single();

    if (existing) throw new BadRequestException('Daily reward already claimed today');

    await this.supabase.insert('daily_rewards', { user_id: userId, points: 2 });
    const user = await this.supabase.findById('users', userId);
    await this.supabase.update('users', userId, { points: (user.points || 0) + 2 });
    return { points_awarded: 2, total_points: (user.points || 0) + 2 };
  }

  async useReferralCode(newUserId: string, referralCode: string) {
    const referrer = await this.supabase.findOne('users', 'referral_code', referralCode.toUpperCase());
    if (!referrer) throw new BadRequestException('Invalid referral code');

    await this.supabase.insert('referrals', { referrer_id: referrer.id, referred_id: newUserId, points_awarded: 1 });
    await this.supabase.update('users', referrer.id, { points: (referrer.points || 0) + 1 });
    await this.supabase.update('users', newUserId, { referred_by: referrer.id });

    return { success: true, referrer: referrer.username };
  }

  async searchUsers(query: string) {
    const { data } = await this.supabase.db
      .from('users')
      .select('id, username, display_name, avatar_url, is_verified, badge_type, is_online')
      .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
      .eq('status', 'active')
      .limit(20);
    return data;
  }
}
