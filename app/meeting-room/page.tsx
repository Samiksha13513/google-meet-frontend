"use client";

import { useState, useEffect, useRef } from "react";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  MonitorUp,
  Smile,
  Hand,
  Phone,
  Info,
  MessageSquare,
  Users,
  Send,
  X,
  Shield,
  UserX,
  LayoutGrid,
  PanelRight,
  Rows3,
  Pin,
  PinOff,
  Captions,
  MoreVertical,
  Search,
  Lock,
  Wifi,
  WifiOff,
  Sparkles,
} from "lucide-react";

import { useParams, useRouter } from "next/navigation";
import { socket } from "@/lib/socket";
import { getLocalStream, getReplacementTrack } from "../../webrtc/media";
import { MeetingPeerSession } from "../../webrtc/meeting-session";
import {
  bindScreenShareEndHandlers,
  getScreenShareSupport,
  requestScreenShareStream,
} from "../../webrtc/screen-share";
import { detachVideoElement, stopMediaStream } from "../../webrtc/stream-utils";
import { PreviewLobby } from "@/components/meeting/PreviewLobby";
import {
  getCurrentUserIdentity,
  getDisplayInitial,
  getIdentityLabel,
  getIdentitySecondary,
  type UserIdentity,
} from "@/lib/display-name";
import { getMeetingByCode } from "@/lib/api";
import type { Meeting } from "@/types/meeting";

const REACTIONS = ["👍", "❤️", "😂", "🎉", "👏", "😮"];
const DEVICE_PREFERENCES_KEY = "meet-device-preferences";

type MeetingState =
  | "lobby"
  | "waiting"
  | "connecting"
  | "inMeeting"
  | "ended"
  | "denied";

type MeetingLayout = "auto" | "tiled" | "spotlight" | "sidebar";

type Participant = {
  socketId: string;
  displayName: string;
  email?: string;
  image?: string;
  stream?: MediaStream;
  isMicOn: boolean;
  isCameraOn: boolean;
  isHandRaised?: boolean;
  isHost: boolean;
  isScreenSharing: boolean;
};

type ChatMessage = {
  id?: string;
  senderId: string;
  senderName: string;
  senderEmail?: string;
  senderImage?: string;
  message: string;
  timestamp: number;
};

type FloatingReaction = {
  id: number;
  emoji: string;
  senderName: string;
  senderImage?: string;
  x: number; // Horizontal offset percentage
};

type ReactionBubble = {
  id: number;
  emoji: string;
  senderName: string;
  timestamp: number;
};

type JoinRequest = {
  socketId: string;
  displayName: string;
  email?: string;
  image?: string;
};

type DevicePreferences = {
  audioInputId: string;
  audioOutputId: string;
  videoInputId: string;
};

type SinkIdVideoElement = HTMLVideoElement & {
  setSinkId?: (sinkId: string) => Promise<void>;
};

const getStoredDevicePreferences = (): DevicePreferences => {
  if (typeof window === "undefined") {
    return { audioInputId: "", audioOutputId: "", videoInputId: "" };
  }

  try {
    const raw = localStorage.getItem(DEVICE_PREFERENCES_KEY);
    if (!raw) return { audioInputId: "", audioOutputId: "", videoInputId: "" };
    const parsed = JSON.parse(raw) as Partial<DevicePreferences>;
    return {
      audioInputId: parsed.audioInputId || "",
      audioOutputId: parsed.audioOutputId || "",
      videoInputId: parsed.videoInputId || "",
    };
  } catch {
    return { audioInputId: "", audioOutputId: "", videoInputId: "" };
  }
};

const storeDevicePreference = (
  key: keyof DevicePreferences,
  deviceId: string
) => {
  if (typeof window === "undefined") return;
  const current = getStoredDevicePreferences();
  localStorage.setItem(
    DEVICE_PREFERENCES_KEY,
    JSON.stringify({ ...current, [key]: deviceId })
  );
};

const getMediaDeviceLabel = (
  device: MediaDeviceInfo,
  index: number,
  fallback: string
) => device.label || `${fallback} ${index + 1}`;

// Isolated Video element component to ensure stable stream attachments and avoid React playback resets
const ParticipantVideo = ({
  stream,
  isLocal,
  muted,
  sinkDeviceId,
  fit = "cover",
}: {
  stream?: MediaStream;
  isLocal: boolean;
  muted: boolean;
  sinkDeviceId?: string;
  fit?: "cover" | "contain";
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [streamUnavailable, setStreamUnavailable] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!stream) {
      detachVideoElement(video);
      setStreamUnavailable(true);
      return;
    }

    setStreamUnavailable(false);

    const attach = () => {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack && videoTrack.readyState === "ended") {
        setStreamUnavailable(true);
        detachVideoElement(video);
        return;
      }
      setStreamUnavailable(false);
      
      // Avoid duplicate srcObject assignments to prevent annoying video flashes/pauses
      if (video.srcObject !== stream) {
        video.srcObject = stream;
      }

      const sinkVideo = video as SinkIdVideoElement;
      if (!isLocal && sinkDeviceId !== undefined && sinkVideo.setSinkId) {
        sinkVideo.setSinkId(sinkDeviceId).catch((err) => {
          console.warn("[WebRTC:Audio] Speaker device switch failed:", err);
        });
      }
      
      video.play().catch((err) => {
        console.log(`[WebRTC:Video] Autoplay for ${isLocal ? "local" : "remote"} stream failed:`, err);
      });
    };

    const handleTrackEvent = () => {
      attach();
    };

    attach();
    stream.addEventListener("addtrack", handleTrackEvent);
    stream.addEventListener("removetrack", handleTrackEvent);

    const tracks = stream.getTracks();
    tracks.forEach((track) => {
      track.addEventListener("ended", handleTrackEvent);
      track.addEventListener("mute", handleTrackEvent);
      track.addEventListener("unmute", handleTrackEvent);
    });

    return () => {
      stream.removeEventListener("addtrack", handleTrackEvent);
      stream.removeEventListener("removetrack", handleTrackEvent);
      tracks.forEach((track) => {
        track.removeEventListener("ended", handleTrackEvent);
        track.removeEventListener("mute", handleTrackEvent);
        track.removeEventListener("unmute", handleTrackEvent);
      });
      detachVideoElement(video);
    };
  }, [stream, isLocal, sinkDeviceId]);

  if (streamUnavailable || !stream) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-2xl bg-[#2d2e30] text-xs text-white/50">
        Video unavailable
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={muted}
      className={`w-full h-full rounded-2xl ${fit === "contain" ? "object-contain bg-black" : "object-cover"}`}
    />
  );
};

const MeetAvatar = ({
  name,
  email,
  image,
  size = "lg",
}: {
  name: string;
  email?: string;
  image?: string;
  size?: "sm" | "md" | "lg" | "xl";
}) => {
  const sizeClass = {
    sm: "h-9 w-9 text-sm",
    md: "h-11 w-11 text-base",
    lg: "h-24 w-24 text-4xl",
    xl: "h-28 w-28 text-5xl",
  }[size];
  const label = getIdentityLabel({ displayName: name, email });

  return (
    <div
      className={`${sizeClass} shrink-0 overflow-hidden rounded-full bg-[#8ab4f8] text-[#202124] ring-1 ring-white/10 flex items-center justify-center font-medium shadow-inner`}
      title={email || name}
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt={label}
          className="h-full w-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        <span>{getDisplayInitial(label)}</span>
      )}
    </div>
  );
};

export default function MeetingRoom() {
  const router = useRouter();
  const params = useParams();

  const meetingCode = Array.isArray(params.meetingCode)
    ? params.meetingCode[0]
    : params.meetingCode;

  // State Management
  const [meetingState, setMeetingState] = useState<MeetingState>("lobby");
  const [identity] = useState<UserIdentity>(() => getCurrentUserIdentity());
  const displayName = getIdentityLabel(identity);
  const displaySecondary = getIdentitySecondary(identity);

  const [isAuthenticated] = useState(
    () => typeof window !== "undefined" && !!localStorage.getItem("authToken")
  );
  const [customDisplayName, setCustomDisplayName] = useState("Guest");

  const resolvedDisplayName = isAuthenticated ? displayName : (customDisplayName || "Guest");

  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);

  const [isHost, setIsHost] = useState(false);
  const [meetingError, setMeetingError] = useState<string | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [screenShareError, setScreenShareError] = useState<string | null>(null);
  const [audioInputDevices, setAudioInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputDevices, setAudioOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoInputDevices, setVideoInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioInputId, setSelectedAudioInputId] = useState(
    () => getStoredDevicePreferences().audioInputId
  );
  const [selectedAudioOutputId, setSelectedAudioOutputId] = useState(
    () => getStoredDevicePreferences().audioOutputId
  );
  const [selectedVideoInputId, setSelectedVideoInputId] = useState(
    () => getStoredDevicePreferences().videoInputId
  );
  const [isJoining, setIsJoining] = useState(false);
  const [, setPermissionRequested] = useState(false);
  const [deniedReason, setDeniedReason] = useState("Host denied your request");

  const [currentTime, setCurrentTime] = useState("");
  const [participantLeftMessage, setParticipantLeftMessage] = useState<string | null>(null);
  const [meetingData, setMeetingData] = useState<Meeting | null>(null);
  const [meetingDuration, setMeetingDuration] = useState("0:00");
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [showMoreOptionsMenu, setShowMoreOptionsMenu] = useState(false);
  const [isMeetingLocked, setIsMeetingLocked] = useState(false);
  const [participantSearch, setParticipantSearch] = useState("");
  const [isOnline, setIsOnline] = useState(true);

  // Active participants list
  const [participants, setParticipants] = useState<Participant[]>([]);

  // Waiting Room Requests (Host-only)
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);

  // Chat & Sidebars
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [showChat, setShowChat] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [showParticipantsList, setShowParticipantsList] = useState(false);
  const [showAdmitGuestsDialog, setShowAdmitGuestsDialog] = useState(false);
  const [pinnedParticipantId, setPinnedParticipantId] = useState<string | null>(null);
  const [activeSpeakerId, setActiveSpeakerId] = useState<string | null>(null);
  const [meetingLayout, setMeetingLayout] = useState<MeetingLayout>("auto");
  const [showLayoutMenu, setShowLayoutMenu] = useState(false);
  const [showAudioDeviceMenu, setShowAudioDeviceMenu] = useState(false);
  const [showVideoDeviceMenu, setShowVideoDeviceMenu] = useState(false);

  // Reaction picker & anims
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([]);
  const [reactionBubbles, setReactionBubbles] = useState<Record<string, ReactionBubble[]>>({});

  // Refs
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const [localStreamForRender, setLocalStreamForRender] = useState<MediaStream | null>(null);
  const [screenStreamForRender, setScreenStreamForRender] = useState<MediaStream | null>(null);
  const sessionRef = useRef<MeetingPeerSession | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const selectedAudioInputIdRef = useRef("");
  const selectedAudioOutputIdRef = useRef("");
  const selectedVideoInputIdRef = useRef("");
  const reactionIdRef = useRef(0);
  const lastLocalReactionRef = useRef<{ emoji: string; pendingEcho: boolean } | null>(null);
  const audioLevelsRef = useRef<Record<string, number>>({});
  const participantsRef = useRef<Participant[]>([]);

  const emojiRef = useRef<HTMLDivElement>(null);
  const layoutRef = useRef<HTMLDivElement>(null);
  const moreOptionsRef = useRef<HTMLDivElement>(null);
  const audioDeviceMenuRef = useRef<HTMLDivElement>(null);
  const videoDeviceMenuRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const meetingJoinedAtRef = useRef<number | null>(null);
  const showChatRef = useRef(false);
  const screenShareUnbindRef = useRef<(() => void) | null>(null);
  const screenShareSupport = typeof window !== "undefined" ? getScreenShareSupport() : null;

  useEffect(() => {
    selectedAudioInputIdRef.current = selectedAudioInputId;
  }, [selectedAudioInputId]);

  useEffect(() => {
    selectedAudioOutputIdRef.current = selectedAudioOutputId;
  }, [selectedAudioOutputId]);

  useEffect(() => {
    selectedVideoInputIdRef.current = selectedVideoInputId;
  }, [selectedVideoInputId]);

  // =========================
  // CLEANUPS
  // =========================

  const stopPreviewTracks = () => {
    const stream = localStreamRef.current;
    stream?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    setLocalStreamForRender(null);
  };

  const clearScreenShareBindings = () => {
    screenShareUnbindRef.current?.();
    screenShareUnbindRef.current = null;
  };

  const removeParticipantFromUi = (socketId: string) => {
    setParticipants((prev) => {
      const removed = prev.find((p) => p.socketId === socketId);
      if (removed?.stream) {
        stopMediaStream(removed.stream);
      }
      return prev.filter((p) => p.socketId !== socketId);
    });
    setPinnedParticipantId((prev) => (prev === socketId ? null : prev));
    setActiveSpeakerId((prev) => (prev === socketId ? null : prev));
    delete audioLevelsRef.current[socketId];
  };

  const resetInMeetingUiState = () => {
    setPinnedParticipantId(null);
    setActiveSpeakerId(null);
    setIsScreenSharing(false);
    setIsHandRaised(false);
    setScreenShareError(null);
    setShowChat(false);
    setUnreadMessages(0);
    setShowParticipantsList(false);
    setShowAdmitGuestsDialog(false);
    setShowEmojiPicker(false);
    setShowLayoutMenu(false);
    setShowAudioDeviceMenu(false);
    setShowVideoDeviceMenu(false);
    setMeetingLayout("auto");
    setFloatingReactions([]);
    setReactionBubbles({});
    clearScreenShareBindings();
  };

  const cleanupLiveSession = () => {
    clearScreenShareBindings();
    stopMediaStream(screenStreamRef.current);
    screenStreamRef.current = null;
    setScreenStreamForRender(null);
    setParticipants((prev) => {
      prev.forEach((p) => stopMediaStream(p.stream));
      return [];
    });
    setJoinRequests([]);
    setMessages([]);
    setUnreadMessages(0);
    sessionRef.current?.destroy();
    sessionRef.current = null;
    resetInMeetingUiState();
  };

  const dedupeParticipants = (items: Participant[]) => {
    const bySocketId = new Map<string, Participant>();
    items.forEach((participant) => {
      if (!participant.socketId || participant.socketId === socket.id) return;
      const existing = bySocketId.get(participant.socketId);
      bySocketId.set(participant.socketId, {
        ...existing,
        ...participant,
        stream: participant.stream || existing?.stream,
      });
    });
    return Array.from(bySocketId.values());
  };

  const upsertParticipant = (participant: Participant) => {
    if (!participant.socketId || participant.socketId === socket.id) return;
    setParticipants((prev) => dedupeParticipants([...prev, participant]));
  };

  const cleanupAll = () => {
    clearScreenShareBindings();
    stopMediaStream(screenStreamRef.current);
    screenStreamRef.current = null;
    setScreenStreamForRender(null);
    cleanupLiveSession();
    stopPreviewTracks();
    detachVideoElement(localVideoRef.current);
    resetInMeetingUiState();
  };

  // =========================
  // HANDLERS
  // =========================

  const refreshMediaDevices = async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter((device) => device.kind === "audioinput");
      const audioOutputs = devices.filter((device) => device.kind === "audiooutput");
      const videoInputs = devices.filter((device) => device.kind === "videoinput");
      const storedPreferences = getStoredDevicePreferences();

      setAudioInputDevices(audioInputs);
      setAudioOutputDevices(audioOutputs);
      setVideoInputDevices(videoInputs);

      const currentAudioDeviceId =
        localStreamRef.current?.getAudioTracks()[0]?.getSettings().deviceId || "";
      const currentVideoDeviceId =
        localStreamRef.current?.getVideoTracks()[0]?.getSettings().deviceId || "";

      const nextAudioInputId =
        currentAudioDeviceId ||
        (audioInputs.some((device) => device.deviceId === selectedAudioInputIdRef.current)
          ? selectedAudioInputIdRef.current
          : audioInputs.some((device) => device.deviceId === storedPreferences.audioInputId)
            ? storedPreferences.audioInputId
            : audioInputs[0]?.deviceId || "");
      const nextVideoInputId =
        currentVideoDeviceId ||
        (videoInputs.some((device) => device.deviceId === selectedVideoInputIdRef.current)
          ? selectedVideoInputIdRef.current
          : videoInputs.some((device) => device.deviceId === storedPreferences.videoInputId)
            ? storedPreferences.videoInputId
            : videoInputs[0]?.deviceId || "");
      const nextAudioOutputId = audioOutputs.some((device) => device.deviceId === selectedAudioOutputIdRef.current)
        ? selectedAudioOutputIdRef.current
        : audioOutputs.some((device) => device.deviceId === storedPreferences.audioOutputId)
          ? storedPreferences.audioOutputId
          : audioOutputs[0]?.deviceId || "";

      setSelectedAudioInputId(nextAudioInputId);
      setSelectedVideoInputId(nextVideoInputId);
      setSelectedAudioOutputId(nextAudioOutputId);
    } catch (error) {
      console.warn("[MediaDevices] Unable to enumerate devices:", error);
    }
  };

  const replaceLocalMediaTrack = async (
    kind: "audio" | "video",
    track: MediaStreamTrack | null
  ) => {
    const stream = localStreamRef.current;
    if (!stream) return;

    const oldTrack =
      kind === "audio" ? stream.getAudioTracks()[0] : stream.getVideoTracks()[0];

    if (sessionRef.current?.isActive()) {
      await sessionRef.current.replaceLocalTrack(kind, track);
    } else {
      if (oldTrack && oldTrack !== track) {
        stream.removeTrack(oldTrack);
      }
      if (track && !stream.getTracks().some((streamTrack) => streamTrack.id === track.id)) {
        stream.addTrack(track);
      }
      if (oldTrack && oldTrack !== track) {
        oldTrack.stop();
      }
    }

    if (kind === "video") {
      sessionRef.current?.setLocalCameraVideoTrack(track);
    } else {
      sessionRef.current?.setLocalMicAudioTrack(track);
    }

    setLocalStreamForRender(new MediaStream(stream.getTracks()));
  };

  const handleSelectAudioInput = async (deviceId: string) => {
    try {
      const track = await getReplacementTrack("audioinput", deviceId || undefined);
      track.enabled = isMicOn;
      await replaceLocalMediaTrack("audio", track);
      setSelectedAudioInputId(deviceId);
      storeDevicePreference("audioInputId", deviceId);
      setMediaError(null);
      await refreshMediaDevices();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to switch microphone.";
      setMediaError(message);
    }
  };

  const handleSelectVideoInput = async (deviceId: string) => {
    try {
      const track = await getReplacementTrack("videoinput", deviceId || undefined);
      track.enabled = isCameraOn;
      await replaceLocalMediaTrack("video", track);
      setSelectedVideoInputId(deviceId);
      storeDevicePreference("videoInputId", deviceId);
      setMediaError(null);
      await refreshMediaDevices();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to switch camera.";
      setMediaError(message);
    }
  };

  const handleSelectAudioOutput = (deviceId: string) => {
    setSelectedAudioOutputId(deviceId);
    storeDevicePreference("audioOutputId", deviceId);
  };

  const handleToggleMic = () => {
    const next = !isMicOn;
    const stream = localStreamRef.current;
    stream?.getAudioTracks().forEach((t) => (t.enabled = next));
    setIsMicOn(next);
    sessionRef.current?.sendStatusUpdate(next, isCameraOn);
  };

  const handleToggleCamera = () => {
    const next = !isCameraOn;
    const stream = localStreamRef.current;
    stream?.getVideoTracks().forEach((t) => (t.enabled = next));
    setIsCameraOn(next);
    sessionRef.current?.sendStatusUpdate(isMicOn, next);
  };

  const endScreenShare = async () => {
    if (!isScreenSharing && !screenStreamRef.current) return;
    clearScreenShareBindings();
    try {
      await sessionRef.current?.stopScreenShare();
    } catch (err) {
      console.error("[ScreenShare] stop failed:", err);
    }
    stopMediaStream(screenStreamRef.current);
    screenStreamRef.current = null;
    setScreenStreamForRender(null);
    setIsScreenSharing(false);
  };

  const handleToggleScreenShare = async () => {
    if (isScreenSharing) {
      await endScreenShare();
      return;
    }

    setScreenShareError(null);
    const activePresenter = participants.find((p) => p.isScreenSharing);
    if (activePresenter) {
      const shouldReplace = window.confirm(
        `${activePresenter.displayName} is presenting. Do you want to present instead?`
      );
      if (!shouldReplace) return;
    }

    const support = getScreenShareSupport();
    if (!support.supported) {
      setScreenShareError(support.reason || "Screen sharing is not available.");
      return;
    }

    const result = await requestScreenShareStream();
    if (!result.ok) {
      setScreenShareError(result.error);
      return;
    }

    const stream = result.stream;
    try {
      const camTrack = localStreamRef.current?.getVideoTracks()[0] ?? null;
      const micTrack = localStreamRef.current?.getAudioTracks()[0] ?? null;
      sessionRef.current?.setLocalCameraVideoTrack(camTrack);
      sessionRef.current?.setLocalMicAudioTrack(micTrack);

      screenStreamRef.current = stream;
      setScreenStreamForRender(stream);
      await sessionRef.current?.startScreenShare(stream);
      setIsScreenSharing(true);
      setParticipants((prev) =>
        prev.map((p) => {
          if (!p.isScreenSharing) return p;
          const streamCopy = p.stream ? new MediaStream(p.stream.getTracks()) : undefined;
          return { ...p, isScreenSharing: false, stream: streamCopy };
        })
      );

      clearScreenShareBindings();
      screenShareUnbindRef.current = bindScreenShareEndHandlers(stream, () => {
        void endScreenShare();
      });
    } catch (err) {
      stopMediaStream(stream);
      screenStreamRef.current = null;
      setScreenStreamForRender(null);
      const message = err instanceof Error ? err.message : "Failed to start screen sharing.";
      setScreenShareError(message);
      console.error("[ScreenShare] start failed:", err);
    }
  };

  const addReactionBubble = (
    targetId: string,
    emoji: string,
    senderName: string,
    timestamp: number
  ) => {
    reactionIdRef.current += 1;
    const id = reactionIdRef.current;
    const bubble: ReactionBubble = { id, emoji, senderName, timestamp };
    setReactionBubbles((prev) => ({
      ...prev,
      [targetId]: [...(prev[targetId] || []), bubble].slice(-4),
    }));

    window.setTimeout(() => {
      setReactionBubbles((prev) => {
        const existing = prev[targetId] || [];
        const next = existing.filter((item) => item.id !== id);
        if (next.length === 0) {
          const updated = { ...prev };
          delete updated[targetId];
          return updated;
        }
        return { ...prev, [targetId]: next };
      });
    }, 3800);
  };

  const triggerFloatingReaction = (
    emoji: string,
    senderName: string,
    senderImage?: string
  ) => {
    reactionIdRef.current += 1;
    const id = reactionIdRef.current;
    const x = 20 + ((id * 37) % 61); // range 20% to 80% width
    setFloatingReactions((prev) => [...prev, { id, emoji, senderName, senderImage, x }]);
    setTimeout(() => {
      setFloatingReactions((prev) => prev.filter((r) => r.id !== id));
    }, 4000);
  };

  const handleReaction = (emoji: string) => {
    lastLocalReactionRef.current = { emoji, pendingEcho: true };
    sessionRef.current?.sendReaction(emoji);
    triggerFloatingReaction(emoji, "You", isAuthenticated ? identity.image : undefined);
    addReactionBubble("local", emoji, "You", reactionIdRef.current);
    window.setTimeout(() => {
      if (lastLocalReactionRef.current?.emoji === emoji) {
        lastLocalReactionRef.current = null;
      }
    }, 2500);
    setShowEmojiPicker(false);
  };

  const handleSelectParticipant = (participantId: string) => {
    setPinnedParticipantId((prev) => (prev === participantId ? prev : participantId));
    if (meetingLayout === "tiled") {
      setMeetingLayout("auto");
    }
  };

  const handleLayoutChange = (layout: MeetingLayout) => {
    setMeetingLayout(layout);
    setShowLayoutMenu(false);
  };

  const handleToggleParticipantPin = (participantId: string) => {
    setPinnedParticipantId((prev) => (prev === participantId ? null : participantId));
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    sessionRef.current?.sendChatMessage(chatInput.trim(), resolvedDisplayName);
    setChatInput("");
  };

  const handleAdmit = (socketId: string) => {
    sessionRef.current?.approveJoin(socketId);
    setJoinRequests((prev) => prev.filter((r) => r.socketId !== socketId));
  };

  const handleDeny = (socketId: string) => {
    sessionRef.current?.denyJoin(socketId);
    setJoinRequests((prev) => prev.filter((r) => r.socketId !== socketId));
  };

  const handleOpenAdmitGuestsDialog = () => {
    setShowAdmitGuestsDialog(true);
    setShowParticipantsList(false);
  };

  const handleAdmitGuestFromDialog = (socketId: string) => {
    handleAdmit(socketId);
    if (joinRequests.length <= 1) {
      setShowAdmitGuestsDialog(false);
    }
  };

  const handleDenyGuestFromDialog = (socketId: string) => {
    handleDeny(socketId);
    if (joinRequests.length <= 1) {
      setShowAdmitGuestsDialog(false);
    }
  };

  const handleKick = (socketId: string) => {
    sessionRef.current?.removeParticipant(socketId);
  };

  const handleAdmitAll = () => {
    joinRequests.forEach((request) => {
      sessionRef.current?.approveJoin(request.socketId);
    });
    setJoinRequests([]);
    setShowAdmitGuestsDialog(false);
  };

  const handleCancelJoinRequest = () => {
    sessionRef.current?.destroy();
    sessionRef.current = null;
    setIsJoining(false);
    setMeetingState("lobby");
  };

  const handleLeaveMeeting = () => {
    cleanupAll();
    resetInMeetingUiState();
    meetingJoinedAtRef.current = null;
    setShowLeaveDialog(false);
    setMeetingState("ended");
  };

  const handleReturnHome = () => {
    router.push("/");
  };

  const handleRejoin = async () => {
    cleanupLiveSession();
    setMeetingError(null);
    setMediaError(null);
    setParticipantLeftMessage(null);
    setIsScreenSharing(false);
    setIsHandRaised(false);
    setMeetingState("lobby");
    await startPreviewMedia();
  };

  const handleJoinNow = async () => {
    if (!meetingCode) return;
    if (isJoining) return; // prevent duplicate clicks
    if (sessionRef.current?.isActive()) return;

    setIsJoining(true);

    if (!socket.connected) {
      socket.connect();
    }

    const stream = localStreamRef.current;
    if (!stream) {
      setIsJoining(false);
      return;
    }

    // Create session
    const session = new MeetingPeerSession(meetingCode, socket, stream, {
      onWaitingRoom: () => {
        setIsJoining(false);
        setMeetingState("waiting");
      },
      onJoinApproved: (members, isHostRole) => {
        setIsJoining(false);
        setIsHost(isHostRole);
        setMeetingState("inMeeting");
        meetingJoinedAtRef.current = Date.now();

        // Add existing members (excluding local user)
        setParticipants(dedupeParticipants(
          members
            .filter((m) => m.socketId !== socket.id)
            .map((m) => ({
              socketId: m.socketId,
              displayName: getIdentityLabel(m),
              email: m.email,
              image: m.image,
              isMicOn: m.isMicOn,
              isCameraOn: m.isCameraOn,
              isHandRaised: m.isHandRaised || false,
              isHost: m.isHost,
              isScreenSharing: m.isScreenSharing || false,
            }))
        ));
      },
      onChatHistory: (chatHistory) => {
        setMessages(chatHistory);
        setUnreadMessages(0);
      },
      onJoinDenied: (reason) => {
        setIsJoining(false);
        setDeniedReason(reason);
        setMeetingState("denied");
      },
      onRemoteStreamAdded: (socketId, remoteStream, remoteName, remoteDetails) => {
        if (socketId === socket.id) return;
        setParticipants((prev) => {
          const exists = prev.find((p) => p.socketId === socketId);
          if (exists) {
            return dedupeParticipants(prev.map((p) =>
              p.socketId === socketId
                ? {
                  ...p,
                  stream: remoteStream,
                  email: p.email || remoteDetails?.email,
                  image: p.image || remoteDetails?.image,
                  displayName: getIdentityLabel({
                    displayName: p.displayName || remoteName,
                    email: p.email || remoteDetails?.email,
                  }),
                  isMicOn: remoteDetails?.isMicOn ?? p.isMicOn,
                  isCameraOn: remoteDetails?.isCameraOn ?? p.isCameraOn,
                  isScreenSharing: remoteDetails?.isScreenSharing ?? p.isScreenSharing,
                  isHandRaised: remoteDetails?.isHandRaised ?? p.isHandRaised,
                  isHost: remoteDetails?.isHost ?? p.isHost,
                }
                : p
            ));
          } else {
            return dedupeParticipants([
              ...prev,
              {
                socketId,
                displayName: getIdentityLabel({
                  displayName: remoteName,
                  email: remoteDetails?.email,
                }),
                email: remoteDetails?.email,
                image: remoteDetails?.image,
                stream: remoteStream,
                isMicOn: remoteDetails?.isMicOn ?? true,
                isCameraOn: remoteDetails?.isCameraOn ?? true,
                isHandRaised: remoteDetails?.isHandRaised ?? false,
                isHost: remoteDetails?.isHost ?? false,
                isScreenSharing: false,
              },
            ]);
          }
        });
      },
      onRemoteStreamRemoved: (socketId) => {
        removeParticipantFromUi(socketId);
      },
      onLocalScreenShareEnded: () => {
        void endScreenShare();
      },
      onRemoteStatusChanged: (data) => {
        if (data.socketId === socket.id) return;
        setParticipants((prev) =>
          prev.map((p) => {
            if (p.socketId === data.socketId) {
              // Force React to detect track/stream updates by recreating MediaStream reference
              const streamCopy = p.stream ? new MediaStream(p.stream.getTracks()) : undefined;
              return {
                ...p,
                isMicOn: data.isMicOn,
                isCameraOn: data.isCameraOn,
                isHandRaised: data.isHandRaised ?? p.isHandRaised,
                displayName: getIdentityLabel({
                  displayName: data.displayName || p.displayName,
                  email: data.email || p.email,
                }),
                email: data.email || p.email,
                image: data.image || p.image,
                stream: streamCopy,
              };
            }
            return p;
          })
        );
      },
      onJoinRequest: (data) => {
        setJoinRequests((prev) => {
          if (prev.some((request) => request.socketId === data.socketId)) {
            return prev;
          }
          return [
            ...prev,
            {
              ...data,
              displayName: getIdentityLabel(data),
            },
          ];
        });
      },
      onParticipantJoined: (member) => {
        if (member.socketId === socket.id) return;
        upsertParticipant({
          socketId: member.socketId,
          displayName: getIdentityLabel(member),
          email: member.email,
          image: member.image,
          isMicOn: member.isMicOn,
          isCameraOn: member.isCameraOn,
          isHandRaised: member.isHandRaised || false,
          isHost: member.isHost,
          isScreenSharing: member.isScreenSharing || false,
        });
      },
      onJoinRequestCancelled: (data) => {
        setJoinRequests((prev) => prev.filter((r) => r.socketId !== data.socketId));
      },
      onHostChanged: (data) => {
        if (data.hostId === socket.id) {
          setIsHost(true);
          setParticipantLeftMessage("You have been promoted to Host");
          setTimeout(() => setParticipantLeftMessage(null), 3000);
        }
        setParticipants((prev) =>
          prev.map((p) => ({
            ...p,
            isHost: p.socketId === data.hostId,
          }))
        );
      },
      onReceiveMessage: (data) => {
        setMessages((prev) => [...prev, data]);
        if (!showChatRef.current && data.senderId !== socket.id) {
          setUnreadMessages((prev) => prev + 1);
        }
      },
      onEmojiReaction: (data) => {
        if (data.senderId === socket.id) {
          const lastLocalReaction = lastLocalReactionRef.current;
          if (
            lastLocalReaction?.emoji === data.emoji &&
            lastLocalReaction.pendingEcho
          ) {
            lastLocalReactionRef.current = null;
            return;
          }
        }
        const name =
          data.senderName ||
          participantsRef.current.find((p) => p.socketId === data.senderId)?.displayName ||
          "Signed-in user";
        const senderName = data.senderId === socket.id ? "You" : name;
        triggerFloatingReaction(data.emoji, senderName, data.senderImage);
        const targetId = data.senderId === socket.id ? "local" : data.senderId;
        addReactionBubble(targetId, data.emoji, senderName, data.timestamp || Date.now());
      },
      onScreenShareStarted: (senderId) => {
        if (senderId === socket.id) {
          setParticipants((prev) =>
            prev.map((p) => {
              if (!p.isScreenSharing) return p;
              const streamCopy = p.stream ? new MediaStream(p.stream.getTracks()) : undefined;
              return { ...p, isScreenSharing: false, stream: streamCopy };
            })
          );
          return;
        }

        if (screenStreamRef.current) {
          void endScreenShare();
        }

        setParticipants((prev) =>
          prev.map((p) => {
            if (p.socketId === senderId || p.isScreenSharing) {
              const streamCopy = p.stream ? new MediaStream(p.stream.getTracks()) : undefined;
              return { ...p, isScreenSharing: p.socketId === senderId, stream: streamCopy };
            }
            return p;
          })
        );
      },
      onScreenShareStopped: (senderId) => {
        if (senderId === socket.id) return;
        setParticipants((prev) =>
          prev.map((p) => {
            if (p.socketId === senderId) {
              // Recreate the MediaStream reference so React's ParticipantVideo re-triggers the track attachment immediately
              const streamCopy = p.stream ? new MediaStream(p.stream.getTracks()) : undefined;
              return { ...p, isScreenSharing: false, stream: streamCopy };
            }
            return p;
          })
        );
      },
      onHandRaisedChanged: ({ senderId, isHandRaised }) => {
        setParticipants((prev) =>
          prev.map((p) =>
            p.socketId === senderId ? { ...p, isHandRaised } : p
          )
        );
      },
      onKicked: () => {
        cleanupAll();
        setMeetingState("denied");
        setDeniedReason("You were removed from the meeting by the host");
      },
    });

    const token = typeof window !== "undefined" ? localStorage.getItem("authToken") : null;

    sessionRef.current = session;
    try {
      await session.start({
      displayName: isAuthenticated ? displayName : customDisplayName,
      email: isAuthenticated ? identity.email : undefined,
      image: isAuthenticated ? identity.image : undefined,
      token: token || undefined,
      isMicOn,
      isCameraOn,
    });
  } catch (error) {
      setIsJoining(false);
      setMeetingError(error instanceof Error ? error.message : "Unable to join meeting.");
    }
  };

  // Camera & Mic setup
  const startPreviewMedia = async () => {
    setPermissionRequested(true);
    try {
      const storedPreferences = getStoredDevicePreferences();
      let stream: MediaStream;
      try {
        stream = await getLocalStream({
          audioInputId: storedPreferences.audioInputId || selectedAudioInputId,
          videoInputId: storedPreferences.videoInputId || selectedVideoInputId,
        });
      } catch (error) {
        if (!storedPreferences.audioInputId && !storedPreferences.videoInputId) {
          throw error;
        }
        stream = await getLocalStream();
      }
      stream.getAudioTracks().forEach((t) => (t.enabled = isMicOn));
      stream.getVideoTracks().forEach((t) => (t.enabled = isCameraOn));
      localStreamRef.current = stream;
      setLocalStreamForRender(stream);
      setMediaError(null);
      await refreshMediaDevices();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setMediaError(`Camera/microphone permission failed: ${errorMessage}`);
      await refreshMediaDevices();
    }
  };

  // Preview start in lobby
  useEffect(() => {
    if (!meetingCode) return;
    startPreviewMedia();

    return () => {
      stopPreviewTracks();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingCode]);

  useEffect(() => {
    if (!navigator.mediaDevices?.addEventListener) return;

    const handleDeviceChange = async () => {
      await refreshMediaDevices();

      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter((device) => device.kind === "audioinput");
        const audioOutputs = devices.filter((device) => device.kind === "audiooutput");
        const videoInputs = devices.filter((device) => device.kind === "videoinput");
        const activeAudioTrack = localStreamRef.current?.getAudioTracks()[0];
        const activeVideoTrack = localStreamRef.current?.getVideoTracks()[0];

        if (
          audioInputs.length > 0 &&
          (activeAudioTrack?.readyState === "ended" ||
            (selectedAudioInputIdRef.current &&
              !audioInputs.some((device) => device.deviceId === selectedAudioInputIdRef.current)))
        ) {
          await handleSelectAudioInput(audioInputs[0].deviceId);
        }

        if (
          videoInputs.length > 0 &&
          (activeVideoTrack?.readyState === "ended" ||
            (selectedVideoInputIdRef.current &&
              !videoInputs.some((device) => device.deviceId === selectedVideoInputIdRef.current)))
        ) {
          await handleSelectVideoInput(videoInputs[0].deviceId);
        }

        if (
          selectedAudioOutputIdRef.current &&
          !audioOutputs.some((device) => device.deviceId === selectedAudioOutputIdRef.current)
        ) {
          handleSelectAudioOutput(audioOutputs[0]?.deviceId || "");
        }
      } catch (error) {
        console.warn("[MediaDevices] Device change handling failed:", error);
      }
    };

    queueMicrotask(() => {
      void refreshMediaDevices();
    });
    navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange);
    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", handleDeviceChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // preview presence removed; keep original waiting-room flow

  // Validate Code
  useEffect(() => {
    if (!meetingCode) return;
    const validate = async () => {
      try {
        const response = await getMeetingByCode(meetingCode);
        setMeetingData(response.meeting);
      } catch (err) {
        setMeetingError(err instanceof Error ? err.message : "Meeting not found");
        setTimeout(() => router.push("/dashboard"), 3000);
      }
    };
    validate();
  }, [meetingCode, router]);

  // Meeting duration timer
  useEffect(() => {
    if (meetingState !== "inMeeting" || !meetingJoinedAtRef.current) return;

    const formatDuration = (seconds: number) => {
      const hrs = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      const secs = seconds % 60;
      if (hrs > 0) {
        return `${hrs}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
      }
      return `${mins}:${String(secs).padStart(2, "0")}`;
    };

    const tick = () => {
      if (!meetingJoinedAtRef.current) return;
      const elapsed = Math.floor((Date.now() - meetingJoinedAtRef.current) / 1000);
      setMeetingDuration(formatDuration(elapsed));
    };

    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [meetingState]);

  // Network status
  useEffect(() => {
    const updateOnline = () => setIsOnline(navigator.onLine);
    updateOnline();
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
    };
  }, []);

  // Sync clock time
  useEffect(() => {
    const update = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        })
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  // Dropdown closing triggers
  useEffect(() => {
    const clickOut = (event: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
      if (layoutRef.current && !layoutRef.current.contains(event.target as Node)) {
        setShowLayoutMenu(false);
      }
      if (moreOptionsRef.current && !moreOptionsRef.current.contains(event.target as Node)) {
        setShowMoreOptionsMenu(false);
      }
      if (audioDeviceMenuRef.current && !audioDeviceMenuRef.current.contains(event.target as Node)) {
        setShowAudioDeviceMenu(false);
      }
      if (videoDeviceMenuRef.current && !videoDeviceMenuRef.current.contains(event.target as Node)) {
        setShowVideoDeviceMenu(false);
      }
    };
    document.addEventListener("mousedown", clickOut);
    return () => document.removeEventListener("mousedown", clickOut);
  }, []);

  useEffect(() => {
    showChatRef.current = showChat;
    if (showChat) {
      setUnreadMessages(0);
      requestAnimationFrame(() => {
        chatScrollRef.current?.scrollTo({
          top: chatScrollRef.current.scrollHeight,
          behavior: "smooth",
        });
      });
    }
  }, [showChat]);

  useEffect(() => {
    participantsRef.current = participants;
  }, [participants]);

  useEffect(() => {
    if (!showChat) return;
    chatScrollRef.current?.scrollTo({
      top: chatScrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, showChat]);

  // Sync Local stream elements
  useEffect(() => {
    const stream = localStreamRef.current;
    if (stream && localVideoRef.current) {
      const video = localVideoRef.current;
      // Avoid duplicate srcObject assignments to prevent flashes
      if (video.srcObject !== stream) {
        video.srcObject = stream;
      }
      // Ensure playback starts (some browsers need explicit play() calls)
      video.play().catch((err) => {
        console.log('[WebRTC:Video] Local autoplay failed:', err);
      });
    }
  }, [localStreamForRender, meetingState, isCameraOn, isScreenSharing, meetingLayout, pinnedParticipantId]);

  // Refresh screen share + peers after tab focus / network recovery (long meetings).
  useEffect(() => {
    if (meetingState !== "inMeeting") return;

    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      void sessionRef.current?.refreshScreenShareIfActive();
    };

    const onOnline = () => {
      void sessionRef.current?.refreshScreenShareIfActive();
    };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
    };
  }, [meetingState]);

  // Active speaker detection (UI-only; no signaling flow changes)
  useEffect(() => {
    if (meetingState !== "inMeeting") return;
    if (typeof window === "undefined") return;

    const AudioCtx =
      window.AudioContext ||
      (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const cleanupFns: Array<() => void> = [];

    const monitorStream = (id: string, stream?: MediaStream | null) => {
      if (!stream || stream.getAudioTracks().length === 0) return;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      const data = new Uint8Array(analyser.frequencyBinCount);
      source.connect(analyser);

      const timer = window.setInterval(() => {
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i += 1) sum += data[i];
        const level = sum / data.length / 255;
        audioLevelsRef.current[id] = level;
      }, 220);

      cleanupFns.push(() => {
        window.clearInterval(timer);
        try {
          source.disconnect();
          analyser.disconnect();
        } catch {
          // no-op cleanup
        }
        delete audioLevelsRef.current[id];
      });
    };

    monitorStream("local", localStreamRef.current);
    participants.forEach((p) => monitorStream(p.socketId, p.stream));

    const activeTimer = window.setInterval(() => {
      let maxId: string | null = null;
      let maxLevel = 0.05;
      Object.entries(audioLevelsRef.current).forEach(([id, level]) => {
        if (level > maxLevel) {
          maxLevel = level;
          maxId = id;
        }
      });
      setActiveSpeakerId(maxId);
    }, 320);
    cleanupFns.push(() => window.clearInterval(activeTimer));

    return () => {
      cleanupFns.forEach((fn) => fn());
      void ctx.close().catch(() => { });
    };
  }, [participants, meetingState]);

  // Cleanup on page close
  useEffect(() => {
    return () => {
      cleanupAll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // =========================
  // CONDITIONAL RENDER VIEWS
  // =========================

  if (meetingError) {
    return (
      <div className="fixed inset-0 bg-[#202124] text-white flex flex-col items-center justify-center">
        <h1 className="text-2xl font-light">Can&apos;t join meeting</h1>
        <p className="text-white/60 mt-4">{meetingError}</p>
      </div>
    );
  }

  if (meetingState === "lobby") {
    return (
      <PreviewLobby
        displayName={resolvedDisplayName}
        email={isAuthenticated ? identity.email : undefined}
        image={isAuthenticated ? identity.image : undefined}
        videoRef={localVideoRef}
        isMicOn={isMicOn}
        isCameraOn={isCameraOn}
        mediaError={mediaError}
        onToggleMic={handleToggleMic}
        onToggleCamera={handleToggleCamera}
        audioInputDevices={audioInputDevices}
        audioOutputDevices={audioOutputDevices}
        videoInputDevices={videoInputDevices}
        selectedAudioInputId={selectedAudioInputId}
        selectedAudioOutputId={selectedAudioOutputId}
        selectedVideoInputId={selectedVideoInputId}
        onSelectAudioInput={(deviceId) => void handleSelectAudioInput(deviceId)}
        onSelectAudioOutput={handleSelectAudioOutput}
        onSelectVideoInput={(deviceId) => void handleSelectVideoInput(deviceId)}
        onJoinNow={handleJoinNow}
        isAuthenticated={isAuthenticated}
        customDisplayName={customDisplayName}
        onCustomDisplayNameChange={setCustomDisplayName}
        isJoining={isJoining}
      />
    );
  }

  if (meetingState === "waiting") {
    return (
      <div className="fixed inset-0 flex flex-col bg-[#202124] text-white">
        <header className="flex h-14 items-center px-4 sm:px-6">
          <span className="font-mono text-sm tracking-wider text-[#8ab4f8]">{meetingCode}</span>
        </header>

        <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4 pb-8">
          <div className="relative w-full max-w-md overflow-hidden rounded-xl bg-[#3c4043] aspect-video meet-video-box">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className={`h-full w-full object-cover ${isCameraOn ? "block" : "hidden"}`}
            />
            {!isCameraOn && (
              <div className="absolute inset-0 flex items-center justify-center">
                <MeetAvatar
                  name={resolvedDisplayName}
                  email={isAuthenticated ? identity.email : undefined}
                  image={isAuthenticated ? identity.image : undefined}
                  size="xl"
                />
              </div>
            )}
            <div className="absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-xs">
              {resolvedDisplayName}
            </div>
          </div>

          <div className="flex flex-col items-center gap-3 text-center">
            <div className="relative flex h-16 w-16 items-center justify-center">
              <div className="absolute inset-0 rounded-full border-2 border-[#8ab4f8] meet-waiting-pulse" />
              <div className="h-10 w-10 rounded-full bg-[#8ab4f8]/20" />
            </div>
            <h1 className="text-2xl font-light sm:text-3xl">Asking to join...</h1>
            <p className="max-w-sm text-sm leading-relaxed text-white/60">
              Please wait. The meeting host will let you in shortly.
            </p>
            {meetingData?.title && (
              <p className="text-sm text-white/80">{meetingData.title}</p>
            )}
          </div>

          <button
            type="button"
            onClick={handleCancelJoinRequest}
            className="rounded-full border border-white/20 px-6 py-2.5 text-sm font-medium text-[#8ab4f8] transition-colors duration-[180ms] hover:bg-white/8"
          >
            Cancel request
          </button>
        </main>
      </div>
    );
  }

  if (meetingState === "denied") {
    return (
      <div className="fixed inset-0 bg-[#202124] text-white flex flex-col items-center justify-center gap-6">
        <div className="h-20 w-20 rounded-full bg-red-500/20 flex items-center justify-center text-4xl">
          🛑
        </div>
        <h1 className="text-3xl font-light">Join request denied</h1>
        <p className="text-white/60 text-sm">{deniedReason}</p>
        <button
          onClick={handleReturnHome}
          className="mt-2 px-6 py-3 bg-[#8ab4f8] text-[#202124] rounded-full text-sm font-medium hover:bg-[#a8c7fa] transition-colors"
        >
          Return to home
        </button>
      </div>
    );
  }

  if (meetingState === "ended") {
    return (
      <div className="fixed inset-0 bg-[#202124] text-white flex flex-col items-center justify-center gap-6">
        <h1 className="text-3xl font-light">You left the meeting</h1>
        <p className="text-white/60 text-sm">Meeting code: {meetingCode}</p>
        <div className="flex gap-4 mt-2">
          <button
            onClick={handleRejoin}
            className="px-6 py-3 bg-[#3c4043] hover:bg-[#4f5357] rounded-full text-sm font-medium transition-colors"
          >
            Rejoin
          </button>
          <button
            onClick={handleReturnHome}
            className="px-6 py-3 bg-[#8ab4f8] text-[#202124] rounded-full text-sm font-medium hover:bg-[#a8c7fa] transition-colors"
          >
            Return to home
          </button>
        </div>
      </div>
    );
  }

  // Responsive grid sizing (Google Meet-like): auto-fit tiles without horizontal overflow.
  // UI-only: does not affect any meeting logic.
  // Use deduped active participants (exclude waiting room) for counts and layouts
  const activeParticipants = dedupeParticipants(participants).filter((p) => {
    const status = (p as any).status ?? null;
    return status !== "IN_WAITING_ROOM";
  });
  const totalConferencingUsers = activeParticipants.length + 1; // Participants + local user
  const isTwoUp = totalConferencingUsers === 2;
  const layoutOptions: Array<{
    id: MeetingLayout;
    label: string;
    icon: typeof LayoutGrid;
  }> = [
      { id: "auto", label: "Auto", icon: LayoutGrid },
      { id: "tiled", label: "Tiled", icon: Rows3 },
      { id: "spotlight", label: "Spotlight", icon: Pin },
      { id: "sidebar", label: "Sidebar", icon: PanelRight },
    ];
  const activeLayout = layoutOptions.find((option) => option.id === meetingLayout) || layoutOptions[0];
  const hasVisibleVideo = (
    stream: MediaStream | undefined,
    cameraOn: boolean,
    sharing: boolean
  ) => Boolean(stream && (cameraOn || sharing));

  const sharingParticipant = participants.find((p) => p.isScreenSharing);
  const presenterId: string | null = isScreenSharing
    ? "local"
    : sharingParticipant?.socketId ?? null;
  const effectiveLayout: MeetingLayout =
    meetingLayout === "auto"
      ? pinnedParticipantId || presenterId
        ? totalConferencingUsers > 1 ? "sidebar" : "spotlight"
        : totalConferencingUsers >= 7
          ? "sidebar"
          : activeSpeakerId && totalConferencingUsers > 2
            ? "sidebar"
            : "tiled"
      : meetingLayout;
  const layoutWantsStage =
    effectiveLayout === "spotlight" || effectiveLayout === "sidebar";
  const defaultStageParticipantId =
    activeSpeakerId || participants[0]?.socketId || "local";
  const stageParticipantId =
    pinnedParticipantId || presenterId || (layoutWantsStage ? defaultStageParticipantId : null);
  const useStageLayout =
    Boolean(stageParticipantId) && layoutWantsStage;
  const orderedParticipants = [...activeParticipants].sort((a, b) => {
    if (a.socketId === pinnedParticipantId) return -1;
    if (b.socketId === pinnedParticipantId) return 1;
    if (a.socketId === presenterId) return -1;
    if (b.socketId === presenterId) return 1;
    if (a.socketId === activeSpeakerId) return -1;
    if (b.socketId === activeSpeakerId) return 1;
    return 0;
  });
  const visibleGridCount = totalConferencingUsers;
  const minTilePx =
    visibleGridCount <= 1
      ? 620
      : visibleGridCount === 2
        ? 420
        : visibleGridCount <= 4
          ? 300
          : visibleGridCount <= 9
            ? 220
            : 170;
  const gridStyle: React.CSSProperties | undefined = isTwoUp
    ? undefined
    : {
      gridTemplateColumns: `repeat(auto-fit, minmax(min(${minTilePx}px, 100%), 1fr))`,
    };
  const presenterParticipant =
    stageParticipantId === "local" ? null : participants.find((p) => p.socketId === stageParticipantId);
  const presenterStream =
    stageParticipantId === "local"
      ? (isScreenSharing ? screenStreamForRender : localStreamForRender) ?? undefined
      : presenterParticipant?.stream;
  const presenterName =
    stageParticipantId === "local" ? resolvedDisplayName : presenterParticipant?.displayName ?? "Participant";
  const isStageScreenShare =
    stageParticipantId === "local"
      ? isScreenSharing
      : Boolean(presenterParticipant?.isScreenSharing);
  const stageHasVisibleVideo =
    stageParticipantId === "local"
      ? Boolean(presenterStream && (isCameraOn || isScreenSharing))
      : hasVisibleVideo(
        presenterStream,
        Boolean(presenterParticipant?.isCameraOn),
        Boolean(presenterParticipant?.isScreenSharing)
      );
  const filmstripParticipants = orderedParticipants.filter((p) => p.socketId !== stageParticipantId);
  const showLocalInFilmstrip = stageParticipantId !== "local";
  const stageLayoutIsSpotlight = effectiveLayout === "spotlight";

  const renderReactionBubbles = (targetId: string, compact = false) => {
    const bubbles = reactionBubbles[targetId];
    if (!bubbles?.length) return null;

    return (
      <div className={`absolute ${compact ? "top-2 left-2 gap-1" : "top-4 left-4 gap-2"} z-20 flex flex-col pointer-events-none`}>
        {bubbles.map((reaction) => (
          <div
            key={reaction.id}
            className={[
              "flex items-center rounded-full bg-black/70 text-white shadow-xl backdrop-blur-sm",
              compact ? "gap-1.5 px-2 py-1 text-[11px]" : "gap-2 px-3 py-1 text-xs",
            ].join(" ")}
          >
            <span className={compact ? "text-base leading-none" : "text-lg leading-none"}>
              {reaction.emoji}
            </span>
            <span className="max-w-[120px] truncate">{reaction.senderName}</span>
          </div>
        ))}
      </div>
    );
  };

  const renderTileBadges = (props: any) => {
    const { id, name, host, handRaised, micOn, screenSharing, compact = false } = props;
    const level = audioLevelsRef.current[id] || 0;
    const showActivity = micOn && level > 0.04;
    const activityScale = Math.min(1.6, 0.6 + level * 2.5);

    return (
      <>
        {handRaised && (
          <div className={`absolute ${compact ? "top-2 right-2 h-7 w-7" : "top-4 right-4 h-9 w-9"} z-20 flex items-center justify-center rounded-full bg-yellow-400 text-black shadow-xl animate-pulse`}> 
            <Hand className={compact ? "h-4 w-4" : "h-5 w-5"} />
          </div>
        )}

        {/* Mic activity indicator */}
        {showActivity && (
          <div
            aria-hidden
            className={`absolute ${compact ? "top-2 left-2" : "top-4 left-4"} z-10 flex items-center justify-center`}
            style={{
              width: compact ? 18 : 22,
              height: compact ? 18 : 22,
            }}
          >
            <span
              className="absolute rounded-full bg-[rgba(52,168,83,0.18)]"
              style={{
                width: (compact ? 18 : 22) * activityScale,
                height: (compact ? 18 : 22) * activityScale,
                transform: `translate(-50%,-50%)`,
                left: 6,
                top: 6,
                transition: "width 160ms linear, height 160ms linear, opacity 160ms linear",
                opacity: Math.min(1, 0.35 + level * 1.2),
              }}
            />
            <span
              className="relative z-20 block rounded-full bg-[#34A853]"
              style={{ width: compact ? 10 : 12, height: compact ? 10 : 12 }}
            />
          </div>
        )}

        <div className={`absolute ${compact ? "bottom-1 left-1 px-2 py-0.5 text-[10px]" : "bottom-3 left-3 px-3 py-1.5 text-xs"} z-20 flex max-w-[80%] items-center gap-2 rounded-full border border-white/10 bg-black/60 font-light tracking-wide backdrop-blur-md`}>
          <span className={compact ? "max-w-[90px] truncate" : "max-w-[140px] truncate"}>{name}</span>
          {host && <Shield className="h-3.5 w-3.5 text-yellow-400" />}
          {handRaised && <Hand className="h-3.5 w-3.5 text-yellow-300" />}
          {!micOn && <MicOff className="h-3 w-3 text-red-400" />}
          {screenSharing && <MonitorUp className="h-3.5 w-3.5 text-[#8ab4f8]" />}
          {pinnedParticipantId === id && <Pin className="h-3.5 w-3.5 text-[#8ab4f8]" />}
        </div>
      </>
    );
  };
  const renderDeviceList = (
    title: string,
    devices: MediaDeviceInfo[],
    selectedDeviceId: string,
    fallbackLabel: string,
    onSelectDevice: (deviceId: string) => void | Promise<void>
  ) => (
    <div>
      <div className="px-3 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-white/45">
        {title}
      </div>
      {devices.length > 0 ? (
        devices.map((device, index) => (
          <button
            key={device.deviceId}
            type="button"
            onClick={() => {
              void onSelectDevice(device.deviceId);
              setShowAudioDeviceMenu(false);
              setShowVideoDeviceMenu(false);
            }}
            className={[
              "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors",
              device.deviceId === selectedDeviceId
                ? "bg-[#8ab4f8] text-[#202124]"
                : "text-white/85 hover:bg-white/10",
            ].join(" ")}
            title={getMediaDeviceLabel(device, index, fallbackLabel)}
          >
            <span className="min-w-0 flex-1 truncate">
              {getMediaDeviceLabel(device, index, fallbackLabel)}
            </span>
          </button>
        ))
      ) : (
        <div className="px-3 py-2 text-sm text-white/45">No devices found</div>
      )}
    </div>
  );
  const ActiveLayoutIcon = activeLayout.icon;

  // Participant status text (Google Meet-like)
  const formatParticipantNames = (items: Participant[]) => {
    const names = items.map((p) => p.displayName || "Participant");
    if (names.length === 1) return `${names[0]} is in the call`;
    if (names.length === 2) return `${names[0]} and ${names[1]} are in the call`;
    if (names.length === 3) return `${names[0]}, ${names[1]}, and ${names[2]} are in the call`;
    return "";
  };

  const renderParticipantStatus = () => {
    // Use active participants (exclude waiting room) and exclude local user
    const others = activeParticipants.filter((p) => p.socketId !== socket.id);

    if (others.length === 0) {
      return "No one else is here";
    }

    // For small numbers, show participant names like Google Meet; otherwise show total count (including you)
    if (others.length <= 3) {
      const namesText = formatParticipantNames(others);
      if (namesText) return namesText;
    }

    const totalIncludingYou = others.length + 1;
    return `${totalIncludingYou} people in call`;
  };

  const filteredParticipants = activeParticipants.filter((p) => {
    if (!participantSearch.trim()) return true;
    const query = participantSearch.toLowerCase();
    return (
      p.displayName.toLowerCase().includes(query) ||
      (p.email?.toLowerCase().includes(query) ?? false)
    );
  });

  return (
    <div className="fixed inset-0 bg-[#202124] text-white flex flex-col font-sans select-none overflow-hidden">
      {/* Status toast */}
      {participantLeftMessage && (
        <div className="absolute top-16 left-1/2 z-[80] -translate-x-1/2 animate-fade-in">
          <div className="rounded-full bg-[#323639] px-4 py-2 text-sm text-white shadow-lg ring-1 ring-white/10">
            {participantLeftMessage}
          </div>
        </div>
      )}

      {/* Top bar */}
      <header className="relative z-30 flex h-12 shrink-0 items-center justify-between border-b border-white/5 px-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <span className="hidden truncate text-sm font-medium text-white/90 sm:block">
            {meetingData?.title || "Meeting"}
          </span>
          <span className="hidden h-4 w-px bg-white/15 sm:block" />
          <span className="font-mono text-xs tracking-wider text-[#8ab4f8] sm:text-sm">{meetingCode}</span>
          <span className="hidden text-xs text-white/50 sm:inline">{meetingDuration}</span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {isHost && (
            <span className="hidden items-center gap-1 rounded-full bg-yellow-400/10 px-2 py-0.5 text-[11px] font-medium text-yellow-300 sm:inline-flex">
              <Shield className="h-3 w-3" />
              Host
            </span>
          )}
          {isMeetingLocked && isHost && (
            <span className="hidden items-center gap-1 rounded-full bg-white/8 px-2 py-0.5 text-[11px] text-white/70 sm:inline-flex">
              <Lock className="h-3 w-3" />
              Locked
            </span>
          )}
          <span className="flex items-center gap-1 text-xs text-white/55">
            {isOnline ? (
              <Wifi className="h-3.5 w-3.5 text-[#34a853]" />
            ) : (
              <WifiOff className="h-3.5 w-3.5 text-[#ea4335]" />
            )}
            <span className="hidden sm:inline">{isOnline ? "Connected" : "Reconnecting"}</span>
          </span>
          <span className="flex items-center gap-1 rounded-full bg-white/8 px-2.5 py-1 text-xs text-white/80">
            <Users className="h-3.5 w-3.5" />
            {totalConferencingUsers}
          </span>
        </div>
      </header>

      {/* Floating Join Request card (Host only) */}
      {isHost && joinRequests.length > 0 && !showAdmitGuestsDialog && (
        <div className="absolute right-4 top-16 z-50 w-[min(340px,calc(100vw-32px))] rounded-2xl border border-white/10 bg-[#2d2e30] p-5 shadow-2xl animate-fade-in">
          <div className="flex flex-col items-center text-center">
            <MeetAvatar
              name={joinRequests[0].displayName}
              email={joinRequests[0].email}
              image={joinRequests[0].image}
              size="md"
            />
            <p className="mt-3 truncate text-[15px] font-medium text-white">
              {joinRequests[0].displayName}
            </p>
            <p className="mt-1 text-sm text-white/60">
              {joinRequests.length === 1
                ? "Wants to join this meeting"
                : `${joinRequests.length} people want to join`}
            </p>
          </div>
          <div className="mt-5 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => handleDeny(joinRequests[0].socketId)}
              className="meet-control-btn h-9 px-5 text-sm font-medium text-[#8ab4f8] hover:bg-[#8ab4f8]/10"
            >
              Deny
            </button>
            <button
              type="button"
              onClick={() => handleAdmit(joinRequests[0].socketId)}
              className="meet-control-btn meet-control-btn-active h-9 px-5 text-sm font-medium"
            >
              Admit
            </button>
          </div>
          {joinRequests.length > 1 && (
            <button
              type="button"
              onClick={handleOpenAdmitGuestsDialog}
              className="mt-3 w-full text-center text-xs text-[#8ab4f8] hover:underline"
            >
              View all {joinRequests.length} requests
            </button>
          )}
        </div>
      )}

      {isHost && showAdmitGuestsDialog && joinRequests.length > 0 && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 px-4 py-6 backdrop-blur-[2px] animate-fade-in">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="admit-guests-title"
            className="w-full max-w-[448px] overflow-hidden rounded-[28px] bg-[#f8fafd] text-[#202124] shadow-[0_16px_48px_rgba(0,0,0,0.32)]"
          >
            <div className="flex items-center justify-between px-6 pb-2 pt-5">
              <div className="min-w-0">
                <h2 id="admit-guests-title" className="text-[22px] font-normal leading-7 tracking-normal">
                  Admit guests?
                </h2>
                <p className="mt-1 text-sm leading-5 text-[#5f6368]">
                  {joinRequests.length === 1
                    ? "Someone wants to join this meeting"
                    : `${joinRequests.length} people want to join this meeting`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAdmitGuestsDialog(false)}
                className="ml-4 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#5f6368] transition-colors hover:bg-[#e8eaed]"
                aria-label="Close admit guests"
                title="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[min(52vh,360px)] overflow-y-auto px-2 pb-2">
              {joinRequests.map((request) => (
                <div
                  key={request.socketId}
                  className="mx-2 flex items-center gap-3 rounded-2xl px-4 py-3 transition-colors hover:bg-[#eef3fb]"
                >
                  <MeetAvatar
                    name={request.displayName}
                    email={request.email}
                    image={request.image}
                    size="md"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium leading-5 text-[#202124]">
                      {request.displayName}
                    </p>
                    <p className="truncate text-[13px] leading-5 text-[#5f6368]">
                      {request.email || "Guest"}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-[#e8eaed] px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              {joinRequests.length > 1 && (
                <button
                  type="button"
                  onClick={handleAdmitAll}
                  className="h-10 rounded-full px-5 text-sm font-medium text-[#1a73e8] transition-colors hover:bg-[#e8f0fe] sm:mr-auto"
                >
                  Admit all
                </button>
              )}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => handleDenyGuestFromDialog(joinRequests[0].socketId)}
                  className="h-10 rounded-full px-5 text-sm font-medium text-[#1a73e8] transition-colors hover:bg-[#e8f0fe]"
                >
                  Deny entry
                </button>
                <button
                  type="button"
                  onClick={() => handleAdmitGuestFromDialog(joinRequests[0].socketId)}
                  className="h-10 rounded-full bg-[#1a73e8] px-6 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#1765cc]"
                >
                  Admit
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Floating Meet-style reactions */}
      <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-50 pointer-events-none w-full max-w-2xl h-[calc(100vh-140px)] overflow-hidden">
        {floatingReactions.map((r) => (
          <div
            key={r.id}
            style={{ left: `${r.x}%` }}
            className="absolute bottom-0 flex flex-col items-center animate-emoji-float"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-4xl shadow-2xl ring-1 ring-black/10">
              {r.emoji}
            </span>
            <span className="mt-2 max-w-[96px] truncate rounded-full bg-black/70 px-2.5 py-1 text-[11px] text-white backdrop-blur-sm">
              {r.senderName}
            </span>
          </div>
        ))}
      </div>

      {/* Participant status (Google Meet-like) - top center */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
        <div className="pointer-events-none">
          <div className="inline-flex items-center gap-2 rounded-full bg-black/60 text-white px-3 py-1.5 text-sm font-medium shadow-sm">
            <span className="leading-none">{renderParticipantStatus()}</span>
          </div>
        </div>
      </div>

      {/* Main video area — grid or presenter layout */}
      <div className="flex-1 flex overflow-hidden p-2 sm:p-3 gap-2 sm:gap-3 min-h-0">
        <div className="flex-1 flex flex-col justify-center min-h-0 min-w-0">
          {useStageLayout ? (
            <div
              className={[
                "flex flex-1 flex-col min-h-0 gap-2 sm:gap-3 w-full max-w-[1800px] mx-auto",
                stageLayoutIsSpotlight ? "" : "md:flex-row",
              ].join(" ")}
            >
              <div className="meet-tile relative flex-1 min-h-[38vh] md:min-h-0 rounded-2xl overflow-hidden bg-black border border-white/10 shadow-lg">
                {stageHasVisibleVideo ? (
                  <ParticipantVideo
                    stream={presenterStream}
                    isLocal={stageParticipantId === "local"}
                    muted={stageParticipantId === "local"}
                    sinkDeviceId={stageParticipantId === "local" ? undefined : selectedAudioOutputId}
                    fit={isStageScreenShare ? "contain" : "cover"}
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-4 bg-[#3c4043]">
                    <MeetAvatar
                      name={presenterName}
                      email={stageParticipantId === "local" ? (isAuthenticated ? identity.email : undefined) : presenterParticipant?.email}
                      image={stageParticipantId === "local" ? (isAuthenticated ? identity.image : undefined) : presenterParticipant?.image}
                      size="xl"
                    />
                    <div className="max-w-[70%] truncate text-sm text-white/70">
                      {stageParticipantId === "local" ? displaySecondary : presenterParticipant?.email || presenterName}
                    </div>
                  </div>
                )}
                <div className="absolute top-3 left-3 flex items-center gap-2 rounded-full border border-white/10 bg-black/70 px-3 py-1.5 text-xs backdrop-blur-md">
                  {isStageScreenShare ? (
                    <MonitorUp className="h-3.5 w-3.5 text-[#8ab4f8]" />
                  ) : (
                    <Pin className="h-3.5 w-3.5 text-[#8ab4f8]" />
                  )}
                  <span className="max-w-[200px] truncate">
                    {presenterName}
                    {stageParticipantId === "local" ? " (You)" : ""}
                    {isStageScreenShare ? " is presenting" : " is focused"}
                  </span>
                </div>
                {stageParticipantId && renderReactionBubbles(stageParticipantId)}
                {stageParticipantId && renderTileBadges({
                  id: stageParticipantId,
                  name: `${presenterName}${stageParticipantId === "local" ? " (You)" : ""}`,
                  host: stageParticipantId === "local" ? isHost : Boolean(presenterParticipant?.isHost),
                  handRaised: stageParticipantId === "local" ? isHandRaised : presenterParticipant?.isHandRaised,
                  micOn: stageParticipantId === "local" ? isMicOn : Boolean(presenterParticipant?.isMicOn),
                  screenSharing: isStageScreenShare,
                })}
                {stageParticipantId && pinnedParticipantId === stageParticipantId && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setPinnedParticipantId(null);
                    }}
                    className="absolute top-3 right-3 z-30 flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-colors hover:bg-white/15"
                    title="Remove pin"
                  >
                    <PinOff className="h-4 w-4" />
                  </button>
                )}
                {stageParticipantId === "local" && isScreenSharing && (
                  <button
                    type="button"
                    onClick={() => void handleToggleScreenShare()}
                    className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-[#8ab4f8] px-5 py-2 text-sm font-medium text-[#202124] hover:bg-[#a8c7fa] transition-colors"
                  >
                    Stop presenting
                  </button>
                )}
              </div>

              <div
                className={[
                  "flex shrink-0 gap-2 overflow-x-auto pb-1 no-scrollbar",
                  stageLayoutIsSpotlight
                    ? "md:overflow-x-auto"
                    : "md:flex-col md:overflow-x-hidden md:overflow-y-auto md:w-44 lg:w-52 md:max-h-full md:pb-0",
                ].join(" ")}
              >
                {showLocalInFilmstrip && (
                  <div
                    className={[
                      "meet-tile relative h-24 w-36 sm:h-28 sm:w-44 md:h-28 shrink-0 rounded-xl overflow-hidden bg-[#3c4043] border border-white/10",
                      stageLayoutIsSpotlight ? "md:w-44" : "md:w-full",
                      pinnedParticipantId === "local" ? "ring-2 ring-[#8ab4f8]" : "",
                      activeSpeakerId === "local" ? "shadow-[0_0_0_3px_rgba(52,168,83,0.85)]" : "",
                    ].join(" ")}
                    onClick={() => handleSelectParticipant("local")}
                    onDoubleClick={() => handleToggleParticipantPin("local")}
                    title="Click to focus yourself"
                  >
                    {isCameraOn && !isScreenSharing ? (
                      <video
                        ref={localVideoRef}
                        autoPlay
                        muted
                        playsInline
                        className="h-full w-full object-cover scale-x-[-1]"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <MeetAvatar
                          name={resolvedDisplayName}
                          email={isAuthenticated ? identity.email : undefined}
                          image={isAuthenticated ? identity.image : undefined}
                          size="md"
                        />
                      </div>
                    )}
                    {renderReactionBubbles("local", true)}
                    {renderTileBadges({
                      id: "local",
                      name: "You",
                      host: isHost,
                      handRaised: isHandRaised,
                      micOn: isMicOn,
                      screenSharing: isScreenSharing,
                      compact: true,
                    })}
                  </div>
                )}

                {filmstripParticipants.map((p) => (
                  <div
                    key={p.socketId}
                    className={[
                      "meet-tile relative h-24 w-36 sm:h-28 sm:w-44 md:h-28 shrink-0 rounded-xl overflow-hidden bg-[#3c4043] border border-white/10",
                      stageLayoutIsSpotlight ? "md:w-44" : "md:w-full",
                      activeSpeakerId === p.socketId ? "shadow-[0_0_0_3px_rgba(52,168,83,0.85)]" : "",
                      pinnedParticipantId === p.socketId ? "ring-2 ring-[#8ab4f8]" : "",
                      p.isScreenSharing ? "ring-2 ring-[#8ab4f8]" : "",
                    ].join(" ")}
                    onClick={() => handleSelectParticipant(p.socketId)}
                    onDoubleClick={() => handleToggleParticipantPin(p.socketId)}
                    title="Click to focus participant"
                  >
                    {hasVisibleVideo(p.stream, p.isCameraOn, p.isScreenSharing) ? (
                      <ParticipantVideo
                        stream={p.stream}
                        isLocal={false}
                        muted={false}
                        sinkDeviceId={selectedAudioOutputId}
                        fit={p.isScreenSharing ? "contain" : "cover"}
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <MeetAvatar
                          name={p.displayName}
                          email={p.email}
                          image={p.image}
                          size="md"
                        />
                      </div>
                    )}
                    {renderReactionBubbles(p.socketId, true)}
                    {renderTileBadges({
                      id: p.socketId,
                      name: p.displayName,
                      host: p.isHost,
                      handRaised: p.isHandRaised,
                      micOn: p.isMicOn,
                      screenSharing: p.isScreenSharing,
                      compact: true,
                    })}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div
              style={gridStyle}
              className={[
                "grid auto-rows-fr items-stretch gap-2 sm:gap-4 w-full mx-auto h-full p-1 sm:p-2 overflow-y-auto overscroll-contain overflow-x-hidden",
                "place-content-center",
                isTwoUp ? "grid-cols-1 md:grid-cols-2 max-w-[1600px]" : "max-w-7xl 2xl:max-w-[1600px]",
              ].join(" ")}
            >
              {/* 1. Local Participant Card */}
              <div
                className={[
                  "meet-tile relative min-w-0 rounded-2xl overflow-hidden bg-[#3c4043] border border-white/5 shadow-md flex items-center justify-center",
                  // Prevent desktop 2-up overlap: on md+ fill available height instead of forcing aspect ratio
                  pinnedParticipantId === "local" || isScreenSharing
                    ? "ring-2 ring-[#8ab4f8] md:col-span-2 md:row-span-2"
                    : "",
                  activeSpeakerId === "local" ? "shadow-[0_0_0_3px_rgba(52,168,83,0.85)]" : "",
                  isTwoUp ? "aspect-video md:aspect-auto md:h-full" : "aspect-video",
                ].join(" ")}
                style={{
                  order: isScreenSharing || pinnedParticipantId === "local" ? -20 : presenterId || pinnedParticipantId ? 10 : 0,
                }}
                onClick={() => handleSelectParticipant("local")}
                onDoubleClick={() => handleToggleParticipantPin("local")}
                title="Click to focus yourself"
              >
                {isCameraOn && !isScreenSharing ? (
                  <video
                    ref={localVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover rounded-2xl scale-x-[-1]"
                  />
                ) : isScreenSharing && screenStreamForRender ? (
                  <ParticipantVideo
                    stream={screenStreamForRender}
                    isLocal
                    muted
                    fit="contain"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-4">
                    <MeetAvatar
                      name={resolvedDisplayName}
                      email={isAuthenticated ? identity.email : undefined}
                      image={isAuthenticated ? identity.image : undefined}
                      size="xl"
                    />
                    {isAuthenticated && displaySecondary && (
                      <div className="max-w-[70%] truncate text-sm text-white/70">
                        {displaySecondary}
                      </div>
                    )}
                  </div>
                )}
                {renderReactionBubbles("local")}
                {renderTileBadges({
                  id: "local",
                  name: `${resolvedDisplayName} (You)`,
                  host: isHost,
                  handRaised: isHandRaised,
                  micOn: isMicOn,
                  screenSharing: isScreenSharing,
                })}
                {pinnedParticipantId === "local" && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setPinnedParticipantId(null);
                    }}
                    className="absolute top-3 right-3 z-30 flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-colors hover:bg-white/15"
                    title="Remove pin"
                  >
                    <PinOff className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* 2. Remote Participants Cards */}
              {orderedParticipants.map((p) => (
                <div
                  key={p.socketId}
                  className={[
                    "meet-tile relative min-w-0 rounded-2xl overflow-hidden bg-[#3c4043] border border-white/5 shadow-md flex items-center justify-center",
                    pinnedParticipantId === p.socketId || p.isScreenSharing
                      ? "ring-2 ring-[#8ab4f8] md:col-span-2 md:row-span-2"
                      : "",
                    activeSpeakerId === p.socketId ? "shadow-[0_0_0_3px_rgba(52,168,83,0.85)]" : "",
                    isTwoUp ? "aspect-video md:aspect-auto md:h-full" : "aspect-video",
                  ].join(" ")}
                  style={{
                    order:
                      p.socketId === pinnedParticipantId
                        ? -30
                        : p.socketId === presenterId
                          ? -20
                          : p.socketId === activeSpeakerId
                            ? -10
                            : 0,
                  }}
                  onClick={() => handleSelectParticipant(p.socketId)}
                  onDoubleClick={() => handleToggleParticipantPin(p.socketId)}
                  title="Click to focus participant"
                >
                  {hasVisibleVideo(p.stream, p.isCameraOn, p.isScreenSharing) ? (
                    <ParticipantVideo
                      stream={p.stream}
                      isLocal={false}
                      muted={false}
                      sinkDeviceId={selectedAudioOutputId}
                      fit={p.isScreenSharing ? "contain" : "cover"}
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-4">
                      <MeetAvatar
                        name={p.displayName}
                        email={p.email}
                        image={p.image}
                        size="xl"
                      />
                      <div className="max-w-[70%] truncate text-sm text-white/70">
                        {p.email || p.displayName}
                      </div>
                    </div>
                  )}
                  {renderReactionBubbles(p.socketId)}
                  {renderTileBadges({
                    id: p.socketId,
                    name: p.displayName,
                    host: p.isHost,
                    handRaised: p.isHandRaised,
                    micOn: p.isMicOn,
                    screenSharing: p.isScreenSharing,
                  })}
                  {pinnedParticipantId === p.socketId && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setPinnedParticipantId(null);
                      }}
                      className="absolute top-3 right-3 z-30 flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-colors hover:bg-white/15"
                      title="Remove pin"
                    >
                      <PinOff className="h-4 w-4" />
                    </button>
                  )}
                  {/* Host Control Actions */}
                  {isHost && (
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        handleKick(p.socketId);
                      }}
                      className={[
                        "absolute right-3 z-30 h-8 w-8 rounded-full bg-black/40 hover:bg-red-500 hover:text-white flex items-center justify-center backdrop-blur-sm transition-all",
                        pinnedParticipantId === p.socketId ? "top-14" : "top-3",
                      ].join(" ")}
                      title="Remove participant"
                    >
                      <UserX className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Sidebar - Chat panel */}
        {showChat && (
          <div className="fixed inset-0 z-50 md:static md:inset-auto w-full md:w-96 bg-[#2d2e30]/95 backdrop-blur md:bg-[#2d2e30] md:backdrop-blur-0 md:rounded-2xl flex flex-col border border-white/10 shadow-2xl animate-slide-in">
            <div className="p-4 border-b border-white/10 flex justify-between items-center">
              <h2 className="font-medium text-sm flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-[#8ab4f8]" /> In-call Messages
              </h2>
              <button
                onClick={() => setShowChat(false)}
                className="h-8 w-8 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4">
              {messages.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-white/40 text-xs text-center max-w-[200px] mx-auto leading-relaxed">
                  Messages are only visible to active call members and get removed when leaving.
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {messages.map((m, i) => (
                    <div key={m.id || `${m.timestamp}-${i}`} className="flex items-start gap-3">
                      <MeetAvatar
                        name={m.senderName}
                        email={m.senderEmail}
                        image={m.senderImage}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <span className="truncate text-sm font-medium text-white/90">
                            {m.senderId === socket.id ? "You" : m.senderName}
                          </span>
                          <span className="shrink-0 text-[11px] text-white/45">
                            {new Date(m.timestamp).toLocaleTimeString([], {
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        {m.senderEmail && (
                          <div className="truncate text-[11px] text-white/45">
                            {m.senderEmail}
                          </div>
                        )}
                        <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-5 text-white/85">
                          {m.message}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <form onSubmit={handleSendMessage} className="p-4 border-t border-white/10 flex gap-2">
              <input
                type="text"
                placeholder="Send a message"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                className="flex-1 bg-[#202124] border border-white/10 px-4 py-2.5 rounded-full text-sm outline-none focus:border-[#8ab4f8] transition-colors"
              />
              <button
                type="submit"
                disabled={!chatInput.trim()}
                className="h-10 w-10 rounded-full bg-[#8ab4f8] disabled:bg-white/10 disabled:text-white/30 text-[#202124] flex items-center justify-center transition-colors"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        )}

        {/* Right Sidebar - Participants list */}
        {showParticipantsList && (
          <div className="fixed inset-0 z-50 md:static md:inset-auto w-full md:w-96 bg-[#2d2e30]/95 backdrop-blur md:bg-[#2d2e30] md:backdrop-blur-0 md:rounded-2xl flex flex-col border border-white/10 shadow-2xl animate-slide-in">
            <div className="p-4 border-b border-white/10 flex justify-between items-center">
              <h2 className="font-medium text-sm flex items-center gap-2">
                <Users className="h-4 w-4 text-[#8ab4f8]" /> People ({totalConferencingUsers})
              </h2>
              <button
                onClick={() => setShowParticipantsList(false)}
                className="h-8 w-8 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="border-b border-white/10 px-4 py-3">
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-[#202124] px-3 py-2">
                <Search className="h-4 w-4 shrink-0 text-white/45" />
                <input
                  type="text"
                  value={participantSearch}
                  onChange={(e) => setParticipantSearch(e.target.value)}
                  placeholder="Search participants"
                  className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/40"
                />
              </div>
            </div>
            <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-3">
              {/* Local member details row */}
              <div className="flex justify-between items-center p-3 rounded-xl bg-white/5 border border-white/5">
                <div className="flex items-center gap-3">
                  <MeetAvatar
                    name={resolvedDisplayName}
                    email={isAuthenticated ? identity.email : undefined}
                    image={isAuthenticated ? identity.image : undefined}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <h4 className="truncate text-sm font-medium">{resolvedDisplayName} (You)</h4>
                    <span className="block truncate text-[10px] text-white/50">
                      {(isAuthenticated && displaySecondary) || (isHost ? "Meeting host" : "In the meeting")}
                    </span>
                    {isHost && (
                      <span className="mt-1 inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium text-yellow-300 bg-yellow-400/10">
                        Host
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 text-white/60">
                  {isHandRaised && <Hand className="h-4 w-4 text-yellow-300" />}
                  {isMicOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4 text-red-400" />}
                  {isCameraOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4 text-red-400" />}
                </div>
              </div>

              {/* Remote members list */}
              {filteredParticipants.map((p) => (
                <div key={p.socketId} className="flex justify-between items-center p-3 rounded-xl hover:bg-white/5 transition-colors">
                  <div className="flex items-center gap-3">
                    <MeetAvatar
                      name={p.displayName}
                      email={p.email}
                      image={p.image}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="truncate text-sm font-medium">{p.displayName}</h4>
                        {reactionBubbles[p.socketId]?.[0] ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/90">
                            <span>{reactionBubbles[p.socketId][0].emoji}</span>
                            <span>{reactionBubbles[p.socketId][0].senderName}</span>
                          </span>
                        ) : null}
                      </div>
                      <span className="block truncate text-[10px] text-white/50">
                        {p.email || "In the meeting"}
                      </span>
                      {p.isHost && (
                        <span className="mt-1 inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium text-yellow-300 bg-yellow-400/10">
                          Host
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-3 items-center">
                    <div className="flex gap-2 text-white/40">
                      {p.isHandRaised && <Hand className="h-4 w-4 text-yellow-300" />}
                      {p.isMicOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4 text-red-400" />}
                      {p.isCameraOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4 text-red-400" />}
                    </div>
                    {isHost && (
                      <button
                        onClick={() => handleKick(p.socketId)}
                        className="h-8 w-8 rounded-full hover:bg-red-500/20 hover:text-red-400 flex items-center justify-center transition-colors"
                        title="Remove participant"
                      >
                        <UserX className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {screenShareError && (
        <div className="mx-2 sm:mx-4 mb-1 rounded-xl border border-red-400/30 bg-red-500/15 px-4 py-2 text-sm text-red-100 flex items-start justify-between gap-3 z-40">
          <span>{screenShareError}</span>
          <button
            type="button"
            onClick={() => setScreenShareError(null)}
            className="shrink-0 text-red-200/80 hover:text-white"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Leave / End meeting dialog */}
      {showLeaveDialog && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 px-4 backdrop-blur-[2px] animate-fade-in">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="leave-meeting-title"
            className="w-full max-w-[400px] overflow-hidden rounded-[28px] bg-[#f8fafd] text-[#202124] shadow-[0_16px_48px_rgba(0,0,0,0.32)]"
          >
            <div className="px-6 pb-2 pt-6">
              <h2 id="leave-meeting-title" className="text-[22px] font-normal leading-7">
                {isHost ? "Leave or end the meeting?" : "Leave the meeting?"}
              </h2>
              <p className="mt-2 text-sm leading-5 text-[#5f6368]">
                {isHost
                  ? "You can leave the meeting or end it for everyone."
                  : "You'll leave the call for yourself only."}
              </p>
            </div>
            <div className="flex flex-col-reverse gap-2 px-6 py-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowLeaveDialog(false)}
                className="h-10 rounded-full px-5 text-sm font-medium text-[#1a73e8] transition-colors hover:bg-[#e8f0fe]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLeaveMeeting}
                className="h-10 rounded-full px-5 text-sm font-medium text-[#1a73e8] transition-colors hover:bg-[#e8f0fe]"
              >
                Leave meeting
              </button>
              {isHost && (
                <button
                  type="button"
                  onClick={handleLeaveMeeting}
                  className="h-10 rounded-full bg-[#1a73e8] px-6 text-sm font-medium text-white transition-colors hover:bg-[#1765cc]"
                >
                  End meeting for all
                </button>
              )}
            </div>
          </section>
        </div>
      )}

      {/* Control Actions Bar */}
      <div className="min-h-[72px] bg-[#202124] flex items-center justify-between px-2 sm:px-4 py-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] border-t border-white/5 relative z-40 gap-2">
        {/* Time and room details */}
        <div className="hidden lg:flex flex-col text-xs font-light text-white/55 min-w-[80px]">
          <span>{currentTime}</span>
          <span className="text-[#8ab4f8] mt-0.5 font-mono tracking-wider">{meetingDuration}</span>
        </div>

        {/* Media Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2 mx-auto overflow-x-auto no-scrollbar px-1 max-w-full">
          {/* Audio */}
          <div className="relative" ref={audioDeviceMenuRef}>
            <button
              onClick={handleToggleMic}
              onContextMenu={(event) => {
                event.preventDefault();
                setShowAudioDeviceMenu((prev) => !prev);
                setShowVideoDeviceMenu(false);
                setShowEmojiPicker(false);
                setShowLayoutMenu(false);
                setShowMoreOptionsMenu(false);
              }}
              className={`meet-control-btn h-11 w-11 sm:h-12 sm:w-12 ${isMicOn ? "meet-control-btn-neutral" : "meet-control-btn-danger"}`}
              title={isMicOn ? "Mute microphone" : "Unmute microphone"}
            >
              {isMicOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
            </button>
            {showAudioDeviceMenu && (
              <div className="fixed bottom-24 left-1/2 z-[60] w-72 -translate-x-1/2 rounded-2xl border border-white/10 bg-[#303134] p-2 shadow-2xl animate-fade-in">
                {renderDeviceList(
                  "Microphone",
                  audioInputDevices,
                  selectedAudioInputId,
                  "Microphone",
                  // eslint-disable-next-line react-hooks/refs
                  handleSelectAudioInput
                )}
                <div className="my-2 h-px bg-white/10" />
                {renderDeviceList(
                  "Speaker",
                  audioOutputDevices,
                  selectedAudioOutputId,
                  "Speaker",
                  handleSelectAudioOutput
                )}
              </div>
            )}
          </div>

          {/* Camera */}
          <div className="relative" ref={videoDeviceMenuRef}>
            <button
              onClick={handleToggleCamera}
              onContextMenu={(event) => {
                event.preventDefault();
                setShowVideoDeviceMenu((prev) => !prev);
                setShowAudioDeviceMenu(false);
                setShowEmojiPicker(false);
                setShowLayoutMenu(false);
                setShowMoreOptionsMenu(false);
              }}
              className={`meet-control-btn h-11 w-11 sm:h-12 sm:w-12 ${isCameraOn ? "meet-control-btn-neutral" : "meet-control-btn-danger"}`}
              title={isCameraOn ? "Turn off camera" : "Turn on camera"}
            >
              {isCameraOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
            </button>
            {showVideoDeviceMenu && (
              <div className="fixed bottom-24 left-1/2 z-[60] w-72 -translate-x-1/2 rounded-2xl border border-white/10 bg-[#303134] p-2 shadow-2xl animate-fade-in">
                {renderDeviceList(
                  "Camera",
                  videoInputDevices,
                  selectedVideoInputId,
                  "Camera",
                  // eslint-disable-next-line react-hooks/refs
                  handleSelectVideoInput
                )}
              </div>
            )}
          </div>

          {/* Captions (placeholder) */}
          <button
            type="button"
            disabled
            className="meet-control-btn meet-control-btn-neutral h-11 w-11 sm:h-12 sm:w-12 opacity-40"
            title="Turn on captions"
          >
            <Captions className="h-5 w-5" />
          </button>

          {/* Raise Hand */}
          <button
            type="button"
            onClick={() => {
              const next = !isHandRaised;
              setIsHandRaised(next);
              sessionRef.current?.sendRaiseHandUpdate(next);
            }}
            className={`meet-control-btn h-11 w-11 sm:h-12 sm:w-12 ${isHandRaised ? "bg-yellow-400 text-[#202124] hover:bg-yellow-500" : "meet-control-btn-neutral"}`}
            title="Raise hand"
          >
            <Hand className="h-5 w-5" />
          </button>

          {/* Present Now / Screen Share */}
          <button
            type="button"
            onClick={() => void handleToggleScreenShare()}
            disabled={!isScreenSharing && screenShareSupport !== null && !screenShareSupport.supported}
            className={`meet-control-btn h-11 w-11 sm:h-12 sm:w-12 ${isScreenSharing ? "meet-control-btn-active" : "meet-control-btn-neutral"}`}
            title={
              isScreenSharing
                ? "Stop presenting"
                : screenShareSupport && !screenShareSupport.supported
                  ? screenShareSupport.reason
                  : "Present now"
            }
          >
            <MonitorUp className="h-5 w-5" />
          </button>

          {/* More options */}
          <div className="relative" ref={moreOptionsRef}>
            <button
              type="button"
              onClick={() => {
                setShowMoreOptionsMenu((prev) => !prev);
                setShowLayoutMenu(false);
                setShowEmojiPicker(false);
                setShowAudioDeviceMenu(false);
                setShowVideoDeviceMenu(false);
              }}
              className={`meet-control-btn h-11 w-11 sm:h-12 sm:w-12 ${showMoreOptionsMenu ? "meet-control-btn-active" : "meet-control-btn-neutral"}`}
              title="More options"
            >
              <MoreVertical className="h-5 w-5" />
            </button>
            {showMoreOptionsMenu && (
              <div className="fixed bottom-20 left-1/2 z-[60] w-56 -translate-x-1/2 rounded-2xl border border-white/10 bg-[#303134] p-2 shadow-2xl animate-fade-in">
                <div className="relative" ref={layoutRef}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowLayoutMenu((prev) => !prev);
                      setShowEmojiPicker(false);
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-white/85 transition-colors hover:bg-white/10"
                  >
                    <ActiveLayoutIcon className="h-4 w-4 shrink-0" />
                    <span>Layout: {activeLayout.label}</span>
                  </button>
                  {showLayoutMenu && (
                    <div className="mt-1 border-t border-white/10 pt-1">
                      {layoutOptions.map((option) => {
                        const LayoutIcon = option.icon;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => handleLayoutChange(option.id)}
                            className={[
                              "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors",
                              meetingLayout === option.id
                                ? "bg-[#8ab4f8] text-[#202124]"
                                : "text-white/85 hover:bg-white/10",
                            ].join(" ")}
                          >
                            <LayoutIcon className="h-4 w-4 shrink-0" />
                            <span>{option.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="relative mt-1 border-t border-white/10 pt-1" ref={emojiRef}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowEmojiPicker((prev) => !prev);
                      setShowLayoutMenu(false);
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-white/85 transition-colors hover:bg-white/10"
                  >
                    <Smile className="h-4 w-4 shrink-0" />
                    <span>Send a reaction</span>
                  </button>
                  {showEmojiPicker && (
                    <div className="mt-2 flex flex-wrap justify-center gap-1 px-1">
                      {REACTIONS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => handleReaction(emoji)}
                          className="flex h-9 w-9 items-center justify-center rounded-full text-xl transition-all duration-150 hover:scale-110 hover:bg-white/10"
                          title={`Send ${emoji}`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {isHost && (
                  <button
                    type="button"
                    onClick={() => setIsMeetingLocked((prev) => !prev)}
                    className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-white/85 transition-colors hover:bg-white/10"
                  >
                    <Lock className="h-4 w-4 shrink-0" />
                    <span>{isMeetingLocked ? "Unlock meeting" : "Lock meeting"}</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Leave call — red circular */}
          <button
            type="button"
            onClick={() => setShowLeaveDialog(true)}
            className="meet-control-btn meet-control-btn-danger h-11 w-11 sm:h-12 sm:w-12 shrink-0"
            title="Leave call"
          >
            <Phone className="h-5 w-5 rotate-[135deg]" />
          </button>
        </div>

        {/* Sidebar Toggles */}
        <div className="flex items-center gap-0.5 sm:gap-1 text-white/70 shrink-0">
          {/* Info toggle */}
          <button
            onClick={() => {
              setParticipantLeftMessage(`Meeting Link: ${window.location.origin}/meeting/${meetingCode}`);
              setTimeout(() => setParticipantLeftMessage(null), 5000);
            }}
            className="meet-control-btn h-10 w-10 sm:h-11 sm:w-11 hover:bg-white/5"
            title="Meeting details"
          >
            <Info className="h-5 w-5" />
          </button>

          {/* Chat Sidebar button */}
          <button
            onClick={() => {
              setShowChat((prev) => !prev);
              setShowParticipantsList(false);
            }}
            className={`meet-control-btn relative h-10 w-10 sm:h-11 sm:w-11 ${showChat ? "meet-control-btn-active" : "hover:bg-white/5"}`}
            title="Chat messages"
          >
            <MessageSquare className="h-5 w-5" />
            {!showChat && unreadMessages > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#8ab4f8] px-1 text-[11px] font-medium text-[#202124] ring-2 ring-[#202124]">
                {unreadMessages > 9 ? "9+" : unreadMessages}
              </span>
            )}
          </button>

          {/* Participants Sidebar button */}
          <button
            onClick={() => {
              setShowParticipantsList(!showParticipantsList);
              setShowChat(false);
            }}
            className={`meet-control-btn h-10 w-10 sm:h-11 sm:w-11 ${showParticipantsList ? "meet-control-btn-active" : "hover:bg-white/5"}`}
            title="Show participants"
          >
            <Users className="h-5 w-5" />
          </button>

          {/* Activities (placeholder) */}
          <button
            type="button"
            disabled
            className="meet-control-btn h-10 w-10 sm:h-11 sm:w-11 opacity-40 hidden sm:flex"
            title="Activities"
          >
            <Sparkles className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
