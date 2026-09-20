-- Replace email-local-part profile names with Apple/Google/email display names.
UPDATE user_profiles
SET display_name = (
      SELECT trim(apple_accounts.display_name)
      FROM apple_accounts
      WHERE apple_accounts.id = user_profiles.mocha_user_id
        AND apple_accounts.display_name IS NOT NULL
        AND trim(apple_accounts.display_name) != ''
      LIMIT 1
    ),
    updated_at = CURRENT_TIMESTAMP
WHERE EXISTS (
  SELECT 1 FROM apple_accounts
  WHERE apple_accounts.id = user_profiles.mocha_user_id
    AND apple_accounts.display_name IS NOT NULL
    AND trim(apple_accounts.display_name) != ''
    AND (
      user_profiles.display_name IS NULL
      OR trim(user_profiles.display_name) = ''
      OR (
        instr(apple_accounts.email, '@') > 1
        AND lower(trim(user_profiles.display_name)) =
            lower(substr(apple_accounts.email, 1, instr(apple_accounts.email, '@') - 1))
      )
    )
);

UPDATE user_profiles
SET display_name = (
      SELECT trim(google_accounts.display_name)
      FROM google_accounts
      WHERE google_accounts.id = user_profiles.mocha_user_id
        AND google_accounts.display_name IS NOT NULL
        AND trim(google_accounts.display_name) != ''
      LIMIT 1
    ),
    updated_at = CURRENT_TIMESTAMP
WHERE EXISTS (
  SELECT 1 FROM google_accounts
  WHERE google_accounts.id = user_profiles.mocha_user_id
    AND google_accounts.display_name IS NOT NULL
    AND trim(google_accounts.display_name) != ''
    AND (
      user_profiles.display_name IS NULL
      OR trim(user_profiles.display_name) = ''
      OR (
        instr(google_accounts.email, '@') > 1
        AND lower(trim(user_profiles.display_name)) =
            lower(substr(google_accounts.email, 1, instr(google_accounts.email, '@') - 1))
      )
    )
);

UPDATE user_profiles
SET display_name = (
      SELECT trim(email_accounts.display_name)
      FROM email_accounts
      WHERE email_accounts.id = user_profiles.mocha_user_id
        AND email_accounts.display_name IS NOT NULL
        AND trim(email_accounts.display_name) != ''
      LIMIT 1
    ),
    updated_at = CURRENT_TIMESTAMP
WHERE EXISTS (
  SELECT 1 FROM email_accounts
  WHERE email_accounts.id = user_profiles.mocha_user_id
    AND email_accounts.display_name IS NOT NULL
    AND trim(email_accounts.display_name) != ''
    AND (
      user_profiles.display_name IS NULL
      OR trim(user_profiles.display_name) = ''
      OR (
        instr(email_accounts.email, '@') > 1
        AND lower(trim(user_profiles.display_name)) =
            lower(substr(email_accounts.email, 1, instr(email_accounts.email, '@') - 1))
      )
    )
);
