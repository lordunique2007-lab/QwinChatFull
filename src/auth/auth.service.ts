import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';
import * as nodemailer from 'nodemailer';
import * as twilio from 'twilio';

@Injectable()
export class AuthService {
  private supabase: SupabaseClient;
  private twilioClient: any;
  private mailTransporter: any;

  private readonly OTP_EXPIRY_MINUTES = 10;
  private readonly MAX_ATTEMPTS = 5;
  private readonly TEST_MODE = process.env.OTP_TEST_MODE === 'true';
  private readonly TEST_CODE = process.env.OTP_TEST_CODE || '123456';

  constructor(private jwtService: JwtService) {
    this.supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    );

    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      this.twilioClient = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN,
      );
    }

    this.mailTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  private isEmail(contact: string): boolean {
    return /\S+@\S+\.\S+/.test(contact);
  }

  private generateCode(): string {
    return crypto.randomInt(100000, 999999).toString();
  }

  async sendOtp(contact: string) {
    if (!contact) {
      throw new HttpException('contact is required', HttpStatus.BAD_REQUEST);
    }

    const contactType = this.isEmail(contact) ? 'email' : 'phone';
    const code = this.generateCode();
    const expiresAt = new Date(
      Date.now() + this.OTP_EXPIRY_MINUTES * 60 * 1000,
    ).toISOString();

    const { error: insertError } = await this.supabase
      .from('otps')
      .insert({ contact, contact_type: contactType, code, expires_at: expiresAt });

    if (insertError) {
      console.error('otp insert error:', insertError);
      throw new HttpException('Failed to create OTP', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    if (this.TEST_MODE) {
      console.log(
        `[TEST MODE] OTP for ${contact} is ${code} (also "${this.TEST_CODE}" always works)`,
      );
    } else if (contactType === 'phone') {
      if (!this.twilioClient) {
        throw new HttpException(
          'SMS provider not configured',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
      await this.twilioClient.messages.create({
        body: `Your QwinCHAT verification code is ${code}. It expires in ${this.OTP_EXPIRY_MINUTES} minutes.`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: contact,
      });
    } else {
      await this.mailTransporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: contact,
        subject: 'Your QwinCHAT verification code',
        text: `Your verification code is ${code}. It expires in ${this.OTP_EXPIRY_MINUTES} minutes.`,
      });
    }

    return { success: true, message: `OTP sent via ${contactType}` };
  }

  async verifyOtp(body: {
    contact: string;
    code: string;
    username?: string;
    deviceName?: string;
    deviceType?: string;
  }) {
    const { contact, code, username, deviceName, deviceType } = body;
    if (!contact || !code) {
      throw new HttpException(
        'contact and code are required',
        HttpStatus.BAD_REQUEST,
      );
    }

    const { data: otpRows, error: otpError } = await this.supabase
      .from('otps')
      .select('*')
      .eq('contact', contact)
      .eq('used', false)
      .order('created_at', { ascending: false })
      .limit(1);

    if (otpError) {
      console.error('otp fetch error:', otpError);
      throw new HttpException('Failed to verify OTP', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    const otpRow = otpRows?.[0];
    if (!otpRow) {
      throw new HttpException(
        'No active OTP found, request a new one',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (new Date(otpRow.expires_at) < new Date()) {
      throw new HttpException('OTP expired, request a new one', HttpStatus.BAD_REQUEST);
    }
    if (otpRow.attempts >= this.MAX_ATTEMPTS) {
      throw new HttpException(
        'Too many attempts, request a new code',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const isTestBypass = this.TEST_MODE && code === this.TEST_CODE;
    if (otpRow.code !== code && !isTestBypass) {
      await this.supabase
        .from('otps')
        .update({ attempts: otpRow.attempts + 1 })
        .eq('id', otpRow.id);
      throw new HttpException('Incorrect code', HttpStatus.BAD_REQUEST);
    }

    await this.supabase.from('otps').update({ used: true }).eq('id', otpRow.id);

    const userColumn = otpRow.contact_type === 'email' ? 'email' : 'phone';
    const user = await this.findOrCreateUser(userColumn, contact, username);
    const token = await this.createSession(user.id, deviceName, deviceType);

    return { success: true, token, user };
  }

  // TESTING ONLY — no code required at all. Remove/disable before real users arrive.
  async quickLogin(body: {
    contact: string;
    username?: string;
    deviceName?: string;
    deviceType?: string;
  }) {
    console.log('[quick-login] called with body:', JSON.stringify(body));

    const { contact, username, deviceName, deviceType } = body;
    if (!contact) {
      throw new HttpException('contact is required', HttpStatus.BAD_REQUEST);
    }

    const userColumn = this.isEmail(contact) ? 'email' : 'phone';
    const user = await this.findOrCreateUser(userColumn, contact, username);
    console.log('[quick-login] user found/created:', JSON.stringify(user));

    const token = await this.createSession(user.id, deviceName, deviceType);
    console.log('[quick-login] session created, token generated');

    const result = { success: true, token, user };
    console.log('[quick-login] returning:', JSON.stringify(result));
    return result;
  }

  private async findOrCreateUser(
    userColumn: string,
    contact: string,
    username?: string,
  ) {
    const { data: existingUsers, error: findError } = await this.supabase
      .from('users')
      .select('*')
      .eq(userColumn, contact)
      .limit(1);

    if (findError) {
      console.error('user lookup error:', findError);
      throw new HttpException('Failed to look up user', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    if (existingUsers && existingUsers.length > 0) {
      return existingUsers[0];
    }

    const finalUsername = username || `user_${crypto.randomBytes(4).toString('hex')}`;
    const { data: newUser, error: insertError } = await this.supabase
      .from('users')
      .insert({ [userColumn]: contact, username: finalUsername })
      .select()
      .single();

    if (insertError) {
      console.error('user insert error:', insertError);
      throw new HttpException('Failed to create user', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    return newUser;
  }

  private async createSession(
    userId: string,
    deviceName?: string,
    deviceType?: string,
  ) {
    const { data: session, error: sessionError } = await this.supabase
      .from('sessions')
      .insert({
        user_id: userId,
        device_name: deviceName || 'unknown',
        device_type: deviceType || 'unknown',
      })
      .select()
      .single();

    if (sessionError) {
      console.error('session insert error:', sessionError);
      throw new HttpException(
        'Failed to create session',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return this.jwtService.sign({ userId, sessionId: session.id });
  }
}
