"use client";

import { useState } from "react";
import {
  AlertTriangle,
  ChevronUp,
  Hand,
  Mic,
  MicOff,
  MoreVertical,
  Search,
  UserPlus,
  UserX,
  Video,
  VideoOff,
  X,
} from "lucide-react";

import { MeetPersonAvatar } from "@/components/meeting/MeetPersonAvatar";
import type { AdmitGuestRequest } from "@/components/meeting/AdmitGuestControl";

type InMeetingParticipant = {
  socketId: string;
  displayName: string;
  email?: string;
  image?: string;
  isMicOn: boolean;
  isCameraOn: boolean;
  isHandRaised?: boolean;
  isHost: boolean;
};

type PeoplePanelProps = {
  isHost: boolean;
  localName: string;
  localEmail?: string;
  localImage?: string;
  isLocalMicOn: boolean;
  isLocalCameraOn: boolean;
  isLocalHandRaised: boolean;
  joinRequests: AdmitGuestRequest[];
  participants: InMeetingParticipant[];
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onClose: () => void;
  onAdmit: (socketId: string) => void;
  onDeny: (socketId: string) => void;
  onAdmitAll: () => void;
  onRemove?: (socketId: string) => void;
};

function matchesSearch(text: string, query: string) {
  if (!query.trim()) return true;
  return text.toLowerCase().includes(query.trim().toLowerCase());
}

export function PeoplePanel({
  isHost,
  localName,
  localEmail,
  localImage,
  isLocalMicOn,
  isLocalCameraOn,
  isLocalHandRaised,
  joinRequests,
  participants,
  searchQuery,
  onSearchChange,
  onClose,
  onAdmit,
  onDeny,
  onAdmitAll,
  onRemove,
}: PeoplePanelProps) {
  const [waitingExpanded, setWaitingExpanded] = useState(true);
  const [inMeetingExpanded, setInMeetingExpanded] = useState(true);
  const [openGuestMenu, setOpenGuestMenu] = useState<string | null>(null);

  const filteredWaiting = joinRequests.filter(
    (r) =>
      matchesSearch(r.displayName, searchQuery) ||
      matchesSearch(r.email || "", searchQuery)
  );

  const filteredInMeeting = participants.filter(
    (p) =>
      matchesSearch(p.displayName, searchQuery) ||
      matchesSearch(p.email || "", searchQuery)
  );

  const inMeetingCount = 1 + filteredInMeeting.length;
  const showWaitingSection = isHost && joinRequests.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#202124] md:static md:inset-auto md:h-full md:w-[360px] md:shrink-0 md:border-l md:border-white/10 animate-slide-in">
      <div className="flex items-center justify-between px-5 pb-3 pt-5">
        <h2 className="text-[22px] font-normal leading-7 text-white">People</h2>
        <button
          type="button"
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-full text-white/80 transition-colors duration-[150ms] hover:bg-white/10"
          aria-label="Close people panel"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="px-5 pb-4">
        {/* <button */}
          {/* type="button" */}
          {/* className="flex h-10 items-center gap-2 rounded-full bg-[#041e49] px-4 text-sm font-medium text-white transition-colors duration-[150ms] hover:bg-[#062a66]" */}
        {/* > */}
          {/* <UserPlus className="h-[18px] w-[18px]" /> */}
          {/* Add people */}
        {/* </button> */}

        {/* <div className="mt-4 flex h-11 items-center gap-2 rounded-lg border border-[#3c4043] bg-transparent px-3">
          <Search className="h-[18px] w-[18px] shrink-0 text-[#9aa0a6]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search for people"
            className="w-full bg-transparent text-sm text-white outline-none placeholder:text-[#9aa0a6]"
          />
        </div> */}
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-6">
        {showWaitingSection && (
          <section className="mb-6">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.06em] text-[#9aa0a6]">
              Waiting to join
            </p>

            <div className="overflow-hidden rounded-xl border border-[#3c4043]">
              <button
                type="button"
                onClick={() => setWaitingExpanded((prev) => !prev)}
                className="flex w-full items-center justify-between px-4 py-3 text-left text-sm text-white transition-colors hover:bg-white/5"
              >
                <span>Waiting to be admitted</span>
                <span className="flex items-center gap-2 text-[#9aa0a6]">
                  <span>{joinRequests.length}</span>
                  <ChevronUp
                    className={`h-5 w-5 transition-transform duration-[180ms] ${waitingExpanded ? "" : "rotate-180"}`}
                  />
                </span>
              </button>

              {waitingExpanded && (
                <>
                  <div className="border-t border-[#3c4043] px-4 py-2">
                    <button
                      type="button"
                      onClick={onAdmitAll}
                      className="ml-auto block text-sm font-medium text-[#8ab4f8] transition-colors duration-[150ms] hover:text-[#aecbfa]"
                    >
                      Admit all
                    </button>
                  </div>

                  {filteredWaiting.map((request) => (
                    <div
                      key={request.socketId}
                      className="flex items-start gap-3 border-t border-[#3c4043] px-4 py-3"
                    >
                      <MeetPersonAvatar
                        name={request.displayName}
                        email={request.email}
                        image={request.image}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-white">{request.displayName}</p>
                        <AlertTriangle className="mt-1 h-3.5 w-3.5 text-[#9aa0a6]" strokeWidth={2} />
                        <button
                          type="button"
                          onClick={() => onAdmit(request.socketId)}
                          className="mt-2 text-sm font-medium text-[#8ab4f8] transition-colors duration-[150ms] hover:text-[#aecbfa]"
                        >
                          Admit
                        </button>
                      </div>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() =>
                            setOpenGuestMenu((prev) =>
                              prev === request.socketId ? null : request.socketId
                            )
                          }
                          className="flex h-8 w-8 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10"
                          aria-label="More actions"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                        {openGuestMenu === request.socketId && (
                          <div className="absolute right-0 top-9 z-10 min-w-[120px] rounded-xl border border-[#3c4043] bg-[#2d2e30] py-1 shadow-xl">
                            <button
                              type="button"
                              onClick={() => {
                                onDeny(request.socketId);
                                setOpenGuestMenu(null);
                              }}
                              className="flex w-full px-4 py-2 text-left text-sm text-white hover:bg-white/10"
                            >
                              Deny
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </section>
        )}

        <section>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.06em] text-[#9aa0a6]">
            In the meeting
          </p>

          <div className="overflow-hidden rounded-xl border border-[#3c4043]">
            <button
              type="button"
              onClick={() => setInMeetingExpanded((prev) => !prev)}
              className="flex w-full items-center justify-between px-4 py-3 text-left text-sm text-white transition-colors hover:bg-white/5"
            >
              <span>Contributors</span>
              <span className="flex items-center gap-2 text-[#9aa0a6]">
                <span>{inMeetingCount}</span>
                <ChevronUp
                  className={`h-5 w-5 transition-transform duration-[180ms] ${inMeetingExpanded ? "" : "rotate-180"}`}
                />
              </span>
            </button>

            {inMeetingExpanded && (
              <>
                <div className="flex items-center gap-3 border-t border-[#3c4043] px-4 py-3">
                  <MeetPersonAvatar
                    name={localName}
                    email={localEmail}
                    image={localImage}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-white">{localName} (You)</p>
                    <p className="text-xs text-[#9aa0a6]">
                      {isHost ? "Meeting host" : "In the meeting"}
                    </p>
                  </div>
                  <span className="flex gap-1 text-white/50">
                    {isLocalHandRaised && <Hand className="h-4 w-4 text-[#81c995]" />}
                    {/* {isLocalMicOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4 text-red-400" />} */}
                    {/* {isLocalCameraOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4 text-red-400" />} */}
                  </span>
                </div>

                {filteredInMeeting.map((p) => (
                  <div
                    key={p.socketId}
                    className="flex items-center gap-3 border-t border-[#3c4043] px-4 py-3"
                  >
                    <MeetPersonAvatar
                      name={p.displayName}
                      email={p.email}
                      image={p.image}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-white">{p.displayName}</p>
                      <p className="text-xs text-[#9aa0a6]">
                        {p.isHost ? "Meeting host" : p.email || "In the meeting"}
                      </p>
                    </div>
                    <span className="flex gap-1 text-white/50">
                      {p.isHandRaised && <Hand className="h-4 w-4 text-[#81c995]" />}
                      {p.isMicOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4 text-red-400" />}
                      {p.isCameraOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4 text-red-400" />}
                    </span>
                    {isHost && onRemove && (
                      <button
                        type="button"
                        onClick={() => onRemove(p.socketId)}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-red-500/20 hover:text-red-400"
                        title="Remove participant"
                      >
                        <UserX className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
