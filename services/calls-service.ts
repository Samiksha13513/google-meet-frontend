import { apiFetch } from "@/services/http";

export type ContactUser = {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  createdAt?: string;
};

export type RecentContact = {
  id: string;
  lastInteractionAt: string;
  user: ContactUser;
};

export type ContactsResponse = {
  success: boolean;
  recentContacts: RecentContact[];
  users: ContactUser[];
};

export type CallHistoryItem = {
  id: string;
  meetingCode?: string | null;
  callType: "outgoing" | "incoming" | "missed" | string;
  status: string;
  startedAt: string;
  endedAt?: string | null;
  duration?: number | null;
  createdAt: string;
  otherUser: ContactUser;
};

export type CallHistoryResponse = {
  success: boolean;
  items: CallHistoryItem[];
  total: number;
};

export type VideoCallResponse = {
  success: boolean;
  meetingCode: string;
};

export function getContacts(query = "") {
  const params = query ? `?q=${encodeURIComponent(query)}` : "";
  return apiFetch<ContactsResponse>(`/calls/contacts${params}`);
}

export function getCallHistory() {
  return apiFetch<CallHistoryResponse>("/calls/history?perPage=40");
}

export function startVideoCall(receiverId: string) {
  return apiFetch<VideoCallResponse>("/calls/video-call", {
    method: "POST",
    body: JSON.stringify({ receiverId }),
  });
}
