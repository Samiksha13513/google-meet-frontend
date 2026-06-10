"use client";

import { MoreHorizontal } from "lucide-react";

type LobbyMicIndicatorProps = {
  isMicOn: boolean;
  level: number;
};

export function LobbyMicIndicator({ isMicOn, level }: LobbyMicIndicatorProps) {
  if (!isMicOn) {
    return <MoreHorizontal className="h-4 w-4" />;
  }

  const activeLevel = Math.max(0.12, Math.min(1, level));
  const barHeights = [0.45, 0.75, 1].map((scale) =>
    Math.round(4 + activeLevel * 10 * scale)
  );

  return (
    <span className="flex h-4 items-end justify-center gap-[2px]" aria-hidden>
      {barHeights.map((height, index) => (
        <span
          key={index}
          className="w-[3px] rounded-full bg-[#202124] transition-[height] duration-[120ms] ease-out"
          style={{ height }}
        />
      ))}
    </span>
  );
}
