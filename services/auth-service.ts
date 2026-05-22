import { apiFetch } from "@/services/http";

type AuthResponse = {
  success: boolean;
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    name?: string | null;
    email: string;
    image?: string | null;
  };
};

function persistSession(session: AuthResponse) {
  localStorage.setItem("authToken", session.accessToken);
  localStorage.setItem("refreshToken", session.refreshToken);
  localStorage.setItem("user", JSON.stringify(session.user));
}

export async function loginWithEmail(input: { email: string; password: string }) {
  const session = await apiFetch<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
  persistSession(session);
  return session;
}

export async function registerWithEmail(input: {
  name?: string;
  email: string;
  password: string;
}) {
  const session = await apiFetch<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
  persistSession(session);
  return session;
}

export async function logout() {
  const refreshToken = localStorage.getItem("refreshToken");
  await apiFetch("/auth/logout", {
    method: "POST",
    body: JSON.stringify({ refreshToken }),
  }).catch(() => undefined);
  localStorage.removeItem("authToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("user");
}
