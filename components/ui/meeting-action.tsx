"use client";

import {
  Keyboard,
  VideoIcon,
  Link,
  Plus,
  Calendar,
  Copy,
  X,
  Phone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createMeeting, getMeetingByCode } from "@/lib/api";
import { googleLogin } from "@/services/auth";

export function MeetingActions() {
   const router = useRouter();
  const [meetingCode, setMeetingCode] = useState("");
  const [openDropdown, setOpenDropdown] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const [joining, setJoining] = useState(false);
  const [creatingLater, setCreatingLater] = useState(false);
  const [scheduling, setScheduling] = useState(false);

  const [meetingLink, setMeetingLink] = useState("");

  const handleCreateError = (error: unknown) => {
    const message =
      error instanceof Error ? error.message : "Unable to create meeting.";

    setError(message);

    if (message.toLowerCase().includes("sign in")) {
      googleLogin();
    }
  };

  const getMeetingCode = (data: any) =>
    (data as any)?.meeting?.meetingCode || (data as any)?.meetingCode || (data as any)?.code;

  const buildMeetingLink = (code: string) =>
    `${window.location.origin}/meeting/${code}`;

  const handleCopyMeetingLink = async () => {
    if (!meetingLink) return;

    try {
      await navigator.clipboard.writeText(meetingLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Unable to copy meeting link.");
    }
  };

  const handleCreateForLater = async () => {
    try {
      setCreatingLater(true);
      setError("");

      const data = await createMeeting();
      const code = getMeetingCode(data) || "";
      const link = buildMeetingLink(code);
      setMeetingLink(link);
      setShowModal(true);
    } catch (err) {
      handleCreateError(err);
    } finally {
      setCreatingLater(false);
    }
  };

  const handleInstantMeeting = async () => {
    try {
      setCreatingLater(true);
      setError("");
      const data = await createMeeting({ instant: true } as any);
      const code = getMeetingCode(data) || "";
      router.push(`/meeting/${code}`);
    } catch (err) {
      handleCreateError(err);
    } finally {
      setCreatingLater(false);
    }
  };

  const handleScheduleInCalendar = () => {
    setScheduling(true);
    window.open("https://calendar.google.com", "_blank");
    setScheduling(false);
  };

  const handleJoinMeeting = async () => {
    if (!meetingCode.trim()) return;
    setJoining(true);
    setError("");
    try {
      const res = await getMeetingByCode(meetingCode.trim());
      const code = getMeetingCode(res) || meetingCode.trim();
      router.push(`/meeting/${code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to join meeting.");
    } finally {
      setJoining(false);
    }
  };

  

  if (joining) {
    return (
      <div className="fixed inset-0 bg-white flex flex-col items-center justify-center z-[999]">

        <div className="animate-spin rounded-full h-14 w-14 border-4 border-blue-500 border-t-transparent" />

        <h2 className="mt-5 text-2xl font-medium">
          Joining...
        </h2>
      </div>
    );
  }



  return (
    <>
      <div className="flex items-center gap-2">

        {/* NEW MEETING */}
        <div className="relative">

          <div className="rounded-full border-2 border-[#1a73e8] p-[2px]">

            <Button
              onClick={() =>
                setOpenDropdown(!openDropdown)
              }
              className="h-12 rounded-full bg-[#1a73e8] px-3 text-white"
            >
              <VideoIcon className="h-5 w-5 mr-2" />
              New meeting
            </Button>

          </div>

          {openDropdown && (
            <div className="absolute left-0 top-16 z-50 w-[300px] rounded-2xl border bg-white p-2 shadow-xl">

              {/* CREATE LATER */}

              <div
                onClick={handleCreateForLater}
                className="flex cursor-pointer items-center gap-4 rounded-xl p-3 hover:bg-gray-100"
              >
                <Link className="h-5 w-5" />

                <span>
                  {creatingLater ? "Creating link..." : "Create a meeting for later"}
                </span>
              </div>

              {/* INSTANT */}

               <div
      onClick={handleInstantMeeting}
      className="flex cursor-pointer items-center gap-4 rounded-xl p-3 hover:bg-gray-100"
    >
      <Plus className="h-5 w-5" />

      <span>
        Start an instant meeting
      </span>
    </div>

              {/* CALENDAR */}

              <div
                onClick={handleScheduleInCalendar}
                className="flex cursor-pointer items-center gap-4 rounded-xl p-3 hover:bg-gray-100"
              >

                <Calendar className="h-5 w-5" />

                <span>
                  {scheduling ? "Scheduling..." : "Schedule in Google Calendar"}
                </span>

              </div>
            </div>
          )}
        </div>

        {/* INPUT */}

        <div className="relative">
          <div className="absolute inset-y-0 left-3 flex items-center">

            <Keyboard className="h-5 w-5 text-gray-500" />

          </div>

          <Input
            type="text"
            placeholder="Enter a code or nickname"
            value={meetingCode}
            onChange={(e) =>
              setMeetingCode(e.target.value)
            }
            className="h-12 w-[240px] pl-10"
          />
        </div>

       <Button
  variant="ghost"
  disabled={!meetingCode.trim()}
  onClick={handleJoinMeeting}
>
  Join
</Button>
      </div>

      {error && (
        <p className="mt-3 text-sm text-[#d93025]" role="alert">
          {error}
        </p>
      )}

      {/* MODAL */}

   {showModal && (
  <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/30">
    <div className="relative w-[420px] max-w-[calc(100vw-32px)] rounded-[28px] bg-[#f1f3f4] p-5 shadow-2xl">
      
      {/* Close */}
      <button
        onClick={() => setShowModal(false)}
        className="absolute right-5 top-5 rounded-full p-1 text-[#5f6368] hover:bg-black/5"
      >
        <X size={22} />
      </button>

      {/* Heading */}
      <h2 className="text-[20px] font-normal text-[#202124]">
        Here's your joining info
      </h2>

      {/* Description */}
      <p className="mt-4 text-[15px] leading-6 text-[#5f6368]">
        Send this to people you want to meet with.
        <br />
        Be sure to save it so you can use it later,
        <br />
        too.
      </p>

      {/* Info Card */}
      <div className="mt-5 rounded-[24px] bg-[#e8eaed] p-5">
        
        {/* Meeting Link */}
        <div className="flex items-start justify-between">
          <span className="max-w-[280px] break-all text-[18px] text-[#202124]">
            {meetingLink}
          </span>

          <button
            onClick={handleCopyMeetingLink}
            className="relative rounded-full p-2 text-[#5f6368] hover:bg-black/5"
            aria-label="Copy meeting link"
          >
            <Copy size={22} />
            {copied && (
              <span className="absolute right-0 top-10 rounded-md bg-[#202124] px-2 py-1 text-xs text-white shadow-lg">
                Copied
              </span>
            )}
          </button>
        </div>

        {/* Dial In */}
        <div className="mt-8">
          <p className="text-[15px] text-[#202124]">
            Dial-in: (US) +1 813-435-1527
          </p>

          <p className="mt-2 text-[15px] text-[#202124]">
            PIN: 617 403 022#
          </p>
        </div>

        {/* More phone numbers */}
        <button className="mt-8 flex items-center gap-3 text-[#1a73e8] hover:underline">
          <Phone size={18} />
          <span className="text-[16px]">
            More phone numbers
          </span>
        </button>

        {/* Share full details */}
        <button className="mt-8 flex items-center gap-3 text-[#1a73e8] hover:underline">
          <svg
            width="18"
            height="18"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <path d="M8.59 13.51L15.42 17.49M15.41 6.51L8.59 10.49" />
          </svg>

          <span className="text-[16px]">
            Share full details
          </span>
        </button>
      </div>
    </div>
  </div>
)}
    </>
  );
}
