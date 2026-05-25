import type { Socket } from "socket.io-client";

import { createPeerConnection, logPeerConnectionState } from "./peer";

export type MeetingSessionCallbacks = {
  onRemoteStream: (stream: MediaStream) => void;
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
};

/**
 * One RTCPeerConnection per client for 1:1 meetings.
 * Signaling: Socket.IO offer / answer / ICE relayed by the backend.
 */
export class MeetingPeerSession {
  private peer: RTCPeerConnection | null = null;
  private remotePeerId: string | null = null;
  private remoteStream: MediaStream | null = null;
  private readonly pendingRemoteIce: RTCIceCandidateInit[] = [];
  private readonly pendingOutgoingIce: RTCIceCandidateInit[] = [];
  private pendingOfferTarget: string | null = null;
  private isStarting = false;
  private hasJoinedRoom = false;

  constructor(
    private readonly roomId: string,
    private readonly socket: Socket,
    private readonly localStream: MediaStream,
    private readonly callbacks: MeetingSessionCallbacks
  ) {}

  getPeer(): RTCPeerConnection | null {
    return this.peer;
  }

  getRemotePeerId(): string | null {
    return this.remotePeerId;
  }

  isActive(): boolean {
    return this.peer !== null;
  }

  async start(): Promise<void> {
    if (this.peer || this.isStarting) {
      console.log("[WebRTC] Session already active or starting");
      return;
    }

    this.isStarting = true;

    try {
      const peer = createPeerConnection();
      this.peer = peer;
      this.bindPeerEvents(peer);

      this.localStream.getTracks().forEach((track) => {
        peer.addTrack(track, this.localStream);
        console.log("[WebRTC] Added local track", track.kind);
      });

      this.socket.emit("join-room", { roomId: this.roomId });
      this.hasJoinedRoom = true;
      console.log("[WebRTC] join-room emitted", this.roomId);

      await this.processPendingOffer();
      this.flushOutgoingIce();
    } finally {
      this.isStarting = false;
    }
  }

  async onExistingMembers(members: string[]): Promise<void> {
    const targetId = members[0];
    console.log("[WebRTC] existing-members", { members, targetId });
    if (!targetId) return;

    this.setRemotePeerId(targetId);

    if (!this.peer) {
      this.pendingOfferTarget = targetId;
      return;
    }

    await this.sendOffer(targetId);
  }

  onUserJoined(socketId: string): void {
    console.log("[WebRTC] user-joined", socketId);
    this.setRemotePeerId(socketId);
  }

  async onOffer(
    offer: RTCSessionDescriptionInit,
    senderId: string
  ): Promise<void> {
    const peer = this.peer;
    if (!peer) {
      console.warn("[WebRTC] Offer received before peer ready");
      return;
    }

    this.setRemotePeerId(senderId);
    console.log("[WebRTC] offer received", { senderId, state: peer.signalingState });

    try {
      if (peer.signalingState === "have-local-offer") {
        console.log("[WebRTC] Rolling back local offer (glare)");
        await peer.setLocalDescription({ type: "rollback" });
      }

      await peer.setRemoteDescription(new RTCSessionDescription(offer));
      await this.flushRemoteIce(peer);

      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);

      this.socket.emit("answer", {
        roomId: this.roomId,
        answer,
        targetId: this.remotePeerId,
      });
      console.log("[WebRTC] answer sent", { targetId: this.remotePeerId });
      this.flushOutgoingIce();
    } catch (error) {
      console.error("[WebRTC] handleOffer failed", error);
    }
  }

  async onAnswer(
    answer: RTCSessionDescriptionInit,
    senderId: string
  ): Promise<void> {
    const peer = this.peer;
    if (!peer) return;

    this.setRemotePeerId(senderId);
    console.log("[WebRTC] answer received", { senderId, state: peer.signalingState });

    try {
      await peer.setRemoteDescription(new RTCSessionDescription(answer));
      await this.flushRemoteIce(peer);
      this.flushOutgoingIce();
      console.log("[WebRTC] remote description set (answer)");
    } catch (error) {
      console.error("[WebRTC] handleAnswer failed", error);
    }
  }

  async onIceCandidate(
    candidate: RTCIceCandidateInit,
    senderId: string
  ): Promise<void> {
    const peer = this.peer;
    if (!peer || !candidate) return;

    this.setRemotePeerId(senderId);

    if (peer.remoteDescription?.type) {
      try {
        await peer.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.warn("[WebRTC] addIceCandidate failed", error);
      }
    } else {
      this.pendingRemoteIce.push(candidate);
      console.log("[WebRTC] Queued remote ICE (no remote description yet)");
    }
  }

  onPeerLeft(socketId: string): void {
    if (this.remotePeerId && socketId !== this.remotePeerId) return;
    console.log("[WebRTC] Remote peer left, closing connection");
    this.closePeerOnly();
  }

  destroy(): void {
    this.closePeerOnly();
    this.remoteStream = null;
    this.remotePeerId = null;
    this.pendingRemoteIce.length = 0;
    this.pendingOutgoingIce.length = 0;
    this.pendingOfferTarget = null;
    this.hasJoinedRoom = false;
  }

  private bindPeerEvents(peer: RTCPeerConnection): void {
    peer.ontrack = (event) => {
      const stream =
        event.streams[0] ?? this.remoteStream ?? new MediaStream();

      if (!stream.getTracks().some((t) => t.id === event.track.id)) {
        stream.addTrack(event.track);
      }

      this.remoteStream = stream;
      console.log("[WebRTC] ontrack", {
        kind: event.track.kind,
        readyState: event.track.readyState,
      });
      this.callbacks.onRemoteStream(stream);
    };

    peer.onicecandidate = (event) => {
      if (!event.candidate) {
        console.log("[WebRTC] ICE gathering complete");
        return;
      }
      this.emitIce(event.candidate.toJSON());
    };

    peer.onconnectionstatechange = () => {
      logPeerConnectionState(peer, "connection-state");
      this.callbacks.onConnectionStateChange?.(peer.connectionState);

      if (peer.connectionState === "failed") {
        console.error("[WebRTC] Connection failed — retry or check network/NAT");
      }
    };

    peer.oniceconnectionstatechange = () => {
      console.log("[WebRTC] ICE state", peer.iceConnectionState);
    };
  }

  private async sendOffer(targetId: string): Promise<void> {
    const peer = this.peer;
    if (!peer) {
      this.pendingOfferTarget = targetId;
      return;
    }

    if (peer.signalingState !== "stable") {
      console.warn("[WebRTC] Skip offer, signalingState:", peer.signalingState);
      return;
    }

    try {
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      this.socket.emit("offer", {
        roomId: this.roomId,
        offer,
        targetId,
      });
      console.log("[WebRTC] offer sent", { targetId });
      this.flushOutgoingIce();
    } catch (error) {
      console.error("[WebRTC] sendOffer failed", error);
    }
  }

  private async processPendingOffer(): Promise<void> {
    if (!this.pendingOfferTarget) return;
    const target = this.pendingOfferTarget;
    this.pendingOfferTarget = null;
    await this.sendOffer(target);
  }

  private setRemotePeerId(socketId: string): void {
    if (this.remotePeerId === socketId) return;
    this.remotePeerId = socketId;
    this.flushOutgoingIce();
  }

  private emitIce(candidate: RTCIceCandidateInit): void {
    if (!this.hasJoinedRoom) {
      this.pendingOutgoingIce.push(candidate);
      return;
    }

    if (!this.remotePeerId) {
      this.pendingOutgoingIce.push(candidate);
      return;
    }

    this.socket.emit("ice-candidate", {
      roomId: this.roomId,
      candidate,
      targetId: this.remotePeerId,
    });
  }

  private flushOutgoingIce(): void {
    if (!this.remotePeerId || !this.hasJoinedRoom) return;

    const queued = [...this.pendingOutgoingIce];
    this.pendingOutgoingIce.length = 0;

    for (const candidate of queued) {
      this.socket.emit("ice-candidate", {
        roomId: this.roomId,
        candidate,
        targetId: this.remotePeerId,
      });
    }

    if (queued.length) {
      console.log("[WebRTC] Flushed outgoing ICE", queued.length);
    }
  }

  private async flushRemoteIce(peer: RTCPeerConnection): Promise<void> {
    const queued = [...this.pendingRemoteIce];
    this.pendingRemoteIce.length = 0;

    for (const candidate of queued) {
      try {
        await peer.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.warn("[WebRTC] flush remote ICE failed", error);
      }
    }
  }

  private closePeerOnly(): void {
    this.peer?.close();
    this.peer = null;
    this.remoteStream = null;
    this.remotePeerId = null;
    this.pendingRemoteIce.length = 0;
    this.pendingOutgoingIce.length = 0;
    this.pendingOfferTarget = null;
  }
}
