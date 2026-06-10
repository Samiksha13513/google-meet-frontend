"use client";

import Image from "next/image";

const WORDMARK_SRC = "/google-meet-wordmark.svg";

type MeetWordmarkProps = {
  className?: string;
  height?: number;
};

export function MeetWordmark({ className = "", height = 32 }: MeetWordmarkProps) {
  return (
    <Image
      src={WORDMARK_SRC}
      alt="Google Meet"
      width={Math.round(height * 5.5)}
      height={height}
      className={className}
      priority
    />
  );
}
