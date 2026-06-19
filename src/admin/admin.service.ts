import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AppGateway } from '../gateway/app.gateway';

@Injectable()
export class AdminService {
  constructor(
    private supabase: SupabaseService,
    private gateway: AppGateway,
  ) {}

  private async logAction(adminId: string, action: string, targetType: string, targetId: string, details: any, ip = '') {
    await this.supabase.logAdminAction(adminId, action, targetType, targetId, details, ip);
  }

  // ====== POWER 1 - Permanent Ban ======
  async permanentBanUser(adminId: string, userId: string, reason: string, ip: string) {
    await this.supabase.update('users', userId, { is_banned: true, ban_reason: reason, ban_expires_at: null, status: 'banned' });
    this.gateway.sendToUser(userId, 'account:banned', { reason, permanent: true });
    await this.logAction(adminId, 'PERMANENT_BAN', 'user', userId, { reason }, ip);
    return { success: true, message: 'User permanently banned' };
  }

  // ====== POWER 2 - Temporary Ban ======
  async temporaryBanUser(adminId: string, userId: string, reason: string, hours: number, ip: string) {
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
    await this.supabase.update('users', userId, { is_banned: true, ban_reason: reason, ban_expires_at: expiresAt, status: 'banned' });
    this.gateway.sendToUser(userId, 'account:banned', { reason, expires_at: expiresAt });
    await this.logAction(adminId, 'TEMP_BAN', 'user', userId, { reason, hours }, ip);
    return { success: true, expires_at: expiresAt };
  }

  // ====== POWER 3 - Unban ======
  async unbanUser(adminId: string, userId: string, ip: string) {
    await this.supabase.update('users', userId, { is_banned: false, ban_reason: null, ban_expires_at: null, status: 'active' });
    this.gateway.sendToUser(userId, 'account:unbanned', {});
    await this.logAction(adminId, 'UNBAN', 'user', userId, {}, ip);
    return { success: true };
  }

  // ====== POWER 4 - Mute ======
  async muteUser(adminId: string, userId: string, hours: number, ip: string) {
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
    await this.supabase.update('users', userId, { is_muted: true });
    await this.logAction(adminId, 'MUTE_USER', 'user', userId, { hours }, ip);
    return { success: true };
  }

  // ====== POWER 5 - Unmute ======
  async unmuteUser(adminId: string, userId: string, ip: string) {
    await this.supabase.update('users', userId, { is_muted: false });
    await this.logAction(adminId, 'UNMUTE_USER', 'user', userId, {}, ip);
    return { success: true };
  }

  // ====== POWER 6 - Delete Account ======
  async deleteAccount(adminId: string, userId: string, ip: string) {
    await this.supabase.update('users', userId, { status: 'deleted', is_banned: true, username: `deleted_${userId.slice(0, 8)}`, display_name: 'Deleted User' });
    this.gateway.sendToUser(userId, 'account:deleted', {});
    await this.logAction(adminId, 'DELETE_ACCOUNT', 'user', userId, {}, ip);
    return { success: true };
  }

  // ====== POWER 7 - Restore Account ======
  async restoreAccount(adminId: string, userId: string, ip: string) {
    await this.supabase.update('users', userId, { status: 'active', is_banned: false });
    await this.logAction(adminId, 'RESTORE_ACCOUNT', 'user', userId, {}, ip);
    return { success: true };
  }

  // ====== POWER 8 - Broadcast to All Users ======
  async broadcastToAllUsers(adminId: string, message: string, ip: string) {
    this.gateway.broadcastToAll('admin:broadcast', { message, from: 'QwinCHAT Admin', timestamp: new Date().toISOString() });
    await this.logAction(adminId, 'BROADCAST_ALL', 'platform', adminId, { message }, ip);
    return { success: true };
  }

  // ====== POWER 13 - Global Announcement ======
  async createGlobalAnnouncement(adminId: string, title: string, message: string, ip: string) {
    this.gateway.broadcastToAll('admin:announcement', { title, message, timestamp: new Date().toISOString() });
    await this.logAction(adminId, 'GLOBAL_ANNOUNCEMENT', 'platform', adminId, { title, message }, ip);
    return { success: true };
  }

  // ====== POWER 14 - Delete Any Message ======
  async deleteAnyMessage(adminId: string, messageId: string, ip: string) {
    const msg = await this.supabase.findById('messages', messageId);
    if (!msg) throw new NotFoundException('Message not found');
    await this.supabase.update('messages', messageId, { is_deleted_for_all: true, content: '[Removed by Admin]' });
    this.gateway.broadcastToAll(`chat:${msg.chat_id}:message:deleted`, { message_id: messageId });
    await this.logAction(adminId, 'DELETE_MESSAGE', 'message', messageId, {}, ip);
    return { success: true };
  }

  // ====== POWER 15 - Delete Any Group ======
  async deleteAnyGroup(adminId: string, chatId: string, ip: string) {
    await this.supabase.update('chats', chatId, { is_active: false });
    this.gateway.broadcastToAll(`chat:${chatId}:deleted`, { chat_id: chatId });
    await this.logAction(adminId, 'DELETE_GROUP', 'chat', chatId, {}, ip);
    return { success: true };
  }

  // ====== POWER 18 - Freeze Account ======
  async freezeAccount(adminId: string, userId: string, ip: string) {
    await this.supabase.update('users', userId, { is_frozen: true });
    this.gateway.sendToUser(userId, 'account:frozen', {});
    await this.logAction(adminId, 'FREEZE_ACCOUNT', 'user', userId, {}, ip);
    return { success: true };
  }

  // ====== POWER 19 - Unfreeze Account ======
  async unfreezeAccount(adminId: string, userId: string, ip: string) {
    await this.supabase.update('users', userId, { is_frozen: false });
    await this.logAction(adminId, 'UNFREEZE_ACCOUNT', 'user', userId, {}, ip);
    return { success: true };
  }

  // ====== POWER 20 - Force Logout ======
  async forceLogout(adminId: string, userId: string, ip: string) {
    this.gateway.sendToUser(userId, 'account:force_logout', { reason: 'Forced logout by admin' });
    await this.logAction(adminId, 'FORCE_LOGOUT', 'user', userId, {}, ip);
    return { success: true };
  }

  // ====== POWER 23 - Assign Admin ======
  async assignAdmin(adminId: string, userId: string, ip: string) {
    await this.supabase.update('users', userId, { role: 'admin' });
    this.gateway.sendToUser(userId, 'role:updated', { role: 'admin' });
    await this.logAction(adminId, 'ASSIGN_ADMIN', 'user', userId, {}, ip);
    return { success: true };
  }

  // ====== POWER 24 - Remove Admin ======
  async removeAdmin(adminId: string, userId: string, ip: string) {
    await this.supabase.update('users', userId, { role: 'user' });
    await this.logAction(adminId, 'REMOVE_ADMIN', 'user', userId, {}, ip);
    return { success: true };
  }

  // ====== POWER 38 - Shadow Ban ======
  async shadowBanUser(adminId: string, userId: string, ip: string) {
    await this.supabase.update('users', userId, { is_shadow_banned: true });
    await this.logAction(adminId, 'SHADOW_BAN', 'user', userId, {}, ip);
    return { success: true };
  }

  // ====== POWER 41 - Verification Management ======
  async approveVerification(adminId: string, requestId: string, badgeType: string, ip: string) {
    const req = await this.supabase.findById('verification_requests', requestId);
    if (!req) throw new NotFoundException('Request not found');
    await this.supabase.update('verification_requests', requestId, { status: 'approved', reviewed_by: adminId, reviewed_at: new Date().toISOString() });
    await this.supabase.update('users', req.user_id, { is_verified: true, badge_type: badgeType });
    this.gateway.sendToUser(req.user_id, 'verification:approved', { badge_type: badgeType });
    await this.logAction(adminId, 'APPROVE_VERIFICATION', 'user', req.user_id, { badge_type: badgeType }, ip);
    return { success: true };
  }

  async rejectVerification(adminId: string, requestId: string, notes: string, ip: string) {
    const req = await this.supabase.findById('verification_requests', requestId);
    if (!req) throw new NotFoundException('Request not found');
    await this.supabase.update('verification_requests', requestId, { status: 'rejected', reviewed_by: adminId, reviewed_at: new Date().toISOString(), notes });
    this.gateway.sendToUser(req.user_id, 'verification:rejected', { notes });
    await this.logAction(adminId, 'REJECT_VERIFICATION', 'user', req.user_id, { notes }, ip);
    return { success: true };
  }

  // ====== POWER 11 - Platform Statistics ======
  async getPlatformStats(adminId: string) {
    const [totalUsers, activeUsers, totalMessages, totalGroups, totalChannels, pendingReports] = await Promise.all([
      this.supabase.count('users', { status: 'active' }),
      this.supabase.count('users', { is_online: true }),
      this.supabase.count('messages'),
      this.supabase.count('chats', { type: 'group' }),
      this.supabase.count('channels'),
      this.supabase.count('reports', { status: 'pending' }),
    ]);
    const onlineCount = this.gateway.getOnlineCount();
    return { totalUsers, activeUsers, onlineCount, totalMessages, totalGroups, totalChannels, pendingReports };
  }

  // ====== POWER 30 - Manage Reports ======
  async getReports(adminId: string, status = 'pending') {
    const { data } = await this.supabase.db
      .from('reports')
      .select('*, reporter:users!reporter_id(username, display_name), reported_user:users!reported_user_id(username, display_name)')
      .eq('status', status)
      .order('created_at', { ascending: false })
      .limit(50);
    return data;
  }

  async resolveReport(adminId: string, reportId: string, action: string, ip: string) {
    await this.supabase.update('reports', reportId, { status: 'resolved', reviewed_by: adminId, reviewed_at: new Date().toISOString() });
    await this.logAction(adminId, 'RESOLVE_REPORT', 'report', reportId, { action }, ip);
    return { success: true };
  }

  // ====== POWER 31 - Audit Logs ======
  async getAuditLogs(adminId: string, limit = 50) {
    const { data } = await this.supabase.db
      .from('audit_logs')
      .select('*, admin:users!admin_id(username, display_name)')
      .order('created_at', { ascending: false })
      .limit(limit);
    return data;
  }

  // ====== POWER 43-47 - Search ======
  async searchUsers(adminId: string, query: string) {
    const { data } = await this.supabase.db
      .from('users')
      .select('id, username, display_name, avatar_url, status, role, is_banned, is_verified, badge_type, created_at')
      .or(`username.ilike.%${query}%,display_name.ilike.%${query}%,phone.ilike.%${query}%`)
      .limit(20);
    return data;
  }

  // ====== POWER 29 - Manage Premium ======
  async grantPremium(adminId: string, userId: string, days: number, ip: string) {
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    await this.supabase.insert('premium_subscriptions', {
      user_id: userId,
      plan: 'admin_grant',
      status: 'active',
      expires_at: expiresAt,
    });
    await this.supabase.update('users', userId, { role: 'premium' });
    this.gateway.sendToUser(userId, 'premium:granted', { expires_at: expiresAt });
    await this.logAction(adminId, 'GRANT_PREMIUM', 'user', userId, { days }, ip);
    return { success: true };
  }

  // ====== POWER 27 - Manage Referrals ======
  async manualAwardPoints(adminId: string, userId: string, points: number, ip: string) {
    const user = await this.supabase.findById('users', userId);
    if (!user) throw new NotFoundException('User not found');
    await this.supabase.update('users', userId, { points: (user.points || 0) + points });
    this.gateway.sendToUser(userId, 'points:awarded', { points, total: (user.points || 0) + points });
    await this.logAction(adminId, 'AWARD_POINTS', 'user', userId, { points }, ip);
    return { success: true };
  }

  // ====== POWER 42 - Badge Management ======
  async assignBadge(adminId: string, userId: string, badgeType: string, ip: string) {
    await this.supabase.update('users', userId, { badge_type: badgeType, is_verified: true });
    this.gateway.sendToUser(userId, 'badge:assigned', { badge_type: badgeType });
    await this.logAction(adminId, 'ASSIGN_BADGE', 'user', userId, { badge_type: badgeType }, ip);
    return { success: true };
  }

  async removeBadge(adminId: string, userId: string, ip: string) {
    await this.supabase.update('users', userId, { badge_type: null, is_verified: false });
    await this.logAction(adminId, 'REMOVE_BADGE', 'user', userId, {}, ip);
    return { success: true };
  }

  // ====== POWER 40 - Emergency Maintenance ======
  async setMaintenanceMode(adminId: string, enabled: boolean, message: string, ip: string) {
    if (enabled) {
      this.gateway.broadcastToAll('system:maintenance', { message: message || 'QwinCHAT is under maintenance. Back soon! 🔧', enabled: true });
    } else {
      this.gateway.broadcastToAll('system:maintenance', { enabled: false });
    }
    await this.logAction(adminId, enabled ? 'MAINTENANCE_ON' : 'MAINTENANCE_OFF', 'platform', adminId, { message }, ip);
    return { success: true, maintenance: enabled };
  }
}
