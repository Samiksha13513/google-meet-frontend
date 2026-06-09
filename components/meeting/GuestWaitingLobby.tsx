"use client";

import {
  ChevronUp,
  Mic,
  MicOff,
  MoreHorizontal,
  MoreVertical,
  Phone,
  Video,
  VideoOff,
} from "lucide-react";
import Image from "next/image";

import { getDisplayInitial } from "@/lib/display-name";

type GuestWaitingLobbyProps = {
  displayName: string;
  image?: string;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isMicOn: boolean;
  isCameraOn: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onLeave: () => void;
};

export function GuestWaitingLobby({
  displayName,
  image,
  videoRef,
  isMicOn,
  isCameraOn,
  onToggleMic,
  onToggleCamera,
  onLeave,
}: GuestWaitingLobbyProps) {
  const initial = getDisplayInitial(displayName);

  return (
    <div className="fixed inset-0 flex flex-col bg-[#202124] text-white select-none overflow-hidden">
      {/* Center illustration + status */}
      <main className="flex flex-1 flex-col items-center justify-center px-6 pb-28 pt-8">
        <div className="w-full max-w-[420px]">
          <Image
            src="/waiting-room-illustration.svg"
            alt=""
            width={400}
            height={280}
            className="mx-auto h-auto w-full max-w-[360px]"
            priority
          />
        </div>

        <div className="mt-8 flex max-w-[520px] items-center justify-center gap-3 text-center">
          <span
            className="inline-block h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-[#8ab4f8] border-t-transparent"
            aria-hidden
          />
          <p className="text-[15px] font-normal leading-6 text-white/90 sm:text-base">
            Please wait until a meeting host brings you into the call
          </p>
        </div>
      </main>

      {/* Self preview — bottom right */}
      <div className="absolute bottom-[88px] right-4 z-20 w-[168px] overflow-hidden rounded-xl bg-[#3c4043] shadow-lg ring-1 ring-white/10 sm:bottom-[92px] sm:right-6 sm:w-[188px]">
        <div className="relative aspect-[4/3] w-full">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className={`h-full w-full object-cover ${isCameraOn ? "block" : "hidden"}`}
          />
          {!isCameraOn && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#3c4043]">
              <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-[#78909c] text-xl font-medium text-white">
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={image}
                    alt={displayName}
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  initial
                )}
              </div>
            </div>
          )}
          <div className="absolute bottom-1.5 left-2 max-w-[85%] truncate text-[11px] font-medium text-white drop-shadow-sm">
            {displayName}
          </div>
        </div>
      </div>

      {/* Bottom control bar */}
      <div className="absolute bottom-0 left-0 right-0 z-30 flex items-center justify-center px-4 pb-[max(env(safe-area-inset-bottom),16px)] pt-3">
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Mic group */}
          <div className="flex items-center overflow-hidden rounded-full bg-[#3c4043]">
            <button
              type="button"
              title="More audio options"
              className="flex h-11 w-10 items-center justify-center text-white/90 transition-colors duration-[180ms] hover:bg-[#4f5357] sm:h-12 sm:w-11"
            >
              <MoreHorizontal className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={onToggleMic}
              title={isMicOn ? "Turn off microphone" : "Turn on microphone"}
              className={`meet-control-btn h-11 w-11 sm:h-12 sm:w-12 ${isMicOn ? "meet-control-btn-neutral rounded-none" : "meet-control-btn-danger rounded-none"}`}
            >
              {isMicOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
            </button>
            <button
              type="button"
              title="Audio settings"
              className="flex h-11 w-9 items-center justify-center border-l border-white/10 text-white/80 transition-colors duration-[180ms] hover:bg-[#4f5357] sm:h-12 sm:w-10"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
          </div>

          {/* Camera group */}
          <div className="flex items-center overflow-hidden rounded-full bg-[#3c4043]">
            <button
              type="button"
              title="Video settings"
              className="flex h-11 w-9 items-center justify-center text-white/80 transition-colors duration-[180ms] hover:bg-[#4f5357] sm:h-12 sm:w-10"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onToggleCamera}
              title={isCameraOn ? "Turn off camera" : "Turn on camera"}
              className={`meet-control-btn h-11 w-11 sm:h-12 sm:w-12 ${isCameraOn ? "meet-control-btn-neutral rounded-none" : "meet-control-btn-danger rounded-none"}`}
            >
              {isCameraOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
            </button>
          </div>

          {/* More options */}
          <button
            type="button"
            title="More options"
            className="meet-control-btn meet-control-btn-neutral h-11 w-11 sm:h-12 sm:w-12"
          >
            <MoreVertical className="h-5 w-5" />
          </button>

          {/* Leave / cancel request */}
          <button
            type="button"
            onClick={onLeave}
            title="Leave call"
            className="meet-control-btn meet-control-btn-danger ml-1 h-11 w-11 sm:ml-2 sm:h-12 sm:w-12"
          >
            <Phone className="h-5 w-5 rotate-[135deg]" />
          </button>
        </div>
      </div>
    </div>
  );
}
