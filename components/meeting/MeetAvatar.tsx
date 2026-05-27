"use client";

import { getDisplayInitial, getParticipantName } from "@/lib/display-name";

type MeetAvatarProps = {
  displayName: string;
  email?: string;
  image?: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
};

const sizeClasses = {
  sm: "h-9 w-9 text-sm",
  md: "h-11 w-11 text-base",
  lg: "h-24 w-24 text-4xl",
  xl: "h-28 w-28 text-5xl",
};

export function MeetAvatar({
  displayName,
  email,
  image,
  size = "lg",
  className = "",
}: MeetAvatarProps) {
  const name = getParticipantName({ displayName, email });
  const initial = getDisplayInitial(email || name);

  return (
    <div
      className={`${sizeClasses[size]} shrink-0 overflow-hidden rounded-full bg-[#8ab4f8] text-[#202124] ring-1 ring-white/10 flex items-center justify-center font-medium shadow-inner ${className}`}
      title={email || name}
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt={name}
          className="h-full w-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        <span>{initial}</span>
      )}
    </div>
  );
}
