import { AppearanceRenderer } from "./AppearanceRenderer";
import { BackgroundRenderer } from "./BackgroundRenderer";
import { BeautyRenderer } from "./BeautyRenderer";
import { BlurRenderer } from "./BlurRenderer";
import { FaceDetectionEngine } from "./FaceDetectionEngine";
import { PortraitLightingRenderer } from "./PortraitLightingRenderer";
import { SegmentationEngine } from "./SegmentationEngine";
import type { VisualEffectsConfig } from "./types";

export class VideoProcessor {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private displayCanvas: HTMLCanvasElement | null = null;
  private displayCtx: CanvasRenderingContext2D | null = null;
  private maskCanvas: HTMLCanvasElement;
  private maskCtx: CanvasRenderingContext2D;
  private compositeCanvas: HTMLCanvasElement;
  private compositeCtx: CanvasRenderingContext2D;

  private segmentation = new SegmentationEngine();
  private faceDetection = new FaceDetectionEngine();
  private blurRenderer = new BlurRenderer();
  private backgroundRenderer = new BackgroundRenderer();
  private appearanceRenderer = new AppearanceRenderer();
  private portraitLightingRenderer = new PortraitLightingRenderer();
  private beautyRenderer = new BeautyRenderer();

  private sourceVideo: HTMLVideoElement | null = null;
  private animationId: number | null = null;
  private outputStream: MediaStream | null = null;
  private enabled = false;
  private config: VisualEffectsConfig;
  private frameInFlight = false;
  private lastFaceSample = 0;
  private cachedFaceBox: { x: number; y: number; width: number; height: number } | null = null;

  constructor(initialConfig?: Partial<VisualEffectsConfig>) {
    this.config = {
      isEnabled: false,
      selectedBackground: "none",
      customBackgroundUrl: null,
      blurIntensity: "none",
      appearanceFilter: "none",
      portraitLighting: "none",
      beautyIntensity: 0,
      ...initialConfig,
    };

    this.canvas = document.createElement("canvas");
    const ctx = this.canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("VideoProcessor: 2D context unavailable");
    this.ctx = ctx;

    this.maskCanvas = document.createElement("canvas");
    const maskCtx = this.maskCanvas.getContext("2d");
    if (!maskCtx) throw new Error("VideoProcessor: mask context unavailable");
    this.maskCtx = maskCtx;

    this.compositeCanvas = document.createElement("canvas");
    const compositeCtx = this.compositeCanvas.getContext("2d");
    if (!compositeCtx) throw new Error("VideoProcessor: composite context unavailable");
    this.compositeCtx = compositeCtx;
  }

  setConfig(config: Partial<VisualEffectsConfig>): void {
    const prevCustom = this.config.customBackgroundUrl;
    this.config = { ...this.config, ...config };
    if (config.customBackgroundUrl !== undefined && prevCustom !== config.customBackgroundUrl) {
      this.backgroundRenderer.revokeCustomUrl(prevCustom);
    }
    void this.backgroundRenderer.preloadAll(this.config.customBackgroundUrl);
  }

  getConfig(): VisualEffectsConfig {
    return { ...this.config };
  }

  getProcessedStream(): MediaStream | null {
    const stream = this.outputStream;
    if (stream) {
      const track = stream.getVideoTracks()[0];
      console.log("[VP] getProcessedStream: stream=", stream, "track=", track ? {id: track.id, readyState: track.readyState, muted: track.muted, enabled: track.enabled} : null);
    }
    return stream;
  }

  async init(): Promise<void> {
    await Promise.all([this.segmentation.init(), this.faceDetection.init()]);
    await this.backgroundRenderer.preloadAll(this.config.customBackgroundUrl);
  }

  needsProcessing(): boolean {
    const { isEnabled, selectedBackground, blurIntensity, appearanceFilter, portraitLighting, beautyIntensity } =
      this.config;
    return (
      isEnabled &&
      (selectedBackground !== "none" ||
        blurIntensity !== "none" ||
        appearanceFilter !== "none" ||
        portraitLighting !== "none" ||
        beautyIntensity > 0)
    );
  }

  async startPreview(video: HTMLVideoElement, displayCanvas: HTMLCanvasElement): Promise<void> {
    await this.init();
    this.displayCanvas = displayCanvas;
    this.displayCtx = displayCanvas.getContext("2d", { alpha: false });
    if (!this.displayCtx) throw new Error("VideoProcessor: preview context unavailable");
    this.sourceVideo = video;
    this.enabled = true;
    console.log("[VP] startPreview: displayCanvas set, captureCanvas=", this.canvas, "displayCanvas=", displayCanvas);
    this.startLoop();
  }

  async start(video: HTMLVideoElement): Promise<MediaStream> {
    await this.init();
    this.sourceVideo = video;
    this.enabled = true;

    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;
    this.resizeCanvases(width, height);

    if (!this.outputStream) {
      this.outputStream = this.canvas.captureStream(30);
      console.log("[VP] start: captureStream created on this.canvas, stream=", this.outputStream, "tracks=", this.outputStream.getTracks().map(t => ({id: t.id, kind: t.kind, readyState: t.readyState})));
    }

    this.startLoop();
    return this.outputStream;
  }

  private startLoop(): void {
    if (this.animationId !== null) return;

    const tick = () => {
      if (!this.enabled || !this.sourceVideo) return;
      if (!this.frameInFlight) {
        void this.renderFrame();
      }
      this.animationId = window.requestAnimationFrame(tick);
    };

    this.animationId = window.requestAnimationFrame(tick);
  }

  private resizeCanvases(width: number, height: number): void {
    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;
    if (this.maskCanvas.width !== width) this.maskCanvas.width = width;
    if (this.maskCanvas.height !== height) this.maskCanvas.height = height;
    if (this.compositeCanvas.width !== width) this.compositeCanvas.width = width;
    if (this.compositeCanvas.height !== height) this.compositeCanvas.height = height;
    if (this.displayCanvas) {
      if (this.displayCanvas.width !== width) this.displayCanvas.width = width;
      if (this.displayCanvas.height !== height) this.displayCanvas.height = height;
    }
  }

  private async renderFrame(): Promise<void> {
    const video = this.sourceVideo;
    if (!video || video.readyState < 2) return;

    this.frameInFlight = true;
    try {
      const width = video.videoWidth || 640;
      const height = video.videoHeight || 480;
      this.resizeCanvases(width, height);

      const targetCtx = this.displayCtx || this.ctx;
      const targetCanvas = this.displayCanvas || this.canvas;

      console.log("[VP] renderFrame: targetCanvas=", targetCanvas === this.displayCanvas ? "displayCanvas" : "this.canvas", "hasDisplayCanvas=", !!this.displayCanvas, "hasOutputStream=", !!this.outputStream);

      if (!this.needsProcessing()) {
        targetCtx.clearRect(0, 0, width, height);
        targetCtx.drawImage(video, 0, 0, width, height);
        return;
      }

      const mask = await this.segmentation.processFrame(video);

      const now = performance.now();
      if (
        this.config.portraitLighting !== "none" ||
        this.config.beautyIntensity > 0
      ) {
        if (now - this.lastFaceSample > 120) {
          this.cachedFaceBox = await this.faceDetection.processFrame(video, width, height);
          this.lastFaceSample = now;
        }
      } else {
        this.cachedFaceBox = null;
      }

      this.drawProcessedFrame(targetCtx, video, mask, this.cachedFaceBox, width, height);

      if (this.displayCanvas && this.displayCtx && targetCanvas !== this.canvas) {
        this.ctx.drawImage(this.displayCanvas, 0, 0, width, height);
        console.log("[VP] renderFrame: COPIED displayCanvas -> this.canvas for captureStream");
      } else if (!this.displayCanvas) {
        console.log("[VP] renderFrame: NO displayCanvas, drawing directly to this.canvas");
      } else {
        console.log("[VP] renderFrame: SKIPPED copy to this.canvas (targetCanvas IS this.canvas or no displayCtx)");
      }

      // Log capture canvas state
      if (this.outputStream) {
        const captureTrack = this.outputStream.getVideoTracks()[0];
        if (captureTrack) {
          console.log("[VP] renderFrame: captureTrack readyState=", captureTrack.readyState, "muted=", captureTrack.muted, "enabled=", captureTrack.enabled);
        }
      }
    } finally {
      this.frameInFlight = false;
    }
  }

  private drawProcessedFrame(
    ctx: CanvasRenderingContext2D,
    video: HTMLVideoElement,
    mask: CanvasImageSource | null,
    faceBox: { x: number; y: number; width: number; height: number } | null,
    width: number,
    height: number
  ): void {
    const { selectedBackground, customBackgroundUrl, blurIntensity } = this.config;
    const hasVirtualBg = selectedBackground !== "none";
    const hasBlur = blurIntensity !== "none";
    const frameCtx = this.compositeCtx;

    frameCtx.clearRect(0, 0, width, height);

    if (hasVirtualBg) {
      this.backgroundRenderer.draw(frameCtx, width, height, selectedBackground, customBackgroundUrl);
    } else if (hasBlur) {
      this.blurRenderer.draw(frameCtx, video, width, height, blurIntensity);
    } else {
      frameCtx.drawImage(video, 0, 0, width, height);
    }

    if (mask && (hasVirtualBg || hasBlur)) {
      this.maskCtx.clearRect(0, 0, width, height);
      this.maskCtx.drawImage(video, 0, 0, width, height);
      this.maskCtx.globalCompositeOperation = "destination-in";
      this.maskCtx.drawImage(mask, 0, 0, width, height);
      this.maskCtx.globalCompositeOperation = "source-over";
      frameCtx.drawImage(this.maskCanvas, 0, 0, width, height);
    } else if (!hasVirtualBg && !hasBlur) {
      frameCtx.drawImage(video, 0, 0, width, height);
    } else if (!mask) {
      frameCtx.drawImage(video, 0, 0, width, height);
    }

    this.applyPostEffects(ctx, this.compositeCanvas, width, height, faceBox);
  }

  private applyPostEffects(
    ctx: CanvasRenderingContext2D,
    frameCanvas: HTMLCanvasElement,
    width: number,
    height: number,
    faceBox: { x: number; y: number; width: number; height: number } | null
  ): void {
    const { appearanceFilter, portraitLighting, beautyIntensity } = this.config;

    ctx.clearRect(0, 0, width, height);

    if (appearanceFilter !== "none") {
      this.appearanceRenderer.applyFilter(ctx, appearanceFilter);
      ctx.drawImage(frameCanvas, 0, 0, width, height);
      this.appearanceRenderer.resetFilter(ctx);
    } else {
      ctx.drawImage(frameCanvas, 0, 0, width, height);
    }

    this.beautyRenderer.apply(ctx, frameCanvas, width, height, faceBox, beautyIntensity);
    this.portraitLightingRenderer.apply(
      ctx,
      frameCanvas,
      width,
      height,
      faceBox,
      portraitLighting
    );
  }

  stop(): void {
    this.enabled = false;
    if (this.animationId !== null) {
      window.cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.sourceVideo = null;
    this.displayCanvas = null;
    this.displayCtx = null;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  destroy(): void {
    this.stop();
    this.outputStream?.getTracks().forEach((track) => track.stop());
    this.outputStream = null;
    this.segmentation.destroy();
    this.faceDetection.destroy();
    this.backgroundRenderer.revokeCustomUrl(this.config.customBackgroundUrl);
  }
}
