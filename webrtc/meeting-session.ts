import type { Socket } from "socket.io-client";
import { PEER_CONNECTION_CONFIG } from "./config";
import { isScreenTrackAlive } from "./screen-share";
import { getStreamTrackSignature, stopMediaStream } from "./stream-utils";

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
  id?: string;
  senderId: string;
  senderName: string;
  senderEmail?: string;
  senderImage?: string;
  message: string;
  timestamp: number;
};

type EmojiPayload = {
  senderId: string;
  senderUserId?: string | null;
  emoji: string;
  timestamp?: number;
  senderName?: string;
  senderEmail?: string;
  senderImage?: string;
};

export type MeetingSessionCallbacks = {
  onWaitingRoom?: () => void;
  onAlreadyInMeeting?: () => void;
  onJoinApproved?: (members: MeetingMember[], isHost: boolean) => void;
  onChatHistory?: (messages: ChatPayload[]) => void;
  onJoinDenied?: (reason: string) => void;
  onRemoteStreamAdded: (
    socketId: string,
    stream: MediaStream,
    displayName: string,
    details?: Partial<MeetingMember>
  ) => void;
  onParticipantJoined?: (member: MeetingMember) => void;
  onParticipantSwitched?: (data: { previousSocketId: string; member: MeetingMember }) => void;
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
  /** Local screen capture ended (browser UI, track timeout, or health check). */
  onLocalScreenShareEnded?: () => void;
  onHandRaisedChanged?: (data: { senderId: string; isHandRaised: boolean }) => void;
  onKicked?: () => void;
  onForceSwitched?: () => void;
  onMeetingEnded?: (data: { reason?: string }) => void;
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
  private peerCleanupHandlers = new Map<string, Array<() => void>>();
  private peerDisconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private screenShareMonitorTimer: ReturnType<typeof setInterval> | null = null;
  private isStoppingScreenShare = false;
  private remoteStreamSignatures = new Map<string, string>();
  private streamCompositionListeners = new Set<string>();
  private pendingOffers = new Set<string>();
  private offerDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private offerFlushResolvers: Array<() => void> = [];
  private joinIdentity: {
    displayName: string;
    email?: string;
    image?: string;
    token?: string;
    clientId?: string;
    isMicOn?: boolean;
    isCameraOn?: boolean;
  } | null = null;
  private lastSocketId = "";
  private readonly handleSocketConnect = () => {
    if (!this.isSessionActive || !this.joinIdentity) return;
    if (this.socket.id === this.lastSocketId) return;

    console.log("[WebRTC:Mesh] socket reconnected, restoring meeting session");
    this.lastSocketId = this.socket.id || "";
    for (const [socketId] of [...this.peers.keys()]) {
      this.removePeer(socketId);
    }
    this.socket.emit("join-request", { roomId: this.roomId, ...this.joinIdentity });
  };

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
    clientId?: string;
    isMicOn?: boolean;
    isCameraOn?: boolean;
  }): Promise<void> {
    if (this.isSessionActive || this.isStarting) {
      console.log("[WebRTC:Mesh] Session already active or starting");
      return;
    }

    this.isStarting = true;
    this.joinIdentity = identity;

    try {
      await this.waitForSocket();
      this.lastSocketId = this.socket.id || "";

      // Use the static configured STUN servers
      this.iceServers = PEER_CONNECTION_CONFIG.iceServers || [{ urls: "stun:stun.l.google.com:19302" }];

      // Bind dynamic signaling socket events
      this.bindSocketEvents();

      await this.waitForInitialLocalTracks(identity);

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

  async replaceLocalTrack(kind: "audio" | "video", track: MediaStreamTrack | null): Promise<void> {
    const oldTrack =
      kind === "audio" ? this.localMicAudioTrack : this.localCameraVideoTrack;

    if (kind === "audio") {
      this.localMicAudioTrack = track;
    } else {
      this.localCameraVideoTrack = track;
    }

    if (oldTrack && oldTrack !== track) {
      this.localStream.removeTrack(oldTrack);
    }
    if (track && !this.localStream.getTracks().some((streamTrack) => streamTrack.id === track.id)) {
      this.localStream.addTrack(track);
    }

    const activeScreenTrack =
      kind === "video"
        ? this.screenShareStream?.getVideoTracks().find((screenTrack) => screenTrack.readyState === "live")
        : this.screenShareStream?.getAudioTracks().find((screenTrack) => screenTrack.readyState === "live");

    for (const [socketId, peer] of this.peers.entries()) {
      if (peer.connectionState === "closed") continue;
      try {
        const sender = this.getSenderByKind(peer, kind);
        const outboundTrack = activeScreenTrack && kind === "video" ? activeScreenTrack : track;

        if (sender) {
          await sender.replaceTrack(outboundTrack);
        } else if (outboundTrack) {
          peer.addTrack(outboundTrack, activeScreenTrack ? this.screenShareStream! : this.localStream);
        }
        this.scheduleOffer(socketId);
      } catch (err) {
        console.error(`[WebRTC:Mesh] ${kind} device replaceTrack failed for ${socketId}:`, err);
      }
    }
    await this.flushPendingOffers();

    if (oldTrack && oldTrack !== track) {
      oldTrack.stop();
    }
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
        const videoSender = this.getSenderByKind(peer, "video");
        if (videoSender) {
          await videoSender.replaceTrack(screenTrack);
        } else {
          peer.addTrack(screenTrack, stream);
        }
        if (screenAudioTrack) {
          const audioSender = this.getSenderByKind(peer, "audio");
          if (audioSender) {
            await audioSender.replaceTrack(screenAudioTrack);
          } else {
            peer.addTrack(screenAudioTrack, stream);
          }
        }
        this.scheduleOffer(socketId);
      } catch (err) {
        console.error(`[WebRTC:Mesh] Screen share replaceTrack failed for ${socketId}:`, err);
      }
    }
    await this.flushPendingOffers();

    this.socket.emit("screen-share-started", { roomId: this.roomId });
    this.startScreenShareMonitor();
  }

  /** Re-apply screen tracks after reconnect / visibility (long meetings). */
  async refreshScreenShareIfActive(): Promise<void> {
    if (!this.screenShareStream || !isScreenTrackAlive(this.screenShareStream)) {
      if (this.screenShareStream) {
        await this.stopScreenShare();
        this.callbacks.onLocalScreenShareEnded?.();
      }
      return;
    }
    await this.applyScreenShareToAllPeers();
  }

  isScreenSharingActive(): boolean {
    return Boolean(this.screenShareStream && isScreenTrackAlive(this.screenShareStream));
  }

  /** Restore camera video on all peers and notify room */
  async stopScreenShare(): Promise<void> {
    if (!this.screenShareStream || this.isStoppingScreenShare) return;
    this.isStoppingScreenShare = true;
    this.stopScreenShareMonitor();

    stopMediaStream(this.screenShareStream);

    for (const [socketId, peer] of this.peers.entries()) {
      try {
        const videoSender = this.getSenderByKind(peer, "video");
        if (videoSender) {
          await videoSender.replaceTrack(this.localCameraVideoTrack);
        }
        const audioSender = this.getSenderByKind(peer, "audio");
        if (audioSender && this.localMicAudioTrack) {
          await audioSender.replaceTrack(this.localMicAudioTrack);
        }
        this.scheduleOffer(socketId);
      } catch (err) {
        console.error(`[WebRTC:Mesh] Restore camera after screen share failed for ${socketId}:`, err);
      }
    }
    await this.flushPendingOffers();

    this.screenShareStream = null;
    this.socket.emit("screen-share-stopped", { roomId: this.roomId });
    this.isStoppingScreenShare = false;
  }

  private async applyScreenShareToAllPeers(): Promise<void> {
    if (!this.screenShareStream) return;
    const screenTrack = this.screenShareStream.getVideoTracks()[0];
    const screenAudioTrack = this.screenShareStream.getAudioTracks()[0];
    if (!screenTrack || screenTrack.readyState === "ended") return;

    for (const [socketId, peer] of this.peers.entries()) {
      if (peer.connectionState === "closed") continue;
      try {
        const videoSender = this.getSenderByKind(peer, "video");
        if (videoSender && videoSender.track?.id !== screenTrack.id) {
          await videoSender.replaceTrack(screenTrack);
          this.scheduleOffer(socketId);
        }
        if (screenAudioTrack) {
          const audioSender = this.getSenderByKind(peer, "audio");
          if (audioSender && audioSender.track?.id !== screenAudioTrack.id) {
            await audioSender.replaceTrack(screenAudioTrack);
            this.scheduleOffer(socketId);
          }
        }
      } catch (err) {
        console.warn(`[WebRTC:Mesh] Screen share refresh failed for ${socketId}:`, err);
      }
    }
  }

  private startScreenShareMonitor(): void {
    this.stopScreenShareMonitor();
    this.screenShareMonitorTimer = setInterval(() => {
      void this.runScreenShareHealthCheck();
    }, 12_000);
  }

  private stopScreenShareMonitor(): void {
    if (this.screenShareMonitorTimer) {
      clearInterval(this.screenShareMonitorTimer);
      this.screenShareMonitorTimer = null;
    }
  }

  private async runScreenShareHealthCheck(): Promise<void> {
    if (!this.screenShareStream) return;
    if (!isScreenTrackAlive(this.screenShareStream)) {
      console.warn("[WebRTC:Mesh] Screen share track ended — stopping share");
      await this.stopScreenShare();
      this.callbacks.onLocalScreenShareEnded?.();
      return;
    }
    await this.applyScreenShareToAllPeers();
    await this.flushPendingOffers();
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

  endMeetingForAll(): void {
    this.socket.emit("end-meeting-for-all", { roomId: this.roomId });
  }

  switchHere(identity: {
    displayName: string;
    email?: string;
    image?: string;
    token?: string;
    clientId?: string;
    isMicOn?: boolean;
    isCameraOn?: boolean;
  }): void {
    this.socket.emit("switch-here", { roomId: this.roomId, ...identity });
  }

  destroy(): void {
    this.isSessionActive = false;
    this.stopScreenShareMonitor();
    for (const timer of this.peerDisconnectTimers.values()) {
      clearTimeout(timer);
    }
    this.peerDisconnectTimers.clear();

    if (this.screenShareStream) {
      stopMediaStream(this.screenShareStream);
      this.screenShareStream = null;
    }

    this.socket.emit("leave-room", { roomId: this.roomId });
    this.unregisterSocketEvents();

    for (const [socketId] of [...this.peers.keys()]) {
      this.removePeer(socketId);
    }

    this.peers.clear();
    this.remoteStreams.clear();
    this.remoteDisplayNames.clear();
    this.remoteDetails.clear();
    this.pendingRemoteIce.clear();
    this.peerCleanupHandlers.clear();
    this.remoteStreamSignatures.clear();
    this.streamCompositionListeners.clear();
    this.clearPendingOffers();
  }

  private scheduleOffer(targetId: string): void {
    this.pendingOffers.add(targetId);
    if (this.offerDebounceTimer) return;
    this.offerDebounceTimer = setTimeout(() => {
      void this.flushPendingOffers();
    }, 80);
  }

  private async flushPendingOffers(): Promise<void> {
    if (this.offerDebounceTimer) {
      clearTimeout(this.offerDebounceTimer);
      this.offerDebounceTimer = null;
    }
    const targets = [...this.pendingOffers];
    this.pendingOffers.clear();
    await Promise.all(targets.map((id) => this.sendOffer(id)));
    const resolvers = this.offerFlushResolvers.splice(0);
    for (const resolve of resolvers) {
      resolve();
    }
  }

  private clearPendingOffers(): void {
    if (this.offerDebounceTimer) {
      clearTimeout(this.offerDebounceTimer);
      this.offerDebounceTimer = null;
    }
    this.pendingOffers.clear();
    this.offerFlushResolvers.splice(0).forEach((resolve) => resolve());
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

    const emitRemoteStreamIfChanged = () => {
      const stream = this.remoteStreams.get(socketId);
      if (!stream) return;
      const signature = getStreamTrackSignature(stream);
      if (this.remoteStreamSignatures.get(socketId) === signature) return;
      this.remoteStreamSignatures.set(socketId, signature);
      this.callbacks.onRemoteStreamAdded(
        socketId,
        stream,
        displayName,
        this.remoteDetails.get(socketId)
      );
    };

    const bindStreamCompositionListeners = (stream: MediaStream) => {
      if (this.streamCompositionListeners.has(socketId)) return;
      this.streamCompositionListeners.add(socketId);
      stream.addEventListener("addtrack", emitRemoteStreamIfChanged);
      stream.addEventListener("removetrack", emitRemoteStreamIfChanged);
      this.addPeerCleanup(socketId, () => {
        stream.removeEventListener("addtrack", emitRemoteStreamIfChanged);
        stream.removeEventListener("removetrack", emitRemoteStreamIfChanged);
        this.streamCompositionListeners.delete(socketId);
      });
    };

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
      bindStreamCompositionListeners(stream);

      const track = event.track;
      const onTrackCompositionChange = () => emitRemoteStreamIfChanged();
      track.addEventListener("ended", onTrackCompositionChange);
      this.addPeerCleanup(socketId, () => {
        track.removeEventListener("ended", onTrackCompositionChange);
      });

      emitRemoteStreamIfChanged();
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

    const onConnectionStateChange = () => {
      const state = peer.connectionState;
      console.log(`[WebRTC:Mesh] Connection with ${socketId} is now ${state}`);
      if (state === "connected") {
        const timer = this.peerDisconnectTimers.get(socketId);
        if (timer) {
          clearTimeout(timer);
          this.peerDisconnectTimers.delete(socketId);
        }
        if (this.screenShareStream) {
          void this.applyScreenShareToAllPeers();
        }
      } else if (state === "disconnected") {
        this.schedulePeerRemoval(socketId, 12_000);
      } else if (state === "failed") {
        void this.tryIceRestart(socketId);
        this.schedulePeerRemoval(socketId, 20_000);
      } else if (state === "closed") {
        this.removePeer(socketId);
      }
    };

    peer.onconnectionstatechange = onConnectionStateChange;

    const onIceConnectionStateChange = () => {
      const iceState = peer.iceConnectionState;
      console.log(`[WebRTC:Mesh] ICE with ${socketId}: ${iceState}`);
      if (iceState === "connected" || iceState === "completed") {
        const timer = this.peerDisconnectTimers.get(socketId);
        if (timer) {
          clearTimeout(timer);
          this.peerDisconnectTimers.delete(socketId);
        }
        if (this.screenShareStream) {
          void this.applyScreenShareToAllPeers();
        }
      } else if (iceState === "disconnected") {
        this.schedulePeerRemoval(socketId, 12_000);
      } else if (iceState === "failed") {
        void this.tryIceRestart(socketId);
      }
    };

    peer.oniceconnectionstatechange = onIceConnectionStateChange;
    this.addPeerCleanup(socketId, () => {
      peer.ontrack = null;
      peer.onicecandidate = null;
      peer.onconnectionstatechange = null;
      peer.oniceconnectionstatechange = null;
    });

    // Add local tracks (camera / mic)
    this.syncCachedLocalTracks();
    this.localStream.getTracks().forEach((track) => {
      peer.addTrack(track, this.localStream);
      console.log(`[WebRTC:Mesh] Added local track (${track.kind}) to peer ${socketId}`);
    });

    // If already presenting, replace outbound tracks (avoid duplicate video senders)
    if (this.screenShareStream) {
      const screenTrack = this.screenShareStream.getVideoTracks()[0];
      const screenAudioTrack = this.screenShareStream.getAudioTracks()[0];
      const videoSender = this.getSenderByKind(peer, "video");
      if (videoSender && screenTrack) {
        void videoSender.replaceTrack(screenTrack);
      }
      if (screenAudioTrack) {
        const audioSender = this.getSenderByKind(peer, "audio");
        if (audioSender) {
          void audioSender.replaceTrack(screenAudioTrack);
        }
      }
    }

    return peer;
  }

  private getSenderByKind(
    peer: RTCPeerConnection,
    kind: "audio" | "video"
  ): RTCRtpSender | null {
    const senderWithTrack = peer.getSenders().find((sender) => sender.track?.kind === kind);
    if (senderWithTrack) return senderWithTrack;

    return (
      peer
        .getTransceivers()
        .find(
          (transceiver) =>
            transceiver.sender.track?.kind === kind ||
            transceiver.receiver.track.kind === kind
        )?.sender || null
    );

  }

  private syncCachedLocalTracks(): void {
    const videoTrack = this.localStream.getVideoTracks().find((track) => track.readyState === "live") || null;
    const audioTrack = this.localStream.getAudioTracks().find((track) => track.readyState === "live") || null;

    if (videoTrack) {
      this.localCameraVideoTrack = videoTrack;
    }
    if (audioTrack) {
      this.localMicAudioTrack = audioTrack;
    }
  }

  private waitForTrackReady(track: MediaStreamTrack | undefined, shouldBeEnabled: boolean): Promise<void> {
    if (!track || track.readyState !== "live" || !shouldBeEnabled || !track.muted) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      let done = false;
      const cleanup = () => {
        track.removeEventListener("unmute", onReady);
        track.removeEventListener("ended", onReady);
      };
      const onReady = () => {
        if (done) return;
        done = true;
        cleanup();
        resolve();
      };

      track.addEventListener("unmute", onReady);
      track.addEventListener("ended", onReady);
      setTimeout(onReady, 1200);
    });
  }

  private async waitForInitialLocalTracks(identity: { isMicOn?: boolean; isCameraOn?: boolean }): Promise<void> {
    this.syncCachedLocalTracks();

    const videoTrack = this.localStream.getVideoTracks()[0];
    const audioTrack = this.localStream.getAudioTracks()[0];

    await Promise.all([
      this.waitForTrackReady(videoTrack, identity.isCameraOn !== false),
      this.waitForTrackReady(audioTrack, identity.isMicOn !== false),
    ]);

    this.syncCachedLocalTracks();
  }

  private addPeerCleanup(socketId: string, cleanup: () => void): void {
    const list = this.peerCleanupHandlers.get(socketId) || [];
    list.push(cleanup);
    this.peerCleanupHandlers.set(socketId, list);
  }

  private runPeerCleanups(socketId: string): void {
    const list = this.peerCleanupHandlers.get(socketId);
    if (list) {
      list.forEach((fn) => {
        try {
          fn();
        } catch {
          // ignore
        }
      });
    }
    this.peerCleanupHandlers.delete(socketId);
  }

  private schedulePeerRemoval(socketId: string, delayMs: number): void {
    const existing = this.peerDisconnectTimers.get(socketId);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      this.peerDisconnectTimers.delete(socketId);
      const peer = this.peers.get(socketId);
      if (
        peer &&
        (peer.connectionState === "disconnected" ||
          peer.connectionState === "failed" ||
          peer.iceConnectionState === "disconnected" ||
          peer.iceConnectionState === "failed")
      ) {
        console.warn(`[WebRTC:Mesh] Removing stale peer ${socketId} after timeout`);
        this.removePeer(socketId);
      }
    }, delayMs);
    this.peerDisconnectTimers.set(socketId, timer);
  }

  private async tryIceRestart(socketId: string): Promise<void> {
    const peer = this.peers.get(socketId);
    if (!peer || peer.connectionState === "closed") return;
    try {
      if (peer.signalingState !== "stable") return;
      const offer = await peer.createOffer({ iceRestart: true });
      await peer.setLocalDescription(offer);
      this.socket.emit("offer", {
        roomId: this.roomId,
        offer: peer.localDescription,
        targetId: socketId,
      });
      console.log(`[WebRTC:Mesh] ICE restart offer sent to ${socketId}`);
    } catch (err) {
      console.warn(`[WebRTC:Mesh] ICE restart failed for ${socketId}:`, err);
    }
  }

  private removePeer(socketId: string): void {
    const timer = this.peerDisconnectTimers.get(socketId);
    if (timer) {
      clearTimeout(timer);
      this.peerDisconnectTimers.delete(socketId);
    }

    this.runPeerCleanups(socketId);

    const remoteStream = this.remoteStreams.get(socketId);
    stopMediaStream(remoteStream);
    this.remoteStreams.delete(socketId);
    this.remoteStreamSignatures.delete(socketId);

    const peer = this.peers.get(socketId);
    if (peer) {
      try {
        peer.close();
      } catch {
        // ignore
      }
      this.peers.delete(socketId);
    }

    this.remoteDisplayNames.delete(socketId);
    this.remoteDetails.delete(socketId);
    this.pendingRemoteIce.delete(socketId);
    this.callbacks.onRemoteStreamRemoved(socketId);
    console.log(`[WebRTC:Mesh] Removed peer and streams for: ${socketId}`);
  }

  private async sendOffer(targetId: string): Promise<void> {
    const peer = this.peers.get(targetId);
    if (!peer || peer.connectionState === "closed") return;
    if (peer.signalingState !== "stable") return;

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
    this.socket.on("connect", this.handleSocketConnect);

    // 1. Waiting room / Approval events
    this.socket.on("waiting-room", () => {
      console.log("[WebRTC:Mesh] waiting-room event received");
      this.callbacks.onWaitingRoom?.();
    });

    this.socket.on("already-in-meeting", () => {
      console.log("[WebRTC:Mesh] already-in-meeting event received");
      this.callbacks.onAlreadyInMeeting?.();
    });

    this.socket.on("join-approved", async (data: { isHost: boolean, members: MeetingMember[], chatHistory?: ChatPayload[] }) => {
      console.log("[WebRTC:Mesh] join-approved event received. Members count:", data.members.length);
      this.callbacks.onChatHistory?.(data.chatHistory || []);
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

    this.socket.on("force-switched", () => {
      console.log("[WebRTC:Mesh] Meeting switched to another session");
      this.callbacks.onForceSwitched?.();
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

    this.socket.on("participant-switched", (data: { previousSocketId: string; member: MeetingMember }) => {
      if (data.member.socketId === this.socket.id) return;
      this.removePeer(data.previousSocketId);
      this.remoteDisplayNames.set(data.member.socketId, data.member.displayName);
      this.remoteDetails.set(data.member.socketId, data.member);
      this.callbacks.onParticipantSwitched?.(data);
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

    this.socket.on("meeting-ended", (data: { reason?: string }) => {
      this.callbacks.onMeetingEnded?.(data);
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
    this.socket.off("connect", this.handleSocketConnect);
    this.socket.off("waiting-room");
    this.socket.off("already-in-meeting");
    this.socket.off("join-approved");
    this.socket.off("join-denied");
    this.socket.off("removed-from-meeting");
    this.socket.off("force-switched");
    this.socket.off("participant-joined");
    this.socket.off("participant-switched");
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
    this.socket.off("meeting-ended");
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
