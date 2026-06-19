"use client";

type PreviewCanvasProps = {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  visible: boolean;
  className?: string;
};

export function PreviewCanvas({ canvasRef, visible, className = "" }: PreviewCanvasProps) {
  return (
    <canvas
      ref={canvasRef}
      className={[
        "h-full w-full object-cover",
        visible ? "block" : "hidden",
        className,
      ].join(" ")}
      aria-hidden={!visible}
    />
  );
}
