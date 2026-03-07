/**
 * Read a CSS custom property as an HSL color string.
 * Falls back to the provided default during SSR or if the variable is unset.
 */
export function getCSSColor(varName: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  const val = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return val ? `hsl(${val})` : fallback;
}
