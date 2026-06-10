'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import Image from 'next/image';
import { googleLogin } from "../services/auth";
import { hasValidAuthToken } from "@/lib/auth-token";
import { MEET_LOGO_URL } from "@/lib/meet-brand";

export default function Home() {
  const router = useRouter();
  const [meetingCode, setMeetingCode] = useState('');
  const [showCodeInput, setShowCodeInput] = useState(false);

  useEffect(() => {
    if (hasValidAuthToken()) {
      router.replace("/dashboard");
    }
  }, [router]);

  const goToMeeting = (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    router.push(`/meeting/${encodeURIComponent(trimmed)}`);
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-50 border-b border-[#dadce0] bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center text-2xl tracking-tight">
            <span className="text-[#4285F4]">G</span>
            <span className="text-[#EA4335]">o</span>
            <span className="text-[#FBBC05]">o</span>
            <span className="text-[#4285F4]">g</span>
            <span className="text-[#34A853]">l</span>
            <span className="text-[#EA4335]">e</span>
            <span className="ml-2 font-normal text-[#5f6368]">Workspace</span>
          </div>

          <Button
            onClick={() => googleLogin()}
            className="h-auto rounded-full px-8 py-3 text-base text-white"
            style={{ backgroundColor: '#1a73e8' }}
          >
            Sign in
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className="space-y-6">
            <Image
              src={MEET_LOGO_URL}
              alt="Google Meet"
              width={172}
              height={32}
              className="h-8 w-auto object-contain"
              priority
            />

            <div className="space-y-4">
              <h1 className="text-[44px] font-normal leading-[52px] text-[#202124] lg:text-[48px] lg:leading-[56px]">
                Video calls, <br />
                enhanced with AI
              </h1>
              <p className="max-w-lg text-lg font-normal text-[#5f6368]">
                Make connecting easy with AI-powered video calls that enable collaboration and expression.
              </p>
            </div>

            <Button
              onClick={() => googleLogin()}
              className="h-auto rounded-full px-6 py-2.5 text-sm text-white"
              style={{ backgroundColor: '#1a73e8' }}
            >
              Sign in
            </Button>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <p className="text-sm font-medium text-[#202124]">Join a meeting now</p>
              {!showCodeInput ? (
                <button
                  type="button"
                  onClick={() => setShowCodeInput(true)}
                  className="text-sm font-medium text-[#1a73e8] underline-offset-2 transition hover:underline"
                >
                  Enter code
                </button>
              ) : (
                <div
                  className="flex items-center gap-1 rounded-lg border-2 bg-white p-1"
                  style={{ borderColor: '#1a73e8' }}
                >
                  <Input
                    value={meetingCode}
                    onChange={(e) => setMeetingCode(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && meetingCode.trim()) {
                        goToMeeting(meetingCode);
                        setMeetingCode('');
                        setShowCodeInput(false);
                      }
                    }}
                    className="h-9 min-w-[180px] border-0 px-3 text-sm shadow-none focus-visible:ring-0"
                    aria-label="Meeting code"
                  />
                  <Button
                    type="button"
                    onClick={() => {
                      if (meetingCode.trim()) {
                        goToMeeting(meetingCode);
                        setMeetingCode('');
                        setShowCodeInput(false);
                      }
                    }}
                    className="h-9 bg-transparent px-3 text-sm font-medium shadow-none hover:bg-transparent"
                    style={{ color: '#1a73e8' }}
                  >
                    Join
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="hidden lg:block">
            <VideoCallMockup />
          </div>
        </div>
      </main>

      <div className="px-4 py-12 sm:px-6 lg:hidden">
        <VideoCallMockup />
      </div>
    </div>
  );
}

function VideoCallMockup() {
  return (
    <div className="relative h-96 lg:h-full">
      <div className="relative h-full w-full overflow-hidden rounded-2xl bg-[#f1f3f4]">
        <Image
          src="/carousa1.svg"
          alt="Meeting preview"
          width={1200}
          height={700}
          className="h-full w-full object-cover"
          priority
        />
      </div>
    </div>
  );
}
