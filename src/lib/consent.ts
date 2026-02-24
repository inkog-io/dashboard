const CONSENT_KEY = 'inkog_consent';
const CONSENT_VERSION = 1;

interface ConsentRecord {
  status: 'accepted' | 'declined';
  timestamp: string;
  version: number;
}

export function getConsent(): ConsentRecord | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const record: ConsentRecord = JSON.parse(raw);
    if (record.version !== CONSENT_VERSION) return null;
    return record;
  } catch {
    return null;
  }
}

export function setConsent(status: 'accepted' | 'declined'): void {
  const record: ConsentRecord = {
    status,
    timestamp: new Date().toISOString(),
    version: CONSENT_VERSION,
  };
  localStorage.setItem(CONSENT_KEY, JSON.stringify(record));
}

export function hasConsented(): boolean {
  return getConsent()?.status === 'accepted';
}

export function hasMadeChoice(): boolean {
  return getConsent() !== null;
}

export function revokeConsent(): void {
  localStorage.removeItem(CONSENT_KEY);
  const ph = (window as unknown as Record<string, unknown>).posthog as
    | { opt_out_capturing?: () => void }
    | undefined;
  ph?.opt_out_capturing?.();
  window.location.reload();
}
