import { Context } from 'hono';
import * as crypto from 'crypto';

/**
 * Email/Password Sign In Endpoint
 * Note: This is a placeholder implementation. In production, you would:
 * 1. Use a proper password hashing library (bcrypt, argon2, etc.)
 * 2. Store password hashes in a secure user_credentials table
 * 3. Implement proper rate limiting
 * 4. Add email verification flow
 * 5. Implement password reset functionality
 * 
 * For now, this returns an error directing users to use Google OAuth
 */
export async function emailPasswordSignIn(c: Context) {
  const body = await c.req.json();
  const { email, password } = body;

  if (!email || !password) {
    return c.json({ error: 'Email and password are required' }, 400);
  }

  // IMPORTANT: Email/Password authentication requires additional setup
  // For security reasons, we recommend using Google OAuth for now
  return c.json({ 
    error: 'Email/password authentication is not yet configured. Please use "Sign In with Google" for now.' 
  }, 501);

  // TODO: Implement email/password authentication
  // This would involve:
  // 1. Looking up user by email in database
  // 2. Verifying password hash
  // 3. Creating session token
  // 4. Setting session cookie
  // 5. Returning user data
  
  /*
  try {
    // Look up user credentials
    const credentials = await c.env.DB.prepare(
      'SELECT * FROM user_credentials WHERE email = ?'
    )
      .bind(email)
      .first();

    if (!credentials) {
      return c.json({ error: 'Invalid email or password' }, 401);
    }

    // Verify password (use bcrypt.compare or similar)
    const isValidPassword = await verifyPassword(password, credentials.password_hash);
    
    if (!isValidPassword) {
      return c.json({ error: 'Invalid email or password' }, 401);
    }

    // Create session token
    const sessionToken = crypto.randomBytes(32).toString('hex');
    
    // Store session in database or cache
    // Set session cookie
    // Return user data
    
    return c.json({ success: true, user: userData });
  } catch (error) {
    console.error('Email sign in error:', error);
    return c.json({ error: 'Sign in failed' }, 500);
  }
  */
}

/**
 * Helper function to hash passwords (placeholder)
 */
async function hashPassword(password: string): Promise<string> {
  // TODO: Use bcrypt or argon2
  return crypto.createHash('sha256').update(password).digest('hex');
}

/**
 * Helper function to verify passwords (placeholder)
 */
async function verifyPassword(password: string, hash: string): Promise<boolean> {
  // TODO: Use bcrypt.compare or argon2.verify
  const inputHash = crypto.createHash('sha256').update(password).digest('hex');
  return inputHash === hash;
}
