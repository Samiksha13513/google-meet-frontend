/**
 * Screen-share capability detection and safe getDisplayMedia wrapper.
 * Keeps meeting flow unchanged — only centralizes browser/mobile handling.
 */

export type ScreenShareSupport = {
  supported: boolean;
  reason?: string;
  isMobile: boolean;
  isIos: boolean;
  isAndroid: boolean;
};

export type ScreenShareResult =
  | { ok: true; stream: MediaStream }
  | { ok: false; error: string };

function getUserAgent(): string {
  if (typeof navigator === "undefined") return "";
  return navigator.userAgent || "";
}

export function getScreenShareSupport(): ScreenShareSupport {
  const ua = getUserAgent();
  const isMobile = /Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
    ua
  );
  const isIos = /iPhone|iPad|iPod/i.test(ua);
  const isAndroid = /Android/i.test(ua);

  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return {
      supported: false,
      reason: "Screen sharing is only available in the browser.",
      isMobile: false,
      isIos: false,
      isAndroid: false,
    };
  }

  if (!navigator.mediaDevices?.getDisplayMedia) {
    if (isIos) {
      return {
        supported: false,
        reason:
          "Screen sharing is not supported on iPhone or iPad. Use Chrome on Android or a desktop browser.",
        isMobile,
        isIos,
        isAndroid,
      };
    }
    if (isMobile) {
      return {
        supported: false,
        reason:
          "Screen sharing is not supported in this mobile browser. Try Chrome on Android or join from desktop.",
        isMobile,
        isIos,
        isAndroid,
      };
    }
    return {
      supported: false,
      reason: "Screen sharing is not supported in this browser.",
      isMobile,
      isIos,
      isAndroid,
    };
  }

  // WebKit on iOS exposes APIs inconsistently; block to avoid runtime crashes.
  if (isIos) {
    return {
      supported: false,
      reason:
        "Screen sharing is not available on iOS. Use Android Chrome or a desktop browser.",
      isMobile,
      isIos,
      isAndroid,
    };
  }

  return { supported: true, isMobile, isIos, isAndroid };
}

function mapDisplayMediaError(err: unknown, support: ScreenShareSupport): string {
  if (err instanceof DOMException) {
    switch (err.name) {
      case "NotAllowedError":
        return "Screen sharing permission was denied.";
      case "NotFoundError":
        return "No screen or window was selected.";
      case "AbortError":
        return "Screen sharing was cancelled.";
      case "NotSupportedError":
      case "NotReadableError":
        return support.isMobile
          ? "Screen sharing failed on this device. Try Chrome on Android or use desktop."
          : "Screen sharing is not supported or the display is in use.";
      case "SecurityError":
        return "Screen sharing is blocked by browser security settings.";
      default:
        return err.message || "Screen sharing failed.";
    }
  }
  if (err instanceof Error) return err.message;
  return "Screen sharing failed. Please try again.";
}

/**
 * Request a display capture stream with mobile-safe constraints and fallbacks.
 */
export async function requestScreenShareStream(): Promise<ScreenShareResult> {
  const support = getScreenShareSupport();
  if (!support.supported) {
    return { ok: false, error: support.reason || "Screen sharing unavailable." };
  }

  const mediaDevices = navigator.mediaDevices;
  if (!mediaDevices?.getDisplayMedia) {
    return { ok: false, error: support.reason || "Screen sharing unavailable." };
  }

  try {
    // Desktop: prefer video + system/tab audio when available.
    if (!support.isMobile) {
      const stream = await mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });
      return { ok: true, stream };
    }

    // Android Chrome: video first; audio often unsupported for display capture.
    try {
      const stream = await mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });
      return { ok: true, stream };
    } catch {
      const stream = await mediaDevices.getDisplayMedia({ video: true });
      return { ok: true, stream };
    }
  } catch (err) {
    return { ok: false, error: mapDisplayMediaError(err, support) };
  }
}

export function bindScreenShareEndHandlers(
  stream: MediaStream,
  onEnd: () => void
): () => void {
  const handler = () => onEnd();
  const tracks = [...stream.getVideoTracks(), ...stream.getAudioTracks()];
  tracks.forEach((track) => {
    track.addEventListener("ended", handler);
  });
  return () => {
    tracks.forEach((track) => {
      track.removeEventListener("ended", handler);
    });
  };
}

export function isScreenTrackAlive(stream: MediaStream | null): boolean {
  if (!stream) return false;
  const video = stream.getVideoTracks()[0];
  return Boolean(video && video.readyState === "live");
}
