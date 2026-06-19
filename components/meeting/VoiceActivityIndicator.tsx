"use client";

import { useSyncExternalStore } from "react";

export type VoiceActivityLevelStore = {
  getSnapshot: () => number;
  subscribe: (listener: () => void) => () => void;
};

type VoiceActivityIndicatorProps = {
  level?: number;
  levelStore?: VoiceActivityLevelStore;
  active?: boolean;
  size?: "sm" | "md";
  variant?: "badge" | "inline";
  className?: string;
};

const subscribeToNothing = () => () => {};
const getZeroSnapshot = () => 0;



export function VoiceActivityIndicator({
  level = 0,
  levelStore,
  active = true,
  size = "md",
  variant = "badge",
  className = "",
}: VoiceActivityIndicatorProps) {
  const subscribedLevel = useSyncExternalStore(
    levelStore?.subscribe ?? subscribeToNothing,
    levelStore?.getSnapshot ?? getZeroSnapshot,
    getZeroSnapshot
  );
  const displayLevel = levelStore ? subscribedLevel : level;
  const activeLevel = active ? Math.min(1, Math.max(0, displayLevel)) : 0;
  const isSpeaking = activeLevel > 0.045;
  const dotSize = size === "sm" ? 3 : 4;
  const maxBoost = size === "sm" ? 10 : 12;
  const barHeights = [0.45, 0.72, 1].map((scale) =>
    isSpeaking ? Math.round(dotSize + activeLevel * maxBoost * scale) : dotSize
  );
  const indicatorColor =
    variant === "inline"
      ? isSpeaking
        ? "#8ab4f8"
        : "rgba(138, 180, 248, 0.95)"
      : "#202124";

  const bars = (
    <>
      {barHeights.map((height, index) => (
        <span
          key={index}
          className={[
            "rounded-full transition-[height,opacity,transform] duration-[120ms] ease-out",
            isSpeaking ? "meet-audio-wave-dot" : "",
          ].join(" ")}
          style={{
            width: dotSize,
            height,
            backgroundColor: indicatorColor,
            opacity: isSpeaking ? 1 : 0.92,
            animationDelay: `${index * 90}ms`,
          }}
        />
      ))}
    </>
  );

  if (variant === "inline") {
    return (
      <span className={`inline-flex h-5 min-w-4 items-center justify-center gap-[3px] ${className}`.trim()} aria-hidden>
        {bars}
      </span>
    );
  }

  return (
    <span
      className={[
        "inline-flex items-center justify-center gap-[2px] rounded-full bg-[#8ab4f8] text-[#202124]",
        size === "sm" ? "h-7 w-7" : "h-8 w-8",
        className,
      ].join(" ")}
      aria-hidden
    >
      {bars}
    </span>
  );
}
