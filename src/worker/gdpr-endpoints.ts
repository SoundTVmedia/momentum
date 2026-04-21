import { Context } from 'hono';

/**
 * GDPR Compliance Endpoints
 * Handles user data export, deletion, and privacy requests
 */

/**
 * Export all user data (GDPR Right to Data Portability)
 */
export async function exportUserData(c: Context) {
  const mochaUser = c.get('user');
  
  if (!mochaUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    // Gather all user data
    const profile = await c.env.DB.prepare(
      'SELECT * FROM user_profiles WHERE mocha_user_id = ?'
    ).bind(mochaUser.id).first();

    const clips = await c.env.DB.prepare(
      'SELECT * FROM clips WHERE mocha_user_id = ?'
    ).bind(mochaUser.id).all();

    const comments = await c.env.DB.prepare(
      'SELECT * FROM comments WHERE mocha_user_id = ?'
    ).bind(mochaUser.id).all();

    const likes = await c.env.DB.prepare(
      'SELECT * FROM clip_likes WHERE mocha_user_id = ?'
    ).bind(mochaUser.id).all();

    const savedClips = await c.env.DB.prepare(
      'SELECT * FROM saved_clips WHERE mocha_user_id = ?'
    ).bind(mochaUser.id).all();

    const follows = await c.env.DB.prepare(
      'SELECT * FROM follows WHERE follower_id = ? OR following_id = ?'
    ).bind(mochaUser.id, mochaUser.id).all();

    const notifications = await c.env.DB.prepare(
      'SELECT * FROM notifications WHERE mocha_user_id = ?'
    ).bind(mochaUser.id).all();

    const points = await c.env.DB.prepare(
      'SELECT * FROM user_points WHERE mocha_user_id = ?'
    ).bind(mochaUser.id).first();

    const pointTransactions = await c.env.DB.prepare(
      'SELECT * FROM point_transactions WHERE mocha_user_id = ?'
    ).bind(mochaUser.id).all();

    const badges = await c.env.DB.prepare(
      `SELECT badges.* FROM user_badges 
       JOIN badges ON user_badges.badge_id = badges.id 
       WHERE user_badges.mocha_user_id = ?`
    ).bind(mochaUser.id).all();

    const subscriptions = await c.env.DB.prepare(
      'SELECT * FROM subscriptions WHERE mocha_user_id = ?'
    ).bind(mochaUser.id).all();

    const transactions = await c.env.DB.prepare(
      'SELECT * FROM transactions WHERE mocha_user_id = ?'
    ).bind(mochaUser.id).all();

    // Compile data package
    const dataPackage = {
      exportDate: new Date().toISOString(),
      user: {
        id: mochaUser.id,
        email: mochaUser.google_user_data.email,
        name: mochaUser.google_user_data.name,
        profile: profile || null,
      },
      content: {
        clips: clips.results || [],
        comments: comments.results || [],
        likes: likes.results || [],
        savedClips: savedClips.results || [],
      },
      social: {
        follows: follows.results || [],
        notifications: notifications.results || [],
      },
      gamification: {
        points: points || null,
        pointTransactions: pointTransactions.results || [],
        badges: badges.results || [],
      },
      financial: {
        subscriptions: subscriptions.results || [],
        transactions: transactions.results || [],
      },
    };

    // Return as downloadable JSON
    return c.json(dataPackage, 200, {
      'Content-Disposition': `attachment; filename="momentum-data-export-${mochaUser.id}.json"`,
    });
  } catch (error) {
    console.error('Data export error:', error);
    return c.json({ error: 'Failed to export data' }, 500);
  }
}

/**
 * Request account deletion (GDPR Right to Erasure)
 */
export async function requestAccountDeletion(c: Context) {
  const mochaUser = c.get('user');
  
  if (!mochaUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const body = await c.req.json();
  const { reason } = body;

  // Create deletion request (requires admin approval for safety)
  try {
    await c.env.DB.prepare(
      `INSERT INTO account_deletion_requests 
       (mocha_user_id, reason, status, requested_at, created_at, updated_at)
       VALUES (?, ?, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    ).bind(mochaUser.id, reason || null).run();

    return c.json({
      success: true,
      message: 'Account deletion request submitted. This will be processed within 30 days.',
    });
  } catch (error) {
    console.error('Deletion request error:', error);
    return c.json({ error: 'Failed to submit deletion request' }, 500);
  }
}

/**
 * Admin: Process account deletion
 */
export async function processAccountDeletion(c: Context) {
  const mochaUser = c.get('user');
  
  if (!mochaUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  // Check admin access
  const userProfile = await c.env.DB.prepare(
    'SELECT is_admin FROM user_profiles WHERE mocha_user_id = ?'
  ).bind(mochaUser.id).first();

  if (!userProfile || !userProfile.is_admin) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  const requestId = c.req.param('requestId');

  try {
    // Get deletion request
    const request = await c.env.DB.prepare(
      'SELECT mocha_user_id FROM account_deletion_requests WHERE id = ? AND status = \'pending\''
    ).bind(requestId).first();

    if (!request) {
      return c.json({ error: 'Deletion request not found' }, 404);
    }

    const userId = request.mocha_user_id as string;

    // Anonymize or delete user data
    // Note: Some data (like clips) may be retained but anonymized per GDPR
    
    // Delete personal data
    await c.env.DB.prepare('DELETE FROM user_profiles WHERE mocha_user_id = ?').bind(userId).run();
    await c.env.DB.prepare('DELETE FROM notifications WHERE mocha_user_id = ?').bind(userId).run();
    await c.env.DB.prepare('DELETE FROM follows WHERE follower_id = ? OR following_id = ?').bind(userId, userId).run();
    await c.env.DB.prepare('DELETE FROM saved_clips WHERE mocha_user_id = ?').bind(userId).run();
    await c.env.DB.prepare('DELETE FROM clip_likes WHERE mocha_user_id = ?').bind(userId).run();
    await c.env.DB.prepare('DELETE FROM user_points WHERE mocha_user_id = ?').bind(userId).run();
    await c.env.DB.prepare('DELETE FROM point_transactions WHERE mocha_user_id = ?').bind(userId).run();
    await c.env.DB.prepare('DELETE FROM user_badges WHERE mocha_user_id = ?').bind(userId).run();
    await c.env.DB.prepare('DELETE FROM two_factor_auth WHERE mocha_user_id = ?').bind(userId).run();
    await c.env.DB.prepare('DELETE FROM subscriptions WHERE mocha_user_id = ?').bind(userId).run();

    // Anonymize clips (retain for community but remove personal connection)
    await c.env.DB.prepare(
      'UPDATE clips SET mocha_user_id = \'deleted_user\' WHERE mocha_user_id = ?'
    ).bind(userId).run();

    // Anonymize comments
    await c.env.DB.prepare(
      'UPDATE comments SET mocha_user_id = \'deleted_user\' WHERE mocha_user_id = ?'
    ).bind(userId).run();

    // Mark request as completed
    await c.env.DB.prepare(
      `UPDATE account_deletion_requests 
       SET status = 'completed', processed_at = CURRENT_TIMESTAMP, processed_by = ?
       WHERE id = ?`
    ).bind(mochaUser.id, requestId).run();

    return c.json({ success: true });
  } catch (error) {
    console.error('Account deletion error:', error);
    return c.json({ error: 'Failed to process account deletion' }, 500);
  }
}

/**
 * Get account deletion requests (Admin)
 */
export async function getDeletionRequests(c: Context) {
  const mochaUser = c.get('user');
  
  if (!mochaUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const userProfile = await c.env.DB.prepare(
    'SELECT is_admin FROM user_profiles WHERE mocha_user_id = ?'
  ).bind(mochaUser.id).first();

  if (!userProfile || !userProfile.is_admin) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  const status = c.req.query('status') || 'pending';

  const requests = await c.env.DB.prepare(
    `SELECT 
      account_deletion_requests.*,
      user_profiles.display_name,
      user_profiles.profile_image_url
    FROM account_deletion_requests
    LEFT JOIN user_profiles ON account_deletion_requests.mocha_user_id = user_profiles.mocha_user_id
    WHERE account_deletion_requests.status = ?
    ORDER BY account_deletion_requests.requested_at DESC`
  ).bind(status).all();

  return c.json({ requests: requests.results || [] });
}

/**
 * Update privacy settings
 */
export async function updatePrivacySettings(c: Context) {
  const mochaUser = c.get('user');
  
  if (!mochaUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const body = await c.req.json();
  const { 
    profile_visibility, 
    allow_tagging,
    show_online_status,
    email_notifications,
    push_notifications
  } = body;

  try {
    // Store privacy settings in user_profiles or separate table
    await c.env.DB.prepare(
      `INSERT INTO user_privacy_settings 
       (mocha_user_id, profile_visibility, allow_tagging, show_online_status, 
        email_notifications, push_notifications, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT(mocha_user_id) DO UPDATE SET
         profile_visibility = COALESCE(?, profile_visibility),
         allow_tagging = COALESCE(?, allow_tagging),
         show_online_status = COALESCE(?, show_online_status),
         email_notifications = COALESCE(?, email_notifications),
         push_notifications = COALESCE(?, push_notifications),
         updated_at = CURRENT_TIMESTAMP`
    ).bind(
      mochaUser.id, profile_visibility, allow_tagging, show_online_status, 
      email_notifications, push_notifications,
      profile_visibility, allow_tagging, show_online_status,
      email_notifications, push_notifications
    ).run();

    return c.json({ success: true });
  } catch (error) {
    console.error('Privacy settings error:', error);
    return c.json({ error: 'Failed to update privacy settings' }, 500);
  }
}

/**
 * Get privacy settings
 */
export async function getPrivacySettings(c: Context) {
  const mochaUser = c.get('user');
  
  if (!mochaUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const settings = await c.env.DB.prepare(
    'SELECT * FROM user_privacy_settings WHERE mocha_user_id = ?'
  ).bind(mochaUser.id).first();

  return c.json({
    settings: settings || {
      profile_visibility: 'public',
      allow_tagging: true,
      show_online_status: true,
      email_notifications: true,
      push_notifications: true,
    }
  });
}
