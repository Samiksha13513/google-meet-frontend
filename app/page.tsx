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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo and Company */}
          <div className="flex items-center gap-12">
         <div className="flex items-center -ml-16 text-2xl tracking-tight">
          <span className="text-[#4285F4]">G</span>
          <span className="text-[#EA4335]">o</span>
          <span className="text-[#FBBC05]">o</span>
          <span className="text-[#4285F4]">g</span>
          <span className="text-[#34A853]">l</span>
          <span className="text-[#EA4335]">e</span>

          <span className="ml-2 text-gray-600 font-normal">
            Workspace
          </span>
        </div>
          
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-3">
            <Button variant="outline" className="hidden sm:inline-flex rounded-full border-2 px-6 py-2 h-auto text-sm" style={{ borderColor: '#dadce0', color: '#1a73e8' }}>
              Try Meet for work
            </Button>
         <Button
          onClick={() => googleLogin()}
          className="rounded-full text-white px-8 py-3 text-base h-auto"
          style={{ backgroundColor: '#1a73e8' }}
        >
          Sign in
        </Button>
          </div>
        </div>
      </header>

      {/* Main Hero Section */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-1 lg:py-6">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <div >
            {/* Google Meet Logo */}
            <div className="flex items-center gap-2">
              <Image
              src={MEET_LOGO_URL}
              alt="Google Meet Logo"
              width={172}
              height={32}
              className="object-contain"
            />
        
            </div>

            {/* Headline */}
            <div className="space-y-4">
           <h1 className="text-5xl lg:text-5xl text-[#202124] font-bold leading-tight">
                Video calls, <br />
                enhanced with AI
              </h1>
              <p className="text-lg text-muted-foreground text-[#5F6368] max-w-lg">
                Make connecting easy with AI-powered video calls that enable collaboration and expression.
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 mt-4 items-start sm:items-center">
             <Button
            onClick={() => googleLogin()}
            className="rounded-full text-white py-2 px-6 h-auto text-sm"
            style={{ backgroundColor: '#1a73e8' }}
          >
            Sign in
          </Button>
              <Button
                variant="outline"
                className="rounded-full px-8 py-3 text-base h-auto border-2 hover:bg-muted"
                style={{ borderColor: '#dadce0', color: '#1a73e8' }}
              >
                Try Meet for work
              </Button>
            </div>

            {/* Join Meeting Section */}
            <div className="pt-4 flex items-center gap-3 flex-wrap">
              <p className="text-sm font-medium text-foreground">Join a meeting now</p>
              {!showCodeInput ? (
                <>
                  <button
                    onClick={() => setShowCodeInput(true)}
                    className="text-blue-600 hover:text-blue-700 underline text-sm font-medium transition"
                    style={{ color: '#1a73e8' }}
                  >
                    Enter code
                  </button>
                  <button
                    onClick={() => alert('Join a meeting using the meeting code. Ask your organizer for the meeting code.')}
                    className="text-muted-foreground hover:text-foreground"
                    title="Info"
                  >
                    ℹ️
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-2 border-2 rounded-lg p-1 bg-white" style={{ borderColor: '#1a73e8' }}>
                  <Input
                    placeholder="Enter code"
                    value={meetingCode}
                    onChange={(e) => setMeetingCode(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && meetingCode.trim()) {
                        goToMeeting(meetingCode);
                        setMeetingCode('');
                        setShowCodeInput(false);
                      }
                    }}
                    className="border-0 outline-none focus:outline-none focus:ring-0 text-sm py-2 px-3"
                  />
                  <Button
                    onClick={() => {
                      if (meetingCode.trim()) {
                        goToMeeting(meetingCode);
                        setMeetingCode('');
                        setShowCodeInput(false);
                      }
                    }}
                    className="bg-transparent hover:bg-transparent text-sm font-medium px-3"
                    style={{ color: '#1a73e8' }}
                  >
                    Join
                  </Button>
                  <button
                    onClick={() => alert('Join a meeting using the meeting code. Ask your organizer for the meeting code.')}
                    className="text-muted-foreground hover:text-foreground px-2"
                    title="Info"
                  >
                    ℹ️
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right Video Call Mockup */}
          <div className="hidden lg:block">
            <VideoCallMockup />
          </div>
        </div>
      </main>

      {/* Mobile Video Call Mockup */}
      <div className="lg:hidden max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <VideoCallMockup />
      </div>
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
