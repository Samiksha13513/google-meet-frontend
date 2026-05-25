import { getIceServers } from "./ice-servers";

export const createPeerConnection = async () => {
  const apiUrl =
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_SOCKET_URL ||
    "https://google-meet-q33t.onrender.com";

  const defaultTurnUrl =
    process.env.NEXT_PUBLIC_TURN_SERVERS_ENDPOINT ||
    `${apiUrl.replace(/\/$/, "")}/api/twilio-ice`;

  const iceServers = await getIceServers(defaultTurnUrl);
  console.log("[WebRTC] ICE servers loaded", {
    count: iceServers.length,
    hasTurn: iceServers.some((server) => {
      const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
      return urls.some((url) => url.startsWith("turn:") || url.startsWith("turns:"));
    }),
  });

  return new RTCPeerConnection({
    iceServers,
    iceTransportPolicy:
      process.env.NEXT_PUBLIC_FORCE_TURN === "true" ? "relay" : "all",
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
