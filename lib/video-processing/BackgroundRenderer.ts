import { getBackgroundPreset } from "./backgrounds";
import type { VirtualBackgroundId } from "./types";

export class BackgroundRenderer {
  private imageCache = new Map<string, HTMLImageElement>();
  private loadingPromises = new Map<string, Promise<HTMLImageElement>>();

  preload(id: VirtualBackgroundId, customUrl?: string | null): Promise<void> {
    if (id === "none") return Promise.resolve();
    if (id === "custom" && customUrl) {
      return this.loadImage(customUrl).then(() => undefined);
    }
    return Promise.resolve();
  }

  preloadAll(customUrl?: string | null): Promise<void[]> {
    const ids: VirtualBackgroundId[] = ["beach", "office", "cafe", "living-room", "library"];
    const tasks = ids.map((id) => this.preload(id));
    if (customUrl) tasks.push(this.preload("custom", customUrl));
    return Promise.all(tasks);
  }

  draw(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    backgroundId: VirtualBackgroundId,
    customUrl?: string | null
  ): void {
    if (backgroundId === "none") return;

    if (backgroundId === "custom" && customUrl) {
      const image = this.imageCache.get(customUrl);
      if (image?.complete) {
        this.drawCoverImage(ctx, image, width, height);
        return;
      }
      void this.loadImage(customUrl);
      return;
    }

    const preset = getBackgroundPreset(backgroundId);
    preset?.draw(ctx, width, height);
  }

  private drawCoverImage(
    ctx: CanvasRenderingContext2D,
    image: HTMLImageElement,
    width: number,
    height: number
  ) {
    const scale = Math.max(width / image.width, height / image.height);
    const sw = image.width * scale;
    const sh = image.height * scale;
    const sx = (width - sw) / 2;
    const sy = (height - sh) / 2;
    ctx.drawImage(image, sx, sy, sw, sh);
  }

  private loadImage(url: string): Promise<HTMLImageElement> {
    const cached = this.imageCache.get(url);
    if (cached?.complete) return Promise.resolve(cached);

    const pending = this.loadingPromises.get(url);
    if (pending) return pending;

    const promise = new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.onload = () => {
        this.imageCache.set(url, image);
        this.loadingPromises.delete(url);
        resolve(image);
      };
      image.onerror = () => {
        this.loadingPromises.delete(url);
        reject(new Error(`Failed to load background: ${url}`));
      };
      image.src = url;
    });

    this.loadingPromises.set(url, promise);
    return promise;
  }

  revokeCustomUrl(url: string | null): void {
    if (!url) return;
    this.imageCache.delete(url);
    this.loadingPromises.delete(url);
  }
}
