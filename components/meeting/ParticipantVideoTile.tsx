"use client";

import { useEffect, useRef } from "react";
import { MicOff, Shield } from "lucide-react";

import { MeetAvatar } from "./MeetAvatar";

export type ParticipantTileData = {
  socketId: string;
  displayName: string;
  email?: string;
  image?: string;
  stream?: MediaStream;
  isMicOn: boolean;
  isCameraOn: boolean;
  isHost?: boolean;
  isLocal?: boolean;
  isScreenSharing?: boolean;
};

type ParticipantVideoTileProps = {
  participant: ParticipantTileData;
  labelSuffix?: string;
  mirrored?: boolean;
  headerAction?: React.ReactNode;
};

function VideoTrack({
  stream,
  muted,
  mirrored,
}: {
  stream: MediaStream;
  muted: boolean;
  mirrored?: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = stream;
    el.play().catch(() => {});
  }, [stream]);

  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={muted}
      className={`h-full w-full object-cover ${mirrored ? "scale-x-[-1]" : ""}`}
    />
  );
}

/**
 * Google Meet tile rules:
 * - Camera ON: video + name overlay only (no email on tile)
 * - Camera OFF: avatar + email (if signed in) or guest name below
 */
export function ParticipantVideoTile({
  participant,
  labelSuffix = "",
  mirrored = false,
  headerAction,
}: ParticipantVideoTileProps) {
  const {
    displayName,
    email,
    image,
    stream,
    isMicOn,
    isCameraOn,
    isHost,
    isLocal,
  } = participant;

  const showVideo = isCameraOn && stream;
  const showEmailUnderAvatar = Boolean(email?.trim());

  return (
    <div className="relative flex aspect-video max-h-[min(500px,50vh)] w-full items-center justify-center overflow-hidden rounded-2xl border border-white/5 bg-[#3c4043] shadow-md">
      {showVideo ? (
        <VideoTrack stream={stream} muted={!!isLocal} mirrored={mirrored} />
      ) : (
        <div className="flex flex-col items-center gap-3 px-4 text-center">
          <MeetAvatar
            displayName={displayName}
            email={email}
            image={image}
            size="xl"
          />
          {showEmailUnderAvatar ? (
            <p className="max-w-[85%] truncate text-sm text-white/75">{email}</p>
          ) : (
            <p className="max-w-[85%] truncate text-sm text-white/75">
              {displayName}
            </p>
          )}
        </div>
      )}

      <div className="absolute bottom-2 left-2 flex max-w-[calc(100%-1rem)] items-center gap-1.5 rounded-full border border-white/10 bg-black/60 px-2.5 py-1 text-xs font-light tracking-wide backdrop-blur-md sm:bottom-3 sm:left-3 sm:px-3 sm:py-1.5">
        <span className="truncate">
          {displayName}
          {labelSuffix}
        </span>
        {isHost && <Shield className="h-3.5 w-3.5 shrink-0 text-yellow-400" />}
        {!isMicOn && <MicOff className="h-3 w-3 shrink-0 text-red-400" />}
      </div>

      {headerAction && (
        <div className="absolute right-2 top-2 sm:right-3 sm:top-3">
          {headerAction}
        </div>
      )}
    </div>
  );
}
