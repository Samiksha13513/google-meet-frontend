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
} from "lucide-react";

import { useParams, useRouter } from "next/navigation";
import { socket } from "@/lib/socket";
import { getLocalStream } from "../../webrtc/media";
import { MeetingPeerSession } from "../../webrtc/meeting-session";
import { PreviewLobby } from "@/components/meeting/PreviewLobby";
import {
  getCurrentUserIdentity,
  getDisplayInitial,
  getIdentityLabel,
  type UserIdentity,
} from "@/lib/display-name";
import { getMeetingByCode } from "@/lib/api";

const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "👏", "🎉", "🤔"];

type MeetingState =
  | "lobby"
  | "waiting"
  | "connecting"
  | "inMeeting"
  | "ended"
  | "denied";

type Participant = {
  socketId: string;
  displayName: string;
  email?: string;
  image?: string;
  stream?: MediaStream;
  isMicOn: boolean;
  isCameraOn: boolean;
  isHost: boolean;
  isScreenSharing: boolean;
};

type ChatMessage = {
  senderId: string;
  senderName: string;
  message: string;
  timestamp: number;
};

type FloatingReaction = {
  id: number;
  emoji: string;
  senderName: string;
  x: number; // Horizontal offset percentage
};

type JoinRequest = {
  socketId: string;
  displayName: string;
  email?: string;
  image?: string;
};

// Isolated Video element component to ensure stable stream attachments and avoid React playback resets
const ParticipantVideo = ({
  stream,
  isLocal,
  muted,
}: {
  stream?: MediaStream;
  isLocal: boolean;
  muted: boolean;
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;

    video.srcObject = stream;
    video.play().catch((err) => {
      console.log(`[WebRTC:Video] Autoplay for ${isLocal ? "local" : "remote"} stream failed:`, err);
    });
  }, [stream, isLocal]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={muted}
      className="w-full h-full object-cover rounded-2xl"
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
  
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);
  
  const [isHost, setIsHost] = useState(false);
  const [meetingError, setMeetingError] = useState<string | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [, setPermissionRequested] = useState(false);
  const [deniedReason, setDeniedReason] = useState("Host denied your request");

  const [currentTime, setCurrentTime] = useState("");
  const [, setParticipantLeftMessage] = useState<string | null>(null);

  // Active participants list
  const [participants, setParticipants] = useState<Participant[]>([]);

  // Waiting Room Requests (Host-only)
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);

  // Chat & Sidebars
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [showChat, setShowChat] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [showParticipantsList, setShowParticipantsList] = useState(false);

  // Reaction picker & anims
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([]);

  // Refs
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<MeetingPeerSession | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const reactionIdRef = useRef(0);

  const emojiRef = useRef<HTMLDivElement>(null);

  // =========================
  // CLEANUPS
  // =========================

  const stopPreviewTracks = () => {
    const stream = localStreamRef.current;
    stream?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
  };

  const cleanupLiveSession = () => {
    setParticipants([]);
    setJoinRequests([]);
    setMessages([]);
    sessionRef.current?.destroy();
    sessionRef.current = null;
  };

  const cleanupAll = () => {
    cleanupLiveSession();
    stopPreviewTracks();
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
  };

  // =========================
  // HANDLERS
  // =========================

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

  const handleToggleScreenShare = async () => {
    if (isScreenSharing) {
      // Stop screen share
      await sessionRef.current?.stopScreenShare();
      screenStreamRef.current = null;
      setIsScreenSharing(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false,
        });
        screenStreamRef.current = stream;
        await sessionRef.current?.startScreenShare(stream);
        setIsScreenSharing(true);

        // When sharing ends from browser control
        stream.getVideoTracks()[0].onended = async () => {
          await sessionRef.current?.stopScreenShare();
          screenStreamRef.current = null;
          setIsScreenSharing(false);
        };
      } catch (err) {
        console.error("Screen sharing permission denied or failed:", err);
      }
    }
  };

  const triggerFloatingReaction = (emoji: string, senderName: string) => {
    reactionIdRef.current += 1;
    const id = reactionIdRef.current;
    const x = 20 + ((id * 37) % 61); // range 20% to 80% width
    setFloatingReactions((prev) => [...prev, { id, emoji, senderName, x }]);
    setTimeout(() => {
      setFloatingReactions((prev) => prev.filter((r) => r.id !== id));
    }, 4000);
  };

  const handleReaction = (emoji: string) => {
    sessionRef.current?.sendReaction(emoji);
    triggerFloatingReaction(emoji, "You");
    setShowEmojiPicker(false);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    sessionRef.current?.sendChatMessage(chatInput.trim(), displayName);
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

  const handleKick = (socketId: string) => {
    sessionRef.current?.removeParticipant(socketId);
  };

  const handleLeaveMeeting = () => {
    cleanupAll();
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

    setMeetingState("waiting");

    if (!socket.connected) {
      socket.connect();
    }

    const stream = localStreamRef.current;
    if (!stream) return;

    // Create session
    const session = new MeetingPeerSession(meetingCode, socket, stream, {
      onWaitingRoom: () => {
        setMeetingState("waiting");
      },
      onJoinApproved: (members, isHostRole) => {
        setIsHost(isHostRole);
        setMeetingState("inMeeting");
        
        // Add existing members, excluding current user
        setParticipants(
          members
            .filter((m) => m.socketId !== socket.id)
            .map((m) => ({
              socketId: m.socketId,
              displayName: getIdentityLabel(m),
              email: m.email,
              image: m.image,
              isMicOn: m.isMicOn,
              isCameraOn: m.isCameraOn,
              isHost: m.isHost,
              isScreenSharing: m.isScreenSharing || false,
            }))
        );
      },
      onJoinDenied: (reason) => {
        setDeniedReason(reason);
        setMeetingState("denied");
      },
      onRemoteStreamAdded: (socketId, remoteStream, remoteName, remoteDetails) => {
        // Prevent adding self as remote participant
        if (socketId === socket.id) {
          console.warn("[Meeting] Ignoring self stream added event");
          return;
        }
        setParticipants((prev) => {
          const exists = prev.find((p) => p.socketId === socketId);
          if (exists) {
            return prev.map((p) =>
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
                    isHost: remoteDetails?.isHost ?? p.isHost,
                  }
                : p
            );
          } else {
            return [
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
                isHost: remoteDetails?.isHost ?? false,
                isScreenSharing: false,
              },
            ];
          }
        });
      },
      onRemoteStreamRemoved: (socketId) => {
        setParticipants((prev) => prev.filter((p) => p.socketId !== socketId));
      },
      onRemoteStatusChanged: (data) => {
        setParticipants((prev) =>
          prev.map((p) =>
            p.socketId === data.socketId
              ? {
                  ...p,
                  isMicOn: data.isMicOn,
                  isCameraOn: data.isCameraOn,
                  displayName: getIdentityLabel({
                    displayName: data.displayName || p.displayName,
                    email: data.email || p.email,
                  }),
                  email: data.email || p.email,
                  image: data.image || p.image,
                }
              : p
          )
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
        // Prevent adding self as remote participant
        if (member.socketId === socket.id) {
          console.warn("[Meeting] Ignoring self participant joined event");
          return;
        }
        setParticipants((prev) => {
          if (prev.some((p) => p.socketId === member.socketId)) {
            return prev.map((p) =>
              p.socketId === member.socketId
                ? {
                    ...p,
                    displayName: getIdentityLabel(member),
                    email: member.email || p.email,
                    image: member.image || p.image,
                    isMicOn: member.isMicOn,
                    isCameraOn: member.isCameraOn,
                    isHost: member.isHost,
                    isScreenSharing: member.isScreenSharing || false,
                  }
                : p
            );
          }

          return [
            ...prev,
            {
              socketId: member.socketId,
              displayName: getIdentityLabel(member),
              email: member.email,
              image: member.image,
              isMicOn: member.isMicOn,
              isCameraOn: member.isCameraOn,
              isHost: member.isHost,
              isScreenSharing: member.isScreenSharing || false,
            },
          ];
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
      },
      onEmojiReaction: (data) => {
        const participant = participants.find((p) => p.socketId === data.senderId);
        const name = participant?.email || participant?.displayName || displayName;
        triggerFloatingReaction(data.emoji, name);
      },
      onScreenShareStarted: (senderId) => {
        setParticipants((prev) =>
          prev.map((p) => (p.socketId === senderId ? { ...p, isScreenSharing: true } : p))
        );
      },
      onScreenShareStopped: (senderId) => {
        setParticipants((prev) =>
          prev.map((p) => (p.socketId === senderId ? { ...p, isScreenSharing: false } : p))
        );
      },
      onKicked: () => {
        cleanupAll();
        setMeetingState("denied");
        setDeniedReason("You were removed from the meeting by the host");
      },
    });

    sessionRef.current = session;
    await session.start({
      ...identity,
      isMicOn,
      isCameraOn,
    });
  };

  // Camera & Mic setup
  const startPreviewMedia = async () => {
    setPermissionRequested(true);
    try {
      const stream = await getLocalStream();
      stream.getAudioTracks().forEach((t) => (t.enabled = isMicOn));
      stream.getVideoTracks().forEach((t) => (t.enabled = isCameraOn));
      localStreamRef.current = stream;
      setMediaError(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setMediaError(`Camera/microphone permission failed: ${errorMessage}`);
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

  // Validate Code
  useEffect(() => {
    if (!meetingCode) return;
    const validate = async () => {
      try {
        await getMeetingByCode(meetingCode);
      } catch (err) {
        setMeetingError(err instanceof Error ? err.message : "Meeting not found");
        setTimeout(() => router.push("/dashboard"), 3000);
      }
    };
    validate();
  }, [meetingCode, router]);

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
    };
    document.addEventListener("mousedown", clickOut);
    return () => document.removeEventListener("mousedown", clickOut);
  }, []);

  // Sync Local stream elements
  useEffect(() => {
    const stream = localStreamRef.current;
    if (stream && localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }
  }, [meetingState, isCameraOn]);

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
        meetingCode={meetingCode ?? ""}
        displayName={displayName}
        email={identity.email}
        image={identity.image}
        videoRef={localVideoRef}
        isMicOn={isMicOn}
        isCameraOn={isCameraOn}
        isJoining={false}
        mediaError={mediaError}
        onToggleMic={handleToggleMic}
        onToggleCamera={handleToggleCamera}
        onJoinNow={handleJoinNow}
      />
    );
  }

  if (meetingState === "waiting") {
    return (
      <div className="fixed inset-0 bg-[#202124] text-white flex flex-col items-center justify-center gap-6">
        <div className="relative flex items-center justify-center">
          <div className="absolute h-28 w-28 rounded-full border-4 border-[#8ab4f8] animate-ping" />
          <MeetAvatar
            name={displayName}
            email={identity.email}
            image={identity.image}
            size="xl"
          />
        </div>
        <h1 className="text-3xl font-light">Asking to join...</h1>
        <div className="max-w-xs text-center">
          <p className="truncate text-sm text-white">{displayName}</p>
          {identity.email && (
            <p className="mt-1 truncate text-xs text-white/55">{identity.email}</p>
          )}
        </div>
        <p className="text-white/60 text-sm max-w-xs text-center leading-relaxed">
          Please wait. The meeting host will let you in shortly.
        </p>
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

  // Calculate Responsive Grid layouts
  const totalConferencingUsers = participants.length + 1; // Participants + local user
  let gridCols = "grid-cols-1";
  if (totalConferencingUsers === 2) gridCols = "grid-cols-1 md:grid-cols-2";
  else if (totalConferencingUsers <= 4) gridCols = "grid-cols-2";
  else if (totalConferencingUsers <= 6) gridCols = "grid-cols-2 md:grid-cols-3";
  else gridCols = "grid-cols-3 md:grid-cols-4";

  return (
    <div className="fixed inset-0 bg-[#202124] text-white flex flex-col font-sans select-none overflow-hidden">
      {/* Floating Join Request Modal (Host only) */}
      {isHost && joinRequests.length > 0 && (
        <div className="absolute right-4 top-4 z-50 w-[min(360px,calc(100vw-32px))] rounded-2xl border border-white/10 bg-[#2d2e30] p-4 shadow-2xl animate-fade-in">
          <div className="flex items-start gap-3">
            <MeetAvatar
              name={joinRequests[0].displayName}
              email={joinRequests[0].email}
              image={joinRequests[0].image}
              size="md"
            />
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-medium text-white/90">Someone wants to join</h3>
              <p className="mt-1 truncate text-sm text-white">{joinRequests[0].displayName}</p>
              {joinRequests[0].email && (
                <p className="truncate text-xs text-white/55">{joinRequests[0].email}</p>
              )}
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-3">
            <button
              onClick={() => handleDeny(joinRequests[0].socketId)}
              className="rounded-full px-5 py-2 text-sm font-medium text-[#8ab4f8] hover:bg-[#8ab4f8]/10 transition-colors"
            >
              Deny
            </button>
            <button
              onClick={() => handleAdmit(joinRequests[0].socketId)}
              className="rounded-full bg-[#8ab4f8] px-5 py-2 text-sm font-medium text-[#202124] hover:bg-[#a8c7fa] transition-colors"
            >
              Admit
            </button>
          </div>
        </div>
      )}

      {/* Floating Emojis rise up effect container */}
      <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-50 pointer-events-none w-full max-w-2xl h-[calc(100vh-140px)] overflow-hidden">
        {floatingReactions.map((r) => (
          <div
            key={r.id}
            style={{ left: `${r.x}%` }}
            className="absolute bottom-0 flex flex-col items-center animate-emoji-float text-5xl"
          >
            <span>{r.emoji}</span>
            <span className="text-[10px] bg-black/60 px-1.5 py-0.5 rounded text-white mt-1 backdrop-blur-sm whitespace-nowrap">
              {r.senderName}
            </span>
          </div>
        ))}
      </div>

      {/* Main Grid View */}
      <div className="flex-1 flex overflow-hidden p-3 gap-3">
        <div className="flex-1 flex flex-col justify-center">
          <div className={`grid ${gridCols} gap-4 w-full max-w-7xl mx-auto h-full p-2 overflow-y-auto`}>
            {/* 1. Local Participant Card */}
            <div className="relative rounded-2xl overflow-hidden bg-[#3c4043] border border-white/5 shadow-md flex items-center justify-center aspect-video max-h-[500px]">
              {isCameraOn ? (
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover rounded-2xl scale-x-[-1]"
                />
              ) : (
                <div className="flex flex-col items-center gap-4 px-4 text-center">
                  <MeetAvatar
                    name={displayName}
                    email={identity.email}
                    image={identity.image}
                    size="xl"
                  />
                  <div className="max-w-[70%]">
                    <div className="truncate text-sm font-medium text-white">{displayName}</div>
                    {identity.email && (
                      <div className="truncate text-xs text-white/60">{identity.email}</div>
                    )}
                  </div>
                </div>
              )}
              {/* Badges */}
              <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-light tracking-wide flex items-center gap-2 border border-white/10">
                <span className="max-w-[120px] truncate">{displayName} (You)</span>
                {isHost && <Shield className="h-3.5 w-3.5 text-yellow-400" />}
                {!isMicOn && <MicOff className="h-3 w-3 text-red-400" />}
              </div>
            </div>

            {/* 2. Remote Participants Cards */}
            {participants.map((p) => (
              <div
                key={p.socketId}
                className="relative rounded-2xl overflow-hidden bg-[#3c4043] border border-white/5 shadow-md flex items-center justify-center aspect-video max-h-[500px]"
              >
                {p.stream && p.isCameraOn ? (
                  <ParticipantVideo stream={p.stream} isLocal={false} muted={false} />
                ) : (
                  <div className="flex flex-col items-center gap-4 px-4 text-center">
                    <MeetAvatar
                      name={p.displayName}
                      email={p.email}
                      image={p.image}
                      size="xl"
                    />
                    <div className="max-w-[70%]">
                      <div className="truncate text-sm font-medium text-white">{p.displayName}</div>
                      {p.email && (
                        <div className="truncate text-xs text-white/60">{p.email}</div>
                      )}
                    </div>
                  </div>
                )}
                {/* Status bar */}
                <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-light tracking-wide flex items-center gap-2 border border-white/10">
                  <span className="max-w-[120px] truncate">{p.displayName}</span>
                  {p.isHost && (
                    <span title="Host">
                      <Shield className="h-3.5 w-3.5 text-yellow-400" />
                    </span>
                  )}
                  {!p.isMicOn && <MicOff className="h-3 w-3 text-red-400" />}
                </div>
                {/* Host Control Actions */}
                {isHost && (
                  <button
                    onClick={() => handleKick(p.socketId)}
                    className="absolute top-3 right-3 h-8 w-8 rounded-full bg-black/40 hover:bg-red-500 hover:text-white flex items-center justify-center backdrop-blur-sm transition-all"
                    title="Remove participant"
                  >
                    <UserX className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right Sidebar - Chat panel */}
        {showChat && (
          <div className="w-80 md:w-96 bg-[#2d2e30] rounded-2xl flex flex-col border border-white/10 shadow-2xl animate-slide-in">
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
            <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-4">
              {messages.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-white/40 text-xs text-center max-w-[200px] mx-auto leading-relaxed">
                  Messages are only visible to active call members and get removed when leaving.
                </div>
              ) : (
                messages.map((m, i) => (
                  <div key={i} className="flex flex-col gap-1">
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs font-semibold text-[#8ab4f8] truncate max-w-[150px]">
                        {m.senderName}
                      </span>
                      <span className="text-[10px] text-white/45">
                        {new Date(m.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="text-sm text-white/90 bg-[#202124] p-3 rounded-xl rounded-tl-none break-words">
                      {m.message}
                    </p>
                  </div>
                ))
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
          <div className="w-80 md:w-96 bg-[#2d2e30] rounded-2xl flex flex-col border border-white/10 shadow-2xl animate-slide-in">
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
            <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-3">
              {/* Local member details row */}
              <div className="flex justify-between items-center p-3 rounded-xl bg-white/5 border border-white/5">
                <div className="flex items-center gap-3">
                  <MeetAvatar
                    name={displayName}
                    email={identity.email}
                    image={identity.image}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <h4 className="truncate text-sm font-medium">{displayName} (You)</h4>
                    <span className="block truncate text-[10px] text-white/50">
                      {identity.email || (isHost ? "Meeting host" : "In the meeting")}
                    </span>
                    {isHost && (
                      <span className="mt-1 inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium text-yellow-300 bg-yellow-400/10">
                        Host
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 text-white/60">
                  {isMicOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4 text-red-400" />}
                  {isCameraOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4 text-red-400" />}
                </div>
              </div>

              {/* Remote members list */}
              {participants.map((p) => (
                <div key={p.socketId} className="flex justify-between items-center p-3 rounded-xl hover:bg-white/5 transition-colors">
                  <div className="flex items-center gap-3">
                    <MeetAvatar
                      name={p.displayName}
                      email={p.email}
                      image={p.image}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <h4 className="truncate text-sm font-medium">{p.displayName}</h4>
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

      {/* Control Actions Bar */}
      <div className="h-24 bg-[#202124] flex items-center justify-between px-6 border-t border-white/5 relative z-40">
        {/* Time and room details */}
        <div className="hidden sm:flex flex-col text-sm font-light text-white/60">
          <span>{currentTime}</span>
          <span className="text-xs text-[#8ab4f8] mt-1 font-mono tracking-wider">{meetingCode}</span>
        </div>

        {/* Media Buttons */}
        <div className="flex items-center gap-3 mx-auto">
          {/* Audio */}
          <button
            onClick={handleToggleMic}
            className={`h-12 w-12 rounded-full flex items-center justify-center transition-colors ${
              isMicOn ? "bg-[#3c4043] hover:bg-[#4f5357]" : "bg-red-500 hover:bg-red-600 text-white"
            }`}
            title={isMicOn ? "Mute Microphone" : "Unmute Microphone"}
          >
            {isMicOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
          </button>

          {/* Camera */}
          <button
            onClick={handleToggleCamera}
            className={`h-12 w-12 rounded-full flex items-center justify-center transition-colors ${
              isCameraOn ? "bg-[#3c4043] hover:bg-[#4f5357]" : "bg-red-500 hover:bg-red-600 text-white"
            }`}
            title={isCameraOn ? "Turn Camera Off" : "Turn Camera On"}
          >
            {isCameraOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
          </button>

          {/* Screen Share */}
          <button
            onClick={handleToggleScreenShare}
            className={`h-12 w-12 rounded-full flex items-center justify-center transition-colors ${
              isScreenSharing ? "bg-[#8ab4f8] text-[#202124] hover:bg-[#a8c7fa]" : "bg-[#3c4043] hover:bg-[#4f5357]"
            }`}
            title={isScreenSharing ? "Stop sharing screen" : "Share entire screen"}
          >
            <MonitorUp className="h-5 w-5" />
          </button>

          {/* Smile Reaction button */}
          <div className="relative" ref={emojiRef}>
            <button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className={`h-12 w-12 rounded-full flex items-center justify-center transition-colors ${
                showEmojiPicker ? "bg-[#8ab4f8] text-[#202124]" : "bg-[#3c4043] hover:bg-[#4f5357]"
              }`}
              title="Send a reaction"
            >
              <Smile className="h-5 w-5" />
            </button>
            {showEmojiPicker && (
              <div className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-[#303134] border border-white/10 p-3 rounded-2xl flex gap-3 shadow-2xl scale-100 animate-fade-in z-[60]">
                {REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => handleReaction(emoji)}
                    className="text-2xl hover:scale-125 transition-transform duration-150"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Raise Hand */}
          <button
            onClick={() => setIsHandRaised(!isHandRaised)}
            className={`h-12 w-12 rounded-full flex items-center justify-center transition-colors ${
              isHandRaised ? "bg-yellow-400 text-black hover:bg-yellow-500" : "bg-[#3c4043] hover:bg-[#4f5357]"
            }`}
            title="Raise hand"
          >
            <Hand className="h-5 w-5" />
          </button>

          {/* End Call / Leave room */}
          <button
            onClick={handleLeaveMeeting}
            className="h-12 px-6 rounded-full bg-red-500 hover:bg-red-600 transition-colors flex items-center justify-center gap-2 font-medium"
            title="Leave call"
          >
            <Phone className="h-5 w-5 rotate-[135deg]" />
            <span className="hidden md:inline text-sm">Leave</span>
          </button>
        </div>

        {/* Sidebar Toggles */}
        <div className="flex items-center gap-2 text-white/70">
          {/* Info toggle */}
          <button
            onClick={() => {
              setParticipantLeftMessage(`Meeting Link: ${window.location.origin}/meeting/${meetingCode}`);
              setTimeout(() => setParticipantLeftMessage(null), 5000);
            }}
            className="h-11 w-11 rounded-full hover:bg-white/5 flex items-center justify-center transition-colors"
            title="Meeting details"
          >
            <Info className="h-5 w-5" />
          </button>

          {/* Chat Sidebar button */}
          <button
            onClick={() => {
              setShowChat(!showChat);
              setShowParticipantsList(false);
            }}
            className={`h-11 w-11 rounded-full flex items-center justify-center transition-colors ${
              showChat ? "bg-[#8ab4f8] text-[#202124]" : "hover:bg-white/5"
            }`}
            title="Chat messages"
          >
            <MessageSquare className="h-5 w-5" />
          </button>

          {/* Participants Sidebar button */}
          <button
            onClick={() => {
              setShowParticipantsList(!showParticipantsList);
              setShowChat(false);
            }}
            className={`h-11 w-11 rounded-full flex items-center justify-center transition-colors ${
              showParticipantsList ? "bg-[#8ab4f8] text-[#202124]" : "hover:bg-white/5"
            }`}
            title="Show participants list"
          >
            <Users className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
