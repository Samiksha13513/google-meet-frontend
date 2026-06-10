import type { Results, SelfieSegmentation } from "@mediapipe/selfie_segmentation";

type SelfieSegmentationCtor = typeof import("@mediapipe/selfie_segmentation").SelfieSegmentation;

export class SelfieBackgroundEffect {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private displayCanvas: HTMLCanvasElement | null = null;
  private displayCtx: CanvasRenderingContext2D | null = null;
  private segmentation: SelfieSegmentation | null = null;
  private sourceVideo: HTMLVideoElement | null = null;
  private animationId: number | null = null;
  private outputStream: MediaStream | null = null;
  private enabled = false;
  private initPromise: Promise<void> | null = null;
  private lastMask: CanvasImageSource | null = null;

  constructor() {
    this.canvas = document.createElement("canvas");
    const ctx = this.canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas 2D context unavailable");
    }
    this.ctx = ctx;
  }

  async init(): Promise<void> {
    if (this.segmentation) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      const module = await import("@mediapipe/selfie_segmentation");
      const SelfieSegmentationClass = module.SelfieSegmentation as SelfieSegmentationCtor;
      const segmentation = new SelfieSegmentationClass({
        locateFile: (file) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation@0.1.1675465747/${file}`,
      });
      segmentation.setOptions({ modelSelection: 1 });
      segmentation.onResults((results: Results) => {
        this.lastMask = results.segmentationMask ?? null;
      });
      this.segmentation = segmentation;
    })();

    return this.initPromise;
  }

  getProcessedStream(): MediaStream | null {
    return this.outputStream;
  }

  async startPreview(
    video: HTMLVideoElement,
    displayCanvas: HTMLCanvasElement
  ): Promise<void> {
    await this.init();
    if (!this.segmentation) {
      throw new Error("Selfie segmentation failed to initialize");
    }

    this.displayCanvas = displayCanvas;
    this.displayCtx = displayCanvas.getContext("2d");
    if (!this.displayCtx) {
      throw new Error("Preview canvas context unavailable");
    }

    this.sourceVideo = video;
    this.enabled = true;
    await this.runRenderLoop(video);
  }

  async start(video: HTMLVideoElement): Promise<MediaStream> {
    await this.init();
    if (!this.segmentation) {
      throw new Error("Selfie segmentation failed to initialize");
    }

    this.sourceVideo = video;
    this.enabled = true;

    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;
    this.canvas.width = width;
    this.canvas.height = height;

    if (!this.outputStream) {
      this.outputStream = this.canvas.captureStream(30);
    }

    await this.runRenderLoop(video);
    return this.outputStream;
  }

  private async runRenderLoop(video: HTMLVideoElement): Promise<void> {
    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;
    this.canvas.width = width;
    this.canvas.height = height;
    if (this.displayCanvas) {
      this.displayCanvas.width = width;
      this.displayCanvas.height = height;
    }

    const render = async () => {
      if (!this.enabled || !this.sourceVideo || !this.segmentation) return;

      const currentWidth = this.sourceVideo.videoWidth || width;
      const currentHeight = this.sourceVideo.videoHeight || height;
      if (this.canvas.width !== currentWidth || this.canvas.height !== currentHeight) {
        this.canvas.width = currentWidth;
        this.canvas.height = currentHeight;
      }
      if (this.displayCanvas && this.displayCanvas.width !== currentWidth) {
        this.displayCanvas.width = currentWidth;
        this.displayCanvas.height = currentHeight;
      }

      if (this.sourceVideo.readyState >= 2) {
        await this.segmentation.send({ image: this.sourceVideo });
        this.drawFrame(this.sourceVideo, this.lastMask);
      }

      this.animationId = window.requestAnimationFrame(() => {
        void render();
      });
    };

    await render();
  }

  stop(): void {
    this.enabled = false;
    if (this.animationId !== null) {
      window.cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.sourceVideo = null;
    this.lastMask = null;
    this.displayCanvas = null;
    this.displayCtx = null;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  destroy(): void {
    this.stop();
    this.outputStream?.getTracks().forEach((track) => track.stop());
    this.outputStream = null;
    this.segmentation?.close();
    this.segmentation = null;
    this.initPromise = null;
  }

  private drawFrame(video: HTMLVideoElement, mask: CanvasImageSource | null) {
    const canvas = this.displayCanvas || this.canvas;
    const ctx = this.displayCtx || this.ctx;
    const { width, height } = canvas;

    ctx.clearRect(0, 0, width, height);

    ctx.save();
    ctx.filter = "blur(16px)";
    ctx.drawImage(video, 0, 0, width, height);
    ctx.restore();

    if (!mask) {
      ctx.drawImage(video, 0, 0, width, height);
      return;
    }

    const offscreen = document.createElement("canvas");
    offscreen.width = width;
    offscreen.height = height;
    const offCtx = offscreen.getContext("2d");
    if (!offCtx) return;

    offCtx.drawImage(video, 0, 0, width, height);
    offCtx.globalCompositeOperation = "destination-in";
    offCtx.drawImage(mask, 0, 0, width, height);

    ctx.drawImage(offscreen, 0, 0, width, height);
  }
}
