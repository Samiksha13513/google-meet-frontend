import type { FaceDetection, Results } from "@mediapipe/face_detection";

import type { FaceBox } from "./types";

type FaceDetectionCtor = typeof import("@mediapipe/face_detection").FaceDetection;

export class FaceDetectionEngine {
  private detector: FaceDetection | null = null;
  private initPromise: Promise<void> | null = null;
  private lastFaceBox: FaceBox | null = null;

  async init(): Promise<void> {
    if (this.detector) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      const module = await import("@mediapipe/face_detection");
      const FaceDetectionClass = module.FaceDetection as FaceDetectionCtor;
      const detector = new FaceDetectionClass({
        locateFile: (file) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection@0.4.1646425229/${file}`,
      });
      detector.setOptions({ model: "short", minDetectionConfidence: 0.5 });
      detector.onResults((results: Results) => {
        const detection = results.detections[0];
        if (!detection?.boundingBox) {
          this.lastFaceBox = null;
          return;
        }
        const box = detection.boundingBox;
        this.lastFaceBox = {
          x: box.xCenter - box.width / 2,
          y: box.yCenter - box.height / 2,
          width: box.width,
          height: box.height,
        };
      });
      this.detector = detector;
    })();

    return this.initPromise;
  }

  async processFrame(video: HTMLVideoElement, width: number, height: number): Promise<FaceBox | null> {
    if (!this.detector) return null;
    await this.detector.send({ image: video });
    if (!this.lastFaceBox) return null;

    return {
      x: this.lastFaceBox.x * width,
      y: this.lastFaceBox.y * height,
      width: this.lastFaceBox.width * width,
      height: this.lastFaceBox.height * height,
    };
  }

  destroy(): void {
    this.detector?.close();
    this.detector = null;
    this.initPromise = null;
    this.lastFaceBox = null;
  }
}
