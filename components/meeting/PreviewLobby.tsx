"use client";

import { Mic, MicOff, Video, VideoOff } from "lucide-react";

import { getDisplayInitial } from "@/lib/display-name";
import { Button } from "@/components/ui/button";

type PreviewLobbyProps = {
  meetingCode: string;
  displayName: string;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isMicOn: boolean;
  isCameraOn: boolean;
  isJoining: boolean;
  mediaError: string | null;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onJoinNow: () => void;
};

export function PreviewLobby({
  meetingCode,
  displayName,
  videoRef,
  isMicOn,
  isCameraOn,
  isJoining,
  mediaError,
  onToggleMic,
  onToggleCamera,
  onJoinNow,
}: PreviewLobbyProps) {
  const initial = getDisplayInitial(displayName);

  return (
    <div className="fixed inset-0 bg-[#202124] text-white flex flex-col">
      <header className="h-14 px-6 flex items-center border-b border-white/10">
        <span className="text-lg font-medium text-[#e8eaed]">Google Meet</span>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-10 px-6 py-8">
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
              <div className="h-28 w-28 rounded-full bg-[#8ab4f8] flex items-center justify-center text-4xl font-medium text-[#202124]">
                {initial}
              </div>
            </div>
          )}

          <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-md bg-black/50 px-3 py-1.5 text-sm">
            <span>{displayName}</span>
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

          {mediaError && (
            <p className="text-sm text-red-400 w-full">{mediaError}</p>
          )}

          <Button
            onClick={onJoinNow}
            disabled={isJoining || !!mediaError}
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
