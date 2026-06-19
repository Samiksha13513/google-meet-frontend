"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Sparkles, X } from "lucide-react";

import { useVisualEffectsStore } from "@/store/visualEffectsStore";
import { AppearanceSelector } from "./AppearanceSelector";
import { BackgroundSelector } from "./BackgroundSelector";
import { BlurSelector } from "./BlurSelector";
import { EffectSectionSkeleton } from "./EffectCard";
import { LightingSelector } from "./LightingSelector";

type VisualEffectsTab = "backgrounds" | "blur" | "appearance" | "lighting";

const TABS: Array<{ id: VisualEffectsTab; label: string }> = [
  { id: "backgrounds", label: "Backgrounds" },
  { id: "blur", label: "Blur" },
  { id: "appearance", label: "Appearance" },
  { id: "lighting", label: "Lighting" },
];

type VisualEffectsDrawerProps = {
  open: boolean;
  onClose: () => void;
};

export function VisualEffectsDrawer({ open, onClose }: VisualEffectsDrawerProps) {
  const [activeTab, setActiveTab] = useState<VisualEffectsTab>("backgrounds");
  const [search, setSearch] = useState("");
  const [ready, setReady] = useState(false);
  const resetEffects = useVisualEffectsStore((s) => s.resetEffects);

  useEffect(() => {
    if (!open) {
      setReady(false);
      return;
    }
    const timer = window.setTimeout(() => setReady(true), 180);
    return () => window.clearTimeout(timer);
  }, [open]);

  const normalizedSearch = search.trim().toLowerCase();

  const visibleTabs = useMemo(
    () =>
      normalizedSearch
        ? TABS.filter((tab) => tab.label.toLowerCase().includes(normalizedSearch))
        : TABS,
    [normalizedSearch]
  );

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Close visual effects"
        className="fixed inset-0 z-[70] bg-black/45 backdrop-blur-[1px]"
        onClick={onClose}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Apply visual effects"
        className="fixed inset-y-0 right-0 z-[80] flex w-full max-w-[360px] flex-col border-l border-white/10 bg-[#202124] shadow-[-8px_0_32px_rgba(0,0,0,0.45)] animate-slide-in-right"
      >
        <header className="flex items-start justify-between gap-3 border-b border-white/10 px-5 pb-4 pt-5">
          <div>
            <div className="mb-1 flex items-center gap-2 text-[#8ab4f8]">
              <Sparkles className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wide">Visual effects</span>
            </div>
            <h2 className="text-lg font-normal text-white">Apply visual effects</h2>
            <p className="mt-1 text-xs text-white/55">Changes apply instantly to your camera.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="border-b border-white/10 px-5 py-3">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search effects"
              className="h-10 w-full rounded-full border border-white/10 bg-[#303134] pl-10 pr-4 text-sm text-white placeholder:text-white/45 focus:border-[#8ab4f8] focus:outline-none"
            />
          </label>
        </div>

        <div className="flex gap-1 overflow-x-auto border-b border-white/10 px-4 py-2 no-scrollbar">
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={[
                "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                activeTab === tab.id
                  ? "bg-[#8ab4f8] text-[#202124]"
                  : "text-white/70 hover:bg-white/10 hover:text-white",
              ].join(" ")}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {!ready ? (
            <EffectSectionSkeleton />
          ) : (
            <>
              {(activeTab === "backgrounds" || normalizedSearch.includes("back")) && (
                <div className={activeTab === "backgrounds" ? "block" : "hidden"}>
                  <BackgroundSelector />
                </div>
              )}
              {(activeTab === "blur" || normalizedSearch.includes("blur")) && (
                <div className={activeTab === "blur" ? "block" : "hidden"}>
                  <BlurSelector />
                </div>
              )}
              {(activeTab === "appearance" || normalizedSearch.includes("appear")) && (
                <div className={activeTab === "appearance" ? "block" : "hidden"}>
                  <AppearanceSelector />
                </div>
              )}
              {(activeTab === "lighting" || normalizedSearch.includes("light")) && (
                <div className={activeTab === "lighting" ? "block" : "hidden"}>
                  <LightingSelector />
                </div>
              )}
            </>
          )}
        </div>

        <footer className="border-t border-white/10 px-5 py-4">
          <button
            type="button"
            onClick={() => {
              resetEffects();
            }}
            className="h-10 w-full rounded-full border border-white/15 text-sm text-white/80 transition-colors hover:bg-white/10"
          >
            Reset all effects
          </button>
        </footer>
      </aside>
    </>
  );
}
