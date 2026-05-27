"use client";

import { Mic, MicOff, Video, VideoOff } from "lucide-react";

import { MeetAvatar } from "@/components/meeting/MeetAvatar";
import { Button } from "@/components/ui/button";
import { googleLogin } from "@/services/auth";

type PreviewLobbyProps = {
  meetingCode: string;
  displayName: string;
  email?: string;
  image?: string;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isMicOn: boolean;
  isCameraOn: boolean;
  isJoining: boolean;
  mediaError: string | null;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onJoinNow: () => void;
  isAuthenticated: boolean;
  customDisplayName: string;
  onCustomDisplayNameChange: (name: string) => void;
};

export function PreviewLobby({
  meetingCode,
  displayName,
  email,
  image,
  videoRef,
  isMicOn,
  isCameraOn,
  isJoining,
  mediaError,
  onToggleMic,
  onToggleCamera,
  onJoinNow,
  isAuthenticated,
  customDisplayName,
  onCustomDisplayNameChange,
}: PreviewLobbyProps) {
  const meetingReturnPath = `/meeting/${encodeURIComponent(meetingCode)}`;

  return (
    <div className="fixed inset-0 flex flex-col bg-[#202124] text-white">
      <header className="flex h-12 shrink-0 items-center border-b border-white/10 px-4 sm:h-14 sm:px-6">
        <span className="text-base font-medium text-[#e8eaed] sm:text-lg">
          Google Meet
        </span>
      </header>

      <main className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 overflow-y-auto px-4 py-6 sm:gap-8 sm:px-6 lg:flex-row lg:gap-12 lg:py-10">
        {/* Preview */}
        <div className="relative aspect-video w-full max-w-3xl overflow-hidden rounded-xl bg-[#3c4043] shadow-lg sm:rounded-2xl">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className={`h-full w-full object-cover ${isCameraOn ? "block scale-x-[-1]" : "hidden"}`}
          />

          {!isCameraOn && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#3c4043] px-4 text-center">
              <MeetAvatar
                displayName={displayName}
                email={email}
                image={image}
                size="xl"
              />
              {isAuthenticated && email ? (
                <p className="max-w-[90%] truncate text-sm text-white/75">
                  {email}
                </p>
              ) : (
                <p className="max-w-[90%] truncate text-sm text-white/75">
                  {displayName || "Guest"}
                </p>
              )}
            </div>
          )}

          <div className="absolute bottom-3 left-3 flex max-w-[80%] items-center gap-2 rounded-md bg-black/50 px-2.5 py-1 text-xs sm:text-sm">
            <span className="truncate">{displayName}</span>
            {!isMicOn && <MicOff className="h-3.5 w-3.5 shrink-0 text-red-400" />}
          </div>

          <div className="absolute bottom-3 right-3 flex gap-2">
            <button
              type="button"
              onClick={onToggleMic}
              className={`flex h-10 w-10 items-center justify-center rounded-full transition sm:h-11 sm:w-11 ${
                isMicOn ? "bg-[#3c4043] hover:bg-[#5f6368]" : "bg-red-500"
              }`}
              aria-label={isMicOn ? "Mute" : "Unmute"}
            >
              {isMicOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
            </button>
            <button
              type="button"
              onClick={onToggleCamera}
              className={`flex h-10 w-10 items-center justify-center rounded-full transition sm:h-11 sm:w-11 ${
                isCameraOn ? "bg-[#3c4043] hover:bg-[#5f6368]" : "bg-red-500"
              }`}
              aria-label={isCameraOn ? "Camera off" : "Camera on"}
            >
              {isCameraOn ? (
                <Video className="h-5 w-5" />
              ) : (
                <VideoOff className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>

        {/* Join panel */}
        <div className="flex w-full max-w-md flex-col gap-5 sm:gap-6">
          <div className="text-center lg:text-left">
            <p className="text-sm text-white/60">Ready to join?</p>
            <h1 className="mt-1 break-all text-xl font-normal text-[#e8eaed] sm:text-2xl">
              {meetingCode}
            </h1>
            <p className="mt-2 text-xs leading-relaxed text-white/50 sm:text-sm">
              Others in the call will see you when you join. You can turn off
              your camera and microphone anytime.
            </p>
          </div>

          {isAuthenticated ? (
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
              <MeetAvatar
                displayName={displayName}
                email={email}
                image={image}
                size="md"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{displayName}</p>
                {email && (
                  <p className="truncate text-xs text-white/55">{email}</p>
                )}
                <p className="mt-0.5 text-[10px] text-[#8ab4f8]">
                  Signed in with Google
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div>
                <label
                  htmlFor="displayNameInput"
                  className="mb-1.5 block text-left text-xs font-medium uppercase tracking-wider text-white/70"
                >
                  Your name
                </label>
                <input
                  id="displayNameInput"
                  type="text"
                  value={customDisplayName}
                  onChange={(e) => onCustomDisplayNameChange(e.target.value)}
                  placeholder="Enter your name"
                  maxLength={40}
                  className="w-full rounded-lg border border-white/10 bg-[#3c4043]/80 px-4 py-3 text-sm text-white placeholder-white/40 outline-none transition focus:border-[#8ab4f8] focus:bg-[#3c4043]"
                />
              </div>

              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-white/10" />
                <span className="text-xs text-white/40">or</span>
                <div className="h-px flex-1 bg-white/10" />
              </div>

              <button
                type="button"
                onClick={() => googleLogin(meetingReturnPath)}
                className="flex w-full items-center justify-center gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-[#3c4043] shadow-sm transition hover:bg-neutral-100"
              >
                <GoogleIcon />
                Sign in with Google
              </button>
            </div>
          )}

          {mediaError && (
            <p className="text-sm text-red-400" role="alert">
              {mediaError}
            </p>
          )}

          <Button
            onClick={onJoinNow}
            disabled={
              isJoining ||
              !!mediaError ||
              (!isAuthenticated && !customDisplayName.trim())
            }
            className="w-full rounded-full py-6 text-base font-medium text-[#202124] disabled:opacity-50 sm:w-auto sm:px-10"
            style={{ backgroundColor: "#8ab4f8" }}
          >
            {isJoining ? "Joining..." : "Join now"}
          </Button>
        </div>
      </main>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}
