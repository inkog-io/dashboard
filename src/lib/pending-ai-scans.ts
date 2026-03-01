const STORAGE_KEY = "inkog-pending-ai-scans";
const MAX_AGE_MS = 4 * 60 * 60 * 1000; // 4 hours

export interface PendingAIScan {
  scanId: string;
  agentName: string;
  startedAt: string;
}

/** Read pending AI scans from localStorage, auto-pruning entries older than 4 hours. */
export function getPendingAIScans(): PendingAIScan[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: PendingAIScan[] = JSON.parse(raw);
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

/** Add a pending AI scan (deduplicates by scanId). */
export function addPendingAIScan(scan: PendingAIScan): void {
  const scans = getPendingAIScans();
  if (scans.some((s) => s.scanId === scan.scanId)) return;
  scans.push(scan);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(scans));
}

/** Remove a pending AI scan by scanId. */
export function removePendingAIScan(scanId: string): void {
  const scans = getPendingAIScans();
  const filtered = scans.filter((s) => s.scanId !== scanId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}
