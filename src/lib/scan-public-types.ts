import type { ScanResult } from "@/lib/api";

export interface PublicScanRequest {
  repo_url: string;
}

export interface PublicScanResponse {
  report_id: string;
  repo_name: string;
  scan_result: ScanResult;
  cached: boolean;
  scanned_at: string;
}

export interface PublicScanError {
  error: string;
  code:
    | "invalid_url"
    | "rate_limited"
    | "clone_failed"
    | "scan_failed"
    | "not_found";
  retry_after?: number;
}

export interface ClaimRequest {
  report_id: string;
  user_id: string;
}
