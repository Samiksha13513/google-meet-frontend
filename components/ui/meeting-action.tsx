"use client";

import {
  Keyboard,
  VideoIcon,
  Link,
  Plus,
  Calendar,
  Copy,
  X,
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

  const [joining, setJoining] = useState(false);
  const [creatingLater, setCreatingLater] = useState(false);

  const [meetingLink, setMeetingLink] = useState("");

  const handleCreateError = (error: unknown) => {
    const message =
      error instanceof Error ? error.message : "Unable to create meeting.";

    setError(message);

    if (message.toLowerCase().includes("sign in")) {
      googleLogin();
    }
  };

  const getMeetingCode = (data: {
    meeting?: { meetingCode?: string };
    meetingCode?: string;
  }) => data?.meeting?.meetingCode || data?.meetingCode;

  const buildMeetingLink = (code: string) =>
    `${window.location.origin}/meeting-room/${code}`;

  const handleCreateForLater = async () => {
    try {
      setCreatingLater(true);
      setError("");

      const data = await createMeeting();
      const code = getMeetingCode(data);

      if (code) {
        setMeetingLink(buildMeetingLink(code));
        setShowModal(true);
      }
    } catch (error) {
      handleCreateError(error);
    } finally {
      setCreatingLater(false);
      setOpenDropdown(false);
    }
  };

  const handleInstantMeeting = async () => {
  try {
    setJoining(true);
    setError("");

    const data = await createMeeting();
    const code = getMeetingCode(data);

    console.log(data);

    if (code) {
      router.push(
        `/meeting-room/${code}`
      );
    }

  } catch (error) {
    handleCreateError(error);
  } finally {
    setJoining(false);
  }
};

  const handleJoinMeeting = async () => {
    const code = meetingCode.trim();

    if (!code) {
      return;
    }

    try {
      setError("");
      await getMeetingByCode(code);
      router.push(`/meeting-room/${encodeURIComponent(code)}`);
    } catch (error) {
      let message = "Meeting not found";
      
      if (error instanceof Error) {
        message = error.message;
        // Check if it's an ApiError with status 410 (Gone - meeting expired)
        if ('status' in error && error.status === 410) {
          message = "Meeting has expired. Meeting codes are valid for 24 hours.";
        }
      }
      
      setError(message);
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

              <div className="flex cursor-pointer items-center gap-4 rounded-xl p-3 hover:bg-gray-100">

                <Calendar className="h-5 w-5" />

                <span>
                  Schedule in Google Calendar
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
        <div className="fixed inset-0 z-[999] bg-black/40 flex items-center justify-center">

          <div className="w-[520px] rounded-3xl bg-white p-8 relative shadow-2xl">

            <button
              onClick={() => setShowModal(false)}
              className="absolute right-5 top-5"
            >
              <X />
            </button>

            <h2 className="text-2xl font-semibold">

              Here&apos;s your joining info

            </h2>

            <p className="mt-4 text-gray-600">

              Share this link with people you
              want in the meeting

            </p>

            <div className="mt-6 rounded-xl border p-4 flex items-center justify-between">

              <span className="text-sm">
                {meetingLink}
              </span>

              <Button
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(
                    meetingLink
                  );
                }}
              >
                <Copy className="mr-2 h-4 w-4" />
                Copy
              </Button>

            </div>

            <Button
              onClick={() =>
                setShowModal(false)
              }
              className="mt-6 bg-blue-600"
            >
              Done
            </Button>

          </div>
        </div>
      )}
    </>
  );
}
