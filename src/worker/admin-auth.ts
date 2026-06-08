export type StaffFlags = {
  is_admin?: number | boolean | null;
  is_superadmin?: number | boolean | null;
};

export function hasStaffFlag(value: number | boolean | null | undefined): boolean {
  return value === 1 || value === true;
}

/** Admin dashboard access (regular admin or superadmin). */
export function isAdmin(profile: StaffFlags | null | undefined): boolean {
  return hasStaffFlag(profile?.is_admin) || hasStaffFlag(profile?.is_superadmin);
}

export function isSuperAdmin(profile: StaffFlags | null | undefined): boolean {
  return hasStaffFlag(profile?.is_superadmin);
}

export async function getStaffProfile(db: D1Database, mochaUserId: string) {
  return db
    .prepare('SELECT is_admin, is_superadmin FROM user_profiles WHERE mocha_user_id = ?')
    .bind(mochaUserId)
    .first<{ is_admin: number; is_superadmin: number }>();
}
