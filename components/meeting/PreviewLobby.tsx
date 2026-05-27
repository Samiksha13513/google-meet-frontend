"use client";

import { Mic, MicOff, Video, VideoOff } from "lucide-react";

import { getDisplayInitial } from "@/lib/display-name";
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
  const label = displayName || (isAuthenticated ? "Signed-in user" : "Guest");
  const initial = getDisplayInitial(label);

  return (
    <div className="fixed inset-0 bg-[#202124] text-white flex flex-col">
      <header className="h-14 px-6 flex items-center border-b border-white/10">
        <span className="text-lg font-medium text-[#e8eaed]">Google Meet</span>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-6 lg:gap-10 px-4 sm:px-6 py-6 lg:py-8">
        <div className="relative w-full max-w-2xl aspect-video rounded-2xl overflow-hidden bg-[#3c4043] shadow-lg">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className={`w-full h-full object-cover ${isCameraOn ? "block" : "hidden"}`}
          />

          {!isCameraOn && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#3c4043]">
              <div className="flex flex-col items-center gap-3">
                <div className="h-24 w-24 sm:h-28 sm:w-28 overflow-hidden rounded-full bg-[#8ab4f8] flex items-center justify-center text-4xl font-medium text-[#202124]">
                  {image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={image}
                      alt={label}
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    initial
                  )}
                </div>
                {isAuthenticated && email && (
                  <p className="max-w-[220px] truncate text-xs text-white/75">{email}</p>
                )}
              </div>
            </div>
          )}

          <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-md bg-black/50 px-3 py-1.5 text-sm">
            <span>{label}</span>
            {!isMicOn && <MicOff className="h-4 w-4 text-red-400" />}
          </div>
        </div>

        <div className="w-full max-w-sm flex flex-col items-center lg:items-start text-center lg:text-left gap-6">
          <div>
            <p className="text-sm text-white/60 mb-1">Ready to join?</p>
            <h1 className="text-2xl font-normal text-[#e8eaed]">
              {meetingCode}
            </h1>
            <p className="text-sm text-white/50 mt-2">
              No one else is in the call yet, or others will see you when you join.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onToggleMic}
              title={isMicOn ? "Turn off microphone" : "Turn on microphone"}
              className={`h-12 w-12 rounded-full flex items-center justify-center transition ${
                isMicOn ? "bg-[#3c4043] hover:bg-[#5f6368]" : "bg-red-500 hover:bg-red-600"
              }`}
            >
              {isMicOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
            </button>
            <button
              type="button"
              onClick={onToggleCamera}
              title={isCameraOn ? "Turn off camera" : "Turn on camera"}
              className={`h-12 w-12 rounded-full flex items-center justify-center transition ${
                isCameraOn ? "bg-[#3c4043] hover:bg-[#5f6368]" : "bg-red-500 hover:bg-red-600"
              }`}
            >
              {isCameraOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
            </button>
          </div>

          {!isAuthenticated && (
            <div className="w-full flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label htmlFor="displayNameInput" className="text-left text-xs font-semibold text-white/70 uppercase tracking-wider">
                  Your Display Name
                </label>
                <input
                  id="displayNameInput"
                  type="text"
                  value={customDisplayName}
                  onChange={(e) => onCustomDisplayNameChange(e.target.value)}
                  placeholder="Enter your name to join"
                  className="w-full bg-[#3c4043]/50 border border-white/10 hover:border-white/30 focus:border-[#8ab4f8] focus:bg-[#3c4043] rounded-lg px-4 py-3 text-sm text-white placeholder-white/40 outline-none transition duration-150 ease-in-out shadow-sm"
                  maxLength={40}
                />
              </div>

              <div className="flex items-center gap-2 my-1">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-xs text-white/40 font-medium uppercase tracking-wider">or</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              <button
                type="button"
                onClick={() => googleLogin(typeof window !== "undefined" ? window.location.pathname : "/dashboard")}
                className="w-full flex items-center justify-center gap-3 bg-white hover:bg-neutral-100 text-neutral-850 rounded-lg px-4 py-3 text-sm font-semibold transition duration-150 shadow-sm border border-neutral-250 cursor-pointer"
              >
                <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" width="24" height="24">
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
                Sign in with Google
              </button>
            </div>
          )}

          {mediaError && (
            <p className="text-sm text-red-400 w-full">{mediaError}</p>
          )}

          <Button
            onClick={onJoinNow}
            disabled={isJoining || !!mediaError || (!isAuthenticated && !customDisplayName.trim())}
            className="rounded-full px-8 py-6 text-base font-medium text-[#202124] hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: "#8ab4f8" }}
          >
            {isJoining ? "Joining..." : "Join now"}
          </Button>
        </div>
      </main>
    </div>
  );
}
