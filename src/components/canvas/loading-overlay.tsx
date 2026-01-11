import { useEffect, useState } from "react";
import { CanvasLogo } from "@/components/ui/canvas-logo";

interface LoadingOverlayProps {
  isLoading: boolean;
}

export function LoadingOverlay({ isLoading }: LoadingOverlayProps) {
  const [visible, setVisible] = useState(true);
  const [opacity, setOpacity] = useState(1);

  useEffect(() => {
    if (!isLoading) {
      // Fade out animation
      setOpacity(0);
      const timer = setTimeout(() => setVisible(false), 400);
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  if (!visible) return null;

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm transition-opacity duration-400"
      style={{ opacity }}
    >
      <div className="flex flex-col items-center gap-8">
        {/* Animated logo */}
        <div className="relative">
          <CanvasLogo className="size-12 animate-pulse text-foreground/80" />
        </div>

        {/* Loading text */}
        <div className="flex flex-col items-center gap-1.5">
          <span className="font-medium text-foreground text-sm tracking-wide">Loading Canvas</span>
          <span className="text-muted-foreground text-xs">Preparing fonts and resources...</span>
        </div>

        {/* Animated dots */}
        <div className="flex items-center gap-2">
          <div
            className="h-1.5 w-1.5 rounded-full bg-foreground/40"
            style={{ animation: "bounce 1.4s ease-in-out infinite", animationDelay: "0s" }}
          />
          <div
            className="h-1.5 w-1.5 rounded-full bg-foreground/40"
            style={{ animation: "bounce 1.4s ease-in-out infinite", animationDelay: "0.2s" }}
          />
          <div
            className="h-1.5 w-1.5 rounded-full bg-foreground/40"
            style={{ animation: "bounce 1.4s ease-in-out infinite", animationDelay: "0.4s" }}
          />
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% {
            transform: translateY(0);
            opacity: 0.4;
          }
          40% {
            transform: translateY(-4px);
            opacity: 0.8;
          }
        }
      `}</style>
    </div>
  );
}
