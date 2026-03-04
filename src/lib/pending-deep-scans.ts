const STORAGE_KEY = "inkog-pending-deep-scans";
const MAX_AGE_MS = 4 * 60 * 60 * 1000; // 4 hours

export interface PendingDeepScan {
  scanId: string;
  agentName: string;
  startedAt: string;
}

/** Read pending deep scans from localStorage, auto-pruning entries older than 4 hours. */
export function getPendingDeepScans(): PendingDeepScan[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: PendingDeepScan[] = JSON.parse(raw);
    const now = Date.now();
    const fresh = parsed.filter(
      (s) => now - new Date(s.startedAt).getTime() < MAX_AGE_MS
    );
    // Persist pruned list if anything was removed
    if (fresh.length !== parsed.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
    }
    return fresh;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return [];
  }
}

/** Add a pending deep scan (deduplicates by scanId). */
export function addPendingDeepScan(scan: PendingDeepScan): void {
  const scans = getPendingDeepScans();
  if (scans.some((s) => s.scanId === scan.scanId)) return;
  scans.push(scan);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(scans));
}

/** Remove a pending deep scan by scanId. */
export function removePendingDeepScan(scanId: string): void {
  const scans = getPendingDeepScans();
  const filtered = scans.filter((s) => s.scanId !== scanId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}
