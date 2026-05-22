import { io } from "socket.io-client";

export const socket = io(
  // "http://localhost:5000",
  "http://192.168.1.5:5000",
  {
    transports: ["websocket"],
  }
);