import { ColorInput } from "@/components/shared/color-input";
import { Button } from "@/components/ui/button";
import { useCanvasStore } from "@/store";
import { EyeIcon, EyeOffIcon, SectionHeader } from "./shared";

export function PageProperties() {
  const canvasBackground = useCanvasStore((s) => s.canvasBackground);
  const setCanvasBackground = useCanvasStore((s) => s.setCanvasBackground);
  const canvasBackgroundVisible = useCanvasStore((s) => s.canvasBackgroundVisible);
  const setCanvasBackgroundVisible = useCanvasStore((s) => s.setCanvasBackgroundVisible);

  return (
    <div className="flex h-full flex-col gap-0 text-foreground text-xs">
      <div className="flex h-10 shrink-0 items-center justify-between border-b px-3 font-medium">
        <span className="truncate">Page</span>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto overflow-x-hidden p-2">
        <div className="flex flex-col gap-3 p-3">
          <SectionHeader title="Background" />
          <div className="flex items-center gap-2">
            <ColorInput className="flex-1" value={canvasBackground} onChange={(hex) => setCanvasBackground(hex)} />
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={() => setCanvasBackgroundVisible(!canvasBackgroundVisible)}
            >
              {canvasBackgroundVisible ? <EyeIcon /> : <EyeOffIcon />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
