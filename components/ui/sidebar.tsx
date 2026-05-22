"use client";

import { Calendar, Phone } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  {
    id: "meetings",
    label: "Meetings",
    icon: <Calendar className="h-5 w-5" />,
  },
  {
    id: "calls",
    label: "Calls",
    icon: <Phone className="h-5 w-5" />,
  },
];

interface SidebarProps {
  activeItem?: string;
  onItemClick?: (id: string) => void;
}

export function Sidebar({ activeItem = "meetings", onItemClick }: SidebarProps) {
  return (
    <aside className="w-[232px] shrink-0 bg-white py-2">
      <nav className="flex flex-col gap-1 px-3">
        {navItems.map((item) => {
          const isActive = activeItem === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onItemClick?.(item.id)}
              className={cn(
                "flex h-10 items-center gap-3 rounded-full px-4 text-sm font-medium transition-colors",
                isActive
                  ? "bg-blue-100 text-blue-700"
                  : "text-gray-700 hover:bg-gray-100"
              )}
            >
              <span
                className={cn(
                  isActive ? "text-blue-700" : "text-gray-600"
                )}
              >
                {item.icon}
              </span>
              {item.label}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
