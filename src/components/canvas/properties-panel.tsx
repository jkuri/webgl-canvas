import { MinusSignIcon, PlusSignIcon, ViewOffSlashIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { ColorInput } from "@/components/shared/color-input";
import { NumberInput } from "@/components/shared/number-input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useCanvasStore } from "@/store";
import type { CanvasElement, LineElement, RectElement } from "@/types";
import { LineMarkerSelect } from "./line-marker-select";

function SectionHeader({ title }: { title: string }) {
  return <span className="font-semibold text-[10px] text-muted-foreground uppercase tracking-wider">{title}</span>;
}

// Icons
const AlignLeftIcon = () => (
  <svg
    className="size-4"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="21" x2="3" y1="6" y2="6" />
    <line x1="15" x2="3" y1="12" y2="12" />
    <line x1="17" x2="3" y1="18" y2="18" />
  </svg>
);
const AlignCenterIcon = () => (
  <svg
    className="size-4"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="21" x2="3" y1="6" y2="6" />
    <line x1="17" x2="7" y1="12" y2="12" />
    <line x1="19" x2="5" y1="18" y2="18" />
  </svg>
);
const AlignRightIcon = () => (
  <svg
    className="size-4"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="21" x2="3" y1="6" y2="6" />
    <line x1="21" x2="9" y1="12" y2="12" />
    <line x1="21" x2="7" y1="18" y2="18" />
  </svg>
);
const AlignTopIcon = () => (
  <svg
    className="size-4"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 3v18" />
    <path d="M6 9l6-6 6 6" />
  </svg>
);
const AlignMiddleIcon = () => (
  <svg
    className="size-4"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 12H3" />
    <path d="M12 21V3" />
  </svg>
);
const AlignBottomIcon = () => (
  <svg
    className="size-4"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 21V3" />
    <path d="M6 15l6 6 6-6" />
  </svg>
);

const RotateIcon = () => (
  <svg
    className="size-3.5"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    transform="scale(-1, 1)"
  >
    <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
  </svg>
);

const SettingsIcon = () => (
  <svg
    className="size-4"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="4" x2="20" y1="12" y2="12" />
    <line x1="4" x2="20" y1="6" y2="6" />
    <line x1="4" x2="20" y1="18" y2="18" />
  </svg>
);

const EyeIcon = () => (
  <svg
    className="size-4"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const GridIcon = () => (
  <svg
    className="size-4"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect width="7" height="7" x="3" y="3" rx="1" />
    <rect width="7" height="7" x="14" y="3" rx="1" />
    <rect width="7" height="7" x="14" y="14" rx="1" />
    <rect width="7" height="7" x="3" y="14" rx="1" />
  </svg>
);
const SlidersIcon = () => (
  <svg
    className="size-4"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="4" x2="20" y1="21" y2="21" />
    <line x1="4" x2="20" y1="14" y2="14" />
    <line x1="4" x2="20" y1="7" y2="7" />
    <circle cx="12" cy="21" r="2" />
    <circle cx="8" cy="7" r="2" />
    <circle cx="16" cy="14" r="2" />
  </svg>
);
const WeightIcon = () => (
  <svg
    className="size-3.5"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="21" x2="3" y1="6" y2="6" />
    <line x1="21" x2="3" y1="12" y2="12" />
    <line x1="21" x2="3" y1="18" y2="18" />
  </svg>
);

// Helper Types
interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

// Helper to get bounds from element
function getElementBounds(element: CanvasElement): Bounds {
  if (element.type === "rect") {
    return {
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.height,
      rotation: element.rotation || 0,
    };
  }
  if (element.type === "ellipse") {
    return {
      x: element.cx - element.rx,
      y: element.cy - element.ry,
      width: element.rx * 2,
      height: element.ry * 2,
      rotation: element.rotation || 0,
    };
  }
  if (element.type === "line") {
    const dx = element.x2 - element.x1;
    const dy = element.y2 - element.y1;
    return {
      x: (element.x1 + element.x2) / 2,
      y: (element.y1 + element.y2) / 2,
      width: Math.sqrt(dx * dx + dy * dy),
      height: 0,
      rotation: Math.atan2(dy, dx),
    };
  }
  // Fallback for path/group (visual approximation or 0)
  return { x: 0, y: 0, width: 0, height: 0, rotation: element.rotation || 0 };
}

export function PropertiesPanel() {
  const selectedIds = useCanvasStore((s) => s.selectedIds);
  const elements = useCanvasStore((s) => s.elements);
  const updateElement = useCanvasStore((s) => s.updateElement);
  const canvasBackground = useCanvasStore((s) => s.canvasBackground);
  const setCanvasBackground = useCanvasStore((s) => s.setCanvasBackground);
  const canvasBackgroundVisible = useCanvasStore((s) => s.canvasBackgroundVisible);
  const setCanvasBackgroundVisible = useCanvasStore((s) => s.setCanvasBackgroundVisible);

  const selectedElement = elements.find((e) => e.id === selectedIds[0]);
  const isMultiple = selectedIds.length > 1;

  if (!selectedElement) {
    return (
      <div className="flex h-full flex-col gap-0 text-foreground text-xs">
        {/* Header */}
        <div className="flex h-10 shrink-0 items-center justify-between border-b px-3 font-medium">
          <span className="truncate">Page</span>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto overflow-x-hidden p-2">
          {/* Page Background */}
          <div className="flex flex-col gap-3 p-3">
            <SectionHeader title="Background" />
            <div className="flex items-center gap-2">
              <ColorInput
                className="flex-1"
                value={canvasBackground}
                onChange={(hex) => setCanvasBackground(hex)}
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                onClick={() => setCanvasBackgroundVisible(!canvasBackgroundVisible)}
              >
                {canvasBackgroundVisible ? (
                  <EyeIcon />
                ) : (
                  <HugeiconsIcon icon={ViewOffSlashIcon} className="size-3.5" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isMultiple) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-4 text-muted-foreground text-xs">
        <p>{selectedIds.length} items selected</p>
      </div>
    );
  }

  // Derived Values
  const bounds = getElementBounds(selectedElement);
  const isRect = selectedElement.type === "rect";
  const isEllipse = selectedElement.type === "ellipse";
  const isLine = selectedElement.type === "line";
  const supportsLayout = isRect || isEllipse || isLine;

  const updateBounds = (newBounds: Partial<Bounds>) => {
    const updated = { ...bounds, ...newBounds };

    if (isRect) {
      updateElement(selectedElement.id, { x: updated.x, y: updated.y, width: updated.width, height: updated.height });
    } else if (isEllipse) {
      const rx = updated.width / 2;
      const ry = updated.height / 2;
      updateElement(selectedElement.id, { cx: updated.x + rx, cy: updated.y + ry, rx, ry });
    } else if (isLine) {
      const cx = updated.x;
      const cy = updated.y;
      const length = updated.width;
      const rotation = updated.rotation; // Radians

      const cos = Math.cos(rotation);
      const sin = Math.sin(rotation);

      const dx = (length / 2) * cos;
      const dy = (length / 2) * sin;

      updateElement(selectedElement.id, {
        x1: cx - dx,
        y1: cy - dy,
        x2: cx + dx,
        y2: cy + dy,
      });
    }
  };

  return (
    <div className="flex h-full flex-col gap-0 text-foreground text-xs">
      {/* Header */}
      <div className="flex h-10 shrink-0 items-center justify-between border-b px-3 font-medium">
        <span className="truncate">{selectedElement.name}</span>
        <div className="flex items-center gap-1 text-muted-foreground">
          <SettingsIcon />
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto overflow-x-hidden p-2">
        {/* Alignment */}
        <div className="flex items-center justify-between px-1">
          <button type="button" className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
            <AlignLeftIcon />
          </button>
          <button type="button" className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
            <AlignCenterIcon />
          </button>
          <button type="button" className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
            <AlignRightIcon />
          </button>
          <button type="button" className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
            <AlignTopIcon />
          </button>
          <button type="button" className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
            <AlignMiddleIcon />
          </button>
          <button type="button" className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
            <AlignBottomIcon />
          </button>
        </div>

        <Separator />

        {/* Position */}
        {supportsLayout && (
          <div className="flex flex-col gap-2">
            <SectionHeader title="Position" />
            <div className="grid grid-cols-2 gap-2">
              <NumberInput label="X" value={bounds.x} onChange={(v) => updateBounds({ x: v })} />
              <NumberInput label="Y" value={bounds.y} onChange={(v) => updateBounds({ y: v })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <NumberInput
                icon={<RotateIcon />}
                value={(bounds.rotation * 180) / Math.PI}
                onChange={(v) =>
                  isLine
                    ? updateBounds({ rotation: (v * Math.PI) / 180 })
                    : updateElement(selectedElement.id, { rotation: (v * Math.PI) / 180 })
                }
              />
            </div>
          </div>
        )}

        <Separator />

        {/* Layout */}
        {supportsLayout && (
          <div className="flex flex-col gap-2">
            <SectionHeader title="Layout" />
            <div className="grid grid-cols-2 gap-2">
              <NumberInput label="W" value={bounds.width} onChange={(v) => updateBounds({ width: v })} />
              <NumberInput
                label="H"
                value={bounds.height}
                onChange={(v) => updateBounds({ height: v })}
                disabled={isLine}
                className={cn(isLine && "opacity-50")}
              />
            </div>
          </div>
        )}

        <Separator />

        {/* Appearance */}
        {selectedElement.type !== "group" && (
          <div className="flex flex-col gap-3 p-3">
            <SectionHeader title="Appearance" />
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <span className="font-medium text-[10px] text-muted-foreground uppercase">Opacity</span>
                <NumberInput
                  value={(selectedElement.opacity ?? 1) * 100}
                  onChange={(v) => updateElement(selectedElement.id, { opacity: v / 100 })}
                  step={1}
                />
              </div>
              {isRect && (
                <div className="flex flex-col gap-1">
                  <span className="font-medium text-[10px] text-muted-foreground uppercase">Corner Radius</span>
                  <NumberInput
                    value={(selectedElement as RectElement).rx || 0}
                    onChange={(v) => updateElement(selectedElement.id, { rx: v, ry: v })}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {selectedElement.type !== "group" && <Separator />}

        {/* Fill */}
        {selectedElement.type !== "group" && !isLine && (
          <div className="flex flex-col gap-3 p-3">
            <div className="flex items-center justify-between">
              <SectionHeader title="Fill" />
              <div className="flex items-center gap-1">
                <Button size="icon" variant="ghost" className="h-4 w-4 text-muted-foreground hover:text-foreground">
                  <GridIcon />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-4 w-4 text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    if (!selectedElement.fill) {
                      updateElement(selectedElement.id, { fill: "#000000" });
                    }
                  }}
                >
                  <HugeiconsIcon icon={PlusSignIcon} className="size-3" />
                </Button>
              </div>
            </div>
            {selectedElement.fill && (
              <div className="flex items-center gap-2">
                <ColorInput
                  className="flex-1"
                  value={typeof selectedElement.fill === "string" ? selectedElement.fill : "#000000"}
                  onChange={(hex) => updateElement(selectedElement.id, { fill: hex })}
                />
                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground">
                  <EyeIcon />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                  onClick={() => updateElement(selectedElement.id, { fill: null })}
                >
                  <HugeiconsIcon icon={MinusSignIcon} className="size-3.5" />
                </Button>
              </div>
            )}
          </div>
        )}

        {selectedElement.type !== "group" && <Separator />}

        {/* Stroke */}
        {selectedElement.type !== "group" && (
          <div className="flex flex-col gap-3 p-3">
            <div className="flex items-center justify-between">
              <SectionHeader title="Stroke" />
              <div className="flex items-center gap-1">
                <Button size="icon" variant="ghost" className="h-4 w-4 text-muted-foreground hover:text-foreground">
                  <GridIcon />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-4 w-4 text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    if (!selectedElement.stroke) {
                      updateElement(selectedElement.id, { stroke: { color: "#000000", width: 1, dashArray: [] } });
                    }
                  }}
                >
                  <HugeiconsIcon icon={PlusSignIcon} className="size-3" />
                </Button>
              </div>
            </div>

            {selectedElement.stroke && (
              <div className="flex flex-col gap-3">
                {/* Row 1: Color */}
                <div className="flex items-center gap-2">
                  <ColorInput
                    className="flex-1"
                    value={selectedElement.stroke.color}
                    opacity={1}
                    onChange={(color) =>
                      updateElement(selectedElement.id, {
                        stroke: { ...selectedElement.stroke!, color },
                      })
                    }
                  />
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground">
                    <EyeIcon />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                    onClick={() => updateElement(selectedElement.id, { stroke: null })}
                  >
                    <HugeiconsIcon icon={MinusSignIcon} className="size-3.5" />
                  </Button>
                </div>

                {/* Row 2: Position & Weight */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <span className="font-medium text-[10px] text-muted-foreground uppercase">Position</span>
                    <Select defaultValue="center">
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="inside">Inside</SelectItem>
                        <SelectItem value="center">Center</SelectItem>
                        <SelectItem value="outside">Outside</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="font-medium text-[10px] text-muted-foreground uppercase">Weight</span>
                    <div className="flex items-center gap-2">
                      <NumberInput
                        icon={<WeightIcon />}
                        value={selectedElement.stroke.width}
                        onChange={(v) =>
                          updateElement(selectedElement.id, {
                            stroke: { ...selectedElement.stroke!, width: v },
                          })
                        }
                        step={1}
                        className="flex-1"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      >
                        <SlidersIcon />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Dash Array */}
                <Select
                  value={
                    selectedElement.stroke.dashArray?.length
                      ? selectedElement.stroke.dashArray[0] === 1
                        ? "dotted"
                        : "dashed"
                      : "solid"
                  }
                  onValueChange={(val) => {
                    let dashArray: number[] = [];
                    if (val === "dashed") dashArray = [6, 6];
                    if (val === "dotted") dashArray = [1, 5];
                    updateElement(selectedElement.id, {
                      stroke: { ...selectedElement.stroke!, dashArray },
                    });
                  }}
                >
                  <SelectTrigger className="h-7 w-full text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="solid">Solid</SelectItem>
                    <SelectItem value="dashed">Dashed</SelectItem>
                    <SelectItem value="dotted">Dotted</SelectItem>
                  </SelectContent>
                </Select>

                {/* Line specific markers */}
                {isLine && (
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1">
                      <span className="font-medium text-[10px] text-muted-foreground uppercase">Start</span>
                      <LineMarkerSelect
                        value={(selectedElement as LineElement).markerStart || "none"}
                        onChange={(val) => updateElement(selectedElement.id, { markerStart: val })}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="font-medium text-[10px] text-muted-foreground uppercase">End</span>
                      <LineMarkerSelect
                        value={(selectedElement as LineElement).markerEnd || "none"}
                        onChange={(val) => updateElement(selectedElement.id, { markerEnd: val })}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
