import { MicOff, ScreenShare } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Participant } from "@/types/meeting";

type ParticipantTileProps = {
  participant: Participant;
  stream?: MediaStream;
  pinned?: boolean;
  speaking?: boolean;
};

export function ParticipantTile({
  participant,
  pinned = false,
  speaking = false,
}: ParticipantTileProps) {
  const initial = participant.displayName.charAt(0).toUpperCase() || "?";

  return (
    <article
      className={cn(
        "relative flex min-h-48 overflow-hidden rounded-lg bg-[#303134] text-white",
        "transition-shadow",
        pinned && "ring-2 ring-[#8ab4f8]",
        speaking && "shadow-[0_0_0_3px_#34a853]"
      )}
    >
      <div className="flex flex-1 items-center justify-center bg-[#862a41]">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#d93a64] text-4xl">
          {initial}
        </div>
      </div>

      {participant.screenSharing && (
        <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-[#1a73e8] px-3 py-1 text-xs">
          <ScreenShare className="h-3.5 w-3.5" />
          Presenting
        </div>
      )}

      {!participant.micEnabled && (
        <div className="absolute right-3 top-3 rounded-full bg-black/40 p-2">
          <MicOff className="h-4 w-4" />
        </div>
      )}

      <div className="absolute bottom-3 left-3 rounded bg-black/35 px-2 py-1 text-sm">
        {participant.displayName}
      </div>
    </article>
  );
}
