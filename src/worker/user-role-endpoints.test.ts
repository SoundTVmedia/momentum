import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ADMIN_USER_ROLE_SEARCH_SQL,
  adminUserRoleSearchBinds,
} from './user-role-endpoints';

describe('admin user role search', () => {
  const databases: DatabaseSync[] = [];

  afterEach(() => {
    for (const db of databases.splice(0)) db.close();
  });

  function createDb(): DatabaseSync {
    const db = new DatabaseSync(':memory:');
    databases.push(db);
    db.exec(`
      CREATE TABLE user_profiles (
        mocha_user_id TEXT PRIMARY KEY,
        display_name TEXT,
        role TEXT,
        is_admin INTEGER DEFAULT 0,
        is_moderator INTEGER DEFAULT 0,
        is_superadmin INTEGER DEFAULT 0,
        profile_image_url TEXT
      );
      CREATE TABLE user_emails (
        email TEXT PRIMARY KEY,
        mocha_user_id TEXT NOT NULL
      );
      CREATE TABLE email_accounts (
        id TEXT PRIMARY KEY,
        email TEXT,
        display_name TEXT
      );
      CREATE TABLE google_accounts (
        id TEXT PRIMARY KEY,
        email TEXT,
        display_name TEXT
      );
      CREATE TABLE apple_accounts (
        id TEXT PRIMARY KEY,
        email TEXT,
        display_name TEXT
      );
      CREATE TABLE user_bans (
        mocha_user_id TEXT,
        expires_at TEXT
      );
    `);
    return db;
  }

  it('finds users by email, not only display name or user ID', () => {
    const db = createDb();
    db.exec(`
      INSERT INTO user_profiles (mocha_user_id, display_name, role)
      VALUES
        ('user-1', 'Alex Rivera', 'fan'),
        ('user-2', 'Sam Chen', 'fan'),
        ('user-3', 'Jamie Fox', 'fan');
      INSERT INTO user_emails (email, mocha_user_id)
      VALUES ('alex@example.com', 'user-1');
      INSERT INTO email_accounts (id, email)
      VALUES ('user-2', 'sam.chen@feedback.app');
    `);

    const byEmail = db
      .prepare(ADMIN_USER_ROLE_SEARCH_SQL)
      .all(...adminUserRoleSearchBinds('alex@example.com')) as Array<{
      mocha_user_id: string;
      email: string | null;
    }>;
    expect(byEmail).toEqual([
      expect.objectContaining({ mocha_user_id: 'user-1', email: 'alex@example.com' }),
    ]);

    const byAuthTableEmail = db
      .prepare(ADMIN_USER_ROLE_SEARCH_SQL)
      .all(...adminUserRoleSearchBinds('sam.chen@feedback.app')) as Array<{
      mocha_user_id: string;
      email: string | null;
    }>;
    expect(byAuthTableEmail).toEqual([
      expect.objectContaining({ mocha_user_id: 'user-2', email: 'sam.chen@feedback.app' }),
    ]);

    const byName = db
      .prepare(ADMIN_USER_ROLE_SEARCH_SQL)
      .all(...adminUserRoleSearchBinds('Jamie')) as Array<{ mocha_user_id: string }>;
    expect(byName.map((row) => row.mocha_user_id)).toEqual(['user-3']);
  });

  it('finds Hide My Email Apple users by the Apple display name', () => {
    const db = createDb();
    db.exec(`
      INSERT INTO user_profiles (mocha_user_id, display_name, role)
      VALUES ('apple-1', 'wzzrknm4gz', 'fan');
      INSERT INTO apple_accounts (id, email, display_name)
      VALUES ('apple-1', 'wzzrknm4gz@privaterelay.appleid.com', 'Lisa Benner');
    `);

    const rows = db
      .prepare(ADMIN_USER_ROLE_SEARCH_SQL)
      .all(...adminUserRoleSearchBinds('Lisa Benner')) as Array<{
      mocha_user_id: string;
      display_name: string | null;
      email: string | null;
    }>;

    expect(rows).toEqual([
      expect.objectContaining({
        mocha_user_id: 'apple-1',
        display_name: 'Lisa Benner',
        email: 'wzzrknm4gz@privaterelay.appleid.com',
      }),
    ]);
  });
});
