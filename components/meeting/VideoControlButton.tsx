import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type VideoControlButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: ReactNode;
  label: string;
  active?: boolean;
  destructive?: boolean;
};

export function VideoControlButton({
  icon,
  label,
  active = false,
  destructive = false,
  className,
  ...props
}: VideoControlButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "flex h-11 min-w-11 items-center justify-center rounded-full px-3 text-white transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8ab4f8]",
        destructive
          ? "bg-[#ea4335] hover:bg-[#c5221f]"
          : active
            ? "bg-[#8ab4f8] text-[#202124] hover:bg-[#aecbfa]"
            : "bg-[#3c4043] hover:bg-[#4a4d50]",
        className
      )}
      {...props}
    >
      {icon}
    </button>
  );
}
