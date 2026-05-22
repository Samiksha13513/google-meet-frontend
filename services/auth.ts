export const googleLogin = () => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

  window.location.href = `${apiUrl}/auth/google`;
};
