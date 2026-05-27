function getApiUrl() {
  return (
    process.env.NEXT_PUBLIC_API_URL ||
    (typeof window !== "undefined"
      ? window.location.origin
      : "https://google-meet-q33t.onrender.com")
  );
}

/**
 * Google OAuth — optional returnTo path after sign-in (e.g. /meeting/abc-def-ghi).
 */
export const googleLogin = (returnTo?: string) => {
  const apiUrl = getApiUrl();
  const path =
    returnTo ||
    (typeof window !== "undefined" ? window.location.pathname : "/dashboard");
  const query = new URLSearchParams({ returnTo: path });
  window.location.href = `${apiUrl}/auth/google?${query.toString()}`;
};

export const googleCalendarLogin = (returnTo?: string) => {
  const apiUrl = getApiUrl();
  const params = returnTo
    ? `?returnTo=${encodeURIComponent(returnTo)}`
    : "";
  window.location.href = `${apiUrl}/auth/google/calendar${params}`;
};
