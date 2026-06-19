import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
export class AppGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  // Map userId -> socketId
  private connectedUsers = new Map<string, string>();

  constructor(
    private jwt: JwtService,
    private config: ConfigService,
    private supabase: SupabaseService,
  ) {}

  // --- CONNECTION ---
  async handleConnection(socket: Socket) {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
      if (!token) { socket.disconnect(); return; }

      const payload = this.jwt.verify(token, { secret: this.config.get('JWT_SECRET') });
      const user = await this.supabase.findById('users', payload.sub);
      if (!user || user.is_banned) { socket.disconnect(); return; }

      socket.data.userId = user.id;
      socket.data.user = user;
      this.connectedUsers.set(user.id, socket.id);

      // Join personal room
      socket.join(`user:${user.id}`);

      // Update online status
      await this.supabase.update('users', user.id, {
        is_online: true,
        last_seen: new Date().toISOString(),
      });

      // Notify contacts that user is online
      this.server.emit(`user:online:${user.id}`, { userId: user.id, online: true });

      // Join all chats user belongs to
      const { data: memberships } = await this.supabase.db
        .from('chat_members')
        .select('chat_id')
        .eq('user_id', user.id);
      if (memberships) {
        for (const m of memberships) {
          socket.join(`chat:${m.chat_id}`);
        }
      }

      console.log(`✅ ${user.username} connected`);
    } catch (err) {
      socket.disconnect();
    }
  }

  // --- DISCONNECTION ---
  async handleDisconnect(socket: Socket) {
    const userId = socket.data?.userId;
    if (userId) {
      this.connectedUsers.delete(userId);
      await this.supabase.update('users', userId, {
        is_online: false,
        last_seen: new Date().toISOString(),
      });
      this.server.emit(`user:offline:${userId}`, { userId, online: false });
      console.log(`❌ ${socket.data.user?.username} disconnected`);
    }
  }

  // --- SEND MESSAGE ---
  @SubscribeMessage('message:send')
  async handleSendMessage(@ConnectedSocket() socket: Socket, @MessageBody() data: {
    chat_id: string;
    content: string;
    type?: string;
    reply_to_id?: string;
    media_url?: string;
  }) {
    const userId = socket.data.userId;
    if (!userId) return;

    // Verify user is member of chat
    const member = await this.supabase.db
      .from('chat_members')
      .select('*')
      .eq('chat_id', data.chat_id)
      .eq('user_id', userId)
      .single();
    if (!member.data) return;

    // Save message to database
    const message = await this.supabase.insert('messages', {
      chat_id: data.chat_id,
      sender_id: userId,
      type: data.type || 'text',
      content: data.content,
      reply_to_id: data.reply_to_id || null,
      media_url: data.media_url || null,
    });

    // Get sender info
    const sender = await this.supabase.findById('users', userId);

    const fullMessage = {
      ...message,
      sender: {
        id: sender.id,
        username: sender.username,
        display_name: sender.display_name,
        avatar_url: sender.avatar_url,
      },
    };

    // Broadcast to all chat members
    this.server.to(`chat:${data.chat_id}`).emit('message:new', fullMessage);

    // Update last activity
    await this.supabase.update('chats', data.chat_id, {
      updated_at: new Date().toISOString(),
    });

    return fullMessage;
  }

  // --- TYPING INDICATOR ---
  @SubscribeMessage('typing:start')
  handleTypingStart(@ConnectedSocket() socket: Socket, @MessageBody() data: { chat_id: string }) {
    socket.to(`chat:${data.chat_id}`).emit('typing:update', {
      userId: socket.data.userId,
      username: socket.data.user?.username,
      chat_id: data.chat_id,
      typing: true,
    });
  }

  @SubscribeMessage('typing:stop')
  handleTypingStop(@ConnectedSocket() socket: Socket, @MessageBody() data: { chat_id: string }) {
    socket.to(`chat:${data.chat_id}`).emit('typing:update', {
      userId: socket.data.userId,
      chat_id: data.chat_id,
      typing: false,
    });
  }

  // --- MESSAGE READ ---
  @SubscribeMessage('message:read')
  async handleMessageRead(@ConnectedSocket() socket: Socket, @MessageBody() data: { message_id: string; chat_id: string }) {
    const userId = socket.data.userId;
    await this.supabase.db.from('message_receipts').upsert({
      message_id: data.message_id,
      user_id: userId,
      read_at: new Date().toISOString(),
    });
    socket.to(`chat:${data.chat_id}`).emit('message:read:update', {
      message_id: data.message_id,
      reader_id: userId,
      read_at: new Date().toISOString(),
    });
  }

  // --- MESSAGE REACTION ---
  @SubscribeMessage('message:react')
  async handleReaction(@ConnectedSocket() socket: Socket, @MessageBody() data: { message_id: string; chat_id: string; emoji: string }) {
    const userId = socket.data.userId;
    await this.supabase.db.from('message_reactions').upsert({
      message_id: data.message_id,
      user_id: userId,
      emoji: data.emoji,
    });
    this.server.to(`chat:${data.chat_id}`).emit('message:reaction:update', {
      message_id: data.message_id,
      user_id: userId,
      emoji: data.emoji,
    });
  }

  // --- JOIN CHAT ROOM ---
  @SubscribeMessage('chat:join')
  handleJoinChat(@ConnectedSocket() socket: Socket, @MessageBody() data: { chat_id: string }) {
    socket.join(`chat:${data.chat_id}`);
  }

  // --- CALL SIGNALING ---
  @SubscribeMessage('call:initiate')
  handleCallInitiate(@ConnectedSocket() socket: Socket, @MessageBody() data: { receiver_id: string; type: 'voice' | 'video'; offer: any }) {
    const callerRoom = `user:${data.receiver_id}`;
    this.server.to(callerRoom).emit('call:incoming', {
      caller_id: socket.data.userId,
      caller_name: socket.data.user?.display_name,
      caller_avatar: socket.data.user?.avatar_url,
      type: data.type,
      offer: data.offer,
    });
  }

  @SubscribeMessage('call:answer')
  handleCallAnswer(@ConnectedSocket() socket: Socket, @MessageBody() data: { caller_id: string; answer: any }) {
    this.server.to(`user:${data.caller_id}`).emit('call:answered', { answer: data.answer });
  }

  @SubscribeMessage('call:ice-candidate')
  handleIceCandidate(@ConnectedSocket() socket: Socket, @MessageBody() data: { target_id: string; candidate: any }) {
    this.server.to(`user:${data.target_id}`).emit('call:ice-candidate', { candidate: data.candidate });
  }

  @SubscribeMessage('call:end')
  handleCallEnd(@ConnectedSocket() socket: Socket, @MessageBody() data: { target_id: string }) {
    this.server.to(`user:${data.target_id}`).emit('call:ended', { by: socket.data.userId });
  }

  // --- ADMIN BROADCAST ---
  broadcastToAll(event: string, data: any) {
    this.server.emit(event, data);
  }

  // --- SEND TO SPECIFIC USER ---
  sendToUser(userId: string, event: string, data: any) {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  // --- CHECK IF USER ONLINE ---
  isUserOnline(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }

  // --- GET ONLINE COUNT ---
  getOnlineCount(): number {
    return this.connectedUsers.size;
  }
}
