import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class GroupsService {
  constructor(private supabase: SupabaseService) {}

  async createGroup(userId: string, data: { name: string; description?: string; is_public?: boolean; member_ids?: string[] }) {
    const inviteCode = uuidv4().slice(0, 8);
    const group = await this.supabase.insert('chats', {
      type: 'group',
      name: data.name,
      description: data.description || '',
      created_by: userId,
      max_members: 10,
      invite_link: inviteCode,
    });

    const members = [{ chat_id: group.id, user_id: userId, role: 'owner' }];
    if (data.member_ids) {
      for (const id of data.member_ids.slice(0, 9)) {
        members.push({ chat_id: group.id, user_id: id, role: 'member' });
      }
    }
    await this.supabase.db.from('chat_members').insert(members);

    return group;
  }

  async getGroupDetails(groupId: string, userId: string) {
    await this.verifyMember(groupId, userId);
    const group = await this.supabase.findById('chats', groupId);
    const { data: members } = await this.supabase.db
      .from('chat_members')
      .select('*, user:users(id, username, display_name, avatar_url, is_online, badge_type)')
      .eq('chat_id', groupId);
    return { ...group, members, member_count: members?.length || 0 };
  }

  async addMember(groupId: string, adminId: string, newUserId: string) {
    await this.verifyAdmin(groupId, adminId);
    const group = await this.supabase.findById('chats', groupId);

    const { count } = await this.supabase.db
      .from('chat_members')
      .select('*', { count: 'exact', head: true })
      .eq('chat_id', groupId);

    if (count >= group.max_members) {
      throw new BadRequestException(`Group at capacity (${group.max_members}). Upgrade with points to add more.`);
    }

    await this.supabase.insert('chat_members', { chat_id: groupId, user_id: newUserId, role: 'member' });
    return { success: true };
  }

  async removeMember(groupId: string, adminId: string, targetUserId: string) {
    await this.verifyAdmin(groupId, adminId);
    await this.supabase.db.from('chat_members').delete().eq('chat_id', groupId).eq('user_id', targetUserId);
    return { success: true };
  }

  async promoteAdmin(groupId: string, ownerId: string, targetUserId: string) {
    await this.verifyOwner(groupId, ownerId);
    await this.supabase.db.from('chat_members').update({ role: 'admin' }).eq('chat_id', groupId).eq('user_id', targetUserId);
    return { success: true };
  }

  async demoteAdmin(groupId: string, ownerId: string, targetUserId: string) {
    await this.verifyOwner(groupId, ownerId);
    await this.supabase.db.from('chat_members').update({ role: 'member' }).eq('chat_id', groupId).eq('user_id', targetUserId);
    return { success: true };
  }

  async leaveGroup(groupId: string, userId: string) {
    await this.supabase.db.from('chat_members').delete().eq('chat_id', groupId).eq('user_id', userId);
    return { success: true };
  }

  async updateGroupSettings(groupId: string, adminId: string, settings: {
    name?: string;
    description?: string;
    avatar_url?: string;
    slow_mode_seconds?: number;
    announcement_mode?: boolean;
  }) {
    await this.verifyAdmin(groupId, adminId);
    return this.supabase.update('chats', groupId, settings);
  }

  // Upgrade group capacity using points
  async upgradeCapacity(groupId: string, userId: string, pointsToSpend: number) {
    await this.verifyAdmin(groupId, userId);
    const user = await this.supabase.findById('users', userId);
    if ((user.points || 0) < pointsToSpend) throw new BadRequestException('Not enough points');
    if (pointsToSpend % 10 !== 0) throw new BadRequestException('Points must be in multiples of 10');

    const group = await this.supabase.findById('chats', groupId);
    const additionalSlots = pointsToSpend; // 10 points = +10 slots
    await this.supabase.update('chats', groupId, { max_members: group.max_members + additionalSlots });
    await this.supabase.update('users', userId, { points: user.points - pointsToSpend });

    return { new_capacity: group.max_members + additionalSlots, points_remaining: user.points - pointsToSpend };
  }

  async joinViaInviteLink(inviteCode: string, userId: string) {
    const group = await this.supabase.findOne('chats', 'invite_link', inviteCode);
    if (!group) throw new NotFoundException('Invalid invite link');

    const { count } = await this.supabase.db
      .from('chat_members')
      .select('*', { count: 'exact', head: true })
      .eq('chat_id', group.id);

    if (count >= group.max_members) throw new BadRequestException('Group is full');

    const { data: existing } = await this.supabase.db
      .from('chat_members')
      .select('id')
      .eq('chat_id', group.id)
      .eq('user_id', userId)
      .single();
    if (existing) return { already_member: true, group };

    await this.supabase.insert('chat_members', { chat_id: group.id, user_id: userId, role: 'member' });
    return { joined: true, group };
  }

  private async verifyMember(groupId: string, userId: string) {
    const { data } = await this.supabase.db.from('chat_members').select('id').eq('chat_id', groupId).eq('user_id', userId).single();
    if (!data) throw new ForbiddenException('Not a member');
  }

  private async verifyAdmin(groupId: string, userId: string) {
    const { data } = await this.supabase.db.from('chat_members').select('role').eq('chat_id', groupId).eq('user_id', userId).single();
    if (!data || !['admin', 'owner'].includes(data.role)) throw new ForbiddenException('Admin access required');
  }

  private async verifyOwner(groupId: string, userId: string) {
    const { data } = await this.supabase.db.from('chat_members').select('role').eq('chat_id', groupId).eq('user_id', userId).single();
    if (!data || data.role !== 'owner') throw new ForbiddenException('Owner access required');
  }
}
