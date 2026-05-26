'use client';

import { Suspense } from 'react';
import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    const user = searchParams.get('user');
    const error = searchParams.get('error');

    if (token) {
      localStorage.setItem('authToken', token);
      if (user) {
        try {
          localStorage.setItem('user', user);
        } catch {
          // Ignore malformed user payloads; token auth still succeeds.
        }
      }
      router.replace('/dashboard');
      return;
    }

    router.replace(error ? `/?authError=${encodeURIComponent(error)}` : '/');
  }, [router, searchParams]);

  return (
    <main className="min-h-screen bg-background flex items-center justify-center">
      <p className="text-sm text-[#5F6368]">Signing you in...</p>
    </main>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-background flex items-center justify-center">
          <p className="text-sm text-[#5F6368]">Signing you in...</p>
        </main>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}
