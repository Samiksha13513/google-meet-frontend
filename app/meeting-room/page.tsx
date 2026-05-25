"use client";

import { useState, useEffect, useRef } from "react";

import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  MonitorUp,
  Smile,
  Captions,
  Hand,
  MoreVertical,
  Phone,
  Info,
  MessageSquare,
  LayoutGrid,
  Users,
  ChevronUp,
} from "lucide-react";

import { useParams, useRouter } from "next/navigation";

import { socket } from "@/lib/socket";

import { getLocalStream } from "../../webrtc/media";
import { MeetingPeerSession } from "../../webrtc/meeting-session";
import { PreviewLobby } from "@/components/meeting/PreviewLobby";
import { getDisplayName } from "@/lib/display-name";

import { getMeetingByCode } from "@/lib/api";

const REACTIONS = [
  "👍",
  "❤️",
  "😂",
  "😮",
  "😢",
  "👏",
  "🎉",
  "🤔",
];

type MeetingState =
  | "lobby"
  | "connecting"
  | "inMeeting"
  | "ended";

export default function MeetingRoom() {
  const router = useRouter();

  const params = useParams();

  const meetingCode = Array.isArray(
    params.meetingCode
  )
    ? params.meetingCode[0]
    : params.meetingCode;

  const [meetingState, setMeetingState] =
    useState<MeetingState>("lobby");

  const [displayName] = useState(() => getDisplayName());

  const [participantLeftMessage, setParticipantLeftMessage] =
    useState<string | null>(null);

  const [isJoiningLive, setIsJoiningLive] =
    useState(false);

  const signalingActiveRef = useRef(false);
  const hasJoinedLiveRef = useRef(false);

  const [isMicOn, setIsMicOn] =
    useState(true);

  const [isCameraOn, setIsCameraOn] =
    useState(true);

  const [isCaptionsOn, setIsCaptionsOn] =
    useState(true);

  const [isHandRaised, setIsHandRaised] =
    useState(false);

  const [isScreenSharing, setIsScreenSharing] =
    useState(false);

  const [showEmojiPicker, setShowEmojiPicker] =
    useState(false);

  const [showMoreMenu, setShowMoreMenu] =
    useState(false);

  const [showMicDropdown, setShowMicDropdown] =
    useState(false);

  const [
    showCameraDropdown,
    setShowCameraDropdown,
  ] = useState(false);

  const [activeReaction, setActiveReaction] =
    useState<string | null>(null);

  const [currentTime, setCurrentTime] =
    useState("");

  const [meetingError, setMeetingError] =
    useState<string | null>(null);

  const [mediaError, setMediaError] =
    useState<string | null>(null);

  const [
    permissionRequested,
    setPermissionRequested,
  ] = useState(false);

  const [localStream, setLocalStream] =
    useState<MediaStream | null>(null);

  const [remoteStream, setRemoteStream] =
    useState<MediaStream | null>(null);

  const localStreamRef =
    useRef<MediaStream | null>(null);

  const sessionRef =
    useRef<MeetingPeerSession | null>(null);

  const localVideoRef =
    useRef<HTMLVideoElement>(null);

  const remoteVideoRef =
    useRef<HTMLVideoElement>(null);

  const emojiRef =
    useRef<HTMLDivElement>(null);

  const moreRef =
    useRef<HTMLDivElement>(null);

  const micDropdownRef =
    useRef<HTMLDivElement>(null);

  const cameraDropdownRef =
    useRef<HTMLDivElement>(null);

  // =========================
  // CLEANUP
  // =========================

  const stopPreviewTracks = () => {
    const stream = localStreamRef.current || localStream;
    stream?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    setLocalStream(null);
  };

  const cleanupLiveSession = () => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    setRemoteStream(null);
    setParticipantLeftMessage(null);
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

  const attachRemoteStream = (stream: MediaStream) => {
    setRemoteStream(stream);
  };

  // Bind remote stream whenever the video element mounts or stream updates
  useEffect(() => {
    const video = remoteVideoRef.current;
    if (!video || !remoteStream) return;

    video.srcObject = remoteStream;
    video.play().catch((error) => {
      console.warn("[WebRTC] Remote video play failed:", error);
    });
  }, [remoteStream, meetingState]);

  const unregisterSignaling = () => {
    socket.off("existing-members");
    socket.off("user-joined");
    socket.off("offer");
    socket.off("answer");
    socket.off("ice-candidate");
    socket.off("user-left");
    signalingActiveRef.current = false;
  };

  const registerSignaling = () => {
    if (!meetingCode || signalingActiveRef.current) return;

    const handleExistingMembers = async (data: { members?: string[] }) => {
      await sessionRef.current?.onExistingMembers(data.members ?? []);
    };

    const handleUserJoined = (data: { socketId?: string }) => {
      if (data.socketId) {
        sessionRef.current?.onUserJoined(data.socketId);
      }
    };

    const handleOffer = async (data: {
      offer: RTCSessionDescriptionInit;
      senderId?: string;
    }) => {
      if (!data.senderId) return;
      await sessionRef.current?.onOffer(data.offer, data.senderId);
    };

    const handleAnswer = async (data: {
      answer: RTCSessionDescriptionInit;
      senderId?: string;
    }) => {
      if (!data.senderId) return;
      await sessionRef.current?.onAnswer(data.answer, data.senderId);
    };

    const handleIceCandidate = async (data: {
      candidate: RTCIceCandidateInit;
      senderId?: string;
    }) => {
      if (!data.senderId || !data.candidate) return;
      await sessionRef.current?.onIceCandidate(
        data.candidate,
        data.senderId
      );
    };

    const handleUserLeft = (data: { socketId?: string }) => {
      if (!data.socketId) return;

      const leftPeerId = sessionRef.current?.getRemotePeerId();
      if (leftPeerId && leftPeerId !== data.socketId) return;

      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }
      setRemoteStream(null);
      sessionRef.current?.destroy();
      sessionRef.current = null;
      setParticipantLeftMessage("Participant left the meeting");
    };

    socket.on("existing-members", handleExistingMembers);
    socket.on("user-joined", handleUserJoined);
    socket.on("offer", handleOffer);
    socket.on("answer", handleAnswer);
    socket.on("ice-candidate", handleIceCandidate);
    socket.on("user-left", handleUserLeft);

    signalingActiveRef.current = true;
  };

  // =========================
  // INITIALIZE MEETING
  // =========================

  const initializeLiveMeeting = async (stream: MediaStream) => {
    if (!meetingCode) {
      setMeetingError("Meeting code missing");
      return;
    }

    if (sessionRef.current?.isActive()) {
      return;
    }

    sessionRef.current?.destroy();

    const session = new MeetingPeerSession(
      meetingCode,
      socket,
      stream,
      {
        onRemoteStream: (remote) => {
          setParticipantLeftMessage(null);
          attachRemoteStream(remote);
        },
        onConnectionStateChange: (state) => {
          if (state === "connected") {
            setMeetingState("inMeeting");
            setIsJoiningLive(false);
          }
        },
        onParticipantLeft: () => {
          setParticipantLeftMessage("Participant left the meeting");
          setRemoteStream(null);
        },
      }
    );

    sessionRef.current = session;
    await session.start();
  };

  const startPreviewMedia = async () => {
    setPermissionRequested(true);
    try {
      const stream = await getLocalStream();
      stream.getAudioTracks().forEach((t) => {
        t.enabled = isMicOn;
      });
      stream.getVideoTracks().forEach((t) => {
        t.enabled = isCameraOn;
      });
      setLocalStream(stream);
      localStreamRef.current = stream;
      setMediaError(null);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      setMediaError(
        `Unable to access camera and microphone: ${errorMessage}`
      );
    }
  };

  const handleJoinNow = async () => {
    if (!meetingCode || isJoiningLive) return;

    let stream = localStreamRef.current || localStream;
    if (!stream) {
      await startPreviewMedia();
      stream = localStreamRef.current || localStream;
    }
    if (!stream) return;

    setIsJoiningLive(true);
    setMeetingState("connecting");
    setParticipantLeftMessage(null);
    hasJoinedLiveRef.current = true;

    if (!socket.connected) {
      socket.connect();
    }

    registerSignaling();

    try {
      await initializeLiveMeeting(stream);
      setMeetingState("inMeeting");
    } catch (error) {
      console.error("[Meeting] Join failed", error);
      setMediaError("Failed to join the meeting. Please try again.");
      setMeetingState("lobby");
    } finally {
      setIsJoiningLive(false);
    }
  };

  // Preview camera/mic in lobby only — no socket room join
  useEffect(() => {
    if (!meetingCode) return;
    startPreviewMedia();

    return () => {
      if (!hasJoinedLiveRef.current) {
        stopPreviewTracks();
      }
    };
  }, [meetingCode]);

  // =========================
  // VALIDATE MEETING
  // =========================

  useEffect(() => {
    if (!meetingCode) return;

    const validateMeeting =
      async () => {
        try {
          await getMeetingByCode(
            meetingCode
          );
        } catch (error) {
          let errorMessage =
            "Unable to join meeting";

          if (
            error instanceof Error
          ) {
            errorMessage =
              error.message;
          }

          setMeetingError(
            errorMessage
          );

          setTimeout(() => {
            router.push(
              "/dashboard"
            );
          }, 3000);
        }
      };

    validateMeeting();
  }, [meetingCode, router]);

  // Attach local preview / live stream to video element
  useEffect(() => {
    const stream = localStreamRef.current || localStream;
    const video = localVideoRef.current;
    if (!stream || !video) return;

    video.srcObject = stream;
    video.play?.().catch(() => {});
  }, [localStream, meetingState]);

  // =========================
  // TIME
  // =========================

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();

      setCurrentTime(
        now.toLocaleTimeString(
          "en-US",
          {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          }
        )
      );
    };

    updateTime();

    const interval =
      setInterval(
        updateTime,
        1000
      );

    return () =>
      clearInterval(interval);
  }, []);

  // =========================
  // CLOSE MENUS
  // =========================

  useEffect(() => {
    const handleClickOutside = (
      event: MouseEvent
    ) => {
      if (
        emojiRef.current &&
        !emojiRef.current.contains(
          event.target as Node
        )
      ) {
        setShowEmojiPicker(
          false
        );
      }

      if (
        moreRef.current &&
        !moreRef.current.contains(
          event.target as Node
        )
      ) {
        setShowMoreMenu(false);
      }

      if (
        micDropdownRef.current &&
        !micDropdownRef.current.contains(
          event.target as Node
        )
      ) {
        setShowMicDropdown(
          false
        );
      }

      if (
        cameraDropdownRef.current &&
        !cameraDropdownRef.current.contains(
          event.target as Node
        )
      ) {
        setShowCameraDropdown(
          false
        );
      }
    };

    document.addEventListener(
      "mousedown",
      handleClickOutside
    );

    return () =>
      document.removeEventListener(
        "mousedown",
        handleClickOutside
      );
  }, []);

  // =========================
  // REACTIONS
  // =========================

  useEffect(() => {
    if (activeReaction) {
      const timeout =
        setTimeout(() => {
          setActiveReaction(
            null
          );
        }, 3000);

      return () =>
        clearTimeout(timeout);
    }
  }, [activeReaction]);

  const handleReaction = (
    emoji: string
  ) => {
    setActiveReaction(emoji);

    setShowEmojiPicker(false);
  };

  // =========================
  // END CALL
  // =========================

  const handleLeaveMeeting = () => {
    hasJoinedLiveRef.current = false;

    if (meetingCode) {
      socket.emit("leave-room", { roomId: meetingCode });
    }

    unregisterSignaling();
    cleanupAll();

    setIsMicOn(true);
    setIsCameraOn(true);
    setIsScreenSharing(false);
    setIsJoiningLive(false);
    setMeetingState("ended");
  };

  const handleReturnHome = () => {
    router.push("/");
  };

  const handleRejoin = async () => {
    hasJoinedLiveRef.current = false;
    unregisterSignaling();
    cleanupLiveSession();
    setMeetingError(null);
    setMediaError(null);
    setParticipantLeftMessage(null);
    setMeetingState("lobby");
    await startPreviewMedia();
  };

  useEffect(() => {
    return () => {
      if (meetingCode) {
        socket.emit("leave-room", { roomId: meetingCode });
      }
      unregisterSignaling();
      cleanupAll();
    };
  }, [meetingCode]);

  // =========================
  // ERROR SCREEN
  // =========================

  if (meetingError) {
    return (
      <div className="fixed inset-0 bg-[#202124] text-white flex flex-col items-center justify-center">
        <h1 className="text-2xl">
          Can't join meeting
        </h1>

        <p className="text-white/60 mt-4">
          {meetingError}
        </p>
      </div>
    );
  }

  if (meetingState === "lobby") {
    return (
      <PreviewLobby
        meetingCode={meetingCode ?? ""}
        displayName={displayName}
        videoRef={localVideoRef}
        isMicOn={isMicOn}
        isCameraOn={isCameraOn}
        isJoining={isJoiningLive}
        mediaError={mediaError}
        onToggleMic={() => {
          const next = !isMicOn;
          (localStreamRef.current || localStream)
            ?.getAudioTracks()
            .forEach((t) => {
              t.enabled = next;
            });
          setIsMicOn(next);
        }}
        onToggleCamera={() => {
          const next = !isCameraOn;
          (localStreamRef.current || localStream)
            ?.getVideoTracks()
            .forEach((t) => {
              t.enabled = next;
            });
          setIsCameraOn(next);
        }}
        onJoinNow={handleJoinNow}
      />
    );
  }

  if (meetingState === "connecting") {
    return (
      <div className="fixed inset-0 bg-[#202124] text-white flex flex-col items-center justify-center">
        <div className="w-48 h-1 bg-[#3c4043] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#8ab4f8] animate-pulse"
            style={{ width: "70%" }}
          />
        </div>
        <p className="mt-4">Joining meeting...</p>
        <div className="sr-only" aria-hidden>
          <video ref={localVideoRef} autoPlay muted playsInline />
          <video ref={remoteVideoRef} autoPlay playsInline />
        </div>
      </div>
    );
  }

  // =========================
  // ENDED
  // =========================

  if (meetingState === "ended") {
    hasJoinedLiveRef.current = false;

    return (
      <div className="fixed inset-0 bg-[#202124] text-white flex flex-col items-center justify-center gap-4">
        <h1 className="text-3xl font-normal">You left the meeting</h1>
        <p className="text-white/60 text-sm">Meeting code: {meetingCode}</p>
        <div className="flex gap-3 mt-2">
          <button
            onClick={handleRejoin}
            className="px-6 py-3 bg-[#3c4043] hover:bg-[#5f6368] rounded-full text-sm"
          >
            Rejoin
          </button>
          <button
            onClick={handleReturnHome}
            className="px-6 py-3 bg-[#8ab4f8] text-[#202124] rounded-full text-sm font-medium"
          >
            Return to home
          </button>
        </div>
      </div>
    );
  }

  // =========================
  // MAIN ROOM
  // =========================

  return (
    <div className="fixed inset-0 bg-[#202124] text-white flex flex-col">
      {/* Reaction */}
      {activeReaction && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 text-6xl animate-bounce">
          {activeReaction}
        </div>
      )}

      {participantLeftMessage && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-[#3c4043] px-4 py-2 rounded-lg text-sm text-[#e8eaed] shadow-lg">
          {participantLeftMessage}
        </div>
      )}

      <div className="flex-1 p-2 overflow-hidden">
        <div className="relative w-full h-[calc(100vh-96px)] rounded-2xl overflow-hidden bg-black">
          {remoteStream ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white/50">
              {participantLeftMessage
                ? "Waiting for others to join"
                : "Connecting to participant..."}
            </div>
          )}

          <div className="absolute bottom-4 right-4 w-48 sm:w-72 h-32 sm:h-44 rounded-xl overflow-hidden border-2 border-white/20 shadow-lg bg-[#3c4043]">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className={`w-full h-full object-cover ${
                isCameraOn ? "block" : "hidden"
              }`}
            />
            {!isCameraOn && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#3c4043]">
                <div className="h-14 w-14 rounded-full bg-[#8ab4f8] flex items-center justify-center text-xl text-[#202124] font-medium">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              </div>
            )}
            <div className="absolute bottom-2 left-2 text-xs flex items-center gap-1 bg-black/50 px-2 py-0.5 rounded">
              <span>{displayName}</span>
              {!isMicOn && <MicOff className="h-3 w-3 text-red-400" />}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Controls */}
      {/* <div className="h-20 flex items-center justify-between px-6">
       */}
      <div className="h-20 min-h-20 bg-[#202124] z-50 flex items-center justify-between px-6 relative">
        {/* Left */}
        <div className="text-sm text-white/70">
          {currentTime} |
          {" "}
          {meetingCode}
        </div>

        {/* Center */}
        <div className="flex items-center gap-3 z-50">
          {/* MIC */}
          <button
            onClick={() => {
              const stream =
                localStreamRef.current ||
                localStream;

              const next =
                !isMicOn;

              stream
                ?.getAudioTracks()
                .forEach(
                  (track) => {
                    track.enabled =
                      next;
                  }
                );

              setIsMicOn(
                next
              );
            }}
            className={`h-12 w-12 rounded-full flex items-center justify-center ${
              isMicOn
                ? "bg-[#3c4043]"
                : "bg-red-500"
            }`}
          >
            {isMicOn ? (
              <Mic />
            ) : (
              <MicOff />
            )}
          </button>

          {/* CAMERA */}
          <button
            onClick={() => {
              const stream =
                localStreamRef.current ||
                localStream;

              if (!stream)
                return;

              const next =
                !isCameraOn;

              stream
                .getVideoTracks()
                .forEach(
                  (track) => {
                    track.enabled =
                      next;
                  }
                );

              if (
                localVideoRef.current
              ) {
                localVideoRef.current.srcObject =
                  stream;
              }

              setIsCameraOn(
                next
              );
            }}
            className={`h-12 w-12 rounded-full flex items-center justify-center ${
              isCameraOn
                ? "bg-[#3c4043]"
                : "bg-red-500"
            }`}
          >
            {isCameraOn ? (
              <Video />
            ) : (
              <VideoOff />
            )}
          </button>

          {/* SCREEN SHARE */}
          <button
            onClick={async () => {
              try {
                if (
                  isScreenSharing
                )
                  return;

                const displayStream =
                  await navigator.mediaDevices.getDisplayMedia(
                    {
                      video:
                        true,
                    }
                  );

                const screenTrack =
                  displayStream.getVideoTracks()[0];

                const sender =
                  sessionRef.current
                    ?.getPeer()
                    ?.getSenders()
                    .find(
                      (
                        s
                      ) =>
                        s.track
                          ?.kind ===
                        "video"
                    );

                if (
                  sender
                ) {
                  sender.replaceTrack(
                    screenTrack
                  );
                }

                if (
                  localVideoRef.current
                ) {
                  localVideoRef.current.srcObject =
                    displayStream;
                }

                setIsScreenSharing(
                  true
                );

                screenTrack.onended =
                  async () => {
                    const cameraTrack =
                      localStreamRef.current?.getVideoTracks()[0];

                    if (
                      cameraTrack &&
                      sender
                    ) {
                      await sender.replaceTrack(
                        cameraTrack
                      );
                    }

                    if (
                      localVideoRef.current &&
                      localStreamRef.current
                    ) {
                      localVideoRef.current.srcObject =
                        localStreamRef.current;
                    }

                    setIsScreenSharing(
                      false
                    );
                  };
              } catch (
                error
              ) {
                console.error(
                  error
                );
              }
            }}
            className={`h-12 w-12 rounded-full flex items-center justify-center ${
              isScreenSharing
                ? "bg-blue-500"
                : "bg-[#3c4043]"
            }`}
          >
            <MonitorUp />
          </button>

          {/* REACTION */}
          <div
            className="relative"
            ref={emojiRef}
          >
            <button
              onClick={() =>
                setShowEmojiPicker(
                  !showEmojiPicker
                )
              }
              className="h-12 w-12 rounded-full bg-[#3c4043] flex items-center justify-center"
            >
              <Smile />
            </button>

            {showEmojiPicker && (
              <div className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-[#2d2e30] p-3 rounded-xl flex gap-2">
                {REACTIONS.map(
                  (
                    emoji
                  ) => (
                    <button
                      key={
                        emoji
                      }
                      onClick={() =>
                        handleReaction(
                          emoji
                        )
                      }
                    >
                      {emoji}
                    </button>
                  )
                )}
              </div>
            )}
          </div>

          {/* HAND */}
          <button
            onClick={() =>
              setIsHandRaised(
                !isHandRaised
              )
            }
            className={`h-12 w-12 rounded-full flex items-center justify-center ${
              isHandRaised
                ? "bg-yellow-400 text-black"
                : "bg-[#3c4043]"
            }`}
          >
            <Hand />
          </button>

          {/* END */}
          <button
            onClick={handleLeaveMeeting}
            className="h-12 px-6 rounded-full bg-red-500 flex items-center justify-center"
            title="Leave meeting"
          >
            <Phone className="rotate-135" />
          </button>
        </div>

        {/* Right */}
        <div className="flex items-center gap-2 z-50">
          <button className="h-10 w-10 rounded-full hover:bg-[#3c4043] flex items-center justify-center">
            <Info />
          </button>

          <button className="h-10 w-10 rounded-full hover:bg-[#3c4043] flex items-center justify-center">
            <MessageSquare />
          </button>

          <button className="h-10 w-10 rounded-full hover:bg-[#3c4043] flex items-center justify-center">
            <LayoutGrid />
          </button>

          <button className="h-10 w-10 rounded-full hover:bg-[#3c4043] flex items-center justify-center">
            <Users />
          </button>
        </div>
      </div>
    </div>
  );
}
