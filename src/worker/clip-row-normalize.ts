type ClipRow = Record<string, unknown>;

function parseTimestampMs(value: unknown): number | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    const ms = value < 1e12 ? value * 1000 : value;
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof value === 'string') {
    const s = value.trim();
    if (!s) return null;
    if (/^\d+$/.test(s)) {
      const n = Number(s);
      if (!Number.isFinite(n)) return null;
      const ms = n < 1e12 ? n * 1000 : n;
      return Number.isFinite(ms) ? ms : null;
    }
    const t = Date.parse(s);
    return Number.isFinite(t) ? t : null;
  }
  return null;
}

function isUsableTimestamp(value: unknown): boolean {
  return parseTimestampMs(value) != null;
}

function coerceClipCreatedAt(row: ClipRow): void {
  if (isUsableTimestamp(row.created_at)) return;
  const ts = row.timestamp;
  if (!isUsableTimestamp(ts)) return;
  row.created_at = typeof ts === 'string' ? ts : String(ts);
}

function coercePositiveInt(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v) && v > 0 && Number.isInteger(v)) {
    return v;
  }
  if (typeof v === 'bigint') {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 && Number.isInteger(n) ? n : null;
  }
  if (typeof v === 'string' && /^\d+$/.test(v.trim())) {
    const n = Number.parseInt(v.trim(), 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return null;
}

/**
 * Ensures each clip row has a numeric `id` for clients. Adds `clips.rowid` as `_clipRowId`
 * in SQL, then fills `id` from `_clipRowId` when `id` is missing or not a positive integer
 * (e.g. join/shape quirks or bigint-as-string edge cases).
 */
export function normalizeClipApiRows(rows: ClipRow[]): ClipRow[] {
  return rows.map((row) => {
    const out = { ...row } as ClipRow;
    const rowid = out._clipRowId;
    delete out._clipRowId;

    // Prefer explicit PK from SQL (`clips.id AS clip_primary_id`) so joined `id` columns never shadow it.
    const explicitPk = (out as { clip_primary_id?: unknown }).clip_primary_id;
    delete (out as { clip_primary_id?: unknown }).clip_primary_id;

    const rawId =
      explicitPk ??
      out.id ??
      (out as { clip_id?: unknown }).clip_id ??
      (out as { ID?: unknown }).ID ??
      (out as { clipId?: unknown }).clipId;
    const fromExplicit = coercePositiveInt(explicitPk);
    const fromOut = coercePositiveInt(out.id);
    const fromRowid = coercePositiveInt(rowid);
    let id = coercePositiveInt(rawId);
    if (id == null) {
      id = fromRowid;
    }
    // If alias/`clips.id` disagree with `clips.rowid`, trust rowid (INTEGER PK = rowid for clips).
    if (fromRowid != null) {
      if (
        (fromExplicit != null && fromExplicit !== fromRowid) ||
        (fromOut != null && fromOut !== fromRowid) ||
        (id != null && id !== fromRowid)
      ) {
        id = fromRowid;
      }
    }
    if (id != null) {
      out.id = id;
    }
    coerceClipCreatedAt(out);
    return out;
  });
}
