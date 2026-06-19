import { Injectable, UnauthorizedException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class AuthService {
  constructor(
    private supabase: SupabaseService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  // --- SEND OTP ---
  async sendOtp(contact: string, type: 'phone' | 'email') {
    // Rate limit: max 3 OTPs per 10 minutes
    const recent = await this.supabase.db
      .from('otps')
      .select('id')
      .eq('contact', contact)
      .eq('used', false)
      .gte('created_at', new Date(Date.now() - 10 * 60 * 1000).toISOString());
    if (recent.data && recent.data.length >= 3) {
      throw new BadRequestException('Too many OTP requests. Wait 10 minutes.');
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    await this.supabase.insert('otps', {
      contact,
      contact_type: type,
      code,
      expires_at: expiresAt.toISOString(),
    });

    if (type === 'phone') {
      await this.sendSmsOtp(contact, code);
    } else {
      await this.sendEmailOtp(contact, code);
    }

    return { message: 'OTP sent successfully', expires_in: 600 };
  }

  // --- VERIFY OTP ---
  async verifyOtp(contact: string, code: string) {
    const { data: otp } = await this.supabase.db
      .from('otps')
      .select('*')
      .eq('contact', contact)
      .eq('code', code)
      .eq('used', false)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!otp) throw new UnauthorizedException('Invalid or expired OTP');

    // Mark as used
    await this.supabase.update('otps', otp.id, { used: true });

    return { verified: true, contact };
  }

  // --- REGISTER ---
  async register(dto: {
    contact: string;
    contact_type: 'phone' | 'email';
    username: string;
    display_name: string;
    bio?: string;
    otp_verified: boolean;
  }) {
    if (!dto.otp_verified) throw new ForbiddenException('OTP not verified');

    // Check username taken
    const existingUser = await this.supabase.findOne('users', 'username', dto.username);
    if (existingUser) throw new BadRequestException('Username already taken');

    // Check contact taken
    const field = dto.contact_type === 'phone' ? 'phone' : 'email';
    const existingContact = await this.supabase.findOne('users', field, dto.contact);
    if (existingContact) throw new BadRequestException('Account already exists for this contact');

    // Generate referral code
    const referralCode = dto.username.toUpperCase().slice(0, 4) + Math.random().toString(36).slice(2, 6).toUpperCase();

    const userData: any = {
      username: dto.username.toLowerCase(),
      display_name: dto.display_name,
      bio: dto.bio || '',
      referral_code: referralCode,
      role: 'user',
      points: 10, // Welcome bonus
    };
    if (dto.contact_type === 'phone') userData.phone = dto.contact;
    else userData.email = dto.contact;

    const user = await this.supabase.insert('users', userData);
    const tokens = await this.generateTokens(user);

    // Log session
    await this.supabase.insert('sessions', {
      user_id: user.id,
      device_name: 'Web Browser',
    });

    return { user: this.sanitizeUser(user), ...tokens };
  }

  // --- LOGIN ---
  async login(contact: string, contactType: 'phone' | 'email') {
    const field = contactType === 'phone' ? 'phone' : 'email';
    const user = await this.supabase.findOne('users', field, contact);
    if (!user) throw new UnauthorizedException('Account not found');

    if (user.is_banned) throw new ForbiddenException(`Account banned: ${user.ban_reason || 'Policy violation'}`);
    if (user.is_frozen) throw new ForbiddenException('Account frozen. Contact support.');

    const tokens = await this.generateTokens(user);

    // Update online status
    await this.supabase.update('users', user.id, { is_online: true, last_seen: new Date().toISOString() });

    return { user: this.sanitizeUser(user), ...tokens };
  }

  // --- LOGOUT ---
  async logout(userId: string) {
    await this.supabase.update('users', userId, {
      is_online: false,
      last_seen: new Date().toISOString(),
    });
    return { message: 'Logged out successfully' };
  }

  // --- REFRESH TOKEN ---
  async refreshToken(token: string) {
    try {
      const payload = this.jwt.verify(token, { secret: this.config.get('JWT_SECRET') });
      const user = await this.supabase.findById('users', payload.sub);
      if (!user) throw new UnauthorizedException();
      return this.generateTokens(user);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  // --- GENERATE TOKENS ---
  private async generateTokens(user: any) {
    const payload = { sub: user.id, username: user.username, role: user.role };
    const access_token = this.jwt.sign(payload, { expiresIn: '7d' });
    const refresh_token = this.jwt.sign(payload, { expiresIn: '30d' });
    return { access_token, refresh_token };
  }

  // --- SEND SMS VIA TWILIO ---
  private async sendSmsOtp(phone: string, code: string) {
    try {
      const twilio = require('twilio');
      const client = twilio(
        this.config.get('TWILIO_ACCOUNT_SID'),
        this.config.get('TWILIO_AUTH_TOKEN'),
      );
      await client.messages.create({
        body: `Your QwinCHAT verification code is: ${code}\nExpires in 10 minutes.\n\nDo not share this code.`,
        from: this.config.get('TWILIO_PHONE_NUMBER'),
        to: phone,
      });
    } catch (err) {
      console.error('SMS send failed:', err.message);
      // In dev mode, log the code
      if (this.config.get('NODE_ENV') !== 'production') {
        console.log(`DEV OTP for ${phone}: ${code}`);
      }
    }
  }

  // --- SEND EMAIL OTP ---
  private async sendEmailOtp(email: string, code: string) {
    try {
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: this.config.get('EMAIL_HOST'),
        port: this.config.get('EMAIL_PORT'),
        secure: false,
        auth: {
          user: this.config.get('EMAIL_USER'),
          pass: this.config.get('EMAIL_PASS'),
        },
      });
      await transporter.sendMail({
        from: `"QwinCHAT" <${this.config.get('EMAIL_USER')}>`,
        to: email,
        subject: 'Your QwinCHAT Verification Code',
        html: `
          <div style="font-family:sans-serif;max-width:400px;margin:0 auto;background:#0A0E1A;color:#fff;padding:32px;border-radius:16px;">
            <h2 style="background:linear-gradient(135deg,#00D4FF,#00FF88);-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-size:28px;">QwinCHAT</h2>
            <p style="color:#8B9CC8;">Your verification code:</p>
            <div style="background:#111827;border:1px solid rgba(0,212,255,0.3);border-radius:12px;padding:20px;text-align:center;margin:20px 0;">
              <span style="font-size:36px;font-weight:800;letter-spacing:8px;color:#00D4FF;">${code}</span>
            </div>
            <p style="color:#4a5568;font-size:13px;">Expires in 10 minutes. Never share this code.</p>
          </div>
        `,
      });
    } catch (err) {
      console.error('Email send failed:', err.message);
      if (this.config.get('NODE_ENV') !== 'production') {
        console.log(`DEV OTP for ${email}: ${code}`);
      }
    }
  }

  // --- SANITIZE USER (remove sensitive fields) ---
  sanitizeUser(user: any) {
    const { two_factor_secret, push_token, ...safe } = user;
    return safe;
  }
}
