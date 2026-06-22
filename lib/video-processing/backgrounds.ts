import type { VirtualBackgroundId } from "./types";

export type BackgroundPreset = {
  id: VirtualBackgroundId;
  label: string;
  category: "scenes" | "custom";
  /** CSS gradient or image URL */
  preview: string;
  draw: (ctx: CanvasRenderingContext2D, width: number, height: number) => void;
};

function linearGradient(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  stops: Array<[number, string]>
) {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  stops.forEach(([offset, color]) => gradient.addColorStop(offset, color));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function radialAccent(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  cx: number,
  cy: number,
  radius: number,
  color: string
) {
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, "transparent");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

export const BACKGROUND_PRESETS: BackgroundPreset[] = [
  {
    id: "beach",
    label: "Beach",
    category: "scenes",
    preview: "linear-gradient(180deg, #87CEEB 0%, #F4E4BA 55%, #E8C872 100%)",
    draw: (ctx, w, h) => {
      linearGradient(ctx, w, h, [
        [0, "#87CEEB"],
        [0.55, "#F4E4BA"],
        [1, "#E8C872"],
      ]);
      radialAccent(ctx, w, h, w * 0.75, h * 0.18, w * 0.12, "rgba(255,240,180,0.85)");
    },
  },
  {
    id: "office",
    label: "Office",
    category: "scenes",
    preview: "linear-gradient(180deg, #E8EAED 0%, #DADCE0 45%, #9AA0A6 100%)",
    draw: (ctx, w, h) => {
      linearGradient(ctx, w, h, [
        [0, "#E8EAED"],
        [0.45, "#DADCE0"],
        [1, "#9AA0A6"],
      ]);
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fillRect(w * 0.1, h * 0.15, w * 0.35, h * 0.45);
      ctx.fillRect(w * 0.55, h * 0.2, w * 0.3, h * 0.38);
    },
  },
  {
    id: "cafe",
    label: "Cafe",
    category: "scenes",
    preview: "linear-gradient(180deg, #3E2723 0%, #5D4037 50%, #795548 100%)",
    draw: (ctx, w, h) => {
      linearGradient(ctx, w, h, [
        [0, "#3E2723"],
        [0.5, "#5D4037"],
        [1, "#795548"],
      ]);
      radialAccent(ctx, w, h, w * 0.3, h * 0.35, w * 0.25, "rgba(255,183,77,0.25)");
    },
  },
  {
    id: "living-room",
    label: "Living Room",
    category: "scenes",
    preview: "linear-gradient(180deg, #FFF8E1 0%, #D7CCC8 55%, #8D6E63 100%)",
    draw: (ctx, w, h) => {
      linearGradient(ctx, w, h, [
        [0, "#FFF8E1"],
        [0.55, "#D7CCC8"],
        [1, "#8D6E63"],
      ]);
      ctx.fillStyle = "rgba(121,85,72,0.35)";
      ctx.fillRect(0, h * 0.65, w, h * 0.35);
    },
  },
  {
    id: "library",
    label: "Library",
    category: "scenes",
    preview: "linear-gradient(180deg, #1B5E20 0%, #33691E 45%, #4E342E 100%)",
    draw: (ctx, w, h) => {
      linearGradient(ctx, w, h, [
        [0, "#1B5E20"],
        [0.45, "#33691E"],
        [1, "#4E342E"],
      ]);
      for (let i = 0; i < 6; i += 1) {
        ctx.fillStyle = `rgba(62,39,35,${0.35 + i * 0.05})`;
        ctx.fillRect(w * (0.08 + i * 0.15), h * 0.12, w * 0.08, h * 0.55);
      }
    },
  },
];

export function getBackgroundPreset(id: VirtualBackgroundId): BackgroundPreset | null {
  return BACKGROUND_PRESETS.find((preset) => preset.id === id) ?? null;
}
