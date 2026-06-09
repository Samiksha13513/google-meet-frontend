"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import {
  ChevronDown,
  Copy,
  Check,
  Image as ImageIcon,
  Mic,
  MicOff,
  MoreHorizontal,
  Sparkles,
  Video,
  VideoOff,
  Volume2,
  Wand2,
  Settings2,
} from "lucide-react";

import { getDisplayInitial } from "@/lib/display-name";
import { MEET_LOGO_URL } from "@/lib/meet-brand";
import { googleLogin } from "@/services/auth";
import Image from "next/image";
import { useMeetingStore } from "@/store/meeting-store";
import { socket } from "@/lib/socket";

type PreviewLobbyProps = {
  meetingCode: string;
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
  onPresentNow?: () => void;
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
  isHostPreview?: boolean;
  meetingTitle?: string;
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
  variant: "light" | "dark";
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
  variant,
}: DeviceSelectorProps) {
  const isDark = variant === "dark";
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
        className={[
          "flex h-8 min-w-[150px] items-center justify-between gap-3 rounded-full border px-4 text-sm transition-colors duration-[180ms]",
          isDark
            ? "border-white/20 bg-[#3c4043] text-[#e8eaed] hover:bg-[#4f5357]"
            : "border-[#dadce0] text-[#3c4043] hover:bg-[#f8fafd]",
        ].join(" ")}
      >
        <span className="flex min-w-0 items-center gap-2">
          {icon}
          <span className="max-w-[108px] truncate">{selectedLabel}</span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-70" />
      </button>

      {isOpen && (
        <div
          className={[
            "absolute left-1/2 top-10 z-50 w-64 -translate-x-1/2 p-1 text-left",
            isDark ? "meet-device-dropdown-dark" : "meet-device-dropdown-light",
          ].join(" ")}
        >
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
                  isDark
                    ? device.deviceId === selectedDeviceId
                      ? "bg-[#8ab4f8] text-[#202124]"
                      : "text-[#e8eaed] hover:bg-white/10"
                    : device.deviceId === selectedDeviceId
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
            <div className={`px-3 py-2 text-sm ${isDark ? "text-white/55" : "text-[#5f6368]"}`}>
              No devices found
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PreviewControls({
  isMicOn,
  isCameraOn,
  onToggleMic,
  onToggleCamera,
  showAudioSettings,
  onToggleAudioSettings,
}: {
  isMicOn: boolean;
  isCameraOn: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  showAudioSettings: boolean;
  onToggleAudioSettings: () => void;
}) {
  return (
    <>
      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-3">
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

        <button
          type="button"
          title="Apply background blur"
          className="meet-lobby-control meet-lobby-control-on h-12 w-12"
        >
          <Wand2 className="h-5 w-5" />
        </button>

        <button
          type="button"
          title="Apply visual effects"
          className="meet-lobby-control meet-lobby-control-on h-12 w-12"
        >
          <Sparkles className="h-5 w-5" />
        </button>

        <button
          type="button"
          onClick={onToggleAudioSettings}
          title="Audio settings"
          className={[
            "meet-lobby-control meet-lobby-control-on h-12 w-12",
            showAudioSettings ? "bg-white/20" : "",
          ].join(" ")}
        >
          <Settings2 className="h-5 w-5" />
        </button>
      </div>

      <button
        type="button"
        title="Apply visual effects"
        className="meet-lobby-control meet-lobby-control-on absolute bottom-4 right-4 h-12 w-12 md:hidden"
      >
        <ImageIcon className="h-5 w-5" />
      </button>
    </>
  );
}

export function PreviewLobby({
  meetingCode,
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
  onPresentNow,
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
  isHostPreview = false,
  meetingTitle,
}: PreviewLobbyProps) {
  const label = displayName || (isAuthenticated ? "Signed-in user" : "Guest");
  const initial = getDisplayInitial(label);
  const [openDeviceMenu, setOpenDeviceMenu] = useState<string | null>(null);
  const [showAudioSettings, setShowAudioSettings] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const participants = useMeetingStore((s) => s.participants || []);

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

  const handleCopyLink = async () => {
    const link = `${window.location.origin}/meeting/${meetingCode}`;
    try {
      await navigator.clipboard.writeText(link);
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // no-op
    }
  };

  const formattedCode = meetingCode.includes("-")
    ? meetingCode
    : meetingCode.replace(/^(.{3})(.{4})(.{3})$/, "$1-$2-$3") || meetingCode;

  const deviceVariant = isHostPreview ? "dark" : "light";
  const canJoin = isHostPreview
    ? !isJoining && !mediaError
    : !isJoining && !mediaError && (isAuthenticated || customDisplayName.trim());

  const previewCard = (
    <div className="relative aspect-video w-full overflow-hidden meet-video-box bg-[#3c4043]">
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className={`h-full w-full object-cover ${isCameraOn ? "block" : "hidden"}`}
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

      <div className="absolute left-4 top-4 max-w-[70%] truncate text-sm font-medium text-white">
        {label}
      </div>

      <button
        type="button"
        title="More options"
        className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-white transition-colors duration-[180ms] hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8ab4f8]"
      >
        <MoreHorizontal className="h-5 w-5 rotate-90" />
      </button>

      <PreviewControls
        isMicOn={isMicOn}
        isCameraOn={isCameraOn}
        onToggleMic={onToggleMic}
        onToggleCamera={onToggleCamera}
        showAudioSettings={showAudioSettings}
        onToggleAudioSettings={() => setShowAudioSettings((prev) => !prev)}
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
        variant={deviceVariant}
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
        variant={deviceVariant}
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
        variant={deviceVariant}
      />
    </div>
  );

  if (isHostPreview) {
    return (
      <div className="fixed inset-0 flex flex-col bg-[#202124] text-white">
        <header className="flex h-16 items-center justify-between px-3 sm:px-6">
          <Image
            src={MEET_LOGO_URL}
            alt="Google Meet"
            width={99}
            height={32}
            className="h-8 w-[99px] object-contain brightness-0 invert"
            priority
          />
          <div className="flex items-center gap-3">
            <div className="hidden text-right text-xs leading-tight text-[#e8eaed] sm:block">
              {email && <p>{email}</p>}
              <p className="text-[#9aa0a6]">Meeting host</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[#8ab4f8] text-base font-medium text-[#202124]">
              {image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={image} alt={label} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                initial
              )}
            </div>
          </div>
        </header>

        <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4 pb-8 pt-2 lg:flex-row lg:gap-16 lg:px-10">
          <section className="w-full max-w-[720px]">
            {previewCard}
            {deviceSelectors}
          </section>

          <section className="flex w-full max-w-[380px] flex-col items-start text-left">
            <p className="text-xs font-medium uppercase tracking-wide text-[#9aa0a6]">
              Ready to join?
            </p>
            <h1 className="mt-2 text-[28px] font-normal leading-9 text-white sm:text-[32px] sm:leading-10">
              {meetingTitle || "Your meeting"}
            </h1>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className="font-mono text-sm tracking-wider text-[#8ab4f8]">
                {formattedCode || meetingCode}
              </span>
              <button
                type="button"
                onClick={() => void handleCopyLink()}
                className="meet-control-btn meet-control-btn-neutral h-8 gap-1.5 px-3 text-xs font-medium"
              >
                {linkCopied ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Copy link
                  </>
                )}
              </button>
            </div>

            <p className="mt-3 text-sm text-[#9aa0a6]">{participantStatusText()}</p>

            <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={onJoinNow}
                disabled={!canJoin}
                className="meet-join-now-btn flex flex-1 items-center justify-center px-6 disabled:opacity-55"
              >
                {isJoining ? "Joining..." : "Join now"}
              </button>
              {onPresentNow && (
                <button
                  type="button"
                  onClick={onPresentNow}
                  disabled={!canJoin}
                  className="meet-present-btn flex flex-1 items-center justify-center px-6 disabled:opacity-55"
                >
                  Present now
                </button>
              )}
            </div>

            {mediaError && (
              <p className="mt-4 w-full text-sm text-[#f28b82]">{mediaError}</p>
            )}
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-white text-[#202124]">
      <header className="flex h-16 items-center justify-between px-3 sm:px-6">
        <Image
          src={MEET_LOGO_URL}
          alt="Google Meet"
          width={99}
          height={32}
          className="h-8 w-[99px] object-contain"
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
            <div className="hidden text-right text-xs leading-tight text-[#202124] sm:block">
              {email && <p>{email}</p>}
              <p className="text-[#5f6368]">Switch account</p>
            </div>
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
          <p className="text-sm text-[#5f6368]">{participantStatusText()}</p>
          <h1 className="meet-guest-heading mt-2">What&apos;s your name?</h1>

          <div className="mt-6 w-full max-w-sm">
            <input
              id="displayNameInput"
              type="text"
              value={customDisplayName}
              onChange={(e) => onCustomDisplayNameChange(e.target.value)}
              placeholder="Your name"
              className="meet-guest-input w-full"
              maxLength={60}
            />
            <div className="mt-2 text-right text-xs text-[#5f6368]">{customDisplayName.length}/60</div>

            <button
              type="button"
              onClick={onJoinNow}
              disabled={!canJoin}
              className={`mt-8 w-full meet-ask-btn transition-colors duration-[180ms] ${customDisplayName.trim() ? "enabled" : ""}`}
            >
              {isJoining ? "Joining..." : "Ask to join"}
            </button>

            <button type="button" className="mt-4 w-full meet-other-btn transition-colors duration-[180ms] hover:bg-[#f8fafd]">
              Other ways to join
            </button>
          </div>

          {mediaError && (
            <p className="mt-4 w-full text-sm text-[#d93025]">{mediaError}</p>
          )}

          <p className="mt-6 max-w-sm text-xs text-[#5f6368]">
            By joining, you agree to the Terms of Service and Privacy Policy. System info will be sent to confirm you&apos;re not a bot.
          </p>
        </section>
      </main>
    </div>
  );
}
