"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownLeft,
  ArrowUpRight,
  MessageCircle,
  MoreVertical,
  Phone,
  Search,
  UserRound,
  Video,
  X,
} from "lucide-react";
import {
  type CallHistoryItem,
  type ContactUser,
  getCallHistory,
  getContacts,
  startVideoCall,
} from "@/services/calls-service";
import { googleLogin } from "@/services/auth";

function getInitial(value?: string) {
  return (value || "?").trim().charAt(0).toUpperCase();
}

function AvatarCircle({
  user,
  size = "md",
}: {
  user?: Partial<ContactUser>;
  size?: "sm" | "md" | "lg";
}) {
  const sizes = {
    sm: "h-10 w-10 text-sm",
    md: "h-12 w-12 text-base",
    lg: "h-24 w-24 text-4xl",
  };

  return (
    <div
      className={`${sizes[size]} flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#d7e3fc] font-medium text-[#1967d2]`}
    >
      {user?.avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={user.avatar}
          alt={user.name || user.email || "Contact"}
          className="h-full w-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        <span>{getInitial(user?.name || user?.email)}</span>
      )}
    </div>
  );
}

function formatRelativeTime(value: string) {
  const then = new Date(value).getTime();
  const diff = Date.now() - then;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return "Just now";
  if (diff < hour) return `${Math.floor(diff / minute)} min ago`;
  if (diff < day) return `${Math.floor(diff / hour)} hours ago`;
  if (diff < day * 7) return `${Math.floor(diff / day)} days ago`;

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function formatDuration(seconds?: number | null) {
  if (!seconds) return "";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes === 0) return `${remainingSeconds}s`;
  return `${minutes}m ${remainingSeconds.toString().padStart(2, "0")}s`;
}

function ContactRow({
  user,
  onSelect,
}: {
  user: ContactUser;
  onSelect: (user: ContactUser) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(user)}
      className="flex h-[64px] w-full items-center gap-4 rounded-xl px-4 text-left transition-colors hover:bg-[#f1f3f4] focus:bg-[#e8f0fe] focus:outline-none"
    >
      <AvatarCircle user={user} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium text-[#202124]">
          {user.name || user.email}
        </span>
        <span className="block truncate text-[13px] text-[#5f6368]">
          {user.email}
        </span>
      </span>
    </button>
  );
}

function EmptyState({ signedIn }: { signedIn: boolean }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#f1f3f4] text-[#5f6368]">
        <Phone className="h-9 w-9" />
      </div>
      <h2 className="mt-6 text-[22px] font-normal text-[#202124]">
        {signedIn ? "No call history yet" : "Sign in to view calls"}
      </h2>
      <p className="mt-2 max-w-[360px] text-[14px] leading-6 text-[#5f6368]">
        {signedIn
          ? "Calls you make from Meet will appear here."
          : "Use your Google account to search contacts and start Meet calls."}
      </p>
      {!signedIn && (
        <button
          type="button"
          onClick={() => googleLogin("/dashboard")}
          className="mt-6 h-10 rounded-full bg-[#0b57d0] px-6 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#0842a0]"
        >
          Sign in
        </button>
      )}
    </div>
  );
}

export function CallsPanel() {
  const router = useRouter();
  const modalRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<ContactUser | null>(null);
  const [recentContacts, setRecentContacts] = useState<ContactUser[]>([]);
  const [users, setUsers] = useState<ContactUser[]>([]);
  const [history, setHistory] = useState<CallHistoryItem[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [calling, setCalling] = useState(false);
  const [error, setError] = useState("");
  const [signedIn] = useState(
    () => typeof window !== "undefined" && Boolean(localStorage.getItem("authToken"))
  );

  useEffect(() => {
    let active = true;

    async function loadHistory() {
      if (!signedIn) {
        if (active) setLoadingHistory(false);
        return;
      }

      setLoadingHistory(true);
      try {
        const data = await getCallHistory();
        if (active) setHistory(data.items || []);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Unable to load calls.");
      } finally {
        if (active) setLoadingHistory(false);
      }
    }

    void loadHistory();

    return () => {
      active = false;
    };
  }, [signedIn]);

  useEffect(() => {
    if (!signedIn) {
      return;
    }
    if (!searchOpen) return;

    const timeout = window.setTimeout(() => {
      setLoadingContacts(true);
      getContacts(query)
        .then((data) => {
          setRecentContacts((data.recentContacts || []).map((item) => item.user));
          setUsers(data.users || []);
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : "Unable to search contacts.");
        })
        .finally(() => setLoadingContacts(false));
    }, 160);

    return () => window.clearTimeout(timeout);
  }, [query, searchOpen, signedIn]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!modalRef.current || modalRef.current.contains(event.target as Node)) return;
      setSearchOpen(false);
    }

    if (searchOpen) {
      document.addEventListener("pointerdown", handlePointerDown);
    }

    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [searchOpen]);

  const hasContacts = recentContacts.length > 0 || users.length > 0;

  const historyByDay = useMemo(() => {
    return history.reduce<Record<string, CallHistoryItem[]>>((groups, item) => {
      const date = new Date(item.startedAt || item.createdAt);
      const key = new Intl.DateTimeFormat(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
      }).format(date);
      groups[key] = groups[key] || [];
      groups[key].push(item);
      return groups;
    }, {});
  }, [history]);

  const handleSearchFocus = () => {
    if (!signedIn) {
      googleLogin("/dashboard");
      return;
    }
    setSearchOpen(true);
  };

  const handleSelectContact = (user: ContactUser) => {
    setSelectedContact(user);
    setSearchOpen(false);
    setQuery("");
  };

  const handleVideoCall = async () => {
    if (!selectedContact) return;

    try {
      setCalling(true);
      setError("");
      const response = await startVideoCall(selectedContact.id);
      router.push(`/meeting/${response.meetingCode}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start video call.");
    } finally {
      setCalling(false);
    }
  };

  return (
    <main className="relative flex flex-1 flex-col overflow-hidden bg-white">
      <div className="mx-auto flex w-full max-w-[920px] flex-1 flex-col px-4 pb-8 pt-5 sm:px-8 md:pt-8">
        <div className="relative mx-auto w-full max-w-[720px]" ref={modalRef}>
          <div className="flex h-14 items-center rounded-full bg-[#f1f3f4] px-5 shadow-none transition-shadow focus-within:bg-white focus-within:shadow-[0_1px_6px_rgba(60,64,67,0.28)]">
            <Search className="h-5 w-5 shrink-0 text-[#5f6368]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onFocus={handleSearchFocus}
              placeholder="Search or start a new call"
              className="h-full min-w-0 flex-1 bg-transparent px-4 text-[16px] text-[#202124] outline-none placeholder:text-[#5f6368]"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="flex h-9 w-9 items-center justify-center rounded-full text-[#5f6368] transition-colors hover:bg-[#e0e3e7]"
                aria-label="Clear search"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>

          {searchOpen && (
            <div className="absolute left-1/2 top-[64px] z-40 max-h-[min(660px,calc(100vh-120px))] w-[min(720px,calc(100vw-32px))] -translate-x-1/2 overflow-hidden rounded-[28px] border border-[#dadce0] bg-white shadow-[0_8px_24px_rgba(60,64,67,0.28)]">
              <div className="max-h-[inherit] overflow-y-auto px-3 py-4">
                <div className="px-4 pb-2 text-[13px] font-medium text-[#5f6368]">
                  Recent contacts
                </div>
                {recentContacts.length > 0 ? (
                  <div className="mb-4">
                    {recentContacts.map((user) => (
                      <ContactRow key={user.id} user={user} onSelect={handleSelectContact} />
                    ))}
                  </div>
                ) : (
                  <div className="mb-4 px-4 py-3 text-[14px] text-[#5f6368]">
                    No recent contacts
                  </div>
                )}

                <div className="px-4 pb-2 text-[13px] font-medium text-[#5f6368]">
                  All users
                </div>
                {users.map((user) => (
                  <ContactRow key={user.id} user={user} onSelect={handleSelectContact} />
                ))}

                {!loadingContacts && !hasContacts && (
                  <div className="flex flex-col items-center px-4 py-10 text-center text-[#5f6368]">
                    <UserRound className="h-10 w-10" />
                    <p className="mt-3 text-[14px]">No contacts found</p>
                  </div>
                )}

                {loadingContacts && (
                  <div className="px-4 py-5 text-[14px] text-[#5f6368]">
                    Searching...
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="mx-auto mt-4 w-full max-w-[720px] rounded-xl bg-[#fce8e6] px-4 py-3 text-sm text-[#c5221f]">
            {error}
          </div>
        )}

        <section className="mt-10 flex min-h-0 flex-1 flex-col">
          <h1 className="px-1 text-[22px] font-normal text-[#202124]">History</h1>

          {loadingHistory ? (
            <div className="mt-8 px-1 text-[14px] text-[#5f6368]">Loading calls...</div>
          ) : history.length === 0 ? (
            <EmptyState signedIn={signedIn} />
          ) : (
            <div className="mt-4 overflow-y-auto pb-6">
              {Object.entries(historyByDay).map(([day, items]) => (
                <div key={day} className="mb-5">
                  <div className="px-1 pb-2 text-[13px] font-medium text-[#5f6368]">
                    {day}
                  </div>
                  <div className="space-y-1">
                    {items.map((item) => {
                      const isMissed = item.callType === "missed" || item.status === "missed";
                      const isOutgoing = item.callType === "outgoing";
                      const duration = formatDuration(item.duration);

                      return (
                        <div
                          key={item.id}
                          className="group flex min-h-[72px] items-center gap-4 rounded-2xl px-4 py-3 transition-colors hover:bg-[#f8fafd]"
                        >
                          <AvatarCircle user={item.otherUser} size="md" />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[15px] font-medium text-[#202124]">
                              {item.otherUser?.name || item.otherUser?.email}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-[#5f6368]">
                              <span
                                className={`inline-flex items-center gap-1 ${
                                  isMissed ? "text-[#d93025]" : ""
                                }`}
                              >
                                {isOutgoing ? (
                                  <ArrowUpRight className="h-4 w-4" />
                                ) : (
                                  <ArrowDownLeft className="h-4 w-4" />
                                )}
                                {isMissed ? "Missed" : isOutgoing ? "Outgoing" : "Incoming"}
                              </span>
                              <span>·</span>
                              <span>{formatRelativeTime(item.startedAt || item.createdAt)}</span>
                              {duration && (
                                <>
                                  <span>·</span>
                                  <span>{duration}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedContact(item.otherUser)}
                            className="hidden h-10 w-10 items-center justify-center rounded-full text-[#5f6368] transition-colors hover:bg-[#e8f0fe] hover:text-[#0b57d0] group-hover:flex sm:flex"
                            aria-label="Start video call"
                          >
                            <Video className="h-5 w-5" />
                          </button>
                          <button
                            type="button"
                            className="flex h-10 w-10 items-center justify-center rounded-full text-[#5f6368] transition-colors hover:bg-[#f1f3f4]"
                            aria-label="More options"
                          >
                            <MoreVertical className="h-5 w-5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {selectedContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-[420px] rounded-[28px] bg-white p-6 text-center shadow-[0_12px_32px_rgba(60,64,67,0.32)]">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedContact(null)}
                className="flex h-10 w-10 items-center justify-center rounded-full text-[#5f6368] transition-colors hover:bg-[#f1f3f4]"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex flex-col items-center px-4 pb-2">
              <AvatarCircle user={selectedContact} size="lg" />
              <h2 className="mt-5 max-w-full truncate text-[24px] font-normal text-[#202124]">
                {selectedContact.name || selectedContact.email}
              </h2>
              <p className="mt-1 max-w-full truncate text-[14px] text-[#5f6368]">
                {selectedContact.email}
              </p>
            </div>
            <div className="mt-8 flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={handleVideoCall}
                disabled={calling}
                className="flex h-12 min-w-[128px] items-center justify-center gap-2 rounded-full bg-[#0b57d0] px-5 text-sm font-medium text-white transition-colors hover:bg-[#0842a0] disabled:cursor-not-allowed disabled:opacity-70"
              >
                <Video className="h-5 w-5" />
                {calling ? "Calling..." : "Video call"}
              </button>
              <button
                type="button"
                className="flex h-12 w-12 items-center justify-center rounded-full border border-[#dadce0] text-[#5f6368] transition-colors hover:bg-[#f8fafd]"
                aria-label="Message"
              >
                <MessageCircle className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
