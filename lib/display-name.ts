export type UserIdentity = {
  displayName: string;
  email?: string;
  image?: string;
};

/** Visible name on video tiles and overlays (never prefer email). */
export function getParticipantName(identity: {
  displayName?: string | null;
  email?: string | null;
}): string {
  const name = identity.displayName?.trim();
  if (name) return name;
  if (identity.email?.trim()) {
    return identity.email.split("@")[0];
  }
  return "Guest";
}

/** @deprecated Use getParticipantName for UI labels */
export function getIdentityLabel(identity: {
  displayName?: string | null;
  email?: string | null;
}): string {
  return getParticipantName(identity);
}

function getEmailFromToken(): string | undefined {
  try {
    const token = localStorage.getItem("authToken");
    const payload = token?.split(".")[1];
    if (!payload) return undefined;

    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      "="
    );
    const decoded = JSON.parse(atob(padded)) as { email?: string };
    return decoded.email?.trim() || undefined;
  } catch {
    return undefined;
  }
}

export function getCurrentUserIdentity(): UserIdentity {
  if (typeof window === "undefined") {
    return { displayName: "Guest" };
  }

  try {
    const raw = localStorage.getItem("user");
    if (!raw) {
      const email = getEmailFromToken();
      return {
        displayName: email ? email.split("@")[0] : "Guest",
        email,
      };
    }

    const user = JSON.parse(raw) as {
      name?: string | null;
      displayName?: string | null;
      email?: string | null;
      image?: string | null;
      picture?: string | null;
    };

    const email = user.email?.trim() || undefined;
    const displayName =
      user.name?.trim() ||
      user.displayName?.trim() ||
      (email ? email.split("@")[0] : "Guest");

    return {
      displayName,
      email,
      image: user.image || user.picture || undefined,
    };
  } catch {
    return { displayName: "Guest" };
  }
}

export function getDisplayName(): string {
  return getCurrentUserIdentity().displayName;
}

export function getDisplayInitial(label: string): string {
  return label.trim().charAt(0).toUpperCase() || "?";
}

export function isUserAuthenticated(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(localStorage.getItem("authToken"));
}
