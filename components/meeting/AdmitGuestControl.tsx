"use client";

import { useRef, useState } from "react";
import { ChevronRight, UserPlus } from "lucide-react";

import { MeetPersonAvatar } from "@/components/meeting/MeetPersonAvatar";

export type AdmitGuestRequest = {
  socketId: string;
  displayName: string;
  email?: string;
  image?: string;
};

type AdmitGuestControlProps = {
  requests: AdmitGuestRequest[];
  onAdmit: (socketId: string) => void;
  onDeny: (socketId: string) => void;
  onOpenPeoplePanel: () => void;
};

export function AdmitGuestControl({
  requests,
  onAdmit,
  onDeny,
  onOpenPeoplePanel,
}: AdmitGuestControlProps) {
  const [hoverOpen, setHoverOpen] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const count = requests.length;
  const first = requests[0];

  if (!count || !first) return null;

  const openPopover = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setHoverOpen(true);
  };

  const scheduleClose = () => {
    closeTimerRef.current = setTimeout(() => setHoverOpen(false), 120);
  };

  const guestLabel =
    count === 1 ? "1 unconfirmed user" : `${count} unconfirmed users`;

  return (
    <div
      className="relative"
      onMouseEnter={openPopover}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        onClick={onOpenPeoplePanel}
        className="flex h-9 items-center overflow-hidden rounded-full bg-[#81c995] pl-1 pr-3 text-[#202124] shadow-sm transition-colors duration-[150ms] hover:bg-[#72bb88]"
      >
        <span className="mr-2 flex h-7 w-7 items-center justify-center rounded-full bg-[#137333] text-white">
          <UserPlus className="h-4 w-4" strokeWidth={2.25} />
        </span>
        <span className="text-sm font-medium tracking-tight">
          Admit {count} guest{count === 1 ? "" : "s"}
        </span>
      </button>

      {hoverOpen && (
        <div
          className="absolute right-0 top-[calc(100%+10px)] z-[80] w-[min(340px,calc(100vw-24px))] animate-fade-in rounded-[24px] bg-[#2d2e30] p-6 shadow-[0_8px_32px_rgba(0,0,0,0.45)] ring-1 ring-white/8"
          onMouseEnter={openPopover}
          onMouseLeave={scheduleClose}
        >
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[15px] font-medium text-white">Waiting to join</h3>
            <span className="rounded-full bg-[#3c4043] px-2.5 py-0.5 text-[11px] font-normal text-[#9aa0a6]">
              Visible to hosts
            </span>
          </div>

          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={() => onAdmit(first.socketId)}
              className="h-9 flex-1 rounded-full border border-[#5f6368] text-sm font-medium text-white transition-colors duration-[150ms] hover:bg-white/8"
            >
              Admit
            </button>
            <button
              type="button"
              onClick={() => onDeny(first.socketId)}
              className="h-9 flex-1 rounded-full border border-[#5f6368] text-sm font-medium text-white transition-colors duration-[150ms] hover:bg-white/8"
            >
              Deny
            </button>
          </div>

          <div className="mt-4 rounded-2xl bg-[#3c4043] px-4 py-3">
            <div className="flex items-center gap-3">
              <MeetPersonAvatar
                name={first.displayName}
                email={first.email}
                image={first.image}
                size="sm"
              />
              <div className="min-w-0">
                <p className="text-sm font-normal text-white">{guestLabel}</p>
                <p className="truncate text-xs text-[#9aa0a6]">{first.displayName}</p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenPeoplePanel}
            className="mt-5 flex w-full items-center justify-center gap-0.5 text-sm font-medium text-[#8ab4f8] transition-colors duration-[150ms] hover:text-[#aecbfa]"
          >
            View all ({count})
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
