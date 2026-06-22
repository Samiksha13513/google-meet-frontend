"use client";

import { useRef } from "react";
import { ImagePlus, XCircle } from "lucide-react";

import { BACKGROUND_PRESETS } from "@/lib/video-processing/backgrounds";
import type { VirtualBackgroundId } from "@/lib/video-processing/types";
import { useVisualEffectsStore } from "@/store/visualEffectsStore";
import { EffectCard, EffectEmptyState } from "./EffectCard";

export function BackgroundSelector() {
  const selectedBackground = useVisualEffectsStore((s) => s.selectedBackground);
  const customBackgroundUrl = useVisualEffectsStore((s) => s.customBackgroundUrl);
  const setBackground = useVisualEffectsStore((s) => s.setBackground);
  const setCustomBackgroundUrl = useVisualEffectsStore((s) => s.setCustomBackgroundUrl);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = (file: File | null) => {
    if (!file) return;
    if (customBackgroundUrl) URL.revokeObjectURL(customBackgroundUrl);
    setCustomBackgroundUrl(URL.createObjectURL(file));
  };

  return (
    <section>
      <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-white/55">Backgrounds</h3>
      <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
        <EffectCard
          label="None"
          selected={selectedBackground === "none"}
          preview={<span className="flex h-full w-full items-center justify-center bg-[#3c4043] text-xs text-white/50">Off</span>}
          onClick={() => setBackground("none")}
        />

        {BACKGROUND_PRESETS.map((preset) => (
          <EffectCard
            key={preset.id}
            label={preset.label}
            selected={selectedBackground === preset.id}
            preview={
              <span
                className="block h-full w-full"
                style={{ background: preset.preview }}
              />
            }
            onClick={() => setBackground(preset.id as VirtualBackgroundId)}
          />
        ))}

        <EffectCard
          label="Upload"
          selected={selectedBackground === "custom"}
          preview={
            customBackgroundUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={customBackgroundUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full flex-col items-center justify-center gap-1 bg-[#3c4043] text-white/60">
                <ImagePlus className="h-5 w-5" />
                <span className="text-[10px]">Upload</span>
              </span>
            )
          }
          onClick={() => fileInputRef.current?.click()}
        />
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => handleUpload(event.target.files?.[0] ?? null)}
      />

      {selectedBackground === "custom" && customBackgroundUrl && (
        <button
          type="button"
          onClick={() => {
            URL.revokeObjectURL(customBackgroundUrl);
            setCustomBackgroundUrl(null);
            setBackground("none");
          }}
          className="mt-3 inline-flex items-center gap-1.5 text-xs text-[#f28b82] hover:text-[#ff9a91]"
        >
          <XCircle className="h-3.5 w-3.5" />
          Remove custom background
        </button>
      )}

      {BACKGROUND_PRESETS.length === 0 && (
        <EffectEmptyState message="No backgrounds available." />
      )}
    </section>
  );
}
