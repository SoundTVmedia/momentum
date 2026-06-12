import { Context } from 'hono';
import { z } from 'zod';
import {
  AmbassadorApplicationSchema,
  ApplicationStatusSchema,
  ApplicationTypeSchema,
  InfluencerApplicationSchema,
  SponsorApplicationSchema,
  scoreApplication,
  type ApplicationType,
} from '../shared/program-applications';
import { isCommunityRole } from '../shared/user-roles';
import { getStaffProfile, isAdmin } from './admin-auth';
import { mochaUserIdKey } from './mocha-user-id';
import { r2ForClipObjectKey } from './r2-clip-key';

const ACTIVE_APPLICATION_STATUSES = [
  'submitted',
  'needs_more_info',
  'under_review',
] as const;

const SubmitBodySchema = z.object({
  type: ApplicationTypeSchema,
  formData: z.record(z.unknown()),
});

const ReviewBodySchema = z.object({
  action: z.enum(['approve', 'reject', 'needs_more_info', 'under_review']),
  review_notes: z.string().optional(),
});

type ProgramApplicationRow = {
  id: number;
  mocha_user_id: string | null;
  type: ApplicationType;
  status: string;
  form_data: string;
  confidence_score: number | null;
  review_notes: string | null;
  reviewer_id: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  display_name?: string | null;
  role?: string | null;
  profile_image_url?: string | null;
};

function parseFormData(type: ApplicationType, formData: Record<string, unknown>) {
  switch (type) {
    case 'ambassador':
      return AmbassadorApplicationSchema.parse(formData);
    case 'influencer':
      return InfluencerApplicationSchema.parse(formData);
    case 'sponsor':
      return SponsorApplicationSchema.parse(formData);
  }
}

function serializeApplication(row: ProgramApplicationRow) {
  let parsedFormData: Record<string, unknown> = {};
  try {
    parsedFormData = JSON.parse(row.form_data) as Record<string, unknown>;
  } catch {
    parsedFormData = {};
  }

  return {
    id: String(row.id),
    userId: row.mocha_user_id ?? undefined,
    type: row.type,
    status: row.status,
    formData: parsedFormData,
    confidenceScore: row.confidence_score ?? undefined,
    reviewNotes: row.review_notes ?? undefined,
    reviewerId: row.reviewer_id ?? undefined,
    submittedAt: row.submitted_at ?? undefined,
    reviewedAt: row.reviewed_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    displayName: row.display_name ?? undefined,
    role: row.role ?? undefined,
    profileImageUrl: row.profile_image_url ?? undefined,
  };
}

function roleForApplicationType(type: ApplicationType): string | null {
  if (type === 'sponsor') return 'sponsor';
  return type;
}

export async function submitProgramApplication(c: Context) {
  const mochaUser = c.get('user');
  const body = SubmitBodySchema.parse(await c.req.json());
  const { type, formData } = body;

  if ((type === 'ambassador' || type === 'influencer') && !mochaUser) {
    return c.json({ error: 'Sign in required for this application' }, 401);
  }

  const parsed = parseFormData(type, formData);
  const confidenceScore = scoreApplication(type, parsed);
  const userId = mochaUser ? mochaUserIdKey(mochaUser) : null;

  if (userId) {
    const existing = await c.env.DB.prepare(
      `SELECT id FROM program_applications
       WHERE mocha_user_id = ? AND type = ?
       AND status IN (${ACTIVE_APPLICATION_STATUSES.map(() => '?').join(', ')})`,
    )
      .bind(userId, type, ...ACTIVE_APPLICATION_STATUSES)
      .first();

    if (existing) {
      return c.json({ error: 'You already have an active application for this program' }, 400);
    }
  }

  const result = await c.env.DB.prepare(
    `INSERT INTO program_applications (
      mocha_user_id, type, status, form_data, confidence_score,
      submitted_at, created_at, updated_at
    ) VALUES (?, ?, 'submitted', ?, ?, datetime('now'), datetime('now'), datetime('now'))`,
  )
    .bind(userId, type, JSON.stringify(parsed), confidenceScore)
    .run();

  const id = result.meta.last_row_id;
  const row = (await c.env.DB.prepare('SELECT * FROM program_applications WHERE id = ?')
    .bind(id)
    .first()) as ProgramApplicationRow | null;

  if (!row) {
    return c.json({ error: 'Failed to create application' }, 500);
  }

  return c.json({ application: serializeApplication(row) }, 201);
}

export async function getMyProgramApplications(c: Context) {
  const mochaUser = c.get('user');
  if (!mochaUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const userId = mochaUserIdKey(mochaUser);
  const type = c.req.query('type');
  let query = 'SELECT * FROM program_applications WHERE mocha_user_id = ?';
  const bindings: unknown[] = [userId];

  if (type) {
    const parsedType = ApplicationTypeSchema.parse(type);
    query += ' AND type = ?';
    bindings.push(parsedType);
  }

  query += ' ORDER BY created_at DESC';

  const rows = await c.env.DB.prepare(query).bind(...bindings).all();
  const applications = (rows.results as ProgramApplicationRow[]).map(serializeApplication);
  return c.json({ applications });
}

export async function getAdminProgramApplications(c: Context) {
  const mochaUser = c.get('user');
  if (!mochaUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const staffProfile = await getStaffProfile(c.env.DB, mochaUserIdKey(mochaUser));
  if (!isAdmin(staffProfile)) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  const status = c.req.query('status') || 'submitted';
  const type = c.req.query('type');

  let query = `
    SELECT
      program_applications.*,
      user_profiles.display_name,
      user_profiles.role,
      user_profiles.profile_image_url
    FROM program_applications
    LEFT JOIN user_profiles ON program_applications.mocha_user_id = user_profiles.mocha_user_id
  `;
  const bindings: unknown[] = [];
  const clauses: string[] = [];

  if (status !== 'all') {
  const parsedStatus = ApplicationStatusSchema.parse(status);
    clauses.push('program_applications.status = ?');
    bindings.push(parsedStatus);
  }

  if (type) {
    const parsedType = ApplicationTypeSchema.parse(type);
    clauses.push('program_applications.type = ?');
    bindings.push(parsedType);
  }

  if (clauses.length > 0) {
    query += ` WHERE ${clauses.join(' AND ')}`;
  }

  query += ' ORDER BY program_applications.submitted_at DESC, program_applications.created_at DESC';

  const rows = await c.env.DB.prepare(query).bind(...bindings).all();
  const applications = (rows.results as ProgramApplicationRow[]).map(serializeApplication);
  return c.json({ applications });
}

export async function reviewProgramApplication(c: Context) {
  const mochaUser = c.get('user');
  if (!mochaUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const staffProfile = await getStaffProfile(c.env.DB, mochaUserIdKey(mochaUser));
  if (!isAdmin(staffProfile)) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  const applicationId = c.req.param('applicationId');
  const body = ReviewBodySchema.parse(await c.req.json());

  const row = (await c.env.DB.prepare('SELECT * FROM program_applications WHERE id = ?')
    .bind(applicationId)
    .first()) as ProgramApplicationRow | null;

  if (!row) {
    return c.json({ error: 'Application not found' }, 404);
  }

  let newStatus: string;
  switch (body.action) {
    case 'approve':
      newStatus = 'approved';
      break;
    case 'reject':
      newStatus = 'rejected';
      break;
    case 'needs_more_info':
      newStatus = 'needs_more_info';
      break;
    case 'under_review':
      newStatus = 'under_review';
      break;
  }

  await c.env.DB.prepare(
    `UPDATE program_applications
     SET status = ?, review_notes = ?, reviewer_id = ?, reviewed_at = datetime('now'), updated_at = datetime('now')
     WHERE id = ?`,
  )
    .bind(newStatus, body.review_notes ?? row.review_notes, mochaUserIdKey(mochaUser), applicationId)
    .run();

  if (body.action === 'approve' && row.mocha_user_id) {
    const targetRole = roleForApplicationType(row.type);
    if (targetRole && isCommunityRole(targetRole)) {
      await c.env.DB.prepare(
        `UPDATE user_profiles SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE mocha_user_id = ?`,
      )
        .bind(targetRole, row.mocha_user_id)
        .run();
    }
  }

  const updated = (await c.env.DB.prepare('SELECT * FROM program_applications WHERE id = ?')
    .bind(applicationId)
    .first()) as ProgramApplicationRow;

  return c.json({ application: serializeApplication(updated) });
}

export async function uploadBrandAsset(c: Context) {
  const mochaUser = c.get('user');
  if (!mochaUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const formData = await c.req.formData();
  const file = formData.get('file') as File | null;
  if (!file) {
    return c.json({ error: 'No file provided' }, 400);
  }

  const timestamp = Date.now();
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const key = `brand-assets/${mochaUserIdKey(mochaUser)}/${timestamp}_${sanitizedName}`;
  const contentType = file.type || 'image/png';

  const r2 = r2ForClipObjectKey(c.env, key);
  await r2.put(key, file.stream(), {
    httpMetadata: { contentType },
  });

  return c.json({
    success: true,
    url: `/api/files/${encodeURIComponent(key)}`,
    key,
  }, 201);
}
