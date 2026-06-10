export function buildMeetingLink(code: string, origin?: string): string {
  const trimmed = code.trim();
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/${encodeURIComponent(trimmed)}`;
}
