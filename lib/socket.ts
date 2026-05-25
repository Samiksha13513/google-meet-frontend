import { io } from "socket.io-client";

const socketUrl =
  process.env.NEXT_PUBLIC_SOCKET_URL ||
  "https://google-meet-q33t.onrender.com";

export const socket = io(socketUrl, {
  transports: ["websocket", "polling"],
  withCredentials: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 500,
  reconnectionDelayMax: 2000,
});