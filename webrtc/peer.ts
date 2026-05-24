import { getIceServers, FALLBACK_TURN_SERVER } from "./ice-servers";

export const createPeerConnection = () => {
  // Start with STUN servers; TURN is added server-side if available
  const iceServers = [
    {
      urls: "stun:stun.l.google.com:19302",
    },
    {
      urls: "stun:stun1.l.google.com:19302",
    },
    {
      urls: "stun:stun2.l.google.com:19302",
    },
    // Optional: Add fallback TURN for testing (replace with production credentials)
    // FALLBACK_TURN_SERVER,
  ];

  return new RTCPeerConnection({
    iceServers,
  });
};

export const logPeerConnectionState = (peer: RTCPeerConnection, label: string) => {
  if (typeof window !== "undefined") {
    const state = {
      connectionState: peer.connectionState,
      iceConnectionState: peer.iceConnectionState,
      iceGatheringState: peer.iceGatheringState,
      signalingState: peer.signalingState,
      senders: peer.getSenders().length,
      receivers: peer.getReceivers().length,
    };
    console.log(`[WebRTC:${label}]`, state);
  }
};