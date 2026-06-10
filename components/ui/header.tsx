"use client";

import { useEffect, useMemo, useState } from "react";
import { Menu } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { MEET_LOGO_URL } from "@/lib/meet-brand";
import { cn } from "@/lib/utils";

type AuthUser = {
  id?: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

type HeaderProps = {
  onMenuClick?: () => void;
  isSidebarOpen?: boolean;
};

function readStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;

  const rawUser = localStorage.getItem("user");
  if (!rawUser) return null;

  try {
    return JSON.parse(rawUser);
  } catch {
    try {
      return JSON.parse(decodeURIComponent(rawUser));
    } catch {
      return null;
    }
  }
}

export function Header({ onMenuClick, isSidebarOpen = true }: HeaderProps) {
  const router = useRouter();
  const [now, setNow] = useState(() => new Date());
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    setUser(readStoredUser());

    const handleStorage = () => setUser(readStoredUser());
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  const currentTime = useMemo(
    () =>
      now.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }),
    [now]
  );

  const currentDate = useMemo(
    () =>
      now.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      }),
    [now]
  );

  const displayName = user?.name?.trim() || user?.email?.split("@")[0] || "";
  const fallbackInitial = (displayName || "G").charAt(0).toUpperCase();

  return (
    <header className="z-30 flex h-16 shrink-0 items-center justify-between border-b border-[#e0e0e0] bg-white px-2 pr-3 sm:px-3 sm:pr-4">
      <div className="flex min-w-0 items-center gap-1 sm:gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onMenuClick}
          aria-label={isSidebarOpen ? "Close main menu" : "Open main menu"}
          aria-expanded={isSidebarOpen}
          className="h-12 w-12 shrink-0 rounded-full text-[#5f6368] hover:bg-[#f1f3f4]"
        >
          <Menu className="h-6 w-6 stroke-[1.8]" />
        </Button>

        <button
          type="button"
          onClick={() => router.push("/")}
          className="flex h-12 min-w-0 items-center rounded-full px-2 transition-colors hover:bg-[#f1f3f4]"
          aria-label="Go to Google Meet home"
        >
          <Image
            src={MEET_LOGO_URL}
            alt="Google Meet"
            width={176}
            height={32}
            className="h-8 w-[176px] object-contain"
            priority
          />
        </button>
      </div>

      <div className="flex min-w-0 items-center gap-1">
        <span className="mr-1 hidden whitespace-nowrap text-sm font-normal text-[#5f6368] sm:inline">
          {currentTime} &bull; {currentDate}
        </span>

        {/* <Avatar
          className={cn("ml-1 h-8 w-8 cursor-pointer bg-[#0b8043]")}
          title={displayName || "Account"}
        >
          {user?.image && (
            <AvatarImage src={user.image} alt={displayName} referrerPolicy="no-referrer" />
          )}
          <AvatarFallback className="bg-[#0b8043] text-sm font-medium text-white">
            {fallbackInitial}
          </AvatarFallback>
        </Avatar> */}
      </div>
    </header>
  );
}
