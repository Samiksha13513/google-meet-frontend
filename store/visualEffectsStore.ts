import { create } from "zustand";
import { persist } from "zustand/middleware";

import type {
  AppearanceFilter,
  BlurIntensity,
  PortraitLighting,
  VirtualBackgroundId,
  VisualEffectsConfig,
} from "@/lib/video-processing/types";
import { DEFAULT_VISUAL_EFFECTS_CONFIG } from "@/lib/video-processing/types";

const STORAGE_KEY = "meet-visual-effects-v1";

type VisualEffectsState = VisualEffectsConfig & {
  isDrawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
  setEnabled: (enabled: boolean) => void;
  setBackground: (background: VirtualBackgroundId) => void;
  setCustomBackgroundUrl: (url: string | null) => void;
  setBlurIntensity: (intensity: BlurIntensity) => void;
  setAppearanceFilter: (filter: AppearanceFilter) => void;
  setPortraitLighting: (lighting: PortraitLighting) => void;
  setBeautyIntensity: (intensity: number) => void;
  applyConfig: (config: Partial<VisualEffectsConfig>) => void;
  resetEffects: () => void;
};

export const useVisualEffectsStore = create<VisualEffectsState>()(
  persist(
    (set) => ({
      ...DEFAULT_VISUAL_EFFECTS_CONFIG,
      isDrawerOpen: false,

      setDrawerOpen: (open) => set({ isDrawerOpen: open }),

      setEnabled: (enabled) => set({ isEnabled: enabled }),

      setBackground: (background) =>
        set((state) => ({
          selectedBackground: background,
          blurIntensity: background !== "none" ? "none" : state.blurIntensity,
          isEnabled:
            background !== "none" ||
            state.blurIntensity !== "none" ||
            state.appearanceFilter !== "none" ||
            state.portraitLighting !== "none" ||
            state.beautyIntensity > 0,
        })),

      setBlurIntensity: (intensity) =>
        set((state) => ({
          blurIntensity: intensity,
          selectedBackground: intensity !== "none" ? "none" : state.selectedBackground,
          isEnabled:
            intensity !== "none" ||
            state.selectedBackground !== "none" ||
            state.appearanceFilter !== "none" ||
            state.portraitLighting !== "none" ||
            state.beautyIntensity > 0,
        })),

      setAppearanceFilter: (filter) =>
        set((state) => ({
          appearanceFilter: filter,
          isEnabled:
            filter !== "none" ||
            state.selectedBackground !== "none" ||
            state.blurIntensity !== "none" ||
            state.portraitLighting !== "none" ||
            state.beautyIntensity > 0,
        })),

      setPortraitLighting: (lighting) =>
        set((state) => ({
          portraitLighting: lighting,
          isEnabled:
            lighting !== "none" ||
            state.selectedBackground !== "none" ||
            state.blurIntensity !== "none" ||
            state.appearanceFilter !== "none" ||
            state.beautyIntensity > 0,
        })),

      setBeautyIntensity: (intensity) =>
        set((state) => {
          const next = Math.min(1, Math.max(0, intensity));
          return {
            beautyIntensity: next,
            isEnabled:
              next > 0 ||
              state.selectedBackground !== "none" ||
              state.blurIntensity !== "none" ||
              state.appearanceFilter !== "none" ||
              state.portraitLighting !== "none",
          };
        }),

      setCustomBackgroundUrl: (url) =>
        set((state) => ({
          customBackgroundUrl: url,
          selectedBackground: url ? "custom" : state.selectedBackground,
          blurIntensity: url ? "none" : state.blurIntensity,
          isEnabled:
            Boolean(url) ||
            state.blurIntensity !== "none" ||
            state.appearanceFilter !== "none" ||
            state.portraitLighting !== "none" ||
            state.beautyIntensity > 0,
        })),

      applyConfig: (config) => set((state) => ({ ...state, ...config })),

      resetEffects: () =>
        set({
          ...DEFAULT_VISUAL_EFFECTS_CONFIG,
          isDrawerOpen: false,
        }),
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({
        isEnabled: state.isEnabled,
        selectedBackground:
          state.selectedBackground === "custom" ? "none" : state.selectedBackground,
        blurIntensity: state.blurIntensity,
        appearanceFilter: state.appearanceFilter,
        portraitLighting: state.portraitLighting,
        beautyIntensity: state.beautyIntensity,
      }),
      onRehydrateStorage: () => (state) => {
        if (typeof window === "undefined" || !state) return;
        const legacy = window.localStorage.getItem("meet-preview-visual-effect");
        if (legacy === "blur" && state.blurIntensity === "none" && state.selectedBackground === "none") {
          state.setBlurIntensity("medium");
        }
      },
    }
  )
);

export function getActiveEffectsSummary(state: VisualEffectsConfig): string {
  if (state.selectedBackground !== "none") return "Background";
  if (state.blurIntensity !== "none") return "Blur";
  if (state.appearanceFilter !== "none") return "Appearance";
  if (state.portraitLighting !== "none") return "Lighting";
  if (state.beautyIntensity > 0) return "Beauty";
  return "None";
}
