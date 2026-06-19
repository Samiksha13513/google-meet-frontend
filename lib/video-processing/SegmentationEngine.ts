import type { Results, SelfieSegmentation } from "@mediapipe/selfie_segmentation";

type SelfieSegmentationCtor = typeof import("@mediapipe/selfie_segmentation").SelfieSegmentation;

export class SegmentationEngine {
  private segmentation: SelfieSegmentation | null = null;
  private initPromise: Promise<void> | null = null;
  private lastMask: CanvasImageSource | null = null;

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

  async processFrame(video: HTMLVideoElement): Promise<CanvasImageSource | null> {
    if (!this.segmentation) return null;
    await this.segmentation.send({ image: video });
    return this.lastMask;
  }

  getLastMask(): CanvasImageSource | null {
    return this.lastMask;
  }

  destroy(): void {
    this.segmentation?.close();
    this.segmentation = null;
    this.initPromise = null;
    this.lastMask = null;
  }
}
