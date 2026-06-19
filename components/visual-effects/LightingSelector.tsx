"use client";

import type { PortraitLighting } from "@/lib/video-processing/types";
import { useVisualEffectsStore } from "@/store/visualEffectsStore";
import { EffectCard } from "./EffectCard";

const LIGHTING_OPTIONS: Array<{ id: PortraitLighting; label: string; glow: string }> = [
  { id: "none", label: "None", glow: "transparent" },
  { id: "natural", label: "Natural", glow: "rgba(255,248,235,0.55)" },
  { id: "studio", label: "Studio", glow: "rgba(255,255,255,0.65)" },
  { id: "soft", label: "Soft", glow: "rgba(255,230,210,0.45)" },
];

export function LightingSelector() {
  const portraitLighting = useVisualEffectsStore((s) => s.portraitLighting);
  const beautyIntensity = useVisualEffectsStore((s) => s.beautyIntensity);
  const setPortraitLighting = useVisualEffectsStore((s) => s.setPortraitLighting);
  const setBeautyIntensity = useVisualEffectsStore((s) => s.setBeautyIntensity);

  return (
    <section className="space-y-5">
      <div>
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-white/55">
          Portrait lighting
        </h3>
        <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
          {LIGHTING_OPTIONS.map((option) => (
            <EffectCard
              key={option.id}
              label={option.label}
              selected={portraitLighting === option.id}
              preview={
                <span className="relative block h-full w-full bg-[#3c4043]">
                  <span
                    className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full"
                    style={{
                      background: `radial-gradient(circle, ${option.glow} 0%, transparent 70%)`,
                    }}
                  />
                </span>
              }
              onClick={() => setPortraitLighting(option.id)}
            />
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-medium uppercase tracking-wide text-white/55">
            Beauty enhancement
          </h3>
          <span className="text-xs tabular-nums text-white/55">
            {Math.round(beautyIntensity * 100)}%
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(beautyIntensity * 100)}
          onChange={(event) => setBeautyIntensity(Number(event.target.value) / 100)}
          className="meet-effects-slider w-full"
          aria-label="Beauty enhancement intensity"
        />
      </div>
    </section>
  );
}
