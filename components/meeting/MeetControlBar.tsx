"use client";

import type { LucideIcon } from "lucide-react";
import {
  AlignJustify,
  Captions,
  ChevronUp,
  Hand,
  Lock,
  MessageSquare,
  Mic,
  MicOff,
  MonitorUp,
  MoreHorizontal,
  MoreVertical,
  Phone,
  Shield,
  Shapes,
  Smile,
  Users,
  Video,
  VideoOff,
} from "lucide-react";

const REACTIONS = ["👍", "❤️", "😂", "🎉", "👏", "😮"];

type MeetingLayout = "auto" | "tiled" | "spotlight" | "sidebar";

type LayoutOption = {
  id: MeetingLayout;
  label: string;
  icon: LucideIcon;
};

type MeetControlBarProps = {
  currentTime: string;
  meetingDuration: string;
  isMicOn: boolean;
  isCameraOn: boolean;
  isScreenSharing: boolean;
  isHandRaised: boolean;
  isHost: boolean;
  isMeetingLocked: boolean;
  showCaptions: boolean;
  showChat: boolean;
  showParticipantsList: boolean;
  unreadMessages: number;
  screenShareSupported: boolean;
  screenShareReason?: string;
  meetingLayout: MeetingLayout;
  layoutOptions: LayoutOption[];
  showAudioDeviceMenu: boolean;
  showVideoDeviceMenu: boolean;
  showEmojiPicker: boolean;
  showLayoutMenu: boolean;
  showMoreOptionsMenu: boolean;
  audioDeviceMenu: React.ReactNode;
  videoDeviceMenu: React.ReactNode;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleScreenShare: () => void;
  onToggleHandRaise: () => void;
  onToggleCaptions: () => void;
  onToggleChat: () => void;
  onToggleParticipants: () => void;
  onShowMeetingDetails: () => void;
  onLeave: () => void;
  onReaction: (emoji: string) => void;
  onLayoutChange: (layout: MeetingLayout) => void;
  onToggleMeetingLock: () => void;
  setShowAudioDeviceMenu: (open: boolean) => void;
  setShowVideoDeviceMenu: (open: boolean) => void;
  setShowEmojiPicker: (open: boolean) => void;
  setShowLayoutMenu: (open: boolean) => void;
  setShowMoreOptionsMenu: (open: boolean) => void;
  audioDeviceMenuRef: React.RefObject<HTMLDivElement | null>;
  videoDeviceMenuRef: React.RefObject<HTMLDivElement | null>;
  emojiRef: React.RefObject<HTMLDivElement | null>;
  layoutRef: React.RefObject<HTMLDivElement | null>;
  moreOptionsRef: React.RefObject<HTMLDivElement | null>;
};

export function MeetControlBar({
  currentTime,
  meetingDuration,
  isMicOn,
  isCameraOn,
  isScreenSharing,
  isHandRaised,
  isHost,
  isMeetingLocked,
  showCaptions,
  showChat,
  showParticipantsList,
  unreadMessages,
  screenShareSupported,
  screenShareReason,
  meetingLayout,
  layoutOptions,
  showAudioDeviceMenu,
  showVideoDeviceMenu,
  showEmojiPicker,
  showLayoutMenu,
  showMoreOptionsMenu,
  audioDeviceMenu,
  videoDeviceMenu,
  onToggleMic,
  onToggleCamera,
  onToggleScreenShare,
  onToggleHandRaise,
  onToggleCaptions,
  onToggleChat,
  onToggleParticipants,
  onShowMeetingDetails,
  onLeave,
  onReaction,
  onLayoutChange,
  onToggleMeetingLock,
  setShowAudioDeviceMenu,
  setShowVideoDeviceMenu,
  setShowEmojiPicker,
  setShowLayoutMenu,
  setShowMoreOptionsMenu,
  audioDeviceMenuRef,
  videoDeviceMenuRef,
  emojiRef,
  layoutRef,
  moreOptionsRef,
}: MeetControlBarProps) {
  const activeLayout =
    layoutOptions.find((option) => option.id === meetingLayout) || layoutOptions[0];
  const ActiveLayoutIcon = activeLayout.icon;

  const closeOtherMenus = (except?: "audio" | "video" | "emoji" | "layout" | "more") => {
    if (except !== "audio") setShowAudioDeviceMenu(false);
    if (except !== "video") setShowVideoDeviceMenu(false);
    if (except !== "emoji") setShowEmojiPicker(false);
    if (except !== "layout") setShowLayoutMenu(false);
    if (except !== "more") setShowMoreOptionsMenu(false);
  };

  return (
    <div className="relative z-40 flex min-h-[72px] items-center justify-between gap-2 border-t border-white/5 bg-[#202124] px-2 py-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] sm:px-4">
      <div className="hidden min-w-[88px] flex-col text-xs font-light text-white/55 lg:flex">
        <span>{currentTime}</span>
        <span className="mt-0.5 font-mono tracking-wider text-[#8ab4f8]">{meetingDuration}</span>
      </div>

      <div className="mx-auto flex max-w-full items-center gap-1 overflow-x-auto px-1 no-scrollbar sm:gap-1.5">
        <button
          type="button"
          onClick={() => {
            closeOtherMenus("more");
            setShowMoreOptionsMenu(!showMoreOptionsMenu);
          }}
          className={`meet-control-btn h-11 w-11 shrink-0 sm:h-12 sm:w-12 ${showMoreOptionsMenu ? "meet-control-btn-active" : "meet-control-btn-neutral"}`}
          title="More options"
          aria-label="More options"
        >
          <ChevronUp className="h-5 w-5" />
        </button>

        <div className="relative shrink-0" ref={audioDeviceMenuRef}>
          <div className="meet-split-control">
            <button
              type="button"
              onClick={() => {
                closeOtherMenus("audio");
                setShowAudioDeviceMenu(!showAudioDeviceMenu);
              }}
              className="meet-split-btn w-9 sm:w-10"
              title="Microphone settings"
              aria-label="Microphone settings"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            <span className="meet-split-divider" aria-hidden />
            <button
              type="button"
              onClick={onToggleMic}
              className={`meet-split-btn w-11 sm:w-12 ${!isMicOn ? "bg-[#ea4335] hover:bg-[#c5221f]" : ""}`}
              title={isMicOn ? "Turn off microphone (Ctrl+D)" : "Turn on microphone (Ctrl+D)"}
              aria-label={isMicOn ? "Turn off microphone" : "Turn on microphone"}
              aria-pressed={isMicOn}
            >
              {isMicOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
            </button>
            <span className="meet-split-divider" aria-hidden />
            <button
              type="button"
              onClick={() => {
                closeOtherMenus("audio");
                setShowAudioDeviceMenu(!showAudioDeviceMenu);
              }}
              className="meet-split-btn w-8 sm:w-9"
              title="Select microphone and speaker"
              aria-label="Select microphone and speaker"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
          </div>
          {showAudioDeviceMenu && audioDeviceMenu}
        </div>

        <div className="relative shrink-0" ref={videoDeviceMenuRef}>
          <div className="meet-split-control">
            <button
              type="button"
              onClick={() => {
                closeOtherMenus("video");
                setShowVideoDeviceMenu(!showVideoDeviceMenu);
              }}
              className="meet-split-btn w-8 sm:w-9"
              title="Select camera"
              aria-label="Select camera"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
            <span className="meet-split-divider" aria-hidden />
            <button
              type="button"
              onClick={onToggleCamera}
              className={`meet-split-btn w-11 sm:w-12 ${!isCameraOn ? "bg-[#ea4335] hover:bg-[#c5221f]" : ""}`}
              title={isCameraOn ? "Turn off camera (Ctrl+E)" : "Turn on camera (Ctrl+E)"}
              aria-label={isCameraOn ? "Turn off camera" : "Turn on camera"}
              aria-pressed={isCameraOn}
            >
              {isCameraOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
            </button>
          </div>
          {showVideoDeviceMenu && videoDeviceMenu}
        </div>

        <button
          type="button"
          onClick={onToggleScreenShare}
          disabled={!isScreenSharing && !screenShareSupported}
          className={`meet-control-btn h-11 w-11 shrink-0 sm:h-12 sm:w-12 ${isScreenSharing ? "meet-control-btn-active" : "meet-control-btn-neutral"}`}
          title={
            isScreenSharing
              ? "Stop presenting"
              : screenShareSupported
                ? "Present now"
                : screenShareReason || "Present now"
          }
          aria-label={isScreenSharing ? "Stop presenting" : "Present now"}
        >
          <MonitorUp className="h-5 w-5" />
        </button>

        <div className="relative shrink-0" ref={emojiRef}>
          <button
            type="button"
            onClick={() => {
              closeOtherMenus("emoji");
              setShowEmojiPicker(!showEmojiPicker);
            }}
            className={`meet-control-btn h-11 w-11 sm:h-12 sm:w-12 ${showEmojiPicker ? "meet-control-btn-active" : "meet-control-btn-neutral"}`}
            title="Send a reaction"
            aria-label="Send a reaction"
          >
            <Smile className="h-5 w-5" />
          </button>
          {showEmojiPicker && (
            <div className="fixed bottom-24 left-1/2 z-[60] flex -translate-x-1/2 flex-wrap justify-center gap-1 rounded-2xl border border-white/10 bg-[#303134] p-3 shadow-2xl animate-fade-in">
              {REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => onReaction(emoji)}
                  className="flex h-10 w-10 items-center justify-center rounded-full text-2xl transition-all duration-150 hover:scale-110 hover:bg-white/10"
                  title={`Send ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onToggleCaptions}
          className={`meet-control-btn h-11 w-11 shrink-0 sm:h-12 sm:w-12 ${showCaptions ? "meet-control-btn-active" : "meet-control-btn-neutral"}`}
          title={showCaptions ? "Turn off captions" : "Turn on captions"}
          aria-label={showCaptions ? "Turn off captions" : "Turn on captions"}
          aria-pressed={showCaptions}
        >
          <Captions className="h-5 w-5" />
        </button>

        <button
          type="button"
          onClick={onToggleHandRaise}
          className={`meet-control-btn h-11 w-11 shrink-0 sm:h-12 sm:w-12 ${isHandRaised ? "meet-control-btn-active" : "meet-control-btn-neutral"}`}
          title={isHandRaised ? "Lower hand" : "Raise hand (Ctrl+Alt+H)"}
          aria-label={isHandRaised ? "Lower hand" : "Raise hand"}
          aria-pressed={isHandRaised}
        >
          <Hand className="h-5 w-5" />
        </button>

        <div className="relative shrink-0" ref={moreOptionsRef}>
          <button
            type="button"
            onClick={() => {
              closeOtherMenus("more");
              setShowMoreOptionsMenu(!showMoreOptionsMenu);
            }}
            className={`meet-split-control meet-split-control-pill h-11 w-9 sm:h-12 sm:w-10 ${showMoreOptionsMenu ? "ring-2 ring-[#8ab4f8]/60" : ""}`}
            title="More actions"
            aria-label="More actions"
          >
            <MoreVertical className="h-5 w-5" />
          </button>
          {showMoreOptionsMenu && (
            <div className="fixed bottom-20 left-1/2 z-[60] w-56 -translate-x-1/2 rounded-2xl border border-white/10 bg-[#303134] p-2 shadow-2xl animate-fade-in">
              <div className="relative" ref={layoutRef}>
                <button
                  type="button"
                  onClick={() => {
                    closeOtherMenus("layout");
                    setShowLayoutMenu(!showLayoutMenu);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-white/85 transition-colors hover:bg-white/10"
                >
                  <ActiveLayoutIcon className="h-4 w-4 shrink-0" />
                  <span>Layout: {activeLayout.label}</span>
                </button>
                {showLayoutMenu && (
                  <div className="mt-1 border-t border-white/10 pt-1">
                    {layoutOptions.map((option) => {
                      const LayoutIcon = option.icon;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => onLayoutChange(option.id)}
                          className={[
                            "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors",
                            meetingLayout === option.id
                              ? "bg-[#8ab4f8] text-[#202124]"
                              : "text-white/85 hover:bg-white/10",
                          ].join(" ")}
                        >
                          <LayoutIcon className="h-4 w-4 shrink-0" />
                          <span>{option.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              {isHost && (
                <button
                  type="button"
                  onClick={onToggleMeetingLock}
                  className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-white/85 transition-colors hover:bg-white/10"
                >
                  <Lock className="h-4 w-4 shrink-0" />
                  <span>{isMeetingLocked ? "Unlock meeting" : "Lock meeting"}</span>
                </button>
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onLeave}
          className="meet-leave-btn shrink-0"
          title="Leave call"
          aria-label="Leave call"
        >
          <Phone className="h-5 w-5 rotate-[135deg]" />
        </button>
      </div>

      <div className="flex shrink-0 items-center gap-0.5 text-white/70 sm:gap-1">
        <button
          type="button"
          onClick={onShowMeetingDetails}
          className="meet-control-btn h-10 w-10 hover:bg-white/5 sm:h-11 sm:w-11"
          title="Meeting details"
          aria-label="Meeting details"
        >
          <AlignJustify className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={onToggleParticipants}
          className={`meet-control-btn h-10 w-10 sm:h-11 sm:w-11 ${showParticipantsList ? "meet-control-btn-active" : "hover:bg-white/5"}`}
          title="Show everyone"
          aria-label="Show everyone"
          aria-pressed={showParticipantsList}
        >
          <Users className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={onToggleChat}
          className={`meet-control-btn relative h-10 w-10 sm:h-11 sm:w-11 ${showChat ? "meet-control-btn-active" : "hover:bg-white/5"}`}
          title="Chat with everyone"
          aria-label="Chat with everyone"
          aria-pressed={showChat}
        >
          <MessageSquare className="h-5 w-5" />
          {!showChat && unreadMessages > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#8ab4f8] px-1 text-[11px] font-medium text-[#202124] ring-2 ring-[#202124]">
              {unreadMessages > 9 ? "9+" : unreadMessages}
            </span>
          )}
        </button>
        <button
          type="button"
          disabled
          className="meet-control-btn hidden h-10 w-10 opacity-40 sm:flex sm:h-11 sm:w-11"
          title="Activities"
          aria-label="Activities"
        >
          <Shapes className="h-5 w-5" />
        </button>
        {isHost && (
          <button
            type="button"
            onClick={onToggleMeetingLock}
            className={`meet-control-btn hidden h-10 w-10 sm:flex sm:h-11 sm:w-11 ${isMeetingLocked ? "meet-control-btn-active" : "hover:bg-white/5"}`}
            title="Host controls"
            aria-label="Host controls"
          >
            <Shield className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
}
