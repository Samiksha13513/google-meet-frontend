import { create } from "zustand";
import type { ChatMessage, MediaState, Participant } from "@/types/meeting";

type ConnectionState = "connected" | "connecting" | "reconnecting" | "disconnected";

interface MeetingStoreState {
  connectionState: ConnectionState;
  participants: Participant[];
  messages: ChatMessage[];
  setConnectionState: (state: ConnectionState) => void;
  setParticipants: (participants: Participant[]) => void;
  upsertParticipant: (participant: Participant) => void;
  removeParticipant: (participantId: string) => void;
  updateParticipantMedia: (participantId: string, media: Partial<MediaState>) => void;
  addMessage: (message: ChatMessage) => void;
}

export const useMeetingStore = create<MeetingStoreState>((set) => ({
  connectionState: "disconnected",
  participants: [],
  messages: [],
  setConnectionState: (connectionState) => set({ connectionState }),
  setParticipants: (participants) => set({ participants }),
  upsertParticipant: (participant) =>
    set((state) => {
      const existingIndex = state.participants.findIndex((item) => item.id === participant.id);
      if (existingIndex !== -1) {
        const participants = [...state.participants];
        participants[existingIndex] = participant;
        return { participants };
      }
      return { participants: [...state.participants, participant] };
    }),
  removeParticipant: (participantId) =>
    set((state) => ({
      participants: state.participants.filter((participant) => participant.id !== participantId),
    })),
  updateParticipantMedia: (participantId, media) =>
    set((state) => ({
      participants: state.participants.map((participant) =>
        participant.id === participantId ? { ...participant, ...media } : participant
      ),
    })),
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
}));
