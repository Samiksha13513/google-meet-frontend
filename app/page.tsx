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
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white">
        <div className="max-w-7xl mx-auto px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Image src={MEET_LOGO_URL} alt="Google Meet" width={92} height={28} className="h-7 w-auto object-contain" />
          </div>

          <div>
            <Button
              onClick={() => googleLogin()}
              className="text-[#1a73e8] bg-transparent hover:bg-transparent px-2 py-1 text-sm rounded"
            >
              Sign in
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          {/* Left - Video Preview */}
          <div>
            <div className="rounded-2xl overflow-hidden bg-gray-100 shadow-sm">
              <div className="relative bg-black/5" style={{ borderRadius: 16 }}>
                <VideoCallMockup />
                {/* Overlay center buttons */}
                <div className="absolute left-1/2 -translate-x-1/2 bottom-8 flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-white shadow flex items-center justify-center">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-gray-700"><path d="M12 14a3 3 0 100-6 3 3 0 000 6z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-white shadow flex items-center justify-center">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-gray-700"><rect x="3" y="7" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.4"/></svg>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-white shadow flex items-center justify-center">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-gray-700"><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.4"/></svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Device selectors row */}
            <div className="mt-6 flex flex-wrap gap-3">
              <button className="rounded-full border px-4 py-2 text-sm bg-white shadow-sm">Microphone (Default)</button>
              <button className="rounded-full border px-4 py-2 text-sm bg-white shadow-sm">Speakers (Default)</button>
              <button className="rounded-full border px-4 py-2 text-sm bg-white shadow-sm">Camera (Default)</button>
              <button className="rounded-full border px-4 py-2 text-sm bg-white shadow-sm">Backgrounds</button>
            </div>
          </div>

          {/* Right - Name input & actions */}
          <div className="flex flex-col items-start justify-center pt-8 lg:pt-0">
            <h2 className="text-2xl font-medium text-[#202124] mb-4">What's your name?</h2>
            <div className="w-full max-w-sm">
              <input
                placeholder="Your name"
                maxLength={60}
                className="w-full border rounded-md px-4 py-3 text-lg focus:outline-none"
              />
              <div className="mt-4">
                <button className="w-full rounded-full bg-gray-200 text-gray-500 py-3">Ask to join</button>
              </div>
              <div className="mt-4">
                <button className="w-full rounded-full border py-3">Other ways to join</button>
              </div>
            </div>

            <p className="mt-8 text-xs text-gray-500 max-w-sm">By joining, you agree to the <a className="underline">Terms of Service</a> and <a className="underline">Privacy Policy</a>. System info will be sent to confirm you're not a bot.</p>
          </div>
        </div>
      </main>
    </div>
  );
}

/* Video Call Mockup Component */
function VideoCallMockup() {
	 return (
	  <div className="relative h-96 lg:h-full">
    <div className="relative w-full h-full rounded-2xl">
      
      {/* Image instead of video grid */}
<Image
  src="/meet.webp"
  alt="Meeting preview"
  width={1200}
  height={700}
  className="w-full h-auto object-contain"
  priority
/>
    </div>
  </div>
);
}
