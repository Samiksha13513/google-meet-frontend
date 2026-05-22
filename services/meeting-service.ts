import { apiFetch } from "@/services/http";
import type { Meeting } from "@/types/meeting";

type MeetingResponse = {
  success: boolean;
  meeting: Meeting;
};

export async function createMeeting(payload?: {
  title?: string;
  startsAt?: string;
  waitingRoom?: boolean;
}) {
  return apiFetch<MeetingResponse>("/meetings/create", {
    method: "POST",
    body: JSON.stringify(payload || {}),
  });
}

export async function getMeetingByCode(meetingCode: string) {
  return apiFetch<MeetingResponse>(
    `/meetings/${encodeURIComponent(meetingCode)}`
  );
}
