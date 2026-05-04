import { Context } from 'hono';
import * as crypto from 'crypto';
import { createEmailSession, setEmailSessionCookie } from './hybrid-auth';

/**
 * Create a device token for "remember me" functionality
 */
export async function createDeviceToken(c: Context) {
  const mochaUser = c.get("user");
  
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    // Generate a secure random token
    const deviceToken = crypto.randomBytes(32).toString('hex');
    
    // Get device information from headers
    const userAgent = c.req.header('user-agent') || 'unknown';
    const deviceType = userAgent.includes('Mobile') ? 'mobile' : 'desktop';
    
    // Token expires in 30 days
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // Store device token in database
    await c.env.DB.prepare(
      `INSERT INTO user_device_tokens (mocha_user_id, device_token, device_name, device_type, expires_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    )
      .bind(
        mochaUser.id,
        deviceToken,
        userAgent.substring(0, 100), // Limit to 100 chars
        deviceType,
        expiresAt.toISOString()
      )
      .run();

    return c.json({ deviceToken, expiresAt });
  } catch (error) {
    console.error('Create device token error:', error);
    return c.json({ error: 'Failed to create device token' }, 500);
  }
}

/**
 * Verify a device token and restore user session
 */
export async function verifyDeviceToken(c: Context) {
  const body = await c.req.json();
  const { deviceToken } = body;

  if (!deviceToken) {
    return c.json({ error: 'Device token required' }, 400);
  }

  try {
    // Look up device token
    const token = await c.env.DB.prepare(
      `SELECT mocha_user_id, expires_at 
       FROM user_device_tokens 
       WHERE device_token = ? 
       AND expires_at > datetime('now')`
    )
      .bind(deviceToken)
      .first();

    if (!token) {
      return c.json({ error: 'Invalid or expired device token' }, 401);
    }

    // Update last_used_at
    await c.env.DB.prepare(
      `UPDATE user_device_tokens 
       SET last_used_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
       WHERE device_token = ?`
    )
      .bind(deviceToken)
      .run();

    // Return user data
    const userData = await c.env.DB.prepare(
      "SELECT * FROM user_profiles WHERE mocha_user_id = ?"
    )
      .bind(token.mocha_user_id)
      .first();

    // Email/password accounts: restore session cookie so /api/users/me works
    const emailAccount = await c.env.DB.prepare(
      'SELECT id FROM email_accounts WHERE id = ?'
    )
      .bind(token.mocha_user_id)
      .first<{ id: string }>();

    if (emailAccount) {
      const { rawToken } = await createEmailSession(
        c.env.DB,
        token.mocha_user_id as string
      );
      setEmailSessionCookie(c, rawToken);
    }

    return c.json({
      valid: true,
      userId: token.mocha_user_id,
      profile: userData,
    });
  } catch (error) {
    console.error('Verify device token error:', error);
    return c.json({ error: 'Failed to verify device token' }, 500);
  }
}

/**
 * Get all device tokens for current user
 */
export async function getDeviceTokens(c: Context) {
  const mochaUser = c.get("user");
  
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const tokens = await c.env.DB.prepare(
      `SELECT id, device_name, device_type, last_used_at, expires_at, created_at
       FROM user_device_tokens
       WHERE mocha_user_id = ?
       AND expires_at > datetime('now')
       ORDER BY last_used_at DESC`
    )
      .bind(mochaUser.id)
      .all();

    return c.json({ devices: tokens.results || [] });
  } catch (error) {
    console.error('Get device tokens error:', error);
    return c.json({ error: 'Failed to get device tokens' }, 500);
  }
}

/**
 * Revoke a device token
 */
export async function revokeDeviceToken(c: Context) {
  const mochaUser = c.get("user");
  
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const tokenId = c.req.param('tokenId');

  try {
    // Verify token belongs to user before deleting
    const token = await c.env.DB.prepare(
      "SELECT id FROM user_device_tokens WHERE id = ? AND mocha_user_id = ?"
    )
      .bind(tokenId, mochaUser.id)
      .first();

    if (!token) {
      return c.json({ error: 'Device token not found' }, 404);
    }

    // Delete token
    await c.env.DB.prepare(
      "DELETE FROM user_device_tokens WHERE id = ?"
    )
      .bind(tokenId)
      .run();

    return c.json({ success: true });
  } catch (error) {
    console.error('Revoke device token error:', error);
    return c.json({ error: 'Failed to revoke device token' }, 500);
  }
}

/**
 * Revoke all device tokens for current user
 */
export async function revokeAllDeviceTokens(c: Context) {
  const mochaUser = c.get("user");
  
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    await c.env.DB.prepare(
      "DELETE FROM user_device_tokens WHERE mocha_user_id = ?"
    )
      .bind(mochaUser.id)
      .run();

    return c.json({ success: true });
  } catch (error) {
    console.error('Revoke all device tokens error:', error);
    return c.json({ error: 'Failed to revoke device tokens' }, 500);
  }
}
