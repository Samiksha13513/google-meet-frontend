import type { BlurIntensity } from "./types";
import { BLUR_PX } from "./types";

export class BlurRenderer {
  private blurCanvas: HTMLCanvasElement;
  private blurCtx: CanvasRenderingContext2D;

  constructor() {
    this.blurCanvas = document.createElement("canvas");
    const ctx = this.blurCanvas.getContext("2d");
    if (!ctx) throw new Error("BlurRenderer: 2D context unavailable");
    this.blurCtx = ctx;
  }

  draw(
    ctx: CanvasRenderingContext2D,
    source: CanvasImageSource,
    width: number,
    height: number,
    intensity: BlurIntensity
  ): void {
    if (intensity === "none") return;

    const px = BLUR_PX[intensity];
    if (this.blurCanvas.width !== width) this.blurCanvas.width = width;
    if (this.blurCanvas.height !== height) this.blurCanvas.height = height;

    this.blurCtx.clearRect(0, 0, width, height);
    this.blurCtx.filter = `blur(${px}px)`;
    this.blurCtx.drawImage(source, 0, 0, width, height);
    this.blurCtx.filter = "none";

    ctx.drawImage(this.blurCanvas, 0, 0, width, height);
  }
}
