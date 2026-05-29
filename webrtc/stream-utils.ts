/** Stop and detach all tracks on a MediaStream (safe for cleanup). */
export function stopMediaStream(stream: MediaStream | null | undefined): void {
  if (!stream) return;
  stream.getTracks().forEach((track) => {
    track.onended = null;
    track.onmute = null;
    track.onunmute = null;
    try {
      track.stop();
    } catch {
      // ignore
    }
  });
}

/** Detach video element without throwing. */
export function detachVideoElement(video: HTMLVideoElement | null): void {
  if (!video) return;
  try {
    video.pause();
    video.srcObject = null;
  } catch {
    // ignore
  }
}
