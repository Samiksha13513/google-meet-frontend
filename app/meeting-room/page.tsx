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
import { createPeerConnection } from "../../webrtc/peer";

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
  | "joining"
  | "loading"
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
    useState<MeetingState>("joining");

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

  const [loadingProgress, setLoadingProgress] =
    useState(0);

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

  const localStreamRef =
    useRef<MediaStream | null>(null);

  const peerRef =
    useRef<RTCPeerConnection | null>(null);

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

  const cleanupMedia = () => {
    const stream =
      localStreamRef.current || localStream;

    stream?.getTracks().forEach((track) => {
      track.stop();
    });

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    peerRef.current?.close();
    peerRef.current = null;
  };

  // =========================
  // SOCKET EVENTS
  // =========================

  useEffect(() => {
    if (!meetingCode) return;

    const handleUserJoined = async () => {
      const peer = peerRef.current;

      if (!peer) return;

      const offer =
        await peer.createOffer();

      await peer.setLocalDescription(
        offer
      );

      socket.emit("offer", {
        roomId: meetingCode,
        offer,
      });
    };

    const handleOffer = async (
      data: {
        offer: RTCSessionDescriptionInit;
      }
    ) => {
      const peer = peerRef.current;

      if (!peer) return;

      await peer.setRemoteDescription(
        data.offer
      );

      const answer =
        await peer.createAnswer();

      await peer.setLocalDescription(
        answer
      );

      socket.emit("answer", {
        roomId: meetingCode,
        answer,
      });
    };

    const handleAnswer = async (
      data: {
        answer: RTCSessionDescriptionInit;
      }
    ) => {
      const peer = peerRef.current;

      if (!peer) return;

      await peer.setRemoteDescription(
        data.answer
      );
    };

    const handleIceCandidate = async (
      data: {
        candidate: RTCIceCandidateInit;
      }
    ) => {
      const peer = peerRef.current;

      if (
        !peer ||
        !data?.candidate
      )
        return;

      await peer.addIceCandidate(
        data.candidate
      );
    };

    socket.on(
      "user-joined",
      handleUserJoined
    );

    socket.on("offer", handleOffer);

    socket.on("answer", handleAnswer);

    socket.on(
      "ice-candidate",
      handleIceCandidate
    );

    return () => {
      socket.off(
        "user-joined",
        handleUserJoined
      );

      socket.off("offer", handleOffer);

      socket.off(
        "answer",
        handleAnswer
      );

      socket.off(
        "ice-candidate",
        handleIceCandidate
      );
    };
  }, [meetingCode]);

  // =========================
  // INITIALIZE MEETING
  // =========================

  const initializeMeeting = async (
    stream: MediaStream
  ) => {
    if (!meetingCode) {
      setMeetingError(
        "Meeting code missing"
      );
      return;
    }

    const peer =
      createPeerConnection();

    peerRef.current = peer;

    peer.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject =
          event.streams[0];
      }
    };

    peer.onicecandidate = (
      event
    ) => {
      if (event.candidate) {
        socket.emit(
          "ice-candidate",
          {
            roomId: meetingCode,
            candidate:
              event.candidate,
          }
        );
      }
    };

    peer.onconnectionstatechange =
      () => {
        console.log(
          "Connection State:",
          peer.connectionState
        );
      };

    stream
      .getTracks()
      .forEach((track) => {
        peer.addTrack(
          track,
          stream
        );
      });

    socket.emit(
      "join-room",
      meetingCode
    );
  };

  // =========================
  // REQUEST MEDIA
  // =========================

  async function requestMedia() {
    setPermissionRequested(true);

    try {
      const stream =
        await getLocalStream();

      setLocalStream(stream);

      localStreamRef.current =
        stream;

      setMediaError(null);

      setMeetingState("loading");

      await initializeMeeting(
        stream
      );
    } catch (error) {
      console.error(error);

      const errorMessage =
        error instanceof Error
          ? error.message
          : String(error);

      setMediaError(
        `Unable to access camera and microphone: ${errorMessage}`
      );
    }
  }

  // =========================
  // AUTO JOIN
  // =========================

  useEffect(() => {
    if (!meetingCode) return;

    if (
      meetingState !==
      "joining"
    )
      return;

    requestMedia();
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

  // =========================
  // LOADING
  // =========================

  useEffect(() => {
    if (
      meetingState ===
      "loading"
    ) {
      const interval =
        setInterval(() => {
          setLoadingProgress(
            (prev) => {
              if (prev >= 100) {
                clearInterval(
                  interval
                );

                setMeetingState(
                  "inMeeting"
                );

                return 100;
              }

              return prev + 4;
            }
          );
        }, 100);

      return () =>
        clearInterval(interval);
    }
  }, [meetingState]);

  // Attach local stream when the meeting room is rendered.
  useEffect(() => {
    const stream =
      localStreamRef.current ||
      localStream;

    if (
      !stream ||
      !localVideoRef.current
    ) {
      return;
    }

    localVideoRef.current.srcObject = stream;

    const playPromise =
      localVideoRef.current
        .play?.();

    if (playPromise) {
      playPromise.catch(() => {
        // ignore autoplay playback errors
      });
    }
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

  const handleEndCall = () => {
    cleanupMedia();

    socket.emit(
      "leave-room",
      meetingCode
    );

    setLocalStream(null);

    localStreamRef.current =
      null;

    setIsMicOn(true);

    setIsCameraOn(true);

    setIsScreenSharing(false);

    setMeetingState("ended");
  };

  // =========================
  // REJOIN
  // =========================

  const handleRejoin =
    async () => {
      try {
        socket.connect();

        setMeetingError(null);

        setMediaError(null);

        setLoadingProgress(0);

        await requestMedia();

        setMeetingState(
          "loading"
        );
      } catch (error) {
        console.error(error);
      }
    };

  // =========================
  // UNMOUNT CLEANUP
  // =========================

  useEffect(() => {
    return () => {
      cleanupMedia();

      socket.off(
        "user-joined"
      );

      socket.off("offer");

      socket.off("answer");

      socket.off(
        "ice-candidate"
      );
    };
  }, []);

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

  // =========================
  // JOINING
  // =========================

  if (
    meetingState ===
    "joining"
  ) {
    return (
      <div className="fixed inset-0 bg-[#202124] text-white flex flex-col items-center justify-center">
        <h1 className="text-2xl">
          Joining...
        </h1>

        <button
          onClick={
            requestMedia
          }
          className="mt-6 px-6 py-3 bg-[#8ab4f8] text-black rounded-full"
        >
          Allow camera &
          mic
        </button>

        {permissionRequested &&
          mediaError && (
            <p className="mt-4 text-red-400">
              {mediaError}
            </p>
          )}
      </div>
    );
  }

  // =========================
  // LOADING
  // =========================

  if (
    meetingState ===
    "loading"
  ) {
    return (
      <div className="fixed inset-0 bg-[#202124] text-white flex flex-col items-center justify-center">
        <div className="w-48 h-1 bg-[#3c4043] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#8ab4f8]"
            style={{
              width: `${loadingProgress}%`,
            }}
          />
        </div>

        <p className="mt-4">
          Loading...
        </p>
      </div>
    );
  }

  // =========================
  // ENDED
  // =========================

  if (
    meetingState ===
    "ended"
  ) {
    return (
      <div className="fixed inset-0 bg-[#202124] text-white flex flex-col items-center justify-center">
        <h1 className="text-3xl">
          You left the
          meeting
        </h1>

        <button
          onClick={
            handleRejoin
          }
          className="mt-6 px-6 py-3 bg-[#8ab4f8] text-black rounded-full"
        >
          Rejoin
        </button>
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

      <div className="flex-1 p-2 overflow-hidden">
        {/* <div className="relative w-full h-full rounded-2xl overflow-hidden bg-black"> */}
        <div className="relative w-full h-[calc(100vh-96px)] rounded-2xl overflow-hidden bg-black">
      {/* Main Video */}
          {/* Local Video */}
          <video
            ref={
              localVideoRef
            }
            autoPlay
            muted
            playsInline
            className={`w-full h-full object-cover ${
              isCameraOn
                ? "block"
                : "hidden"
            }`}
          />

          {/* Avatar */}
          {!isCameraOn && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-28 w-28 rounded-full bg-pink-600 flex items-center justify-center text-5xl">
                S
              </div>
            </div>
          )}

          {/* Remote Video */}
          <video
            ref={
              remoteVideoRef
            }
            autoPlay
            playsInline
            muted={false}
            className="absolute bottom-4 right-4 w-72 h-44 rounded-xl object-cover bg-black border border-white/10"
          />

          {/* User */}
          <div className="absolute bottom-4 left-4 flex items-center gap-2">
            <span>
              samiksha yadav
            </span>

            {!isMicOn && (
              <MicOff className="h-4 w-4 text-red-400" />
            )}
          </div>
        </div>
      </div>

      {/* Bottom Controls */}
      {/* <div className="h-20 flex items-center justify-between px-6">
       */}
       <div className="h-20 min-h-[80px] bg-[#202124] z-50 flex items-center justify-between px-6 relative">
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
                  peerRef.current
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
            onClick={
              handleEndCall
            }
            className="h-12 px-6 rounded-full bg-red-500 flex items-center justify-center"
          >
            <Phone className="rotate-[135deg]" />
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