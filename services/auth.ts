export const googleLogin = () => {
  const apiUrl =
    process.env.NEXT_PUBLIC_API_URL ||
    (typeof window !== 'undefined' ? window.location.origin : 'https://google-meet-q33t.onrender.com');

  window.location.href = `${apiUrl}/auth/google`;
};
