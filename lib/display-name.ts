export type UserIdentity = {
  displayName: string;
  email?: string;
  image?: string;
};

export function getCurrentUserIdentity(): UserIdentity {
  if (typeof window === "undefined") {
    return { displayName: "Guest" };
  }

  try {
    const raw = localStorage.getItem("user");
    if (!raw) return { displayName: "Guest" };

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
      email ||
      "Guest";

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

export function getDisplayInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}
