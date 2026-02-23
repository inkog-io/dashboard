import { NextRequest, NextResponse } from "next/server";
import { createGunzip } from "node:zlib";
import { pipeline } from "node:stream/promises";
import { Readable, PassThrough } from "node:stream";
import { extract, type Headers } from "tar-stream";
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

/**
 * Download and extract a GitHub repo tarball entirely in memory.
 * Uses GitHub's tarball API (no git binary needed).
 */
async function downloadAndExtractRepo(
  owner: string,
  repo: string
): Promise<{ path: string; content: Buffer }[]> {
  const tarballUrl = `https://api.github.com/repos/${owner}/${repo}/tarball`;

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

    // Validate URL
    const match = repo_url.match(REPO_URL_REGEX);
    if (!match) {
      return NextResponse.json(
        {
          error: "Invalid GitHub repository URL. Use format: https://github.com/owner/repo",
          code: "invalid_url",
        },
        { status: 400 }
      );
    }

    const owner = match[1];
    const repo = match[2];
    const repoName = `${owner}/${repo}`;

    // Rate limit by IP
    const ip = getClientIP(req);
    if (ip !== "unknown") {
      const recentCount = await countRecentScans(ip);
      if (recentCount >= RATE_LIMIT) {
        return NextResponse.json(
          {
            error: "Rate limit exceeded. Please try again later.",
            code: "rate_limited",
            retry_after: 3600,
          },
          { status: 429 }
        );
      }
    }

    // Check cache
    const cached = await findRecentScanByRepo(repoName);
    if (cached) {
      return NextResponse.json({
        report_id: cached.id,
        repo_name: cached.repo_name,
        scan_result: cached.scan_result,
        cached: true,
        scanned_at: cached.created_at,
      });
    }

    // Download repo tarball
    let files: { path: string; content: Buffer }[];
    try {
      files = await downloadAndExtractRepo(owner, repo) as { path: string; content: Buffer }[];
    } catch (err) {
      const msg = err instanceof Error ? err.message : "clone_failed";
      if (msg === "clone_failed") {
        return NextResponse.json(
          {
            error: "Repository not found or is private. Only public GitHub repositories are supported.",
            code: "clone_failed",
          },
          { status: 404 }
        );
      }
      throw err;
    }

    // Prioritize source code files over docs/config
    files = prioritizeFiles(files);

    if (files.length === 0) {
      return NextResponse.json(
        {
          error: "No scannable files found in repository.",
          code: "scan_failed",
        },
        { status: 400 }
      );
    }

    // Build FormData for backend scan
    const formData = new FormData();
    const requestMetadata = {
      contract_version: "v1",
      cli_version: "dashboard-plg-1.0.0",
      secrets_version: "",
      local_secrets_found: 0,
      redacted_file_count: 0,
      scan_policy: "comprehensive",
      agent_name: repoName,
    };
    formData.append("request", JSON.stringify(requestMetadata));

    for (const file of files) {
      const blob = new Blob([new Uint8Array(file.content)]);
      formData.append("files", blob, file.path);
    }

    // Send to backend
    const scanController = new AbortController();
    const scanTimeout = setTimeout(() => scanController.abort(), 180_000);

    let scanResponse: Response;
    try {
      scanResponse = await fetch(`${API_BASE_URL}/api/v1/scan`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${INKOG_API_KEY}`,
        },
        body: formData,
        signal: scanController.signal,
      });
    } finally {
      clearTimeout(scanTimeout);
    }

    if (!scanResponse.ok) {
      const errorText = await scanResponse.text().catch(() => "Unknown error");
      console.error("Backend scan failed:", scanResponse.status, errorText);
      return NextResponse.json(
        { error: "Scan failed. Please try again.", code: "scan_failed" },
        { status: 502 }
      );
    }

    const backendData =
      (await scanResponse.json()) as BackendScanResponse;
    const scanResult = transformScanResponse(backendData);

    // Persist to Postgres
    const { id: reportId } = await insertAnonymousScan(
      repo_url,
      repoName,
      scanResult,
      ip !== "unknown" ? ip : null
    );

    return NextResponse.json({
      report_id: reportId,
      repo_name: repoName,
      scan_result: scanResult,
      cached: false,
      scanned_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Public scan error:", err);
    return NextResponse.json(
      { error: "Internal server error", code: "scan_failed" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/scan-public?report_id=<uuid>
 *
 * Retrieve a previously generated scan report.
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

    const row = await getAnonymousScanById(reportId);
    if (!row) {
      return NextResponse.json(
        { error: "Report not found or expired", code: "not_found" },
        { status: 404 }
      );
    }

    // Defensive: handle double-serialized JSONB from older inserts
    const scanResult =
      typeof row.scan_result === "string"
        ? JSON.parse(row.scan_result)
        : row.scan_result;

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
