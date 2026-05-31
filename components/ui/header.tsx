"use client";

import { Menu, HelpCircle, Settings, LayoutGrid } from "lucide-react";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { hasValidAuthToken } from "@/lib/auth-token";

export function Header() {
  const router = useRouter();
  const currentTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  const currentDate = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4">
      {/* Left section */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="h-12 w-12 rounded-full text-gray-600 hover:bg-gray-100"
        >
          <Menu className="h-6 w-6" />
        </Button>

        {/* Google Meet Logo */}
 <button
  type="button"
  onClick={() => router.push(hasValidAuthToken() ? "/dashboard" : "/")}
  className="flex items-center gap-1 rounded-full pr-3 transition-colors hover:bg-gray-100"
  aria-label="Go to Google Meet home"
>
  <Image
    src="/logo.png"
    alt="Google Meet"
    width={110}
    height={120}
  />

<span
  className="text-[22px] font-normal tracking-[-0.3px] text-[#1f1f1f]"
  style={{ fontFamily: "Google Sans, Roboto, Arial, sans-serif" }}
>
  Meet
</span>
</button>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-1">
        <span className="mr-2 text-sm text-gray-600">
          {currentTime} • {currentDate}
        </span>

        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-full text-gray-600 hover:bg-gray-100"
        >
          <HelpCircle className="h-5 w-5" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-full text-gray-600 hover:bg-gray-100"
        >
          <svg
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
            <line x1="4" y1="22" x2="4" y2="15" />
          </svg>
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-full text-gray-600 hover:bg-gray-100"
        >
          <Settings className="h-5 w-5" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-full text-gray-600 hover:bg-gray-100"
        >
          <LayoutGrid className="h-5 w-5" />
        </Button>

        <Avatar className="ml-2 h-8 w-8 cursor-pointer bg-teal-600">
          <AvatarFallback className="bg-teal-600 text-sm font-medium text-white">
            S
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
