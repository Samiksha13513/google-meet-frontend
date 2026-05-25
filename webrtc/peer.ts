import { PEER_CONNECTION_CONFIG } from "./config";

export function createPeerConnection(): RTCPeerConnection {
  console.log("[WebRTC] Creating peer connection (STUN only, no Twilio)");
  return new RTCPeerConnection(PEER_CONNECTION_CONFIG);
}

export function logPeerConnectionState(
  peer: RTCPeerConnection,
  label: string
): void {
  console.log(`[WebRTC:${label}]`, {
    connectionState: peer.connectionState,
    iceConnectionState: peer.iceConnectionState,
    iceGatheringState: peer.iceGatheringState,
    signalingState: peer.signalingState,
    senders: peer.getSenders().length,
    receivers: peer.getReceivers().length,
  });
}
