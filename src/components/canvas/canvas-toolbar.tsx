import { ArrowDown01Icon, Cursor01Icon, FourFinger02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCanvasStore } from "@/store";

const ZOOM_PRESETS = [
  { label: "50%", value: 0.5 },
  { label: "100%", value: 1 },
  { label: "200%", value: 2 },
];

export function CanvasToolbar() {
  const activeTool = useCanvasStore((s) => s.activeTool);
  const setActiveTool = useCanvasStore((s) => s.setActiveTool);
  const transform = useCanvasStore((s) => s.transform);
  const zoomIn = useCanvasStore((s) => s.zoomIn);
  const zoomOut = useCanvasStore((s) => s.zoomOut);
  const zoomTo = useCanvasStore((s) => s.zoomTo);
  const resetView = useCanvasStore((s) => s.resetView);

  const tools = [
    { id: "select" as const, icon: Cursor01Icon, label: "Select", shortcut: "V" },
    { id: "pan" as const, icon: FourFinger02Icon, label: "Pan", shortcut: "H" },
  ];

  return (
    <>
      {/* Bottom-left: Zoom controls */}
      <div className="absolute bottom-4 left-4">
        <Card className="flex items-center gap-1 p-1">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex h-8 items-center gap-1 rounded-md px-2 text-xs hover:bg-accent">
              {Math.round(transform.scale * 100)}%
              <HugeiconsIcon icon={ArrowDown01Icon} size={14} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={zoomIn}>Zoom In</DropdownMenuItem>
              <DropdownMenuItem onClick={zoomOut}>Zoom Out</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={resetView}>Fit to Screen</DropdownMenuItem>
              <DropdownMenuSeparator />
              {ZOOM_PRESETS.map((preset) => (
                <DropdownMenuItem key={preset.value} onClick={() => zoomTo(preset.value)}>
                  {preset.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </Card>
      </div>

      {/* Bottom-right: Tool selector */}
      <div className="absolute right-4 bottom-4">
        <Card className="flex items-center gap-1 p-1">
          {tools.map((tool) => (
            <Button
              key={tool.id}
              variant={activeTool === tool.id ? "secondary" : "ghost"}
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setActiveTool(tool.id)}
              title={`${tool.label} (${tool.shortcut})`}
            >
              <HugeiconsIcon icon={tool.icon} size={18} />
            </Button>
          ))}
        </Card>
      </div>
    </>
  );
}
