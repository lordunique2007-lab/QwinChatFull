import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class NotificationsService {
  private firebaseInitialized = false;

  constructor(
    private config: ConfigService,
    private supabase: SupabaseService,
  ) {
    this.initFirebase();
  }

  private initFirebase() {
    try {
      const admin = require('firebase-admin');
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: this.config.get('FIREBASE_PROJECT_ID'),
            privateKey: this.config.get('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n'),
            clientEmail: this.config.get('FIREBASE_CLIENT_EMAIL'),
          }),
        });
      }
      this.firebaseInitialized = true;
    } catch (err) {
      console.log('Firebase not configured - push notifications disabled');
    }
  }

  async registerPushToken(userId: string, token: string) {
    await this.supabase.update('users', userId, { push_token: token });
    return { registered: true };
  }

  async sendPushNotification(userId: string, title: string, body: string, data: any = {}) {
    if (!this.firebaseInitialized) return { sent: false, reason: 'Firebase not configured' };

    const user = await this.supabase.findById('users', userId);
    if (!user?.push_token || !user.notifications_enabled) return { sent: false };

    try {
      const admin = require('firebase-admin');
      await admin.messaging().send({
        token: user.push_token,
        notification: { title, body },
        data,
      });
      return { sent: true };
    } catch (err) {
      console.error('Push notification failed:', err.message);
      return { sent: false, error: err.message };
    }
  }

  async notifyNewMessage(receiverId: string, senderName: string, messagePreview: string, chatId: string) {
    return this.sendPushNotification(receiverId, senderName, messagePreview, { chat_id: chatId, type: 'message' });
  }

  async notifyIncomingCall(receiverId: string, callerName: string, callType: string) {
    return this.sendPushNotification(receiverId, `Incoming ${callType} call`, `${callerName} is calling...`, { type: 'call' });
  }
}
