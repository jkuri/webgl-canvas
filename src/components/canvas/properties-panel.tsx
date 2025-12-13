import { MinusSignIcon, PlusSignIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useCanvasStore } from "@/store";
import type { CanvasElement, LineElement, RectElement } from "@/types";

function SectionHeader({ title }: { title: string }) {
  return <span className="font-medium text-muted-foreground">{title}</span>;
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
); // Placeholder for visual consistency
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
); // Placeholder
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
); // Placeholder

const RotateIcon = () => (
  <svg
    className="size-3.5"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
  </svg>
);
const CornerRadiusIcon = () => (
  <svg
    className="size-3.5"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 3a9 9 0 0 1 9 9" />
    <path d="M12 22a10 10 0 0 0 10-10" />
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

interface NumberInputProps {
  value: number;
  onChange: (value: number) => void;
  label?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
  step?: number;
}

function NumberInput({ value, onChange, label, icon, className, step = 1 }: NumberInputProps) {
  const [localValue, setLocalValue] = useState(value.toString());

  useEffect(() => {
    setLocalValue(Number.isFinite(value) ? Number(value).toFixed(2).replace(/\.00$/, "") : "0");
  }, [value]);

  const handleBlur = () => {
    const num = parseFloat(localValue);
    if (!Number.isNaN(num)) {
      onChange(num);
    } else {
      setLocalValue(Number(value).toFixed(2).replace(/\.00$/, ""));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault(); // Prevent form submission if any
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <div className={cn("relative flex items-center", className)}>
      <div className="absolute left-2 flex items-center text-muted-foreground [&>svg]:size-3.5">
        {icon}
        {label && <span className="font-medium text-[10px] uppercase">{label}</span>}
      </div>
      <Input
        className="h-7 border-transparent bg-muted/50 pl-7 text-xs shadow-none hover:bg-muted focus-visible:ring-1"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        step={step}
        type="number"
      />
    </div>
  );
}

interface ColorInputProps {
  value?: string;
  opacity?: number;
  onChange: (value: string, opacity?: number) => void;
}

function ColorInput({ value = "#000000", opacity = 1, onChange }: ColorInputProps) {
  // Simple hex input + native color picker
  const [hex, setHex] = useState(value);
  const [alpha, setAlpha] = useState(Math.round(opacity * 100).toString());

  useEffect(() => {
    setHex(value);
    setAlpha(Math.round(opacity * 100).toString());
  }, [value, opacity]);

  const handleHexBlur = () => {
    // Basic validation
    if (/^#[0-9A-F]{6}$/i.test(hex)) {
      onChange(hex, parseFloat(alpha) / 100);
    } else {
      setHex(value);
    }
  };

  return (
    <div className="flex gap-2">
      <div className="relative flex flex-1 items-center">
        <div className="absolute top-1.5 left-1 size-4 overflow-hidden rounded-sm border shadow-sm">
          <input
            type="color"
            value={hex}
            onChange={(e) => {
              setHex(e.target.value);
              onChange(e.target.value, parseFloat(alpha) / 100);
            }}
            className="h-full w-full scale-150 cursor-pointer opacity-0"
          />
          <div className="pointer-events-none absolute inset-0" style={{ backgroundColor: hex }} />
        </div>
        <Input
          className="h-7 border-transparent bg-muted/50 pl-7 text-xs uppercase shadow-none hover:bg-muted focus-visible:ring-1"
          value={hex}
          onChange={(e) => setHex(e.target.value)}
          onBlur={handleHexBlur}
        />
      </div>
      <div className="relative w-16">
        <Input
          className="h-7 border-transparent bg-muted/50 pr-4 text-xs shadow-none hover:bg-muted focus-visible:ring-1"
          value={alpha}
          onChange={(e) => setAlpha(e.target.value)}
          onBlur={() => onChange(hex, Math.min(100, Math.max(0, parseFloat(alpha) || 0)) / 100)}
          type="number"
          min={0}
          max={100}
        />
        <span className="absolute top-1.5 right-2 text-[10px] text-muted-foreground">%</span>
      </div>
    </div>
  );
}

export function PropertiesPanel() {
  const selectedIds = useCanvasStore((s) => s.selectedIds);
  const elements = useCanvasStore((s) => s.elements);
  const updateElement = useCanvasStore((s) => s.updateElement);

  const selectedElement = elements.find((e) => e.id === selectedIds[0]);
  const isMultiple = selectedIds.length > 1;

  if (!selectedElement) {
    return (
      <div className="flex flex-col items-center justify-center p-4 text-muted-foreground text-xs">
        <p>No selection</p>
      </div>
    );
  }

  if (isMultiple) {
    return (
      <div className="flex flex-col items-center justify-center p-4 text-muted-foreground text-xs">
        <p>{selectedIds.length} items selected</p>
      </div>
    );
  }

  // Derived Values
  const bounds = getElementBounds(selectedElement);
  const isRect = selectedElement.type === "rect";
  const isEllipse = selectedElement.type === "ellipse";
  const isLine = selectedElement.type === "line";
  const supportsLayout = isRect || isEllipse || isLine; // Only fully support layout editing for these for now

  const updateBounds = (newBounds: Partial<Bounds>) => {
    const updated = { ...bounds, ...newBounds };

    if (isRect) {
      updateElement(selectedElement.id, { x: updated.x, y: updated.y, width: updated.width, height: updated.height });
    } else if (isEllipse) {
      const rx = updated.width / 2;
      const ry = updated.height / 2;
      updateElement(selectedElement.id, { cx: updated.x + rx, cy: updated.y + ry, rx, ry });
    } else if (isLine) {
      // Logic for line: x/y is center, width is length, rotation is angle
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
    <div className="flex flex-col gap-0 text-foreground text-xs">
      {/* Header */}
      <div className="flex h-10 items-center justify-between border-b px-3 font-medium">
        <span className="truncate">{selectedElement.name}</span>
        <div className="flex items-center gap-1 text-muted-foreground">
          <SettingsIcon />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {/* Alignment (Placeholder visual) */}
        <div className="flex items-center justify-between px-2 py-3">
          <button type="button" className="rounded p-1 hover:bg-muted">
            <AlignLeftIcon />
          </button>
          <button type="button" className="rounded p-1 hover:bg-muted">
            <AlignCenterIcon />
          </button>
          <button type="button" className="rounded p-1 hover:bg-muted">
            <AlignRightIcon />
          </button>
          <button type="button" className="rounded p-1 hover:bg-muted">
            <AlignTopIcon />
          </button>
          <button type="button" className="rounded p-1 hover:bg-muted">
            <AlignMiddleIcon />
          </button>
          <button type="button" className="rounded p-1 hover:bg-muted">
            <AlignBottomIcon />
          </button>
        </div>

        <Separator />

        {/* Position & Rotation */}
        {supportsLayout && (
          <div className="flex flex-col gap-2 p-3">
            <span className="font-medium text-muted-foreground">Position</span>
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
              {/* Placeholder for Flip? */}
            </div>
          </div>
        )}

        <Separator />

        {/* Layout */}
        {supportsLayout && (
          <div className="flex flex-col gap-2 p-3">
            <span className="font-medium text-muted-foreground">Layout</span>
            <div className="grid grid-cols-2 gap-2">
              <NumberInput label="W" value={bounds.width} onChange={(v) => updateBounds({ width: v })} />
              <NumberInput
                label="H"
                value={bounds.height}
                onChange={(v) => updateBounds({ height: v })}
                className={cn(isLine && "pointer-events-none opacity-50")}
              />
            </div>
          </div>
        )}

        {supportsLayout && <Separator />}

        {/* Appearance */}
        {selectedElement.type !== "group" && (
          <div className="flex flex-col gap-2 p-3">
            <div className="flex items-center justify-between">
              <span className="font-medium text-muted-foreground">Appearance</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <NumberInput
                label="Opacity"
                value={(selectedElement.opacity ?? 1) * 100}
                onChange={(v) => updateElement(selectedElement.id, { opacity: v / 100 })}
                step={1}
              />
              {isRect && (
                <NumberInput
                  icon={<CornerRadiusIcon />}
                  value={(selectedElement as RectElement).rx || 0}
                  onChange={(v) => updateElement(selectedElement.id, { rx: v, ry: v })}
                />
              )}
            </div>
          </div>
        )}

        {selectedElement.type !== "group" && <Separator />}

        {/* Fill */}
        {selectedElement.type !== "group" && !isLine && (
          <div className="flex flex-col gap-2 p-3">
            <div className="flex items-center justify-between">
              <span className="font-medium text-muted-foreground">Fill</span>
              <button type="button" className="text-muted-foreground hover:text-foreground">
                +
              </button>
            </div>
            <ColorInput
              value={typeof selectedElement.fill === "string" ? selectedElement.fill : "#000000"}
              onChange={(hex) => updateElement(selectedElement.id, { fill: hex })}
            />
          </div>
        )}

        {selectedElement.type !== "group" && <Separator />}

        {/* Stroke */}
        {selectedElement.type !== "group" && (
          <div className="flex flex-col gap-2 p-4">
            <div className="flex items-center justify-between">
              <SectionHeader title="Stroke" />
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground"
                  onClick={() => {
                    if (selectedElement.stroke) {
                      updateElement(selectedElement.id, { stroke: null });
                    } else {
                      updateElement(selectedElement.id, {
                        stroke: { color: "#000000", width: 1, dashArray: [] },
                      });
                    }
                  }}
                >
                  {selectedElement.stroke ? (
                    <HugeiconsIcon icon={MinusSignIcon} className="size-3.5" />
                  ) : (
                    <HugeiconsIcon icon={PlusSignIcon} className="size-3.5" />
                  )}
                </Button>
              </div>
            </div>

            {selectedElement.stroke && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <div className="size-4 rounded-sm border" style={{ backgroundColor: selectedElement.stroke.color }} />
                  <ColorInput
                    value={selectedElement.stroke.color}
                    opacity={1}
                    onChange={(color) =>
                      updateElement(selectedElement.id, {
                        stroke: { ...selectedElement.stroke!, color },
                      })
                    }
                  />
                  <Input
                    className="h-7 w-12 px-1 text-center text-xs"
                    type="number"
                    value={selectedElement.stroke.width}
                    min={0}
                    onChange={(e) =>
                      updateElement(selectedElement.id, {
                        stroke: { ...selectedElement.stroke!, width: parseFloat(e.target.value) || 0 },
                      })
                    }
                  />
                </div>

                <div className="flex items-center gap-2">
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
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue>Style</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="solid">Solid</SelectItem>
                      <SelectItem value="dashed">Dashed</SelectItem>
                      <SelectItem value="dotted">Dotted</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            {isLine && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-muted-foreground uppercase">Start</span>
                  <select
                    className="h-7 w-full rounded border border-input bg-transparent px-2 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={(selectedElement as LineElement).markerStart || "none"}
                    onChange={(e) =>
                      updateElement(selectedElement.id, { markerStart: e.target.value as "none" | "arrow" })
                    }
                  >
                    <option value="none">None</option>
                    <option value="arrow">Arrow</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-muted-foreground uppercase">End</span>
                  <select
                    className="h-7 w-full rounded border border-input bg-transparent px-2 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={(selectedElement as LineElement).markerEnd || "none"}
                    onChange={(e) =>
                      updateElement(selectedElement.id, { markerEnd: e.target.value as "none" | "arrow" })
                    }
                  >
                    <option value="none">None</option>
                    <option value="arrow">Arrow</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
