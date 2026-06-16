"use client";

import { useState, useEffect, useRef, memo } from "react";
import {
  MonitorUp,
  Info,
  MessageSquare,
  Send,
  X,
  Shield,
  UserX,
  LayoutGrid,
  PanelRight,
  Rows3,
  Pin,
  PinOff,
  Hand,
  Phone,
  Copy,
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
import { detachVideoElement, getStreamTrackSignature, stopMediaStream, streamsShareSameTracks } from "../../webrtc/stream-utils";
import { PreviewLobby } from "@/components/meeting/PreviewLobby";
import { GuestWaitingLobby } from "@/components/meeting/GuestWaitingLobby";
import { AdmitGuestControl } from "@/components/meeting/AdmitGuestControl";
import { HandLowerToast } from "@/components/meeting/HandLowerToast";
import { HandRaiseNotifications } from "@/components/meeting/HandRaiseNotifications";
import { MeetControlBar } from "@/components/meeting/MeetControlBar";
import { MeetPersonAvatar } from "@/components/meeting/MeetPersonAvatar";
import { MeetMicStatus } from "@/components/meeting/MeetMicStatus";
import { PeoplePanel } from "@/components/meeting/PeoplePanel";
import {
  getCurrentUserIdentity,
  getDisplayInitial,
  getIdentityLabel,
  getIdentitySecondary,
  type UserIdentity,
} from "@/lib/display-name";
import { getMeetingByCode } from "@/lib/api";
import { buildMeetingLink } from "@/lib/meet-link";
import type { Meeting } from "@/types/meeting";

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
const ParticipantVideo = memo(function ParticipantVideo({
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
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const attachedSignatureRef = useRef("");
  const [streamUnavailable, setStreamUnavailable] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!stream) {
      if (attachedSignatureRef.current) {
        detachVideoElement(video);
        attachedSignatureRef.current = "";
      }
      setStreamUnavailable(true);
      return;
    }

    const signature = getStreamTrackSignature(stream);
    const attach = () => {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack && videoTrack.readyState === "ended") {
        setStreamUnavailable(true);
        return;
      }
      setStreamUnavailable(false);

      if (video.srcObject !== stream) {
        video.srcObject = stream;
      }
      attachedSignatureRef.current = signature;

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
    };
  }, [stream, isLocal, sinkDeviceId]);

  useEffect(() => {
    return () => {
      detachVideoElement(videoRef.current);
    };
  }, []);

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
});

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
  const [customDisplayName, setCustomDisplayName] = useState("");

  const resolvedDisplayName = isAuthenticated ? displayName : (customDisplayName || "Guest");

  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [handLowerPrompt, setHandLowerPrompt] = useState(false);
  const [localMicLevel, setLocalMicLevel] = useState(0);
  const [endedByHost, setEndedByHost] = useState(false);

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
  const [showSwitchHereModal, setShowSwitchHereModal] = useState(false);
  const [switchedAway, setSwitchedAway] = useState(false);
  const [, setPermissionRequested] = useState(false);
  const [deniedReason, setDeniedReason] = useState("Host denied your request");

  const [currentTime, setCurrentTime] = useState("");
  const [participantLeftMessage, setParticipantLeftMessage] = useState<string | null>(null);
  const [copiedToast, setCopiedToast] = useState<string | null>(null);
  const [meetingData, setMeetingData] = useState<Meeting | null>(null);
  const [, setMeetingDuration] = useState("0:00");
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [showMoreOptionsMenu, setShowMoreOptionsMenu] = useState(false);
  const [isMeetingLocked, setIsMeetingLocked] = useState(false);
  const [participantSearch, setParticipantSearch] = useState("");

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
  const localMicLevelRef = useRef(0);
  const participantsRef = useRef<Participant[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioMonitorsRef = useRef<Map<string, () => void>>(new Map());
  const audioMonitorKeysRef = useRef<Map<string, string>>(new Map());
  const activeSpeakerRef = useRef<string | null>(null);
  const keepHandRaisedRef = useRef(false);
  const handRaiseTimersRef = useRef<{ prompt?: number; lower?: number }>({});

  const emojiRef = useRef<HTMLDivElement>(null);
  const layoutRef = useRef<HTMLDivElement>(null);
  const moreOptionsRef = useRef<HTMLDivElement>(null);
  const audioDeviceMenuRef = useRef<HTMLDivElement>(null);
  const videoDeviceMenuRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const switchHereDialogRef = useRef<HTMLDivElement>(null);
  const switchHereButtonRef = useRef<HTMLButtonElement>(null);
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

  const clearHandRaiseTimers = () => {
    if (handRaiseTimersRef.current.prompt) {
      window.clearTimeout(handRaiseTimersRef.current.prompt);
    }
    if (handRaiseTimersRef.current.lower) {
      window.clearTimeout(handRaiseTimersRef.current.lower);
    }
    handRaiseTimersRef.current = {};
  };

  const resetInMeetingUiState = () => {
    setPinnedParticipantId(null);
    setActiveSpeakerId(null);
    setIsScreenSharing(false);
    setIsHandRaised(false);
    setHandLowerPrompt(false);
    keepHandRaisedRef.current = false;
    clearHandRaiseTimers();
    setScreenShareError(null);
    setShowChat(false);
    setUnreadMessages(0);
    setShowParticipantsList(false);
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
    setParticipants((prev) => {
      const existing = prev.find((item) => item.socketId === participant.socketId);
      if (
        existing &&
        !participant.stream &&
        existing.displayName === participant.displayName &&
        existing.isMicOn === participant.isMicOn &&
        existing.isCameraOn === participant.isCameraOn &&
        existing.isHost === participant.isHost &&
        existing.isScreenSharing === participant.isScreenSharing
      ) {
        return prev;
      }
      return dedupeParticipants([...prev, participant]);
    });
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

    setLocalStreamForRender((prev) => {
      const nextStream = localStreamRef.current;
      if (!nextStream) return null;
      if (prev && streamsShareSameTracks(prev, nextStream)) return prev;
      return nextStream;
    });
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

  const lowerHand = () => {
    setIsHandRaised(false);
    sessionRef.current?.sendRaiseHandUpdate(false);
    setHandLowerPrompt(false);
    keepHandRaisedRef.current = false;
    clearHandRaiseTimers();
  };

  const handleToggleHandRaise = () => {
    if (isHandRaised) {
      lowerHand();
      return;
    }
    keepHandRaisedRef.current = false;
    setIsHandRaised(true);
    sessionRef.current?.sendRaiseHandUpdate(true);
  };

  const handleKeepHandRaised = () => {
    keepHandRaisedRef.current = true;
    setHandLowerPrompt(false);
    clearHandRaiseTimers();
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
        prev.map((p) => ({
          ...p,
          isScreenSharing: false,
        }))
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

  const handleCopyMessage = async (message: string) => {
    try {
      await navigator.clipboard.writeText(message);
      setCopiedToast("Message copied");
    } catch {
      setCopiedToast("Unable to copy message");
    }
    window.setTimeout(() => setCopiedToast(null), 2200);
  };

  const handleAdmit = (socketId: string) => {
    sessionRef.current?.approveJoin(socketId);
    setJoinRequests((prev) => prev.filter((r) => r.socketId !== socketId));
  };

  const handleDeny = (socketId: string) => {
    sessionRef.current?.denyJoin(socketId);
    setJoinRequests((prev) => prev.filter((r) => r.socketId !== socketId));
  };

  const handleOpenPeoplePanel = () => {
    setShowParticipantsList(true);
    setShowChat(false);
  };

  const handleKick = (socketId: string) => {
    sessionRef.current?.removeParticipant(socketId);
  };

  const handleAdmitAll = () => {
    joinRequests.forEach((request) => {
      sessionRef.current?.approveJoin(request.socketId);
    });
    setJoinRequests([]);
  };

  const handleCancelJoinRequest = () => {
    sessionRef.current?.destroy();
    sessionRef.current = null;
    setIsJoining(false);
    setShowSwitchHereModal(false);
    setMeetingState("lobby");
  };

  const handleLeaveMeeting = () => {
    cleanupAll();
    resetInMeetingUiState();
    meetingJoinedAtRef.current = null;
    setShowLeaveDialog(false);
    setEndedByHost(false);
    setSwitchedAway(false);
    setMeetingState("ended");
  };

  const handleEndMeetingForAll = () => {
    sessionRef.current?.endMeetingForAll();
    cleanupAll();
    resetInMeetingUiState();
    meetingJoinedAtRef.current = null;
    setShowLeaveDialog(false);
    setEndedByHost(true);
    setSwitchedAway(false);
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
    setSwitchedAway(false);
    setIsScreenSharing(false);
    setIsHandRaised(false);
    setMeetingState("lobby");
    await startPreviewMedia();
  };

  const getJoinIdentity = () => {
    const token = typeof window !== "undefined" ? localStorage.getItem("authToken") : null;
    return {
      displayName: isAuthenticated ? displayName : customDisplayName,
      email: isAuthenticated ? identity.email : undefined,
      image: isAuthenticated ? identity.image : undefined,
      token: token || undefined,
      isMicOn,
      isCameraOn,
    };
  };

  const handleSwitchHere = () => {
    if (!sessionRef.current) return;
    setIsJoining(true);
    setShowSwitchHereModal(false);
    sessionRef.current.switchHere(getJoinIdentity());
  };

  const handleCancelSwitchHere = () => {
    sessionRef.current?.destroy();
    sessionRef.current = null;
    setIsJoining(false);
    setShowSwitchHereModal(false);
    setMeetingState("lobby");
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
      onAlreadyInMeeting: () => {
        setIsJoining(false);
        setShowSwitchHereModal(true);
      },
      onJoinApproved: (members, isHostRole) => {
        setIsJoining(false);
        setShowSwitchHereModal(false);
        setSwitchedAway(false);
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
            const keepStream =
              exists.stream && streamsShareSameTracks(exists.stream, remoteStream)
                ? exists.stream
                : remoteStream;
            return dedupeParticipants(prev.map((p) =>
              p.socketId === socketId
                ? {
                  ...p,
                  stream: keepStream,
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
            if (p.socketId !== data.socketId) return p;
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
            };
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
      onParticipantSwitched: ({ member }) => {
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
            prev.map((p) => ({
              ...p,
              isScreenSharing: false,
            }))
          );
          return;
        }

        if (screenStreamRef.current) {
          void endScreenShare();
        }

        setParticipants((prev) =>
          prev.map((p) => ({
            ...p,
            isScreenSharing: p.socketId === senderId,
          }))
        );
      },
      onScreenShareStopped: (senderId) => {
        if (senderId === socket.id) return;
        setParticipants((prev) =>
          prev.map((p) =>
            p.socketId === senderId ? { ...p, isScreenSharing: false } : p
          )
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
        setSwitchedAway(false);
        setMeetingState("denied");
        setDeniedReason("You were removed from the meeting by the host");
      },
      onForceSwitched: () => {
        cleanupAll();
        resetInMeetingUiState();
        meetingJoinedAtRef.current = null;
        setEndedByHost(false);
        setSwitchedAway(true);
        setMeetingState("ended");
      },
      onMeetingEnded: () => {
        cleanupAll();
        resetInMeetingUiState();
        meetingJoinedAtRef.current = null;
        setEndedByHost(true);
        setSwitchedAway(false);
        setMeetingState("ended");
      },
    });

    sessionRef.current = session;
    try {
      await session.start(getJoinIdentity());
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

  // Active speaker detection (UI-only; persistent AudioContext avoids rebuild churn)
  useEffect(() => {
    if (meetingState !== "inMeeting") return;
    if (typeof window === "undefined") return;

    const AudioCtx =
      window.AudioContext ||
      (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    if (!audioContextRef.current || audioContextRef.current.state === "closed") {
      audioContextRef.current = new AudioCtx();
    }
    const ctx = audioContextRef.current;

    const ensureMonitor = (id: string, stream?: MediaStream | null) => {
      const signature = getStreamTrackSignature(stream);
      const monitorKey = `${id}:${signature}`;

      if (audioMonitorKeysRef.current.get(id) === monitorKey) {
        return;
      }

      audioMonitorsRef.current.get(id)?.();
      audioMonitorsRef.current.delete(id);
      audioMonitorKeysRef.current.delete(id);

      if (!stream || stream.getAudioTracks().length === 0 || !signature) {
        delete audioLevelsRef.current[id];
        return;
      }

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      const data = new Uint8Array(analyser.frequencyBinCount);
      source.connect(analyser);

      const timer = window.setInterval(() => {
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i += 1) sum += data[i];
        audioLevelsRef.current[id] = sum / data.length / 255;
      }, 220);

      audioMonitorsRef.current.set(id, () => {
        window.clearInterval(timer);
        try {
          source.disconnect();
          analyser.disconnect();
        } catch {
          // no-op cleanup
        }
        delete audioLevelsRef.current[id];
      });
      audioMonitorKeysRef.current.set(id, monitorKey);
    };

    const syncMonitors = () => {
      const activeIds = new Set<string>(["local"]);
      participantsRef.current.forEach((participant) => {
        activeIds.add(participant.socketId);
      });

      for (const [id, cleanup] of audioMonitorsRef.current.entries()) {
        if (!activeIds.has(id)) {
          cleanup();
          audioMonitorsRef.current.delete(id);
        }
      }

      ensureMonitor("local", localStreamRef.current);
      participantsRef.current.forEach((participant) => {
        ensureMonitor(participant.socketId, participant.stream);
      });
    };

    syncMonitors();
    const syncTimer = window.setInterval(syncMonitors, 800);

    const activeTimer = window.setInterval(() => {
      let maxId: string | null = null;
      let maxLevel = 0.05;
      Object.entries(audioLevelsRef.current).forEach(([id, level]) => {
        if (level > maxLevel) {
          maxLevel = level;
          maxId = id;
        }
      });
      if (maxId !== activeSpeakerRef.current) {
        activeSpeakerRef.current = maxId;
        setActiveSpeakerId(maxId);
      }

      const localLevel = audioLevelsRef.current.local || 0;
      if (Math.abs(localLevel - localMicLevelRef.current) > 0.008) {
        localMicLevelRef.current = localLevel;
        setLocalMicLevel(localLevel);
      }
    }, 320);

    return () => {
      window.clearInterval(syncTimer);
      window.clearInterval(activeTimer);
    };
  }, [meetingState]);

  useEffect(() => {
    if (meetingState !== "inMeeting" || !isHandRaised || keepHandRaisedRef.current) {
      clearHandRaiseTimers();
      if (!isHandRaised) {
        setHandLowerPrompt(false);
      }
      return;
    }

    clearHandRaiseTimers();
    handRaiseTimersRef.current.prompt = window.setTimeout(() => {
      setHandLowerPrompt(true);
      handRaiseTimersRef.current.lower = window.setTimeout(() => {
        if (!keepHandRaisedRef.current) {
          lowerHand();
        }
      }, 4000);
    }, 5000);

    return () => {
      clearHandRaiseTimers();
    };
  }, [meetingState, isHandRaised]);

  useEffect(() => {
    if (meetingState !== "inMeeting") return;

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (event.ctrlKey && event.key.toLowerCase() === "d") {
        event.preventDefault();
        handleToggleMic();
      }
      if (event.ctrlKey && event.key.toLowerCase() === "e") {
        event.preventDefault();
        handleToggleCamera();
      }
      if (event.ctrlKey && event.altKey && event.key.toLowerCase() === "h") {
        event.preventDefault();
        handleToggleHandRaise();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [meetingState, isHandRaised, isMicOn, isCameraOn]);

  useEffect(() => {
    if (meetingState !== "inMeeting") {
      audioMonitorsRef.current.forEach((cleanup) => cleanup());
      audioMonitorsRef.current.clear();
      audioMonitorKeysRef.current.clear();
      activeSpeakerRef.current = null;
      if (audioContextRef.current) {
        void audioContextRef.current.close().catch(() => { });
        audioContextRef.current = null;
      }
    }
  }, [meetingState]);

  // Cleanup on page close
  useEffect(() => {
    return () => {
      cleanupAll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!showSwitchHereModal) return;
    switchHereButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        handleCancelSwitchHere();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showSwitchHereModal, handleCancelSwitchHere]);

  const switchHereModal = showSwitchHereModal ? (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-6 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          handleCancelSwitchHere();
        }
      }}
    >
      <div
        ref={switchHereDialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="switch-here-title"
        aria-describedby="switch-here-description"
        onKeyDown={(event) => {
          if (event.key !== "Tab") return;
          const buttons = switchHereDialogRef.current?.querySelectorAll("button");
          if (!buttons?.length) return;
          const first = buttons[0];
          const last = buttons[buttons.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }}
        className="w-full max-w-[448px] rounded-[28px] bg-white px-6 pb-5 pt-6 text-[#202124] shadow-2xl outline-none sm:px-6"
      >
        <h2
          id="switch-here-title"
          className="text-[24px] font-normal leading-8 tracking-normal text-[#202124]"
        >
          You&apos;re already in this meeting
        </h2>
        <p
          id="switch-here-description"
          className="mt-4 text-[14px] font-normal leading-5 tracking-normal text-[#5f6368]"
        >
          This account is currently participating in this meeting from another
          tab, window, or device.
        </p>
        <p className="mt-3 text-[14px] font-normal leading-5 tracking-normal text-[#5f6368]">
          If you switch here, the other session will leave the meeting.
        </p>
        <div className="mt-8 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={handleCancelSwitchHere}
            className="h-10 rounded-full px-6 text-sm font-medium text-[#1a73e8] outline-none transition-colors hover:bg-[#1a73e8]/5 focus-visible:ring-2 focus-visible:ring-[#1a73e8] focus-visible:ring-offset-2 active:bg-[#1a73e8]/10"
          >
            Cancel
          </button>
          <button
            ref={switchHereButtonRef}
            type="button"
            onClick={handleSwitchHere}
            className="h-10 rounded-full bg-[#1a73e8] px-6 text-sm font-medium text-white outline-none transition-colors hover:bg-[#1765cc] focus-visible:ring-2 focus-visible:ring-[#1a73e8] focus-visible:ring-offset-2 active:bg-[#185abc]"
          >
            Switch here
          </button>
        </div>
      </div>
    </div>
  ) : null;

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
      <>
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
        {switchHereModal}
      </>
    );
  }

  if (meetingState === "waiting") {
    if (!isAuthenticated) {
      return (
        <GuestWaitingLobby
          displayName={resolvedDisplayName}
          videoRef={localVideoRef}
          isMicOn={isMicOn}
          isCameraOn={isCameraOn}
          audioInputDevices={audioInputDevices}
          audioOutputDevices={audioOutputDevices}
          videoInputDevices={videoInputDevices}
          selectedAudioInputId={selectedAudioInputId}
          selectedAudioOutputId={selectedAudioOutputId}
          selectedVideoInputId={selectedVideoInputId}
          onSelectAudioInput={(deviceId) => void handleSelectAudioInput(deviceId)}
          onSelectAudioOutput={handleSelectAudioOutput}
          onSelectVideoInput={(deviceId) => void handleSelectVideoInput(deviceId)}
          onToggleMic={handleToggleMic}
          onToggleCamera={handleToggleCamera}
          onLeave={handleCancelJoinRequest}
        />
      );
    }

    return (
      <div className="fixed inset-0 flex flex-col bg-[#202124] text-white">
        <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4 pb-8">
          <div className="flex max-w-[520px] items-center justify-center gap-3 text-center">
            <span
              className="inline-block h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-[#8ab4f8] border-t-transparent"
              aria-hidden
            />
            <p className="text-[15px] leading-6 text-white/90 sm:text-base">
              Please wait until a meeting host brings you into the call
            </p>
          </div>

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
                  email={identity.email}
                  image={identity.image}
                  size="xl"
                />
              </div>
            )}
            <div className="absolute bottom-2 left-3 truncate text-xs text-white">
              {resolvedDisplayName}
            </div>
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
        <h1 className="text-3xl font-light">
          {switchedAway
            ? "You switched this meeting to another window."
            : endedByHost
              ? "The meeting has ended"
              : "You left the meeting"}
        </h1>
        <p className="text-sm text-white/60">Meeting code: {meetingCode}</p>
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
  const raisedHandNotifications = [
    ...(isHandRaised && !handLowerPrompt
      ? [{ id: "local", name: resolvedDisplayName }]
      : []),
    ...activeParticipants
      .filter((p) => p.isHandRaised)
      .map((p) => ({ id: p.socketId, name: p.displayName })),
  ];
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
          : "tiled"
      : meetingLayout;
  const layoutWantsStage =
    effectiveLayout === "spotlight" || effectiveLayout === "sidebar";
  const defaultStageParticipantId =
    participants[0]?.socketId || "local";
  const stageParticipantId =
    pinnedParticipantId || presenterId || (layoutWantsStage ? defaultStageParticipantId : null);
  const useStageLayout =
    Boolean(stageParticipantId) && layoutWantsStage;
  const orderedParticipants = [...activeParticipants].sort((a, b) => {
    if (a.socketId === pinnedParticipantId) return -1;
    if (b.socketId === pinnedParticipantId) return 1;
    if (a.socketId === presenterId) return -1;
    if (b.socketId === presenterId) return 1;
    return 0;
  });
  const visibleGridCount = totalConferencingUsers;
  const sidePanelOpen = showParticipantsList || showChat;
  const gridColumnCount =
    visibleGridCount <= 1
      ? 1
      : visibleGridCount <= 4
        ? 2
        : sidePanelOpen && visibleGridCount <= 6
          ? 2
          : visibleGridCount <= 9
            ? 3
            : sidePanelOpen
              ? 3
              : 4;
  const gridRowCount = Math.ceil(visibleGridCount / gridColumnCount);
  const gridStyle: React.CSSProperties | undefined = isTwoUp
    ? undefined
    : {
      gridTemplateColumns: `repeat(${gridColumnCount}, minmax(0, 1fr))`,
      gridTemplateRows: `repeat(${gridRowCount}, minmax(0, 1fr))`,
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

  const renderTileBadges = (props: {
    id: string;
    name: string;
    host: boolean;
    handRaised?: boolean;
    micOn: boolean;
    screenSharing: boolean;
    compact?: boolean;
  }) => {
    const { name, host, handRaised, micOn, screenSharing, compact = false } = props;

    return (
      <div
        className={`absolute ${compact ? "bottom-1 left-1 px-2 py-0.5 text-[10px]" : "bottom-3 left-3 px-3 py-1.5 text-xs"} z-20 flex max-w-[80%] items-center gap-2 rounded-full border border-white/10 bg-black/60 font-light tracking-wide backdrop-blur-md`}
      >
        <span className={compact ? "max-w-[90px] truncate" : "max-w-[140px] truncate"}>{name}</span>
        {handRaised && <Hand className="h-3 w-3 text-[#81c995]" aria-label="Hand raised" />}
        {host && <Shield className="h-3.5 w-3.5 text-yellow-400" />}
        <MeetMicStatus isMicOn={micOn} compact />
        {screenSharing && <MonitorUp className="h-3.5 w-3.5 text-[#8ab4f8]" />}
        {pinnedParticipantId === props.id && <Pin className="h-3.5 w-3.5 text-[#8ab4f8]" />}
      </div>
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

      {copiedToast && (
        <div className="absolute bottom-24 left-1/2 z-[80] -translate-x-1/2 animate-fade-in">
          <div className="rounded-full bg-[#323639] px-4 py-2 text-sm text-white shadow-lg ring-1 ring-white/10">
            {copiedToast}
          </div>
        </div>
      )}

      {/* Top bar */}
      <header className="relative z-30 flex h-12 shrink-0 items-center justify-between border-b border-white/5 px-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <span className="text-sm text-white/90">{currentTime}</span>
          <span className="h-4 w-px bg-white/15" />
          <span className="font-mono text-xs tracking-wider text-white/90 sm:text-sm">{meetingCode}</span>
          <button
            type="button"
            onClick={() => {
              setParticipantLeftMessage(`Meeting Link: ${buildMeetingLink(meetingCode || "")}`);
              window.setTimeout(() => setParticipantLeftMessage(null), 5000);
            }}
            className="flex h-8 w-8 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10"
            title="Meeting details"
            aria-label="Meeting details"
          >
            <Info className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => {
              setShowParticipantsList(true);
              setShowChat(false);
            }}
            className="relative flex items-center"
            title="Show everyone"
            aria-label="Show everyone"
          >
            <MeetPersonAvatar
              name={resolvedDisplayName}
              email={isAuthenticated ? identity.email : undefined}
              image={isAuthenticated ? identity.image : undefined}
              size="xs"
            />
            <span className="absolute -bottom-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#3c4043] px-1 text-[10px] font-medium text-white ring-2 ring-[#202124]">
              {totalConferencingUsers}
            </span>
          </button>
        </div>
      </header>

      {isHost && joinRequests.length > 0 && (
        <div className="absolute right-4 top-14 z-[60]">
          <AdmitGuestControl
            requests={joinRequests}
            onAdmit={handleAdmit}
            onDeny={handleDeny}
            onOpenPeoplePanel={handleOpenPeoplePanel}
          />
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

      <HandRaiseNotifications
        raisedHands={raisedHandNotifications}
        stackOffset={handLowerPrompt && isHandRaised ? 88 : 0}
      />

      {handLowerPrompt && isHandRaised && (
        <HandLowerToast onKeepRaised={handleKeepHandRaised} />
      )}

      {/* Main video area — grid or presenter layout */}
      <div className="relative flex-1 flex overflow-hidden p-2 sm:p-3 gap-2 sm:gap-3 min-h-0">
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
                      "meet-tile relative h-24 w-36 sm:h-28 sm:w-44 md:h-28 shrink-0 cursor-pointer rounded-xl overflow-hidden bg-[#3c4043] border border-white/10",
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
                      "meet-tile relative h-24 w-36 sm:h-28 sm:w-44 md:h-28 shrink-0 cursor-pointer rounded-xl overflow-hidden bg-[#3c4043] border border-white/10",
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
                "grid items-stretch gap-2 sm:gap-4 w-full mx-auto h-full p-1 sm:p-2 overflow-y-auto overscroll-contain overflow-x-hidden",
                "place-items-stretch",
                isTwoUp
                  ? "grid-cols-1 md:grid-cols-2 max-w-[1600px]"
                  : sidePanelOpen
                    ? "md:max-w-[calc(100vw-26rem)] 2xl:max-w-[calc(100vw-26rem)]"
                    : "max-w-none",
              ].join(" ")}
            >
              {/* 1. Local Participant Card */}
              <div
                className={[
                  "meet-tile relative min-w-0 min-h-0 w-full cursor-pointer rounded-2xl overflow-hidden bg-[#3c4043] border border-white/5 shadow-md flex items-center justify-center",
                  // Prevent desktop 2-up overlap: on md+ fill available height instead of forcing aspect ratio
                  pinnedParticipantId === "local" || isScreenSharing
                    ? "ring-2 ring-[#8ab4f8] md:col-span-2 md:row-span-2"
                    : "",
                  activeSpeakerId === "local" ? "shadow-[0_0_0_3px_rgba(52,168,83,0.85)]" : "",
                  isTwoUp ? "aspect-video md:aspect-auto md:h-full" : "aspect-video md:aspect-auto md:h-full",
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
                    "meet-tile relative min-w-0 min-h-0 w-full cursor-pointer rounded-2xl overflow-hidden bg-[#3c4043] border border-white/5 shadow-md flex items-center justify-center",
                    pinnedParticipantId === p.socketId || p.isScreenSharing
                      ? "ring-2 ring-[#8ab4f8] md:col-span-2 md:row-span-2"
                      : "",
                    activeSpeakerId === p.socketId ? "shadow-[0_0_0_3px_rgba(52,168,83,0.85)]" : "",
                    isTwoUp ? "aspect-video md:aspect-auto md:h-full" : "aspect-video md:aspect-auto md:h-full",
                  ].join(" ")}
                  style={{
                    order:
                      p.socketId === pinnedParticipantId
                        ? -30
                        : p.socketId === presenterId
                          ? -20
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
                    <div
                      key={m.id || `${m.timestamp}-${i}`}
                      className="group flex items-start gap-3 rounded-xl px-1 py-1 transition-colors hover:bg-white/5"
                    >
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
                          <button
                            type="button"
                            onClick={() => void handleCopyMessage(m.message)}
                            className="ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white/55 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8ab4f8] md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
                            title="Copy text"
                            aria-label="Copy message text"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
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

        {/* Right Sidebar - People panel */}
        {showParticipantsList && (
          <PeoplePanel
            isHost={isHost}
            localName={resolvedDisplayName}
            localEmail={isAuthenticated ? identity.email : undefined}
            localImage={isAuthenticated ? identity.image : undefined}
            isLocalMicOn={isMicOn}
            isLocalCameraOn={isCameraOn}
            isLocalHandRaised={isHandRaised}
            joinRequests={joinRequests}
            participants={filteredParticipants}
            searchQuery={participantSearch}
            onSearchChange={setParticipantSearch}
            onClose={() => setShowParticipantsList(false)}
            onAdmit={handleAdmit}
            onDeny={handleDeny}
            onAdmitAll={handleAdmitAll}
            onRemove={isHost ? handleKick : undefined}
          />
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
            className="w-full max-w-[400px] overflow-hidden rounded-[28px] bg-white text-[#202124] shadow-[0_8px_40px_rgba(0,0,0,0.2)]"
          >
            <div className="px-6 pb-2 pt-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#fce8e6]">
                <Phone className="h-6 w-6 rotate-[135deg] text-[#d93025]" aria-hidden />
              </div>
              <h2 id="leave-meeting-title" className="text-[22px] font-normal leading-7">
                {isHost ? "Leave this call?" : "Leave call?"}
              </h2>
              <p className="mt-2 text-sm leading-5 text-[#5f6368]">
                {isHost
                  ? "Choose whether to leave the meeting or end it for everyone."
                  : "You'll leave the call. Others can keep talking."}
              </p>
            </div>
            <div className="flex flex-col gap-2 px-6 pb-6 pt-2">
              {isHost && (
                <button
                  type="button"
                  onClick={handleEndMeetingForAll}
                  className="h-11 w-full rounded-full bg-[#d93025] text-sm font-medium text-white transition-colors hover:bg-[#c5221f]"
                >
                  End for everyone
                </button>
              )}
              <button
                type="button"
                onClick={handleLeaveMeeting}
                className="h-11 w-full rounded-full border border-[#dadce0] text-sm font-medium text-[#1a73e8] transition-colors hover:bg-[#f8fafd]"
              >
                {isHost ? "Leave meeting" : "Leave call"}
              </button>
              <button
                type="button"
                onClick={() => setShowLeaveDialog(false)}
                className="h-11 w-full rounded-full text-sm font-medium text-[#1a73e8] transition-colors hover:bg-[#f1f3f4]"
              >
                Cancel
              </button>
            </div>
          </section>
        </div>
      )}

      <MeetControlBar
        isMicOn={isMicOn}
        isCameraOn={isCameraOn}
        isScreenSharing={isScreenSharing}
        isHandRaised={isHandRaised}
        isHost={isHost}
        isMeetingLocked={isMeetingLocked}
        localMicLevel={localMicLevel}
        showChat={showChat}
        showParticipantsList={showParticipantsList}
        unreadMessages={unreadMessages}
        screenShareSupported={screenShareSupport?.supported ?? true}
        screenShareReason={screenShareSupport?.reason}
        meetingLayout={meetingLayout}
        layoutOptions={layoutOptions}
        showAudioDeviceMenu={showAudioDeviceMenu}
        showVideoDeviceMenu={showVideoDeviceMenu}
        showEmojiPicker={showEmojiPicker}
        showLayoutMenu={showLayoutMenu}
        showMoreOptionsMenu={showMoreOptionsMenu}
        audioDeviceMenu={
          <div className="fixed bottom-24 left-1/2 z-[60] w-72 -translate-x-1/2 rounded-2xl border border-white/10 bg-[#303134] p-2 shadow-2xl animate-fade-in">
            {renderDeviceList(
              "Microphone",
              audioInputDevices,
              selectedAudioInputId,
              "Microphone",
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
        }
        videoDeviceMenu={
          <div className="fixed bottom-24 left-1/2 z-[60] w-72 -translate-x-1/2 rounded-2xl border border-white/10 bg-[#303134] p-2 shadow-2xl animate-fade-in">
            {renderDeviceList(
              "Camera",
              videoInputDevices,
              selectedVideoInputId,
              "Camera",
              handleSelectVideoInput
            )}
          </div>
        }
        onToggleMic={handleToggleMic}
        onToggleCamera={handleToggleCamera}
        onToggleScreenShare={() => void handleToggleScreenShare()}
        onToggleHandRaise={handleToggleHandRaise}
        onToggleChat={() => {
          setShowChat((prev) => !prev);
          setShowParticipantsList(false);
        }}
        onToggleParticipants={() => {
          setShowParticipantsList((prev) => !prev);
          setShowChat(false);
        }}
        onShowMeetingDetails={() => {
          setParticipantLeftMessage(`Meeting Link: ${buildMeetingLink(meetingCode || "")}`);
          window.setTimeout(() => setParticipantLeftMessage(null), 5000);
        }}
        onLeave={() => setShowLeaveDialog(true)}
        onReaction={handleReaction}
        onLayoutChange={handleLayoutChange}
        onToggleMeetingLock={() => setIsMeetingLocked((prev) => !prev)}
        setShowAudioDeviceMenu={setShowAudioDeviceMenu}
        setShowVideoDeviceMenu={setShowVideoDeviceMenu}
        setShowEmojiPicker={setShowEmojiPicker}
        setShowLayoutMenu={setShowLayoutMenu}
        setShowMoreOptionsMenu={setShowMoreOptionsMenu}
        audioDeviceMenuRef={audioDeviceMenuRef}
        videoDeviceMenuRef={videoDeviceMenuRef}
        emojiRef={emojiRef}
        layoutRef={layoutRef}
        moreOptionsRef={moreOptionsRef}
      />
    </div>
  );
}
