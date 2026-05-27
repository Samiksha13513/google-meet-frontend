export type UserIdentity = {
  displayName: string;
  email?: string;
  image?: string;
};

export function getIdentityLabel(identity: {
  displayName?: string | null;
  email?: string | null;
}): string {
  return (
    identity.email?.trim() ||
    identity.displayName?.trim() ||
    "Signed-in user"
  );
}

function getTokenData(): { email?: string; name?: string } {
  try {
    const token = localStorage.getItem("authToken");
    const payload = token?.split(".")[1];
    if (!payload) return {};

    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const decoded = JSON.parse(atob(padded)) as {
      email?: string;
      name?: string;
    };

    return decoded;
  } catch {
    return {};
  }
}

function getEmailFromToken(): string | undefined {
  return getTokenData().email?.trim() || undefined;
}

function getNameFromToken(): string | undefined {
  return getTokenData().name?.trim() || undefined;
}

export function getCurrentUserIdentity(): UserIdentity {
  if (typeof window === "undefined") {
    return { displayName: "Signed-in user" };
  }

  try {
    const raw = localStorage.getItem("user");
    if (!raw) {
      // Fallback to JWT token data if user not in localStorage
      const tokenEmail = getEmailFromToken();
      const tokenName = getNameFromToken();
      const displayName = tokenName || tokenEmail || "Signed-in user";
      return { displayName, email: tokenEmail };
    }

    const user = JSON.parse(raw) as {
      name?: string | null;
      displayName?: string | null;
      email?: string | null;
      image?: string | null;
      picture?: string | null;
    };

    const email = user.email?.trim() || undefined;
    const nameFromStorage = user.name?.trim() || user.displayName?.trim();
    const tokenName = getNameFromToken();
    const displayName =
      nameFromStorage || tokenName || email || "Signed-in user";

    return {
      displayName,
      email,
      image: user.image || user.picture || undefined,
    };
  } catch {
    return { displayName: "Signed-in user" };
  }
}

export function getDisplayName(): string {
  return getCurrentUserIdentity().displayName;
}

export function getDisplayInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}
