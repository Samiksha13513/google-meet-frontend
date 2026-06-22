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
      console.log("[VFX] syncPublishedTrack: about to publish", track ? {id: track.id, kind: track.kind, readyState: track.readyState} : null);
      await publishProcessedTrack(track);
      publishedTrackRef.current = track;
      console.log("[VFX] syncPublishedTrack: published successfully, current publishedTrack=", publishedTrackRef.current ? {id: publishedTrackRef.current.id} : null);
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

      console.log("[VFX] startPipeline: needsProcessing=", needsProcessing, "hasPreviewCanvas=", !!previewCanvas, "rawTrack=", rawCameraTrack ? {id: rawCameraTrack.id, readyState: rawCameraTrack.readyState, muted: rawCameraTrack.muted} : null);

      if (!needsProcessing) {
        processor.stop();
        console.log("[VFX] startPipeline: no processing needed, publishing null (revert to raw)");
        await syncPublishedTrack(null);
        return;
      }

      if (previewCanvas) {
        console.log("[VFX] startPipeline: using startPreview mode");
        await processor.startPreview(previewVideo, previewCanvas);
      } else {
        console.log("[VFX] startPipeline: using start mode (no preview canvas)");
        await processor.start(video);
      }

      const output = processor.getProcessedStream();
      const processedTrack = output?.getVideoTracks()[0] ?? null;
      console.log("[VFX] startPipeline: processedTrack=", processedTrack ? {id: processedTrack.id, readyState: processedTrack.readyState, muted: processedTrack.muted, enabled: processedTrack.enabled} : null);
      if (processedTrack) {
        processedTrack.enabled = isCameraOn;
        console.log("[VFX] startPipeline: publishing processed track to WebRTC");
        await syncPublishedTrack(processedTrack);
      } else {
        console.log("[VFX] startPipeline: NO processed track available");
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
    console.log("[VFX] useEffect[config]: config changed, restarting pipeline");
    processorRef.current?.setConfig({ ...config, isEnabled: true });
    void startPipeline();
  }, [config, startPipeline]);

  useEffect(() => {
    if (publishedTrackRef.current) {
      publishedTrackRef.current.enabled = isCameraOn;
    }
  }, [isCameraOn]);

  useEffect(() => {
    console.log("[VFX] useEffect[rawCameraTrack/active]: rawCameraTrack or active changed, restarting pipeline");
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
