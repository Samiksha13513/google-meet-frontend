"use client";

import { Phone, Video } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
}

const navItems: (NavItem & { primary?: boolean })[] = [
  {
    id: "meetings",
    label: "Meetings",
    icon: <Video className="h-5 w-5 stroke-[1.8]" />,
    primary: true,
  },
  {
    id: "calls",
    label: "Calls",
    icon: <Phone className="h-5 w-5 stroke-[1.8]" />,
    primary: false,
  },
];

interface SidebarProps {
  activeItem?: string;
  isOpen?: boolean;
  isMobile?: boolean;
  onItemClick?: (id: string) => void;
}

export function Sidebar({
  activeItem = "meetings",
  isOpen = true,
  isMobile = false,
  onItemClick,
}: SidebarProps) {
  const itemsToShow = isOpen || isMobile ? navItems : navItems.filter((n) => n.primary);

  return (
    <aside
      className={cn(
        "shrink-0 border-r border-transparent bg-white py-2 transition-all duration-200 ease-out",
        isMobile
          ? "fixed bottom-0 left-0 top-16 z-40 w-[256px] shadow-xl"
          : isOpen
            ? "w-[256px]"
            : "w-[72px] hover:w-[200px]",
        isMobile && !isOpen && "-translate-x-full opacity-0"
      )}
      aria-hidden={isMobile && !isOpen}
    >
      <nav className="flex flex-col gap-1 px-3">
        {itemsToShow.map((item) => {
          const isActive = activeItem === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onItemClick?.(item.id)}
              title={!isOpen && !isMobile ? item.label : undefined}
              className={cn(
                "group flex h-12 items-center rounded-full text-sm font-medium transition-colors",
                isOpen || isMobile ? "gap-4 px-4" : "justify-center px-0",
                isActive ? "bg-[#e8f0fe] text-[#1967d2]" : "text-[#3c4043] hover:bg-[#f1f3f4]"
              )}
            >
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center",
                  isActive ? "text-[#1967d2]" : "text-[#5f6368]"
                )}
              >
                {item.icon}
              </span>
              <span
                className={cn(
                  "whitespace-nowrap transition-[opacity,width] duration-150",
                  isOpen || isMobile ? "w-auto opacity-100" : "w-0 overflow-hidden opacity-0"
                )}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
