export type MeetingStatus = "SCHEDULED" | "LIVE" | "ENDED" | "CANCELLED";

export type ParticipantRole = "HOST" | "CO_HOST" | "ATTENDEE" | "GUEST";

export type ParticipantStatus =
  | "IN_WAITING_ROOM"
  | "JOINED"
  | "LEFT"
  | "DENIED";

export type MediaState = {
  micEnabled: boolean;
  cameraEnabled: boolean;
  screenSharing: boolean;
  handRaised: boolean;
};

export type Meeting = {
  id: string;
  meetingCode: string;
  title?: string | null;
  status: MeetingStatus;
  hostId: string;
  startsAt?: string | null;
  endedAt?: string | null;
  waitingRoom: boolean;
  joinRestriction: "ANYONE_WITH_LINK" | "SIGNED_IN_ONLY" | "HOST_APPROVAL";
};

export type Participant = MediaState & {
  id: string;
  meetingId: string;
  userId?: string | null;
  displayName: string;
  role: ParticipantRole;
  status: ParticipantStatus;
  socketId?: string | null;
};

export type ChatMessage = {
  id: string;
  meetingId: string;
  senderId?: string | null;
  senderName: string;
  body: string;
  messageType: "TEXT" | "SYSTEM" | "REACTION";
  createdAt: string;
};
