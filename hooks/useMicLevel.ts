"use client";

import { useEffect, useRef, useState } from "react";

export function useMicLevel(
  stream: MediaStream | null | undefined,
  enabled: boolean
): number {
  const [level, setLevel] = useState(0);
  const smoothedLevelRef = useRef(0);
  const renderedLevelRef = useRef(0);

  useEffect(() => {
    if (!enabled || !stream) {
      smoothedLevelRef.current = 0;
      if (renderedLevelRef.current !== 0) {
        renderedLevelRef.current = 0;
        setLevel(0);
      }
      return;
    }

    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack || audioTrack.readyState === "ended") {
      smoothedLevelRef.current = 0;
      if (renderedLevelRef.current !== 0) {
        renderedLevelRef.current = 0;
        setLevel(0);
      }
      return;
    }

    let cancelled = false;
    let rafId = 0;
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(new MediaStream([audioTrack]));
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);

    const data = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      if (cancelled) return;
      analyser.getByteFrequencyData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i += 1) {
        sum += data[i];
      }
      const average = sum / data.length / 255;
      const smoothed = smoothedLevelRef.current * 0.72 + average * 0.28;
      smoothedLevelRef.current = smoothed;
      if (Math.abs(smoothed - renderedLevelRef.current) > 0.012) {
        renderedLevelRef.current = smoothed;
        setLevel(smoothed);
      }
      rafId = window.requestAnimationFrame(tick);
    };

    tick();

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(rafId);
      source.disconnect();
      analyser.disconnect();
      void audioContext.close();
    };
  }, [stream, enabled]);

  return level;
}
