import type { Socket } from "socket.io-client";

import { createPeerConnection, logPeerConnectionState } from "./peer";

export type MeetingSessionCallbacks = {
  onRemoteStream: (stream: MediaStream) => void;
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
};

type PendingSignal =
  | { type: "members"; members: string[] }
  | { type: "offer"; offer: RTCSessionDescriptionInit; senderId: string }
  | { type: "answer"; answer: RTCSessionDescriptionInit; senderId: string }
  | { type: "ice"; candidate: RTCIceCandidateInit; senderId: string };

/**
 * 1:1 WebRTC session — Socket.IO signaling only (no Twilio).
 *
 * Flow:
 * - First user joins room and waits.
 * - Second user joins, receives existing-members, sends offer.
 * - First user receives offer, sends answer.
 * - ICE trickle both ways, ontrack delivers remote media.
 */
export class MeetingPeerSession {
  private peer: RTCPeerConnection | null = null;
  private remotePeerId: string | null = null;
  private remoteStream: MediaStream | null = null;
  private readonly pendingRemoteIce: RTCIceCandidateInit[] = [];
  private readonly pendingOutgoingIce: RTCIceCandidateInit[] = [];
  private readonly pendingSignals: PendingSignal[] = [];
  private isStarting = false;
  private isReady = false;
  private makingOffer = false;

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
      await this.waitForSocket();

      const peer = createPeerConnection();
      this.peer = peer;
      this.bindPeerEvents(peer);

      for (const track of this.localStream.getTracks()) {
        peer.addTrack(track, this.localStream);
        console.log("[WebRTC] Added local track", track.kind);
      }

      this.socket.emit("join-room", { roomId: this.roomId });
      console.log("[WebRTC] join-room", this.roomId);

      this.isReady = true;
      await this.drainPendingSignals();
      this.flushOutgoingIce();
    } finally {
      this.isStarting = false;
    }
  }

  async onExistingMembers(members: string[]): Promise<void> {
    if (!this.isReady) {
      this.pendingSignals.push({ type: "members", members });
      return;
    }
    await this.handleExistingMembers(members);
  }

  onUserJoined(socketId: string): void {
    console.log("[WebRTC] user-joined", socketId);
    this.setRemotePeerId(socketId);
  }

  async onOffer(
    offer: RTCSessionDescriptionInit,
    senderId: string
  ): Promise<void> {
    if (!this.isReady) {
      this.pendingSignals.push({ type: "offer", offer, senderId });
      return;
    }
    await this.handleOffer(offer, senderId);
  }

  async onAnswer(
    answer: RTCSessionDescriptionInit,
    senderId: string
  ): Promise<void> {
    if (!this.isReady) {
      this.pendingSignals.push({ type: "answer", answer, senderId });
      return;
    }
    await this.handleAnswer(answer, senderId);
  }

  async onIceCandidate(
    candidate: RTCIceCandidateInit,
    senderId: string
  ): Promise<void> {
    if (!this.isReady) {
      this.pendingSignals.push({ type: "ice", candidate, senderId });
      return;
    }
    await this.handleIceCandidate(candidate, senderId);
  }

  onPeerLeft(socketId: string): void {
    if (this.remotePeerId && socketId !== this.remotePeerId) return;
    console.log("[WebRTC] Remote peer left");
    this.closePeerOnly();
  }

  destroy(): void {
    this.isReady = false;
    this.closePeerOnly();
    this.remoteStream = null;
    this.remotePeerId = null;
    this.pendingRemoteIce.length = 0;
    this.pendingOutgoingIce.length = 0;
    this.pendingSignals.length = 0;
    this.makingOffer = false;
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
        console.warn("[WebRTC] Socket connect timeout, continuing anyway");
        resolve();
      }, 8000);
    });
  }

  private async drainPendingSignals(): Promise<void> {
    const queue = [...this.pendingSignals];
    this.pendingSignals.length = 0;

    for (const signal of queue) {
      switch (signal.type) {
        case "members":
          await this.handleExistingMembers(signal.members);
          break;
        case "offer":
          await this.handleOffer(signal.offer, signal.senderId);
          break;
        case "answer":
          await this.handleAnswer(signal.answer, signal.senderId);
          break;
        case "ice":
          await this.handleIceCandidate(signal.candidate, signal.senderId);
          break;
      }
    }
  }

  /** Second joiner: someone is already in the room — we send the offer. */
  private async handleExistingMembers(members: string[]): Promise<void> {
    const targetId = members[0];
    console.log("[WebRTC] existing-members", members);
    if (!targetId) return;

    this.setRemotePeerId(targetId);
    await this.sendOffer(targetId);
  }

  private async handleOffer(
    offer: RTCSessionDescriptionInit,
    senderId: string
  ): Promise<void> {
    const peer = this.peer;
    if (!peer) return;

    this.setRemotePeerId(senderId);
    console.log("[WebRTC] offer received", peer.signalingState);

    try {
      if (peer.signalingState === "have-local-offer") {
        await peer.setLocalDescription({ type: "rollback" });
      }

      await peer.setRemoteDescription(new RTCSessionDescription(offer));
      await this.flushRemoteIce(peer);

      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);

      this.socket.emit("answer", {
        roomId: this.roomId,
        answer: peer.localDescription,
        targetId: senderId,
      });
      console.log("[WebRTC] answer sent →", senderId);
      this.flushOutgoingIce();
    } catch (error) {
      console.error("[WebRTC] handleOffer failed", error);
    }
  }

  private async handleAnswer(
    answer: RTCSessionDescriptionInit,
    senderId: string
  ): Promise<void> {
    const peer = this.peer;
    if (!peer) return;

    this.setRemotePeerId(senderId);

    if (peer.signalingState !== "have-local-offer") {
      console.warn("[WebRTC] Ignoring answer, state:", peer.signalingState);
      return;
    }

    try {
      await peer.setRemoteDescription(new RTCSessionDescription(answer));
      await this.flushRemoteIce(peer);
      this.flushOutgoingIce();
      console.log("[WebRTC] answer applied ←", senderId);
    } catch (error) {
      console.error("[WebRTC] handleAnswer failed", error);
    }
  }

  private async handleIceCandidate(
    candidate: RTCIceCandidateInit,
    senderId: string
  ): Promise<void> {
    const peer = this.peer;
    if (!peer || !candidate?.candidate) return;

    this.setRemotePeerId(senderId);

    if (peer.remoteDescription?.type) {
      try {
        await peer.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.warn("[WebRTC] addIceCandidate failed", error);
      }
    } else {
      this.pendingRemoteIce.push(candidate);
    }
  }

  private bindPeerEvents(peer: RTCPeerConnection): void {
    peer.ontrack = (event) => {
      let stream = event.streams[0];

      if (!stream) {
        stream = this.remoteStream ?? new MediaStream();
        if (!stream.getTracks().some((t) => t.id === event.track.id)) {
          stream.addTrack(event.track);
        }
      }

      this.remoteStream = stream;
      console.log("[WebRTC] ontrack", event.track.kind, event.track.readyState);
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
      logPeerConnectionState(peer, "connection");
      this.callbacks.onConnectionStateChange?.(peer.connectionState);
    };

    peer.oniceconnectionstatechange = () => {
      console.log("[WebRTC] ICE connection:", peer.iceConnectionState);
    };
  }

  private async sendOffer(targetId: string): Promise<void> {
    const peer = this.peer;
    if (!peer || this.makingOffer) return;

    if (peer.signalingState !== "stable") {
      console.warn("[WebRTC] Cannot offer in state", peer.signalingState);
      return;
    }

    this.makingOffer = true;
    this.setRemotePeerId(targetId);

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
      console.log("[WebRTC] offer sent →", targetId);
      this.flushOutgoingIce();
    } catch (error) {
      console.error("[WebRTC] sendOffer failed", error);
    } finally {
      this.makingOffer = false;
    }
  }

  private setRemotePeerId(socketId: string): void {
    if (!socketId) return;
    this.remotePeerId = socketId;
    this.flushOutgoingIce();
  }

  private emitIce(candidate: RTCIceCandidateInit): void {
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
    if (!this.remotePeerId) return;

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
      console.log("[WebRTC] Sent queued ICE:", queued.length);
    }
  }

  private async flushRemoteIce(peer: RTCPeerConnection): Promise<void> {
    const queued = [...this.pendingRemoteIce];
    this.pendingRemoteIce.length = 0;

    for (const candidate of queued) {
      try {
        await peer.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.warn("[WebRTC] Remote ICE flush failed", error);
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
    this.makingOffer = false;
  }
}
