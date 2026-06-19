"use client";

import { useEffect, useRef, useCallback } from "react";
import { useShallow } from "zustand/react/shallow";

import { VideoProcessor } from "@/lib/video-processing/VideoProcessor";
import { useVisualEffectsStore } from "@/store/visualEffectsStore";

type UseVisualEffectsPipelineOptions = {
  rawCameraTrack: MediaStreamTrack | null;
  isCameraOn: boolean;
  previewVideoRef?: React.RefObject<HTMLVideoElement | null>;
  previewCanvasRef?: React.RefObject<HTMLCanvasElement | null>;
  publishProcessedTrack?: (track: MediaStreamTrack | null) => Promise<void>;
  active?: boolean;
};

export function useVisualEffectsPipeline({
  rawCameraTrack,
  isCameraOn,
  previewVideoRef,
  previewCanvasRef,
  publishProcessedTrack,
  active = true,
}: UseVisualEffectsPipelineOptions) {
  const processorRef = useRef<VideoProcessor | null>(null);
  const rawVideoRef = useRef<HTMLVideoElement | null>(null);
  const publishedTrackRef = useRef<MediaStreamTrack | null>(null);
  const startingRef = useRef(false);

  const config = useVisualEffectsStore(
    useShallow((s) => ({
      isEnabled: s.isEnabled,
      selectedBackground: s.selectedBackground,
      customBackgroundUrl: s.customBackgroundUrl,
      blurIntensity: s.blurIntensity,
      appearanceFilter: s.appearanceFilter,
      portraitLighting: s.portraitLighting,
      beautyIntensity: s.beautyIntensity,
    }))
  );

  const ensureRawVideo = useCallback(() => {
    if (rawVideoRef.current) return rawVideoRef.current;
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;
    video.style.position = "fixed";
    video.style.opacity = "0";
    video.style.pointerEvents = "none";
    video.style.width = "1px";
    video.style.height = "1px";
    document.body.appendChild(video);
    rawVideoRef.current = video;
    return video;
  }, []);

  const syncPublishedTrack = useCallback(
    async (track: MediaStreamTrack | null) => {
      if (!publishProcessedTrack) return;
      await publishProcessedTrack(track);
      publishedTrackRef.current = track;
    },
    [publishProcessedTrack]
  );

  const startPipeline = useCallback(async () => {
    if (!active || !rawCameraTrack || startingRef.current) return;
    startingRef.current = true;

    try {
      const video = ensureRawVideo();
      video.srcObject = new MediaStream([rawCameraTrack]);
      await video.play().catch(() => undefined);

      const processor = processorRef.current ?? new VideoProcessor();
      processorRef.current = processor;
      processor.setConfig({ ...config, isEnabled: true });

      const needsProcessing = processor.needsProcessing();
      const previewCanvas = previewCanvasRef?.current;
      const previewVideo = previewVideoRef?.current ?? video;

      if (!needsProcessing) {
        processor.stop();
        await syncPublishedTrack(null);
        return;
      }

      if (previewCanvas) {
        await processor.startPreview(previewVideo, previewCanvas);
      } else {
        await processor.start(video);
      }

      const output = processor.getProcessedStream();
      const processedTrack = output?.getVideoTracks()[0] ?? null;
      if (processedTrack) {
        processedTrack.enabled = isCameraOn;
        await syncPublishedTrack(processedTrack);
      }
    } finally {
      startingRef.current = false;
    }
  }, [
    active,
    rawCameraTrack,
    config,
    isCameraOn,
    ensureRawVideo,
    previewCanvasRef,
    previewVideoRef,
    syncPublishedTrack,
  ]);

  useEffect(() => {
    processorRef.current?.setConfig({ ...config, isEnabled: true });
    void startPipeline();
  }, [config, startPipeline]);

  useEffect(() => {
    if (publishedTrackRef.current) {
      publishedTrackRef.current.enabled = isCameraOn;
    }
  }, [isCameraOn]);

  useEffect(() => {
    void startPipeline();
  }, [rawCameraTrack, active, startPipeline]);

  useEffect(() => {
    return () => {
      processorRef.current?.destroy();
      processorRef.current = null;
      if (rawVideoRef.current) {
        rawVideoRef.current.srcObject = null;
        rawVideoRef.current.remove();
        rawVideoRef.current = null;
      }
    };
  }, []);

  return {
    isProcessing: Boolean(processorRef.current?.needsProcessing()),
  };
}
