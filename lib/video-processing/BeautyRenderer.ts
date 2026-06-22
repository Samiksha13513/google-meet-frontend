import type { FaceBox } from "./types";

export class BeautyRenderer {
  private beautyCanvas: HTMLCanvasElement;
  private beautyCtx: CanvasRenderingContext2D;

  constructor() {
    this.beautyCanvas = document.createElement("canvas");
    const ctx = this.beautyCanvas.getContext("2d");
    if (!ctx) throw new Error("BeautyRenderer: 2D context unavailable");
    this.beautyCtx = ctx;
  }

  apply(
    ctx: CanvasRenderingContext2D,
    source: CanvasImageSource,
    width: number,
    height: number,
    faceBox: FaceBox | null,
    intensity: number
  ): void {
    if (intensity <= 0 || !faceBox) return;

    const clamped = Math.min(1, Math.max(0, intensity));
    if (this.beautyCanvas.width !== width) this.beautyCanvas.width = width;
    if (this.beautyCanvas.height !== height) this.beautyCanvas.height = height;

    const padX = faceBox.width * 0.18;
    const padY = faceBox.height * 0.22;
    const sx = Math.max(0, faceBox.x - padX);
    const sy = Math.max(0, faceBox.y - padY);
    const sw = Math.min(width - sx, faceBox.width + padX * 2);
    const sh = Math.min(height - sy, faceBox.height + padY * 2);

    this.beautyCtx.clearRect(0, 0, width, height);
    this.beautyCtx.drawImage(source, 0, 0, width, height);

    this.beautyCtx.save();
    this.beautyCtx.beginPath();
    this.beautyCtx.ellipse(
      sx + sw / 2,
      sy + sh / 2,
      sw / 2,
      sh / 2,
      0,
      0,
      Math.PI * 2
    );
    this.beautyCtx.clip();

    const blurPx = 2 + clamped * 4;
    this.beautyCtx.filter = `blur(${blurPx}px) brightness(${1 + clamped * 0.06}) contrast(${1 - clamped * 0.04})`;
    this.beautyCtx.drawImage(source, 0, 0, width, height);
    this.beautyCtx.filter = "none";
    this.beautyCtx.restore();

    ctx.globalAlpha = 0.55 + clamped * 0.35;
    ctx.drawImage(this.beautyCanvas, 0, 0, width, height);
    ctx.globalAlpha = 1;
  }
}
