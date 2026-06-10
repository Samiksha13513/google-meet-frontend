"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  ChevronDown,
  Mic,
  MicOff,
  Sparkles,
  Video,
  VideoOff,
  Volume2,
} from "lucide-react";

import { getDisplayInitial } from "@/lib/display-name";
import { MEET_LOGO_URL } from "@/lib/meet-brand";
import { googleLogin } from "@/services/auth";
import Image from "next/image";
import { useMeetingStore } from "@/store/meeting-store";
import { socket } from "@/lib/socket";
import { LobbyMicIndicator } from "@/components/meeting/LobbyMicIndicator";
import { useMicLevel } from "@/hooks/useMicLevel";
import { SelfieBackgroundEffect } from "@/webrtc/selfie-effects";

type PreviewLobbyProps = {
  displayName: string;
  email?: string;
  image?: string;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isMicOn: boolean;
  isCameraOn: boolean;
  isJoining: boolean;
  mediaError: string | null;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onJoinNow: () => void;
  audioInputDevices: MediaDeviceInfo[];
  audioOutputDevices: MediaDeviceInfo[];
  videoInputDevices: MediaDeviceInfo[];
  selectedAudioInputId: string;
  selectedAudioOutputId: string;
  selectedVideoInputId: string;
  onSelectAudioInput: (deviceId: string) => void;
  onSelectAudioOutput: (deviceId: string) => void;
  onSelectVideoInput: (deviceId: string) => void;
  isAuthenticated: boolean;
  customDisplayName: string;
  onCustomDisplayNameChange: (name: string) => void;
};

type DeviceSelectorProps = {
  id: "microphone" | "speaker" | "camera";
  title: string;
  icon: ReactNode;
  devices: MediaDeviceInfo[];
  selectedDeviceId: string;
  fallbackLabel: string;
  openMenu: string | null;
  setOpenMenu: (menu: string | null) => void;
  onSelectDevice: (deviceId: string) => void;
};

const deviceLabel = (device: MediaDeviceInfo, index: number, fallback: string) =>
  device.label || `${fallback} ${index + 1}`;

function DeviceSelector({
  id,
  title,
  icon,
  devices,
  selectedDeviceId,
  fallbackLabel,
  openMenu,
  setOpenMenu,
  onSelectDevice,
}: DeviceSelectorProps) {
  const selectedDevice = devices.find((device) => device.deviceId === selectedDeviceId);
  const selectedLabel = selectedDevice
    ? deviceLabel(selectedDevice, devices.indexOf(selectedDevice), fallbackLabel)
    : "Default";
  const isOpen = openMenu === id;

  return (
    <div className="relative">
      <button
        type="button"
        title={title}
        onClick={() => setOpenMenu(isOpen ? null : id)}
        className="flex h-8 min-w-[150px] items-center justify-between gap-3 rounded-full border border-[#dadce0] bg-white px-4 text-sm text-[#3c4043] transition-colors duration-[180ms] hover:bg-[#f8fafd]"
      >
        <span className="flex min-w-0 items-center gap-2">
          {icon}
          <span className="max-w-[108px] truncate">{selectedLabel}</span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-[#5f6368]" />
      </button>

      {isOpen && (
        <div className="meet-device-dropdown-light absolute left-1/2 top-10 z-50 w-64 -translate-x-1/2 p-1 text-left">
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
                  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors duration-[180ms]",
                  device.deviceId === selectedDeviceId
                    ? "bg-[#e8f0fe] text-[#1a73e8]"
                    : "text-[#202124] hover:bg-[#f8fafd]",
                ].join(" ")}
                title={deviceLabel(device, index, fallbackLabel)}
              >
                <span className="min-w-0 flex-1 truncate">
                  {deviceLabel(device, index, fallbackLabel)}
                </span>
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-sm text-[#5f6368]">No devices found</div>
          )}
        </div>
      )}
    </div>
  );
}

function ParticipantAvatar({
  name,
  image,
  size = "sm",
}: {
  name: string;
  image?: string;
  size?: "sm" | "md";
}) {
  const initial = getDisplayInitial(name);
  const sizeClass = size === "sm" ? "h-6 w-6 text-[11px]" : "h-9 w-9 text-base";

  return (
    <div
      className={`${sizeClass} shrink-0 overflow-hidden rounded-full bg-[#8e24aa] font-medium text-white flex items-center justify-center`}
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt={name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
      ) : (
        initial
      )}
    </div>
  );
}

function PreviewControls({
  isMicOn,
  isCameraOn,
  micLevel,
  isVisualEffectsOn,
  onToggleMic,
  onToggleCamera,
  onToggleVisualEffects,
}: {
  isMicOn: boolean;
  isCameraOn: boolean;
  micLevel: number;
  isVisualEffectsOn: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleVisualEffects: () => void;
}) {
  return (
    <>
      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-3">
        {isMicOn && micLevel > 0.04 && (
          <LobbyMicIndicator isMicOn={isMicOn} level={micLevel} />
        )}
        <button
          type="button"
          onClick={onToggleMic}
          title={isMicOn ? "Turn off microphone" : "Turn on microphone"}
          className={[
            "meet-lobby-control h-14 w-14",
            isMicOn ? "meet-lobby-control-on" : "meet-lobby-control-off",
          ].join(" ")}
        >
          {isMicOn ? <Mic className="h-6 w-6" /> : <MicOff className="h-6 w-6" />}
        </button>

        <button
          type="button"
          onClick={onToggleCamera}
          title={isCameraOn ? "Turn off camera" : "Turn on camera"}
          className={[
            "meet-lobby-control h-14 w-14",
            isCameraOn ? "meet-lobby-control-on" : "meet-lobby-control-off",
          ].join(" ")}
        >
          {isCameraOn ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
        </button>
      </div>

      <button
        type="button"
        onClick={onToggleVisualEffects}
        title={isVisualEffectsOn ? "Turn off visual effects" : "Apply visual effects"}
        className={[
          "meet-lobby-control meet-lobby-control-on absolute bottom-4 right-4 h-12 w-12",
          isVisualEffectsOn ? "bg-white/25 ring-2 ring-white/70" : "",
        ].join(" ")}
      >
        <Sparkles className="h-5 w-5" />
      </button>
    </>
  );
}

export function PreviewLobby({
  displayName,
  email,
  image,
  videoRef,
  isMicOn,
  isCameraOn,
  isJoining,
  mediaError,
  onToggleMic,
  onToggleCamera,
  onJoinNow,
  audioInputDevices,
  audioOutputDevices,
  videoInputDevices,
  selectedAudioInputId,
  selectedAudioOutputId,
  selectedVideoInputId,
  onSelectAudioInput,
  onSelectAudioOutput,
  onSelectVideoInput,
  isAuthenticated,
  customDisplayName,
  onCustomDisplayNameChange,
}: PreviewLobbyProps) {
  const label =
    customDisplayName.trim() ||
    displayName ||
    (isAuthenticated ? "Signed-in user" : "");
  const initial = getDisplayInitial(label || "Guest");
  const [openDeviceMenu, setOpenDeviceMenu] = useState<string | null>(null);
  const [isVisualEffectsOn, setIsVisualEffectsOn] = useState(false);
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const selfieEffectRef = useRef<SelfieBackgroundEffect | null>(null);
  const participants = useMeetingStore((s) => s.participants || []);
  const micLevel = useMicLevel(previewStream, isMicOn);

  useEffect(() => {
    const syncStream = () => {
      const stream = videoRef.current?.srcObject;
      setPreviewStream(stream instanceof MediaStream ? stream : null);
    };

    syncStream();
    const intervalId = window.setInterval(syncStream, 400);
    return () => window.clearInterval(intervalId);
  }, [videoRef, isCameraOn, isMicOn]);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = previewCanvasRef.current;

    if (!isVisualEffectsOn || !isCameraOn || !video || !canvas) {
      selfieEffectRef.current?.stop();
      return;
    }

    let cancelled = false;
    const effect = selfieEffectRef.current ?? new SelfieBackgroundEffect();
    selfieEffectRef.current = effect;

    void effect.startPreview(video, canvas).catch((error) => {
      console.warn("[SelfieEffects] preview failed:", error);
      if (!cancelled) {
        setIsVisualEffectsOn(false);
      }
    });

    return () => {
      cancelled = true;
      effect.stop();
    };
  }, [isVisualEffectsOn, isCameraOn, videoRef]);

  useEffect(() => {
    return () => {
      selfieEffectRef.current?.destroy();
      selfieEffectRef.current = null;
    };
  }, []);

  const handleToggleVisualEffects = () => {
    setIsVisualEffectsOn((prev) => !prev);
  };

  const others = participants.filter((p) => {
    const participantSocketId = (p as { socketId?: string; id?: string }).socketId ?? (p as { id?: string }).id ?? null;
    const status = (p as { status?: string }).status ?? null;
    if (participantSocketId === socket.id) return false;
    if (status === "IN_WAITING_ROOM") return false;
    return true;
  });

  const formatNames = (items: typeof participants) => {
    const names = items.map((p) => p.displayName).filter(Boolean) as string[];
    if (names.length === 1) return `${names[0]} is in this call`;
    if (names.length === 2) return `${names[0]} and ${names[1]} are in this call`;
    if (names.length === 3) return `${names[0]}, ${names[1]}, and ${names[2]} are in this call`;
    return "";
  };

  const participantStatusText = () => {
    if (others.length === 0) return "No one else is here";
    const namesText = formatNames(others);
    if (namesText) return namesText;
    return `${others.length + 1} people in call`;
  };

  const isReadyToJoin = isAuthenticated;
  const canJoin = isReadyToJoin
    ? !isJoining && !mediaError
    : !isJoining && !mediaError && Boolean(customDisplayName.trim());

  const showProcessedPreview = isCameraOn && isVisualEffectsOn;

  const previewCard = (
    <div className="relative aspect-video w-full overflow-hidden meet-video-box bg-[#3c4043]">
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
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-[#78909c] text-4xl font-medium text-white sm:h-28 sm:w-28">
              {image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={image}
                  alt={label}
                  className="h-full w-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                initial
              )}
            </div>
            {isAuthenticated && email && (
              <p className="max-w-[220px] truncate text-xs text-white/75">{email}</p>
            )}
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/55 to-transparent" />

      {label && (
        <div className="absolute left-4 top-4 max-w-[70%] truncate text-sm font-medium text-white">
          {label}
        </div>
      )}

      <PreviewControls
        isMicOn={isMicOn}
        isCameraOn={isCameraOn}
        micLevel={micLevel}
        isVisualEffectsOn={isVisualEffectsOn}
        onToggleMic={onToggleMic}
        onToggleCamera={onToggleCamera}
        onToggleVisualEffects={handleToggleVisualEffects}
      />
    </div>
  );

  const deviceSelectors = (
    <div className="mt-4 flex flex-wrap justify-center gap-2">
      <DeviceSelector
        id="microphone"
        title="Microphone"
        icon={<Mic className="h-4 w-4 shrink-0" />}
        devices={audioInputDevices}
        selectedDeviceId={selectedAudioInputId}
        fallbackLabel="Microphone"
        openMenu={openDeviceMenu}
        setOpenMenu={setOpenDeviceMenu}
        onSelectDevice={onSelectAudioInput}
      />
      <DeviceSelector
        id="speaker"
        title="Speaker"
        icon={<Volume2 className="h-4 w-4 shrink-0" />}
        devices={audioOutputDevices}
        selectedDeviceId={selectedAudioOutputId}
        fallbackLabel="Speaker"
        openMenu={openDeviceMenu}
        setOpenMenu={setOpenDeviceMenu}
        onSelectDevice={onSelectAudioOutput}
      />
      <DeviceSelector
        id="camera"
        title="Camera"
        icon={<Video className="h-4 w-4 shrink-0" />}
        devices={videoInputDevices}
        selectedDeviceId={selectedVideoInputId}
        fallbackLabel="Camera"
        openMenu={openDeviceMenu}
        setOpenMenu={setOpenDeviceMenu}
        onSelectDevice={onSelectVideoInput}
      />
    </div>
  );

  return (
    <div className="fixed inset-0 flex flex-col bg-white text-[#202124]">
      <header className="flex h-16 shrink-0 items-center justify-between px-3 sm:px-6">
        <Image
          src={MEET_LOGO_URL}
          alt="Google Meet"
          width={176}
          height={32}
          className="h-8 w-[176px] object-contain"
          priority
        />
        {!isAuthenticated ? (
          <button
            type="button"
            onClick={() => googleLogin(typeof window !== "undefined" ? window.location.pathname : "/dashboard")}
            className="text-sm text-[#1a73e8] hover:underline"
          >
            Sign in
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[#8e24aa] text-base font-medium text-white">
              {image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={image} alt={label} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                initial
              )}
            </div>
          </div>
        )}
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-10 px-4 pb-8 pt-4 lg:flex-row lg:gap-24 lg:px-10">
        <section className="w-full max-w-[668px]">
          {previewCard}
          {deviceSelectors}
        </section>

        <section className="flex w-full max-w-[360px] flex-col items-start text-left">
          {isReadyToJoin ? (
            <>
              {/* Screenshot 1 (host) & Screenshot 3 (signed-in participant) */}
              <h1 className="meet-guest-heading">Ready to join?</h1>

              {others.length > 0 ? (
                <div className="mt-4 flex items-center gap-2">
                  <ParticipantAvatar
                    name={others[0].displayName || "Participant"}
                    image={(others[0] as { image?: string }).image}
                    size="sm"
                  />
                  <span className="text-sm text-[#5f6368]">{participantStatusText()}</span>
                </div>
              ) : (
                <p className="mt-4 text-sm text-[#5f6368]">{participantStatusText()}</p>
              )}

              <button
                type="button"
                onClick={onJoinNow}
                disabled={!canJoin}
                className="meet-join-now-btn mt-8 w-full max-w-sm disabled:opacity-55"
              >
                {isJoining ? "Joining..." : "Join now"}
              </button>
            </>
          ) : (
            <>
              {/* Screenshot 2 — unauthorized guest */}
              <h1 className="meet-guest-heading">What&apos;s your name?</h1>

              <div className="mt-6 w-full max-w-sm">
                <input
                  id="displayNameInput"
                  type="text"
                  value={customDisplayName}
                  onChange={(e) => onCustomDisplayNameChange(e.target.value)}
                  placeholder="Your name"
              autoComplete="name"
                  className="meet-guest-input w-full"
                  maxLength={60}
                />
                <div className="mt-2 text-right text-xs text-[#5f6368]">
                  {customDisplayName.length}/60
                </div>

                <button
                  type="button"
                  onClick={onJoinNow}
                  disabled={!canJoin}
                  className={`mt-8 w-full meet-ask-btn transition-colors duration-[180ms] ${customDisplayName.trim() ? "enabled" : ""}`}
                >
                  {isJoining ? "Joining..." : "Ask to join"}
                </button>
              </div>

              <p className="mt-6 max-w-sm text-xs leading-relaxed text-[#5f6368]">
                By joining, you agree to the Terms of Service and Privacy Policy. System info will be sent to confirm you&apos;re not a bot.
              </p>
            </>
          )}

          {mediaError && (
            <p className="mt-4 w-full max-w-sm text-sm text-[#d93025]">{mediaError}</p>
          )}
        </section>
      </main>
    </div>
  );
}
