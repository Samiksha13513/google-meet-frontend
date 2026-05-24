import { getIceServers } from "./ice-servers";

export const createPeerConnection = async () => {
  const defaultTurnUrl =
    process.env.NEXT_PUBLIC_TURN_SERVERS_ENDPOINT ||
    (typeof window !== "undefined"
      ? `${window.location.origin}/api/turn-servers`
      : undefined);

  const iceServers = await getIceServers(defaultTurnUrl);
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