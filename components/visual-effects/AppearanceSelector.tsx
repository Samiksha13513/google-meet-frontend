"use client";

import type { AppearanceFilter } from "@/lib/video-processing/types";
import { APPEARANCE_FILTERS } from "@/lib/video-processing/types";
import { useVisualEffectsStore } from "@/store/visualEffectsStore";
import { EffectCard } from "./EffectCard";

const APPEARANCE_OPTIONS: Array<{ id: AppearanceFilter; label: string }> = [
  { id: "none", label: "None" },
  { id: "natural", label: "Natural" },
  { id: "warm", label: "Warm" },
  { id: "cool", label: "Cool" },
  { id: "studio", label: "Studio" },
  { id: "black-white", label: "B&W" },
  { id: "soft-light", label: "Soft Light" },
  { id: "enhanced-contrast", label: "Contrast" },
];

export function AppearanceSelector() {
  const appearanceFilter = useVisualEffectsStore((s) => s.appearanceFilter);
  const setAppearanceFilter = useVisualEffectsStore((s) => s.setAppearanceFilter);

  return (
    <section>
      <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-white/55">Appearance</h3>
      <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
        {APPEARANCE_OPTIONS.map((option) => (
          <EffectCard
            key={option.id}
            label={option.label}
            selected={appearanceFilter === option.id}
            preview={
              <span
                className="block h-full w-full"
                style={{
                  background:
                    "linear-gradient(135deg, #fbbc04 0%, #ea4335 45%, #8ab4f8 100%)",
                  filter: APPEARANCE_FILTERS[option.id],
                }}
              />
            }
            onClick={() => setAppearanceFilter(option.id)}
          />
        ))}
      </div>
    </section>
  );
}
