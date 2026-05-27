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
    identity.displayName?.trim() ||
    identity.email?.trim() ||
    "Signed-in user"
  );
}

export function getIdentitySecondary(identity: {
  displayName?: string | null;
  email?: string | null;
}): string | undefined {
  return identity.email?.trim() || undefined;
}

function getEmailFromToken(): string | undefined {
  try {
    const token = localStorage.getItem("authToken");
    const payload = token?.split(".")[1];
    if (!payload) return undefined;

    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const decoded = JSON.parse(atob(padded)) as {
      email?: string;
    };

    return decoded.email?.trim() || undefined;
  } catch {
    return undefined;
  }
}

export function getCurrentUserIdentity(): UserIdentity {
  if (typeof window === "undefined") {
    return { displayName: "Signed-in user" };
  }

  try {
    const raw = localStorage.getItem("user");
    if (!raw) {
      const email = getEmailFromToken();
      return { displayName: email || "Signed-in user", email };
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
      user.name?.trim() || user.displayName?.trim() || email || "Signed-in user";

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
