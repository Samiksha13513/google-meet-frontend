import type { FaceBox, PortraitLighting } from "./types";

export class PortraitLightingRenderer {
  private lightingCanvas: HTMLCanvasElement;
  private lightingCtx: CanvasRenderingContext2D;

  constructor() {
    this.lightingCanvas = document.createElement("canvas");
    const ctx = this.lightingCanvas.getContext("2d");
    if (!ctx) throw new Error("PortraitLightingRenderer: 2D context unavailable");
    this.lightingCtx = ctx;
  }

  apply(
    ctx: CanvasRenderingContext2D,
    source: CanvasImageSource,
    width: number,
    height: number,
    faceBox: FaceBox | null,
    lighting: PortraitLighting
  ): void {
    if (lighting === "none" || !faceBox) return;

    if (this.lightingCanvas.width !== width) this.lightingCanvas.width = width;
    if (this.lightingCanvas.height !== height) this.lightingCanvas.height = height;

    this.lightingCtx.clearRect(0, 0, width, height);
    this.lightingCtx.drawImage(source, 0, 0, width, height);

    const cx = faceBox.x + faceBox.width / 2;
    const cy = faceBox.y + faceBox.height * 0.42;
    const radius = Math.max(faceBox.width, faceBox.height) * 1.35;

    const overlay = this.lightingCtx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    switch (lighting) {
      case "natural":
        overlay.addColorStop(0, "rgba(255,248,235,0.28)");
        overlay.addColorStop(0.55, "rgba(255,248,235,0.08)");
        overlay.addColorStop(1, "rgba(0,0,0,0)");
        break;
      case "studio":
        overlay.addColorStop(0, "rgba(255,255,255,0.38)");
        overlay.addColorStop(0.45, "rgba(255,255,255,0.12)");
        overlay.addColorStop(1, "rgba(0,0,0,0.12)");
        break;
      case "soft":
        overlay.addColorStop(0, "rgba(255,240,220,0.22)");
        overlay.addColorStop(0.6, "rgba(255,240,220,0.06)");
        overlay.addColorStop(1, "rgba(0,0,0,0)");
        break;
      default:
        return;
    }

    this.lightingCtx.globalCompositeOperation = "soft-light";
    this.lightingCtx.fillStyle = overlay;
    this.lightingCtx.fillRect(0, 0, width, height);
    this.lightingCtx.globalCompositeOperation = "source-over";

    ctx.drawImage(this.lightingCanvas, 0, 0, width, height);
  }
}
