import { WifiOff } from "lucide-react";

type ReconnectOverlayProps = {
  visible: boolean;
};

export function ReconnectOverlay({ visible }: ReconnectOverlayProps) {
  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 top-4 z-[1000] mx-auto flex w-fit items-center gap-3 rounded-full bg-[#202124] px-4 py-2 text-sm text-white shadow-lg">
      <WifiOff className="h-4 w-4 text-[#fdd663]" />
      Reconnecting to the meeting...
    </div>
    
  );
}
