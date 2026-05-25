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
import {
  createPeerConnection,
  logPeerConnectionState,
} from "../../webrtc/peer";

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

  const isInitializingRef =
    useRef(false);

  const peerRef =
    useRef<RTCPeerConnection | null>(null);

  const localVideoRef =
    useRef<HTMLVideoElement>(null);

  const remoteVideoRef =
    useRef<HTMLVideoElement>(null);

  const pendingCandidatesRef =
    useRef<RTCIceCandidateInit[]>([]);

  const remotePeerIdRef =
    useRef<string | null>(null);

  const remoteStreamRef =
    useRef<MediaStream | null>(null);

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

    remoteStreamRef.current = null;
    remotePeerIdRef.current = null;
    pendingCandidatesRef.current = [];

    peerRef.current?.close();
    peerRef.current = null;
    isInitializingRef.current = false;
  };

  const flushPendingIceCandidates = async (
    peer: RTCPeerConnection
  ) => {
    const candidates = [...pendingCandidatesRef.current];
    pendingCandidatesRef.current = [];

    if (!candidates.length)
      return;

    console.log(
      "[WebRTC] Flushing pending ICE candidates count:",
      candidates.length
    );
    for (const candidate of candidates) {
      try {
        await peer.addIceCandidate(candidate);
        console.log(
          "[WebRTC] Successfully flushed ICE candidate:",
          candidate.candidate?.substring(0, 50)
        );
      } catch (error) {
        console.warn(
          "[WebRTC] Error flushing pending ICE candidate:",
          error
        );
      }
    }
  };

  const logPeerState = (label: string) => {
    if (!peerRef.current) {
      console.log(`[WebRTC:${label}] Peer not initialized`);
      return;
    }
    const peer = peerRef.current;
    const state = {
      label,
      connectionState: peer.connectionState,
      iceConnectionState: peer.iceConnectionState,
      iceGatheringState: peer.iceGatheringState,
      signalingState: peer.signalingState,
      remoteDescriptionType: peer.remoteDescription?.type,
      localDescriptionType: peer.localDescription?.type,
      senders: peer.getSenders().length,
      receivers: peer.getReceivers().length,
      pendingCandidates: pendingCandidatesRef.current.length,
    };
    console.log(`[WebRTC:${label}]`, state);
  };

  // =========================
  // SOCKET EVENTS
  // =========================

  useEffect(() => {
    if (!meetingCode) return;

    const createAndSendOffer = async (targetId?: string) => {
      const peer = peerRef.current;
      console.log("[WebRTC] createAndSendOffer", {
        peer: !!peer,
        targetId,
        signalingState: peer?.signalingState,
      });
      logPeerState("before-createOffer");

      if (!peer) return;
      if (peer.signalingState !== "stable") {
        console.warn("[WebRTC] Skipping offer because signaling state is not stable:", peer.signalingState);
        return;
      }

      try {
        const offer =
          await peer.createOffer();
        console.log("[WebRTC] Created offer");
        logPeerState("after-createOffer");

        await peer.setLocalDescription(
          offer
        );
        console.log("[WebRTC] Set local description (offer)");
        logPeerState("after-setLocalDescription-offer");

        socket.emit("offer", {
          roomId: meetingCode,
          offer,
          targetId,
        });
        console.log("[WebRTC] Sent offer to peer", { targetId });
      } catch (error) {
        console.error("[WebRTC] Error creating/sending offer:", error);
        logPeerState("error-createAndSendOffer");
      }
    };

    const handleExistingMembers = async (
      data: {
        members?: string[];
      }
    ) => {
      const targetId = data.members?.[0];
      console.log("[WebRTC] existing-members received", {
        members: data.members,
        targetId,
      });

      if (!targetId) return;
      remotePeerIdRef.current = targetId;
      await createAndSendOffer(targetId);
    };

    const handleUserJoined = (data: { socketId?: string }) => {
      if (data.socketId) {
        remotePeerIdRef.current = data.socketId;
      }

      console.log("[WebRTC] user-joined received", {
        socketId: data.socketId,
        remotePeerId: remotePeerIdRef.current,
      });
      logPeerState("user-joined-received");
    };

    const handleOffer = async (
      data: {
        offer: RTCSessionDescriptionInit;
        senderId?: string;
      }
    ) => {
      const peer = peerRef.current;
      if (data.senderId) {
        remotePeerIdRef.current = data.senderId;
      }

      console.log("[WebRTC] handleOffer received", {
        peer: !!peer,
        senderId: data.senderId,
        state: peer?.signalingState,
      });
      logPeerState("offer-received");

      if (!peer) return;

      try {
        if (peer.signalingState !== "stable") {
          console.warn("[WebRTC] Unexpected signaling state for offer:", peer.signalingState);
        }

        await peer.setRemoteDescription(
          data.offer
        );
        console.log("[WebRTC] Set remote description (offer)");
        logPeerState("after-setRemoteDescription-offer");

        await flushPendingIceCandidates(peer);
        logPeerState("after-flush-candidates-offer");

        const answer =
          await peer.createAnswer();
        console.log("[WebRTC] Created answer");
        logPeerState("after-createAnswer");

        await peer.setLocalDescription(
          answer
        );
        console.log("[WebRTC] Set local description (answer)");
        logPeerState("after-setLocalDescription-answer");

        socket.emit("answer", {
          roomId: meetingCode,
          answer,
          targetId: remotePeerIdRef.current,
        });
        console.log("[WebRTC] Sent answer to peer", { targetId: remotePeerIdRef.current });
      } catch (error) {
        console.error("[WebRTC] Error in handleOffer:", error);
        logPeerState("error-handleOffer");
      }
    };

    const handleAnswer = async (
      data: {
        answer: RTCSessionDescriptionInit;
        senderId?: string;
      }
    ) => {
      const peer = peerRef.current;
      if (data.senderId) {
        remotePeerIdRef.current = data.senderId;
      }

      console.log("[WebRTC] handleAnswer received", {
        peer: !!peer,
        senderId: data.senderId,
        state: peer?.signalingState,
      });
      logPeerState("answer-received");

      if (!peer) return;

      try {
        if (peer.signalingState !== "have-local-offer") {
          console.warn("[WebRTC] Unexpected signaling state for answer:", peer.signalingState);
        }

      await peer.setRemoteDescription(
        data.answer
      );
        console.log("[WebRTC] Set remote description (answer)");
        logPeerState("after-setRemoteDescription-answer");

        await flushPendingIceCandidates(peer);
        logPeerState("after-flush-candidates-answer");
      } catch (error) {
        console.error("[WebRTC] Error in handleAnswer:", error);
        logPeerState("error-handleAnswer");
      }
    };

    const handleIceCandidate = async (
      data: {
        candidate: RTCIceCandidateInit;
        senderId?: string;
      }
    ) => {
      const peer = peerRef.current;
      if (data.senderId) {
        remotePeerIdRef.current = data.senderId;
      }

      if (
        !peer ||
        !data?.candidate
      )
        return;

      try {
        if (peer.remoteDescription && peer.remoteDescription.type) {
          console.log("[WebRTC] Adding ICE candidate immediately", {
            candidate: data.candidate.candidate?.substring(0, 50),
          });
          await peer.addIceCandidate(data.candidate);
          console.log("[WebRTC] ICE candidate added successfully");
        } else {
          pendingCandidatesRef.current.push(
            data.candidate
          );
          console.log(
            "[WebRTC] Queued ICE candidate until remote description is ready"
          );
        }
      } catch (error) {
        console.warn("[WebRTC] Error adding ICE candidate:", error);
      }
    };

    const handleUserLeft = (data: { socketId?: string }) => {
      console.log("[WebRTC] user-left event received from:", data.socketId);
      if (data.socketId && data.socketId === remotePeerIdRef.current) {
        console.log("[WebRTC] Cleaning up remote peer connection since they left");
        remotePeerIdRef.current = null;
        remoteStreamRef.current = null;
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = null;
        }
        if (peerRef.current) {
          peerRef.current.close();
          peerRef.current = null;
        }
        isInitializingRef.current = false;
        // Re-initialize peer connection so we are ready for another user to connect
        if (localStreamRef.current) {
          console.log("[WebRTC] Re-initializing meeting room to wait for new peers");
          initializeMeeting(localStreamRef.current);
        }
      }
    };

    socket.on(
      "existing-members",
      handleExistingMembers
    );

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

    socket.on(
      "user-left",
      handleUserLeft
    );

    return () => {
      socket.off(
        "existing-members",
        handleExistingMembers
      );

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

      socket.off(
        "user-left",
        handleUserLeft
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

    // Prevent recreating peer on parallel runs/re-renders
    if (peerRef.current || isInitializingRef.current) {
      console.log("[WebRTC] Peer already initialized or initializing, skipping re-creation");
      return;
    }
    isInitializingRef.current = true;

    console.log("[WebRTC] Creating new peer connection...");
    let peer;
    try {
      peer = await createPeerConnection();
    } catch (error) {
      console.error("[WebRTC] Failed to create RTCPeerConnection:", error);
      isInitializingRef.current = false;
      return;
    }

    logPeerConnectionState(peer, "created");

    peerRef.current = peer;
    console.log("[WebRTC] Peer connection created and stored in ref");

    peer.ontrack = (event) => {
      const [remoteStreamFromEvent] = event.streams;
      const remoteStream =
        remoteStreamFromEvent ||
        remoteStreamRef.current ||
        new MediaStream();

      if (!remoteStream.getTracks().some((track) => track.id === event.track.id)) {
        remoteStream.addTrack(event.track);
      }

      remoteStreamRef.current = remoteStream;

      console.log("[WebRTC] ontrack fired", {
        trackKind: event.track.kind,
        trackReadyState: event.track.readyState,
        tracks: remoteStream.getTracks().map((t) => ({
          kind: t.kind,
          enabled: t.enabled,
          readyState: t.readyState,
        })),
        streamId: remoteStream.id,
      });
      logPeerState("ontrack");

      if (remoteVideoRef.current) {
        // Force re-binding remoteStream to video element so newly added tracks are recognized
        remoteVideoRef.current.srcObject = remoteStream;
        console.log("[WebRTC] Remote stream attached/updated on video element");
        logPeerState("remote-stream-attached");

        remoteVideoRef.current.onloadedmetadata = () => {
          console.log("[WebRTC] Remote video loadedmetadata fired");
          remoteVideoRef.current?.play().catch((error) => {
            console.warn("[WebRTC] Remote video play from metadata failed:", error);
          });
        };

        const playPromise = remoteVideoRef.current.play?.();
        if (playPromise) {
          playPromise.catch((error) => {
            console.warn("[WebRTC] Remote video play direct failed:", error);
          });
        }
      } else {
        console.warn("[WebRTC] Remote video ref not available");
      }
    };

    peer.onicecandidate = (
      event
    ) => {
      if (event.candidate) {
        console.log("[WebRTC] ICE candidate generated", {
          candidate: event.candidate.candidate?.substring(0, 50),
          sdpMLineIndex: event.candidate.sdpMLineIndex,
        });
        socket.emit(
          "ice-candidate",
          {
            roomId: meetingCode,
            candidate:
              event.candidate,
            targetId: remotePeerIdRef.current,
          }
        );
      } else {
        console.log("[WebRTC] ICE gathering complete");
      }
    };

    peer.onconnectionstatechange = () => {
      console.log("[WebRTC] Connection state changed", {
        connectionState: peer.connectionState,
        iceConnectionState: peer.iceConnectionState,
        signalingState: peer.signalingState,
      });
      logPeerState("connection-state-changed");

      if (peer.connectionState === "failed") {
        console.error("[WebRTC] Peer connection failed. ICE state:", peer.iceConnectionState);
        logPeerState("connection-failed");
      }

      if (peer.connectionState === "connected") {
        console.log("[WebRTC] Peer connection established successfully");
        logPeerState("connection-established");
      }
    };

    peer.oniceconnectionstatechange = () => {
      console.log("[WebRTC] ICE connection state changed", {
        iceConnectionState: peer.iceConnectionState,
        iceGatheringState: peer.iceGatheringState,
      });
      logPeerState("ice-connection-state-changed");
    };

    stream
      .getTracks()
      .forEach((track) => {
        console.log("[WebRTC] Adding local track", { kind: track.kind, enabled: track.enabled });
        peer.addTrack(
          track,
          stream
        );
      });
    console.log("[WebRTC] All local tracks added");
    logPeerState("after-addTrack");

    socket.emit(
      "join-room",
      { roomId: meetingCode }
    );
    console.log("[WebRTC] Emitted join-room to backend");
    logPeerState("after-join-room");
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
      { roomId: meetingCode }
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

      socket.off(
        "user-left"
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
