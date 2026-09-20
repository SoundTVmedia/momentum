import { describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import {
  defaultDisplayNameFromEmail,
  ensureOAuthUserProfile,
  isEmailLocalPartName,
  preferredProviderDisplayName,
} from './oauth-profile-bootstrap';

describe('preferredProviderDisplayName', () => {
  it('uses the Apple/Google/email display name', () => {
    expect(preferredProviderDisplayName('Jane Doe', 'jane.doe@example.com')).toBe(
      'Jane Doe',
    );
  });

  it('does not fall back to the email local-part', () => {
    expect(preferredProviderDisplayName(null, 'jane.doe@example.com')).toBeNull();
    expect(defaultDisplayNameFromEmail('jane.doe@example.com')).toBe('User');
    expect(defaultDisplayNameFromEmail('  WES@SoundTVMedia.com  ')).toBe('User');
  });

  it('ignores a name that is just the email local-part', () => {
    expect(
      preferredProviderDisplayName('wzzrknm4gz', 'wzzrknm4gz@privaterelay.appleid.com'),
    ).toBeNull();
    expect(isEmailLocalPartName('wzzrknm4gz', 'wzzrknm4gz@privaterelay.appleid.com')).toBe(
      true,
    );
  });
});

describe('ensureOAuthUserProfile', () => {
  it('replaces an email-prefix profile name with the Apple display name', async () => {
    const db = new DatabaseSync(':memory:');
    db.exec(`
      CREATE TABLE user_profiles (
        id INTEGER PRIMARY KEY,
        mocha_user_id TEXT UNIQUE,
        role TEXT,
        display_name TEXT,
        bio TEXT,
        location TEXT,
        profile_image_url TEXT,
        cover_image_url TEXT,
        city TEXT,
        genres TEXT,
        social_links TEXT,
        created_at TEXT,
        updated_at TEXT
      );
      CREATE TABLE apple_accounts (
        id TEXT PRIMARY KEY,
        email TEXT,
        display_name TEXT
      );
      CREATE TABLE google_accounts (
        id TEXT PRIMARY KEY,
        email TEXT,
        display_name TEXT
      );
      CREATE TABLE email_accounts (
        id TEXT PRIMARY KEY,
        email TEXT,
        display_name TEXT
      );
      INSERT INTO user_profiles (mocha_user_id, role, display_name)
      VALUES ('apple-1', 'fan', 'wzzrknm4gz');
      INSERT INTO apple_accounts (id, email, display_name)
      VALUES ('apple-1', 'wzzrknm4gz@privaterelay.appleid.com', 'Lisa Benner');
    `);

    const d1 = {
      prepare(sql: string) {
        return {
          bind(...args: unknown[]) {
            const stmt = db.prepare(sql);
            return {
              async first() {
                return stmt.get(...args) ?? null;
              },
              async run() {
                stmt.run(...args);
                return { success: true };
              },
            };
          },
        };
      },
    } as unknown as D1Database;

    await ensureOAuthUserProfile(d1, 'apple-1', {
      email: 'wzzrknm4gz@privaterelay.appleid.com',
    });

    const row = db
      .prepare('SELECT display_name FROM user_profiles WHERE mocha_user_id = ?')
      .get('apple-1') as { display_name: string };
    expect(row.display_name).toBe('Lisa Benner');
    db.close();
  });
});
