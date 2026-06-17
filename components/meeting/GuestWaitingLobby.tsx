"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChevronUp,
  Mic,
  MicOff,
  MoreHorizontal,
  MoreVertical,
  Phone,
  Sparkles,
  Video,
  VideoOff,
} from "lucide-react";

import { getDisplayInitial } from "@/lib/display-name";
import { VoiceActivityIndicator } from "@/components/meeting/VoiceActivityIndicator";
import { useMicLevel } from "@/hooks/useMicLevel";
import { SelfieBackgroundEffect } from "@/webrtc/selfie-effects";

const VISUAL_EFFECT_KEY = "meet-preview-visual-effect";
type VisualEffect = "none" | "blur";

type GuestWaitingLobbyProps = {
  displayName: string;
  image?: string;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isMicOn: boolean;
  isCameraOn: boolean;
  audioInputDevices: MediaDeviceInfo[];
  audioOutputDevices: MediaDeviceInfo[];
  videoInputDevices: MediaDeviceInfo[];
  selectedAudioInputId: string;
  selectedAudioOutputId: string;
  selectedVideoInputId: string;
  onSelectAudioInput: (deviceId: string) => void;
  onSelectAudioOutput: (deviceId: string) => void;
  onSelectVideoInput: (deviceId: string) => void;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onLeave: () => void;
};

const deviceLabel = (device: MediaDeviceInfo, index: number, fallback: string) =>
  device.label || `${fallback} ${index + 1}`;

export function GuestWaitingLobby({
  displayName,
  image,
  videoRef,
  isMicOn,
  isCameraOn,
  audioInputDevices,
  audioOutputDevices,
  videoInputDevices,
  selectedAudioInputId,
  selectedAudioOutputId,
  selectedVideoInputId,
  onSelectAudioInput,
  onSelectAudioOutput,
  onSelectVideoInput,
  onToggleMic,
  onToggleCamera,
  onLeave,
}: GuestWaitingLobbyProps) {
  const initial = getDisplayInitial(displayName);
  const [openMenu, setOpenMenu] = useState<"audio" | "video" | "effects" | null>(null);
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const [selectedEffect, setSelectedEffect] = useState<VisualEffect>(() => {
    if (typeof window === "undefined") return "none";
    return localStorage.getItem(VISUAL_EFFECT_KEY) === "blur" ? "blur" : "none";
  });
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const selfieEffectRef = useRef<SelfieBackgroundEffect | null>(null);
  const micLevel = useMicLevel(previewStream, isMicOn);
  const showProcessedPreview = isCameraOn && selectedEffect === "blur";

  useEffect(() => {
    const syncStream = () => {
      const stream = videoRef.current?.srcObject;
      setPreviewStream(stream instanceof MediaStream ? stream : null);
    };

    syncStream();
    const intervalId = window.setInterval(syncStream, 400);
    return () => window.clearInterval(intervalId);
  }, [videoRef]);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = previewCanvasRef.current;

    if (selectedEffect !== "blur" || !isCameraOn || !video || !canvas) {
      selfieEffectRef.current?.stop();
      return;
    }

    let cancelled = false;
    const effect = selfieEffectRef.current ?? new SelfieBackgroundEffect();
    selfieEffectRef.current = effect;

    void effect.startPreview(video, canvas).catch((error) => {
      console.warn("[SelfieEffects] waiting preview failed:", error);
      if (!cancelled) {
        setSelectedEffect("none");
      }
    });

    return () => {
      cancelled = true;
      effect.stop();
    };
  }, [selectedEffect, isCameraOn, videoRef]);

  useEffect(() => {
    return () => {
      selfieEffectRef.current?.destroy();
      selfieEffectRef.current = null;
    };
  }, []);

  const selectEffect = (effect: VisualEffect) => {
    setSelectedEffect(effect);
    if (typeof window !== "undefined") {
      localStorage.setItem(VISUAL_EFFECT_KEY, effect);
    }
    setOpenMenu(null);
  };

  const renderDeviceMenu = (
    devices: MediaDeviceInfo[],
    selectedDeviceId: string,
    fallbackLabel: string,
    onSelectDevice: (deviceId: string) => void
  ) => (
    <div className="absolute bottom-[calc(100%+10px)] left-1/2 z-50 w-64 -translate-x-1/2 rounded-2xl border border-white/10 bg-[#303134] p-2 shadow-2xl">
      {devices.length > 0 ? (
        devices.map((device, index) => (
          <button
            key={device.deviceId}
            type="button"
            onClick={() => {
              onSelectDevice(device.deviceId);
              setOpenMenu(null);
            }}
            className={[
              "flex w-full items-center rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-white/10",
              device.deviceId === selectedDeviceId ? "bg-[#8ab4f8] text-[#202124]" : "text-white/90",
            ].join(" ")}
            title={deviceLabel(device, index, fallbackLabel)}
          >
            <span className="truncate">{deviceLabel(device, index, fallbackLabel)}</span>
          </button>
        ))
      ) : (
        <div className="px-3 py-2 text-sm text-white/50">No devices found</div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 flex flex-col bg-[#202124] text-white select-none overflow-hidden">
      <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 pb-32 pt-8">
        <div className="flex max-w-[520px] items-center justify-center gap-3 text-center">
          <span
            className="inline-block h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-[#8ab4f8] border-t-transparent"
            aria-hidden
          />
          <p className="text-[15px] font-normal leading-6 text-white/90 sm:text-base">
            Please wait until a meeting host brings you into the call
          </p>
        </div>

        <div className="relative aspect-video w-full max-w-[720px] overflow-hidden rounded-2xl bg-[#3c4043] shadow-2xl ring-1 ring-white/10">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className={`h-full w-full object-cover ${isCameraOn && !showProcessedPreview ? "block" : "hidden"}`}
          />
          <canvas
            ref={previewCanvasRef}
            className={`h-full w-full object-cover ${showProcessedPreview ? "block" : "hidden"}`}
          />
          {!isCameraOn && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#3c4043]">
              <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-[#78909c] text-4xl font-medium text-white">
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={image}
                    alt={displayName}
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  initial
                )}
              </div>
            </div>
          )}
          <div className="absolute left-4 top-4 max-w-[70%] truncate text-sm font-medium text-white drop-shadow-sm">
            {displayName}
          </div>
        </div>
      </main>

      {/* Bottom control bar */}
      <div className="absolute bottom-0 left-0 right-0 z-30 flex items-center justify-center px-4 pb-[max(env(safe-area-inset-bottom),16px)] pt-3">
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Mic group */}
          <div className="relative flex items-center rounded-full bg-[#3c4043]">
            <button
              type="button"
              title="More audio options"
              onClick={() => setOpenMenu((prev) => (prev === "audio" ? null : "audio"))}
              className="flex h-11 w-10 items-center justify-center text-white/90 transition-colors duration-[180ms] hover:bg-[#4f5357] sm:h-12 sm:w-11"
            >
              <MoreHorizontal className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={onToggleMic}
              title={isMicOn ? "Turn off microphone" : "Turn on microphone"}
              className={`meet-control-btn h-11 w-11 sm:h-12 sm:w-12 ${isMicOn ? "meet-control-btn-neutral rounded-none" : "meet-control-btn-danger rounded-none"}`}
            >
              <span className="flex items-center justify-center gap-1.5">
                <VoiceActivityIndicator
                  level={micLevel}
                  active={isMicOn}
                  size="sm"
                  variant="inline"
                />
                {isMicOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
              </span>
            </button>
            <button
              type="button"
              title="Audio settings"
              onClick={() => setOpenMenu((prev) => (prev === "audio" ? null : "audio"))}
              className="flex h-11 w-9 items-center justify-center border-l border-white/10 text-white/80 transition-colors duration-[180ms] hover:bg-[#4f5357] sm:h-12 sm:w-10"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
            {openMenu === "audio" &&
              renderDeviceMenu(
                [...audioInputDevices, ...audioOutputDevices],
                selectedAudioInputId || selectedAudioOutputId,
                audioInputDevices.length ? "Microphone" : "Speaker",
                (deviceId) => {
                  if (audioInputDevices.some((device) => device.deviceId === deviceId)) {
                    onSelectAudioInput(deviceId);
                  } else {
                    onSelectAudioOutput(deviceId);
                  }
                }
              )}
          </div>

          {/* Camera group */}
          <div className="relative flex items-center rounded-full bg-[#3c4043]">
            <button
              type="button"
              title="Video settings"
              onClick={() => setOpenMenu((prev) => (prev === "video" ? null : "video"))}
              className="flex h-11 w-9 items-center justify-center text-white/80 transition-colors duration-[180ms] hover:bg-[#4f5357] sm:h-12 sm:w-10"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onToggleCamera}
              title={isCameraOn ? "Turn off camera" : "Turn on camera"}
              className={`meet-control-btn h-11 w-11 sm:h-12 sm:w-12 ${isCameraOn ? "meet-control-btn-neutral rounded-none" : "meet-control-btn-danger rounded-none"}`}
            >
              {isCameraOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
            </button>
            {openMenu === "video" &&
              renderDeviceMenu(videoInputDevices, selectedVideoInputId, "Camera", onSelectVideoInput)}
          </div>

          <div className="relative">
            <button
              type="button"
              title="Apply visual effects"
              aria-haspopup="menu"
              aria-expanded={openMenu === "effects"}
              onClick={() => setOpenMenu((prev) => (prev === "effects" ? null : "effects"))}
              className={`meet-control-btn h-11 w-11 sm:h-12 sm:w-12 ${selectedEffect === "blur" ? "meet-control-btn-active" : "meet-control-btn-neutral"}`}
            >
              <Sparkles className="h-5 w-5" />
            </button>
            {openMenu === "effects" && (
              <div role="menu" className="absolute bottom-[calc(100%+10px)] left-1/2 z-50 w-48 -translate-x-1/2 rounded-2xl border border-white/10 bg-[#303134] p-2 shadow-2xl">
                {([
                  ["none", "No effect"],
                  ["blur", "Blur background"],
                ] as Array<[VisualEffect, string]>).map(([effect, label]) => (
                  <button
                    key={effect}
                    type="button"
                    role="menuitemradio"
                    aria-checked={selectedEffect === effect}
                    onClick={() => selectEffect(effect)}
                    className={[
                      "flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-white/10",
                      selectedEffect === effect ? "bg-[#8ab4f8] text-[#202124]" : "text-white/90",
                    ].join(" ")}
                  >
                    <span>{label}</span>
                    {selectedEffect === effect && (
                      <span aria-hidden className="h-2 w-2 rounded-full bg-current" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            title="More options"
            className="meet-control-btn meet-control-btn-neutral h-11 w-11 sm:h-12 sm:w-12"
          >
            <MoreVertical className="h-5 w-5" />
          </button>

          {/* Leave / cancel request */}
          <button
            type="button"
            onClick={onLeave}
            title="Leave call"
            className="meet-control-btn meet-control-btn-danger ml-1 h-11 w-11 sm:ml-2 sm:h-12 sm:w-12"
          >
            <Phone className="h-5 w-5 rotate-[135deg]" />
          </button>
        </div>
      </div>
    </div>
  );
}
