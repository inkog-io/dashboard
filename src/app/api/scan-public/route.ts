import { NextRequest, NextResponse } from "next/server";
import { createGunzip } from "node:zlib";
import { pipeline } from "node:stream/promises";
import { Readable, PassThrough } from "node:stream";
import { extract, type Headers } from "tar-stream";
import { auth } from "@clerk/nextjs/server";
import {
  insertAnonymousScan,
  getAnonymousScanById,
  findRecentScanByRepo,
  claimScan,
  countRecentScans,
} from "@/lib/db";
import {
  transformScanResponse,
  type BackendScanResponse,
} from "@/lib/api";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://api.inkog.io";
const INKOG_API_KEY = process.env.INKOG_API_KEY!;

const REPO_URL_REGEX =
  /^https?:\/\/github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)\/?$/;

const ALLOWED_EXTENSIONS = new Set([
  ".py",
  ".ts",
  ".js",
  ".jsx",
  ".tsx",
  ".go",
  ".java",
  ".rb",
  ".json",
  ".yaml",
  ".yml",
  ".md",
]);

const MAX_FILES = 100;
const MAX_EXTRACT_FILES = 500; // Extract more, then prioritize
const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1MB per file
const MAX_TOTAL_SIZE = 50 * 1024 * 1024; // 50MB total
const RATE_LIMIT = 5; // per IP per hour

// Source code extensions get priority over docs/config
const SOURCE_EXTENSIONS = new Set([
  ".py", ".ts", ".js", ".jsx", ".tsx", ".go", ".java", ".rb",
]);

function getClientIP(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

function hasAllowedExtension(filePath: string): boolean {
  const ext = filePath.substring(filePath.lastIndexOf("."));
  return ALLOWED_EXTENSIONS.has(ext.toLowerCase());
}

function isSourceCode(filePath: string): boolean {
  const ext = filePath.substring(filePath.lastIndexOf("."));
  return SOURCE_EXTENSIONS.has(ext.toLowerCase());
}

/**
 * Prioritize source code files over docs/config, skip test/vendor dirs.
 * Returns up to MAX_FILES files, source code first.
 */
function prioritizeFiles(
  files: { path: string; content: Buffer }[]
): { path: string; content: Buffer }[] {
  // Skip common non-essential directories
  const skipDirs = /^(\.github\/|\.circleci\/|\.vscode\/|docs\/|examples\/|__pycache__\/|node_modules\/|vendor\/|\.claude\/)/i;
  const filtered = files.filter((f) => !skipDirs.test(f.path));

  const source = filtered.filter((f) => isSourceCode(f.path));
  const config = filtered.filter((f) => !isSourceCode(f.path));

  // Source code first, then config/docs to fill remaining slots
  const result = [...source, ...config].slice(0, MAX_FILES);
  return result;
}

function isBinaryBuffer(buf: Buffer): boolean {
  // Check first 512 bytes for null bytes (binary indicator)
  const checkLen = Math.min(buf.length, 512);
  for (let i = 0; i < checkLen; i++) {
    if (buf[i] === 0) return true;
  }
  return false;
}

interface RepoMetadata {
  default_branch: string;
  stargazers_count: number;
  description: string | null;
  language: string | null;
}

/**
 * Fetch repository metadata from GitHub REST API.
 * Returns metadata or null if the repo doesn't exist / is private.
 */
async function fetchRepoMetadata(
  owner: string,
  repo: string
): Promise<RepoMetadata | null> {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "inkog-plg-scanner/1.0",
    },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return {
    default_branch: data.default_branch ?? "main",
    stargazers_count: data.stargazers_count ?? 0,
    description: data.description ?? null,
    language: data.language ?? null,
  };
}

/**
 * Download and extract a GitHub repo tarball entirely in memory.
 * Uses GitHub's tarball API (no git binary needed).
 */
async function downloadAndExtractRepo(
  owner: string,
  repo: string,
  branch?: string
): Promise<{ path: string; content: Buffer }[]> {
  const tarballUrl = branch
    ? `https://api.github.com/repos/${owner}/${repo}/tarball/${branch}`
    : `https://api.github.com/repos/${owner}/${repo}/tarball`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);

  let response: Response;
  try {
    response = await fetch(tarballUrl, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "inkog-plg-scanner/1.0",
      },
      signal: controller.signal,
      redirect: "follow",
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(
      response.status === 404
        ? "clone_failed"
        : `GitHub API error: ${response.status}`
    );
  }

  if (!response.body) {
    throw new Error("Empty response body from GitHub");
  }

  const files: { path: string; content: Buffer }[] = [];
  let totalSize = 0;

  const tarExtract = extract();

  return new Promise((resolve, reject) => {
    tarExtract.on(
      "entry",
      (header: Headers, stream: NodeJS.ReadableStream, next: () => void) => {
        // Strip the top-level directory GitHub adds (e.g., "owner-repo-sha/")
        const fullPath = header.name || "";
        const slashIdx = fullPath.indexOf("/");
        const relativePath =
          slashIdx >= 0 ? fullPath.substring(slashIdx + 1) : fullPath;

        const skip =
          header.type !== "file" ||
          !relativePath ||
          !hasAllowedExtension(relativePath) ||
          (header.size ?? 0) > MAX_FILE_SIZE ||
          files.length >= MAX_EXTRACT_FILES ||
          totalSize >= MAX_TOTAL_SIZE;

        if (skip) {
          stream.resume();
          next();
          return;
        }

        const chunks: Buffer[] = [];
        let entrySize = 0;

        stream.on("data", (chunk: Buffer) => {
          entrySize += chunk.length;
          if (entrySize <= MAX_FILE_SIZE && totalSize + entrySize <= MAX_TOTAL_SIZE) {
            chunks.push(chunk);
          }
        });

        stream.on("end", () => {
          if (entrySize <= MAX_FILE_SIZE && totalSize + entrySize <= MAX_TOTAL_SIZE) {
            const content = Buffer.concat(chunks);
            if (!isBinaryBuffer(content)) {
              files.push({ path: relativePath, content });
              totalSize += content.length;
            }
          }
          next();
        });

        stream.on("error", next);
      }
    );

    tarExtract.on("finish", () => resolve(files));
    tarExtract.on("error", reject);

    // Convert web ReadableStream → Node Readable → gunzip → tar extract
    const nodeStream = Readable.fromWeb(
      response.body as import("node:stream/web").ReadableStream
    );
    const gunzip = createGunzip();

    nodeStream.pipe(gunzip).pipe(tarExtract);

    gunzip.on("error", reject);
    nodeStream.on("error", reject);
  });
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MIN_CONFIDENCE = 0.5;
const MAX_REMEDIATION_STEPS = 3;

/** Result type for the reusable scan pipeline */
export type ScanPipelineResult =
  | { ok: true; report_id: string; repo_name: string; scan_result: ReturnType<typeof transformScanResponse>; cached: boolean; scanned_at: string }
  | { ok: false; error: string; code: string; status: number };

/**
 * Core scan pipeline — reusable by both the POST handler and the cron job.
 * Validates the repo, downloads tarball, scans via backend, persists to Postgres.
 */
export async function executeScanPipeline(
  repoUrl: string,
  ipAddress: string | null
): Promise<ScanPipelineResult> {
  const match = repoUrl.match(REPO_URL_REGEX);
  if (!match) {
    return { ok: false, error: "Invalid GitHub repository URL", code: "invalid_url", status: 400 };
  }

  const owner = match[1];
  const repo = match[2];
  const repoName = `${owner}/${repo}`;

  // Check cache
  const cached = await findRecentScanByRepo(repoName);
  if (cached) {
    return {
      ok: true,
      report_id: cached.id,
      repo_name: cached.repo_name,
      scan_result: cached.scan_result as ReturnType<typeof transformScanResponse>,
      cached: true,
      scanned_at: cached.created_at,
    };
  }

  // Fetch repo metadata (validates existence + gets default branch)
  const repoMeta = await fetchRepoMetadata(owner, repo);
  if (!repoMeta) {
    return { ok: false, error: "Repository not found or private. Only public GitHub repositories are supported.", code: "clone_failed", status: 400 };
  }

  // Download repo tarball using explicit default branch
  let files: { path: string; content: Buffer }[];
  try {
    files = await downloadAndExtractRepo(owner, repo, repoMeta.default_branch) as { path: string; content: Buffer }[];
  } catch (err) {
    const msg = err instanceof Error ? err.message : "clone_failed";
    if (msg === "clone_failed") {
      return { ok: false, error: "Repository not found or is private.", code: "clone_failed", status: 404 };
    }
    throw err;
  }

  files = prioritizeFiles(files);

  if (files.length === 0) {
    return { ok: false, error: "No scannable files found in repository.", code: "scan_failed", status: 400 };
  }

  // Build FormData for backend scan
  const formData = new FormData();
  formData.append("request", JSON.stringify({
    contract_version: "v1",
    cli_version: "dashboard-plg-1.0.0",
    secrets_version: "",
    local_secrets_found: 0,
    redacted_file_count: 0,
    scan_policy: "comprehensive",
    agent_name: repoName,
  }));

  for (const file of files) {
    formData.append("files", new Blob([new Uint8Array(file.content)]), file.path);
  }

  // Send to backend
  const scanController = new AbortController();
  const scanTimeout = setTimeout(() => scanController.abort(), 180_000);

  let scanResponse: Response;
  try {
    scanResponse = await fetch(`${API_BASE_URL}/api/v1/scan`, {
      method: "POST",
      headers: { Authorization: `Bearer ${INKOG_API_KEY}` },
      body: formData,
      signal: scanController.signal,
    });
  } finally {
    clearTimeout(scanTimeout);
  }

  if (!scanResponse.ok) {
    const errorText = await scanResponse.text().catch(() => "Unknown error");
    console.error("Backend scan failed:", scanResponse.status, errorText);
    const isTimeout = scanResponse.status === 504 || scanResponse.status === 408;
    return {
      ok: false,
      error: isTimeout
        ? "This repository is too large to scan in the browser. Use the CLI for large repos."
        : "Scan failed. Please try again.",
      code: isTimeout ? "repo_too_large" : "scan_failed",
      status: 502,
    };
  }

  const backendData = (await scanResponse.json()) as BackendScanResponse;
  const scanResult = transformScanResponse(backendData);

  // Attach repo metadata
  scanResult.repo_info = {
    stargazers_count: repoMeta.stargazers_count,
    default_branch: repoMeta.default_branch,
    description: repoMeta.description,
    language: repoMeta.language,
  };

  // Quality filters: drop low-confidence noise, trim remediation steps
  polishFindings(scanResult);

  // Persist to Postgres
  const { id: reportId } = await insertAnonymousScan(
    repoUrl,
    repoName,
    scanResult,
    ipAddress
  );

  return {
    ok: true,
    report_id: reportId,
    repo_name: repoName,
    scan_result: scanResult,
    cached: false,
    scanned_at: new Date().toISOString(),
  };
}

/**
 * Filter low-confidence findings and trim remediation steps for PLG quality.
 * Mutates scanResult in place.
 */
function polishFindings(scanResult: ReturnType<typeof transformScanResponse>) {
  if (!Array.isArray(scanResult.findings)) return;

  // Drop findings below confidence threshold
  scanResult.findings = scanResult.findings.filter(
    (f) => (f.confidence ?? 1) >= MIN_CONFIDENCE
  );

  // Trim remediation steps to top N
  for (const f of scanResult.findings) {
    if (f.remediation_steps && f.remediation_steps.length > MAX_REMEDIATION_STEPS) {
      f.remediation_steps = f.remediation_steps.slice(0, MAX_REMEDIATION_STEPS);
    }
  }

  // Recompute counts after filtering
  scanResult.findings_count = scanResult.findings.length;
  scanResult.critical_count = scanResult.findings.filter((f) => f.severity === "CRITICAL").length;
  scanResult.high_count = scanResult.findings.filter((f) => f.severity === "HIGH").length;
  scanResult.medium_count = scanResult.findings.filter((f) => f.severity === "MEDIUM").length;
  scanResult.low_count = scanResult.findings.filter((f) => f.severity === "LOW").length;
}

/**
 * POST /api/scan-public
 *
 * Body: { repo_url } → scan repo → return { report_id, scan_result }
 * Body: { report_id, user_id } → claim existing report
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Handle claim request
    if (body.report_id && body.user_id) {
      await claimScan(body.report_id, body.user_id);
      return NextResponse.json({ success: true });
    }

    const { repo_url } = body;
    if (!repo_url || typeof repo_url !== "string") {
      return NextResponse.json(
        { error: "Missing repo_url", code: "invalid_url" },
        { status: 400 }
      );
    }

    const match = repo_url.match(REPO_URL_REGEX);
    if (!match) {
      return NextResponse.json(
        { error: "Invalid GitHub repository URL. Use format: https://github.com/owner/repo", code: "invalid_url" },
        { status: 400 }
      );
    }

    // Rate limit by IP
    const ip = getClientIP(req);
    if (ip !== "unknown") {
      const recentCount = await countRecentScans(ip);
      if (recentCount >= RATE_LIMIT) {
        return NextResponse.json(
          { error: "Rate limit exceeded. Please try again later.", code: "rate_limited", retry_after: 3600 },
          { status: 429 }
        );
      }
    }

    const result = await executeScanPipeline(repo_url, ip !== "unknown" ? ip : null);

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, code: result.code },
        { status: result.status }
      );
    }

    return NextResponse.json({
      report_id: result.report_id,
      repo_name: result.repo_name,
      scan_result: result.scan_result,
      cached: result.cached,
      scanned_at: result.scanned_at,
    });
  } catch (err) {
    console.error("Public scan error:", err);
    return NextResponse.json(
      { error: "Internal server error", code: "scan_failed" },
      { status: 500 }
    );
  }
}

/** Number of findings returned with full detail to unauthenticated users */
const UNGATED_FINDING_COUNT = 3;

const SEVERITY_ORDER: Record<string, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

/**
 * GET /api/scan-public?report_id=<uuid>
 *
 * Retrieve a previously generated scan report.
 *
 * Authenticated users (valid Clerk session) receive all findings with full
 * detail. Unauthenticated users receive the top N findings with full detail
 * and the remaining findings as summary-only objects (severity, pattern_id,
 * finding_type, confidence — no file path, code snippet, message, or
 * compliance mapping). This prevents client-side paywall bypass via DevTools.
 */
export async function GET(req: NextRequest) {
  try {
    const reportId = req.nextUrl.searchParams.get("report_id");
    if (!reportId) {
      return NextResponse.json(
        { error: "Missing report_id parameter", code: "invalid_url" },
        { status: 400 }
      );
    }

    if (!UUID_REGEX.test(reportId)) {
      return NextResponse.json(
        { error: "Invalid report ID format", code: "invalid_url" },
        { status: 400 }
      );
    }

    const row = await getAnonymousScanById(reportId);
    if (!row) {
      return NextResponse.json(
        { error: "Report not found or expired", code: "not_found" },
        { status: 404 }
      );
    }

    // Check Clerk auth — returns userId if signed in, null otherwise
    const { userId } = auth();
    const isAuthenticated = !!userId;

    // Defensive: handle double-serialized JSONB from older inserts
    const scanResult =
      typeof row.scan_result === "string"
        ? JSON.parse(row.scan_result)
        : row.scan_result;

    // Server-side finding gating for unauthenticated users
    if (!isAuthenticated && Array.isArray(scanResult.findings)) {
      // Sort by severity (CRITICAL first), then confidence desc
      const sorted = [...scanResult.findings].sort(
        (a: { severity: string; confidence?: number }, b: { severity: string; confidence?: number }) => {
          const sevDiff =
            (SEVERITY_ORDER[a.severity] ?? 4) -
            (SEVERITY_ORDER[b.severity] ?? 4);
          if (sevDiff !== 0) return sevDiff;
          return (b.confidence ?? 0) - (a.confidence ?? 0);
        }
      );

      // Full detail for top N findings
      const ungated = sorted.slice(0, UNGATED_FINDING_COUNT);

      // Summary-only for the rest — strip all sensitive detail
      const gated = sorted.slice(UNGATED_FINDING_COUNT).map(
        (f: {
          id: string;
          severity: string;
          pattern_id: string;
          finding_type?: string;
          confidence?: number;
          governance_category?: string;
          display_title?: string;
          fix_difficulty?: string;
        }) => ({
          id: f.id,
          severity: f.severity,
          pattern_id: f.pattern_id,
          finding_type: f.finding_type,
          confidence: f.confidence,
          governance_category: f.governance_category,
          display_title: f.display_title,
          fix_difficulty: f.fix_difficulty,
          // All detail fields explicitly omitted:
          // file, line, message, code_snippet, compliance_mapping, remediation, etc.
        })
      );

      scanResult.findings = ungated;
      scanResult.gated_findings = gated;
    }

    return NextResponse.json({
      report_id: row.id,
      repo_name: row.repo_name,
      repo_url: row.repo_url,
      scan_result: scanResult,
      scanned_at: row.created_at,
      claimed: !!row.claimed_by_user_id,
    });
  } catch (err) {
    console.error("Report fetch error:", err);
    return NextResponse.json(
      { error: "Internal server error", code: "scan_failed" },
      { status: 500 }
    );
  }
}
