"use client";

import { Mic, MicOff } from "lucide-react";

type MeetMicStatusProps = {
  isMicOn: boolean;
  compact?: boolean;
  className?: string;
};

export function MeetMicStatus({
  isMicOn,
  compact = false,
  className = "",
}: MeetMicStatusProps) {
  const size = compact ? "h-5 w-5" : "h-6 w-6";
  const iconSize = compact ? "h-3 w-3" : "h-3.5 w-3.5";
  const label = isMicOn ? "Microphone on" : "Microphone off";

  return (
    <span
      title={label}
      aria-label={label}
      className={[
        "inline-flex shrink-0 items-center justify-center rounded-full shadow-sm ring-1",
        size,
        isMicOn
          ? "bg-[#3c4043]/90 text-white ring-white/10"
          : "bg-[#d93025] text-white ring-[#fce8e6]/30",
        className,
      ].join(" ")}
    >
      {isMicOn ? (
        <Mic className={iconSize} strokeWidth={2.25} />
      ) : (
        <MicOff className={iconSize} strokeWidth={2.25} />
      )}
    </span>
  );
}
