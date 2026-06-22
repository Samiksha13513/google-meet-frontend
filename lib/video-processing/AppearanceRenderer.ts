import { APPEARANCE_FILTERS, type AppearanceFilter } from "./types";

export class AppearanceRenderer {
  applyFilter(ctx: CanvasRenderingContext2D, filter: AppearanceFilter): void {
    ctx.filter = APPEARANCE_FILTERS[filter] ?? "none";
  }

  resetFilter(ctx: CanvasRenderingContext2D): void {
    ctx.filter = "none";
  }
}
