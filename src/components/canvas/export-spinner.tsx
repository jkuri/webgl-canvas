import { useEffect, useState } from "react";
import { FoilLogo } from "@/components/ui/foil-logo";
import { useCanvasStore } from "@/store";

const EXPORT_TIMEOUT = 300;

export function ExportSpinner() {
  const isExporting = useCanvasStore((s) => s.isExporting);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    if (isExporting) {
      setVisible(true);
    } else {
      timeout = setTimeout(() => {
        setVisible(false);
      }, EXPORT_TIMEOUT);
    }

    return () => clearTimeout(timeout);
  }, [isExporting]);

  if (!visible) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="fade-in zoom-in-95 flex animate-in flex-col items-center gap-4 duration-200">
        <div className="relative">
          <FoilLogo className="size-12 animate-pulse" />
        </div>

        <div className="flex flex-col items-center gap-2">
          <span className="font-medium text-foreground text-sm tracking-wide">Exporting...</span>
          <span className="text-muted-foreground text-xs">Please wait while we generate your file</span>
        </div>
      </div>
    </div>
  );
}
