import type { UserIdentity } from "./display-name";

const GUEST_NAME_KEY = "meet_guest_display_name";

export function saveGuestDisplayName(name: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(GUEST_NAME_KEY, name.trim());
}

export function loadGuestDisplayName(): string {
  if (typeof window === "undefined") return "";
  return sessionStorage.getItem(GUEST_NAME_KEY) || "";
}

export function clearGuestDisplayName(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(GUEST_NAME_KEY);
}

export function persistMeetingIdentity(
  identity: UserIdentity & { isGuest: boolean }
): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(
    "meet_session_identity",
    JSON.stringify({
      displayName: identity.displayName,
      email: identity.email,
      image: identity.image,
      isGuest: identity.isGuest,
      savedAt: Date.now(),
    })
  );
  if (identity.isGuest) {
    saveGuestDisplayName(identity.displayName);
  }
}

export function loadMeetingIdentity():
  | (UserIdentity & { isGuest: boolean })
  | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem("meet_session_identity");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UserIdentity & {
      isGuest: boolean;
      savedAt?: number;
    };
    return parsed;
  } catch {
    return null;
  }
}
