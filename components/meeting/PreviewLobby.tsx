"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { ChevronDown, Image as ImageIcon, Mic, MicOff, MoreHorizontal, Video, VideoOff, Volume2 } from "lucide-react";

import { getDisplayInitial } from "@/lib/display-name";
import { Button } from "@/components/ui/button";
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
        className="flex h-8 min-w-[150px] items-center justify-between gap-3 rounded-full border border-[#dadce0] px-4 text-sm text-[#3c4043] hover:bg-[#f8fafd]"
      >
        <span className="flex min-w-0 items-center gap-2">
          {icon}
          <span className="max-w-[108px] truncate">{selectedLabel}</span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute left-1/2 top-10 z-50 w-64 -translate-x-1/2 rounded-xl border border-[#dadce0] bg-white p-1 text-left shadow-xl">
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
                  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[#202124] hover:bg-[#f8fafd]",
                  device.deviceId === selectedDeviceId ? "bg-[#e8f0fe] text-[#1a73e8]" : "",
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
  const label = displayName || (isAuthenticated ? "Signed-in user" : "Guest");
  const initial = getDisplayInitial(label);
  const [openDeviceMenu, setOpenDeviceMenu] = useState<string | null>(null);
  const participants = useMeetingStore((s) => s.participants || []);

  // Determine participant identity key (server may provide `socketId` or `id`)
  const others = participants.filter((p) => {
    const participantSocketId = (p as any).socketId ?? (p as any).id ?? null;
    // Exclude local socket and exclude users who are still in waiting room
    const status = (p as any).status ?? null;
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

  return (
    <div className="fixed inset-0 flex flex-col bg-white text-[#202124]">
      <header className="flex h-16 items-center justify-between px-3 sm:px-6">
        <div className="flex items-center gap-2">
          <Image
            src={MEET_LOGO_URL}
            alt="Google Meet"
            width={124}
            height={32}
            className="h-8 w-[124px] object-contain"
            priority
          />
        </div>

        {isAuthenticated && (
          <div className="flex items-center gap-3">
            <div className="hidden text-right text-xs leading-tight text-[#202124] sm:block">
              {email && <p>{email}</p>}
              <p>Switch account</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[#8e24aa] text-base font-medium text-white">
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
          </div>
        )}
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-10 px-4 pb-8 pt-4 lg:flex-row lg:gap-24 lg:px-10">
        <section className="w-full max-w-[668px]">
          <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-[#3c4043] shadow-sm">
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
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-white hover:bg-white/15"
            >
              <MoreHorizontal className="h-5 w-5 rotate-90" />
            </button>

            <button
              type="button"
              title="More controls"
              className="absolute bottom-4 left-4 flex h-7 w-7 items-center justify-center rounded-full bg-[#8ab4f8] text-[#202124] hover:bg-[#aecbfa]"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>

            <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-4">
              <button
                type="button"
                onClick={onToggleMic}
                title={isMicOn ? "Turn off microphone" : "Turn on microphone"}
                className={`flex h-14 w-14 items-center justify-center rounded-full border border-white/80 text-white transition ${
                  isMicOn ? "bg-black/10 hover:bg-white/15" : "bg-[#d93025] hover:bg-[#b3261e]"
                }`}
              >
                {isMicOn ? <Mic className="h-6 w-6" /> : <MicOff className="h-6 w-6" />}
              </button>

              <button
                type="button"
                onClick={onToggleCamera}
                title={isCameraOn ? "Turn off camera" : "Turn on camera"}
                className={`flex h-14 w-14 items-center justify-center rounded-full border border-white/80 text-white transition ${
                  isCameraOn ? "bg-black/10 hover:bg-white/15" : "bg-[#d93025] hover:bg-[#b3261e]"
                }`}
              >
                {isCameraOn ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
              </button>
            </div>

            <button
              type="button"
              title="Apply visual effects"
              className="absolute bottom-4 right-4 flex h-12 w-12 items-center justify-center rounded-full border border-white/80 text-white hover:bg-white/15"
            >
              <ImageIcon className="h-5 w-5" />
            </button>
          </div>

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
        </section>

        <section className="flex w-full max-w-[360px] flex-col items-center text-center">
          <h1 className="text-[28px] font-normal leading-tight text-[#202124]">Ready to join?</h1>

          <div className="mt-5 flex h-6 w-6 items-center justify-center rounded-full bg-[#546e7a] text-xs font-medium text-white">
            {initial}
          </div>
          <p className="mt-3 max-w-[280px] truncate text-sm font-medium text-[#202124]">
            {participantStatusText()}
          </p>

          {!isAuthenticated && (
            <div className="mt-5 flex w-full flex-col gap-4">
              <div className="flex flex-col gap-2 text-left">
                <label htmlFor="displayNameInput" className="text-xs font-semibold text-[#5f6368]">
                  Your Display Name
                </label>
                <input
                  id="displayNameInput"
                  type="text"
                  value={customDisplayName}
                  onChange={(e) => onCustomDisplayNameChange(e.target.value)}
                  placeholder="Enter your name to join"
                  className="w-full rounded-lg border border-[#dadce0] bg-white px-4 py-3 text-sm text-[#202124] outline-none transition focus:border-[#1a73e8]"
                  maxLength={40}
                />
              </div>

              <div className="flex items-center gap-2 my-1">
                <div className="h-px flex-1 bg-[#dadce0]" />
                <span className="text-xs font-medium text-[#5f6368]">or</span>
                <div className="h-px flex-1 bg-[#dadce0]" />
              </div>

              <button
                type="button"
                onClick={() => googleLogin(typeof window !== "undefined" ? window.location.pathname : "/dashboard")}
                className="flex w-full cursor-pointer items-center justify-center gap-3 rounded-lg border border-[#dadce0] bg-white px-4 py-3 text-sm font-semibold text-[#202124] transition hover:bg-[#f8fafd]"
              >
                <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" width="24" height="24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                Sign in with Google
              </button>
            </div>
          )}

          {mediaError && (
            <p className="mt-4 w-full text-sm text-[#d93025]">{mediaError}</p>
          )}

          <Button
            onClick={onJoinNow}
            disabled={isJoining || !!mediaError || (!isAuthenticated && !customDisplayName.trim())}
            className="mt-7 h-14 w-full max-w-[228px] rounded-full bg-[#0b57d0] text-sm font-medium text-white ring-2 ring-[#0b57d0] ring-offset-2 ring-offset-white hover:bg-[#0842a0] disabled:opacity-50"
          >
            {isJoining ? "Joining..." : "Join now"}
          </Button>

          <button
            type="button"
            className="mt-7 flex h-9 items-center gap-3 rounded-full border border-[#dadce0] px-5 text-sm font-medium text-[#0b57d0] hover:bg-[#f8fafd]"
          >
            Other ways to join
            <ChevronDown className="h-4 w-4" />
          </button>
        </section>
      </main>
    </div>
  );
}
