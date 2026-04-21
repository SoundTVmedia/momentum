import { Context } from 'hono';
import * as crypto from 'crypto';

/**
 * Generate TOTP secret and QR code for 2FA setup
 */
export async function setupTwoFactor(c: Context) {
  const mochaUser = c.get("user");
  
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  // Check if user is verified artist/venue/influencer
  const profile = await c.env.DB.prepare(
    "SELECT role, is_verified FROM user_profiles WHERE mocha_user_id = ?"
  )
    .bind(mochaUser.id)
    .first();

  if (!profile || !profile.is_verified) {
    return c.json({ error: "2FA is only available for verified users" }, 403);
  }

  // Check if already enabled
  const existing2FA = await c.env.DB.prepare(
    "SELECT is_enabled FROM two_factor_auth WHERE mocha_user_id = ?"
  )
    .bind(mochaUser.id)
    .first();

  if (existing2FA && existing2FA.is_enabled) {
    return c.json({ error: "2FA is already enabled" }, 400);
  }

  // Generate secret (base32 encoded random bytes)
  const secret = generateBase32Secret();

  // Generate backup codes
  const backupCodes = generateBackupCodes(8);

  // Store in database
  if (existing2FA) {
    await c.env.DB.prepare(
      `UPDATE two_factor_auth 
       SET secret = ?, backup_codes = ?, is_enabled = 0, updated_at = CURRENT_TIMESTAMP 
       WHERE mocha_user_id = ?`
    )
      .bind(secret, JSON.stringify(backupCodes), mochaUser.id)
      .run();
  } else {
    await c.env.DB.prepare(
      `INSERT INTO two_factor_auth (mocha_user_id, secret, backup_codes, created_at, updated_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    )
      .bind(mochaUser.id, secret, JSON.stringify(backupCodes))
      .run();
  }

  // Generate OTP Auth URL for QR code
  const appName = 'MOMENTUM';
  const userLabel = mochaUser.google_user_data.email;
  const otpAuthUrl = `otpauth://totp/${encodeURIComponent(appName)}:${encodeURIComponent(userLabel)}?secret=${secret}&issuer=${encodeURIComponent(appName)}`;

  return c.json({
    secret,
    qrCodeUrl: otpAuthUrl,
    backupCodes,
  });
}

/**
 * Verify and enable 2FA
 */
export async function verifyAndEnableTwoFactor(c: Context) {
  const mochaUser = c.get("user");
  
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req.json();
  const { code } = body;

  if (!code) {
    return c.json({ error: "Verification code required" }, 400);
  }

  // Get 2FA record
  const twoFactorAuth = await c.env.DB.prepare(
    "SELECT secret, is_enabled FROM two_factor_auth WHERE mocha_user_id = ?"
  )
    .bind(mochaUser.id)
    .first();

  if (!twoFactorAuth) {
    return c.json({ error: "2FA not set up" }, 404);
  }

  if (twoFactorAuth.is_enabled) {
    return c.json({ error: "2FA already enabled" }, 400);
  }

  // Verify TOTP code
  const isValid = verifyTOTP(twoFactorAuth.secret as string, code);

  if (!isValid) {
    return c.json({ error: "Invalid verification code" }, 400);
  }

  // Enable 2FA
  await c.env.DB.prepare(
    "UPDATE two_factor_auth SET is_enabled = 1, updated_at = CURRENT_TIMESTAMP WHERE mocha_user_id = ?"
  )
    .bind(mochaUser.id)
    .run();

  return c.json({ success: true, message: "2FA enabled successfully" });
}

/**
 * Disable 2FA
 */
export async function disableTwoFactor(c: Context) {
  const mochaUser = c.get("user");
  
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req.json();
  const { code, backupCode } = body;

  // Get 2FA record
  const twoFactorAuth = await c.env.DB.prepare(
    "SELECT secret, backup_codes, is_enabled FROM two_factor_auth WHERE mocha_user_id = ?"
  )
    .bind(mochaUser.id)
    .first();

  if (!twoFactorAuth || !twoFactorAuth.is_enabled) {
    return c.json({ error: "2FA not enabled" }, 400);
  }

  let isValid = false;

  // Verify TOTP code or backup code
  if (code) {
    isValid = verifyTOTP(twoFactorAuth.secret as string, code);
  } else if (backupCode) {
    const backupCodes = JSON.parse(twoFactorAuth.backup_codes as string);
    const index = backupCodes.indexOf(backupCode);
    if (index !== -1) {
      isValid = true;
      // Remove used backup code
      backupCodes.splice(index, 1);
      await c.env.DB.prepare(
        "UPDATE two_factor_auth SET backup_codes = ?, updated_at = CURRENT_TIMESTAMP WHERE mocha_user_id = ?"
      )
        .bind(JSON.stringify(backupCodes), mochaUser.id)
        .run();
    }
  }

  if (!isValid) {
    return c.json({ error: "Invalid verification code" }, 400);
  }

  // Disable 2FA
  await c.env.DB.prepare(
    "DELETE FROM two_factor_auth WHERE mocha_user_id = ?"
  )
    .bind(mochaUser.id)
    .run();

  return c.json({ success: true, message: "2FA disabled successfully" });
}

/**
 * Get 2FA status
 */
export async function getTwoFactorStatus(c: Context) {
  const mochaUser = c.get("user");
  
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const twoFactorAuth = await c.env.DB.prepare(
    "SELECT is_enabled FROM two_factor_auth WHERE mocha_user_id = ?"
  )
    .bind(mochaUser.id)
    .first();

  return c.json({
    enabled: twoFactorAuth?.is_enabled === 1,
  });
}

/**
 * Verify 2FA code during login
 */
export async function verifyTwoFactorLogin(c: Context) {
  const mochaUser = c.get("user");
  
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req.json();
  const { code, backupCode } = body;

  // Get 2FA record
  const twoFactorAuth = await c.env.DB.prepare(
    "SELECT secret, backup_codes FROM two_factor_auth WHERE mocha_user_id = ? AND is_enabled = 1"
  )
    .bind(mochaUser.id)
    .first();

  if (!twoFactorAuth) {
    return c.json({ error: "2FA not enabled" }, 400);
  }

  let isValid = false;

  // Verify TOTP code or backup code
  if (code) {
    isValid = verifyTOTP(twoFactorAuth.secret as string, code);
  } else if (backupCode) {
    const backupCodes = JSON.parse(twoFactorAuth.backup_codes as string);
    const index = backupCodes.indexOf(backupCode);
    if (index !== -1) {
      isValid = true;
      // Remove used backup code
      backupCodes.splice(index, 1);
      await c.env.DB.prepare(
        "UPDATE two_factor_auth SET backup_codes = ?, updated_at = CURRENT_TIMESTAMP WHERE mocha_user_id = ?"
      )
        .bind(JSON.stringify(backupCodes), mochaUser.id)
        .run();
    }
  }

  if (!isValid) {
    return c.json({ error: "Invalid verification code" }, 400);
  }

  return c.json({ success: true, verified: true });
}

// Helper functions

function generateBase32Secret(length: number = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let secret = '';
  const bytes = crypto.randomBytes(length);
  
  for (let i = 0; i < length; i++) {
    secret += chars[bytes[i] % chars.length];
  }
  
  return secret;
}

function generateBackupCodes(count: number = 8): string[] {
  const codes: string[] = [];
  
  for (let i = 0; i < count; i++) {
    const bytes = crypto.randomBytes(4);
    const code = bytes.toString('hex').toUpperCase();
    codes.push(`${code.slice(0, 4)}-${code.slice(4, 8)}`);
  }
  
  return codes;
}

function verifyTOTP(secret: string, token: string): boolean {
  // Implement TOTP verification (RFC 6238)
  // Using 30-second time steps
  const timeStep = 30;
  const currentTime = Math.floor(Date.now() / 1000);
  const timeCounter = Math.floor(currentTime / timeStep);
  
  // Check current window and +/- 1 window for clock drift
  for (let i = -1; i <= 1; i++) {
    const counter = timeCounter + i;
    const generatedToken = generateTOTP(secret, counter);
    
    if (generatedToken === token) {
      return true;
    }
  }
  
  return false;
}

function generateTOTP(secret: string, counter: number): string {
  // Decode base32 secret
  const key = base32Decode(secret);
  
  // Convert counter to 8-byte buffer
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  
  // Generate HMAC-SHA1
  const hmac = crypto.createHmac('sha1', key);
  hmac.update(buffer);
  const hash = hmac.digest();
  
  // Dynamic truncation
  const offset = hash[hash.length - 1] & 0x0f;
  const binary = ((hash[offset] & 0x7f) << 24) |
                 ((hash[offset + 1] & 0xff) << 16) |
                 ((hash[offset + 2] & 0xff) << 8) |
                 (hash[offset + 3] & 0xff);
  
  // Generate 6-digit code
  const otp = binary % 1000000;
  return otp.toString().padStart(6, '0');
}

function base32Decode(encoded: string): Buffer {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bits: number[] = [];
  
  for (const char of encoded.toUpperCase()) {
    const val = chars.indexOf(char);
    if (val === -1) continue;
    
    for (let i = 4; i >= 0; i--) {
      bits.push((val >> i) & 1);
    }
  }
  
  const bytes: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    if (i + 8 <= bits.length) {
      let byte = 0;
      for (let j = 0; j < 8; j++) {
        byte = (byte << 1) | bits[i + j];
      }
      bytes.push(byte);
    }
  }
  
  return Buffer.from(bytes);
}
