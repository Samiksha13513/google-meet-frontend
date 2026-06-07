"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "../../components/ui/header";
import { Sidebar } from "../../components/ui/sidebar";
import { MainContent } from "../../components/ui/maincontent";
import { CallsPanel } from "../../components/ui/calls-panel";
import { hasValidAuthToken } from "@/lib/auth-token";

export default function MeetPage() {
  const router = useRouter();
  const [activeNavItem, setActiveNavItem] = useState("meetings");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    if (token) {
      localStorage.setItem("authToken", token);
      window.history.replaceState(null, "", "/dashboard");
    }
  }, []);

  useEffect(() => {
    if (!hasValidAuthToken()) {
      router.replace("/");
    }
  }, [router]);

  useEffect(() => {
    const syncTab = () => {
      const params = new URLSearchParams(window.location.search);
      setActiveNavItem(params.get("tab") === "calls" ? "calls" : "meetings");
    };

    syncTab();
    window.addEventListener("popstate", syncTab);
    return () => window.removeEventListener("popstate", syncTab);
  }, []);

  const handleNavItemClick = (id: string) => {
    setActiveNavItem(id);
    setIsMobileSidebarOpen(false);
    router.push(id === "calls" ? "/dashboard?tab=calls" : "/dashboard");
  };

  return (
    <div className="flex h-screen flex-col bg-white">
      {/* Header */}
      <Header
        isSidebarOpen={isSidebarOpen || isMobileSidebarOpen}
        onMenuClick={() => {
          if (window.matchMedia("(max-width: 767px)").matches) {
            setIsMobileSidebarOpen((open) => !open);
            return;
          }

          setIsSidebarOpen((open) => !open);
        }}
      />

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        <div className="hidden md:block">
          <Sidebar
            activeItem={activeNavItem}
            isOpen={isSidebarOpen}
            onItemClick={handleNavItemClick}
          />
        </div>

        <div className="md:hidden">
          {isMobileSidebarOpen && (
            <button
              type="button"
              aria-label="Close main menu"
              onClick={() => setIsMobileSidebarOpen(false)}
              className="fixed inset-x-0 bottom-0 top-16 z-30 bg-black/20 transition-opacity"
            />
          )}
          <Sidebar
            activeItem={activeNavItem}
            isOpen={isMobileSidebarOpen}
            isMobile
            onItemClick={handleNavItemClick}
          />
        </div>

        {/* Main content */}
        {activeNavItem === "calls" ? <CallsPanel /> : <MainContent />}
      </div>
    </div>
  );
}
