export type BlurIntensity = "none" | "light" | "medium" | "heavy";

export type VirtualBackgroundId =
  | "none"
  | "beach"
  | "office"
  | "cafe"
  | "living-room"
  | "library"
  | "custom";

export type AppearanceFilter =
  | "none"
  | "natural"
  | "warm"
  | "cool"
  | "studio"
  | "black-white"
  | "soft-light"
  | "enhanced-contrast";

export type PortraitLighting = "none" | "natural" | "studio" | "soft";

export type VisualEffectsConfig = {
  isEnabled: boolean;
  selectedBackground: VirtualBackgroundId;
  customBackgroundUrl: string | null;
  blurIntensity: BlurIntensity;
  appearanceFilter: AppearanceFilter;
  portraitLighting: PortraitLighting;
  beautyIntensity: number;
};

export type FaceBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type FrameContext = {
  video: HTMLVideoElement;
  mask: CanvasImageSource | null;
  faceBox: FaceBox | null;
  width: number;
  height: number;
};

export const DEFAULT_VISUAL_EFFECTS_CONFIG: VisualEffectsConfig = {
  isEnabled: false,
  selectedBackground: "none",
  customBackgroundUrl: null,
  blurIntensity: "none",
  appearanceFilter: "none",
  portraitLighting: "none",
  beautyIntensity: 0,
};

export const BLUR_PX: Record<Exclude<BlurIntensity, "none">, number> = {
  light: 8,
  medium: 16,
  heavy: 28,
};

export const APPEARANCE_FILTERS: Record<AppearanceFilter, string> = {
  none: "none",
  natural: "saturate(1.05) contrast(1.02) brightness(1.02)",
  warm: "sepia(0.15) saturate(1.2) brightness(1.05) hue-rotate(-8deg)",
  cool: "saturate(0.95) brightness(1.03) hue-rotate(12deg)",
  studio: "contrast(1.08) brightness(1.06) saturate(1.1)",
  "black-white": "grayscale(1) contrast(1.05)",
  "soft-light": "brightness(1.08) contrast(0.92) saturate(0.95)",
  "enhanced-contrast": "contrast(1.18) saturate(1.08)",
};
