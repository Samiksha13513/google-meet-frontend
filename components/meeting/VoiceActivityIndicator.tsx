"use client";

type VoiceActivityIndicatorProps = {
  level: number;
  active?: boolean;
  size?: "sm" | "md";
};

export function VoiceActivityIndicator({
  level,
  active = true,
  size = "md",
}: VoiceActivityIndicatorProps) {
  if (!active) return null;

  const activeLevel = Math.max(0.1, Math.min(1, level));
  const base = size === "sm" ? 3 : 4;
  const barHeights = [0.5, 0.8, 1].map((scale) =>
    Math.round(base + activeLevel * (size === "sm" ? 8 : 10) * scale)
  );

  return (
    <span
      className={[
        "inline-flex items-end justify-center gap-[2px] rounded-full bg-[#8ab4f8] text-[#202124]",
        size === "sm" ? "h-7 w-7" : "h-8 w-8",
      ].join(" ")}
      aria-hidden
    >
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
