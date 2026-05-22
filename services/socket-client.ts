import { io, type Socket } from "socket.io-client";
import type { ChatMessage, MediaState, Participant } from "@/types/meeting";
import { useMeetingStore } from "@/store/meeting-store";

type JoinPayload = {
  meetingCode: string;
  displayName: string;
};

class MeetingSocketClient {
  private socket: Socket | null = null;

  connect() {
    if (this.socket?.connected) {
      return this.socket;
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
    this.socket = io(apiUrl, {
      transports: ["websocket", "polling"],
      withCredentials: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 500,
      reconnectionDelayMax: 3000,
    });

    this.socket.on("connect", () => {
      useMeetingStore.getState().setConnectionState("connected");
    });
    this.socket.on("reconnect_attempt", () => {
      useMeetingStore.getState().setConnectionState("reconnecting");
    });
    this.socket.on("disconnect", () => {
      useMeetingStore.getState().setConnectionState("disconnected");
    });
    this.socket.on("room:presence", ({ participants }: { participants: Participant[] }) => {
      useMeetingStore.getState().setParticipants(participants);
    });
    this.socket.on("participant:joined", (participant: Participant) => {
      useMeetingStore.getState().upsertParticipant(participant);
    });
    this.socket.on("participant:left", ({ participantId }: { participantId: string }) => {
      useMeetingStore.getState().removeParticipant(participantId);
    });
    this.socket.on(
      "participant:media-state",
      ({ participantId, media }: { participantId: string; media: Partial<MediaState> }) => {
        useMeetingStore.getState().updateParticipantMedia(participantId, media);
      }
    );
    this.socket.on("chat:message", (message: ChatMessage) => {
      useMeetingStore.getState().addMessage(message);
    });

    return this.socket;
  }

  joinRoom(payload: JoinPayload) {
    const socket = this.connect();
    const token = localStorage.getItem("authToken") || undefined;

    useMeetingStore.getState().setConnectionState("connecting");

    socket.emit(
      "room:join",
      {
        ...payload,
        token,
      },
      (ack: { ok: boolean; error?: string }) => {
        if (!ack.ok) {
          useMeetingStore.getState().setConnectionState("disconnected");
          throw new Error(ack.error || "Unable to join meeting");
        }
      }
    );
  }

  leaveRoom(meetingCode: string) {
    this.socket?.emit("room:leave", { meetingCode });
    this.socket?.disconnect();
    this.socket = null;
  }

  sendMediaState(meetingCode: string, media: Partial<MediaState>) {
    this.socket?.emit("participant:media-state", { meetingCode, media });
  }

  sendChatMessage(meetingCode: string, body: string) {
    this.socket?.emit("chat:message", { meetingCode, body });
  }

  sendReaction(meetingCode: string, emoji: string) {
    this.socket?.emit("reaction:send", { meetingCode, emoji });
  }

  getSocket() {
    return this.socket;
  }
}

export const meetingSocket = new MeetingSocketClient();
