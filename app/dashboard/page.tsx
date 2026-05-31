"use client";

import { useEffect, useState } from "react";
import { Header } from "../../components/ui/header";
import { Sidebar } from "../../components/ui/sidebar";
import { MainContent } from "../../components/ui/maincontent";
import { CallsPanel } from "../../components/ui/calls-panel";

export default function MeetPage() {
  const [activeNavItem, setActiveNavItem] = useState("meetings");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    if (token) {
      localStorage.setItem("authToken", token);
      window.history.replaceState(null, "", "/dashboard");
    }
  }, []);

  return (
    <div className="flex h-screen flex-col bg-white">
      {/* Header */}
      <Header />

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - hidden on mobile */}
        <div className="hidden md:block">
          <Sidebar activeItem={activeNavItem} onItemClick={setActiveNavItem} />
        </div>

        {/* Main content */}
        {activeNavItem === "calls" ? <CallsPanel /> : <MainContent />}
      </div>
    </div>
  );
}
