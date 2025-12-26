/**
 * Utility functions for downloading exported scan data
 */

/**
 * Download a Blob as a file
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Download data as a JSON file
 */
export function downloadJSON(data: unknown, filename: string): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  downloadBlob(blob, filename);
}

/**
 * Generate a filename for an export
 */
export function generateExportFilename(
  agentName: string | null | undefined,
  scanNumber: number | null | undefined,
  format: 'json' | 'sarif' | 'pdf'
): string {
  const safeName = (agentName || 'scan')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  const suffix = scanNumber ? `-${scanNumber}` : '';
  const extension = format === 'sarif' ? 'sarif' : format;

  return `inkog-${safeName}${suffix}.${extension}`;
}
