"use client";

type HandLowerToastProps = {
  onKeepRaised: () => void;
};

export function HandLowerToast({ onKeepRaised }: HandLowerToastProps) {
  return (
    <div className="pointer-events-auto fixed bottom-28 left-4 z-50 max-w-[min(420px,calc(100vw-32px))] animate-fade-in sm:left-6">
      <div className="rounded-xl bg-[#3c4043] px-4 py-3.5 text-sm leading-5 text-white shadow-lg ring-1 ring-white/10">
        It sounds like you&apos;ve said something, so your hand will be lowered.{" "}
        <button
          type="button"
          onClick={onKeepRaised}
          className="font-medium text-[#8ab4f8] underline-offset-2 transition-colors duration-[150ms] hover:text-[#aecbfa] hover:underline"
        >
          Keep it raised
        </button>
      </div>
    </div>
  );
}
