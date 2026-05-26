import type { Socket } from "socket.io-client";
import { PEER_CONNECTION_CONFIG } from "./config";

export type MeetingSessionCallbacks = {
  onWaitingRoom?: () => void;
  onJoinApproved?: (members: any[], isHost: boolean) => void;
  onJoinDenied?: (reason: string) => void;
  onRemoteStreamAdded: (socketId: string, stream: MediaStream, displayName: string) => void;
  onRemoteStreamRemoved: (socketId: string) => void;
  onRemoteStatusChanged?: (socketId: string, isMicOn: boolean, isCameraOn: boolean) => void;
  onJoinRequest?: (data: { socketId: string, displayName: string }) => void;
  onJoinRequestCancelled?: (data: { socketId: string }) => void;
  onHostChanged?: (data: { hostId: string, hostDetails: any }) => void;
  onReceiveMessage?: (data: { senderId: string, senderName: string, message: string, timestamp: number }) => void;
  onEmojiReaction?: (data: { senderId: string, emoji: string }) => void;
  onScreenShareStarted?: (senderId: string) => void;
  onScreenShareStopped?: (senderId: string) => void;
  onKicked?: () => void;
};

export class MeetingPeerSession {
  private peers = new Map<string, RTCPeerConnection>();
  private remoteStreams = new Map<string, MediaStream>();
  private remoteDisplayNames = new Map<string, string>();
  private pendingRemoteIce = new Map<string, RTCIceCandidateInit[]>();
  private iceServers: RTCIceServer[] = [];
  
  private isStarting = false;
  private isSessionActive = false;
  private screenShareStream: MediaStream | null = null;

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

  async start(displayName: string): Promise<void> {
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
      this.socket.emit("join-request", { roomId: this.roomId, displayName });
      console.log("[WebRTC:Mesh] join-request emitted for:", displayName);

      this.isSessionActive = true;
    } finally {
      this.isStarting = false;
    }
  }

  // Add a screen sharing stream and propagate to all mesh peers
  async startScreenShare(stream: MediaStream): Promise<void> {
    this.screenShareStream = stream;

    for (const [socketId, peer] of this.peers.entries()) {
      try {
        stream.getTracks().forEach((track) => {
          peer.addTrack(track, stream);
        });
        await this.sendOffer(socketId);
      } catch (err) {
        console.error(`[WebRTC:Mesh] Error adding screen-share track for ${socketId}:`, err);
      }
    }

    this.socket.emit("screen-share-started", { roomId: this.roomId });
  }

  // Stop screen sharing and notify all mesh peers
  async stopScreenShare(): Promise<void> {
    if (!this.screenShareStream) return;

    const tracks = this.screenShareStream.getTracks();
    tracks.forEach((track) => track.stop());

    for (const [socketId, peer] of this.peers.entries()) {
      try {
        const senders = peer.getSenders();
        for (const sender of senders) {
          if (sender.track && tracks.some((t) => t.id === sender.track!.id)) {
            peer.removeTrack(sender);
          }
        }
        await this.sendOffer(socketId);
      } catch (err) {
        console.error(`[WebRTC:Mesh] Error removing screen-share track for ${socketId}:`, err);
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
      this.callbacks.onRemoteStreamAdded(socketId, stream, displayName);
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

    // Add screen share tracks if currently active
    if (this.screenShareStream) {
      this.screenShareStream.getTracks().forEach((track) => {
        peer.addTrack(track, this.screenShareStream!);
        console.log(`[WebRTC:Mesh] Added screen-share track (${track.kind}) to peer ${socketId}`);
      });
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

    this.socket.on("join-approved", async (data: { isHost: boolean, members: any[] }) => {
      console.log("[WebRTC:Mesh] join-approved event received. Members count:", data.members.length);
      this.callbacks.onJoinApproved?.(data.members, data.isHost);

      // We are the joiner: initiate offers to all existing members
      for (const m of data.members) {
        if (m.socketId !== this.socket.id) {
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
    this.socket.on("participant-joined", (details: any) => {
      console.log("[WebRTC:Mesh] participant-joined event from:", details.socketId);
      // Wait for their offer - we don't start the peer connection here to avoid simultaneous double connections
      this.remoteDisplayNames.set(details.socketId, details.displayName);
    });

    this.socket.on("participant-left", (data: { socketId: string }) => {
      console.log("[WebRTC:Mesh] participant-left event from:", data.socketId);
      this.removePeer(data.socketId);
    });

    // 3. WebRTC mesh signaling
    this.socket.on("offer", async (data: { offer: RTCSessionDescriptionInit, senderId: string }) => {
      console.log(`[WebRTC:Mesh] Offer received from ← ${data.senderId}`);
      const displayName = this.remoteDisplayNames.get(data.senderId) || "Participant";
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
    this.socket.on("join-request", (data: { socketId: string, displayName: string }) => {
      this.callbacks.onJoinRequest?.(data);
    });

    this.socket.on("join-request-cancelled", (data: { socketId: string }) => {
      this.callbacks.onJoinRequestCancelled?.(data);
    });

    this.socket.on("host-changed", (data: { hostId: string, hostDetails: any }) => {
      this.callbacks.onHostChanged?.(data);
    });

    this.socket.on("receive-message", (data: any) => {
      this.callbacks.onReceiveMessage?.(data);
    });

    this.socket.on("emoji-reaction", (data: any) => {
      this.callbacks.onEmojiReaction?.(data);
    });

    this.socket.on("screen-share-started", (data: { senderId: string }) => {
      this.callbacks.onScreenShareStarted?.(data.senderId);
    });

    this.socket.on("screen-share-stopped", (data: { senderId: string }) => {
      this.callbacks.onScreenShareStopped?.(data.senderId);
    });

    this.socket.on("participant-status-changed", (data: { socketId: string, isMicOn: boolean, isCameraOn: boolean }) => {
      this.callbacks.onRemoteStatusChanged?.(data.socketId, data.isMicOn, data.isCameraOn);
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
