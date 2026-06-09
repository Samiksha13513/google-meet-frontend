/** Stable fingerprint of a stream's tracks (ignores mute state). */
export function getStreamTrackSignature(stream?: MediaStream | null): string {
  if (!stream) return "";
  return stream
    .getTracks()
    .map((track) => `${track.id}:${track.kind}:${track.readyState}`)
    .sort()
    .join("|");
}

/** True when two streams carry the same set of live/ended tracks. */
export function streamsShareSameTracks(
  a?: MediaStream | null,
  b?: MediaStream | null
): boolean {
  return getStreamTrackSignature(a) === getStreamTrackSignature(b);
}

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
