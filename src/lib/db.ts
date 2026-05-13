import postgres, { type JSONValue, type Sql } from "postgres";

// Lazy-initialize: don't crash at import time if DATABASE_URL is missing (build phase)
let _sql: Sql | null = null;

function getSql(): Sql {
  if (!_sql) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error("DATABASE_URL environment variable is not set");
    }
    const useSSL = !databaseUrl.includes("sslmode=disable");
    _sql = postgres(databaseUrl, {
      max: 5,
      idle_timeout: 20,
      connect_timeout: 10,
      ssl: useSSL ? { rejectUnauthorized: false } : false,
    });
  }
  return _sql;
}

// Auto-create table (idempotent)
let initialized = false;
async function ensureSchema() {
  if (initialized) return;
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS anonymous_scans (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      repo_url TEXT NOT NULL,
      repo_name TEXT NOT NULL,
      scan_result JSONB NOT NULL,
      ip_address TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days',
      claimed_by_user_id TEXT,
      claimed_at TIMESTAMPTZ,
      access_count INT DEFAULT 0,
      last_accessed_at TIMESTAMPTZ
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_anonymous_scans_repo_name
    ON anonymous_scans (repo_name, created_at DESC)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_anonymous_scans_ip_rate
    ON anonymous_scans (ip_address, created_at)
  `;
  // Add deep_scan_id column for async deep scan tracking
  await sql`
    ALTER TABLE anonymous_scans ADD COLUMN IF NOT EXISTS deep_scan_id TEXT
  `;
  initialized = true;
}

export async function insertAnonymousScan(
  repoUrl: string,
  repoName: string,
  scanResult: object,
  ipAddress: string | null
): Promise<{ id: string }> {
  await ensureSchema();
  const sql = getSql();
  const [row] = await sql`
    INSERT INTO anonymous_scans (repo_url, repo_name, scan_result, ip_address)
    VALUES (${repoUrl}, ${repoName}, ${sql.json(scanResult as JSONValue)}, ${ipAddress})
    RETURNING id
  `;
  return { id: row.id };
}

export async function getAnonymousScanById(id: string) {
  await ensureSchema();
  const sql = getSql();
  const [row] = await sql`
    SELECT id, repo_url, repo_name, scan_result, created_at, claimed_by_user_id, deep_scan_id
    FROM anonymous_scans
    WHERE id = ${id} AND expires_at > NOW()
  `;
  if (row) {
    // Increment access count
    await sql`
      UPDATE anonymous_scans
      SET access_count = access_count + 1, last_accessed_at = NOW()
      WHERE id = ${id}
    `;
  }
  return row ?? null;
}

export async function findRecentScanByRepo(repoName: string) {
  await ensureSchema();
  const sql = getSql();
  const [row] = await sql`
    SELECT id, repo_url, repo_name, scan_result, created_at, deep_scan_id
    FROM anonymous_scans
    WHERE repo_name = ${repoName}
      AND expires_at > NOW()
      AND created_at > NOW() - CASE
        WHEN deep_scan_id IS NOT NULL THEN INTERVAL '24 hours'
        ELSE INTERVAL '1 hour'
      END
    ORDER BY created_at DESC
    LIMIT 1
  `;
  return row ?? null;
}

export async function claimScan(id: string, userId: string) {
  await ensureSchema();
  const sql = getSql();
  await sql`
    UPDATE anonymous_scans
    SET claimed_by_user_id = ${userId}, claimed_at = NOW()
    WHERE id = ${id}
  `;
}

export async function updateDeepScanId(reportId: string, deepScanId: string) {
  await ensureSchema();
  const sql = getSql();
  await sql`
    UPDATE anonymous_scans
    SET deep_scan_id = ${deepScanId}
    WHERE id = ${reportId}
  `;
}

export async function countRecentScans(ipAddress: string): Promise<number> {
  await ensureSchema();
  const sql = getSql();
  const [row] = await sql`
    SELECT COUNT(*)::int AS count
    FROM anonymous_scans
    WHERE ip_address = ${ipAddress}
      AND created_at > NOW() - INTERVAL '1 hour'
  `;
  return row.count;
}

export async function getTotalScanCount(): Promise<number> {
  await ensureSchema();
  const sql = getSql();
  const [row] = await sql`
    SELECT COUNT(*)::int AS count FROM anonymous_scans
  `;
  return row.count;
}

export interface PublicStats {
  total_scans: number;
  scans_with_findings: number;
  scans_with_critical: number;
  critical_pct: number;
  median_duration_s: number | null;
  total_findings: number;
  findings_by_severity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  generated_at: string;
}

export async function getPublicStats(): Promise<PublicStats> {
  await ensureSchema();
  const sql = getSql();
  const [r] = await sql`
    SELECT
      count(*)::bigint AS total_scans,
      count(*) FILTER (WHERE (scan_result->>'findings_count')::int > 0)::bigint AS scans_with_findings,
      count(*) FILTER (WHERE (scan_result->>'critical_count')::int > 0)::bigint AS scans_with_critical,
      sum((scan_result->>'critical_count')::int)::bigint AS sum_critical,
      sum((scan_result->>'findings_count')::int)::bigint AS sum_findings,
      sum((scan_result->>'high_count')::int)::bigint AS sum_high,
      sum((scan_result->>'medium_count')::int)::bigint AS sum_medium,
      sum((scan_result->>'low_count')::int)::bigint AS sum_low,
      percentile_cont(0.5) WITHIN GROUP (
        ORDER BY nullif(regexp_replace(scan_result->>'scan_duration', '[^0-9.]', '', 'g'), '')::float
      ) AS median_duration
    FROM anonymous_scans
    WHERE created_at > now() - interval '90 days'
  `;

  const totalScans = Number(r.total_scans);
  const scansWithCritical = Number(r.scans_with_critical);

  return {
    total_scans: totalScans,
    scans_with_findings: Number(r.scans_with_findings),
    scans_with_critical: scansWithCritical,
    critical_pct: totalScans > 0 ? Math.round((scansWithCritical / totalScans) * 100) : 0,
    median_duration_s: r.median_duration != null ? Number(r.median_duration) / 1000 : null,
    total_findings: Number(r.sum_findings ?? 0),
    findings_by_severity: {
      critical: Number(r.sum_critical ?? 0),
      high: Number(r.sum_high ?? 0),
      medium: Number(r.sum_medium ?? 0),
      low: Number(r.sum_low ?? 0),
    },
    generated_at: new Date().toISOString(),
  };
}

export default getSql;
