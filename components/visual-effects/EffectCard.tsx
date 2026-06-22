"use client";

import type { ReactNode } from "react";
import { Check } from "lucide-react";

type EffectCardProps = {
  label: string;
  selected?: boolean;
  loading?: boolean;
  preview: ReactNode;
  onClick: () => void;
};

export function EffectCard({ label, selected, loading, preview, onClick }: EffectCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={[
        "group relative flex w-[88px] shrink-0 flex-col gap-1.5 text-left transition-transform duration-150",
        loading ? "opacity-60" : "hover:scale-[1.02]",
      ].join(" ")}
      aria-pressed={selected}
    >
      <span
        className={[
          "relative aspect-[4/3] w-full overflow-hidden rounded-xl border-2 transition-colors duration-150",
          selected
            ? "border-[#8ab4f8] ring-2 ring-[#8ab4f8]/35"
            : "border-transparent group-hover:border-white/20",
        ].join(" ")}
      >
        {loading ? (
          <span className="absolute inset-0 animate-pulse bg-white/10" />
        ) : (
          preview
        )}
        {selected && (
          <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#8ab4f8] text-[#202124] shadow-sm">
            <Check className="h-3 w-3" strokeWidth={3} />
          </span>
        )}
      </span>
      <span className="truncate px-0.5 text-[11px] font-medium text-white/85">{label}</span>
    </button>
  );
}

export function EffectSectionSkeleton() {
  return (
    <div className="flex gap-3 overflow-x-auto pb-1">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="w-[88px] shrink-0">
          <div className="aspect-[4/3] animate-pulse rounded-xl bg-white/10" />
          <div className="mt-1.5 h-3 animate-pulse rounded bg-white/10" />
        </div>
      ))}
    </div>
  );
}

export function EffectEmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-white/15 px-4 py-6 text-center text-sm text-white/55">
      {message}
    </div>
  );
}
