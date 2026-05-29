import type { Socket } from "socket.io-client";
import { PEER_CONNECTION_CONFIG } from "./config";

type MeetingMember = {
  socketId: string;
  displayName: string;
  email?: string;
  image?: string;
  isMicOn: boolean;
  isCameraOn: boolean;
  isScreenSharing?: boolean;
  isHandRaised?: boolean;
  isHost: boolean;
};

type HostChangedPayload = {
  hostId: string;
  hostDetails?: MeetingMember;
};

type ChatPayload = {
  senderId: string;
  senderName: string;
  message: string;
  timestamp: number;
};

type EmojiPayload = {
  senderId: string;
  emoji: string;
};

export type MeetingSessionCallbacks = {
  onWaitingRoom?: () => void;
  onJoinApproved?: (members: MeetingMember[], isHost: boolean) => void;
  onJoinDenied?: (reason: string) => void;
  onRemoteStreamAdded: (
    socketId: string,
    stream: MediaStream,
    displayName: string,
    details?: Partial<MeetingMember>
  ) => void;
  onParticipantJoined?: (member: MeetingMember) => void;
  onRemoteStreamRemoved: (socketId: string) => void;
  onRemoteStatusChanged?: (data: {
    socketId: string;
    isMicOn: boolean;
    isCameraOn: boolean;
    isHandRaised?: boolean;
    displayName?: string;
    email?: string;
    image?: string;
  }) => void;
  onJoinRequest?: (data: { socketId: string, displayName: string, email?: string, image?: string }) => void;
  onJoinRequestCancelled?: (data: { socketId: string }) => void;
  onHostChanged?: (data: HostChangedPayload) => void;
  onReceiveMessage?: (data: ChatPayload) => void;
  onEmojiReaction?: (data: EmojiPayload) => void;
  onScreenShareStarted?: (senderId: string) => void;
  onScreenShareStopped?: (senderId: string) => void;
  onHandRaisedChanged?: (data: { senderId: string; isHandRaised: boolean }) => void;
  onKicked?: () => void;
};

export class MeetingPeerSession {
  private peers = new Map<string, RTCPeerConnection>();
  private remoteStreams = new Map<string, MediaStream>();
  private remoteDisplayNames = new Map<string, string>();
  private remoteDetails = new Map<string, Partial<MeetingMember>>();
  private pendingRemoteIce = new Map<string, RTCIceCandidateInit[]>();
  private iceServers: RTCIceServer[] = [];
  
  private isStarting = false;
  private isSessionActive = false;
  private screenShareStream: MediaStream | null = null;
  private localCameraVideoTrack: MediaStreamTrack | null = null;
  private localMicAudioTrack: MediaStreamTrack | null = null;

  constructor(
    private readonly roomId: string,
    private readonly socket: Socket,
    private readonly localStream: MediaStream,
    private readonly callbacks: MeetingSessionCallbacks
  ) {}

  isActive(): boolean {
    return this.isSessionActive;
  }

  getPeer(socketId: string): RTCPeerConnection | null {
    return this.peers.get(socketId) || null;
  }

  getPeersMap(): Map<string, RTCPeerConnection> {
    return this.peers;
  }

  async start(identity: {
    displayName: string;
    email?: string;
    image?: string;
    token?: string;
    isMicOn?: boolean;
    isCameraOn?: boolean;
  }): Promise<void> {
    if (this.isSessionActive || this.isStarting) {
      console.log("[WebRTC:Mesh] Session already active or starting");
      return;
    }

    this.isStarting = true;

    try {
      await this.waitForSocket();

      // Use the static configured STUN servers
      this.iceServers = PEER_CONNECTION_CONFIG.iceServers || [{ urls: "stun:stun.l.google.com:19302" }];

      // Bind dynamic signaling socket events
      this.bindSocketEvents();

      // Ask to join room
      this.socket.emit("join-request", { roomId: this.roomId, ...identity });
      console.log("[WebRTC:Mesh] join-request emitted for:", identity.displayName);

      this.isSessionActive = true;
    } finally {
      this.isStarting = false;
    }
  }

  /** Store local tracks so we can restore after screen share stops */
  setLocalCameraVideoTrack(track: MediaStreamTrack | null): void {
    this.localCameraVideoTrack = track;
  }

  setLocalMicAudioTrack(track: MediaStreamTrack | null): void {
    this.localMicAudioTrack = track;
  }

  /** Replace outbound video with screen track on every peer (Google Meet style) */
  async startScreenShare(stream: MediaStream): Promise<void> {
    this.screenShareStream = stream;
    const screenTrack = stream.getVideoTracks()[0];
    const screenAudioTrack = stream.getAudioTracks()[0];
    if (!screenTrack) {
      console.warn("[WebRTC:Mesh] Screen share stream has no video track");
      return;
    }

    for (const [socketId, peer] of this.peers.entries()) {
      try {
        const videoSender = peer
          .getSenders()
          .find((s) => s.track?.kind === "video");
        if (videoSender) {
          await videoSender.replaceTrack(screenTrack);
        } else {
          peer.addTrack(screenTrack, stream);
        }
        if (screenAudioTrack) {
          const audioSender = peer
            .getSenders()
            .find((s) => s.track?.kind === "audio");
          if (audioSender) {
            await audioSender.replaceTrack(screenAudioTrack);
          } else {
            peer.addTrack(screenAudioTrack, stream);
          }
        }
        await this.sendOffer(socketId);
      } catch (err) {
        console.error(`[WebRTC:Mesh] Screen share replaceTrack failed for ${socketId}:`, err);
      }
    }

    this.socket.emit("screen-share-started", { roomId: this.roomId });
  }

  /** Restore camera video on all peers and notify room */
  async stopScreenShare(): Promise<void> {
    if (!this.screenShareStream) return;

    this.screenShareStream.getTracks().forEach((track) => track.stop());

    for (const [socketId, peer] of this.peers.entries()) {
      try {
        const videoSender = peer
          .getSenders()
          .find((s) => s.track?.kind === "video");
        if (videoSender) {
          await videoSender.replaceTrack(this.localCameraVideoTrack);
        }
        const audioSender = peer
          .getSenders()
          .find((s) => s.track?.kind === "audio");
        if (audioSender && this.localMicAudioTrack) {
          await audioSender.replaceTrack(this.localMicAudioTrack);
        }
        await this.sendOffer(socketId);
      } catch (err) {
        console.error(`[WebRTC:Mesh] Restore camera after screen share failed for ${socketId}:`, err);
      }
    }

    this.screenShareStream = null;
    this.socket.emit("screen-share-stopped", { roomId: this.roomId });
  }

  // Host approval and removal triggers
  approveJoin(socketId: string): void {
    this.socket.emit("approve-join", { roomId: this.roomId, socketId });
  }

  denyJoin(socketId: string): void {
    this.socket.emit("deny-join", { roomId: this.roomId, socketId });
  }

  removeParticipant(socketId: string): void {
    this.socket.emit("remove-participant", { roomId: this.roomId, socketId });
  }

  sendChatMessage(message: string, displayName: string): void {
    this.socket.emit("send-message", {
      roomId: this.roomId,
      message,
      senderName: displayName,
    });
  }

  sendReaction(emoji: string): void {
    this.socket.emit("emoji-reaction", { roomId: this.roomId, emoji });
  }

  sendStatusUpdate(isMicOn: boolean, isCameraOn: boolean): void {
    this.socket.emit("status-update", {
      roomId: this.roomId,
      isMicOn,
      isCameraOn,
    });
  }

  sendRaiseHandUpdate(isHandRaised: boolean): void {
    this.socket.emit("raise-hand", {
      roomId: this.roomId,
      isHandRaised,
    });
  }

  destroy(): void {
    this.isSessionActive = false;
    this.socket.emit("leave-room", { roomId: this.roomId });
    this.unregisterSocketEvents();

    for (const [socketId] of this.peers) {
      this.removePeer(socketId);
    }

    this.peers.clear();
    this.remoteStreams.clear();
    this.remoteDisplayNames.clear();
    this.remoteDetails.clear();
    this.pendingRemoteIce.clear();
    this.screenShareStream = null;
  }

  private getOrCreatePeer(socketId: string, displayName: string): RTCPeerConnection {
    if (this.peers.has(socketId)) {
      return this.peers.get(socketId)!;
    }

    console.log(`[WebRTC:Mesh] Creating RTCPeerConnection for peer: ${socketId} (${displayName})`);
    const peer = new RTCPeerConnection({
      iceServers: this.iceServers,
      iceTransportPolicy: process.env.NEXT_PUBLIC_FORCE_TURN === "true" ? "relay" : "all",
    });

    this.peers.set(socketId, peer);
    this.remoteDisplayNames.set(socketId, displayName);

    // Bind WebRTC track events
    peer.ontrack = (event) => {
      console.log(`[WebRTC:Mesh] ontrack event from ${socketId} for ${event.track.kind}`);
      let stream = event.streams[0];
      if (!stream) {
        stream = this.remoteStreams.get(socketId) || new MediaStream();
        if (!stream.getTracks().some((t) => t.id === event.track.id)) {
          stream.addTrack(event.track);
        }
      }
      this.remoteStreams.set(socketId, stream);
      this.callbacks.onRemoteStreamAdded(
        socketId,
        stream,
        displayName,
        this.remoteDetails.get(socketId)
      );
    };

    // ICE trickle
    peer.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit("ice-candidate", {
          roomId: this.roomId,
          candidate: event.candidate.toJSON(),
          targetId: socketId,
        });
      }
    };

    // Auto cleanup failed peers
    peer.onconnectionstatechange = () => {
      console.log(`[WebRTC:Mesh] Connection with ${socketId} is now ${peer.connectionState}`);
      if (peer.connectionState === "failed" || peer.connectionState === "closed") {
        this.removePeer(socketId);
      }
    };

    // Add local tracks (camera / mic)
    this.localStream.getTracks().forEach((track) => {
      peer.addTrack(track, this.localStream);
      console.log(`[WebRTC:Mesh] Added local track (${track.kind}) to peer ${socketId}`);
    });

    // If already presenting, replace outbound tracks (avoid duplicate video senders)
    if (this.screenShareStream) {
      const screenTrack = this.screenShareStream.getVideoTracks()[0];
      const screenAudioTrack = this.screenShareStream.getAudioTracks()[0];
      const videoSender = peer.getSenders().find((s) => s.track?.kind === "video");
      if (videoSender && screenTrack) {
        void videoSender.replaceTrack(screenTrack);
      }
      if (screenAudioTrack) {
        const audioSender = peer.getSenders().find((s) => s.track?.kind === "audio");
        if (audioSender) {
          void audioSender.replaceTrack(screenAudioTrack);
        }
      }
    }

    return peer;
  }

  private removePeer(socketId: string): void {
    const peer = this.peers.get(socketId);
    if (peer) {
      peer.close();
      this.peers.delete(socketId);
    }
    this.remoteStreams.delete(socketId);
    this.remoteDisplayNames.delete(socketId);
    this.remoteDetails.delete(socketId);
    this.pendingRemoteIce.delete(socketId);
    this.callbacks.onRemoteStreamRemoved(socketId);
    console.log(`[WebRTC:Mesh] Removed peer and streams for: ${socketId}`);
  }

  private async sendOffer(targetId: string): Promise<void> {
    const peer = this.peers.get(targetId);
    if (!peer) return;

    try {
      const offer = await peer.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      await peer.setLocalDescription(offer);

      this.socket.emit("offer", {
        roomId: this.roomId,
        offer: peer.localDescription,
        targetId,
      });
      console.log(`[WebRTC:Mesh] Offer sent to → ${targetId}`);
    } catch (err) {
      console.error(`[WebRTC:Mesh] Error sending offer to ${targetId}:`, err);
    }
  }

  private bindSocketEvents(): void {
    // 1. Waiting room / Approval events
    this.socket.on("waiting-room", () => {
      console.log("[WebRTC:Mesh] waiting-room event received");
      this.callbacks.onWaitingRoom?.();
    });

    this.socket.on("join-approved", async (data: { isHost: boolean, members: MeetingMember[] }) => {
      console.log("[WebRTC:Mesh] join-approved event received. Members count:", data.members.length);
      this.callbacks.onJoinApproved?.(data.members, data.isHost);

      // We are the joiner: initiate offers to all existing members
      for (const m of data.members) {
        if (m.socketId !== this.socket.id) {
          this.remoteDetails.set(m.socketId, m);
          this.getOrCreatePeer(m.socketId, m.displayName);
          await this.sendOffer(m.socketId);
        }
      }
    });

    this.socket.on("join-denied", (data: { reason: string }) => {
      console.log("[WebRTC:Mesh] join-denied received:", data.reason);
      this.callbacks.onJoinDenied?.(data.reason);
    });

    this.socket.on("removed-from-meeting", () => {
      console.log("[WebRTC:Mesh] Kicked out from meeting by host");
      this.callbacks.onKicked?.();
    });

    // 2. Mesh participant joins/leaves
    this.socket.on("participant-joined", (details: MeetingMember) => {
      console.log("[WebRTC:Mesh] participant-joined event from:", details.socketId);
      if (details.socketId === this.socket.id) return;
      // Wait for their offer - we don't start the peer connection here to avoid simultaneous double connections
      this.remoteDisplayNames.set(details.socketId, details.displayName);
      this.remoteDetails.set(details.socketId, details);
      this.callbacks.onParticipantJoined?.(details);
    });

    this.socket.on("participant-left", (data: { socketId: string }) => {
      console.log("[WebRTC:Mesh] participant-left event from:", data.socketId);
      if (data.socketId === this.socket.id) return;
      this.removePeer(data.socketId);
    });

    // 3. WebRTC mesh signaling
    this.socket.on("offer", async (data: { offer: RTCSessionDescriptionInit, senderId: string }) => {
      console.log(`[WebRTC:Mesh] Offer received from ← ${data.senderId}`);
      if (data.senderId === this.socket.id) return;
      const knownDetails = this.remoteDetails.get(data.senderId);
      const displayName =
        this.remoteDisplayNames.get(data.senderId) ||
        knownDetails?.email ||
        knownDetails?.displayName ||
        "Signed-in user";
      const peer = this.getOrCreatePeer(data.senderId, displayName);

      try {
        await peer.setRemoteDescription(new RTCSessionDescription(data.offer));
        await this.flushRemoteIce(data.senderId);

        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);

        this.socket.emit("answer", {
          roomId: this.roomId,
          answer: peer.localDescription,
          targetId: data.senderId,
        });
        console.log(`[WebRTC:Mesh] Answer sent back to → ${data.senderId}`);
      } catch (err) {
        console.error(`[WebRTC:Mesh] Error in handleOffer for ${data.senderId}:`, err);
      }
    });

    this.socket.on("answer", async (data: { answer: RTCSessionDescriptionInit, senderId: string }) => {
      console.log(`[WebRTC:Mesh] Answer received from ← ${data.senderId}`);
      if (data.senderId === this.socket.id) return;
      const peer = this.peers.get(data.senderId);
      if (!peer) return;

      try {
        await peer.setRemoteDescription(new RTCSessionDescription(data.answer));
        await this.flushRemoteIce(data.senderId);
      } catch (err) {
        console.error(`[WebRTC:Mesh] Error in handleAnswer for ${data.senderId}:`, err);
      }
    });

    this.socket.on("ice-candidate", async (data: { candidate: RTCIceCandidateInit, senderId: string }) => {
      if (data.senderId === this.socket.id) return;
      const peer = this.peers.get(data.senderId);
      if (!peer) return;

      if (peer.remoteDescription?.type) {
        try {
          await peer.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (err) {
          console.warn(`[WebRTC:Mesh] Failed to add ICE candidate for ${data.senderId}:`, err);
        }
      } else {
        if (!this.pendingRemoteIce.has(data.senderId)) {
          this.pendingRemoteIce.set(data.senderId, []);
        }
        this.pendingRemoteIce.get(data.senderId)!.push(data.candidate);
      }
    });

    // 4. In-meeting broadcasts
    this.socket.on("join-request", (data: { socketId: string, displayName: string, email?: string, image?: string }) => {
      this.callbacks.onJoinRequest?.(data);
    });

    this.socket.on("join-request-cancelled", (data: { socketId: string }) => {
      this.callbacks.onJoinRequestCancelled?.(data);
    });

    this.socket.on("host-changed", (data: HostChangedPayload) => {
      this.callbacks.onHostChanged?.(data);
    });

    this.socket.on("receive-message", (data: ChatPayload) => {
      this.callbacks.onReceiveMessage?.(data);
    });

    this.socket.on("emoji-reaction", (data: EmojiPayload) => {
      this.callbacks.onEmojiReaction?.(data);
    });

    this.socket.on("screen-share-started", (data: { senderId: string }) => {
      this.callbacks.onScreenShareStarted?.(data.senderId);
    });

    this.socket.on("screen-share-stopped", (data: { senderId: string }) => {
      this.callbacks.onScreenShareStopped?.(data.senderId);
    });

    this.socket.on("raise-hand-changed", (data: { senderId: string; isHandRaised: boolean }) => {
      this.callbacks.onHandRaisedChanged?.(data);
    });

    this.socket.on("participant-status-changed", (data: {
      socketId: string;
      isMicOn: boolean;
      isCameraOn: boolean;
      isHandRaised?: boolean;
      displayName?: string;
      email?: string;
      image?: string;
    }) => {
      this.callbacks.onRemoteStatusChanged?.(data);
    });
  }

  private unregisterSocketEvents(): void {
    this.socket.off("waiting-room");
    this.socket.off("join-approved");
    this.socket.off("join-denied");
    this.socket.off("removed-from-meeting");
    this.socket.off("participant-joined");
    this.socket.off("participant-left");
    this.socket.off("offer");
    this.socket.off("answer");
    this.socket.off("ice-candidate");
    this.socket.off("join-request");
    this.socket.off("join-request-cancelled");
    this.socket.off("host-changed");
    this.socket.off("receive-message");
    this.socket.off("emoji-reaction");
    this.socket.off("screen-share-started");
    this.socket.off("screen-share-stopped");
    this.socket.off("raise-hand-changed");
    this.socket.off("participant-status-changed");
  }

  private async flushRemoteIce(socketId: string): Promise<void> {
    const peer = this.peers.get(socketId);
    if (!peer) return;

    const queue = this.pendingRemoteIce.get(socketId) || [];
    this.pendingRemoteIce.delete(socketId);

    for (const candidate of queue) {
      try {
        await peer.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.warn(`[WebRTC:Mesh] ICE queue flush failed for ${socketId}:`, err);
      }
    }
  }

  private waitForSocket(): Promise<void> {
    if (this.socket.connected) return Promise.resolve();

    return new Promise((resolve) => {
      const onConnect = () => {
        this.socket.off("connect", onConnect);
        resolve();
      };
      this.socket.on("connect", onConnect);
      setTimeout(() => {
        this.socket.off("connect", onConnect);
        console.warn("[WebRTC:Mesh] Socket connection timeout");
        resolve();
      }, 5000);
    });
  }
}
