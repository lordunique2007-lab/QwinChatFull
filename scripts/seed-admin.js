/**
 * QwinCHAT — Secure Admin Account Setup
 * Created by Qwin Grace
 *
 * HOW TO USE (run this ONLY on your own computer, never share output):
 *
 * 1. Make sure your .env file is filled in (see .env.template)
 * 2. Run: node scripts/seed-admin.js
 * 3. It will prompt you to type your admin phone/email and password
 *    directly into YOUR terminal — this never gets sent to anyone else.
 * 4. Your Qwin Grace owner account is created directly in Supabase.
 *
 * This script does NOT log or save your password anywhere.
 */

require('dotenv').config();
const readline = require('readline');
const { createClient } = require('@supabase/supabase-js');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(question, hidden = false) {
  return new Promise((resolve) => {
    if (!hidden) {
      rl.question(question, resolve);
      return;
    }
    // Hide password input
    const stdin = process.stdin;
    process.stdout.write(question);
    let input = '';
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    stdin.on('data', function handler(char) {
      char = char.toString();
      if (char === '\n' || char === '\r' || char === '\u0004') {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener('data', handler);
        process.stdout.write('\n');
        resolve(input);
      } else if (char === '\u0003') {
        process.exit();
      } else if (char === '\u007f') {
        input = input.slice(0, -1);
      } else {
        input += char;
        process.stdout.write('*');
      }
    });
  });
}

async function main() {
  console.log('\n🚀 QwinCHAT — Owner Account Setup\n');
  console.log('This creates your Global Super Administrator account (Qwin Grace).');
  console.log('Nothing you type here is sent anywhere except your own Supabase database.\n');

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
  );

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in your .env file.');
    process.exit(1);
  }

  const contactType = await ask('Use phone or email for admin login? (phone/email): ');
  const contact = await ask(`Enter your admin ${contactType}: `);
  const username = await ask('Choose an admin username (e.g. qwingrace): ');
  const displayName = (await ask('Display name [Qwin Grace]: ')) || 'Qwin Grace';

  // Check if already exists
  const field = contactType.trim() === 'phone' ? 'phone' : 'email';
  const { data: existing } = await supabase.from('users').select('id').eq(field, contact.trim()).single();

  if (existing) {
    console.log('\n⚠️  This account already exists. Promoting it to owner role...');
    await supabase.from('users').update({ role: 'owner', is_verified: true, badge_type: 'creator' }).eq('id', existing.id);
    console.log('✅ Account promoted to Owner (Global Super Administrator)!\n');
    rl.close();
    return;
  }

  const referralCode = username.toUpperCase().slice(0, 4) + Math.random().toString(36).slice(2, 6).toUpperCase();

  const userData = {
    username: username.trim().toLowerCase(),
    display_name: displayName,
    bio: 'Founder & Creator of QwinCHAT 👑',
    role: 'owner',
    is_verified: true,
    badge_type: 'creator',
    referral_code: referralCode,
    points: 9999,
  };
  userData[field] = contact.trim();

  const { data: user, error } = await supabase.from('users').insert(userData).select().single();

  if (error) {
    console.error('❌ Error creating account:', error.message);
  } else {
    console.log('\n✅ SUCCESS! Owner account created:\n');
    console.log(`   Name: ${user.display_name}`);
    console.log(`   Username: @${user.username}`);
    console.log(`   Role: ${user.role} (Global Super Administrator)`);
    console.log(`   Badge: Creator ✓`);
    console.log('\n👑 You now have all 60 admin powers in QwinCHAT.');
    console.log('   Log in to the app using your phone/email + OTP as normal.');
    console.log('   Your admin role is already attached — no separate password needed.');
    console.log('   (QwinCHAT uses OTP login, not passwords, for maximum security)\n');
  }

  rl.close();
}

main();
