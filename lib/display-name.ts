export function getDisplayName(): string {
  if (typeof window === "undefined") return "Guest";

  try {
    const raw = localStorage.getItem("user");
    if (!raw) return "Guest";

    const user = JSON.parse(raw) as {
      name?: string;
      displayName?: string;
      email?: string;
    };

    return (
      user.name ||
      user.displayName ||
      user.email?.split("@")[0] ||
      "Guest"
    );
  } catch {
    return "Guest";
  }
}

export function getDisplayInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}
