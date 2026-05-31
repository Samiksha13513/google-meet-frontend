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
    router.push(id === "calls" ? "/dashboard?tab=calls" : "/dashboard");
  };

  return (
    <div className="flex h-screen flex-col bg-white">
      {/* Header */}
      <Header />

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - hidden on mobile */}
        <div className="hidden md:block">
          <Sidebar activeItem={activeNavItem} onItemClick={handleNavItemClick} />
        </div>

        {/* Main content */}
        {activeNavItem === "calls" ? <CallsPanel /> : <MainContent />}
      </div>
    </div>
  );
}
