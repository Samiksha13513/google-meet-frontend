"use client";

type VoiceActivityIndicatorProps = {
  level: number;
  active?: boolean;
  size?: "sm" | "md";
  variant?: "badge" | "inline";
};

export function VoiceActivityIndicator({
  level,
  active = true,
  size = "md",
  variant = "badge",
}: VoiceActivityIndicatorProps) {
  if (!active || level <= 0.04) return null;

  const activeLevel = Math.min(1, level);
  const base = size === "sm" ? 3 : 4;
  const barHeights = [0.5, 0.8, 1].map((scale) =>
    Math.round(base + activeLevel * (size === "sm" ? 10 : 12) * scale)
  );

  const bars = (
    <>
      {barHeights.map((height, index) => (
        <span
          key={index}
          className={[
            "w-[3px] rounded-full transition-[height] duration-[80ms] ease-out",
            variant === "inline" ? "bg-white" : "bg-[#202124]",
          ].join(" ")}
          style={{ height }}
        />
      ))}
    </>
  );

  if (variant === "inline") {
    return (
      <span className="inline-flex h-5 items-end justify-center gap-[2px]" aria-hidden>
        {bars}
      </span>
    );
  }

  return (
    <span
      className={[
        "inline-flex items-end justify-center gap-[2px] rounded-full bg-[#8ab4f8] text-[#202124]",
        size === "sm" ? "h-7 w-7" : "h-8 w-8",
      ].join(" ")}
      aria-hidden
    >
      {bars}
    </span>
  );
}
