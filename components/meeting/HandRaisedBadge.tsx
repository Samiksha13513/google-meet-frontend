"use client";

import { Hand } from "lucide-react";

type HandRaisedBadgeProps = {
  name: string;
  compact?: boolean;
};

export function HandRaisedBadge({ name, compact = false }: HandRaisedBadgeProps) {
  return (
    <div
      className={[
        "absolute z-30 flex max-w-[85%] items-center gap-1.5 rounded-full bg-[#81c995] text-[#202124] shadow-[0_1px_3px_rgba(0,0,0,0.28)]",
        compact
          ? "top-1.5 left-1.5 px-2 py-0.5 text-[10px] leading-4"
          : "top-3 left-3 px-2.5 py-1 text-[13px] leading-5",
      ].join(" ")}
    >
      <Hand
        className={compact ? "h-3 w-3 shrink-0" : "h-4 w-4 shrink-0"}
        strokeWidth={2.25}
        aria-hidden
      />
      <span className="truncate font-normal">{name}</span>
    </div>
  );
}
