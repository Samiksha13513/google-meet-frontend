"use client";

import { Hand } from "lucide-react";

type RaisedHand = {
  id: string;
  name: string;
};

type HandRaiseNotificationsProps = {
  raisedHands: RaisedHand[];
  stackOffset?: number;
};

export function HandRaiseNotifications({
  raisedHands,
  stackOffset = 0,
}: HandRaiseNotificationsProps) {
  if (raisedHands.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed left-4 z-50 flex max-w-[min(420px,calc(100vw-32px))] flex-col gap-2 sm:left-6"
      style={{ bottom: `${76 + stackOffset}px` }}
    >
      {raisedHands.map((item) => (
        <div
          key={item.id}
          className="flex items-center gap-2 rounded-full bg-[#81c995] px-3 py-1.5 text-sm text-[#202124] shadow-[0_1px_3px_rgba(0,0,0,0.28)] animate-fade-in"
        >
          <Hand className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
          <span className="truncate font-normal">
            {item.id === "local" ? "You raised your hand" : `${item.name} raised their hand`}
          </span>
        </div>
      ))}
    </div>
  );
}
