export const googleLogin = (returnTo?: string) => {
  const apiUrl =
    process.env.NEXT_PUBLIC_API_URL ||
    (typeof window !== 'undefined' ? window.location.origin : 'https://google-meet-q33t.onrender.com');

  if (typeof window !== "undefined" && returnTo) {
    localStorage.setItem("authReturnTo", returnTo);
  }

  window.location.href = `${apiUrl}/auth/google`;
};
