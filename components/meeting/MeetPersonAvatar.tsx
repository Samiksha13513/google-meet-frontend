"use client";

import { getDisplayInitial } from "@/lib/display-name";
import { getAvatarColor } from "@/lib/avatar-color";

type MeetPersonAvatarProps = {
  name: string;
  email?: string;
  image?: string;
  size?: "xs" | "sm" | "md" | "lg";
};

const sizeMap = {
  xs: "h-8 w-8 text-xs",
  sm: "h-10 w-10 text-sm",
  md: "h-11 w-11 text-base",
  lg: "h-14 w-14 text-lg",
};

export function MeetPersonAvatar({
  name,
  email,
  image,
  size = "sm",
}: MeetPersonAvatarProps) {
  const initial = getDisplayInitial(name);
  const bg = getAvatarColor(name || email || "guest");

  return (
    <div
      className={`${sizeMap[size]} shrink-0 overflow-hidden rounded-full font-medium text-white flex items-center justify-center`}
      style={{ backgroundColor: bg }}
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
        initial
      )}
    </div>
  );
}
