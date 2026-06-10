const MEET_AVATAR_COLORS = [
  "#8e24aa",
  "#e8710a",
  "#1a73e8",
  "#0b8043",
  "#d50000",
  "#039be5",
  "#7b1fa2",
] as const;

export function getAvatarColor(name: string): string {
  const label = name.trim() || "?";
  let hash = 0;
  for (let i = 0; i < label.length; i += 1) {
    hash = label.charCodeAt(i) + ((hash << 5) - hash);
  }
  return MEET_AVATAR_COLORS[Math.abs(hash) % MEET_AVATAR_COLORS.length];
}
