export const googleLogin = () => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://google-meet-q33t.onrender.com";

  window.location.href = `${apiUrl}/auth/google`;
};
