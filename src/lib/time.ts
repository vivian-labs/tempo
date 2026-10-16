export function parseDuration(input: string): number | null {
  const text = input.trim();
  if (!/^\d{1,4}(?::\d{1,2}){0,2}$/.test(text)) return null;
  const parts = text.split(':').map(Number);
  if (parts.slice(1).some((x) => x > 59)) return null;
  const sec =
    parts.length === 1
      ? parts[0] * 60
      : parts.length === 2
        ? parts[0] * 60 + parts[1]
        : parts[0] * 3600 + parts[1] * 60 + parts[2];
  return sec > 0 && sec <= 86400 ? sec * 1000 : null;
}
export const pad = (value: number) => String(value).padStart(2, '0');
export function durationParts(ms: number): [string, string, string] {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return [pad(Math.floor(s / 3600)), pad(Math.floor(s / 60) % 60), pad(s % 60)];
}
export function formatDuration(ms: number): string {
  const p = durationParts(ms);
  return ms >= 3600000 ? p.join(':') : p.slice(1).join(':');
}
export function scaleMinutes(ms: number): number {
  return ms <= 3600000 ? 60 : ms <= 7200000 ? 120 : ms <= 21600000 ? 360 : 1440;
}
export function sectorPath(ratio: number, r = 244): string {
  if (ratio <= 0) return '';
  if (ratio >= 1)
    return `M300 ${300 - r} A${r} ${r} 0 1 1 299.999 ${300 - r} Z`;
  const a = ratio * 2 * Math.PI;
  return `M300 300 L300 ${300 - r} A${r} ${r} 0 ${ratio > 0.5 ? 1 : 0} 1 ${300 + Math.sin(a) * r} ${300 - Math.cos(a) * r} Z`;
}
export function durationFromPointer(
  x: number,
  y: number,
  scale: number,
): number {
  let a = Math.atan2(x, -y);
  if (a < 0) a += Math.PI * 2;
  return Math.max(
    15000,
    Math.round(((a / (2 * Math.PI)) * scale * 60000) / 15000) * 15000,
  );
}
