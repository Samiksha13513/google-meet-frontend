export function hasValidAuthToken() {
  if (typeof window === "undefined") return false;

  const token = localStorage.getItem("authToken");
  if (!token) return false;

  try {
    const payload = JSON.parse(atob(token.split(".")[1] || ""));
    if (typeof payload?.exp !== "number") return true;
    return payload.exp * 1000 > Date.now();
  } catch {
    return true;
  }
}
