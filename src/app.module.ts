import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { MessagesModule } from './messages/messages.module';
import { ChatsModule } from './chats/chats.module';
import { GroupsModule } from './groups/groups.module';
import { ChannelsModule } from './channels/channels.module';
import { StoriesModule } from './stories/stories.module';
import { CallsModule } from './calls/calls.module';
import { AdminModule } from './admin/admin.module';
import { AIModule } from './ai/ai.module';
import { GatewayModule } from './gateway/gateway.module';
import { SupabaseModule } from './supabase/supabase.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    SupabaseModule,
    GatewayModule,
    AuthModule,
    UsersModule,
    MessagesModule,
    ChatsModule,
    GroupsModule,
    ChannelsModule,
    StoriesModule,
    CallsModule,
    AdminModule,
    AIModule,
    NotificationsModule,
  ],
})
export class AppModule {}
