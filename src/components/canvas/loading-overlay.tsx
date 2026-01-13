import { useEffect, useState } from "react";
import { FoilLogo } from "@/components/ui/foil-logo";

interface LoadingOverlayProps {
  isLoading: boolean;
}

export function LoadingOverlay({ isLoading }: LoadingOverlayProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!isLoading) {
      const timer = setTimeout(() => setVisible(false), 400);
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  if (!visible) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <FoilLogo className="size-12 animate-bounce" />
        </div>

        <div className="flex flex-col items-center gap-2">
          <span className="font-medium text-foreground text-sm tracking-wide">Loading foil app</span>
          <span className="text-muted-foreground text-xs">Preparing fonts and resources...</span>
        </div>
      </div>
    </div>
  );
}
