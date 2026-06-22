"use client";

import type { BlurIntensity } from "@/lib/video-processing/types";
import { useVisualEffectsStore } from "@/store/visualEffectsStore";
import { EffectCard } from "./EffectCard";

const BLUR_OPTIONS: Array<{ id: BlurIntensity; label: string; px: number }> = [
  { id: "none", label: "None", px: 0 },
  { id: "light", label: "Light", px: 8 },
  { id: "medium", label: "Medium", px: 16 },
  { id: "heavy", label: "Heavy", px: 28 },
];

export function BlurSelector() {
  const blurIntensity = useVisualEffectsStore((s) => s.blurIntensity);
  const setBlurIntensity = useVisualEffectsStore((s) => s.setBlurIntensity);

  return (
    <section>
      <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-white/55">Blur</h3>
      <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
        {BLUR_OPTIONS.map((option) => (
          <EffectCard
            key={option.id}
            label={option.label}
            selected={blurIntensity === option.id}
            preview={
              <span
                className="relative block h-full w-full overflow-hidden bg-[#5f6368]"
                style={{
                  backgroundImage:
                    "linear-gradient(135deg, #8ab4f8 0%, #669df6 40%, #3c4043 100%)",
                  filter: option.px ? `blur(${Math.min(option.px, 12)}px)` : "none",
                }}
              />
            }
            onClick={() => setBlurIntensity(option.id)}
          />
        ))}
      </div>
    </section>
  );
}
