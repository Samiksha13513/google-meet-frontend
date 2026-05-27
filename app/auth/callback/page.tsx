'use client';

import { Suspense } from 'react';
import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function safeReturnPath(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return '/dashboard';
  }
  return value;
}

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    const userParam = searchParams.get('user');
    const error = searchParams.get('error');
    const returnTo = safeReturnPath(searchParams.get('returnTo'));

    if (token) {
      localStorage.setItem('authToken', token);
      if (userParam) {
        try {
          const decoded = decodeURIComponent(userParam);
          const user = JSON.parse(decoded);
          localStorage.setItem('user', JSON.stringify(user));
        } catch {
          try {
            localStorage.setItem('user', userParam);
          } catch {
            // ignore
          }
        }
      }
      router.replace(returnTo);
      return;
    }

    router.replace(error ? `/?authError=${encodeURIComponent(error)}` : '/');
  }, [router, searchParams]);

  return (
    <main className="min-h-screen bg-[#202124] flex items-center justify-center">
      <p className="text-sm text-white/70">Signing you in...</p>
    </main>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#202124] flex items-center justify-center">
          <p className="text-sm text-white/70">Signing you in...</p>
        </main>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}
